import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'
import { FeedbackButton } from '@/components/feedback-button'
import { PageViewTracker } from '@/components/analytics/page-view-tracker'
import { Providers } from '@/components/providers'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fimmax.AI',
  description: 'KI-gestütztes Finanz-Cockpit für Vermieter',
  appleWebApp: {
    capable: true,
    title: 'Fimmax',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1d4ed8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

// Verhindert einen Hell/Dunkel-Flash beim Laden: liest die gespeicherte
// Theme-Wahl synchron vor dem ersten Paint aus localStorage und setzt
// data-theme auf <html>, bevor React überhaupt hydriert (siehe Next-Doku
// "preventing-flash-before-hydration"). Fällt beim allerersten Besuch auf
// die Systemeinstellung zurück.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("fimmax-theme");if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="de" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${geist.className} bg-gray-50 dark:bg-gray-950 min-h-screen flex flex-col transition-colors`} suppressHydrationWarning>
        <Providers>
          <Nav userEmail={user?.email ?? null} />
          {/* pb-24 statt py-8 unten: der global fixierte FeedbackButton
              (bottom-5 right-5) braucht Platz, sonst ueberlappt er den
              letzten sichtbaren Inhalt jeder Seite (z.B. Meilensteine-Liste
              in /finanzen). */}
          <main className="max-w-6xl mx-auto px-4 pt-8 pb-24 flex-1 w-full">
            {children}
          </main>
          <Footer />
          {user && <FeedbackButton />}
          {user && <PageViewTracker />}
        </Providers>
      </body>
    </html>
  )
}
