import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { euro, propertyLabel } from '@/lib/format'
import { Property, Tenant } from '@/lib/types'

interface Item {
  tenant: Tenant
  property: Property
  currentRent: number
}

type Status = 'over' | 'under' | 'within' | 'unknown'

interface Row extends Item {
  rentPerSqm: number | null
  status: Status
  gapPercent: number | null
}

function buildRow(item: Item): Row {
  const { property, currentRent } = item
  const rentPerSqm = property.living_area_sqm ? currentRent / property.living_area_sqm : null
  const hasRange = property.comparable_rent_min != null && property.comparable_rent_max != null

  if (rentPerSqm == null || !hasRange) {
    return { ...item, rentPerSqm, status: 'unknown', gapPercent: null }
  }
  if (rentPerSqm < property.comparable_rent_min!) {
    return { ...item, rentPerSqm, status: 'under', gapPercent: ((property.comparable_rent_min! - rentPerSqm) / rentPerSqm) * 100 }
  }
  if (rentPerSqm > property.comparable_rent_max!) {
    return { ...item, rentPerSqm, status: 'over', gapPercent: ((rentPerSqm - property.comparable_rent_max!) / rentPerSqm) * 100 }
  }
  return { ...item, rentPerSqm, status: 'within', gapPercent: null }
}

const statusOrder: Record<Status, number> = { over: 0, under: 1, within: 2, unknown: 3 }

const statusBadge: Record<Status, { label: string; className: string }> = {
  over: { label: 'über Vergleichsmiete', className: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300' },
  under: { label: 'Erhöhungspotential', className: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300' },
  within: { label: 'im Rahmen', className: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' },
  unknown: { label: 'keine Vergleichsmiete hinterlegt', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
}

export function ComparableRentTable({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400 dark:text-gray-500">
        Keine aktiven Mietverhältnisse gefunden.
      </Card>
    )
  }

  const rows = items
    .map(buildRow)
    .sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status]
      if (orderDiff !== 0) return orderDiff
      return (b.gapPercent ?? 0) - (a.gapPercent ?? 0)
    })

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
            <th className="pb-2 font-medium">Mieter</th>
            <th className="pb-2 font-medium">Objekt</th>
            <th className="pb-2 font-medium text-right">Kaltmiete</th>
            <th className="pb-2 font-medium text-right">€/m²</th>
            <th className="pb-2 font-medium text-right">Vergleichsmiete</th>
            <th className="pb-2 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const badge = statusBadge[row.status]
            return (
              <tr key={row.tenant.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                <td className="py-2.5">
                  <Link href={`/tenants/${row.tenant.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400">
                    {row.tenant.name}
                  </Link>
                </td>
                <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">{propertyLabel(row.property)}</td>
                <td className="py-2.5 text-right text-gray-900 dark:text-gray-100">{euro(row.currentRent)}</td>
                <td className="py-2.5 text-right text-gray-500 dark:text-gray-400">
                  {row.rentPerSqm != null ? `${row.rentPerSqm.toFixed(2)} €` : '–'}
                </td>
                <td className="py-2.5 text-right text-gray-500 dark:text-gray-400">
                  {row.property.comparable_rent_min != null && row.property.comparable_rent_max != null
                    ? `${row.property.comparable_rent_min.toFixed(2)}–${row.property.comparable_rent_max.toFixed(2)} €/m²`
                    : '–'}
                </td>
                <td className="py-2.5 text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
                    {row.status === 'under' && row.gapPercent != null
                      ? `Erhöhungspotential (+${row.gapPercent.toFixed(0)}%)`
                      : row.status === 'over' && row.gapPercent != null
                        ? `über Vergleichsmiete (${row.gapPercent.toFixed(0)}%)`
                        : badge.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        Vergleicht die aktuelle Kaltmiete je m² mit der beim Objekt hinterlegten ortsüblichen Vergleichsmiete (unter &quot;Bearbeiten&quot; pflegbar).
        Ohne Gewähr, ersetzt keine Rechtsberatung – Kappungsgrenze und Wartefrist für tatsächliche Erhöhungen siehe Übersicht unten.
      </p>
    </Card>
  )
}
