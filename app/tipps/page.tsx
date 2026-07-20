import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { TipsList } from '@/components/tipps/tips-list'
import { RiskOverview } from '@/components/tipps/risk-overview'
import { AskTips } from '@/components/tipps/ask-tips'
import { aggregatePortfolioFinancials, getLoanStatus } from '@/lib/amortization'
import { sumReserveCurrentValue, sumMonthlyReserveFromRent } from '@/lib/reserves'
import { sumInstandhaltungsruecklage } from '@/lib/operating-costs'
import { generateTips } from '@/lib/tips'
import { euro, propertyLabel } from '@/lib/format'
import {
  ASSET_CATEGORY_LABELS,
  Asset,
  AssetCategory,
  Loan,
  LoanSpecialPayment,
  OperatingCost,
  Property,
  PropertyReserve,
  Receipt,
  Reminder,
  RentAdjustment,
  RentalAgreement,
  Tenant,
} from '@/lib/types'

export default async function TippsPage() {
  await requireUser()
  const supabase = await createClient()

  const [
    { data: properties },
    { data: loans },
    { data: tenants },
    { data: rentalAgreements },
    { data: rentAdjustments },
    { data: receipts },
    { data: assetsData },
    { data: reservesData },
    { data: operatingCostsData },
    { data: remindersData },
  ] = await Promise.all([
    supabase.from('properties').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('receipts').select('*'),
    supabase.from('assets').select('*').order('created_at'),
    supabase.from('property_reserves').select('*').order('created_at'),
    supabase.from('operating_costs').select('*'),
    supabase.from('reminders').select('*'),
  ])

  const props = (properties ?? []) as Property[]
  const loanList = (loans ?? []) as Loan[]
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const recs = (receipts ?? []) as Receipt[]
  const assets = (assetsData ?? []) as Asset[]
  const reserveList = (reservesData ?? []) as PropertyReserve[]
  const operatingCostList = (operatingCostsData ?? []) as OperatingCost[]
  const reminderList = (remindersData ?? []) as Reminder[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const monthlyReserveFromRent = sumMonthlyReserveFromRent(reserveList)
  const totalReserves = sumReserveCurrentValue(reserveList) + sumInstandhaltungsruecklage(operatingCostList)

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, agreementList, adjustmentList, recs, monthlyReserveFromRent)

  const tips = generateTips({
    properties: props,
    loans: loanList,
    specialPaymentsByLoan,
    assets,
    reserves: reserveList,
    receipts: recs,
    reminders: reminderList,
    portfolio,
  })

  const propertyById = Object.fromEntries(props.map(p => [p.id, p]))
  const assetsByCategory = (Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[])
    .map(cat => ({ label: ASSET_CATEGORY_LABELS[cat], total: assets.filter(a => a.category === cat).reduce((s, a) => s + a.current_value, 0) }))
    .filter(c => c.total > 0)

  const context = buildContext()

  function buildContext(): string {
    const lines: string[] = []
    lines.push(`Nettovermögen-relevante Kennzahlen (Stand ${portfolio.as_of_date}):`)
    lines.push(`- Immobilienwert gesamt: ${euro(portfolio.total_property_value)}`)
    lines.push(`- Restschulden gesamt: ${euro(portfolio.total_debt)}`)
    lines.push(`- Eigenkapital: ${euro(portfolio.total_equity)}`)
    lines.push(`- Rücklagen gesamt: ${euro(totalReserves)}`)
    lines.push(`- Cashflow/Monat (nach Kredit, Kosten, Rücklagenbildung): ${euro(portfolio.monthly_net_cashflow)}`)
    lines.push(`- Miete/Monat: ${euro(portfolio.monthly_rent_income)}, Kreditraten/Monat: ${euro(portfolio.monthly_debt_service)}, Kosten-Laufrate/Monat: ${euro(portfolio.monthly_operating_cost_runrate)}`)
    lines.push('')
    lines.push(`Immobilien (${props.length}):`)
    for (const p of props) {
      lines.push(`- ${propertyLabel(p)}: Kaufpreis ${euro(p.purchase_price)}, aktueller Wert ${euro(p.current_value ?? p.purchase_price)}, Baujahr ${p.build_year}${p.risk_score != null ? `, Standortrisiko ${p.risk_score}/10` : ''}`)
    }
    lines.push('')
    lines.push(`Kredite (${loanList.length}):`)
    for (const l of loanList) {
      const status = getLoanStatus(l, specialPaymentsByLoan[l.id] ?? [])
      lines.push(`- ${l.name} (${propertyById[l.property_id] ? propertyLabel(propertyById[l.property_id]) : '?'}): Zins ${l.nominal_interest_rate}%, Restschuld ${euro(status.remaining_balance)}, Rate ${euro(status.current_annuity_amount)}/${l.payment_frequency}`)
    }
    lines.push('')
    lines.push('Sonstige Vermögenswerte:')
    for (const a of assetsByCategory) {
      lines.push(`- ${a.label}: ${euro(a.total)}`)
    }
    if (tips.length > 0) {
      lines.push('')
      lines.push('Bereits automatisch erkannte Auffälligkeiten:')
      for (const t of tips) lines.push(`- ${t.title}`)
    }
    return lines.join('\n')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tipps</h1>
        <p className="text-gray-500 text-sm mt-1">Was du anhand deiner Daten jetzt optimieren könntest, plus Standortrisiko je Immobilie. Marktnews findest du im Dashboard.</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Für dich erkannt</h2>
        <TipsList tips={tips} />
      </div>

      <AskTips context={context} />

      {props.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Standortrisiko je Immobilie</h2>
          <RiskOverview properties={props} />
        </div>
      )}
    </div>
  )
}
