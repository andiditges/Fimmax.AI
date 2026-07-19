import { addMonths, isAfter } from 'date-fns'
import type { Property, Loan, Tenant, RentalAgreement, RentAdjustment, AmortizationEntry } from './types'
import { iso } from './amortization'
import { sumRentForMonth } from './rent-schedule'

/**
 * Aus eigener Tasche eingesetztes Kapital je Objekt: Kaufpreis + Nebenkosten
 * (Kaufnebenkosten-Feld + Grunderwerbsteuer) abzüglich dessen, was Kredite auf
 * dieses Objekt bereits abdecken. Bei Vollfinanzierung (Kredit deckt auch noch
 * Renovierung o.ä.) wird pro Objekt bei 0 gekappt statt negativ zu werden -
 * das wäre kein "eingesetztes Eigenkapital", sondern zusätzlich finanziertes Geld.
 */
export function totalEquityInvested(properties: Property[], loans: Loan[]): number {
  return properties.reduce((sum, p) => {
    const loanPrincipal = loans
      .filter(l => l.property_id === p.id)
      .reduce((s, l) => s + l.principal, 0)
    const acquisitionCost = p.purchase_price + p.incidental_costs + (p.grunderwerbsteuer ?? 0)
    return sum + Math.max(0, acquisitionCost - loanPrincipal)
  }, 0)
}

export interface EquityBreakEvenResult {
  equity_invested: number
  break_even_date: string | null
  already_reached: boolean
}

/**
 * Simuliert Monat für Monat (ab dem frühesten Kaufdatum im Portfolio) die
 * reale Cashflow-Summe - Miete minus Zins/Tilgung aller Kredite minus
 * Kosten-Laufrate minus Rücklagenbildung -, bis diese kumuliert das
 * eingesetzte Eigenkapital erreicht. Kosten-/Rücklagen-Laufrate werden dabei
 * bewusst als konstante Monatsrate über die gesamte Zeitspanne angenommen
 * (dieselbe Vereinfachung wie beim bestehenden "Stand heute"-Cockpit) -
 * exakt wär das nur mit einer vollständigen Kosten-Historie möglich.
 */
export function calcEquityBreakEven(
  properties: Property[],
  loanSchedules: { loan: Loan; entries: AmortizationEntry[] }[],
  tenants: Tenant[],
  agreementsByTenant: Record<string, RentalAgreement[]>,
  adjustmentsByTenant: Record<string, RentAdjustment[]>,
  monthlyOperatingCostRunrate: number,
  monthlyReserveFromRent: number,
  equityInvested: number,
  asOfDate: Date = new Date(),
  maxYears = 100
): EquityBreakEvenResult {
  if (properties.length === 0 || equityInvested <= 0) {
    return { equity_invested: equityInvested, break_even_date: null, already_reached: equityInvested <= 0 }
  }

  const earliestPurchase = properties.reduce(
    (min, p) => (p.purchase_date < min ? p.purchase_date : min),
    properties[0].purchase_date
  )
  let cursor = new Date(new Date(earliestPurchase).getFullYear(), new Date(earliestPurchase).getMonth(), 1)
  const horizon = addMonths(cursor, maxYears * 12)

  let cumulative = 0

  while (!isAfter(cursor, horizon)) {
    const monthPrefix = iso(cursor).slice(0, 7)
    const rent = sumRentForMonth(tenants, agreementsByTenant, adjustmentsByTenant, cursor)
    const debtService = loanSchedules.reduce(
      (s, { entries }) =>
        s +
        entries
          .filter(e => e.date.slice(0, 7) === monthPrefix)
          .reduce((s2, e) => s2 + e.interest_accrued + e.scheduled_principal + e.special_payment, 0),
      0
    )
    const net = rent - debtService - monthlyOperatingCostRunrate - monthlyReserveFromRent

    const before = cumulative
    cumulative += net

    if (cumulative >= equityInvested) {
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      const fraction = net > 0 ? Math.min(1, (equityInvested - before) / net) : 1
      const day = Math.max(1, Math.round(fraction * daysInMonth))
      const breakEvenDate = new Date(cursor.getFullYear(), cursor.getMonth(), day)
      const already = !isAfter(breakEvenDate, asOfDate)
      return { equity_invested: equityInvested, break_even_date: iso(breakEvenDate), already_reached: already }
    }

    cursor = addMonths(cursor, 1)
  }

  return { equity_invested: equityInvested, break_even_date: null, already_reached: false }
}
