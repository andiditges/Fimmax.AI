import { addMonths, addYears, differenceInCalendarDays, differenceInCalendarMonths, isAfter } from 'date-fns'
import type {
  Loan,
  LoanSpecialPayment,
  AmortizationEntry,
  AmortizationResult,
  LoanStatus,
  PortfolioFinancialSummary,
  Property,
  Tenant,
  RentalAgreement,
  RentAdjustment,
  Receipt,
  PaymentFrequency,
  DayCountConvention,
  DailyRateBreakdown,
  TodayCashflowSnapshot,
  DailyRatePoint,
} from './types'
import { sumRentForMonth } from './rent-schedule'
import { propertyValue } from './format'

const EPS = 0.01

function addPeriod(date: Date, frequency: PaymentFrequency): Date {
  if (frequency === 'monatlich') return addMonths(date, 1)
  if (frequency === 'vierteljährlich') return addMonths(date, 3)
  return addYears(date, 1)
}

function periodsPerYear(frequency: PaymentFrequency): number {
  if (frequency === 'monatlich') return 12
  if (frequency === 'vierteljährlich') return 4
  return 1
}

// 30/360 (US/NASD): jeder Monat zählt als 30 Tage, das Jahr als 360.
function days360(start: Date, end: Date): number {
  const d1 = Math.min(start.getDate(), 30)
  let d2 = end.getDate()
  if (d1 === 30 && d2 === 31) d2 = 30
  return (
    (end.getFullYear() - start.getFullYear()) * 360 +
    (end.getMonth() - start.getMonth()) * 30 +
    (d2 - d1)
  )
}

function dayCount(start: Date, end: Date, convention: DayCountConvention): number {
  const days = convention === '30/360' ? days360(start, end) : differenceInCalendarDays(end, start)
  return Math.max(0, days)
}

