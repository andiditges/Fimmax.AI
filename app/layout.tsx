import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
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
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-2 min-h-14 flex items-center justify-between">
            <Link href="/" className="leading-tight">
              <span className="font-bold text-blue-700 text-lg tracking-tight block">Fimmax.AI</span>
              <span className="text-[11px] text-gray-400 block -mt-0.5">KI-gestützt. Maximal effizient.</span>
            </Link>
            {user && (
              <div className="flex items-center gap-5 text-sm text-gray-600">
                <Link href="/" className="hover:text-blue-700 transition-colors">Dashboard</Link>
                <Link href="/properties" className="hover:text-blue-700 transition-colors">Immobilien</Link>
                <Link href="/steuer" className="hover:text-blue-700 transition-colors">Steuerübersicht</Link>
                <Link href="/finanzen" className="hover:text-blue-700 transition-colors">Finanzen</Link>
                <Link href="/reminders" className="hover:text-blue-700 transition-colors">Reminders</Link>
                <Link href="/charity" className="hover:text-blue-700 transition-colors">Charity</Link>
                <Link href="/receipts/new" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">+ Beleg</Link>
                <Link href="/properties/new" className="hover:text-blue-700 transition-colors">+ Immobilie</Link>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400 hidden sm:inline">{user.email}</span>
                <LogoutButton />
              </div>
            )}
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
