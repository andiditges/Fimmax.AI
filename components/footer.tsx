import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-100 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
        <p>© {new Date().getFullYear()} Fimmax.AI. Alle Rechte vorbehalten.</p>
        <div className="flex items-center gap-4">
          <Link href="/impressum" className="hover:text-gray-600 transition-colors">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-gray-600 transition-colors">Datenschutz</Link>
          <Link href="/haftungsausschluss" className="hover:text-gray-600 transition-colors">Haftungsausschluss</Link>
        </div>
      </div>
    </footer>
  )
}
