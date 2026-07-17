import Link from 'next/link'
import Image from 'next/image'

export default function Warum() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden shadow-sm mb-10">
        <Image
          src="/andi-mit-kindern.jpg"
          alt="Andi mit seinen beiden Kindern bei Sonnenuntergang"
          fill
          sizes="(min-width: 768px) 672px, 100vw"
          className="object-cover"
          priority
        />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Warum es Fimmax.AI gibt</h1>

      <p className="brick-text text-xl font-semibold mb-6">
        Ich glaube, dass die Zeit eines Investors in Entscheidungen gehört – nicht in Ordner.
      </p>

      <div className="space-y-5 text-gray-700 leading-relaxed">
        <p>
          Ich bin Andreas Ditges, privater Immobilieninvestor. Ich habe meine Wohnungen selbst gekauft,
          selbst finanziert, selbst vermietet. Und ich habe dabei etwas gelernt, das mir vorher niemand
          gesagt hat: Der schwierige Teil ist nicht der Ankauf. Der schwierige Teil kommt danach.
        </p>
        <p>
          Kaufvertrag hier. Darlehensvertrag dort. Die Handwerkerrechnung im Mailpostfach, die
          Nebenkostenabrechnung im Papierordner, die Mietverträge auf dem Laptop, die Zahlen in einer
          Excel, die niemand außer mir versteht. Jedes Jahr aufs Neue Tage – Tage – für Steuer, Belege,
          Abgleich, Suchen. Zeit, die ich nicht mit meiner Frau verbringe. Zeit, die ich nicht mit meinen
          zwei kleinen Kindern verbringe – die in genau den Jahren sind, die man kein zweites Mal
          bekommt. Zeit, die nicht in die nächste Immobilie fließt.
        </p>
        <p>
          Ich wollte Ordnung. Ordnung, die mich keine Stunden kostet. Alle Dokumente an einem Platz.
          Alle Zahlen an einem Platz. Eine Wahrheit statt zwölf Ablagen.
        </p>
        <p>
          Also habe ich gesucht. Und nichts gefunden. Kein Tool, das die Belange eines Vermieters
          wirklich zusammenführt – Dokumente, Rechnungen, Kaufverträge, Finanzierung, Steuer. Und schon
          gar keines, das die Arbeit mit KI tatsächlich abnimmt, statt sie nur digital umzuschichten.
        </p>
        <p className="font-semibold text-gray-900">Wenn es das nicht gibt, dann baue ich es.</p>

        <h2 className="brick-text text-xl font-bold pt-4">Wie</h2>
        <p>
          Fimmax.AI ist von einem Investor für Investoren gebaut. Nicht von einer Agentur, die einmal
          mit einem Vermieter gesprochen hat. Jede Funktion existiert, weil ich sie selbst gebraucht habe
          – an einem Sonntagabend, mit einem Stapel Belege und einem Steuertermin vor der Nase.
        </p>
        <p>
          Das macht dieses Portal radikal pragmatisch. Kein Feature, das gut aussieht. Nur Features, die
          Arbeit ersparen.
        </p>

        <h2 className="brick-text text-xl font-bold pt-4">Was</h2>
        <p>
          Die eierlegende Wollmilchsau für Immobilieninvestoren: Rechnungen, Kaufverträge, Mietverträge,
          Finanzen und Steuer – KI-gestützt an einem Ort. Tage administrativer Arbeit werden zu Minuten.
        </p>

        <h2 className="brick-text text-xl font-bold pt-4">Und ehrlich gesagt</h2>
        <p>
          Ursprünglich habe ich das nur für mich gebaut. Dann habe ich es Investoren gezeigt, die ich
          kenne. Das Feedback war so überwältigend, dass ich es nicht für mich behalten konnte.
        </p>
        <p>
          Denn am Ende geht es nicht um Software. Es geht um das Wertvollste, das du hast – und das
          Einzige, das du dir nicht zurückkaufen kannst.
        </p>
        <p>
          Die Tage, die ich früher mit Belegen, Suchen und Abgleichen verbracht habe, verbringe ich heute
          mit meinen beiden Kindern. Das ist kein netter Nebeneffekt. Das ist der ganze Grund.
        </p>
      </div>

      <p className="brick-text text-2xl font-bold mt-10 mb-10">
        Fimmax.AI gibt dir deine Zeit zurück. Verbring sie mit dem, was wirklich zählt.
      </p>

      <Link
        href="/login"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
      >
        Jetzt loslegen
      </Link>
    </div>
  )
}
