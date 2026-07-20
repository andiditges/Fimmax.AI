import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const systemPrompt = `Du bist der persönliche Finanz-/Immobilien-Analyst eines deutschen Vermieters und privaten Immobilieninvestors. Du bekommst eine Zusammenfassung seines aktuellen Portfolios (Immobilien, Kredite, Vermögenswerte, Kennzahlen) und beantwortest seine Frage dazu.

Regeln:
- Antworte ausschließlich auf Basis der gelieferten Daten. Wenn etwas fehlt, sag das explizit statt zu raten.
- Sei konkret: wenn du eine Optimierung vorschlägst, nenne WO (welche Immobilie/welcher Kredit), WAS genau, und WARUM (mit Zahlen aus den Daten, wenn möglich).
- Kein Blabla, keine Disclaimer-Kaskaden. Direkt und knapp, wie ein guter Sparringspartner - nicht wie ein Bankberater.
- Du gibst keine verbindliche Steuer- oder Anlageberatung, sondern Einordnung und Denkanstöße. Bei größeren Entscheidungen kurz darauf hinweisen, dass er es final selbst/mit Steuerberater prüfen sollte - aber nicht bei jeder Antwort, nur wenn es wirklich relevant ist.
- Antworte auf Deutsch, in Fließtext oder kurzen Stichpunkten, keine übertriebene Formatierung.`

export async function POST(req: NextRequest) {
  const { question, context } = await req.json()
  if (!question || !context) return NextResponse.json({ error: 'Frage oder Kontext fehlt' }, { status: 400 })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Portfolio-Daten:\n${context}\n\nFrage: ${question}` },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ answer: text })
  } catch (err) {
    console.error('Tipps-Frage Fehler:', err)
    return NextResponse.json({ error: 'Antwort fehlgeschlagen' }, { status: 500 })
  }
}
