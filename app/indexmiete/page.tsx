import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { VpiReadingsForm } from '@/components/vpi/vpi-readings-form'
import { IndexmieteOverview } from '@/components/vpi/indexmiete-overview'
import { StaffelmieteOverview } from '@/components/vpi/staffelmiete-overview'
import { Section558Overview } from '@/components/vpi/section558-overview'
import { ComparableRentTable } from '@/components/vpi/comparable-rent-table'
import { GenerateRemindersButton } from '@/components/reminders/generate-reminders-button'
import { Card, CardTitle } from '@/components/ui/card'
import { currentAgreement, isStaffelSchedule, nextAgreementStep } from '@/lib/rent-schedule'
import { calcIndexmieteStatus, latestVpiReading } from '@/lib/vpi'
import { findGemeindeForAddress, kappungsgrenzePercent, calcSection558Status } from '@/lib/mietrecht'
import { suggestIndexmieteReminders, suggestStaffelReminders } from '@/lib/reminder-suggestions'
import { euro } from '@/lib/format'
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

  // Geplanter Sammel-Erhöhungstermin für alle Indexmiete-Mietverhältnisse:
  // unabhängig davon, ob die 12-Monats-Frist schon jetzt, ab September oder
  // erst kurz vorher erreicht wird, sollen die Schreiben gebündelt Anfang
  // November für den 01.01. des Folgejahres verschickt werden.
  const targetIncreaseDate = '2027-01-01'
  const indexReminderSuggestions = suggestIndexmieteReminders(indexItems, targetIncreaseDate, '2026-11-01')
  const staffelReminderSuggestions = suggestStaffelReminders(staffelItems, new Date(), 1)

  // Portfolio-Gesamtsumme über beide Mechanismen: Indexmiete trägt sowohl
  // zur "heute bereits möglich"- als auch zur "inkl. zukünftig"-Summe bei,
  // Staffelmiete nur zu Letzterer - die nächste Stufe tritt automatisch zum
  // vereinbarten Termin in Kraft, ist also keine "heute mögliche" Erhöhung,
  // die der Vermieter selbst auslösen müsste.
  let totalToday = 0
  let totalInclFuture = 0
  if (latest) {
    for (const item of indexItems) {
      const status = calcIndexmieteStatus(item.agreement, latest)
      if (!status) continue
      const delta = status.possible_new_rent - status.current_rent
      totalInclFuture += delta
      if (status.eligible) totalToday += delta
    }
  }
  for (const item of staffelItems) {
    const active = currentAgreement(item.agreements)
    const next = nextAgreementStep(item.agreements)
    if (!active || !next) continue
    totalInclFuture += next.rent_amount - active.rent_amount
  }

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mieterhöhung</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Aktuelle Erhöhungsmöglichkeit nach § 557b BGB für Mietverhältnisse mit Indexmiete (auf Basis des Verbraucherpreisindex/VPI), Überblick über bereits vereinbarte Staffelmieten nach § 557a BGB,
          sowie Kappungsgrenzen-Countdown nach § 558 BGB für alle übrigen (fest vereinbarten) Mietverhältnisse.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Miete vs. Vergleichsmiete – Portfolio-Übersicht ({comparableRentItems.length})</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2 mb-3">
          Alle aktiven Mietverhältnisse im Vergleich zur beim jeweiligen Objekt hinterlegten ortsüblichen Vergleichsmiete (€/m²) – zeigt auf einen Blick, wo Erhöhungspotential besteht oder die Miete bereits über dem Vergleichswert liegt.
        </p>
        <ComparableRentTable items={comparableRentItems} />
      </div>

      <VpiReadingsForm readings={readingList} />

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Mietverhältnisse mit Indexmiete ({indexItems.length})</h2>
          <GenerateRemindersButton
            label={`Erinnerungen für 01.11.2026 anlegen (${indexReminderSuggestions.length})`}
            suggestions={indexReminderSuggestions}
          />
        </div>
        <IndexmieteOverview items={indexItems} latestReading={latest} />
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Mietverhältnisse mit Staffelmiete ({staffelItems.length})</h2>
          <GenerateRemindersButton
            label={`Erinnerungen für anstehende Stufen anlegen (${staffelReminderSuggestions.length})`}
            suggestions={staffelReminderSuggestions}
          />
        </div>
        <StaffelmieteOverview items={staffelItems} />
      </div>

      {totalInclFuture > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900">
          <CardTitle>Mögliche Mieterhöhung insgesamt (Indexmiete + Staffelmiete)</CardTitle>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bereits heute möglich (Indexmiete)</p>
            <p className="font-semibold text-green-700 dark:text-green-300">+{euro(totalToday)} / Monat</p>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Inkl. zukünftig möglicher Erhöhungen (Index + Staffel)</p>
            <p className="font-semibold text-blue-700 dark:text-blue-300">+{euro(totalInclFuture)} / Monat</p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Staffelmiete-Stufen treten automatisch zum vereinbarten Termin in Kraft und zählen daher nur zur "inkl. zukünftig"-Summe, nicht zu "bereits heute möglich".
          </p>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Feste Miete – Kappungsgrenzen-Countdown ({plain558Items.length})</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2 mb-3">
          Für Mietverhältnisse ohne Staffel- oder Indexvereinbarung: wann eine Mieterhöhung nach § 558 BGB (Anpassung an die ortsübliche Vergleichsmiete) frühestens verlangt werden darf,
          und wie viel von der Kappungsgrenze (20% bzw. 15% in Gebieten mit angespanntem Wohnungsmarkt) in den letzten 3 Jahren bereits ausgeschöpft ist.
        </p>
        <Section558Overview items={plain558Items} />
      </div>
    </div>
  )
}
