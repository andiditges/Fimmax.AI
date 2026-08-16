import { createClient } from '@/lib/supabase/client'

// Eigenes, cookiefreies Event-Logging statt Drittanbieter-Analytics: schreibt
// direkt in die `events`-Tabelle (RLS-geschützt, nur für den eigenen
// Account). Fire-and-forget, damit Tracking nie eine Nutzeraktion blockiert
// oder bei Fehlern die UI stört.
export function trackEvent(eventName: string, metadata?: Record<string, unknown>) {
  const supabase = createClient()
  const page_path = typeof window !== 'undefined' ? window.location.pathname : null
  supabase.from('events').insert({ event_name: eventName, page_path, metadata: metadata ?? null })
    .then(({ error }) => { if (error) console.error('trackEvent fehlgeschlagen:', error.message) })
}
