import { differenceInCalendarMonths, addMonths } from 'date-fns'
import { RentalAgreement, VpiReading } from './types'

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function latestVpiReading(readings: VpiReading[]): VpiReading | null {
  if (readings.length === 0) return null
  return [...readings].sort((a, b) => b.month.localeCompare(a.month))[0]
}

export interface IndexmieteStatus {
  current_rent: number
  base_value: number
  base_date: string
  latest_value: number
  latest_month: string
  percent_change: number
  possible_new_rent: number
  months_since_base: number
  eligible: boolean
  earliest_next_date: string
}

// § 557b BGB: die Miete darf frühestens nach Ablauf eines Jahres seit der
// letzten Erhöhung (bzw. seit Vertragsbeginn) erneut angepasst werden, und
// zwar proportional zur Indexveränderung. Die Erklärung muss der Vermieter
// aktiv abgeben (nicht automatisch) - diese Berechnung zeigt nur, was
// rechnerisch möglich wäre, ersetzt keine Rechtsberatung.
export function calcIndexmieteStatus(
  agreement: RentalAgreement,
  latestReading: VpiReading,
  asOfDate: Date = new Date()
): IndexmieteStatus | null {
  if (!agreement.is_index_rent || !agreement.index_base_value || !agreement.index_base_date) return null

  const baseValue = agreement.index_base_value
  const latestValue = latestReading.value
  const percentChange = ((latestValue - baseValue) / baseValue) * 100
  const possibleNewRent = Math.round(agreement.rent_amount * (latestValue / baseValue) * 100) / 100
  const baseDate = new Date(agreement.index_base_date)
  const monthsSinceBase = differenceInCalendarMonths(asOfDate, baseDate)
  const earliestNext = addMonths(baseDate, 12)

  return {
    current_rent: agreement.rent_amount,
    base_value: baseValue,
    base_date: agreement.index_base_date,
    latest_value: latestValue,
    latest_month: latestReading.month,
    percent_change: percentChange,
    possible_new_rent: possibleNewRent,
    months_since_base: monthsSinceBase,
    eligible: monthsSinceBase >= 12,
    earliest_next_date: iso(earliestNext),
  }
}