function basisFor(convention: DayCountConvention): number {
  return convention === '30/360' ? 360 : 365
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function balanceAtDate(entries: AmortizationEntry[], principal: number, date: Date): number {
  let result = principal
  for (const e of entries) {
    if (new Date(e.date) > date) break
    result = e.remaining_balance
  }
  return result
}

/**
 * Läuft periodenweise vom Auszahlungsdatum. Sondertilgungen spalten eine
 * Periode an ihrem exakten Datum in Sub-Intervalle, sodass jede Zins-
 * berechnung und jede Saldo-Änderung tagesgenau datiert ist statt nur
 * am Periodenende.
 */
export function generateAmortizationSchedule(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  options?: { horizonYears?: number }
): AmortizationResult {
  const horizonYears = options?.horizonYears ?? 40
  const rate = loan.nominal_interest_rate / 100
  const basis = basisFor(loan.day_count_convention)

  const sortedSp = [...specialPayments].sort(
    (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
  )

  let balance = loan.principal
  let cursor = new Date(loan.disbursement_date)
  const horizonDate = addYears(cursor, horizonYears)
  const graceEndDate = loan.interest_only_months
    ? addMonths(new Date(loan.disbursement_date), loan.interest_only_months)
    : null

  const entries: AmortizationEntry[] = []
  let payoffDate: string | null = null
  let warning: AmortizationResult['warning'] = null
  let spIndex = 0

  outer: while (balance > EPS && isAfter(horizonDate, cursor)) {
    const periodEnd = addPeriod(cursor, loan.payment_frequency)
    let subStart = cursor

    while (spIndex < sortedSp.length && !isAfter(new Date(sortedSp[spIndex].payment_date), periodEnd)) {
      const spDate = new Date(sortedSp[spIndex].payment_date)
      const days = dayCount(subStart, spDate, loan.day_count_convention)
      const interest = balance * rate * (days / basis)
      const amt = Math.min(sortedSp[spIndex].amount, balance)
      balance -= amt

      entries.push({
        date: iso(spDate),
        days_in_period: days,
        interest_accrued: interest,
        scheduled_principal: 0,
        special_payment: amt,
        total_payment: amt,
        remaining_balance: Math.max(balance, 0),
      })
      subStart = spDate
      spIndex++

      if (balance <= EPS) {
        payoffDate = iso(spDate)
        break outer
      }
    }

    const days = dayCount(subStart, periodEnd, loan.day_count_convention)
    const interest = balance * rate * (days / basis)

    if (graceEndDate && !isAfter(periodEnd, graceEndDate)) {
      entries.push({
        date: iso(periodEnd),
        days_in_period: days,
        interest_accrued: interest,
        scheduled_principal: 0,
        special_payment: 0,
        total_payment: interest,
        remaining_balance: balance,
      })
      cursor = periodEnd
      continue
    }

    const scheduledPrincipal = loan.annuity_amount - interest

    if (scheduledPrincipal <= 0) {
      warning = 'negative_amortization'
      break
    }

    const actualPrincipal = Math.min(scheduledPrincipal, balance)
    balance -= actualPrincipal

    entries.push({
      date: iso(periodEnd),
      days_in_period: days,
      interest_accrued: interest,
      scheduled_principal: actualPrincipal,
      special_payment: 0,
      total_payment: loan.annuity_amount,
      remaining_balance: Math.max(balance, 0),
    })

    if (balance <= EPS) {
      payoffDate = iso(periodEnd)
      break
    }
    cursor = periodEnd
  }

  let balanceAtFixedPeriodEnd: number | null = null
  if (loan.initial_fixed_period_years) {
    const fixedEnd = addYears(new Date(loan.disbursement_date), loan.initial_fixed_period_years)
    balanceAtFixedPeriodEnd = balanceAtDate(entries, loan.principal, fixedEnd)
  }

  return {
    entries,
    payoff_date: payoffDate,
    balance_at_fixed_period_end: balanceAtFixedPeriodEnd,
    warning,
  }
}

export function calcRestschuldOnDate(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  onDate: Date
): number {
  const { entries } = generateAmortizationSchedule(loan, specialPayments)
  return balanceAtDate(entries, loan.principal, onDate)
}

export function getLoanStatus(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  asOfDate: Date = new Date()
): LoanStatus {
  const { entries } = generateAmortizationSchedule(loan, specialPayments)
  const remainingBalance = balanceAtDate(entries, loan.principal, asOfDate)

  const cumulativeInterestPaid = entries
    .filter(e => new Date(e.date) <= asOfDate)
    .reduce((sum, e) => sum + e.interest_accrued, 0)

  // special_payment === 0 grenzt reguläre Periodenzahlungen (egal ob tilgungsfrei
  // oder mit Tilgung) von Sondertilgungs-Einträgen ab, die selbst keine
  // planmäßige Rate darstellen.
  const nextEntry = entries.find(e => e.special_payment === 0 && new Date(e.date) > asOfDate)

  return {
    as_of_date: iso(asOfDate),
    remaining_balance: remainingBalance,
    cumulative_interest_paid: cumulativeInterestPaid,
    cumulative_principal_paid: loan.principal - remainingBalance,
    next_payment_date: nextEntry ? nextEntry.date : null,
    current_annuity_amount: nextEntry ? nextEntry.total_payment : loan.annuity_amount,
  }
}

/**
 * Tages-Zins-/Tilgungssatz der laufenden Periode: die reguläre Periodenrate
 * (Zins + Tilgung) geteilt durch die Tage der Periode – bewusst simpel statt
 * unterjährig neu verzinst, analog zur bestehenden Monatsraten-Umrechnung in
 * aggregatePortfolioFinancials.
 */
export function getDailyRateBreakdown(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  asOfDate: Date = new Date()
): DailyRateBreakdown | null {
  const { entries } = generateAmortizationSchedule(loan, specialPayments)
  const regular = entries.filter(e => e.special_payment === 0)
  const currentIndex = regular.findIndex(e => !isAfter(asOfDate, new Date(e.date)) || iso(new Date(e.date)) === iso(asOfDate))
  if (currentIndex === -1) return null // Kredit bereits getilgt oder außerhalb des Horizonts

  const current = regular[currentIndex]
  const periodStart = currentIndex > 0 ? regular[currentIndex - 1].date : loan.disbursement_date
  const days = current.days_in_period

  return {
    as_of_date: iso(asOfDate),
    period_start: periodStart,
    period_end: current.date,
    days_in_period: days,
    daily_interest: days > 0 ? current.interest_accrued / days : 0,
    daily_principal: days > 0 ? current.scheduled_principal / days : 0,
    daily_total: days > 0 ? current.total_payment / days : 0,
  }
}

/**
 * "Stand heute"-Karte fürs Finanz-Cockpit: rechnet die Tagessätze aller
 * Kredite sowie Miete/Betriebskosten-Laufrate auf die bereits vergangenen
 * Tage des laufenden Kalendermonats hoch. Bewusst kalendermonatsbasiert
 * (nicht periodenbasiert), damit Miete und Betriebskosten (beide ohnehin
 * monatlich gedacht) direkt vergleichbar bleiben.
 */
export function aggregateTodayCashflow(
  loans: Loan[],
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>,
  monthlyRentIncome: number,
  monthlyOperatingCostRunrate: number,
  monthlyReserveFromRent: number = 0,
  asOfDate: Date = new Date()
): TodayCashflowSnapshot {
  const breakdowns = loans
    .map(l => getDailyRateBreakdown(l, specialPaymentsByLoan[l.id] ?? [], asOfDate))
    .filter((b): b is DailyRateBreakdown => b !== null)

  const dailyInterestTotal = breakdowns.reduce((s, b) => s + b.daily_interest, 0)
  const dailyPrincipalTotal = breakdowns.reduce((s, b) => s + b.daily_principal, 0)
  const dailyDebtServiceTotal = dailyInterestTotal + dailyPrincipalTotal

  const daysInMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth() + 1, 0).getDate()
  const dayOfMonth = asOfDate.getDate()
  const dailyRent = monthlyRentIncome / daysInMonth
  const dailyOpex = monthlyOperatingCostRunrate / daysInMonth
  const dailyReserve = monthlyReserveFromRent / daysInMonth

  const rentSoFar = dailyRent * dayOfMonth
  const interestSoFar = dailyInterestTotal * dayOfMonth
  const principalSoFar = dailyPrincipalTotal * dayOfMonth
  const operatingCostSoFar = dailyOpex * dayOfMonth
  const reserveSoFar = dailyReserve * dayOfMonth

  return {
    as_of_date: iso(asOfDate),
    days_elapsed_in_month: dayOfMonth,
    rent_so_far: rentSoFar,
    interest_so_far: interestSoFar,
    principal_so_far: principalSoFar,
    operating_cost_so_far: operatingCostSoFar,
    reserve_so_far: reserveSoFar,
    remaining_so_far: rentSoFar - interestSoFar - principalSoFar - operatingCostSoFar - reserveSoFar,
    daily_interest_total: dailyInterestTotal,
    daily_principal_total: dailyPrincipalTotal,
    daily_debt_service_total: dailyDebtServiceTotal,
  }
}

/**
 * Monatlich gesampelter Verlauf der Tagessätze über alle Kredite hinweg –
 * zeigt, wie die Tages-Tilgung bei fester Annuität mit sinkendem Zinsanteil
 * wächst.
 */
export function aggregateDailyRateOverTime(
  loans: Loan[],
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>,
  monthsAhead = 36
): DailyRatePoint[] {
  if (loans.length === 0) return []

  const earliestDisbursement = loans.reduce(
    (min, l) => (l.disbursement_date < min ? l.disbursement_date : min),
    loans[0].disbursement_date
  )
  const startDate = new Date(new Date(earliestDisbursement).getFullYear(), new Date(earliestDisbursement).getMonth(), 1)
  const endDate = addMonths(new Date(), monthsAhead)

  const points: DailyRatePoint[] = []
  let cursor = startDate
  while (!isAfter(cursor, endDate)) {
    const breakdowns = loans
      .map(l => getDailyRateBreakdown(l, specialPaymentsByLoan[l.id] ?? [], cursor))
      .filter((b): b is DailyRateBreakdown => b !== null)

    points.push({
      date: iso(cursor),
      daily_interest: breakdowns.reduce((s, b) => s + b.daily_interest, 0),
      daily_principal: breakdowns.reduce((s, b) => s + b.daily_principal, 0),
    })
    cursor = addMonths(cursor, 1)
  }
  return points
}

/**
 * Rein informativ: leitet die anfängliche Tilgungsrate aus der eingegebenen
 * Annuität ab. Die Annuität selbst bleibt bankseitig vorgegeben und wird
 * nie aus der Tilgungsrate abgeleitet.
 */
export function suggestInitialRepaymentRate(
  principal: number,
  nominalInterestRate: number,
  annuityAmount: number,
  frequency: PaymentFrequency = 'monatlich'
): number {
  if (principal <= 0) return 0
  return (periodsPerYear(frequency) * annuityAmount) / principal * 100 - nominalInterestRate
}

/**
 * Aggregiert die Restschuld über alle Kredite hinweg zu einer einzigen
 * Zeitreihe, indem die Vereinigungsmenge aller Zahlungs-/Sondertilgungs-
 * Termine gebildet und pro Termin über alle Kredite summiert wird.
 */
export function aggregateDebtOverTime(
  loans: Loan[],
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>
): { date: string; remaining_balance: number }[] {
  if (loans.length === 0) return []

  const schedules = loans.map(l => ({
    loan: l,
    result: generateAmortizationSchedule(l, specialPaymentsByLoan[l.id] ?? []),
  }))

  const dateSet = new Set<string>()
  schedules.forEach(({ loan, result }) => {
    dateSet.add(loan.disbursement_date)
    result.entries.forEach(e => dateSet.add(e.date))
  })
  const dates = Array.from(dateSet).sort()

  return dates.map(date => {
    const d = new Date(date)
    const total = schedules.reduce(
      (sum, { loan, result }) => sum + balanceAtDate(result.entries, loan.principal, d),
      0
    )
    return { date, remaining_balance: total }
  })
}

export function aggregatePortfolioFinancials(
  properties: Property[],
  loans: Loan[],
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>,
  tenants: Tenant[],
  rentalAgreements: RentalAgreement[],
  rentAdjustments: RentAdjustment[],
  receipts: Receipt[],
  monthlyReserveFromRent: number = 0,
  asOfDate: Date = new Date()
): PortfolioFinancialSummary {
  const loanStatuses = loans.map(l => getLoanStatus(l, specialPaymentsByLoan[l.id] ?? [], asOfDate))

  const totalDebt = loanStatuses.reduce((s, l) => s + l.remaining_balance, 0)
  const totalPropertyValue = properties.reduce((s, p) => s + propertyValue(p), 0)

  const agreementsByTenant = rentalAgreements.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = rentAdjustments.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)
  const monthlyRentIncome = sumRentForMonth(tenants, agreementsByTenant, adjustmentsByTenant, asOfDate)

  const twelveMonthsAgo = new Date(asOfDate)
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const trailingReceipts = receipts.filter(r => {
    const d = new Date(r.receipt_date)
    return d > twelveMonthsAgo && d <= asOfDate
  })
  // Trailing-12-Monate statt Einzelmonat, da Kosten wie Versicherung/Grundsteuer
  // unregelmäßig anfallen und ein Einzelmonat sonst irreführend wäre.
  const monthlyOperatingCostRunrate = trailingReceipts.reduce((s, r) => s + r.amount, 0) / 12

  const monthlyDebtService = loans.reduce(
    (s, l, i) => s + loanStatuses[i].current_annuity_amount * (periodsPerYear(l.payment_frequency) / 12),
    0
  )

  // AfA ist bewusst ausgeschlossen: nicht zahlungswirksam, bereits separat im Dashboard sichtbar.
  // Rücklagen fließen nur ein, wenn sie laut Andi tatsächlich aus der Kaltmiete gebildet werden.
  const monthlyNetCashflow = monthlyRentIncome - monthlyDebtService - monthlyOperatingCostRunrate - monthlyReserveFromRent

  return {
    as_of_date: iso(asOfDate),
    total_debt: totalDebt,
    total_property_value: totalPropertyValue,
    total_equity: totalPropertyValue - totalDebt,
    monthly_debt_service: monthlyDebtService,
    monthly_rent_income: monthlyRentIncome,
    monthly_operating_cost_runrate: monthlyOperatingCostRunrate,
    monthly_net_cashflow: monthlyNetCashflow,
    loans: loanStatuses,
  }
}

