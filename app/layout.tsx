import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fimmax.AI',
  description: 'KI-gestütztes Finanz-Cockpit für Vermieter',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="de">
      <body className={`${geist.className} bg-gray-50 min-h-screen flex flex-col`}>
        <Nav userEmail={user?.email ?? null} />
        <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
