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
      <Card className="text-center py-8 text-gray-400 dark:text-gray-500">
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

  const maxRentAtCap = status.kappungsgrenze_remaining_percent !== null
    ? status.current_rent * (1 + status.kappungsgrenze_remaining_percent / 100)
    : null
  const maxRentPerSqm = maxRentAtCap != null && property.living_area_sqm ? maxRentAtCap / property.living_area_sqm : null
  const exceedsComparableRent = maxRentPerSqm != null && property.comparable_rent_max != null && maxRentPerSqm > property.comparable_rent_max

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/tenants/${tenant.id}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400">{tenant.name}</Link>
          <p className="text-xs text-gray-400 dark:text-gray-500">{propertyLabel(property)}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${alreadyPossible ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'}`}>
          {alreadyPossible
            ? `Erhöhung bereits möglich seit ${formatDate(status.next_request_possible_date)}`
            : `Erhöhung frühestens ab ${formatDate(status.next_request_possible_date)}`}
        </span>
      </div>

      {status.reference_is_future && (
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg px-2.5 py-2">
          Bereits vereinbart: {euro(status.reference_rent)} ab {formatDate(status.reference_date)}. Der Countdown unten rechnet ab diesem Stand weiter, auch wenn er noch nicht wirksam ist.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Aktuelle Miete</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{euro(status.current_rent)}</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Kappungsgrenze</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {status.kappungsgrenze_percent}% / 3 Jahre
            {gemeinde && <span className="block text-xs text-amber-700 dark:text-amber-400">{gemeinde.name}: angespannter Wohnungsmarkt</span>}
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Bereits ausgeschöpft (3 Jahre)</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {status.percent_increase_36_months !== null ? `${status.percent_increase_36_months.toFixed(1)}%` : '–'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Verbleibender Spielraum</p>
          <p className={`font-medium ${kappungsgrenzeAusgeschoepft ? 'text-red-500 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {status.kappungsgrenze_remaining_percent !== null
              ? `+${status.kappungsgrenze_remaining_percent.toFixed(1)}% (${euro(status.kappungsgrenze_remaining_amount ?? 0)})`
              : '–'}
          </p>
        </div>
      </div>

      {gemeinde?.status !== 'kappungsgrenze' && gemeinde && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
          {gemeinde.name} gilt zusätzlich als Mietpreisbremse-Gebiet – relevant bei Neuvermietung (max. 10% über ortsüblicher Vergleichsmiete), nicht bei laufenden Mietverhältnissen.
        </p>
      )}

      {exceedsComparableRent ? (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2">
          Achtung: Die Kappungsgrenze allein erlaubt hier mehr, als laut deiner hinterlegten Vergleichsmiete-Obergrenze ({euro(property.comparable_rent_max ?? 0)}/m²) zulässig wäre.
          Die Kappungsgrenze ist nur eine zusätzliche Obergrenze – die ortsübliche Vergleichsmiete darfst du bei § 558-Erhöhungen nie übersteigen.
        </p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
          Wichtig: Die Kappungsgrenze ist nur eine zusätzliche Obergrenze. Unabhängig davon darf eine § 558-Erhöhung die ortsübliche Vergleichsmiete nie übersteigen –
          {property.comparable_rent_max != null
            ? ' das prüft diese Übersicht anhand deiner hinterlegten Vergleichsmiete mit.'
            : ' das musst du selbst gegen den Mietspiegel/Vergleichsobjekte prüfen (unter "Bearbeiten" beim Objekt hinterlegbar), sonst droht bei zu hoher Miete eine Mietpreisüberhöhung (§ 5 WiStrG).'}
        </p>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        Letzte Mietänderung: {formatDate(status.reference_date)}. Wartefrist von 15 Monaten seitdem {status.wartefrist_erfuellt ? 'erfüllt' : 'noch nicht erfüllt'} (§ 558 Abs. 1 BGB).
        Eine danach gestellte Erhöhung wirkt frühestens ab {formatDate(status.earliest_effective_date)} (§ 558b Abs. 1 BGB, vereinfachte Annahme). Ohne Gewähr, ersetzt keine Rechtsberatung.
      </p>
    </Card>
  )
}
