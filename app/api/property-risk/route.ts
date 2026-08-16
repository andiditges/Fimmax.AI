import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAiUsageLimit } from '@/lib/ai-usage-limit'
import { aiFeaturesEnabled, AI_DISABLED_MESSAGE } from '@/lib/ai-features-enabled'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const systemPrompt = `Du bist ein nüchterner Immobilien-Standortanalyst für einen deutschen Vermieter/Investor. Du bekommst Adresse und Eckdaten einer Immobilie und schätzt das Standortrisiko ein - basierend auf deinem allgemeinen Wissen über die Region (Demografie/Bevölkerungsentwicklung, Preistrend der letzten Jahre, wirtschaftliche Lage/Arbeitsmarkt, Neubauaktivität in der Umgebung - hochwertige Neubauten werten eher auf, ein Überangebot an Neubauwohnungen drückt eher).

Wichtig: Du hast keinen Zugriff auf Live-Daten oder aktuelle Marktberichte - nur dein Trainingswissen. Sei ehrlich über Unsicherheit, spekuliere nicht mit falscher Präzision, und weise explizit darauf hin, wenn du zu einem Ort wenig weißt.

Score-Skala 1-10, wobei 1 = sehr geringes Risiko (stabile/wachsende Nachfrage, gute Lage) und 10 = sehr hohes Risiko (schrumpfende Region, fallende Preise, Überangebot). Gib ausschließlich valides JSON zurück, kein anderer Text.`

export async function POST(req: NextRequest) {
  if (!aiFeaturesEnabled()) return NextResponse.json({ error: AI_DISABLED_MESSAGE }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  if (!(await checkAiUsageLimit(supabase, user.id, 'property_risk'))) {
    return NextResponse.json({ error: 'Tageslimit für KI-Standortrisiko erreicht (Beta-Limit) - bitte morgen erneut versuchen.' }, { status: 429 })
  }

  const { address, build_year, purchase_price, current_value } = await req.json()
  if (!address) return NextResponse.json({ error: 'Keine Adresse' }, { status: 400 })

  const userPrompt = `Immobilie:
- Adresse: ${address}
- Baujahr: ${build_year ?? 'unbekannt'}
- Kaufpreis: ${purchase_price ?? 'unbekannt'} €
- Aktueller Wert (falls gepflegt): ${current_value ?? 'nicht hinterlegt'} €

Antworte NUR mit JSON:
{
  "score": Zahl zwischen 1 und 10,
  "summary": "2-3 Sätze Gesamteinschätzung auf Deutsch",
  "factors": [
    { "label": "kurzer Faktor-Name", "direction": "positiv" | "negativ" | "neutral", "note": "1 Satz Begründung" }
  ]
}
Nenne 3-5 Faktoren (Demografie, Preistrend, Neubau/Angebot, Wirtschaft/Arbeitsmarkt, ggf. weitere).`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Kein JSON in der Antwort')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('Risiko-Analyse Fehler:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 })
  }
}
