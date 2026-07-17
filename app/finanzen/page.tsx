import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { DebtOverTimeChart } from '@/components/charts/debt-over-time-chart'
import { aggregatePortfolioFinancials, aggregateDebtOverTime, getLoanStatus } from '@/lib/amortization'
import { euro, propertyLabel } from '@/lib/format'
import { Property, Loan, LoanSpecialPayment, Tenant, Receipt } from '@/lib/types'

export default async function Finanzen() {
  await requireUser()
  const supabase = await createClient()

  const [{ data: properties }, { data: loans }, { data: tenants }, { data: receipts }] = await Promise.all([
    supabase.from('properties').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('receipts').select('*'),
  ])

  const props = (properties ?? []) as Property[]
  const loanList = (loans ?? []) as Loan[]
  const tenantList = (tenants ?? []) as Tenant[]
  const recs = (receipts ?? []) as Receipt[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, recs)
  const debtOverTime = aggregateDebtOverTime(loanList, specialPaymentsByLoan)

  const propertyById = Object.fromEntries(props.map(p => [p.id, p]))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzen</h1>
        <p className="text-gray-500 text-sm mt-1">Portfolio-Übersicht über alle Immobilien und Kredite</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardTitle>Immobilienwert</CardTitle>
          <p className="text-2xl font-bold text-gray-900">{euro(portfolio.total_property_value)}</p>
        </Card>
        <Card>
          <CardTitle>Gesamtschulden</CardTitle>
          <p className="text-2xl font-bold text-red-500">{euro(portfolio.total_debt)}</p>
        </Card>
        <Card>
          <CardTitle>Eigenkapital</CardTitle>
          <p className="text-2xl font-bold text-blue-600">{euro(portfolio.total_equity)}</p>
        </Card>
        <Card>
          <CardTitle>Cashflow / Monat</CardTitle>
          <p className={`text-2xl font-bold ${portfolio.monthly_net_cashflow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Kredite ({loanList.length})</h2>
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
