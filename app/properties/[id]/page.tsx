import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { ThresholdBadge, ThresholdBar } from '@/components/threshold-badge'
import { ReminderRow } from '@/components/reminders/reminder-row'
import { TaxExportButton } from '@/components/tax-export-button'
import { ExposeButton } from '@/components/properties/expose-button'
import { PropertyImages } from '@/components/properties/property-images'
import { PropertyReserves } from '@/components/properties/property-reserves'
import { TilgungRing, LtvRing } from '@/components/properties/tilgung-ring'
import { RiskOverview } from '@/components/tipps/risk-overview'
import { ReceiptBrowser } from '@/components/receipts/receipt-browser'
import { Ehegattenschaukel } from '@/components/properties/ehegattenschaukel'
import { HoaDocumentMove } from '@/components/hoa/hoa-document-move'
import { calcAnnualAfa, shouldRecommendNutzungsdauergutachten } from '@/lib/afa'
import { calc15Threshold } from '@/lib/threshold15'
import { getLoanStatus, generateAmortizationSchedule, interestPaidInYear, aggregateLoanChains } from '@/lib/amortization'
import { buildTaxExportRow, buildTaxExportDetailRows, rowsToCsv, detailRowsToCsv } from '@/lib/tax-export'
import { getReceiptAllocations } from '@/lib/receipt-allocations'
import { generateRentSchedule, currentRentAmount, currentAgreement } from '@/lib/rent-schedule'
import { sumInstandhaltungsruecklage, isUtilityBillableTenant } from '@/lib/operating-costs'
import { euro, formatDate, propertyLabel, propertyValue } from '@/lib/format'
import { Sensitive, SensitiveEuro } from '@/components/privacy/sensitive'
import { CATEGORY_LABELS, HOA_RESOLUTION_STATUS_LABELS, HoaDocument, HoaResolution, HoaResolutionStatus, Property, PropertyImage, Receipt, ReceiptItem, Reminder, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, PropertyReserve, OperatingCost, PROPERTY_CONDITION_GRADE_LABELS, PropertyConditionGrade } from '@/lib/types'

const HOA_STATUS_COLORS: Record<HoaResolutionStatus, string> = {
  offen: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  in_umsetzung: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200',
  umgesetzt: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200',
}

