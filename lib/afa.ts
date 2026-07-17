import { Property } from './types'

// Gesetzliche Standard-Restnutzungsdauer nach § 7 Abs. 4 EStG, nur als
// Startwert gedacht. Ein Restnutzungsdauergutachten kann davon abweichen
// (typischerweise 10-50 Jahre) und geht dann vor.
export function suggestUsageDuration(buildYear: number): number {
  if (buildYear >= 2023) return 33
  if (buildYear >= 1925) return 50
  return 40
}

export function calcAnnualAfa(property: Property): number {
  return property.building_value * (property.afa_rate / 100)
}

export function calcCumulativeAfa(property: Property, asOfYear: number): number {
  const startYear = new Date(property.purchase_date).getFullYear()
  const years = Math.max(0, asOfYear - startYear + 1)
  return Math.min(calcAnnualAfa(property) * years, property.building_value)
}
