import Link from 'next/link'
import { Card, CardTitle } from '@/components/ui/card'

export default function Haftungsausschluss() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← Zurück</Link>
        <h1 className="text-2xl font-bold text-gray-900">Haftungsausschluss</h1>
        <p className="text-gray-500 text-sm mt-1">Bitte aufmerksam lesen, bevor du Fimmax.AI nutzt</p>
      </div>

      <Card>
        <CardTitle>Keine Steuerberatung</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI ist kein Steuerberater und erbringt keine Steuerberatung im Sinne des
          Steuerberatungsgesetzes (StBerG). Darstellungen zu AfA, der 15%-Grenze nach § 6 Abs. 1 Nr. 1a
          EStG, Werbungskosten, Anlage-V-Aufbereitung oder sonstigen steuerlichen Sachverhalten sind
          ausschließlich technische Hilfestellungen zur Organisation und Aufbereitung deiner eigenen
          Daten. Sie ersetzen keine Beratung durch einen Steuerberater oder eine andere zur
          geschäftsmäßigen Hilfeleistung in Steuersachen befugte Person und dürfen nicht als solche
          verstanden werden. Für die steuerliche Würdigung deines Einzelfalls und die Abgabe deiner
          Steuererklärung wende dich bitte an eine entsprechend qualifizierte Fachperson.
        </p>
      </Card>

      <Card>
        <CardTitle>Keine Finanz- oder Anlageberatung</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Ebenso wenig erbringt Fimmax.AI Finanz-, Anlage- oder Rechtsberatung. Darstellungen zu
          Tilgung, Restschuld, Cashflow, Eigenkapital oder Portfoliokennzahlen sind rein informativer,
          rechnerischer Natur auf Basis der von dir eingegebenen Daten. Sie stellen keine Empfehlung
          zum Kauf, Verkauf oder Halten von Immobilien, Finanzierungen oder sonstigen Vermögenswerten
          dar. Finanzierungs- und Investitionsentscheidungen triffst du eigenverantwortlich.
        </p>
      </Card>

      <Card>
        <CardTitle>Zweck des Produkts</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI ist darauf ausgelegt, die Aufbereitung, Darstellung und Verarbeitung der von dir
          eingespeisten Daten (u. a. Belege, Kaufverträge, Kredit- und Mietdaten) möglichst effizient
          zu gestalten, unter anderem mithilfe KI-gestützter Funktionen (z. B. automatische
          Belegkategorisierung). Trotz sorgfältiger Entwicklung können bei der automatisierten
          Verarbeitung, Berechnung oder KI-gestützten Auswertung Fehler auftreten.
        </p>
      </Card>

      <Card className="bg-amber-50 border-amber-100">
        <CardTitle>Haftungsausschluss</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Für die Richtigkeit, Vollständigkeit und Aktualität der von dir eingegebenen oder von
          Fimmax.AI berechneten, dargestellten bzw. KI-generierten Daten, Zahlen und Inhalte wird
          keine Gewähr übernommen. Eine Haftung für Schäden, die aus der Nutzung oder Nichtnutzung der
          bereitgestellten Informationen entstehen – einschließlich fehlerhafter Berechnungen,
          fehlerhafter KI-Analysen von Belegen oder unvollständiger Datenübernahme – ist, soweit
          gesetzlich zulässig, ausgeschlossen. Dies gilt nicht für Schäden aus der Verletzung des
          Lebens, des Körpers oder der Gesundheit sowie für Schäden, die auf Vorsatz oder grober
          Fahrlässigkeit beruhen.
        </p>
        <p className="text-sm text-gray-700 mt-3 leading-relaxed">
          Bitte prüfe alle von Fimmax.AI erzeugten Auswertungen (insbesondere den Steuer-Export) vor
          Weitergabe an Finanzamt, Bank oder Dritte eigenständig auf Richtigkeit oder lasse sie von
          einer fachkundigen Person gegenprüfen.
        </p>
      </Card>

      <p className="text-xs text-gray-400">
        Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
