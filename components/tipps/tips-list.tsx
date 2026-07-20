import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Tip, TipSeverity } from '@/lib/types'

const SEVERITY_STYLES: Record<TipSeverity, { badge: string; label: string; card: string }> = {
  aktion: { badge: 'bg-red-100 text-red-700', label: 'Aktion', card: 'border-red-100' },
  warnung: { badge: 'bg-amber-100 text-amber-800', label: 'Hinweis', card: 'border-amber-100' },
  info: { badge: 'bg-blue-100 text-blue-700', label: 'Info', card: 'border-blue-100' },
}

export function TipsList({ tips }: { tips: Tip[] }) {
  if (tips.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400">
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
            <p className="font-medium text-gray-900 text-sm">{tip.title}</p>
            <p className="text-sm text-gray-600 mt-1">{tip.body}</p>
            {tip.cta && (
              <Link href={tip.cta.href} className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                {tip.cta.label} →
              </Link>
            )}
          </Card>
        )
      })}
    </div>
  )
}
