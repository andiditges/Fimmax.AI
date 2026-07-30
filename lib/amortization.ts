import { addDays, addMonths, addYears, differenceInCalendarDays, differenceInCalendarMonths, isAfter } from 'date-fns'
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

// Vor der Auszahlung besteht noch keine Restschuld - ohne diese Prüfung
// würde die Schleife unten beim ersten (immer erst nach Auszahlung
// liegenden) Eintrag sofort abbrechen und fälschlich den vollen principal
// als "aktuelle" Restschuld zurückgeben, obwohl der Kredit noch gar nicht
// aktiv ist (z.B. eine geplante, aber noch nicht ausgezahlte
// Anschlussfinanzierung).
function balanceAtDate(entries: AmortizationEntry[], principal: number, date: Date, disbursementDate: string): number {
  if (date < new Date(disbursementDate)) return 0
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
    // Volle Periodenlänge (nicht nur das letzte Teilintervall nach einer
    // Sondertilgung) - days_in_period muss die gesamte Periode abdecken,
    // damit z.B. getDailyRateBreakdown daraus einen korrekten Tagesschnitt
    // bilden kann, statt die Periodenzinsen/-tilgung fälschlich nur auf die
    // wenigen Tage nach der Sondertilgung umzulegen.
    const periodDays = dayCount(cursor, periodEnd, loan.day_count_convention)
    let subStart = cursor
    // Zinsen akkumulieren über alle Teilintervalle der Periode (auch die vor
    // einer zwischenzeitlichen Sondertilgung), damit die reguläre Rate am
    // Periodenende die tatsächlich angefallenen Gesamtzinsen abdeckt statt
    // nur die des letzten (durch die Sondertilgung verkürzten) Teilintervalls.
    let periodInterest = 0

    while (spIndex < sortedSp.length && !isAfter(new Date(sortedSp[spIndex].payment_date), periodEnd)) {
      const spDate = new Date(sortedSp[spIndex].payment_date)
      const days = dayCount(subStart, spDate, loan.day_count_convention)
      const interest = balance * rate * (days / basis)
      periodInterest += interest
      const amt = Math.min(sortedSp[spIndex].amount, balance)
      balance -= amt

      entries.push({
        date: iso(spDate),
        days_in_period: days,
        interest_accrued: 0,
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
    periodInterest += balance * rate * (days / basis)

    if (graceEndDate && !isAfter(periodEnd, graceEndDate)) {
      entries.push({
        date: iso(periodEnd),
        days_in_period: periodDays,
        interest_accrued: periodInterest,
        scheduled_principal: 0,
        special_payment: 0,
        total_payment: periodInterest,
        remaining_balance: balance,
      })
      cursor = periodEnd
      continue
    }

    const scheduledPrincipal = loan.annuity_amount - periodInterest

    if (scheduledPrincipal <= 0) {
      warning = 'negative_amortization'
      break
    }

    const actualPrincipal = Math.min(scheduledPrincipal, balance)
    balance -= actualPrincipal

    entries.push({
      date: iso(periodEnd),
      days_in_period: periodDays,
      interest_accrued: periodInterest,
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
    balanceAtFixedPeriodEnd = balanceAtDate(entries, loan.principal, fixedEnd, loan.disbursement_date)
  }

  return {
    entries,
    payoff_date: payoffDate,
    balance_at_fixed_period_end: balanceAtFixedPeriodEnd,
    warning,
  }
}

/**
 * Summiert die planmäßige Tilgung (ohne Sondertilgungen) eines Tilgungsplans
 * innerhalb eines Kalenderjahres - für "wird dieses/nächstes Jahr getilgt".
 * Sondertilgungen bewusst ausgeklammert: sie sind einmalige, unregelmäßige
 * Ereignisse und würden den Jahresvergleich verzerren (z.B. ein Jahr mit
 * Sondertilgung höher erscheinen lassen als das Folgejahr, obwohl die
 * planmäßige Tilgung eigentlich stetig steigt).
 */
export function principalPaidInYear(entries: AmortizationEntry[], year: number): number {
  const yearPrefix = String(year)
  return entries
    .filter(e => e.date.slice(0, 4) === yearPrefix)
    .reduce((s, e) => s + e.scheduled_principal, 0)
}

// Analog zu principalPaidInYear, aber für die tatsächlich angefallenen
// Zinsen - Grundlage für die Werbungskosten in der Steuerauswertung, statt
// dort ausschließlich auf manuell erfasste "Zinsen"-Belege angewiesen zu sein.
export function interestPaidInYear(entries: AmortizationEntry[], year: number): number {
  const yearPrefix = String(year)
  return entries
    .filter(e => e.date.slice(0, 4) === yearPrefix)
    .reduce((s, e) => s + e.interest_accrued, 0)
}

/**
 * Verbleibendes kostenloses Sondertilgungskontingent für das Kalenderjahr von
 * asOfDate (z.B. die üblichen 5% der urspr. Darlehenssumme p.a. ohne
 * Vorfälligkeitsentschädigung). null, wenn für den Kredit keine Grenze
 * hinterlegt ist (dann unbegrenzt/unbekannt).
 */
export function specialPaymentAllowanceRemaining(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  asOfDate: Date = new Date()
): number | null {
  if (loan.special_payment_limit_percent == null) return null
  const year = asOfDate.getFullYear()
  const limit = loan.principal * (loan.special_payment_limit_percent / 100)
  const usedThisYear = specialPayments
    .filter(sp => new Date(sp.payment_date).getFullYear() === year)
    .reduce((s, sp) => s + sp.amount, 0)
  return Math.max(0, limit - usedThisYear)
}

export function calcRestschuldOnDate(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  onDate: Date
): number {
  const { entries } = generateAmortizationSchedule(loan, specialPayments)
  return balanceAtDate(entries, loan.principal, onDate, loan.disbursement_date)
}

export function getLoanStatus(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  asOfDate: Date = new Date()
): LoanStatus {
  // Noch nicht ausgezahlte Kredite (z.B. eine geplante Anschlussfinanzierung
  // mit zukünftigem Auszahlungsdatum) zählen "heute" noch nicht als
  // Restschuld/Tilgung mit - sie sind noch inaktiv und werden erst zum
  // Auszahlungsdatum wirksam.
  if (new Date(loan.disbursement_date) > asOfDate) {
    return {
      as_of_date: iso(asOfDate),
      remaining_balance: 0,
      cumulative_interest_paid: 0,
      cumulative_principal_paid: 0,
      next_payment_date: loan.disbursement_date,
      current_annuity_amount: loan.annuity_amount,
    }
  }

  const { entries } = generateAmortizationSchedule(loan, specialPayments)
  const remainingBalance = balanceAtDate(entries, loan.principal, asOfDate, loan.disbursement_date)

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
 * Tagesrate der auf die aktuell laufende Periode folgenden Periode - für
 * Portfolio-Vorschauen wie "nächsten Monat". Bewusst NICHT einfach der 1.
 * Tag des nächsten Kalendermonats als asOfDate an getDailyRateBreakdown,
 * da Zahlungsperioden am Auszahlungstag des jeweiligen Kredits verankert
 * sind (nicht am Kalendermonat) - bei den meisten Krediten läge der 1. des
 * Folgemonats noch in derselben laufenden Periode wie "heute" und würde
 * z.B. den Effekt frischer Sondertilgungen unsichtbar machen. Stattdessen
 * wird der Tag direkt nach Ende der aktuellen Periode abgefragt, was
 * unabhängig vom Auszahlungstag garantiert die nächste Periode trifft.
 */
export function getNextPeriodDailyRateBreakdown(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  asOfDate: Date = new Date()
): DailyRateBreakdown | null {
  const current = getDailyRateBreakdown(loan, specialPayments, asOfDate)
  if (!current) return null
  return getDailyRateBreakdown(loan, specialPayments, addDays(new Date(current.period_end), 1))
}

/**
 * Monatliche (auf 12 Monate normierte) Tilgungsrate der zu asOfDate laufenden
 * Periode - z.B. für eine "in 12 Monaten"-Vorschau bei gleichbleibenden
 * Bedingungen (keine weiteren Sondertilgungen als die bereits erfassten).
 * Normierung via periodsPerYear/12, damit auch nicht-monatliche
 * Zahlungsfrequenzen (vierteljährlich/jährlich) korrekt umgelegt werden.
 */
export function getMonthlyPrincipalAt(
  loan: Loan,
  specialPayments: LoanSpecialPayment[],
  asOfDate: Date
): number {
  const breakdown = getDailyRateBreakdown(loan, specialPayments, asOfDate)
  if (!breakdown) return 0
  const periodPrincipal = breakdown.daily_principal * breakdown.days_in_period
  return periodPrincipal * (periodsPerYear(loan.payment_frequency) / 12)
}

/**
 * Summe der aktuell laufenden Tages-Tilgungsrate über alle Kredite - Basis
 * für Echtzeit-Hochrechnungen (z.B. die Dashboard-"Rentenuhr"), ohne dafür
 * die übrigen Cashflow-Felder von aggregateTodayCashflow mitschleppen zu
 * müssen.
 */
export function totalDailyPrincipal(
  loans: Loan[],
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>,
  asOfDate: Date = new Date()
): number {
  return loans.reduce((s, l) => {
    const breakdown = getDailyRateBreakdown(l, specialPaymentsByLoan[l.id] ?? [], asOfDate)
    return s + (breakdown?.daily_principal ?? 0)
  }, 0)
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
 * Umkehrung von suggestInitialRepaymentRate: leitet die Rate je Zahlung aus
 * einer gewünschten anfänglichen Tilgungsrate ab (Sollzins + Tilgungsrate,
 * gleichmäßig auf die Zahlungsperioden verteilt) - für Nutzer, die die
 * Tilgungsrate laut Vertrag kennen statt der Rate in Euro.
 */
export function annuityFromInitialRepaymentRate(
  principal: number,
  nominalInterestRate: number,
  initialRepaymentRate: number,
  frequency: PaymentFrequency = 'monatlich'
): number {
  if (principal <= 0) return 0
  return principal * (nominalInterestRate + initialRepaymentRate) / 100 / periodsPerYear(frequency)
}

/**
 * Bereitstellungszinsen: ab Ende der "bereitstellungsfreien Zeit" nach
 * Vertragsschluss berechnen Banken bis zur tatsächlichen Auszahlung Zinsen
 * auf den noch nicht abgerufenen Darlehensbetrag (relevant v.a. bei
 * Bauzeit/Kaufabwicklung mit verzögerter Auszahlung). Geht vereinfachend von
 * einer einmaligen Vollauszahlung aus (wie der Rest des Kredit-Modells hier),
 * nicht von tranchenweiser Auszahlung. Gibt null zurück, wenn Vertragsdatum
 * oder Zinssatz fehlen - 0, wenn die Auszahlung noch innerhalb der
 * bereitstellungsfreien Zeit liegt.
 */
export function calcBereitstellungszinsen(
  loan: Pick<Loan, 'contract_date' | 'bereitstellungszins_rate' | 'bereitstellungsfreie_monate' | 'disbursement_date' | 'principal'>
): number | null {
  if (!loan.contract_date || loan.bereitstellungszins_rate == null) return null
  const freizeitEnde = addMonths(new Date(loan.contract_date), loan.bereitstellungsfreie_monate ?? 0)
  const months = differenceInCalendarMonths(new Date(loan.disbursement_date), freizeitEnde)
  if (months <= 0) return 0
  return Math.round(loan.principal * (loan.bereitstellungszins_rate / 100 / 12) * months * 100) / 100
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
      (sum, { loan, result }) => sum + balanceAtDate(result.entries, loan.principal, d, loan.disbursement_date),
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

  // Noch nicht ausgezahlte Kredite (Auszahlungsdatum in der Zukunft) zahlen
  // noch keine Rate - sonst würde z.B. eine geplante Anschlussfinanzierung
  // schon Jahre vor Auszahlung die aktuelle Kreditrate/den Cashflow verzerren.
  const monthlyDebtService = loans.reduce(
    (s, l, i) => new Date(l.disbursement_date) > asOfDate
      ? s
      : s + loanStatuses[i].current_annuity_amount * (periodsPerYear(l.payment_frequency) / 12),
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
    new_remaining_balance: balanceAtDate(withPayment.entries, loan.principal, asOfDate, loan.disbursement_date),
  }
}
