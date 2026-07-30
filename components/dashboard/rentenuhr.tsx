'use client'

import { Clock } from 'lucide-react'
import { euro } from '@/lib/format'
import { useNow } from '@/lib/use-now'

// 6 Nachkommastellen statt 2, damit bei den üblichen Tages-Tilgungsraten
// (wenige € bis niedriger zweistelliger Betrag) jede Sekunde sichtbar etwas
// weiterläuft, statt dass sich die Cent-Stelle erst nach vielen Sekunden
// einmal ändert - der Sinn der Uhr ist gerade die spürbare Bewegung.
function formatTicker(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
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
}: {
  initialDebt: number
  initialPaid: number
  dailyPrincipalRate: number
  asOf: string
}) {
  const now = useNow(200)
  const elapsedMs = now ? now.getTime() - new Date(asOf).getTime() : 0

  const ratePerMs = dailyPrincipalRate / (24 * 60 * 60 * 1000)
  const totalPrincipal = initialDebt + initialPaid
  const debtNow = Math.max(0, initialDebt - ratePerMs * elapsedMs)
  const paidNow = Math.min(totalPrincipal, initialPaid + ratePerMs * elapsedMs)

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
    </div>
  )
}
