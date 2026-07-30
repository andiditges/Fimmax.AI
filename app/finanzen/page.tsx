import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { Ring, TilgungRing, LtvRing, ltvColor } from '@/components/properties/tilgung-ring'
import { DebtOverTimeChart } from '@/components/charts/debt-over-time-chart'
import { CapexChart } from '@/components/charts/capex-chart'
import { DailyTilgungChart } from '@/components/charts/daily-tilgung-chart'
import { SondertilgungSimulator } from '@/components/finanzen/sondertilgung-simulator'
import { FreedomCountdown } from '@/components/finanzen/freedom-countdown'
import { aggregatePortfolioFinancials, aggregateDebtOverTime, aggregateTodayCashflow, aggregateDailyRateOverTime, generateAmortizationSchedule, getLoanStatus, principalPaidInYear, getNextPeriodDailyRateBreakdown, getMonthlyPrincipalAt, iso } from '@/lib/amortization'
import { totalEquityInvested, calcEquityBreakEven } from '@/lib/equity-breakeven'
import { aggregateNetWorth, projectedAssetValue } from '@/lib/net-worth'
import { sumInstandhaltungsruecklage } from '@/lib/operating-costs'
import { sumReserveCurrentValue, sumMonthlyReserveFromRent } from '@/lib/reserves'
import { currentAgreement } from '@/lib/rent-schedule'
import { latestVpiReading, calcIndexmieteStatus } from '@/lib/vpi'
import { euro, formatDate, propertyLabel, propertyValue, percent } from '@/lib/format'
import { ASSET_CATEGORY_LABELS, Asset, AssetCategory, Property, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, Receipt, PropertyReserve, OperatingCost, RESERVE_CATEGORY_LABELS, VpiReading } from '@/lib/types'

