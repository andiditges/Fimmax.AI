import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Tip, TipSeverity } from '@/lib/types'

const SEVERITY_STYLES: Record<TipSeverity, { badge: string; label: string; card: string }> = {
  aktion: { badge: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300', label: 'Aktion', card: 'border-red-100 dark:border-red-900' },
  warnung: { badge: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300', label: 'Hinweis', card: 'border-amber-100 dark:border-amber-900' },
  info: { badge: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300', label: 'Info', card: 'border-blue-100 dark:border-blue-900' },
}

export function TipsList({ tips }: { tips: Tip[] }) {
  if (tips.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400 dark:text-gray-500">
        Aktuell keine Auffälligkeiten - läuft alles rund.
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {tips.map(tip => {
        const style = SEVERITY_STYLES[tip.severity]
        return (
          <Card key={tip.id} className={style.card}>
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${style.badge}`}>
                {style.label}
              </span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{tip.title}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{tip.body}</p>
            {tip.cta && (
              <Link href={tip.cta.href} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
                {tip.cta.label} →
              </Link>
            )}
          </Card>
        )
      })}
    </div>
  )
}
