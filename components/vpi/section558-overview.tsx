import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { GemeindeEintrag, Section558Status } from '@/lib/mietrecht'
import { Property, Tenant } from '@/lib/types'

interface Item {
  tenant: Tenant
  property: Property
  gemeinde: GemeindeEintrag | null
  status: Section558Status
}

export function Section558Overview({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400">
        Keine Mietverhältnisse mit fester Miete ohne Staffel-/Indexvereinbarung gefunden.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <Section558Row key={item.tenant.id} item={item} />
      ))}
    </div>
  )
}

function Section558Row({ item }: { item: Item }) {
  const { tenant, property, gemeinde, status } = item
  const now = new Date()
  const alreadyPossible = new Date(status.next_request_possible_date) <= now
  const kappungsgrenzeAusgeschoepft = status.kappungsgrenze_remaining_percent !== null && status.kappungsgrenze_remaining_percent <= 0.5

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/tenants/${tenant.id}`} className="font-semibold text-gray-900 hover:text-blue-700">{tenant.name}</Link>
          <p className="text-xs text-gray-400">{propertyLabel(property)}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${alreadyPossible ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
          {alreadyPossible
            ? `Erhöhung bereits möglich seit ${formatDate(status.next_request_possible_date)}`
            : `Erhöhung frühestens ab ${formatDate(status.next_request_possible_date)}`}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Aktuelle Miete</p>
          <p className="font-medium text-gray-900">{euro(status.current_rent)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Kappungsgrenze</p>
          <p className="font-medium text-gray-900">
            {status.kappungsgrenze_percent}% / 3 Jahre
            {gemeinde && <span className="block text-xs text-amber-700">{gemeinde.name}: angespannter Wohnungsmarkt</span>}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Bereits ausgeschöpft (3 Jahre)</p>
          <p className="font-medium text-gray-900">
            {status.percent_increase_36_months !== null ? `${status.percent_increase_36_months.toFixed(1)}%` : '–'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Verbleibender Spielraum</p>
          <p className={`font-medium ${kappungsgrenzeAusgeschoepft ? 'text-red-500' : 'text-green-700'}`}>
            {status.kappungsgrenze_remaining_percent !== null
              ? `+${status.kappungsgrenze_remaining_percent.toFixed(1)}% (${euro(status.kappungsgrenze_remaining_amount ?? 0)})`
              : '–'}
          </p>
        </div>
      </div>

      {gemeinde?.status !== 'kappungsgrenze' && gemeinde && (
        <p className="text-xs text-amber-700 mt-2">
          {gemeinde.name} gilt zusätzlich als Mietpreisbremse-Gebiet – relevant bei Neuvermietung (max. 10% über ortsüblicher Vergleichsmiete), nicht bei laufenden Mietverhältnissen.
        </p>
      )}

      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
        Letzte Mietänderung: {formatDate(status.last_change_date)}. Wartefrist von 15 Monaten seitdem {status.wartefrist_erfuellt ? 'erfüllt' : 'noch nicht erfüllt'} (§ 558 Abs. 1 BGB).
        Eine danach gestellte Erhöhung wirkt frühestens ab {formatDate(status.earliest_effective_date)} (§ 558b Abs. 1 BGB, vereinfachte Annahme). Ohne Gewähr, ersetzt keine Rechtsberatung.
      </p>
    </Card>
  )
}