export default async function Finanzen() {
  await requireUser()
  const supabase = await createClient()

  const [{ data: properties }, { data: loans }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }, { data: receipts }, { data: assetsData }, { data: reservesData }, { data: operatingCostsData }, { data: vpiReadingsData }] = await Promise.all([
    supabase.from('properties').select('*'),
    supabase.from('loans').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
    supabase.from('receipts').select('*'),
    supabase.from('assets').select('*').order('created_at'),
    supabase.from('property_reserves').select('*').order('created_at'),
    supabase.from('operating_costs').select('*'),
    supabase.from('vpi_readings').select('*'),
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
  const vpiReadingList = (vpiReadingsData ?? []) as VpiReading[]

  // CapEx-Trend: Renovierungs-/Sanierungsbelege (is_renovation) über alle
  // Objekte hinweg, je Steuerjahr summiert - zeigt auf einen Blick, wie viel
  // über die Jahre insgesamt investiert wurde, statt es sich aus den
  // einzelnen Objekt-Belegsituationen zusammensuchen zu müssen.
  const capexByYear = recs
    .filter(r => r.is_renovation)
    .reduce((acc, r) => {
      acc[r.tax_year] = (acc[r.tax_year] ?? 0) + r.amount
      return acc
    }, {} as Record<number, number>)
  const capexData = Object.entries(capexByYear)
    .map(([year, amount]) => ({ year: parseInt(year), amount }))
    .sort((a, b) => a.year - b.year)
  const totalCapex = capexData.reduce((s, d) => s + d.amount, 0)

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

  // Tilgung & LTV je Immobilie (statt nur als Portfolio-Gesamtwert oben) -
  // damit auf einen Blick sichtbar ist, welche Objekte am weitesten getilgt
  // bzw. am höchsten beliehen sind, ohne jede Objektseite einzeln zu öffnen.
  const propertyFinance = props
    .map(p => {
      // Noch nicht ausgezahlte Kredite (z.B. eine geplante Anschlussfinanzierung)
      // zählen hier bewusst nicht mit - sonst würde ihr voller principal die
      // Tilgungs-/LTV-Quote verfälschen, obwohl noch keine Schuld besteht.
      const pLoans = loanList.filter(l => l.property_id === p.id && new Date(l.disbursement_date) <= new Date())
      if (pLoans.length === 0) return null
      const principal = pLoans.reduce((s, l) => s + l.principal, 0)
      const remaining = pLoans.reduce((s, l) => s + getLoanStatus(l, specialPaymentsByLoan[l.id] ?? []).remaining_balance, 0)
      const value = propertyValue(p)
      return {
        property: p,
        principal,
        remaining,
        value,
        tilgungPercent: principal > 0 ? ((principal - remaining) / principal) * 100 : 0,
        ltvPercent: value > 0 ? (remaining / value) * 100 : 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

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
      total: assets.filter(a => a.category === cat).reduce((s, a) => s + projectedAssetValue(a), 0),
    }))
    .filter(c => c.items.length > 0)

  const totalPrincipalPaid = portfolio.loans.reduce((s, l) => s + l.cumulative_principal_paid, 0)
  const totalSondertilgungenPaid = (specialPayments ?? [])
    .filter(sp => sp.payment_date <= iso(new Date()))
    .reduce((s, sp) => s + sp.amount, 0)

  const loanSchedules = loanList.map(l => {
    const schedule = generateAmortizationSchedule(l, specialPaymentsByLoan[l.id] ?? [])
    return { loan: l, entries: schedule.entries, payoffDate: schedule.payoff_date, balanceAtFixedPeriodEnd: schedule.balance_at_fixed_period_end }
  })
  const payoffOverview = loanSchedules
    .map(({ loan, payoffDate }) => ({ loan, payoffDate }))
    .sort((a, b) => (a.payoffDate ?? '9999').localeCompare(b.payoffDate ?? '9999'))

  // Zinsbindungs-Übersicht: über alle Kredite hinweg, statt nur einzeln je
  // Kredit-Detailseite sichtbar - damit Anschlussfinanzierungs-Planung nicht
  // im Klein-Klein der einzelnen Kredite untergeht.
  const zinsbindungOverview = loanSchedules
    .filter((s): s is typeof s & { loan: Loan & { initial_fixed_period_years: number } } => s.loan.initial_fixed_period_years != null)
    .map(({ loan, balanceAtFixedPeriodEnd }) => {
      const end = new Date(loan.disbursement_date)
      end.setFullYear(end.getFullYear() + loan.initial_fixed_period_years)
      return { loan, endDate: iso(end), remainingBalance: balanceAtFixedPeriodEnd }
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate))

  const thisYear = new Date().getFullYear()
  const principalLastYear = loanSchedules.reduce((s, { entries }) => s + principalPaidInYear(entries, thisYear - 1), 0)
  const principalThisYear = loanSchedules.reduce((s, { entries }) => s + principalPaidInYear(entries, thisYear), 0)
  const principalNextYear = loanSchedules.reduce((s, { entries }) => s + principalPaidInYear(entries, thisYear + 1), 0)

  // Rechnerisches Sondertilgungspotential: monatliche Mehreinnahme aller
  // Indexmiete-Mietverhältnisse, die bis zum 1.1. des Folgejahres nach §
  // 557b BGB erhöhungsberechtigt sein werden (auf Basis des zuletzt
  // erfassten VPI-Werts, da ein künftiger Indexstand nicht bekannt ist),
  // hochgerechnet auf 12 Monate ab einer angenommenen Erhöhung im Januar.
  const latestReading = latestVpiReading(vpiReadingList)
  const nextJan1 = new Date(thisYear + 1, 0, 1)
  const indexRentIncreasePotential = latestReading
    ? tenantList.reduce((sum, t) => {
        const active = currentAgreement(agreementList.filter(a => a.tenant_id === t.id))
        if (!active || !active.is_index_rent) return sum
        const status = calcIndexmieteStatus(active, latestReading, nextJan1)
        if (!status || !status.eligible) return sum
        return sum + (status.possible_new_rent - status.current_rent) * 12
      }, 0)
    : 0

  const now = new Date()
  const dailyPrincipalNextMonth = loanList.reduce((s, l) => {
    const breakdown = getNextPeriodDailyRateBreakdown(l, specialPaymentsByLoan[l.id] ?? [], now)
    return s + (breakdown?.daily_principal ?? 0)
  }, 0)
  const currentMonthName = now.toLocaleDateString('de-DE', { month: 'long' })
  const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('de-DE', { month: 'long' })

  const in12MonthsDate = new Date(now.getFullYear() + 1, now.getMonth(), 15)
  const monthlyPrincipalNow = loanList.reduce((s, l) => s + getMonthlyPrincipalAt(l, specialPaymentsByLoan[l.id] ?? [], now), 0)
  const monthlyPrincipalIn12Months = loanList.reduce((s, l) => s + getMonthlyPrincipalAt(l, specialPaymentsByLoan[l.id] ?? [], in12MonthsDate), 0)
  const in12MonthsLabel = in12MonthsDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

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

  // Tilgungsmeilensteine: 10/20/30-Jahres-Stand + Halbzeitmarke greifen auf
  // debtOverTime zurück (Restschuld je Datum über alle Kredite), statt pro
  // Meilenstein neu zu rechnen. Schreibt Status quo fort (keine weiteren
  // Sondertilgungen/Zinsänderungen/Anschlussfinanzierungen unterstellt).
  const totalOriginalPrincipal = loanList.reduce((s, l) => s + l.principal, 0)
  const totalDebtAt = (date: Date): number => {
    const entry = debtOverTime.find(d => new Date(d.date) >= date)
    return entry ? entry.remaining_balance : 0
  }
  const tilgungMilestones = [10, 20, 30].map(years => {
    const date = new Date(now.getFullYear() + years, now.getMonth(), now.getDate())
    const paid = totalOriginalPrincipal - totalDebtAt(date)
    return { years, date, paid, percent: totalOriginalPrincipal > 0 ? (paid / totalOriginalPrincipal) * 100 : 0 }
  })
  const halfDebtPoint = totalOriginalPrincipal > 0
    ? debtOverTime.find(d => new Date(d.date) >= now && d.remaining_balance <= totalOriginalPrincipal * 0.5)
    : undefined

  const firstPayoff = payoffOverview[0]
  const lastPayoffDate = payoffOverview.length > 0 && payoffOverview.every(p => p.payoffDate)
    ? payoffOverview[payoffOverview.length - 1].payoffDate
    : null

  // "Bruttorendite"-Analogie: je Kredit die annualisierte Wachstumsrate (CAGR)
  // des monatlichen Tilgungsanteils von heute bis zum eigenen Laufzeitende,
  // nach Kreditsumme gewichtet zu einem Portfolio-Schnitt zusammengefasst.
  // Kredite in der tilgungsfreien Anlaufzeit (Tilgungsanteil aktuell 0) sind
  // ausgeklammert, da eine CAGR von einem Startwert 0 aus nicht definiert ist.
  const tilgungCagrData = loanSchedules
    .map(({ loan, entries, payoffDate }) => {
      if (!payoffDate) return null
      const payoff = new Date(payoffDate)
      const years = (payoff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      if (years <= 0) return null
      const startMonthly = getMonthlyPrincipalAt(loan, specialPaymentsByLoan[loan.id] ?? [], now)
      if (startMonthly <= 0) return null
      // Die letzte reguläre Rate vor Volltilgung ist oft nur eine verkürzte
      // "Restbetrag"-Zahlung (kleiner als der eigentliche Trend, da nur noch
      // die kleine Restschuld beglichen wird) - als Endwert daher die
      // vorletzte reguläre Rate verwenden, nicht die tatsächlich letzte.
      const regularEntries = entries.filter(e => e.special_payment === 0)
      const trendEntry = regularEntries[regularEntries.length - 2]
      if (!trendEntry) return null
      const endMonthly = getMonthlyPrincipalAt(loan, specialPaymentsByLoan[loan.id] ?? [], new Date(trendEntry.date))
      if (endMonthly <= 0) return null
      return { cagr: Math.pow(endMonthly / startMonthly, 1 / years) - 1, weight: loan.principal }
    })
    .filter((d): d is { cagr: number; weight: number } => d !== null)
  const tilgungCagr = tilgungCagrData.length > 0
    ? tilgungCagrData.reduce((s, d) => s + d.cagr * d.weight, 0) / tilgungCagrData.reduce((s, d) => s + d.weight, 0)
    : null

  // Lebenszyklus je Kredit: geplant (Auszahlung liegt noch in der Zukunft,
  // z.B. eine geplante Anschlussfinanzierung) / aktiv / archiviert (bereits
  // vollständig getilgt) - damit die normale Kredite-Liste nicht mit
  // inaktiven bzw. abgeschlossenen Krediten überladen wird.
  const activeLoans: Loan[] = []
  const futureLoans: Loan[] = []
  const archivedLoans: Loan[] = []
  for (const l of loanList) {
    const schedule = loanSchedules.find(s => s.loan.id === l.id)
    if (new Date(l.disbursement_date) > now) {
      futureLoans.push(l)
    } else if (schedule?.payoffDate && new Date(schedule.payoffDate) <= now) {
      archivedLoans.push(l)
    } else {
      activeLoans.push(l)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzen</h1>
        <p className="text-gray-500 text-sm mt-1">Portfolio-Übersicht über alle Immobilien und Kredite</p>
      </div>

      {lastPayoffDate && <FreedomCountdown targetDate={lastPayoffDate} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-100 md:col-span-2">
          <CardTitle>Nettovermögen</CardTitle>
          <p className="text-xl md:text-3xl font-bold text-blue-700 break-words">{euro(netWorth.net_worth)}</p>
          <p className="text-sm text-gray-500 mt-1">
            Immobilien-Eigenkapital {euro(netWorth.total_property_equity)} + sonstige Anlagen {euro(netWorth.total_assets)}
            {netWorth.total_reserves > 0 && <> + Rücklagen {euro(netWorth.total_reserves)}</>}
            {netWorth.monthly_savings_rate > 0 && <> · {euro(netWorth.monthly_savings_rate)} Sparrate/Monat</>}
          </p>
        </Card>
        {totalOriginalPrincipal > 0 && (
          <Card>
            <details className="group">
              <summary className="flex items-center gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <TilgungRing percent={(totalPrincipalPaid / totalOriginalPrincipal) * 100} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Gesamt-Tilgung</p>
                  <p className="text-xs text-gray-400 mt-0.5">alle Immobilien</p>
                </div>
                {propertyFinance.length > 0 && (
                  <span className="text-gray-300 text-xs shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                )}
              </summary>
              {propertyFinance.length > 0 && (
                <div className="flex gap-5 overflow-x-auto mt-4 pt-4 border-t border-gray-100">
                  {propertyFinance.map(({ property: p, tilgungPercent, principal, remaining }) => (
                    <Ring
                      key={p.id}
                      size={84}
                      percent={tilgungPercent}
                      label={propertyLabel(p)}
                      detail={`${euro(principal - remaining)} / ${euro(principal)}`}
                      color="#2563eb"
                      trackColor="#dbeafe"
                      decimals={2}
                      ariaLabel={`${propertyLabel(p)}: ${tilgungPercent.toFixed(2)} Prozent getilgt`}
                    />
                  ))}
                </div>
              )}
            </details>
          </Card>
        )}
        {portfolio.total_property_value > 0 && (
          <Card>
            <details className="group">
              <summary className="flex items-center gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <LtvRing percent={(portfolio.total_debt / portfolio.total_property_value) * 100} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Beleihungsauslauf</p>
                  <p className="text-xs text-gray-400 mt-0.5">Restschuld / Wert</p>
                </div>
                {propertyFinance.length > 0 && (
                  <span className="text-gray-300 text-xs shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                )}
              </summary>
              <p className="text-xs text-gray-400 mt-3">
                LTV = Loan-to-Value: Restschuld im Verhältnis zum aktuellen Immobilienwert. Je niedriger, desto weniger ist die Immobilie noch belastet.
              </p>
              {propertyFinance.length > 0 && (
                <div className="flex gap-5 overflow-x-auto mt-3 pt-4 border-t border-gray-100">
                  {propertyFinance.map(({ property: p, ltvPercent, remaining, value }) => {
                    const { color, trackColor } = ltvColor(ltvPercent)
                    return (
                      <Ring
                        key={p.id}
                        size={84}
                        percent={ltvPercent}
                        label={propertyLabel(p)}
                        detail={`${euro(remaining)} / ${euro(value)}`}
                        color={color}
                        trackColor={trackColor}
                        ariaLabel={`${propertyLabel(p)}: Beleihungsauslauf ${ltvPercent.toFixed(0)} Prozent`}
                      />
                    )
                  })}
                </div>
              )}
            </details>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardTitle className="min-h-10">Immobilienwert</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{euro(portfolio.total_property_value)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Verbindlichkeiten (aktuell)</CardTitle>
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
            <li>Deine Mieter haben dir {thisYear - 1} bereits <strong className="text-green-700">{euro(principalLastYear)}</strong> getilgt</li>
            <li>
              Deine Mieter tilgen dir im {currentMonthName} täglich <strong className="text-green-700">{euro(todayCashflow.daily_principal_total)}</strong>
              , im {nextMonthName} sind es <strong className="text-green-700">{euro(dailyPrincipalNextMonth)}</strong>
            </li>
            <li>
              Deine monatliche Tilgungssumme über alle Kredite liegt aktuell bei <strong className="text-green-700">{euro(monthlyPrincipalNow)}</strong> pro Monat
              {' '}und wird bei gleichen Voraussetzungen (keine weiteren Sondertilgungen, Zinsänderungen o.ä.) bis {in12MonthsLabel} auf <strong className="text-green-700">{euro(monthlyPrincipalIn12Months)}</strong> pro Monat steigen
            </li>
            <li>
              Deine Gesamttilgung über alle Kredite steht jetzt bei <strong className="text-green-700">{euro(totalPrincipalPaid)}</strong>
              {totalSondertilgungenPaid > 0 && <> (davon <strong className="text-green-700">{euro(totalSondertilgungenPaid)}</strong> Sondertilgungen)</>}
            </li>
            <li>Deine Mieter werden dir {thisYear} insgesamt <strong className="text-green-700">{euro(principalThisYear)}</strong> tilgen</li>
            <li>{thisYear + 1} werden es voraussichtlich <strong className="text-green-700">{euro(principalNextYear)}</strong> sein (angenommen keine Mietausfälle, Kündigungen oder Mieterhöhungen)</li>
            {indexRentIncreasePotential > 0 && (
              <li>
                Falls du im Januar {thisYear + 1} bei allen dann Indexmiete-erhöhungsberechtigten Mietverhältnissen erhöhst, kämen rechnerisch zusätzlich bis zu{' '}
                <strong className="text-green-700">{euro(indexRentIncreasePotential)}</strong> Mehreinnahme für {thisYear + 1} zusammen –
                z.B. geeignet für eine zusätzliche Sondertilgung Ende {thisYear + 1} (auf Basis des zuletzt erfassten VPI-Werts, ohne Gewähr)
              </li>
            )}
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            Jahreswerte zeigen nur die planmäßige Tilgung (ohne Sondertilgungen), damit die Zahlen die tatsächliche, stetig steigende Tilgungskurve abbilden. "Gesamttilgung" oben enthält Sondertilgungen weiterhin, da dort die reale Verbindlichkeiten-Reduzierung zählt.
          </p>
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
            {firstPayoff?.payoffDate && (
              <li>
                Deine erste Immobilie ({propertyById[firstPayoff.loan.property_id] ? propertyLabel(propertyById[firstPayoff.loan.property_id]) : firstPayoff.loan.name}) wird voraussichtlich am{' '}
                <strong className="text-blue-700">{formatDate(firstPayoff.payoffDate)}</strong> schuldenfrei sein
              </li>
            )}
            {lastPayoffDate && (
              <li>
                Dein gesamtes Portfolio wird bei gleichbleibenden Konditionen voraussichtlich am{' '}
                <strong className="text-blue-700">{formatDate(lastPayoffDate)}</strong> komplett schuldenfrei sein
              </li>
            )}
            {halfDebtPoint && (
              <li>
                Am <strong className="text-blue-700">{formatDate(halfDebtPoint.date)}</strong> hast du rechnerisch die Hälfte deiner ursprünglichen Kreditsumme ({euro(totalOriginalPrincipal)}) getilgt
              </li>
            )}
            {tilgungMilestones.map(m => (
              <li key={m.years}>
                Nach {m.years} Jahren (bis {formatDate(m.date)}) hast du voraussichtlich <strong className="text-blue-700">{euro(m.paid)}</strong> getilgt
                {' '}({percent(m.percent, 1)} deiner ursprünglichen Kreditsumme)
              </li>
            ))}
            {tilgungCagr !== null && (
              <li>
                Deine Tilgung wächst bis zum jeweiligen Laufzeitende deiner Kredite im (nach Kreditsumme gewichteten) Schnitt um{' '}
                <strong className="text-blue-700">{percent(tilgungCagr * 100, 1)}</strong> pro Jahr – wie eine durchgehende jährliche Gehaltserhöhung in dieser Höhe.
                Rechnerisch ist das die Bruttorendite, die dir dein aktueller Tilgungsplan bis zum fiktiven Laufzeitende verschafft
              </li>
            )}
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            Break-even = kumulierter Cashflow (Miete abzüglich Zinsen, Tilgung, Kosten-Laufrate und Rücklagenbildung) seit dem frühesten Kaufdatum, verglichen mit dem eingesetzten Eigenkapital (Kaufpreis + Kaufnebenkosten abzüglich Kreditsumme je Objekt). Kosten-/Rücklagen-Laufrate werden dabei vereinfacht als konstant über die Zeit angenommen.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            10/20/30-Jahres-Stand, Halbzeitmarke und Bruttorendite-Analogie schreiben den aktuellen Tilgungsplan (inkl. bereits erfolgter Sondertilgungen) unverändert fort – ohne Annahme weiterer Sondertilgungen, Zinsanpassungen oder Anschlussfinanzierungen zum Laufzeitende. Kredite in der tilgungsfreien Anlaufzeit sind aus der Bruttorendite-Berechnung ausgeklammert, da ihr Tilgungsanteil dort bei 0 startet.
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
        <CardTitle>Verbindlichkeiten-Verlauf (alle Kredite)</CardTitle>
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

      {/* CapEx-Trend */}
      {capexData.length > 0 && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>CapEx-Trend – Renovierung/Sanierung nach Jahr</CardTitle>
            <span className="text-sm text-gray-500">Gesamt: <strong className="text-gray-900">{euro(totalCapex)}</strong></span>
          </div>
          <CapexChart data={capexData} />
          <p className="text-xs text-gray-400 mt-2">
            Summe der als Renovierung/Sanierung markierten Belege je Steuerjahr, über alle Objekte hinweg.
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
                      <span>
                        {a.name || c.label}{a.institution ? ` · ${a.institution}` : ''}
                        {a.monthly_contribution > 0 && projectedAssetValue(a) !== a.current_value && (
                          <span className="text-xs text-gray-400"> (hochgerechnet ab {formatDate(a.valuation_date)})</span>
                        )}
                      </span>
                      <span>{euro(projectedAssetValue(a))}</span>
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

      {/* Zinsbindungs-Übersicht */}
      {zinsbindungOverview.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Zinsbindungs-Übersicht</h2>
          <Card>
            <div className="space-y-2">
              {zinsbindungOverview.map(({ loan, endDate, remainingBalance }) => {
                const monthsUntil = (new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                const soon = monthsUntil >= 0 && monthsUntil <= 24
                const past = monthsUntil < 0
                return (
                  <div key={loan.id} className="flex justify-between items-center gap-3 text-sm">
                    <span className="text-gray-600">
                      {loan.name} · {propertyById[loan.property_id] ? propertyLabel(propertyById[loan.property_id]) : ''}
                      {remainingBalance != null && <span className="text-xs text-gray-400"> · Restschuld dann ca. {euro(remainingBalance)}</span>}
                    </span>
                    <span className={`whitespace-nowrap font-medium ${past ? 'text-gray-400' : soon ? 'text-amber-700' : 'text-gray-900'}`}>
                      {formatDate(endDate)}
                      {soon && !past && ' · bald'}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
              Frühestens 24 Monate vor Ablauf lohnt sich meist ein Vergleich für die Anschlussfinanzierung (Forward-Darlehen).
            </p>
          </Card>
        </div>
      )}

      {/* Sondertilgungs-Simulator */}
      <SondertilgungSimulator loans={loanList} specialPaymentsByLoan={specialPaymentsByLoan} properties={props} />

      <div id="kredite">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Kredite ({activeLoans.length})</h2>
          <Link href="/loans/new" className="text-sm text-blue-600 hover:underline">+ Kredit erfassen</Link>
        </div>
        {activeLoans.length === 0 ? (
          <Card className="text-center py-12 text-gray-400">
            <p className="mb-4">Noch keine aktiven Kredite hinterlegt.</p>
            <Link href="/loans/new" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              Ersten Kredit anlegen
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeLoans.map(l => {
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

        {futureLoans.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Geplant / noch nicht aktiv ({futureLoans.length})</p>
            <div className="space-y-2">
              {futureLoans.map(l => (
                <Link key={l.id} href={`/loans/${l.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 truncate">{l.name}</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {propertyById[l.property_id] ? propertyLabel(propertyById[l.property_id]) : ''} · {l.nominal_interest_rate}% · {euro(l.annuity_amount)} / {l.payment_frequency}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap">
                        Aktiv ab {formatDate(l.disbursement_date)}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {archivedLoans.length > 0 && (
          <details className="group mt-4">
            <summary className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Archiv – vollständig getilgt ({archivedLoans.length}) <span className="transition-transform inline-block group-open:rotate-180">▾</span>
            </summary>
            <div className="space-y-2 mt-2">
              {archivedLoans.map(l => {
                const schedule = loanSchedules.find(s => s.loan.id === l.id)
                return (
                  <Link key={l.id} href={`/loans/${l.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-70">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">{l.name}</p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {propertyById[l.property_id] ? propertyLabel(propertyById[l.property_id]) : ''} · {euro(l.principal)} ursprünglich
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                          Getilgt {schedule?.payoffDate ? formatDate(schedule.payoffDate) : ''}
                        </span>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
