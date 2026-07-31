import { NewsFeed } from '@/components/news-feed'
import { getLandlordNews } from '@/lib/news'

// Eigene, unabhaengige async Server-Component statt den News-Fetch mit im
// Haupt-Promise.all der Dashboard-Seite zu awaiten - so kann ein langsamer/
// fehlerhafter externer Feed (siehe lib/news.ts) nie mehr das Rendering der
// restlichen, wichtigeren Dashboard-Inhalte blockieren. Der umschliessende
// <Suspense>-Block in app/page.tsx laesst diesen Teil einfach nachladen.
export async function NewsFeedAsync() {
  const news = await getLandlordNews()
  return <NewsFeed items={news} />
}
