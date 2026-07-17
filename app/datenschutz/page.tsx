import Link from 'next/link'
import { Card, CardTitle } from '@/components/ui/card'

export default function Datenschutz() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← Zurück</Link>
        <h1 className="text-2xl font-bold text-gray-900">Datenschutzerklärung</h1>
        <p className="text-gray-500 text-sm mt-1">Informationen gemäß Art. 13, 14 DSGVO</p>
      </div>

      <Card>
        <CardTitle>Verantwortlicher</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Andreas Michel Ditges<br />
          Erkelenzer Straße 40<br />
          41844 Wegberg, Deutschland<br />
          E-Mail: kontakt@fimmax.ai
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Siehe auch <Link href="/impressum" className="text-blue-600 hover:underline">Impressum</Link>.
        </p>
      </Card>

      <Card>
        <CardTitle>Registrierung &amp; Nutzerkonto</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Bei der Registrierung verarbeiten wir deine E-Mail-Adresse und ein verschlüsseltes Passwort,
          um dir ein persönliches, ausschließlich für dich zugängliches Konto bereitzustellen (Art. 6
          Abs. 1 lit. b DSGVO – Vertragserfüllung). Der Zugriff auf deine Daten ist technisch über
          Zugriffsregeln auf Datenbankebene strikt auf dein eigenes Konto beschränkt.
        </p>
      </Card>

      <Card>
        <CardTitle>Immobilien-, Finanz- und Belegdaten</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Alle Daten, die du selbst einträgst oder hochlädst – etwa zu Immobilien, Kaufverträgen,
          Krediten, Belegen, Reminders oder WEG-Dokumenten – verarbeiten wir ausschließlich, um dir die
          Funktionen von Fimmax.AI bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO). Hochgeladene Dateien
          (z. B. Belege, Protokolle) werden verschlüsselt in einem privaten Speicherbereich abgelegt,
          auf den nur du Zugriff hast.
        </p>
      </Card>

      <Card className="bg-amber-50 border-amber-100">
        <CardTitle>Daten Dritter (z. B. Mieter, Miteigentümer)</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Wenn du im Rahmen der Nutzung Daten Dritter einträgst – etwa Namen und Mietdaten deiner
          Mieter oder Angaben aus WEG-Beschlüssen –, bist du hierfür selbst als datenschutzrechtlich
          Verantwortlicher gegenüber diesen Personen verantwortlich (z. B. Informationspflichten nach
          Art. 13/14 DSGVO). Fimmax.AI verarbeitet diese Daten in diesem Fall lediglich in deinem
          Auftrag als technischer Dienstleister.
        </p>
      </Card>

      <Card>
        <CardTitle>KI-gestützte Beleganalyse (Anthropic)</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Wenn du einen Beleg hochlädst und die automatische Kategorisierung nutzt, wird das Bild bzw.
          PDF zur Analyse an den KI-Anbieter Anthropic (Anthropic PBC, USA) übermittelt (Art. 6 Abs. 1
          lit. b, f DSGVO – Erfüllung der von dir gewünschten Funktion). Es erfolgt keine Speicherung
          des Belegs bei Anthropic über die Dauer der Anfrage hinaus im Rahmen deren Standard-API-Nutzung.
          Weitere Informationen:{' '}
          <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Datenschutzerklärung von Anthropic
          </a>.
        </p>
      </Card>

      <Card>
        <CardTitle>Adress-Autovervollständigung</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Beim Anlegen einer Immobilie werden deine Eingaben in das Adressfeld zur Vervollständigung an
          den kostenlosen Geocoding-Dienst Photon (basierend auf OpenStreetMap-Daten) übermittelt.
        </p>
      </Card>

      <Card>
        <CardTitle>Hosting &amp; Auftragsverarbeiter</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Wir setzen folgende Dienstleister als Auftragsverarbeiter (Art. 28 DSGVO) ein:
        </p>
        <ul className="text-sm text-gray-700 mt-2 space-y-2 list-disc list-inside">
          <li>
            <strong>Supabase</strong> (Supabase Inc.) – Datenbank, Authentifizierung und Dateispeicher,
            gehostet in der EU-Region Frankfurt.{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Datenschutzerklärung von Supabase
            </a>
          </li>
          <li>
            <strong>Vercel</strong> (Vercel Inc., USA) – Hosting und Ausspielung dieser Website.{' '}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Datenschutzerklärung von Vercel
            </a>
          </li>
        </ul>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Soweit Anbieter mit Sitz außerhalb der EU/EWR (USA) Daten verarbeiten, erfolgt dies auf Basis
          von EU-Standardvertragsklauseln bzw. vergleichbarer Garantien der jeweiligen Anbieter.
        </p>
      </Card>

      <Card>
        <CardTitle>Cookies</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Wir verwenden ausschließlich technisch notwendige Cookies, die für den Login und die sichere
          Sitzungsverwaltung erforderlich sind (Art. 6 Abs. 1 lit. b DSGVO, § 25 Abs. 2 Nr. 2 TTDSG).
          Diese Cookies erfordern keine Einwilligung. Wir setzen aktuell keine Analyse-, Marketing- oder
          Tracking-Cookies ein.
        </p>
      </Card>

      <Card>
        <CardTitle>Speicherdauer</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Wir speichern deine Daten, solange dein Konto besteht. Nach Löschung deines Kontos werden
          deine Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten (z. B. steuerliche
          Aufbewahrungsfristen für Belege) entgegenstehen. Auf Wunsch löschen wir dein Konto und die
          zugehörigen Daten – wende dich hierfür an die oben genannte E-Mail-Adresse.
        </p>
      </Card>

      <Card>
        <CardTitle>Deine Rechte</CardTitle>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
          (Art. 21) gegen die Verarbeitung deiner Daten. Zudem hast du das Recht, dich bei einer
          Datenschutz-Aufsichtsbehörde zu beschweren.
        </p>
      </Card>

      <p className="text-xs text-gray-400">
        Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} · Siehe
        auch <Link href="/haftungsausschluss" className="text-blue-600 hover:underline">Haftungsausschluss</Link>
      </p>
    </div>
  )
}
