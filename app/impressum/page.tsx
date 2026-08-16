import Link from 'next/link'
import { Card, CardTitle } from '@/components/ui/card'

export default function Impressum() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-300 mb-1 block">← Zurück</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Impressum</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Angaben gemäß § 5 DDG (vormals § 5 TMG)</p>
      </div>

      <Card>
        <CardTitle>Diensteanbieter</CardTitle>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
          Andreas Michel Ditges<br />
          Erkelenzer Straße 40<br />
          41844 Wegberg<br />
          Deutschland
        </p>
      </Card>

      <Card>
        <CardTitle>Kontakt</CardTitle>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
          E-Mail: kontakt@fimmax.ai
        </p>
      </Card>

      <Card>
        <CardTitle>Streitschlichtung</CardTitle>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Card>

      <Card>
        <CardTitle>Haftung für Inhalte &amp; Links</CardTitle>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
          Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Für die Inhalte externer, verlinkter Seiten (z. B. Belegdokumente
          Dritter oder verlinkte Spendenseiten) übernehmen wir keine Gewähr; für den Inhalt der
          verlinkten Seiten ist ausschließlich deren Betreiber verantwortlich.
        </p>
      </Card>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Siehe auch: <Link href="/haftungsausschluss" className="text-blue-600 dark:text-blue-400 hover:underline">Haftungsausschluss</Link>
      </p>
    </div>
  )
}
