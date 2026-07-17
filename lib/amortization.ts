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
  Receipt,
  PaymentFrequency,
  DayCountConvention,
} from './types'

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

  const nextEntry = entries.find(e => e.scheduled_principal > 0 && new Date(e.date) > asOfDate)

  return {
    as_of_date: iso(asOfDate),
    remaining_balance: remainingBalance,
    cumulative_interest_paid: cumulativeInterestPaid,
    cumulative_principal_paid: loan.principal - remainingBalance,
    next_payment_date: nextEntry ? nextEntry.date : null,
    current_annuity_amount: loan.annuity_amount,
  }
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
  receipts: Receipt[],
  asOfDate: Date = new Date()
): PortfolioFinancialSummary {
  const loanStatuses = loans.map(l => getLoanStatus(l, specialPaymentsByLoan[l.id] ?? [], asOfDate))

  const totalDebt = loanStatuses.reduce((s, l) => s + l.remaining_balance, 0)
  const totalPropertyValue = properties.reduce((s, p) => s + p.purchase_price, 0)

  const activeTenants = tenants.filter(t => !t.move_out_date || new Date(t.move_out_date) > asOfDate)
  const monthlyRentIncome = activeTenants.reduce((s, t) => s + t.rent_base, 0)

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
    (s, l) => s + l.annuity_amount * (periodsPerYear(l.payment_frequency) / 12),
    0
  )

  // AfA ist bewusst ausgeschlossen: nicht zahlungswirksam, bereits separat im Dashboard sichtbar.
  const monthlyNetCashflow = monthlyRentIncome - monthlyDebtService - monthlyOperatingCostRunrate

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
