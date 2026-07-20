'use client'
import { useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'

const EXAMPLES = [
  'Wo könnte ich aktuell am meisten optimieren?',
  'Sollte ich eher tilgen oder investieren?',
  'Wie sieht mein Cashflow-Puffer im Vergleich zu meinen Krediten aus?',
]

export function AskTips({ context }: { context: string }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    if (!q.trim() || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/tips-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Antwort fehlgeschlagen')
      setAnswer(result.answer)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardTitle>Frag deine Zahlen</CardTitle>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Beantwortet auf Basis deiner aktuellen Daten - Kredite, Immobilien, Vermögen, Kennzahlen.
      </p>

      <div className="flex gap-2 flex-wrap mb-3">
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            type="button"
            onClick={() => { setQuestion(ex); ask(ex) }}
            className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200"
          >
            {ex}
          </button>
        ))}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); ask(question) }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Was könnte ich jetzt optimieren?"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '...' : 'Fragen'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {answer && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-3 text-sm text-gray-800 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </Card>
  )
}
