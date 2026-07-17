import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { DebtOverTimeChart } from '@/components/charts/debt-over-time-chart'
import { SondertilgungSimulator } from '@/components/finanzen/sondertilgung-simulator'
import { aggregatePortfolioFinancials, aggregateDebtOverTime, generateAmortizationSchedule, getLoanStatus } from '@/lib/amortization'
import { aggregateNetWorth } from '@/lib/net-worth'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { ASSET_CATEGORY_LABELS, Asset, AssetCategory, Property, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, Receipt } from '@/lib/types'

export default async function Finanzen() {
  await requireUser()
  const supabase = await createClient()

  const [{ data: properties }, { data: loans }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }, { data: receipts }, { data: assetsData }] = await Promise.all([
    supabase.from('properties').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('receipts').select('*'),
    supabase.from('assets').select('*').order('created_at'),
  ])

  const props = (properties ?? []) as Property[]
  const loanList = (loans ?? []) as Loan[]
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const recs = (receipts ?? []) as Receipt[]
  const assets = (assetsData ?? []) as Asset[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, agreementList, adjustmentList, recs)
  const debtOverTime = aggregateDebtOverTime(loanList, specialPaymentsByLoan)
  const netWorth = aggregateNetWorth(assets, portfolio.total_equity)

  const propertyById = Object.fromEntries(props.map(p => [p.id, p]))

  const assetsByCategory = (Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[])
    .map(cat => ({
      cat,
      label: ASSET_CATEGORY_LABELS[cat],
      items: assets.filter(a => a.category === cat),
      total: assets.filter(a => a.category === cat).reduce((s, a) => s + a.current_value, 0),
    }))
    .filter(c => c.items.length > 0)

  const payoffOverview = loanList
    .map(l => {
      const schedule = generateAmortizationSchedule(l, specialPaymentsByLoan[l.id] ?? [])
      return { loan: l, payoffDate: schedule.payoff_date }
    })
    .sort((a, b) => (a.payoffDate ?? '9999').localeCompare(b.payoffDate ?? '9999'))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzen</h1>
        <p className="text-gray-500 text-sm mt-1">Portfolio-Übersicht über alle Immobilien und Kredite</p>
      </div>

      <Card className="bg-blue-50 border-blue-100">
        <CardTitle>Nettovermögen</CardTitle>
        <p className="text-xl md:text-3xl font-bold text-blue-700 break-words">{euro(netWorth.net_worth)}</p>
        <p className="text-sm text-gray-500 mt-1">
          Immobilien-Eigenkapital {euro(netWorth.total_property_equity)} + sonstige Anlagen {euro(netWorth.total_assets)}
          {netWorth.monthly_savings_rate > 0 && <> · {euro(netWorth.monthly_savings_rate)} Sparrate/Monat</>}
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardTitle>Immobilienwert</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{euro(portfolio.total_property_value)}</p>
        </Card>
        <Card>
          <CardTitle>Gesamtschulden</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 break-words">{euro(portfolio.total_debt)}</p>
        </Card>
        <Card>
          <CardTitle>Eigenkapital</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-blue-600 break-words">{euro(portfolio.total_equity)}</p>
        </Card>
        <Card>
          <CardTitle>Cashflow / Monat</CardTitle>
          <p className={`text-lg md:text-2xl font-bold break-words ${portfolio.monthly_net_cashflow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {euro(portfolio.monthly_net_cashflow)}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Miete / Monat: <strong className="text-green-600">{euro(portfolio.monthly_rent_income)}</strong></span>
          <span className="text-gray-500">Kreditrate / Monat: <strong className="text-gray-900">{euro(portfolio.monthly_debt_service)}</strong></span>
          <span className="text-gray-500">Kosten-Laufrate / Monat: <strong className="text-red-500">{euro(portfolio.monthly_operating_cost_runrate)}</strong></span>
        </div>
        <p className="text-xs text-gray-400">Kosten-Laufrate = Belege der letzten 12 Monate / 12 (statt Einzelmonat, wegen unregelmäßiger Kosten wie Versicherung). AfA ist nicht enthalten, da nicht zahlungswirksam.</p>
      </Card>

      <Card>
        <CardTitle>Gesamtschulden-Verlauf (alle Kredite)</CardTitle>
        <DebtOverTimeChart data={debtOverTime} />
      </Card>

      {/* Vermögensübersicht */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Vermögensübersicht ({assets.length})</h2>
          <Link href="/assets/new" className="text-sm text-blue-600 hover:underline">+ Vermögenswert erfassen</Link>
        </div>
        {assetsByCategory.length === 0 ? (
          <Card className="text-center py-8 text-gray-400">
            Noch keine sonstigen Vermögenswerte (Wertpapiere, Tagesgeld, Bausparvertrag, …) hinterlegt.
          </Card>
        ) : (
          <div className="space-y-4">
            {assetsByCategory.map(c => (
              <Card key={c.cat}>
                <div className="flex justify-between text-sm font-semibold text-gray-800 mb-2">
                  <span>{c.label}</span>
                  <span>{euro(c.total)}</span>
                </div>
                <div className="space-y-1.5">
                  {c.items.map(a => (
                    <Link key={a.id} href={`/assets/${a.id}/edit`} className="flex justify-between text-sm text-gray-600 hover:text-blue-700">
                      <span>{a.name}{a.institution ? ` · ${a.institution}` : ''}</span>
                      <span>{euro(a.current_value)}</span>
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Abzahl-Übersicht */}
      {payoffOverview.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Abzahl-Übersicht</h2>
          <Card>
            <div className="space-y-2">
              {payoffOverview.map(({ loan, payoffDate }) => (
                <div key={loan.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {loan.name} · {propertyById[loan.property_id] ? propertyLabel(propertyById[loan.property_id]) : ''}
                  </span>
                  <strong className="text-gray-900 whitespace-nowrap">{payoffDate ? formatDate(payoffDate) : 'unbekannt'}</strong>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Sondertilgungs-Simulator */}
      <SondertilgungSimulator loans={loanList} specialPaymentsByLoan={specialPaymentsByLoan} properties={props} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Kredite ({loanList.length})</h2>
          <Link href="/loans/new" className="text-sm text-blue-600 hover:underline">+ Kredit erfassen</Link>
        </div>
        {loanList.length === 0 ? (
          <Card className="text-center py-12 text-gray-400">
            <p className="mb-4">Noch keine Kredite hinterlegt.</p>
            <Link href="/loans/new" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              Ersten Kredit anlegen
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {loanList.map(l => {
              const status = getLoanStatus(l, specialPaymentsByLoan[l.id] ?? [])
              return (
                <Link key={l.id} href={`/loans/${l.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{l.name}</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {propertyById[l.property_id] ? propertyLabel(propertyById[l.property_id]) : ''} · {l.nominal_interest_rate}% · {euro(status.current_annuity_amount)} / {l.payment_frequency}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 whitespace-nowrap">{euro(status.remaining_balance)}</span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
