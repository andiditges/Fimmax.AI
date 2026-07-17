import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'

export default async function Charity() {
  await requireUser()

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <p className="text-sm font-medium text-pink-600 mb-1">Fimmax.AI unterstützt</p>
        <h1 className="text-2xl font-bold text-gray-900">Suumpfperlen e.V.</h1>
        <p className="text-gray-500 text-sm mt-1">Unser erstes Charity-Projekt – Hoffnung und Begleitung für krebserkrankte Menschen</p>
      </div>

      <Card className="bg-pink-50 border-pink-100">
        <p className="text-gray-800 leading-relaxed">
          Suumpfperlen e.V. ist ein gemeinnütziger Verein, der aus einer persönlichen Krebs-Erfahrung
          entstanden ist. Der Verein klärt über Brustkrebs auf, bricht Tabus rund um die Krankheit und
          setzt sich für Vorsorge und Selbstuntersuchung ein – und steht Betroffenen und ihren Familien
          in einer der schwersten Zeiten ihres Lebens zur Seite.
        </p>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Was der Verein macht</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardTitle>Jebo</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Handgemachte Kuscheltier-Begleiter, farblich passend zur jeweiligen Krebsdiagnose – ein
              greifbarer Trostspender für Erkrankte.
            </p>
          </Card>
          <Card>
            <CardTitle>Pibo</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Plüsch-Pinguine speziell für Kinder, deren Eltern an Krebs erkrankt sind – damit auch die
              Kleinsten einen Begleiter haben.
            </p>
          </Card>
          <Card>
            <CardTitle>Näh- &amp; Stopfevents</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Regelmäßige Community-Treffen, bei denen die Begleiter genäht und Betroffene zusammengebracht
              werden.
            </p>
          </Card>
          <Card>
            <CardTitle>Aufklärung &amp; Podcast</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Infostände an medizinischen Einrichtungen, DIY-Workshops und der Podcast &bdquo;Suumpfgeflüster&ldquo; –
              damit Vorsorge kein Tabuthema bleibt.
            </p>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Jede Spende hilft</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Deine Unterstützung fließt direkt in Begleiter-Nähsets, Nähevents und Aufklärungsarbeit.
            </p>
          </div>
          <a
            href="https://www.suumpfperlen.com/spenden/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-pink-700 transition-colors whitespace-nowrap"
          >
            Jetzt spenden
          </a>
        </div>
      </Card>

      <p className="text-xs text-gray-400">
        Mehr über Suumpfperlen e.V. erfährst du auf{' '}
        <a
          href="https://www.suumpfperlen.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-600 hover:underline"
        >
          suumpfperlen.com
        </a>. Fimmax.AI ist nicht mit dem Verein verbunden, sondern verlinkt hier freiwillig auf die
        offizielle Spendenseite.
      </p>
    </div>
  )
}
