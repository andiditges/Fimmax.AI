import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { Sensitive, SensitiveEuro } from '@/components/privacy/sensitive'
import { Property, Tenant } from '@/lib/types'

interface Item {
  tenant: Tenant
  property: Property
  currentRent: number
}

export function RentOverviewTable({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400 dark:text-gray-500">
        Keine aktiven Mietverhältnisse gefunden.
      </Card>
    )
  }

  const rows = [...items].sort((a, b) => a.tenant.name.localeCompare(b.tenant.name))
  const totalKalt = rows.reduce((sum, r) => sum + r.currentRent, 0)
  const totalNebenkosten = rows.reduce((sum, r) => sum + (r.tenant.advance_payment ?? 0), 0)
  const totalWarm = totalKalt + totalNebenkosten

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
            <th className="pb-2 font-medium sticky left-0 bg-white dark:bg-gray-900 pr-2">Mieter</th>
            <th className="pb-2 font-medium">Objekt</th>
            <th className="pb-2 font-medium text-right">Kaltmiete</th>
            <th className="pb-2 font-medium text-right">NK-Vorauszahlung</th>
            <th className="pb-2 font-medium text-right">Warmmiete</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const advance = row.tenant.advance_payment ?? 0
            return (
              <tr key={row.tenant.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                <td className="py-2.5 sticky left-0 bg-white dark:bg-gray-900 pr-2">
                  <Link href={`/tenants/${row.tenant.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400">
                    <Sensitive kind="name" seed={row.tenant.id} value={row.tenant.name} />
                  </Link>
                </td>
                <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs"><Sensitive kind="address" seed={row.property.id} value={propertyLabel(row.property)} /></td>
                <td className="py-2.5 text-right text-gray-900 dark:text-gray-100"><SensitiveEuro seed={`${row.tenant.id}-overview-kalt`} amount={row.currentRent} /></td>
                <td className="py-2.5 text-right text-gray-500 dark:text-gray-400"><SensitiveEuro seed={`${row.tenant.id}-overview-nk`} amount={advance} /></td>
                <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100"><SensitiveEuro seed={`${row.tenant.id}-overview-warm`} amount={row.currentRent + advance} /></td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 dark:border-gray-700 font-semibold">
            <td className="pt-2.5 sticky left-0 bg-white dark:bg-gray-900 pr-2 whitespace-nowrap">Gesamt</td>
            <td className="pt-2.5">{rows.length} Mietverhältnis{rows.length !== 1 ? 'se' : ''}</td>
            <td className="pt-2.5 text-right text-gray-900 dark:text-gray-100"><SensitiveEuro seed="overview-total-kalt" amount={totalKalt} /></td>
            <td className="pt-2.5 text-right text-gray-500 dark:text-gray-400"><SensitiveEuro seed="overview-total-nk" amount={totalNebenkosten} /></td>
            <td className="pt-2.5 text-right text-blue-700 dark:text-blue-300"><SensitiveEuro seed="overview-total-warm" amount={totalWarm} /></td>
          </tr>
        </tfoot>
      </table>
    </Card>
  )
}
