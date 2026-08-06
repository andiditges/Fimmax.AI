import { Property, ThresholdStatus } from './types'
import { ReceiptAllocation } from './receipt-allocations'

export function calc15Threshold(property: Property, allocations: ReceiptAllocation[]): ThresholdStatus {
  const purchaseDate = new Date(property.purchase_date)
  const cutoffDate = new Date(purchaseDate)
  cutoffDate.setFullYear(cutoffDate.getFullYear() + 3)

  const within3Years = new Date() <= cutoffDate

  // Bewusst ohne untere Datumsgrenze: Renovierungskosten, die noch vor dem
  // offiziellen Besitzübergang anfallen (z.B. mit Duldung des Verkäufers
  // bereits vorab beauftragt), stehen im wirtschaftlichen Zusammenhang mit
  // der Anschaffung und zählen für die 15%-Grenze ebenso mit wie Kosten
  // danach - nur die Obergrenze (3 Jahre nach Anschaffung) ist relevant.
  const renovationTotal = allocations
    .filter(a => {
      const date = new Date(a.receipt_date)
      return a.is_renovation && date <= cutoffDate
    })
    .reduce((sum, a) => sum + a.amount, 0)

  const threshold15 = property.building_value * 0.15
  const percentage = threshold15 > 0 ? (renovationTotal / threshold15) * 100 : 0

  let alertLevel: ThresholdStatus['alert_level'] = 'safe'
  if (percentage >= 100) alertLevel = 'exceeded'
  else if (percentage >= 87) alertLevel = 'danger'
  else if (percentage >= 67) alertLevel = 'warning'

  return {
    renovation_total: renovationTotal,
    threshold_15: threshold15,
    percentage,
    within_3_years: within3Years,
    cutoff_date: cutoffDate.toISOString().slice(0, 10),
    alert_level: alertLevel,
  }
}
