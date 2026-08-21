import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { formatDate, propertyLabel } from '@/lib/format'
import { Sensitive, SensitiveEuro } from '@/components/privacy/sensitive'
import { currentAgreement, nextAgreementStep } from '@/lib/rent-schedule'
import { Property, RentalAgreement, Tenant } from '@/lib/types'

interface Item {
  tenant: Tenant
  property: Property
  agreements: RentalAgreement[]
}

export function StaffelmieteOverview({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400 dark:text-gray-500">
        Noch keine Mietverhältnisse mit Staffelmiete hinterlegt. Beim Anlegen eines Mieters die Mietart "Staffelmiete" wählen.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <StaffelmieteRow key={item.tenant.id} item={item} />
      ))}
    </div>
  )
}

function StaffelmieteRow({ item }: { item: Item }) {
  const sortedSteps = [...item.agreements].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const active = currentAgreement(item.agreements)
  const next = nextAgreementStep(item.agreements)

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/tenants/${item.tenant.id}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400"><Sensitive kind="name" seed={item.tenant.id} value={item.tenant.name} /></Link>
          <p className="text-xs text-gray-400 dark:text-gray-500"><Sensitive kind="address" seed={item.property.id} value={propertyLabel(item.property)} /></p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${next ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          {next ? `Nächste Stufe ab ${formatDate(next.start_date)}` : 'Letzte Stufe erreicht'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-sm">
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Aktuelle Miete</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{active ? <SensitiveEuro seed={`${active.id}-amount`} amount={active.rent_amount} /> : '–'}</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Nächste Stufe</p>
          <p className="font-medium text-blue-700 dark:text-blue-400">{next ? <SensitiveEuro seed={`${next.id}-amount`} amount={next.rent_amount} /> : '–'}</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Erhöhung zur nächsten Stufe</p>
          <p className="font-medium text-green-700 dark:text-green-400">
            {next && active ? <>+<SensitiveEuro seed={`${next.id}-delta`} amount={next.rent_amount - active.rent_amount} /></> : '–'}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Alle Staffelstufen</p>
        <div className="flex flex-wrap gap-2">
          {sortedSteps.map(step => (
            <span
              key={step.id}
              className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap ${
                step.id === active?.id ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {formatDate(step.start_date)}: <SensitiveEuro seed={`${step.id}-amount`} amount={step.rent_amount} />
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        Ohne Gewähr, auf Basis der hier hinterlegten Staffelvereinbarung – bitte gegen den Mietvertrag prüfen.
      </p>
    </Card>
  )
}
