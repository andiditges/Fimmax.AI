import { NewsItem } from './types'

const FEED_URL = 'https://news.google.com/rss/search?q=Immobilienmarkt+Deutschland+Zinsen+Vermieter&hl=de&gl=DE&ceid=DE:de'

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))
  return match ? match[1].trim() : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export async function getLandlordNews(): Promise<NewsItem[]> {
  try {
    // Explizites Timeout, da ein hängender externer Feed sonst das gesamte
    // Dashboard-Rendering blockieren wuerde (Server-Component-Fetch ohne
    // eigenes Timeout haengt, bis Vercel die Funktion hart abbricht - die
    // Seite laedt dann ueberhaupt nicht, statt nur ohne News anzuzeigen).
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const xml = await res.text()

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return items
      .map(item => {
        const rawTitle = extractTag(item, 'title') ?? ''
        const [titlePart, sourcePart] = rawTitle.split(/ - (?!.*-)/)
        return {
          title: decodeEntities(titlePart ?? rawTitle),
          link: extractTag(item, 'link') ?? '#',
          source: sourcePart ? decodeEntities(sourcePart) : null,
          pub_date: extractTag(item, 'pubDate'),
        }
      })
      // Ältere Meldungen sind für einen tagesaktuellen Newsfeed nicht mehr
      // relevant - Einträge ohne verwertbares Datum werden sicherheitshalber
      // behalten statt verworfen.
      .filter(item => {
        if (!item.pub_date) return true
        const parsed = Date.parse(item.pub_date)
        return isNaN(parsed) || parsed >= thirtyDaysAgo
      })
      .slice(0, 8)
  } catch {
    return []
  }
}
