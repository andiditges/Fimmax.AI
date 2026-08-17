import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAiUsageLimit } from '@/lib/ai-usage-limit'
import { isAiEnabledForUser, AI_DISABLED_MESSAGE } from '@/lib/ai-features-enabled'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  if (!isAiEnabledForUser(user.email)) return NextResponse.json({ error: AI_DISABLED_MESSAGE }, { status: 403 })
  if (!(await checkAiUsageLimit(supabase, user.id, 'analyze_receipt'))) {
    return NextResponse.json({ error: 'Tageslimit für KI-Beleg-Analyse erreicht (Beta-Limit) - bitte morgen erneut versuchen oder den Beleg manuell erfassen.' }, { status: 429 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const propertiesJson = formData.get('properties') as string | null

  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'

  const properties = propertiesJson ? JSON.parse(propertiesJson) : []
  const propertyList = properties.map((p: { id: string; address: string }) => `- ${p.address} (ID: ${p.id})`).join('\n')

  const systemPrompt = `Du bist ein Assistent für deutsche Vermieter. Analysiere den Beleg und gib ausschließlich valides JSON zurück.

Bekannte Immobilien des Nutzers:
${propertyList || '(noch keine hinterlegt)'}

Kategorien (jede Position bekommt genau eine):
- instandhaltung: Reparaturen, Handwerker, Materialien für die Immobilie
- verwaltung: Hausverwaltung, Kontoführung, Steuerberater
- versicherung: Gebäude-, Haftpflicht-, Rechtschutzversicherung
- grundsteuer: Grundsteuer-Bescheide
- zinsen: Kreditzinsen, Bankgebühren für Immobilienkredit
- hausgeld: WEG-Hausgeld, Nebenkostenvorauszahlungen
- abfall: Müllgebühren, Abfallgebührenbescheide
- sonstiges: alles andere

Ein Beleg kann MEHRERE Positionen enthalten, wenn er mehrere Kostenarten oder
mehrere Immobilien/Einheiten abdeckt - erzwinge NICHT künstlich eine einzige
Kategorie oder Immobilie. Typisches Beispiel: ein "Bescheid über die
Grundbesitzabgaben" einer Stadt/Gemeinde bündelt oft Grundsteuer UND
Müllgebühren (Abfall) in einer Zahlungsübersicht für dieselbe Immobilie - das
sind dann zwei Positionen (category "grundsteuer" und "abfall"), auch wenn
nur ein Gesamtbetrag/eine Zahlungsübersicht abgedruckt ist. Ein anderes
Beispiel: eine Sammelrechnung (z.B. Baumarkt) für Material, das mehreren
Einheiten zugeordnet werden soll, ergibt eine Position pro Immobilie.

Wenn auf dem Beleg mehrere Kostenarten erkennbar sind, aber nicht eindeutig
ist, wie sich der Gesamtbetrag genau auf die Positionen aufteilt (z.B. weil
ein Änderungsbescheid nur eine Differenz nennt), setze "needs_review" auf
true und erkläre in "review_note" kurz, was der Nutzer prüfen/ergänzen sollte
- rate nicht einfach eine Aufteilung, wenn sie nicht aus dem Dokument
hervorgeht.

is_renovation = true nur für Positionen der Kategorie instandhaltung, wenn es
sich um Renovierungs- oder Instandsetzungsarbeiten handelt (relevant für
15%-Grenze).

Wenn eine Position zu keiner der Kategorien wirklich passt und du sie deshalb
als "sonstiges" einordnest, gib zusätzlich in "unmapped_label" die auf dem
Beleg verwendete Original-Bezeichnung der Kostenart an (z.B. "Hausmeisterservice",
"Schädlingsbekämpfung") - das hilft, später eine passende Kategorie zu
ergänzen. Bei allen anderen Kategorien bleibt "unmapped_label" null.`

  const userPrompt = `Analysiere diesen Beleg. Antworte NUR mit JSON, kein anderer Text:
{
  "receipt_date": "YYYY-MM-DD oder null",
  "amount": Gesamtbetrag des Belegs als Zahl (Brutto),
  "vendor": "Lieferant/Firma/Behörde oder null",
  "items": [
    {
      "category": "eine der Kategorien",
      "amount": Betrag dieser Position als Zahl,
      "description": "kurze Beschreibung der Leistung",
      "suggested_property_id": "UUID der wahrscheinlichsten Immobilie für diese Position oder null",
      "is_renovation": true oder false,
      "unmapped_label": "Original-Bezeichnung, falls category=sonstiges nur als Notlösung gewählt wurde, sonst null"
    }
  ],
  "needs_review": true oder false,
  "review_note": "kurzer Hinweis, was zu prüfen ist, oder null",
  "confidence": Zahl zwischen 0 und 1
}
"items" enthält mindestens einen Eintrag. Wenn der Beleg nur eine Kostenart/
Immobilie betrifft, hat "items" genau einen Eintrag (Summe = "amount").`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            mediaType === 'application/pdf'
              ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
              : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Kein JSON in der Antwort')

    const result = JSON.parse(jsonMatch[0])

    type AiItemResult = { category: string; unmapped_label?: string | null; description?: string | null }
    const gaps: AiItemResult[] = Array.isArray(result.items)
      ? result.items.filter((i: AiItemResult) => i.category === 'sonstiges' && i.unmapped_label)
      : []
    if (gaps.length > 0) {
      // Fire-and-forget: das Loggen einer Kategorielücke darf die eigentliche
      // Analyse-Antwort nie zum Scheitern bringen.
      supabase.from('ai_category_gaps').insert(
        gaps.map(i => ({
          user_id: user.id,
          raw_label: i.unmapped_label,
          vendor: result.vendor ?? null,
          description: i.description ?? null,
        }))
      ).then(({ error }) => {
        if (error) console.error('ai_category_gaps Logging fehlgeschlagen:', error)
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('KI-Analyse Fehler:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 })
  }
}
