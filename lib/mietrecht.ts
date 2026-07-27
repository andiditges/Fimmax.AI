import { addMonths, differenceInCalendarMonths, startOfMonth } from 'date-fns'
import { currentRentAmount } from './rent-schedule'
import { RentalAgreement } from './types'
import gemeindenData from './data/kappungsgrenze-gemeinden.json'

export type MietrechtStatus = 'kappungsgrenze' | 'mietpreisbremse' | 'beides'

export interface GemeindeEintrag {
  ags: number
  name: string
  status: MietrechtStatus
  population: number
}

const gemeinden = gemeindenData as GemeindeEintrag[]

// Amtliche Gemeindenamen tragen oft einen Zusatz ("Stadt", "Hansestadt" o.ä.),
// der beim Abgleich mit der Ortsangabe aus der Objektadresse (die diesen
// Zusatz i.d.R. nicht enthält) stört.
function normalizeGemeindename(name: string): string {
  return name
    .split(',')[0]
    .trim()
    .toLowerCase()
}

const gemeindenByName = new Map<string, GemeindeEintrag>()
for (const g of gemeinden) {
  gemeindenByName.set(normalizeGemeindename(g.name), g)
}

// Objektadressen werden im Format "Straße Hausnummer, PLZ Ort" gepflegt
// (siehe AddressAutocomplete) - der Ortsname ist damit der Teil nach der
// letzten PLZ-Ziffernfolge im letzten Adressabschnitt.
export function extractCityFromAddress(address: string): string | null {
  const parts = address.split(',')
  const last = parts[parts.length - 1]?.trim()
  if (!last) return null
  const city = last.replace(/^\d{4,5}\s*/, '').trim()
  return city.length > 0 ? city : null
}

export function findGemeindeByName(cityName: string): GemeindeEintrag | null {
  return gemeindenByName.get(cityName.trim().toLowerCase()) ?? null
}

export function findGemeindeForAddress(address: string): GemeindeEintrag | null {
  const city = extractCityFromAddress(address)
  return city ? findGemeindeByName(city) : null
}

// Normale Kappungsgrenze nach § 558 Abs. 3 BGB: 20 % in 3 Jahren, in per
// Kappungsgrenzenverordnung ausgewiesenen Gebieten mit angespanntem
// Wohnungsmarkt abgesenkt auf 15 %.
export function kappungsgrenzePercent(match: GemeindeEintrag | null): number {
  if (!match) return 20
  return match.status === 'mietpreisbremse' ? 20 : 15
}

