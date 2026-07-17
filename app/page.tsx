import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { NewsFeed } from '@/components/news-feed'
import { RemindersWidget } from '@/components/reminders/reminders-widget'
import { PropertyList } from '@/components/properties/property-list'
import { calcAnnualAfa } from '@/lib/afa'
import { aggregatePortfolioFinancials } from '@/lib/amortization'
import { getLandlordNews } from '@/lib/news'
import { euro } from '@/lib/format'
import { Property, Receipt, Loan, LoanSpecialPayment, Tenant, Reminder } from '@/lib/types'

export default async function Dashboard() {
  await requireUser()
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [{ data: properties }, { data: receipts }, { data: income }, { data: loans }, { data: tenants }, { data: reminders }, news] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase.from('receipts').select('*'),
    supabase.from('income_records').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('reminders').select('*').neq('status', 'erledigt'),
    getLandlordNews(),
  ])

  const props = (properties ?? []) as Property[]
  const recs = (receipts ?? []) as Receipt[]
  const inc = (income ?? []) as { property_id: string; amount: number; date: string }[]
  const loanList = (loans ?? []) as Loan[]
  const tenantList = (tenants ?? []) as Tenant[]
  const reminderList = (reminders ?? []) as Reminder[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, recs)

  const totalAfa = props.reduce((s, p) => s + calcAnnualAfa(p), 0)
  const totalIncome = inc
    .filter(i => new Date(i.date).getFullYear() === currentYear)
    .reduce((s, i) => s + i.amount, 0)
  const totalExpenses = recs
    .filter(r => r.tax_year === currentYear)
    .reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Steuerjahr {currentYear}</p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardTitle>Immobilien</CardTitle>
          <p className="text-3xl font-bold text-gray-900">{props.length}</p>
        </Card>
        <Card>
          <CardTitle>Einnahmen {currentYear}</CardTitle>
          <p className="text-3xl font-bold text-green-600">{euro(totalIncome)}</p>
        </Card>
        <Card>
          <CardTitle>Ausgaben {currentYear}</CardTitle>
          <p className="text-3xl font-bold text-red-500">{euro(totalExpenses)}</p>
        </Card>
        <Card>
          <CardTitle>AfA gesamt / Jahr</CardTitle>
          <p className="text-3xl font-bold text-blue-600">{euro(totalAfa)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hauptspalte */}
        <div className="lg:col-span-2 space-y-8">
          <RemindersWidget reminders={reminderList} properties={props} />

          {/* Finanz-Cockpit */}
          {loanList.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Finanz-Cockpit</h2>
                <Link href="/finanzen" className="text-sm text-blue-600 hover:underline">Portfolio-Übersicht →</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardTitle>Gesamtschulden</CardTitle>
                  <p className="text-2xl font-bold text-red-500">{euro(portfolio.total_debt)}</p>
                </Card>
                <Card>
                  <CardTitle>Kreditrate / Monat</CardTitle>
                  <p className="text-2xl font-bold text-gray-900">{euro(portfolio.monthly_debt_service)}</p>
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
            </div>
          )}

          {/* Immobilien-Liste */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Meine Immobilien</h2>
              <Link href="/properties" className="text-sm text-blue-600 hover:underline">Alle anzeigen →</Link>
            </div>
            <PropertyList properties={props} receipts={recs} income={inc} currentYear={currentYear} />
          </div>

          {/* Quick Action */}
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">Beleg erfassen</p>
                <p className="text-sm text-blue-700 mt-0.5">Foto machen oder Datei hochladen – KI kategorisiert automatisch</p>
              </div>
              <Link href="/receipts/new" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap">
                Jetzt erfassen
              </Link>
            </div>
          </Card>
        </div>

        {/* Seitenspalte */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <NewsFeed items={news} />
          </div>
        </div>
      </div>
    </div>
  )
}
