'use client'

import { Clock, CheckCircle2, Circle } from 'lucide-react'
import { euro } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import { netWorthTier, NET_WORTH_TIERS } from '@/lib/net-worth'

// 4 Nachkommastellen statt 2, damit bei den üblichen Tages-Tilgungsraten
// (wenige € bis niedriger zweistelliger Betrag) jede Sekunde sichtbar etwas
// weiterläuft, statt dass sich die Cent-Stelle erst nach vielen Sekunden
// einmal ändert - der Sinn der Uhr ist gerade die spürbare Bewegung.
function formatTicker(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

/**
 * "Rentenuhr": läuft rein clientseitig auf Basis der beim Server-Render
 * bekannten Werte weiter (Restschuld/Tilgung zum Zeitpunkt asOf + aktuell
 * laufende Tages-Tilgungsrate) - keine Server-Roundtrips, nur eine simple
 * lineare Fortschreibung. Symbolisch/illustrativ, keine exakte Abrechnung
 * (die reale Tilgung erfolgt weiterhin nur zu den tatsächlichen Zahlterminen).
 */
export function Rentenuhr({
  initialDebt,
  initialPaid,
  dailyPrincipalRate,
  asOf,
  netWorth,
}: {
  initialDebt: number
  initialPaid: number
  dailyPrincipalRate: number
  asOf: string
  netWorth?: number
}) {
  const now = useNow(200)
  const elapsedMs = now ? now.getTime() - new Date(asOf).getTime() : 0

  const ratePerMs = dailyPrincipalRate / (24 * 60 * 60 * 1000)
  const totalPrincipal = initialDebt + initialPaid
  const debtNow = Math.max(0, initialDebt - ratePerMs * elapsedMs)
  const paidNow = Math.min(totalPrincipal, initialPaid + ratePerMs * elapsedMs)

  const { index, total, tier } = netWorthTier(netWorth ?? 0)
  const nextTier = NET_WORTH_TIERS[index + 1] ?? null
  const progressToNext = tier.max != null
    ? Math.min(100, Math.max(0, ((netWorth ?? 0) - tier.min) / (tier.max - tier.min) * 100))
    : 100
  const remainingToNext = tier.max != null ? Math.max(0, tier.max - (netWorth ?? 0)) : 0

  return (
    <div className="rounded-2xl bg-gray-900 text-white p-5 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-gray-400" />
        <span className="text-sm font-semibold tracking-wide text-gray-200">Rentenuhr</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          live
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 divide-x divide-gray-700">
        <div className="pr-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Verbindlichkeiten</p>
          <p className="mt-1 font-mono text-red-400 text-lg md:text-xl font-bold tabular-nums break-all" aria-hidden="true">
            {formatTicker(debtNow)} €
          </p>
        </div>
        <div className="pl-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Bereits getilgt</p>
          <p className="mt-1 font-mono text-emerald-400 text-lg md:text-xl font-bold tabular-nums break-all" aria-hidden="true">
            {formatTicker(paidNow)} €
          </p>
        </div>
      </div>

      <p className="sr-only">
        Verbindlichkeiten aktuell rund {euro(debtNow)}, bereits getilgt rund {euro(paidNow)}. Läuft in Echtzeit weiter.
      </p>

      <p className="mt-4 text-[11px] text-gray-500">
        Läuft auf Basis der aktuell laufenden Tages-Tilgungsrate ({euro(dailyPrincipalRate)}/Tag) symbolisch in Echtzeit weiter – ersetzt keine exakte Abrechnung.
      </p>

      {netWorth != null && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-[11px] text-gray-400 uppercase tracking-wide">
            <span>Vermögens-Stufe {index + 1} / {total}</span>
            <span>{euro(netWorth)}</span>
          </div>

          {/* Erreichte Stufen als durchgehend gefüllte Segmente, damit auf
              einen Blick sichtbar ist, wie viel schon geschafft ist - eine
              reine "Fortschritt in der aktuellen Stufe"-Anzeige sah bei
              höheren Stufen fälschlich nach "gerade erst angefangen" aus. */}
          <div className="mt-2 flex items-center gap-0.5">
            {NET_WORTH_TIERS.map((t, i) => (
              <div key={t.title} className={`flex-1 h-1.5 rounded-full ${i <= index ? 'bg-emerald-400' : 'bg-gray-700'}`} />
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2">
            <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">{tier.title}</p>
              <p className="text-xs text-gray-400">{tier.subtitle}</p>
            </div>
          </div>

          {nextTier && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Nächste Stufe: {nextTier.title}</span>
                <span>noch {euro(remainingToNext)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progressToNext}%` }} />
              </div>
            </div>
          )}

          <details className="mt-3 group">
            <summary className="text-[11px] text-gray-400 hover:text-gray-300 cursor-pointer list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
              Alle Stufen anzeigen
              <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
            </summary>
            <ul className="mt-2 space-y-1.5">
              {NET_WORTH_TIERS.map((t, i) => (
                <li key={t.title} className={`flex items-center gap-2 text-xs ${i === index ? 'text-white font-semibold' : i < index ? 'text-gray-400' : 'text-gray-600'}`}>
                  {i <= index
                    ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    : <Circle size={14} className="text-gray-700 shrink-0" />}
                  <span>{t.title}</span>
                  <span className="text-gray-600 ml-auto shrink-0">
                    {euro(t.min)}{t.max ? `–${euro(t.max)}` : '+'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
