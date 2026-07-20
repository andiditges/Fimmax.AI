'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { propertyLabel, formatDate } from '@/lib/format'
import { Property, RiskFactor } from '@/lib/types'

function scoreColor(score: number | null): string {
  if (score == null) return 'bg-gray-100 text-gray-500'
  if (score >= 7) return 'bg-red-100 text-red-700'
  if (score >= 4) return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-700'
}

const DIRECTION_COLOR: Record<RiskFactor['direction'], string> = {
  positiv: 'text-green-600',
  negativ: 'text-red-600',
  neutral: 'text-gray-500',
}

function PropertyRiskRow({ property }: { property: Property }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function reassess() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/property-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: propertyLabel(property),
          build_year: property.build_year,
          purchase_price: property.purchase_price,
          current_value: property.current_value,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Analyse fehlgeschlagen')

      const { error: dbError } = await supabase
        .from('properties')
        .update({
          risk_score: result.score,
          risk_summary: result.summary,
          risk_factors: result.factors,
          risk_assessed_at: new Date().toISOString(),
        })
        .eq('id', property.id)
      if (dbError) throw new Error(dbError.message)

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="text-left font-medium text-gray-900 text-sm hover:text-blue-700"
            disabled={!property.risk_summary}
          >
            {propertyLabel(property)}
          </button>
          {property.risk_assessed_at ? (
            <p className="text-xs text-gray-400 mt-0.5">zuletzt bewertet {formatDate(property.risk_assessed_at)}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">noch nicht bewertet</p>
          )}
        </div>
        <span className={`text-sm font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${scoreColor(property.risk_score)}`}>
          {property.risk_score != null ? `${property.risk_score}/10` : '–'}
        </span>
      </div>

      {expanded && property.risk_summary && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <p className="text-sm text-gray-600">{property.risk_summary}</p>
          {property.risk_factors && (
            <ul className="space-y-1">
              {property.risk_factors.map((f, i) => (
                <li key={i} className="text-xs">
                  <span className={`font-medium ${DIRECTION_COLOR[f.direction]}`}>{f.label}</span>
                  <span className="text-gray-500"> - {f.note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <button
        type="button"
        onClick={reassess}
        disabled={loading}
        className="text-xs text-blue-600 hover:underline mt-3 disabled:opacity-50"
      >
        {loading ? 'Bewerte...' : property.risk_score != null ? 'Neu bewerten' : 'Jetzt bewerten'}
      </button>
    </Card>
  )
}

export function RiskOverview({ properties }: { properties: Property[] }) {
  if (properties.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        KI-Einschätzung auf Basis von allgemeinem Wissen zur Region (Demografie, Preistrend, Neubauaktivität) - keine Live-Marktdaten, per Klick manuell aktualisiert.
      </p>
      {properties.map(p => (
        <PropertyRiskRow key={p.id} property={p} />
      ))}
    </div>
  )
}
