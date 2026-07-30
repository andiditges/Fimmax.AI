'use client'

import { intervalToDuration } from 'date-fns'
import { formatDate } from '@/lib/format'
import { useNow } from '@/lib/use-now'

const UNITS: { key: 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds'; label: string }[] = [
  { key: 'years', label: 'Jahre' },
  { key: 'months', label: 'Monate' },
  { key: 'days', label: 'Tage' },
  { key: 'hours', label: 'Std' },
  { key: 'minutes', label: 'Min' },
  { key: 'seconds', label: 'Sek' },
]

/**
 * Countdown bis zum voraussichtlichen Datum, an dem das gesamte
 * Kredit-Portfolio frei von Verbindlichkeiten ist (letztes payoffDate aller
 * Kredite, bei gleichbleibenden Konditionen fortgeschrieben - siehe
 * payoffOverview in app/finanzen/page.tsx).
 */
export function FreedomCountdown({ targetDate }: { targetDate: string | null }) {
  const now = useNow(1000)

  if (!targetDate) return null
  const target = new Date(targetDate)

  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-emerald-700 text-white p-6 shadow-sm">
      {!now || target <= now ? (
        now && target <= now ? (
          <div className="text-center py-2">
            <p className="text-lg font-bold">Frei von Verbindlichkeiten!</p>
            <p className="text-sm text-blue-100 mt-1">Dein Portfolio ist seit {formatDate(targetDate)} frei von Verbindlichkeiten – finanzielle Unabhängigkeit erreicht.</p>
          </div>
        ) : (
          <div className="h-24" />
        )
      ) : (
        <>
          <p className="text-xs uppercase tracking-wide text-blue-100 text-center">Noch</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {(() => {
              const duration = intervalToDuration({ start: now, end: target })
              return UNITS.map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center bg-white/10 rounded-xl px-3 py-2 min-w-[3.5rem]">
                  <span className="font-mono text-xl md:text-2xl font-bold tabular-nums">{duration[key] ?? 0}</span>
                  <span className="text-[10px] text-blue-100 uppercase tracking-wide">{label}</span>
                </div>
              ))
            })()}
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-white">
            bis zur Rente und finanziellen Unabhängigkeit
          </p>
          <p className="mt-1 text-center text-xs text-blue-100">
            Portfolio voraussichtlich frei von Verbindlichkeiten am {formatDate(targetDate)} – bei gleichbleibenden Konditionen (keine weiteren Sondertilgungen, Zinsänderungen o.ä.)
          </p>
        </>
      )}
    </div>
  )
}
