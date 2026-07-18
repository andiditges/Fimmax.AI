import { PropertyReserve } from './types'

export function sumReserveCurrentValue(reserves: PropertyReserve[]): number {
  return reserves.reduce((s, r) => s + r.current_value, 0)
}

// Nur Rücklagen, die laut Andi tatsächlich aus der Kaltmiete gebildet werden,
// zählen als echter monatlicher Abfluss fürs Cashflow-Bild - sonst würde eine
// rein buchhalterisch geführte Rücklage (aus anderen Mitteln gebildet) den
// verfügbaren Cashflow fälschlich schmälern.
export function sumMonthlyReserveFromRent(reserves: PropertyReserve[]): number {
  return reserves.filter(r => r.funded_from_rent).reduce((s, r) => s + r.monthly_contribution, 0)
}
