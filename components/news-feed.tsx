import { Card, CardTitle } from '@/components/ui/card'
import { NewsItem } from '@/lib/types'

function timeAgo(pubDate: string | null): string {
  if (!pubDate) return ''
  const diffMs = Date.now() - new Date(pubDate).getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'vor < 1 Std.'
  if (hours < 24) return `vor ${hours} Std.`
  return `vor ${Math.floor(hours / 24)} Tg.`
}

export function NewsFeed({ items }: { items: NewsItem[] }) {
  return (
    <Card>
      <CardTitle>Markt & Immobilien-Nachrichten</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 mt-2">Aktuell keine Nachrichten verfügbar.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {items.map((item, i) => (
            <li key={i} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-800 hover:text-blue-700 leading-snug block"
              >
                {item.title}
              </a>
              <p className="text-xs text-gray-400 mt-1">
                {item.source}{item.source && item.pub_date ? ' · ' : ''}{timeAgo(item.pub_date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
