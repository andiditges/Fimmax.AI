'use client'

import { useEffect, useState } from 'react'
import { NewsFeed } from '@/components/news-feed'
import { Card, CardTitle } from '@/components/ui/card'
import { NewsItem } from '@/lib/types'

// Lädt den News-Feed per eigenem Client-Request nach dem ersten Seitenaufbau,
// statt ihn (wie zuvor) serverseitig per Suspense in die Dashboard-Antwort
// mit hineinzustreamen. Grund: der Suspense-Ansatz hielt die HTTP-Verbindung
// bis zu 5s "leer" offen, während der Server auf den externen (oft langsamen)
// Google-News-Feed wartete - auf mobilen Netzen (Handy-Router/Mobilfunk-NAT,
// deutlich aggressiver als Desktop-Verbindungen) führte das zuverlässig zum
// Verbindungsabbruch mitten im Seiten-Stream ("This page couldn't load").
// Als eigener, vom Haupt-Request komplett entkoppelter Client-Fetch kann ein
// langsamer/fehlerhafter News-Feed die Dashboard-Seite selbst nicht mehr
// beeinträchtigen.
export function NewsFeedAsync() {
  const [news, setNews] = useState<NewsItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/news')
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (!cancelled) setNews(data) })
      .catch(() => { if (!cancelled) setNews([]) })
    return () => { cancelled = true }
  }, [])

  if (news === null) {
    return (
      <Card>
        <CardTitle>Markt & Immobilien-Nachrichten</CardTitle>
        <p className="text-sm text-gray-400 mt-2">Lädt...</p>
      </Card>
    )
  }

  return <NewsFeed items={news} />
}
