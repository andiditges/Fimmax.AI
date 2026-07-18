import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { NewsFeed } from '@/components/news-feed'
import { RemindersWidget } from '@/components/reminders/reminders-widget'
import { PropertyList } from '@/components/properties/property-list'
import { calcAnnualAfa } from '@/lib/afa'
import { aggregatePortfolioFinancials } from '@/lib/amortization'
import { sumRentForYear } from '@/lib/rent-schedule'
import { getLandlordNews } from '@/lib/news'
import { euro } from '@/lib/format'
import { Property, Receipt, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, Reminder } from '@/lib/types'

export default async function Dashboard() {
  await requireUser()
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [{ data: properties }, { data: receipts }, { data: loans }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }, { data: reminders }, news] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase.from('receipts').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('reminders').select('*').neq('status', 'erledigt'),
    getLandlordNews(),
  ])

  const props = (properties ?? []) as Property[]
  const recs = (receipts ?? []) as Receipt[]
  const loanList = (loans ?? []) as Loan[]
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const reminderList = (reminders ?? []) as Reminder[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, agreementList, adjustmentList, recs)

  const agreementsByTenant = agreementList.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = adjustmentList.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)

  const totalAfa = props.reduce((s, p) => s + calcAnnualAfa(p), 0)
  const totalIncome = sumRentForYear(tenantList, agreementsByTenant, adjustmentsByTenant, currentYear)
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
          <CardTitle className="min-h-10">Immobilien</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 break-words">{props.length}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Einnahmen {currentYear}</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-green-600 break-words">{euro(totalIncome)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ausgaben {currentYear}</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-red-500 break-words">{euro(totalExpenses)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">AfA gesamt / Jahr</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-blue-600 break-words">{euro(totalAfa)}</p>
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
                  <CardTitle className="min-h-10">Gesamtschulden</CardTitle>
                  <p className="text-lg md:text-2xl font-bold text-red-500 break-words">{euro(portfolio.total_debt)}</p>
                </Card>
                <Card>
                  <CardTitle className="min-h-10">Kreditrate / Monat</CardTitle>
                  <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{euro(portfolio.monthly_debt_service)}</p>
                </Card>
                <Card>
                  <CardTitle className="min-h-10">Eigenkapital</CardTitle>
                  <p className="text-lg md:text-2xl font-bold text-blue-600 break-words">{euro(portfolio.total_equity)}</p>
                </Card>
                <Card>
                  <CardTitle className="min-h-10">Cashflow / Monat</CardTitle>
                  <p className={`text-lg md:text-2xl font-bold break-words ${portfolio.monthly_net_cashflow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
            <PropertyList properties={props} receipts={recs} tenants={tenantList} rentalAgreements={agreementList} rentAdjustments={adjustmentList} currentYear={currentYear} />
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
