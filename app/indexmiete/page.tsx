import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { VpiReadingsForm } from '@/components/vpi/vpi-readings-form'
import { IndexmieteOverview } from '@/components/vpi/indexmiete-overview'
import { StaffelmieteOverview } from '@/components/vpi/staffelmiete-overview'
import { Section558Overview } from '@/components/vpi/section558-overview'
import { ComparableRentTable } from '@/components/vpi/comparable-rent-table'
import { currentAgreement, isStaffelSchedule } from '@/lib/rent-schedule'
import { latestVpiReading } from '@/lib/vpi'
import { findGemeindeForAddress, kappungsgrenzePercent, calcSection558Status } from '@/lib/mietrecht'
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

  const staffelItems = tenantList
    .map(t => {
      const agreements = agreementList.filter(a => a.tenant_id === t.id)
      if (!isStaffelSchedule(agreements)) return null
      const property = propertyById[t.property_id]
      if (!property) return null
      return { tenant: t, property, agreements }
    })
    .filter((x): x is { tenant: Tenant; property: Property; agreements: RentalAgreement[] } => x !== null)

  const plain558Items = tenantList
    .map(t => {
      if (t.move_out_date) return null
      const agreements = agreementList.filter(a => a.tenant_id === t.id)
      if (agreements.length === 0) return null
      const active = currentAgreement(agreements)
      if (!active || active.is_index_rent) return null
      if (isStaffelSchedule(agreements)) return null
      const property = propertyById[t.property_id]
      if (!property) return null
      const gemeinde = findGemeindeForAddress(property.address)
      const status = calcSection558Status(agreements, kappungsgrenzePercent(gemeinde))
      if (!status) return null
      return { tenant: t, property, gemeinde, status }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const comparableRentItems = tenantList
    .filter(t => !t.move_out_date)
    .map(t => {
      const property = propertyById[t.property_id]
      if (!property) return null
      const agreements = agreementList.filter(a => a.tenant_id === t.id)
      const active = currentAgreement(agreements)
      const currentRent = active?.rent_amount ?? t.rent_base
      return { tenant: t, property, currentRent }
    })
    .filter((x): x is { tenant: Tenant; property: Property; currentRent: number } => x !== null)

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mieterhöhung</h1>
        <p className="text-gray-500 text-sm mt-1">
          Aktuelle Erhöhungsmöglichkeit nach § 557b BGB für Mietverhältnisse mit Indexmiete (auf Basis des Verbraucherpreisindex/VPI), Überblick über bereits vereinbarte Staffelmieten nach § 557a BGB,
          sowie Kappungsgrenzen-Countdown nach § 558 BGB für alle übrigen (fest vereinbarten) Mietverhältnisse.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Miete vs. Vergleichsmiete – Portfolio-Übersicht ({comparableRentItems.length})</h2>
        <p className="text-xs text-gray-400 -mt-2 mb-3">
          Alle aktiven Mietverhältnisse im Vergleich zur beim jeweiligen Objekt hinterlegten ortsüblichen Vergleichsmiete (€/m²) – zeigt auf einen Blick, wo Erhöhungspotential besteht oder die Miete bereits über dem Vergleichswert liegt.
        </p>
        <ComparableRentTable items={comparableRentItems} />
      </div>

      <VpiReadingsForm readings={readingList} />

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Mietverhältnisse mit Indexmiete ({indexItems.length})</h2>
        <IndexmieteOverview items={indexItems} latestReading={latest} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Mietverhältnisse mit Staffelmiete ({staffelItems.length})</h2>
        <StaffelmieteOverview items={staffelItems} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Feste Miete – Kappungsgrenzen-Countdown ({plain558Items.length})</h2>
        <p className="text-xs text-gray-400 -mt-2 mb-3">
          Für Mietverhältnisse ohne Staffel- oder Indexvereinbarung: wann eine Mieterhöhung nach § 558 BGB (Anpassung an die ortsübliche Vergleichsmiete) frühestens verlangt werden darf,
          und wie viel von der Kappungsgrenze (20% bzw. 15% in Gebieten mit angespanntem Wohnungsmarkt) in den letzten 3 Jahren bereits ausgeschöpft ist.
        </p>
        <Section558Overview items={plain558Items} />
      </div>
    </div>
  )
}
