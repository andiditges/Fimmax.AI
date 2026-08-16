import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { NewsFeedAsync } from '@/components/news-feed-async'
import { RemindersWidget } from '@/components/reminders/reminders-widget'
import { PropertyList } from '@/components/properties/property-list'
import { Rentenuhr } from '@/components/dashboard/rentenuhr'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { PrivacyModeToggle } from '@/components/privacy/privacy-mode-toggle'
import { SensitiveEuro } from '@/components/privacy/sensitive'
import { calcAnnualAfa } from '@/lib/afa'
import { aggregatePortfolioFinancials, aggregateLoanChains, totalDailyPrincipal } from '@/lib/amortization'
import { sumRentForYear } from '@/lib/rent-schedule'
import { sumMonthlyReserveFromRent, sumReserveCurrentValue } from '@/lib/reserves'
import { sumInstandhaltungsruecklage } from '@/lib/operating-costs'
import { aggregateNetWorth } from '@/lib/net-worth'
import { Property, Receipt, ReceiptItem, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, Reminder, PropertyReserve, Asset, OperatingCost } from '@/lib/types'

export default async function Dashboard() {
  await requireUser()
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [{ data: properties }, { data: receipts }, { data: receiptItems }, { data: loans }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }, { data: reminders }, { data: reserves }, { data: assetsData }, { data: operatingCostsData }] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase.from('receipts').select('*'),
    supabase.from('receipt_items').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('reminders').select('*').neq('status', 'erledigt'),
    supabase.from('property_reserves').select('*'),
    supabase.from('assets').select('*'),
    supabase.from('operating_costs').select('*'),
  ])

  const props = (properties ?? []) as Property[]
  const recs = (receipts ?? []) as Receipt[]
  const recItems = (receiptItems ?? []) as ReceiptItem[]
  const loanList = (loans ?? []) as Loan[]
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const reminderList = (reminders ?? []) as Reminder[]
  const reserveList = (reserves ?? []) as PropertyReserve[]
  const assets = (assetsData ?? []) as Asset[]
  const operatingCostList = (operatingCostsData ?? []) as OperatingCost[]

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, agreementList, adjustmentList, recs, recItems, sumMonthlyReserveFromRent(reserveList))
  // Kettenbasiert statt portfolio.loans.reduce(cumulative_principal_paid), damit
  // eine Anschlussfinanzierung die Rentenuhr nicht schlagartig zurückspringen lässt.
  const totalPrincipalPaid = aggregateLoanChains(loanList, specialPaymentsByLoan).reduce((s, c) => s + c.paid, 0)
  const dailyPrincipalRate = totalDailyPrincipal(loanList, specialPaymentsByLoan)
  const rentenuhrAsOf = new Date().toISOString()
  const totalReserves = sumReserveCurrentValue(reserveList) + sumInstandhaltungsruecklage(operatingCostList)
  const netWorth = aggregateNetWorth(assets, portfolio.total_equity, totalReserves)

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Steuerjahr {currentYear}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <PrivacyModeToggle />
          <ThemeToggle />
        </div>
      </div>

      {loanList.length > 0 && (
        <Rentenuhr
          initialDebt={portfolio.total_debt}
          initialPaid={totalPrincipalPaid}
          dailyPrincipalRate={dailyPrincipalRate}
          asOf={rentenuhrAsOf}
          netWorth={netWorth.net_worth}
        />
      )}

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardTitle className="min-h-10">Immobilien</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 break-words">{props.length}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Einnahmen {currentYear}</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-500 break-words"><SensitiveEuro seed="dashboard-income" amount={totalIncome} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ausgaben {currentYear}</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-red-500 dark:text-red-400 break-words"><SensitiveEuro seed="dashboard-expenses" amount={totalExpenses} /></p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">AfA gesamt / Jahr</CardTitle>
          <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 break-words"><SensitiveEuro seed="dashboard-afa" amount={totalAfa} /></p>
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
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Finanz-Cockpit</h2>
                <Link href="/finanzen" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Portfolio-Übersicht →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/finanzen#kredite">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardTitle className="min-h-10">Verbindlichkeiten (aktuell)</CardTitle>
                    <p className="text-lg md:text-2xl font-bold text-red-500 dark:text-red-400 break-words"><SensitiveEuro seed="dashboard-debt" amount={portfolio.total_debt} /></p>
                  </Card>
                </Link>
                <Card>
                  <CardTitle className="min-h-10">Kreditrate / Monat</CardTitle>
                  <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words"><SensitiveEuro seed="dashboard-debt-service" amount={portfolio.monthly_debt_service} /></p>
                </Card>
                <Card>
                  <CardTitle className="min-h-10">Eigenkapital</CardTitle>
                  <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400 break-words"><SensitiveEuro seed="dashboard-equity" amount={portfolio.total_equity} /></p>
                </Card>
                <Card>
                  <CardTitle className="min-h-10">Cashflow / Monat</CardTitle>
                  <p className={`text-lg md:text-2xl font-bold break-words ${portfolio.monthly_net_cashflow >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400'}`}>
                    <SensitiveEuro seed="dashboard-cashflow" amount={portfolio.monthly_net_cashflow} />
                  </p>
                </Card>
              </div>
            </div>
          )}

          {/* Immobilien-Liste */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Meine Immobilien</h2>
              <Link href="/properties" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Alle anzeigen →</Link>
            </div>
            <PropertyList properties={props} receipts={recs} receiptItems={recItems} tenants={tenantList} rentalAgreements={agreementList} rentAdjustments={adjustmentList} currentYear={currentYear} />
          </div>

          {/* Quick Action */}
          <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-200">Beleg erfassen</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">Foto machen oder Datei hochladen – KI kategorisiert automatisch</p>
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
            <NewsFeedAsync />
          </div>
        </div>
      </div>
    </div>
  )
}
