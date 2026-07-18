import { RentAdjustment, RentalAgreement, RentScheduleEntry, Tenant } from '@/lib/types'

function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function monthKey(year: number, monthIndex: number): string {
  return iso(new Date(year, monthIndex, 1))
}

export function generateRentSchedule(
  tenant: Tenant,
  agreements: RentalAgreement[],
  adjustments: RentAdjustment[],
  fromMonth: Date,
  throughMonth: Date
): RentScheduleEntry[] {
  const sortedAgreements = [...agreements].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const moveIn = new Date(tenant.move_in_date)
  const moveOut = tenant.move_out_date ? new Date(tenant.move_out_date) : null

  const rangeStart = new Date(Math.max(
    new Date(moveIn.getFullYear(), moveIn.getMonth(), 1).getTime(),
    new Date(fromMonth.getFullYear(), fromMonth.getMonth(), 1).getTime()
  ))
  const rangeEndCandidates = [new Date(throughMonth.getFullYear(), throughMonth.getMonth(), 1)]
  if (moveOut) rangeEndCandidates.push(new Date(moveOut.getFullYear(), moveOut.getMonth(), 1))
  const rangeEnd = new Date(Math.min(...rangeEndCandidates.map(d => d.getTime())))

  const entries: RentScheduleEntry[] = []
  const cursor = new Date(rangeStart)

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const key = monthKey(year, month)
    const totalDays = daysInMonth(year, month)

    const activeAgreement = [...sortedAgreements]
      .reverse()
      .find(a => a.start_date <= iso(new Date(year, month, totalDays)))

    const adjustment = adjustments.find(a => a.month === key)

    if (adjustment) {
      entries.push({ month: key, amount: adjustment.override_amount, is_override: true, note: adjustment.note })
    } else if (activeAgreement) {
      let amount = activeAgreement.rent_amount

      const isMoveInMonth = year === moveIn.getFullYear() && month === moveIn.getMonth()
      const isMoveOutMonth = moveOut && year === moveOut.getFullYear() && month === moveOut.getMonth()

      if (isMoveInMonth && moveIn.getDate() > 1) {
        const daysRented = totalDays - moveIn.getDate() + 1
        amount = Math.round((amount * daysRented / totalDays) * 100) / 100
      } else if (isMoveOutMonth && moveOut && moveOut.getDate() < totalDays) {
        const daysRented = moveOut.getDate()
        amount = Math.round((amount * daysRented / totalDays) * 100) / 100
      }

      entries.push({ month: key, amount, is_override: false, note: null })
    }

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return entries
}

export function sumRentForYear(
  tenants: Tenant[],
  agreementsByTenant: Record<string, RentalAgreement[]>,
  adjustmentsByTenant: Record<string, RentAdjustment[]>,
  year: number
): number {
  const from = new Date(year, 0, 1)
  const through = new Date(year, 11, 1)
  return tenants.reduce((sum, t) => {
    const schedule = generateRentSchedule(t, agreementsByTenant[t.id] ?? [], adjustmentsByTenant[t.id] ?? [], from, through)
    return sum + schedule.reduce((s, e) => s + e.amount, 0)
  }, 0)
}

export function sumRentForMonth(
  tenants: Tenant[],
  agreementsByTenant: Record<string, RentalAgreement[]>,
  adjustmentsByTenant: Record<string, RentAdjustment[]>,
  asOfDate: Date = new Date()
): number {
  const monthStart = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1)
  return tenants.reduce((sum, t) => {
    const schedule = generateRentSchedule(t, agreementsByTenant[t.id] ?? [], adjustmentsByTenant[t.id] ?? [], monthStart, monthStart)
    return sum + schedule.reduce((s, e) => s + e.amount, 0)
  }, 0)
}

export interface StaffelStep {
  start_date: string
  rent_amount: number
}

// Erhöht die Miete jedes Jahr um den vereinbarten Prozentsatz gegenüber der
// zuletzt geltenden (nicht der anfänglichen) Miete, Schritt für Schritt auf
// den Cent gerundet - so wie es in Staffelmiet-Verträgen üblich tabelliert
// wird (z.B. 730,00 € -> 748,25 € -> 766,96 € bei 2,5%/Jahr).
export function generateStaffelSchedule(
  baseAmount: number,
  annualIncreasePercent: number,
  years: number,
  startDate: string
): StaffelStep[] {
  const steps: StaffelStep[] = []
  let amount = baseAmount
  const start = new Date(startDate)
  for (let year = 0; year < years; year++) {
    if (year > 0) amount = Math.round(amount * (1 + annualIncreasePercent / 100) * 100) / 100
    const stepDate = new Date(start.getFullYear() + year, start.getMonth(), start.getDate())
    steps.push({ start_date: iso(stepDate), rent_amount: amount })
  }
  return steps
}

export function currentAgreement(agreements: RentalAgreement[], asOfDate: Date = new Date()): RentalAgreement | null {
  const applicable = [...agreements]
    .filter(a => a.start_date <= iso(asOfDate))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  return applicable.length > 0 ? applicable[applicable.length - 1] : null
}

export function currentRentAmount(agreements: RentalAgreement[], asOfDate: Date = new Date()): number | null {
  return currentAgreement(agreements, asOfDate)?.rent_amount ?? null
}
