'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { LogoutButton } from '@/components/logout-button'

const LINKS = [
  { href: '/warum', label: 'Warum' },
  { href: '/', label: 'Dashboard' },
  { href: '/properties', label: 'Immobilien' },
  { href: '/steuer', label: 'Steuerübersicht' },
  { href: '/finanzen', label: 'Finanzen' },
  { href: '/reminders', label: 'Erinnerungen' },
  { href: '/charity', label: 'Charity' },
]

export function Nav({ userEmail }: { userEmail: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-2 min-h-14 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo />
          </Link>
          {!userEmail && (
            <Link href="/warum" className="text-sm text-gray-500 hover:text-blue-700 transition-colors">Warum</Link>
          )}
        </div>

        {userEmail && (
          <>
            {/* Desktop-Navigation */}
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-600 min-w-0 flex-wrap justify-end">
              {LINKS.map(l => (
                <Link key={l.href} href={l.href} className="hover:text-blue-700 transition-colors whitespace-nowrap">{l.label}</Link>
              ))}
              <Link href="/receipts/new" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">+ Beleg</Link>
              <Link href="/properties/new" className="hover:text-blue-700 transition-colors">+ Immobilie</Link>
              <span className="text-gray-300">|</span>
              <span className="text-gray-400 hidden lg:inline">{userEmail}</span>
              <LogoutButton />
            </div>

            {/* Mobile: Menü-Button */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="md:hidden p-2 -mr-2 text-gray-600"
              aria-label="Menü öffnen"
            >
              <Menu size={22} />
            </button>
          </>
        )}
      </div>

      {/* Mobile-Seitenleiste */}
      {userEmail && open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <Link href="/" onClick={() => setOpen(false)}>
                <Logo />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="p-2 -mr-2 text-gray-500" aria-label="Menü schließen">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1 text-sm">
              {LINKS.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2.5 text-gray-700 border-b border-gray-50">
                  {l.label}
                </Link>
              ))}
              <Link
                href="/receipts/new"
                onClick={() => setOpen(false)}
                className="mt-3 bg-blue-600 text-white text-center py-2.5 rounded-lg font-medium"
              >
                + Beleg
              </Link>
              <Link href="/properties/new" onClick={() => setOpen(false)} className="mt-2 text-center py-2.5 text-blue-600">
                + Immobilie
              </Link>
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-gray-400 text-xs truncate">{userEmail}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
