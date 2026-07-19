import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { DebtOverTimeChart } from '@/components/charts/debt-over-time-chart'
import { DailyTilgungChart } from '@/components/charts/daily-tilgung-chart'
import { SondertilgungSimulator } from '@/components/finanzen/sondertilgung-simulator'
import { aggregatePortfolioFinancials, aggregateDebtOverTime, aggregateTodayCashflow, aggregateDailyRateOverTime, generateAmortizationSchedule, getLoanStatus, principalPaidInYear } from '@/lib/amortization'
import { totalEquityInvested, calcEquityBreakEven } from '@/lib/equity-breakeven'
import { aggregateNetWorth } from '@/lib/net-worth'
import { sumInstandhaltungsruecklage } from '@/lib/operating-costs'
import { sumReserveCurrentValue, sumMonthlyReserveFromRent } from '@/lib/reserves'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { ASSET_CATEGORY_LABELS, Asset, AssetCategory, Property, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, Receipt, PropertyReserve, OperatingCost, RESERVE_CATEGORY_LABELS } from '@/lib/types'

export default async function Finanzen() {
  await requireUser()
  const supabase = await createClient()

  const [{ data: properties }, { data: loans }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }, { data: receipts }, { data: assetsData }, { data: reservesData }, { data: operatingCostsData }] = await Promise.all([
    supabase.from('properties').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('receipts').select('*'),
    supabase.from('assets').select('*').order('created_at'),
    supabase.from('property_reserves').select('*').order('created_at'),
    supabase.from('operating_costs').select('*'),
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

  const { data: specialPayments } = loanList.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', loanList.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const specialPaymentsByLoan = loanList.reduce((acc, l) => {
    acc[l.id] = (specialPayments ?? []).filter(sp => sp.loan_id === l.id)
    return acc
  }, {} as Record<string, LoanSpecialPayment[]>)

  const monthlyReserveFromRent = sumMonthlyReserveFromRent(reserveList)
  const totalInstandhaltungsruecklage = sumInstandhaltungsruecklage(operatingCostList)
  const totalReserves = sumReserveCurrentValue(reserveList) + totalInstandhaltungsruecklage

  const portfolio = aggregatePortfolioFinancials(props, loanList, specialPaymentsByLoan, tenantList, agreementList, adjustmentList, recs, monthlyReserveFromRent)
  const debtOverTime = aggregateDebtOverTime(loanList, specialPaymentsByLoan)
  const todayCashflow = aggregateTodayCashflow(loanList, specialPaymentsByLoan, portfolio.monthly_rent_income, portfolio.monthly_operating_cost_runrate, monthlyReserveFromRent)
  const dailyRateOverTime = aggregateDailyRateOverTime(loanList, specialPaymentsByLoan)
  const netWorth = aggregateNetWorth(assets, portfolio.total_equity, totalReserves)

  const propertyById = Object.fromEntries(props.map(p => [p.id, p]))

  const reservesByProperty = props
    .map(p => ({
      property: p,
      items: reserveList.filter(r => r.property_id === p.id),
      ruecklage: sumInstandhaltungsruecklage(operatingCostList.filter(c => c.property_id === p.id)),
    }))
    .filter(r => r.items.length > 0 || r.ruecklage > 0)

  const assetsByCategory = (Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[])
    .map(cat => ({
      cat,
      label: ASSET_CATEGORY_LABELS[cat],
      items: assets.filter(a => a.category === cat),
      total: assets.filter(a => a.category === cat).reduce((s, a) => s + a.current_value, 0),
    }))
    .filter(c => c.items.length > 0)

  const totalPrincipalPaid = portfolio.loans.reduce((s, l) => s + l.cumulative_principal_paid, 0)

  const loanSchedules = loanList.map(l => ({
    loan: l,
    entries: generateAmortizationSchedule(l, specialPaymentsByLoan[l.id] ?? []).entries,
  }))
  const payoffOverview = loanList
    .map(l => {
      const schedule = generateAmortizationSchedule(l, specialPaymentsByLoan[l.id] ?? [])
      return { loan: l, payoffDate: schedule.payoff_date }
    })
    .sort((a, b) => (a.payoffDate ?? '9999').localeCompare(b.payoffDate ?? '9999'))

  const thisYear = new Date().getFullYear()
  const principalThisYear = loanSchedules.reduce((s, { entries }) => s + principalPaidInYear(entries, thisYear), 0)
  const principalNextYear = loanSchedules.reduce((s, { entries }) => s + principalPaidInYear(entries, thisYear + 1), 0)

  const agreementsByTenant = agreementList.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = adjustmentList.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)

  const equityInvested = totalEquityInvested(props, loanList)
  const breakEven = calcEquityBreakEven(
    props,
    loanSchedules,
    tenantList,
    agreementsByTenant,
    adjustmentsByTenant,
    portfolio.monthly_operating_cost_runrate,
    monthlyReserveFromRent,
    equityInvested
  )

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
          {netWorth.total_reserves > 0 && <> + Rücklagen {euro(netWorth.total_reserves)}</>}
          {netWorth.monthly_savings_rate > 0 && <> · {euro(netWorth.monthly_savings_rate)} Sparrate/Monat</>}
        </p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardTitle className="min-h-10">Immobilienwert</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{euro(portfolio.total_property_value)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Gesamtschulden</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 break-words">{euro(portfolio.total_debt)}</p>
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

      <Card>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-2">
          <span className="text-gray-500">Miete / Monat: <strong className="text-green-600">{euro(portfolio.monthly_rent_income)}</strong></span>
          <span className="text-gray-500">Kreditrate / Monat: <strong className="text-gray-900">{euro(portfolio.monthly_debt_service)}</strong></span>
          <span className="text-gray-500">Kosten-Laufrate / Monat: <strong className="text-red-500">{euro(portfolio.monthly_operating_cost_runrate)}</strong></span>
          {monthlyReserveFromRent > 0 && (
            <span className="text-gray-500">Rücklagenbildung / Monat: <strong className="text-red-500">{euro(monthlyReserveFromRent)}</strong></span>
          )}
        </div>
        <p className="text-xs text-gray-400">Kosten-Laufrate = Belege der letzten 12 Monate / 12 (statt Einzelmonat, wegen unregelmäßiger Kosten wie Versicherung). AfA ist nicht enthalten, da nicht zahlungswirksam.</p>
      </Card>

      {loanList.length > 0 && (
        <Card className="bg-green-50 border-green-100">
          <CardTitle>Tilgung im Überblick</CardTitle>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700 list-disc list-inside">
            <li>Deine Mieter haben dir heute <strong className="text-green-700">{euro(todayCashflow.daily_principal_total)}</strong> getilgt</li>
            <li>Deine Gesamttilgung über alle Kredite steht jetzt bei <strong className="text-green-700">{euro(totalPrincipalPaid)}</strong></li>
            <li>Deine Mieter werden dir {thisYear} insgesamt <strong className="text-green-700">{euro(principalThisYear)}</strong> tilgen</li>
            <li>{thisYear + 1} werden es voraussichtlich <strong className="text-green-700">{euro(principalNextYear)}</strong> sein (angenommen keine Mietausfälle, Kündigungen oder Mieterhöhungen)</li>
          </ul>
        </Card>
      )}

      {loanList.length > 0 && (
        <Card className="bg-blue-50 border-blue-100">
          <CardTitle>Meilensteine</CardTitle>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700 list-disc list-inside">
            {breakEven.break_even_date && (
              <li>
                {breakEven.already_reached ? (
                  <>Du hast deinen Break-even für dein bisher eingesetztes Eigenkapital (<strong className="text-blue-700">{euro(breakEven.equity_invested)}</strong>) bereits am <strong className="text-blue-700">{formatDate(breakEven.break_even_date)}</strong> erreicht</>
                ) : (
                  <>An Tag <strong className="text-blue-700">{formatDate(breakEven.break_even_date)}</strong> wirst du deinen Break-even für dein bisher eingesetztes Eigenkapital (<strong className="text-blue-700">{euro(breakEven.equity_invested)}</strong>) erreicht haben</>
                )}
              </li>
            )}
            <li>Wären deine Immobilien fiktiv heute abbezahlt, bekämst du eine zu versteuernde Sofortrente von <strong className="text-blue-700">{euro(portfolio.monthly_rent_income)}</strong> / Monat</li>
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            Break-even = kumulierter Cashflow (Miete abzüglich Zinsen, Tilgung, Kosten-Laufrate und Rücklagenbildung) seit dem frühesten Kaufdatum, verglichen mit dem eingesetzten Eigenkapital (Kaufpreis + Kaufnebenkosten abzüglich Kreditsumme je Objekt). Kosten-/Rücklagen-Laufrate werden dabei vereinfacht als konstant über die Zeit angenommen.
          </p>
        </Card>
      )}

      {loanList.length > 0 && (
        <Card>
          <CardTitle>Stand heute ({formatDate(todayCashflow.as_of_date)})</CardTitle>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Miete bisher diesen Monat</span>
              <strong className="text-green-600">+{euro(todayCashflow.rent_so_far)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">./. Zinsen (bisher, tagesgenau)</span>
              <strong className="text-gray-900">-{euro(todayCashflow.interest_so_far)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">./. Tilgung (bisher, tagesgenau)</span>
              <strong className="text-gray-900">-{euro(todayCashflow.principal_so_far)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">./. Betriebskosten (anteilig)</span>
              <strong className="text-gray-900">-{euro(todayCashflow.operating_cost_so_far)}</strong>
            </div>
            {todayCashflow.reserve_so_far > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">./. Rücklagenbildung aus Kaltmiete (anteilig)</span>
                <strong className="text-gray-900">-{euro(todayCashflow.reserve_so_far)}</strong>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-gray-700 font-medium">= übrig bisher diesen Monat</span>
              <strong className={todayCashflow.remaining_so_far >= 0 ? 'text-green-600' : 'text-red-500'}>{euro(todayCashflow.remaining_so_far)}</strong>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Tagessatz = aktuelle Monatsrate der laufenden Kreditperiode / Tage im Zeitraum, hochgerechnet auf die bereits vergangenen Tage des Monats.
            Betriebskosten als Kosten-Laufrate (siehe oben) – sobald Nebenkosten je Objekt gepflegt sind, fließen sie hier künftig genauer ein.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Gesamtschulden-Verlauf (alle Kredite)</CardTitle>
        <DebtOverTimeChart data={debtOverTime} />
      </Card>

      {loanList.length > 0 && (
        <Card>
          <CardTitle>Tägliche Tilgung & Zinsen – Entwicklung</CardTitle>
          <DailyTilgungChart data={dailyRateOverTime} />
          <p className="text-xs text-gray-400 mt-2">
            Bei fester Annuität sinkt der Zinsanteil pro Tag über die Zeit, während die Tilgung pro Tag entsprechend wächst.
          </p>
        </Card>
      )}

      {/* Rücklagen-Übersicht */}
      {reservesByProperty.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Rücklagen ({euro(totalReserves)})</h2>
          </div>
          <div className="space-y-2">
            {reservesByProperty.map(({ property: p, items, ruecklage }) => (
              <Card key={p.id}>
                <Link href={`/properties/${p.id}`} className="text-sm font-semibold text-gray-800 hover:text-blue-700 block mb-2">
                  {propertyLabel(p)}
                </Link>
                <div className="space-y-1.5">
                  {ruecklage > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Instandhaltungsrücklage (kumuliert)</span>
                      <span>{euro(ruecklage)}</span>
                    </div>
                  )}
                  {items.map(r => (
                    <div key={r.id} className="flex justify-between text-sm text-gray-600">
                      <span>
                        {RESERVE_CATEGORY_LABELS[r.category]}{r.name ? ` · ${r.name}` : ''}
                        {r.funded_from_rent && <span className="text-xs text-amber-700"> (aus Kaltmiete)</span>}
                      </span>
                      <span>{euro(r.current_value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Wird wie Vermögen behandelt (fließt ins Nettovermögen oben ein), aber gesondert ausgewiesen – erfasst/bearbeitet wird pro Objekt.
          </p>
        </div>
      )}

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

      {/* Abzahlungs-Übersicht */}
      {payoffOverview.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Abzahlungs-Übersicht</h2>
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