export const MIETRECHT_STATUS_LABEL: Record<MietrechtStatus, string> = {
  kappungsgrenze: 'abgesenkte Kappungsgrenze (15 % statt 20 % in 3 Jahren)',
  mietpreisbremse: 'Mietpreisbremse (nur für neu abgeschlossene Mietverträge relevant)',
  beides: 'Mietpreisbremse + abgesenkte Kappungsgrenze (15 % statt 20 % in 3 Jahren)',
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface Section558Status {
  current_rent: number
  reference_rent: number
  reference_date: string
  reference_is_future: boolean
  months_since_reference: number
  wartefrist_erfuellt: boolean
  next_request_possible_date: string
  earliest_effective_date: string
  base_rent_36_months: number | null
  percent_increase_36_months: number | null
  kappungsgrenze_percent: number
  kappungsgrenze_remaining_percent: number | null
  kappungsgrenze_remaining_amount: number | null
}

/**
 * Status für eine reguläre Mieterhöhung nach § 558 BGB (Anpassung an die
 * ortsübliche Vergleichsmiete) - für Mietverhältnisse OHNE Staffel- oder
 * Indexmiete, die eigene Erhöhungsmechanismen mit eigenen Fristen haben.
 * Als Referenzpunkt dient bewusst die chronologisch NEUESTE hinterlegte
 * Mietvereinbarung (auch wenn ihr start_date noch in der Zukunft liegt, z.B.
 * eine bereits vereinbarte, aber noch nicht wirksame Erhöhung) - unabhängig
 * davon, ob diese Änderung einseitig per § 558 oder einvernehmlich zustande
 * kam: beides setzt für eine SPÄTERE einseitige Erhöhung die Wartefrist und
 * die Kappungsgrenze gleichermaßen neu in Gang bzw. zählt in deren
 * 3-Jahres-Vergleich mit.
 * Zwei unabhängige Grenzen:
 * - Wartefrist (§ 558 Abs. 1 BGB): die Miete muss seit 15 Monaten unverändert
 *   sein, bevor eine Erhöhung verlangt werden darf. Die Erhöhung selbst wirkt
 *   dann erst ab Beginn des 3. Kalendermonats nach Zugang des Verlangens
 *   (§ 558b Abs. 1 BGB) - hier vereinfachend direkt nach Ablauf der
 *   Wartefrist angenommen, ohne Gewähr für den tatsächlichen Zustelltermin.
 * - Kappungsgrenze (§ 558 Abs. 3 BGB): max. 20 % (bzw. 15 % in ausgewiesenen
 *   Gebieten) Erhöhung innerhalb von 3 Jahren, gemessen an der Miete, die 3
 *   Jahre vor dem frühestmöglichen Wirksamwerden der nächsten Erhöhung galt
 *   (bzw. der ursprünglichen Vertragsmiete, falls die Mietdauer zu diesem
 *   Zeitpunkt noch keine 3 Jahre beträgt).
 */
export function calcSection558Status(
  agreements: RentalAgreement[],
  kappungsgrenzePercentValue: number,
  asOfDate: Date = new Date()
): Section558Status | null {
  const sortedAgreements = [...agreements].sort((a, b) => a.start_date.localeCompare(b.start_date))
  if (sortedAgreements.length === 0) return null
  const earliestAgreement = sortedAgreements[0]
  const referenceAgreement = sortedAgreements[sortedAgreements.length - 1]
  const currentRent = currentRentAmount(agreements, asOfDate) ?? earliestAgreement.rent_amount

  const referenceDate = new Date(referenceAgreement.start_date)
  const monthsSinceReference = differenceInCalendarMonths(asOfDate, referenceDate)
  const wartefristErfuellt = monthsSinceReference >= 15
  const nextRequestPossibleDate = addMonths(referenceDate, 15)
  const earliestEffectiveDate = startOfMonth(addMonths(nextRequestPossibleDate, 3))

  const threeYearsBeforeEffective = new Date(
    earliestEffectiveDate.getFullYear() - 3, earliestEffectiveDate.getMonth(), earliestEffectiveDate.getDate()
  )
  const baseRent36Months = currentRentAmount(agreements, threeYearsBeforeEffective) ?? earliestAgreement.rent_amount

  const percentIncrease36Months = baseRent36Months > 0
    ? ((referenceAgreement.rent_amount - baseRent36Months) / baseRent36Months) * 100
    : null
  const kappungsgrenzeRemainingPercent = percentIncrease36Months !== null
    ? Math.max(0, kappungsgrenzePercentValue - percentIncrease36Months)
    : null
  const kappungsgrenzeRemainingAmount = kappungsgrenzeRemainingPercent !== null && baseRent36Months
    ? baseRent36Months * (kappungsgrenzeRemainingPercent / 100)
    : null

  return {
    current_rent: currentRent,
    reference_rent: referenceAgreement.rent_amount,
    reference_date: referenceAgreement.start_date,
    reference_is_future: referenceDate > asOfDate,
    months_since_reference: monthsSinceReference,
    wartefrist_erfuellt: wartefristErfuellt,
    next_request_possible_date: iso(nextRequestPossibleDate),
    earliest_effective_date: iso(earliestEffectiveDate),
    base_rent_36_months: baseRent36Months,
    percent_increase_36_months: percentIncrease36Months,
    kappungsgrenze_percent: kappungsgrenzePercentValue,
    kappungsgrenze_remaining_percent: kappungsgrenzeRemainingPercent,
    kappungsgrenze_remaining_amount: kappungsgrenzeRemainingAmount,
  }
}
