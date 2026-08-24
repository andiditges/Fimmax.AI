import { addMonths, isAfter } from 'date-fns'
import type { Property, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment, AmortizationEntry } from './types'
import { iso, aggregateLoanChains } from './amortization'
import { sumRentForMonth } from './rent-schedule'
import { calcIncidentalCostsForAfa } from './afa'
import type { ReceiptAllocation } from './receipt-allocations'
import type { CapitalRecovery } from './types'

/**
 * Aus eigener Tasche eingesetztes Kapital je Objekt: Kaufpreis + Kaufneben-
 * kosten (Notar/Grundbuch/Makler + Grunderwerbsteuer, wie calcIncidentalCostsForAfa -
 * seit Belege die einzige Quelle dafür sind, siehe lib/afa.ts, ist das
 * property.incidental_costs-Feld allein veraltet/oft leer) abzüglich dessen,
 * was Kredite auf dieses Objekt bereits abdecken, PLUS nach dem Kauf selbst
 * bezahlte Renovierungs-/Sanierungsbelege (is_renovation) - die sind vom
 * ursprünglichen Kaufkredit nicht abgedeckt, aber genauso eingesetztes Kapital.
 * Bei Vollfinanzierung (Kredit deckt auch noch die Kaufnebenkosten) wird der
 * Kaufpreis-Anteil pro Objekt bei 0 gekappt statt negativ zu werden - das wäre
 * kein "eingesetztes Eigenkapital", sondern zusätzlich finanziertes Geld.
 * Nutzt aggregateLoanChains statt der rohen Kredit-principals zu summieren,
 * damit eine Anschlussfinanzierung (zwei Kredit-Datensätze für dieselbe
 * Immobilie) nicht als zusätzlich finanziertes Geld doppelt gezählt wird.
 */
export function totalEquityInvested(
  properties: Property[],
  loans: Loan[],
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]> = {},
  allocations: ReceiptAllocation[] = []
): number {
  return properties.reduce((sum, p) => {
    const loanPrincipal = aggregateLoanChains(loans.filter(l => l.property_id === p.id), specialPaymentsByLoan)
      .reduce((s, c) => s + c.financed, 0)
    const acquisitionCost = p.purchase_price + calcIncidentalCostsForAfa(p.id, allocations, p)
    const renovationCosts = allocations
      .filter(a => a.property_id === p.id && a.is_renovation)
      .reduce((s, a) => s + a.amount, 0)
    return sum + Math.max(0, acquisitionCost - loanPrincipal) + renovationCosts
  }, 0)
}

export interface EquityBreakEvenResult {
  equity_invested: number
  break_even_date: string | null
  already_reached: boolean
}

/**
 * Simuliert Monat für Monat (ab dem frühesten Kaufdatum im Portfolio) die
 * kumulierte Rückgewinnung des eingesetzten Eigenkapitals, bis sie dieses
 * erreicht. Rückgewinnung = Cashflow (Miete minus Zins minus Kosten minus
 * Rücklagenbildung) PLUS die im selben Monat geleistete Tilgung (inkl.
 * Sondertilgungen). Die Tilgung zählt bewusst nicht als Kosten: sie wird aus
 * der Miete (oder notfalls aus eigener Tasche) bezahlt, wandelt Fremd- aber
 * unmittelbar 1:1 in Eigenkapital um - sie ist also nie verloren, sondern nur
 * von "Cash" zu "Immobilienwert" umgeschichtet. Rechnerisch heben sich Abzug
 * und Rückgewinnung der Tilgung exakt auf; nur Zins, laufende Kosten und
 * Rücklagenbildung bleiben als echte, nicht zurückkommende Belastung übrig.
 * Kosten-/Rücklagen-Laufrate werden dabei bewusst als konstante Monatsrate
 * angenommen (dieselbe Vereinfachung wie beim bestehenden "Stand heute"-
 * Cockpit) - exakt wär das nur mit einer vollständigen Kosten-Historie
 * möglich. Sonstige Rückflüsse (capitalRecoveries, z.B. der Immobilien-
 * Anteil einer Steuerrückerstattung) zählen im jeweiligen Monat ihres
 * recovery_date voll als zusätzliche Rückgewinnung.
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
  capitalRecoveries: CapitalRecovery[] = [],
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

  // Kosten-/Rücklagen-Laufrate ist die heutige Rate fürs GESAMTE (aktuelle)
  // Portfolio - ohne Skalierung würde sie fälschlich schon ab dem allerersten
  // Kaufmonat in voller Höhe angesetzt, obwohl zu dem Zeitpunkt oft nur ein
  // Bruchteil der heutigen Objekte überhaupt existierte, und den Break-even
  // dadurch künstlich weit nach hinten verschieben. Skaliert deshalb pro
  // Monat mit dem Anteil der bis dahin bereits gekauften Objekte - dieselbe
  // grobe Näherung wie beim Rest der Simulation, aber konsistent mit Miete/
  // Zins/Tilgung, die schon automatisch erst ab Kauf-/Kreditbeginn greifen.
  const totalProps = properties.length

  while (!isAfter(cursor, horizon)) {
    const monthPrefix = iso(cursor).slice(0, 7)
    const rent = sumRentForMonth(tenants, agreementsByTenant, adjustmentsByTenant, cursor)
    const monthEntries = loanSchedules.flatMap(({ entries }) => entries.filter(e => e.date.slice(0, 7) === monthPrefix))
    const interestCost = monthEntries.reduce((s, e) => s + e.interest_accrued, 0)
    // Tilgung wird unten nicht abgezogen (siehe Doc-Kommentar) - sie baut
    // Eigenkapital im gleichen Wert auf, den sie kostet.
    const ownedProps = properties.filter(p => p.purchase_date.slice(0, 7) <= monthPrefix).length
    const portfolioFraction = ownedProps / totalProps
    const recoveries = capitalRecoveries
      .filter(r => r.recovery_date.slice(0, 7) === monthPrefix)
      .reduce((s, r) => s + r.amount, 0)
    const net = rent - interestCost - monthlyOperatingCostRunrate * portfolioFraction - monthlyReserveFromRent * portfolioFraction + recoveries

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
