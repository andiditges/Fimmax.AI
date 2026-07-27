'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { euro, formatDate } from '@/lib/format'
import { allocateOperatingCostsToTenants, settlementDeadlineStatus } from '@/lib/operating-costs'
import { OperatingCost, Property, Tenant, UtilitySettlement } from '@/lib/types'

export function Abrechnungsschreiben({
  property, year, tenants, costs, settlement,
}: {
  property: Property
  year: number
  tenants: Tenant[]
  costs: OperatingCost[]
  settlement: UtilitySettlement | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [updating, setUpdating] = useState(false)

  const allocations = allocateOperatingCostsToTenants(costs, tenants, year)
  const deadline = settlementDeadlineStatus(year)

  async function markSent() {
    setUpdating(true)
    const { error } = await supabase.from('utility_settlements').upsert({
      property_id: property.id,
      year,
      total_costs: allocations.reduce((s, a) => s + a.total, 0),
      status: 'sent',
    }, { onConflict: 'property_id,year' })
    if (error) alert('Fehler: ' + error.message)
    setUpdating(false)
    router.refresh()
  }

  return (
    <Card>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <CardTitle>Abrechnungsschreiben</CardTitle>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${settlement?.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {settlement?.status === 'sent' ? 'Versendet' : 'Entwurf'}
        </span>
      </div>
      <p className={`text-xs mt-2 ${deadline.overdue ? 'text-red-600 font-medium' : deadline.urgent ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
        Frist zur Zustellung an Mieter (§ 556 Abs. 3 BGB): {formatDate(deadline.deadline)}
        {deadline.overdue
          ? ' – bereits überschritten! Nachforderungen sind i.d.R. nicht mehr möglich, ein eventuelles Guthaben schuldest du aber weiterhin.'
          : deadline.urgent ? ` – nur noch ${deadline.daysRemaining} Tage.` : ''}
      </p>

      {allocations.length === 0 ? (
        <p className="text-sm text-gray-500 mt-3">
          Keine abzurechnenden Mietparteien für {year} (Garagen/Stellplätze werden hier standardmäßig ausgeschlossen).
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mt-1 mb-3">Basiert auf den zuletzt gespeicherten Daten oben – vor dem Erstellen also erst speichern.</p>
          <div className="space-y-2">
            {allocations.map(a => (
              <div key={a.tenant.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.tenant.name}{a.tenant.unit ? ` · ${a.tenant.unit}` : ''}</p>
                  <p className="text-xs text-gray-500">
                    {a.balance >= 0 ? 'Nachzahlung' : 'Guthaben'}:{' '}
                    <strong className={a.balance >= 0 ? 'text-red-500' : 'text-green-600'}>{euro(Math.abs(a.balance))}</strong>
                  </p>
                </div>
                <a
                  href={`/api/nebenkosten/pdf?propertyId=${property.id}&year=${year}&tenantId=${a.tenant.id}`}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  PDF erstellen
                </a>
              </div>
            ))}
          </div>

          <button
            onClick={markSent}
            disabled={updating || settlement?.status === 'sent'}
            className="mt-4 w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {updating ? 'Wird aktualisiert...' : settlement?.status === 'sent' ? '✓ Als versendet markiert' : 'Als versendet markieren'}
          </button>
        </>
      )}
    </Card>
  )
}
