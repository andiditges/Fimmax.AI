import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { ThresholdBadge } from '@/components/threshold-badge'
import { TaxExportButton } from '@/components/tax-export-button'
import { ReceiptBrowser } from '@/components/receipts/receipt-browser'
import { ArchiveYearButton } from '@/components/receipts/archive-year-button'
import { calc15Threshold } from '@/lib/threshold15'
import { buildTaxExportRow, buildTaxExportDetailRows, rowsToCsv, detailRowsToCsv } from '@/lib/tax-export'
import { getReceiptAllocations } from '@/lib/receipt-allocations'
import { calcAnnualAfa } from '@/lib/afa'
import { generateAmortizationSchedule, interestPaidInYear } from '@/lib/amortization'
import { sumRentForYear } from '@/lib/rent-schedule'
import { propertyLabel } from '@/lib/format'
import { Sensitive, SensitiveEuro } from '@/components/privacy/sensitive'
import { Property, Receipt, ReceiptItem, Tenant, RentalAgreement, RentAdjustment, Loan, LoanSpecialPayment, OperatingCost } from '@/lib/types'

export default async function SteuerUebersicht({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requireUser()
  const supabase = await createClient()
  const { year: yearParam } = await searchParams
  const thisYear = new Date().getFullYear()
  const year = yearParam ? parseInt(yearParam) : thisYear - 1
  const yearOptions = [thisYear, thisYear - 1, thisYear - 2]

  const [{ data: properties }, { data: receipts }, { data: receiptItems }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }, { data: loans }, { data: operatingCosts }] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase.from('receipts').select('*'),
    supabase.from('receipt_items').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('operating_costs').select('*'),
  ])

  const props = (properties ?? []) as Property[]
  const recs = (receipts ?? []) as Receipt[]
  const recItems = (receiptItems ?? []) as ReceiptItem[]
  const allocations = getReceiptAllocations(recs, recItems)
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const loanList = (loans ?? []) as Loan[]
  const operatingCostList = (operatingCosts ?? []) as OperatingCost[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }
  const specialPaymentList = (specialPayments ?? []) as LoanSpecialPayment[]

  const agreementsByTenant = agreementList.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = adjustmentList.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)

  const rows = props.map(p => {
    const propTenants = tenantList.filter(t => t.property_id === p.id)
    const yearIncome = sumRentForYear(propTenants, agreementsByTenant, adjustmentsByTenant, year)
    // Allokationen bewusst auf dieses Objekt beschränkt (nicht die
    // ungefilterte Portfolio-Liste) - sonst flossen fremde Objekte in
    // Werbungskosten/Ergebnis dieses Objekts mit ein. Bei aufgeteilten
    // Belegen (mehrere Objekte in einer Position) zählt jedes Objekt nur
    // seinen eigenen Anteil, nicht den vollen Beleg-Betrag.
    const propAllocations = allocations.filter(a => a.property_id === p.id)
    const yearAllocations = propAllocations.filter(a => a.tax_year === year)
    const yearExpenses = yearAllocations.reduce((s, a) => s + a.amount, 0)
    const propLoans = loanList.filter(l => l.property_id === p.id)
    const loanInterest = propLoans.reduce((s, l) => {
      const sp = specialPaymentList.filter(x => x.loan_id === l.id)
      return s + interestPaidInYear(generateAmortizationSchedule(l, sp).entries, year)
    }, 0)
    const propOperatingCosts = operatingCostList.filter(c => c.property_id === p.id)
    return {
      property: p,
      threshold: calc15Threshold(p, propAllocations),
      taxRow: buildTaxExportRow(p, year, propAllocations, yearIncome, loanInterest, propOperatingCosts),
      detailRows: buildTaxExportDetailRows(p, year, propAllocations, calcAnnualAfa(p), loanInterest, propOperatingCosts),
      yearExpenses,
      // Distinkte Belege zählen, nicht Allocation-Zeilen - ein auf 2
      // Positionen aufgeteilter Beleg zählt bei diesem Objekt weiterhin als 1.
      receiptCount: new Set(yearAllocations.map(a => a.receipt_id)).size,
    }
  })

  const yearReceipts = recs.filter(r => r.tax_year === year)
  const yearArchivedCount = yearReceipts.filter(r => r.archived).length

  const totalEinnahmen = rows.reduce((s, r) => s + r.taxRow.einnahmen, 0)
  const totalAusgaben = rows.reduce((s, r) => s + r.yearExpenses, 0)
  const totalWerbungskosten = rows.reduce((s, r) => s + r.taxRow.werbungskosten_gesamt, 0)
  const totalErgebnis = rows.reduce((s, r) => s + r.taxRow.ergebnis, 0)
  const relevantThresholds = rows.filter(r => r.threshold.within_3_years && r.threshold.alert_level !== 'safe')

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Steuerübersicht</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Alles für die Steuererklärung (Anlage V) auf einen Blick</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Ohne Gewähr, rein rechnerische Aufbereitung deiner Daten, ersetzt keine Steuerberatung – vor Abgabe bitte prüfen bzw. von einer Steuerberatung gegenprüfen lassen. Siehe auch{' '}
            <Link href="/haftungsausschluss" className="text-blue-600 dark:text-blue-400 hover:underline">Haftungsausschluss</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {yearOptions.map(y => (
            <Link
              key={y}
              href={`/steuer?year=${y}`}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${y === year ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 hover:dark:bg-gray-950'}`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {yearReceipts.length > 0 && (
        <div className="flex justify-end">
          <ArchiveYearButton year={year} receiptCount={yearReceipts.length} archivedCount={yearArchivedCount} />
        </div>
      )}

      {/* Portfolio-KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardTitle className="min-h-10">Einnahmen {year}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-500 break-words"><SensitiveEuro seed="steuer-einnahmen" amount={totalEinnahmen} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ausgaben {year}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 dark:text-red-400 break-words"><SensitiveEuro seed="steuer-ausgaben" amount={totalAusgaben} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Werbungskosten {year} (inkl. AfA)</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 dark:text-red-400 break-words"><SensitiveEuro seed="steuer-werbungskosten" amount={totalWerbungskosten} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ergebnis {year} (Anlage V)</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-500 break-words"><SensitiveEuro seed="steuer-ergebnis" amount={totalErgebnis} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Steuer-Export</CardTitle>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Keine Objekte</p>
          ) : (
            <div className="mt-1">
              <TaxExportButton csv={rowsToCsv(rows.map(r => r.taxRow))} filename={`steuer-export-portfolio-${year}.csv`} label="Portfolio (CSV)" />
            </div>
          )}
        </Card>
      </div>

      {/* 15%-Grenze Warnungen */}
      {relevantThresholds.length > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900">
          <CardTitle>15%-Hürde – Achtung bei {relevantThresholds.length} Objekt{relevantThresholds.length !== 1 ? 'en' : ''}</CardTitle>
          <div className="mt-2 space-y-1">
            {relevantThresholds.map(r => (
              <Link key={r.property.id} href={`/properties/${r.property.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span className="text-gray-700 dark:text-gray-300"><Sensitive kind="address" seed={r.property.id} value={propertyLabel(r.property)} /></span>
                <ThresholdBadge status={r.threshold} />
              </Link>
            ))}
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            Renovierungskosten innerhalb von 3 Jahren nach Kauf über 15% des Gebäudewerts müssen aktiviert statt sofort abgesetzt werden (§ 6 Abs. 1 Nr. 1a EStG).
          </p>
        </Card>
      )}

      {/* Pro Objekt */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Nach Objekt ({rows.length})</h2>
        {rows.length === 0 ? (
          <Card className="text-center py-12 text-gray-400 dark:text-gray-500">Noch keine Immobilien hinterlegt.</Card>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <Card key={r.property.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <Link href={`/properties/${r.property.id}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-700 hover:dark:text-blue-300 truncate block">
                      <Sensitive kind="address" seed={r.property.id} value={propertyLabel(r.property)} />
                    </Link>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.receiptCount} Belege in {year}</p>
                  </div>
                  <ThresholdBadge status={r.threshold} />
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Einnahmen: <strong className="text-green-600 dark:text-green-500"><SensitiveEuro seed={`${r.property.id}-einnahmen`} amount={r.taxRow.einnahmen} /></strong></span>
                  <span className="text-gray-500 dark:text-gray-400">Ausgaben: <strong className="text-red-500 dark:text-red-400"><SensitiveEuro seed={`${r.property.id}-ausgaben`} amount={r.yearExpenses} /></strong></span>
                  <span className="text-gray-500 dark:text-gray-400">Werbungskosten: <strong className="text-red-500 dark:text-red-400"><SensitiveEuro seed={`${r.property.id}-werbungskosten`} amount={r.taxRow.werbungskosten_gesamt} /></strong></span>
                  <span className="text-gray-500 dark:text-gray-400">AfA: <strong className="text-blue-600 dark:text-blue-400"><SensitiveEuro seed={`${r.property.id}-afa`} amount={r.taxRow.afa} /></strong></span>
                  <span className="text-gray-500 dark:text-gray-400">Ergebnis: <strong className="text-green-600 dark:text-green-500"><SensitiveEuro seed={`${r.property.id}-ergebnis`} amount={r.taxRow.ergebnis} /></strong></span>
                </div>
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  <TaxExportButton csv={rowsToCsv([r.taxRow])} filename={`steuer-export-${r.property.address.replace(/\s+/g, '-')}-${year}.csv`} label="CSV-Export" />
                  <TaxExportButton csv={detailRowsToCsv(r.property, year, r.detailRows)} filename={`steuer-positionen-${r.property.address.replace(/\s+/g, '-')}-${year}.csv`} label="Alle Positionen (CSV)" />
                  {r.receiptCount > 0 && (
                    <a
                      href={`/api/receipts/zip?propertyId=${r.property.id}&year=${year}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Belege {year} als ZIP
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Beleg-Suche */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Belege durchsuchen (alle Objekte, alle Jahre)</h2>
        <Card>
          <ReceiptBrowser receipts={recs} items={recItems} properties={props} showPropertyColumn />
        </Card>
      </div>
    </div>
  )
}
