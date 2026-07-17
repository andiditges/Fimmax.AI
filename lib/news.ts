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
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const xml = await res.text()

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 8).map(item => {
      const rawTitle = extractTag(item, 'title') ?? ''
      const [titlePart, sourcePart] = rawTitle.split(/ - (?!.*-)/)
      return {
        title: decodeEntities(titlePart ?? rawTitle),
        link: extractTag(item, 'link') ?? '#',
        source: sourcePart ? decodeEntities(sourcePart) : null,
        pub_date: extractTag(item, 'pubDate'),
      }
    })
  } catch {
    return []
  }
}
