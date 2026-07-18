import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { ThresholdBadge } from '@/components/threshold-badge'
import { TaxExportButton } from '@/components/tax-export-button'
import { RoofedImmobilie } from '@/components/roofed'
import { calc15Threshold } from '@/lib/threshold15'
import { buildTaxExportRow } from '@/lib/tax-export'
import { sumRentForYear } from '@/lib/rent-schedule'
import { euro, propertyLabel } from '@/lib/format'
import { Property, Receipt, Tenant, RentalAgreement, RentAdjustment } from '@/lib/types'

export default async function SteuerUebersicht({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requireUser()
  const supabase = await createClient()
  const { year: yearParam } = await searchParams
  const thisYear = new Date().getFullYear()
  const year = yearParam ? parseInt(yearParam) : thisYear - 1
  const yearOptions = [thisYear, thisYear - 1, thisYear - 2]

  const [{ data: properties }, { data: receipts }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase.from('receipts').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
  ])

  const props = (properties ?? []) as Property[]
  const recs = (receipts ?? []) as Receipt[]
  const tenantList = (tenants ?? []) as Tenant[]
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

  const rows = props.map(p => {
    const propTenants = tenantList.filter(t => t.property_id === p.id)
    const yearIncome = sumRentForYear(propTenants, agreementsByTenant, adjustmentsByTenant, year)
    const yearExpenses = recs.filter(r => r.property_id === p.id && r.tax_year === year).reduce((s, r) => s + r.amount, 0)
    return {
      property: p,
      threshold: calc15Threshold(p, recs.filter(r => r.property_id === p.id)),
      taxRow: buildTaxExportRow(p, year, recs, yearIncome),
      yearExpenses,
      receiptCount: recs.filter(r => r.property_id === p.id && r.tax_year === year).length,
    }
  })

  const totalEinnahmen = rows.reduce((s, r) => s + r.taxRow.einnahmen, 0)
  const totalAusgaben = rows.reduce((s, r) => s + r.yearExpenses, 0)
  const totalWerbungskosten = rows.reduce((s, r) => s + r.taxRow.werbungskosten_gesamt, 0)
  const totalErgebnis = rows.reduce((s, r) => s + r.taxRow.ergebnis, 0)
  const relevantThresholds = rows.filter(r => r.threshold.within_3_years && r.threshold.alert_level !== 'safe')

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Steuerübersicht</h1>
          <p className="text-gray-500 text-sm mt-1">Alles für die Steuererklärung (Anlage V) auf einen Blick</p>
        </div>
        <div className="flex items-center gap-2">
          {yearOptions.map(y => (
            <Link
              key={y}
              href={`/steuer?year=${y}`}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${y === year ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {/* Portfolio-KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardTitle className="min-h-10">Einnahmen {year}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-green-600 break-words">{euro(totalEinnahmen)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ausgaben {year}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 break-words">{euro(totalAusgaben)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Werbungskosten {year} (inkl. AfA)</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 break-words">{euro(totalWerbungskosten)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ergebnis {year} (Anlage V)</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-green-600 break-words">{euro(totalErgebnis)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Steuer-Export</CardTitle>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 mt-1">Keine Objekte</p>
          ) : (
            <div className="mt-1">
              <TaxExportButton rows={rows.map(r => r.taxRow)} filename={`steuer-export-portfolio-${year}.csv`} label="Portfolio (CSV)" />
            </div>
          )}
        </Card>
      </div>

      {/* 15%-Grenze Warnungen */}
      {relevantThresholds.length > 0 && (
        <Card className="bg-amber-50 border-amber-100">
          <CardTitle>15%-Hürde – Achtung bei {relevantThresholds.length} Objekt{relevantThresholds.length !== 1 ? 'en' : ''}</CardTitle>
          <div className="mt-2 space-y-1">
            {relevantThresholds.map(r => (
              <Link key={r.property.id} href={`/properties/${r.property.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span className="text-gray-700">{propertyLabel(r.property)}</span>
                <ThresholdBadge status={r.threshold} />
              </Link>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-2">
            Renovierungskosten innerhalb von 3 Jahren nach Kauf über 15% des Gebäudewerts müssen aktiviert statt sofort abgesetzt werden (§ 6 Abs. 1 Nr. 1a EStG).
          </p>
        </Card>
      )}

      {/* Pro Objekt */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Nach Objekt ({rows.length})</h2>
        {rows.length === 0 ? (
          <Card className="text-center py-12 text-gray-400">Noch keine <RoofedImmobilie suffix="n" /> hinterlegt.</Card>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <Card key={r.property.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <Link href={`/properties/${r.property.id}`} className="font-semibold text-gray-900 hover:text-blue-700 truncate block">
                      {propertyLabel(r.property)}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{r.receiptCount} Belege in {year}</p>
                  </div>
                  <ThresholdBadge status={r.threshold} />
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <span className="text-gray-500">Einnahmen: <strong className="text-green-600">{euro(r.taxRow.einnahmen)}</strong></span>
                  <span className="text-gray-500">Ausgaben: <strong className="text-red-500">{euro(r.yearExpenses)}</strong></span>
                  <span className="text-gray-500">Werbungskosten: <strong className="text-red-500">{euro(r.taxRow.werbungskosten_gesamt)}</strong></span>
                  <span className="text-gray-500">AfA: <strong className="text-blue-600">{euro(r.taxRow.afa)}</strong></span>
                  <span className="text-gray-500">Ergebnis: <strong className="text-green-600">{euro(r.taxRow.ergebnis)}</strong></span>
                </div>
                <div className="mt-3">
                  <TaxExportButton rows={[r.taxRow]} filename={`steuer-export-${r.property.address.replace(/\s+/g, '-')}-${year}.csv`} label="CSV-Export" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
