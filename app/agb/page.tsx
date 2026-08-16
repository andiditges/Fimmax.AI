import Link from 'next/link'
import { Card, CardTitle } from '@/components/ui/card'

export default function Agb() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← Zurück</Link>
        <h1 className="text-2xl font-bold text-gray-900">Allgemeine Geschäftsbedingungen (AGB)</h1>
        <p className="text-gray-500 text-sm mt-1">Für die Nutzung von Fimmax.AI</p>
      </div>

      <Card>
        <CardTitle>1. Geltungsbereich &amp; Vertragspartner</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Diese AGB gelten für alle Verträge über die Nutzung der Software Fimmax.AI zwischen Andreas
          Michel Ditges (siehe <Link href="/impressum" className="text-blue-600 hover:underline">Impressum</Link>,
          nachfolgend „Fimmax.AI") und registrierten Nutzer:innen (nachfolgend „Nutzer:in"). Abweichende
          Bedingungen der Nutzer:in gelten nur, wenn Fimmax.AI ihnen ausdrücklich schriftlich zustimmt.
        </p>
      </Card>

      <Card>
        <CardTitle>2. Leistungsbeschreibung</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI ist eine Software zur Organisation und Aufbereitung von Immobilien-, Finanz-,
          Mieter- und Belegdaten für Vermieter:innen (u. a. Belegverwaltung, Steuer-Export,
          Nebenkostenabrechnung, Objekt-Exposé, Finanzierungs-Übersicht, teils KI-gestützt). Fimmax.AI
          ist keine Steuerberatung, Rechtsberatung oder Anlageberatung – Näheres dazu regelt der{' '}
          <Link href="/haftungsausschluss" className="text-blue-600 hover:underline">Haftungsausschluss</Link>,
          der Bestandteil dieser AGB ist. Der jeweils aktuelle Funktionsumfang ergibt sich aus der App
          selbst; ein Anspruch auf bestimmte Funktionen besteht nicht.
        </p>
      </Card>

      <Card>
        <CardTitle>3. Registrierung &amp; Nutzerkonto</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Die Nutzung setzt eine Registrierung mit wahrheitsgemäßen Angaben voraus. Nutzer:innen sind
          für die Geheimhaltung ihrer Zugangsdaten selbst verantwortlich und haften für Aktivitäten
          unter ihrem Konto, die durch eine von ihnen zu vertretende Weitergabe der Zugangsdaten
          entstehen. Der Verdacht auf Missbrauch ist Fimmax.AI unverzüglich mitzuteilen.
        </p>
      </Card>

      <Card>
        <CardTitle>4. Pflichten der Nutzer:in</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Nutzer:innen dürfen Fimmax.AI nur für eigene, rechtmäßige Zwecke nutzen und keine
          rechtswidrigen, Rechte Dritter verletzenden oder schädlichen Inhalte (u. a. Bilder, Belege,
          Dokumente) hochladen. Werden im Rahmen der Nutzung Daten Dritter erfasst (z. B. Mieter:innen,
          Miteigentümer:innen), ist die Nutzer:in hierfür selbst als datenschutzrechtlich Verantwortliche
          zuständig – Näheres in der <Link href="/datenschutz" className="text-blue-600 hover:underline">Datenschutzerklärung</Link>.
        </p>
      </Card>

      <Card className="bg-amber-50 border-amber-100">
        <CardTitle>5. Website-generierte Daten, hochgeladene Bilder &amp; KI-verarbeitete Inhalte</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Für sämtliche durch Fimmax.AI berechneten, dargestellten oder erzeugten Daten und Dokumente
          (u. a. Steuer-Exporte, Nebenkostenabrechnungen, Objekt-Exposés, Finanzkennzahlen), für von
          Nutzer:innen hochgeladene Bilder und Dokumente sowie für durch KI analysierte oder erzeugte
          Inhalte (z. B. automatische Beleg-Kategorisierung, Standortrisiko-Einschätzung) übernimmt
          Fimmax.AI keine Gewähr und keine Haftung für Richtigkeit, Vollständigkeit oder Eignung zu
          einem bestimmten Zweck. Es obliegt stets der Nutzer:in, alle Informationen vor jeder
          Verwendung – insbesondere gegenüber Banken, dem Finanzamt, Käufer:innen, Mieter:innen oder
          sonstigen Dritten – eigenständig auf ihre Richtigkeit zu prüfen und gegenzurechnen bzw. durch
          fachkundige Personen prüfen zu lassen. Diese Klausel ergänzt den{' '}
          <Link href="/haftungsausschluss" className="text-blue-600 hover:underline">Haftungsausschluss</Link>.
        </p>
      </Card>

      <Card>
        <CardTitle>6. Haftung</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung
          des Lebens, des Körpers oder der Gesundheit sowie nach dem Produkthaftungsgesetz. Bei einfacher
          Fahrlässigkeit haftet Fimmax.AI nur bei Verletzung einer wesentlichen Vertragspflicht
          (Kardinalpflicht), deren Erfüllung die ordnungsgemäße Nutzung überhaupt erst ermöglicht und auf
          deren Einhaltung Nutzer:innen regelmäßig vertrauen dürfen – begrenzt auf den vorhersehbaren,
          vertragstypischen Schaden. Im Übrigen ist die Haftung ausgeschlossen. Diese Beschränkung gilt
          entsprechend für die Haftung wegen Datenverlust, soweit dieser sich auch bei ordnungsgemäßer
          eigener Datensicherung durch die Nutzer:in nicht hätte vermeiden lassen.
        </p>
      </Card>

      <Card>
        <CardTitle>7. Verfügbarkeit</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI ist bemüht, einen unterbrechungsfreien Zugriff zu ermöglichen, garantiert jedoch
          keine bestimmte Verfügbarkeit. Wartungsarbeiten, technische Störungen sowie Ausfälle bei
          eingesetzten Auftragsverarbeitern (siehe <Link href="/datenschutz" className="text-blue-600 hover:underline">Datenschutzerklärung</Link>)
          können zu vorübergehenden Einschränkungen führen.
        </p>
      </Card>

      <Card>
        <CardTitle>8. Laufzeit &amp; Kündigung</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI wird aktuell unentgeltlich angeboten. Nutzer:innen können ihr Konto jederzeit ohne
          Frist selbst löschen oder die Löschung per E-Mail an kontakt@fimmax.ai verlangen; mit
          vollständiger Löschung endet der Nutzungsvertrag. Fimmax.AI kann das Konto einer Nutzer:in bei
          erheblichem Verstoß gegen diese AGB nach vorheriger Ankündigung sperren oder kündigen. Sollten
          künftig kostenpflichtige Zusatzangebote eingeführt werden, gelten dafür gesondert
          mitgeteilte Preis- und Laufzeitbedingungen.
        </p>
      </Card>

      <Card>
        <CardTitle>9. Änderungen dieser AGB</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Fimmax.AI kann diese AGB mit Wirkung für die Zukunft ändern, etwa bei neuen Funktionen oder
          rechtlichen Anforderungen. Wesentliche Änderungen werden mit einer angemessenen Frist von
          mindestens sechs Wochen vor Inkrafttreten per E-Mail oder in der App angekündigt. Widerspricht
          die Nutzer:in nicht bis zum Inkrafttreten und nutzt Fimmax.AI weiter, gilt die Änderung als
          angenommen; auf dieses Widerspruchsrecht wird in der Ankündigung gesondert hingewiesen.
        </p>
      </Card>

      <Card>
        <CardTitle>10. Schlussbestimmungen</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Ist eine Bestimmung dieser AGB
          unwirksam, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </Card>

      <p className="text-xs text-gray-400">
        Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} · Siehe auch{' '}
        <Link href="/haftungsausschluss" className="text-blue-600 hover:underline">Haftungsausschluss</Link>{' '}
        und <Link href="/datenschutz" className="text-blue-600 hover:underline">Datenschutzerklärung</Link>
      </p>
    </div>
  )
}
