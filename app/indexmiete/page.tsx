import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { VpiReadingsForm } from '@/components/vpi/vpi-readings-form'
import { IndexmieteOverview } from '@/components/vpi/indexmiete-overview'
import { currentAgreement } from '@/lib/rent-schedule'
import { latestVpiReading } from '@/lib/vpi'
import { Property, RentalAgreement, Tenant, VpiReading } from '@/lib/types'

export default async function IndexmietePage() {
  await requireUser()
  const supabase = await createClient()

  const [{ data: readings }, { data: properties }, { data: tenants }, { data: agreements }] = await Promise.all([
    supabase.from('vpi_readings').select('*'),
    supabase.from('properties').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
  ])

  const readingList = (readings ?? []) as VpiReading[]
  const props = (properties ?? []) as Property[]
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (agreements ?? []) as RentalAgreement[]

  const propertyById = Object.fromEntries(props.map(p => [p.id, p]))
  const latest = latestVpiReading(readingList)

  const indexItems = tenantList
    .map(t => {
      const agreements = agreementList.filter(a => a.tenant_id === t.id)
      const active = currentAgreement(agreements)
      if (!active || !active.is_index_rent) return null
      const property = propertyById[t.property_id]
      if (!property) return null
      return { tenant: t, property, agreement: active }
    })
    .filter((x): x is { tenant: Tenant; property: Property; agreement: RentalAgreement } => x !== null)

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Indexmiete</h1>
        <p className="text-gray-500 text-sm mt-1">
          Aktuelle Erhöhungsmöglichkeit nach § 557b BGB für Mietverhältnisse mit Indexmiete, auf Basis des Verbraucherpreisindex (VPI).
        </p>
      </div>

      <VpiReadingsForm readings={readingList} />

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Mietverhältnisse mit Indexmiete ({indexItems.length})</h2>
        <IndexmieteOverview items={indexItems} latestReading={latest} />
      </div>
    </div>
  )
}