export interface SpecialPaymentSimulation {
  hypothetical_amount: number
  baseline_payoff_date: string | null
  baseline_total_interest: number
  new_payoff_date: string | null
  new_total_interest: number
  months_saved: number
  interest_saved_total: number
  new_remaining_balance: number
}

/**
 * Rechnet rein hypothetisch durch, was eine zusätzliche Sondertilgung heute
 * bewirken würde – ohne sie zu speichern. Die Annuität bleibt dabei (wie bei
 * generateAmortizationSchedule generell) unverändert; die Sondertilgung
 * verkürzt stattdessen die Restlaufzeit.
 */
export function simulateSpecialPayment(
  loan: Loan,
  existingSpecialPayments: LoanSpecialPayment[],
  hypotheticalAmount: number,
  asOfDate: Date = new Date()
): SpecialPaymentSimulation {
  const baseline = generateAmortizationSchedule(loan, existingSpecialPayments)
  const withPayment = generateAmortizationSchedule(loan, [
    ...existingSpecialPayments,
    { id: 'sim', loan_id: loan.id, payment_date: iso(asOfDate), amount: hypotheticalAmount, note: null, created_at: '' },
  ])

  const baselineTotalInterest = baseline.entries.reduce((s, e) => s + e.interest_accrued, 0)
  const newTotalInterest = withPayment.entries.reduce((s, e) => s + e.interest_accrued, 0)

  const monthsSaved =
    baseline.payoff_date && withPayment.payoff_date
      ? differenceInCalendarMonths(new Date(baseline.payoff_date), new Date(withPayment.payoff_date))
      : 0

  return {
    hypothetical_amount: hypotheticalAmount,
    baseline_payoff_date: baseline.payoff_date,
    baseline_total_interest: baselineTotalInterest,
    new_payoff_date: withPayment.payoff_date,
    new_total_interest: newTotalInterest,
    months_saved: Math.max(0, monthsSaved),
    interest_saved_total: Math.max(0, baselineTotalInterest - newTotalInterest),
    new_remaining_balance: balanceAtDate(withPayment.entries, loan.principal, asOfDate),
  }
}
