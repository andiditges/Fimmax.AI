export interface DuplicateCandidate {
  id: string
  property_id: string
  receipt_date: string
  amount: number
  vendor: string | null
  description: string | null
}

export interface DuplicateMatch {
  receipt: DuplicateCandidate
  reason: string
}

const DATE_TOLERANCE_DAYS = 3

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000
}

// Erkennt wahrscheinliche Doppel-Erfassungen: identischer Betrag auf
// demselben Objekt, dessen Datum nur wenige Tage vom Kandidaten abweicht
// (z.B. Beleg versehentlich zweimal hochgeladen, oder Rechnungs- vs.
// Zahlungsdatum leicht unterschiedlich erfasst). Die Datumsnähe ist dabei
// Pflicht, nicht nur ein Bonus-Signal - sonst würde ein legitimer
// wiederkehrender Beleg (z.B. monatliches Hausgeld, gleicher Lieferant,
// gleicher Betrag, aber ein anderer Monat) fälschlich als Duplikat markiert.
// Gleicher Lieferant ist zusätzlich zur Datumsnähe nur ein Signal für den
// Anzeige-Text, kein eigenständiges Match-Kriterium.
export function findLikelyDuplicates(
  candidate: { property_id: string; amount: number; receipt_date: string; vendor: string | null },
  existing: DuplicateCandidate[],
  excludeId?: string
): DuplicateMatch[] {
  if (!candidate.amount || !candidate.receipt_date) return []
  const vendor = candidate.vendor?.trim().toLowerCase() || null

  return existing
    .filter(r => r.id !== excludeId && r.property_id === candidate.property_id)
    .filter(r => Math.abs(r.amount - candidate.amount) < 0.01)
    .filter(r => daysBetween(r.receipt_date, candidate.receipt_date) <= DATE_TOLERANCE_DAYS)
    .map(r => {
      const sameVendor = Boolean(vendor && r.vendor && r.vendor.trim().toLowerCase() === vendor)
      return { receipt: r, reason: sameVendor ? 'gleicher Betrag, Lieferant und Datum' : 'gleicher Betrag, Datum nah beieinander' }
    })
}