export default async function PropertyDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ steuerjahr?: string }> }) {
  await requireUser()
  const { id } = await params
  const { steuerjahr } = await searchParams
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [{ data: property }, { data: receipts }, { data: receiptItems }, { data: tenants }, { data: loans }, { data: reminders }, { data: hoaDocuments }, { data: hoaResolutions }, { data: reserves }, { data: operatingCosts }, { data: propertyImages }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    // Bewusst nicht auf property_id gefiltert: ein Beleg kann per
    // receipt_items auf mehrere Immobilien aufgeteilt sein, dessen eigener
    // property_id-Wert dann eine andere/die "primäre" Immobilie sein kann -
    // die Allokations-Filterung unten übernimmt die Objekt-Zuordnung.
    supabase.from('receipts').select('*'),
    supabase.from('receipt_items').select('*'),
    supabase.from('tenants').select('*').eq('property_id', id),
    supabase.from('loans').select('*').eq('property_id', id),
    supabase.from('reminders').select('*').eq('property_id', id).order('status').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('hoa_documents').select('*').eq('property_id', id).order('year', { ascending: false }),
    supabase.from('hoa_resolutions').select('*').eq('property_id', id).gte('year', currentYear - 2).order('year', { ascending: false }),
    supabase.from('property_reserves').select('*').eq('property_id', id).order('created_at'),
    supabase.from('operating_costs').select('*').eq('property_id', id),
    supabase.from('property_images').select('*').eq('property_id', id).order('is_cover', { ascending: false }).order('created_at'),
  ])

  if (!property) notFound()

  const p = property as Property
  const allReceipts = (receipts ?? []) as Receipt[]
  const allReceiptItems = (receiptItems ?? []) as ReceiptItem[]
  // Belege, die als Dokument primär dieser Immobilie zugeordnet sind (für die
  // Beleg-Liste/-Verwaltung unten) - unabhängig davon, wie sie steuerlich per
  // Allokation aufgeteilt sind.
  const recs = allReceipts.filter(r => r.property_id === id).sort((a, b) => b.receipt_date.localeCompare(a.receipt_date))
  const propAllocations = getReceiptAllocations(allReceipts, allReceiptItems).filter(a => a.property_id === id)
  const tenantList = (tenants ?? []) as Tenant[]
  const propertyLoans = (loans ?? []) as Loan[]
  const reminderList = (reminders ?? []) as Reminder[]
  const hoaDocs = (hoaDocuments ?? []) as HoaDocument[]
  const hoaResolutionList = (hoaResolutions ?? []) as HoaResolution[]
  const reserveList = (reserves ?? []) as PropertyReserve[]
  const operatingCostList = (operatingCosts ?? []) as OperatingCost[]
  const imageList = (propertyImages ?? []) as PropertyImage[]
  const reminderById = Object.fromEntries(reminderList.map(r => [r.id, r]))

  const { data: rentalAgreements } = tenantList.length
    ? await supabase.from('rental_agreements').select('*').in('tenant_id', tenantList.map(t => t.id))
    : { data: [] as RentalAgreement[] }
  const { data: rentAdjustments } = tenantList.length
    ? await supabase.from('rent_adjustments').select('*').in('tenant_id', tenantList.map(t => t.id))
    : { data: [] as RentAdjustment[] }
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const agreementsByTenant = agreementList.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = adjustmentList.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)

  const { data: allSpecialPayments } = propertyLoans.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', propertyLoans.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoanId = propertyLoans.reduce((acc, l) => {
    acc[l.id] = (allSpecialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const loanStatuses = propertyLoans.map(l => ({
    loan: l,
    status: getLoanStatus(l, specialPaymentsByLoanId[l.id] ?? []),
  }))
  // aggregateLoanChains statt roher principal-/remaining-Summen: sonst würde
  // eine Anschlussfinanzierung (zwei Kredit-Datensätze für dieselbe Immobilie)
  // nach ihrer Auszahlung doppelt gezählt, die Tilgungs-/LTV-Quote also
  // dauerhaft verfälschen. Noch nicht ausgezahlte Wurzelkredite zählen dabei
  // weiterhin nicht mit - sonst würde ihr voller principal die Quote
  // verfälschen, obwohl noch keine Schuld besteht.
  const loanChains = aggregateLoanChains(propertyLoans, specialPaymentsByLoanId)
  const totalLoanPrincipal = loanChains.reduce((s, c) => s + c.financed, 0)
  const totalLoanRemaining = loanChains.reduce((s, c) => s + c.remaining, 0)
  const totalTilgungPercent = totalLoanPrincipal > 0 ? ((totalLoanPrincipal - totalLoanRemaining) / totalLoanPrincipal) * 100 : 0
  const ltvPercent = propertyValue(p) > 0 ? (totalLoanRemaining / propertyValue(p)) * 100 : 0

  const threshold = calc15Threshold(p, propAllocations)
  const annualAfa = calcAnnualAfa(p)

  const yearAllocations = propAllocations.filter(a => a.tax_year === currentYear)
  const yearExpenses = yearAllocations.reduce((s, a) => s + a.amount, 0)
  const yearIncome = tenantList.reduce((sum, t) => {
    const schedule = generateRentSchedule(
      t,
      agreementsByTenant[t.id] ?? [],
      adjustmentsByTenant[t.id] ?? [],
      new Date(currentYear, 0, 1),
      new Date(currentYear, 11, 1)
    )
    return sum + schedule.reduce((s, e) => s + e.amount, 0)
  }, 0)

  // Für den Vergleichsmieten-Abgleich: Kaltmiete ohne Garage/Stellplatz-Mieter,
  // da Vergleichsmieten sich auf die Wohnfläche beziehen.
  const currentColdRent = tenantList
    .filter(t => !t.move_out_date && isUtilityBillableTenant(t))
    .reduce((sum, t) => sum + (currentRentAmount(agreementsByTenant[t.id] ?? []) ?? 0), 0)
  const currentRentPerSqm = p.living_area_sqm ? currentColdRent / p.living_area_sqm : null
  const conditionEntries: [string, PropertyConditionGrade][] = [
    ['Fenster', p.condition_windows],
    ['Elektro', p.condition_electrical],
    ['Sanitär / Bad', p.condition_bathroom],
    ['Heizung', p.condition_heating],
  ].filter((c): c is [string, PropertyConditionGrade] => c[1] !== null)

  const byCategory = CATEGORY_LABELS
  const categoryTotals = Object.keys(byCategory).map(cat => ({
    cat,
    label: byCategory[cat as keyof typeof byCategory],
    total: yearAllocations.filter(a => a.category === cat).reduce((s, a) => s + a.amount, 0),
  })).filter(c => c.total > 0)

  const loanInterestThisYear = propertyLoans.reduce((s, l) => {
    const sp = (allSpecialPayments ?? []).filter(x => x.loan_id === l.id)
    return s + interestPaidInYear(generateAmortizationSchedule(l, sp).entries, currentYear)
  }, 0)
  const openReminders = reminderList.filter(r => r.status !== 'erledigt')
  const receiptYears = [...new Set(recs.map(r => r.tax_year))].sort((a, b) => b - a)

  // Steuer-Export-Jahr: unabhängig vom laufenden Kalenderjahr wählbar, sonst
  // liefert der Export für ein frisch erworbenes Objekt (noch keine Belege im
  // aktuellen Jahr) eine praktisch leere Datei, obwohl z.B. 28 Belege aus dem
  // Kaufjahr vorliegen. Default: das jüngste Jahr mit tatsächlichen Belegen,
  // sonst das laufende Jahr.
  const exportYearOptions = [...new Set([...receiptYears, currentYear])].sort((a, b) => b - a)
  const exportYear = steuerjahr ? parseInt(steuerjahr) : (receiptYears[0] ?? currentYear)
  const exportYearIncome = tenantList.reduce((sum, t) => {
    const schedule = generateRentSchedule(
      t,
      agreementsByTenant[t.id] ?? [],
      adjustmentsByTenant[t.id] ?? [],
      new Date(exportYear, 0, 1),
      new Date(exportYear, 11, 1)
    )
    return sum + schedule.reduce((s, e) => s + e.amount, 0)
  }, 0)
  const exportLoanInterest = propertyLoans.reduce((s, l) => {
    const sp = (allSpecialPayments ?? []).filter(x => x.loan_id === l.id)
    return s + interestPaidInYear(generateAmortizationSchedule(l, sp).entries, exportYear)
  }, 0)
  const taxExportRow = buildTaxExportRow(p, exportYear, propAllocations, exportYearIncome, exportLoanInterest, operatingCostList)
  const taxExportDetailRows = buildTaxExportDetailRows(p, exportYear, propAllocations, annualAfa, exportLoanInterest, operatingCostList)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/properties" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:dark:text-gray-300 mb-1 block">← Immobilien</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Sensitive kind="address" seed={p.id} value={propertyLabel(p)} />
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Baujahr {p.build_year} · AfA {p.afa_rate}% · {p.is_self_managed ? 'Selbst verwaltet' : 'Fremd verwaltet'} · Besitzübergang {formatDate(p.purchase_date)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ThresholdBadge status={threshold} />
          <Link href={`/properties/${id}/edit`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Bearbeiten</Link>
          {exportYearOptions.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <span className="text-xs text-gray-400 dark:text-gray-500">Steuer-Export-Jahr:</span>
              {exportYearOptions.map(y => (
                <Link
                  key={y}
                  href={`/properties/${id}?steuerjahr=${y}`}
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${y === exportYear ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-gray-800'}`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}
          <TaxExportButton csv={rowsToCsv([taxExportRow])} filename={`steuer-export-${p.address.replace(/\s+/g, '-')}-${exportYear}.csv`} label={`Steuer-Export ${exportYear} (CSV)`} />
          <TaxExportButton csv={detailRowsToCsv(p, exportYear, taxExportDetailRows)} filename={`steuer-positionen-${p.address.replace(/\s+/g, '-')}-${exportYear}.csv`} label={`Alle Positionen ${exportYear} (CSV)`} />
          <ExposeButton propertyId={id} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardTitle className="min-h-10">Einnahmen {currentYear}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-500 break-words"><SensitiveEuro seed={`${p.id}-income`} amount={yearIncome} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ausgaben {currentYear}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 dark:text-red-400 break-words"><SensitiveEuro seed={`${p.id}-expenses`} amount={yearExpenses} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">AfA / Jahr</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400 break-words"><SensitiveEuro seed={`${p.id}-afa`} amount={annualAfa} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ergebnis vor AfA</CardTitle>
          <p className={`text-lg md:text-2xl font-bold break-words ${yearIncome - yearExpenses >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400'}`}>
            <SensitiveEuro seed={`${p.id}-result`} amount={yearIncome - yearExpenses} />
          </p>
        </Card>
      </div>

      {/* Zustand & Vergleichsmiete */}
      {(p.living_area_sqm || conditionEntries.length > 0 || p.comparable_rent_min || p.renovation_note) && (
        <Card>
          <CardTitle>Zustand & Vergleichsmiete</CardTitle>
          <div className="mt-2 space-y-2 text-sm">
            {p.living_area_sqm && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Wohnfläche</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{p.living_area_sqm} m²</span>
              </div>
            )}
            {conditionEntries.length > 0 && (
              <div className="flex justify-between flex-wrap gap-x-4">
                <span className="text-gray-500 dark:text-gray-400">Zustand</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-right">
                  {conditionEntries.map(([label, grade]) => `${label}: ${PROPERTY_CONDITION_GRADE_LABELS[grade]}`).join(' · ')}
                </span>
              </div>
            )}
            {p.renovation_note && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Notiz</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-right">{p.renovation_note}</span>
              </div>
            )}
            {currentRentPerSqm != null && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Aktuelle Kaltmiete</span>
                <span className="font-medium text-gray-900 dark:text-gray-100"><SensitiveEuro seed={`${p.id}-coldrent`} amount={currentColdRent} /> ({currentRentPerSqm.toFixed(2)} €/m²)</span>
              </div>
            )}
            {(p.comparable_rent_min || p.comparable_rent_max) && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500 dark:text-gray-400">Ortsübliche Vergleichsmiete</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {euro(p.comparable_rent_min ?? p.comparable_rent_max ?? 0)}–{euro(p.comparable_rent_max ?? p.comparable_rent_min ?? 0)} /m²
                </span>
              </div>
            )}
            {currentRentPerSqm != null && p.comparable_rent_max != null && currentRentPerSqm > p.comparable_rent_max && (
              <p className="text-xs text-red-600 font-medium">
                Deine Kaltmiete pro m² liegt über der von dir hinterlegten Vergleichsmiete-Obergrenze – bei einer weiteren Erhöhung Vorsicht wegen § 5 WiStrG (Mietpreisüberhöhung).
              </p>
            )}
            {(p.comparable_rent_source || p.comparable_rent_as_of) && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Quelle: {p.comparable_rent_source || '–'}{p.comparable_rent_as_of ? ` · Stand ${formatDate(p.comparable_rent_as_of)}` : ''}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Ehegattenschaukel */}
      <Ehegattenschaukel property={p} />

      {shouldRecommendNutzungsdauergutachten(p) && (
        <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900">
          <CardTitle>Nutzungsdauergutachten empfohlen</CardTitle>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
            {p.build_year < 2000
              ? `Baujahr ${p.build_year} liegt deutlich vor dem gesetzlichen Standard-Zeitraum – `
              : 'Mehrere als "alt" erfasste Ausstattungsmerkmale legen nahe, dass '}
            die tatsächliche Restnutzungsdauer des Gebäudes wahrscheinlich kürzer ist als die aktuell hinterlegten {p.usage_duration} Jahre.
            Ein Kurzgutachten zur Restnutzungsdauer (Nutzungsdauergutachten) kann das gegenüber dem Finanzamt nachweisen und dadurch die jährliche AfA erhöhen –
            Kosten liegen meist bei 500–1.500 €, oft schon nach 1–2 Jahren höherer AfA amortisiert. Bitte mit einem Steuerberater oder Gutachter final klären.
          </p>
        </Card>
      )}

      {/* Standortrisiko */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Standortrisiko</h2>
        <RiskOverview properties={[p]} />
      </div>

      {/* Bilder */}
      <PropertyImages propertyId={id} images={imageList} />

      {/* Rücklagen */}
      <PropertyReserves
        propertyId={id}
        reserves={reserveList}
        instandhaltungsruecklage={sumInstandhaltungsruecklage(operatingCostList)}
      />

      {/* To-Dos & Erinnerungen */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">To-Dos & Erinnerungen ({openReminders.length} offen)</h2>
          <Link href={`/reminders/new?property=${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Erinnerung</Link>
        </div>
        {reminderList.length === 0 ? (
          <Card className="text-center py-8 text-gray-400 dark:text-gray-500">Noch keine Erinnerungen</Card>
        ) : (
          <div className="space-y-2">
            {reminderList.map(r => (
              <ReminderRow
                key={r.id}
                reminder={r}
                dependsOnTitle={r.depends_on_id ? reminderById[r.depends_on_id]?.title : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* 15%-Hürde */}
      {threshold.within_3_years && (
        <Card>
          <CardTitle>15%-Hürde (§ 6 Abs. 1 Nr. 1a EStG)</CardTitle>
          <ThresholdBar status={threshold} seed={id} />
        </Card>
      )}

      {/* Nebenkostenassistent */}
      <Link href={`/properties/${id}/nebenkosten`} className="block">
        <Card className="!bg-blue-600 border-0 hover:!bg-blue-700 transition-colors cursor-pointer">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white font-semibold">Hier zum Nebenkostenassistent</p>
              <p className="text-blue-100 text-sm mt-0.5">Kostenpositionen (Grundsteuer, Müll, Verwaltung, …) eintragen, Abrechnungsschreiben je Mieter erzeugen – fließt automatisch in deinen Steuer-Export ein</p>
            </div>
            <span className="text-white text-xl">→</span>
          </div>
        </Card>
      </Link>

      {/* Ausgaben nach Kategorie */}
      {categoryTotals.length > 0 && (
        <Card>
          <CardTitle>Ausgaben {currentYear} nach Kategorie</CardTitle>
          <div className="mt-3 space-y-2">
            {categoryTotals.map(c => (
              <div key={c.cat} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{c.label}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100"><SensitiveEuro seed={`${p.id}-cat-${c.cat}`} amount={c.total} /></span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Gesamt</span>
              <span><SensitiveEuro seed={`${p.id}-expenses`} amount={yearExpenses} /></span>
            </div>
          </div>
        </Card>
      )}

      {/* Finanzierung */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Finanzierung ({propertyLoans.length})</h2>
          <Link href={`/loans/new?property=${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Kredit erfassen</Link>
        </div>
        {loanStatuses.length === 0 ? (
          <Card className="text-center py-8 text-gray-400 dark:text-gray-500">Noch keine Kredite hinterlegt</Card>
        ) : (
          <div className="space-y-2">
            {totalLoanPrincipal > 0 && (
              <Card className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <TilgungRing percent={totalTilgungPercent} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Bereits getilgt</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      <SensitiveEuro seed={`${p.id}-tilgung-paid`} amount={totalLoanPrincipal - totalLoanRemaining} /> von ursprünglich <SensitiveEuro seed={`${p.id}-tilgung-total`} amount={totalLoanPrincipal} /> Kreditsumme
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:border-l sm:border-gray-100 sm:dark:border-gray-800 sm:pl-4">
                  <LtvRing percent={ltvPercent} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Beleihungsauslauf (LTV)</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      <SensitiveEuro seed={`${p.id}-ltv-remaining`} amount={totalLoanRemaining} /> Restschuld / <SensitiveEuro seed={`${p.id}-ltv-value`} amount={propertyValue(p)} /> Wert
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {loanStatuses.map(({ loan, status }) => (
              <Link key={loan.id} href={`/loans/${loan.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"><Sensitive kind="name" seed={loan.id} value={loan.name} /></p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{loan.nominal_interest_rate}% Sollzins · <SensitiveEuro seed={`${loan.id}-annuity`} amount={status.current_annuity_amount} /> / {loan.payment_frequency}</p>
                      {loan.planned_renovation_amount && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Davon <SensitiveEuro seed={`${loan.id}-renovation`} amount={loan.planned_renovation_amount} /> für Renovierung/Sanierung eingeplant</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap"><SensitiveEuro seed={`${loan.id}-remaining`} amount={status.remaining_balance} /></span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Mieter & Miete */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Mieter & Miete ({tenantList.length})</h2>
          <Link href={`/tenants/new?property=${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Mieter erfassen</Link>
        </div>
        {tenantList.length === 0 ? (
          <Card className="text-center py-8 text-gray-400 dark:text-gray-500">Noch keine Mieter hinterlegt</Card>
        ) : (
          <div className="space-y-2">
            {tenantList.map(t => {
              const agreements = agreementsByTenant[t.id] ?? []
              const rent = currentRentAmount(agreements)
              const activeAgreement = currentAgreement(agreements)
              return (
                <Link key={t.id} href={`/tenants/${t.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          <Sensitive kind="name" seed={t.id} value={t.name} />{t.unit && t.unit !== 'Wohnung' ? ` · ${t.unit}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {activeAgreement ? `seit ${formatDate(activeAgreement.start_date)}` : `Einzug ${formatDate(t.move_in_date)}`}
                          {t.move_out_date ? ` · Auszug ${formatDate(t.move_out_date)}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{rent !== null ? <SensitiveEuro seed={`${t.id}-rent`} amount={rent} /> : '–'}</span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Belegliste */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Belege ({recs.length})</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {receiptYears.map(y => (
              <a key={y} href={`/api/receipts/zip?propertyId=${id}&year=${y}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:dark:text-blue-400 hover:underline whitespace-nowrap">
                ZIP {y}
              </a>
            ))}
            <Link href={`/receipts/new?property=${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">+ Beleg erfassen</Link>
          </div>
        </div>
        {recs.length === 0 ? (
          <Card className="text-center py-8 text-gray-400 dark:text-gray-500">Noch keine Belege</Card>
        ) : (
          <Card>
            <ReceiptBrowser receipts={recs} items={allReceiptItems} />
          </Card>
        )}
      </div>

      {/* WEG-Dokumente & Beschlüsse */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">WEG-Dokumente & Beschlüsse</h2>
          <Link href={`/hoa/new?property=${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Dokument hochladen</Link>
        </div>
        {hoaDocs.length === 0 && hoaResolutionList.length === 0 ? (
          <Card className="text-center py-8 text-gray-400 dark:text-gray-500">Noch keine WEG-Dokumente hinterlegt</Card>
        ) : (
          <div className="space-y-4">
            {hoaDocs.length > 0 && (
              <div className="space-y-2">
                {hoaDocs.map(doc => (
                  <Card key={doc.id} className="py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {doc.year}{doc.meeting_date ? ` · ${formatDate(doc.meeting_date)}` : ''}
                        </p>
                      </div>
                      {doc.file_url && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">📄 Protokoll hinterlegt</span>
                      )}
                    </div>
                    {doc.file_url && (
                      <div className="mt-2">
                        <HoaDocumentMove doc={doc} propertyId={id} />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {hoaResolutionList.length > 0 && (
              <Card>
                <CardTitle>Beschlüsse (letzte 3 Jahre)</CardTitle>
                <div className="mt-3 space-y-3">
                  {hoaResolutionList.map(res => (
                    <div key={res.id} className="flex items-start justify-between gap-3 flex-wrap text-sm">
                      <div className="min-w-0">
                        <p className="text-gray-900 dark:text-gray-100">{res.title}</p>
                        {res.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{res.description}</p>}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{res.year}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${HOA_STATUS_COLORS[res.status]}`}>
                        {HOA_RESOLUTION_STATUS_LABELS[res.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
