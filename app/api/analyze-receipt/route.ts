import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { ReceiptCategory } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
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

Kategorien (wähle genau eine):
- instandhaltung: Reparaturen, Handwerker, Materialien für die Immobilie
- verwaltung: Hausverwaltung, Kontoführung, Steuerberater
- versicherung: Gebäude-, Haftpflicht-, Rechtschutzversicherung
- grundsteuer: Grundsteuer-Bescheide
- zinsen: Kreditzinsen, Bankgebühren für Immobilienkredit
- hausgeld: WEG-Hausgeld, Nebenkostenvorauszahlungen
- sonstiges: alles andere

is_renovation = true nur wenn es sich um Renovierungs- oder Instandsetzungsarbeiten handelt (relevant für 15%-Grenze).`

  const userPrompt = `Analysiere diesen Beleg. Antworte NUR mit JSON, kein anderer Text:
{
  "receipt_date": "YYYY-MM-DD oder null",
  "amount": Betrag als Zahl (Brutto-Gesamtbetrag),
  "vendor": "Lieferant/Firma oder null",
  "description": "kurze Beschreibung der Leistung",
  "category": "eine der Kategorien",
  "is_renovation": true oder false,
  "suggested_property_id": "UUID der wahrscheinlichsten Immobilie oder null",
  "confidence": Zahl zwischen 0 und 1
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType.startsWith('image/') ? mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' : 'image/jpeg', data: base64 },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Kein JSON in der Antwort')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('KI-Analyse Fehler:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 })
  }
}
