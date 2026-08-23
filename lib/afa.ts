import { Property, DepreciableItem, ReceiptCategory } from './types'
import { propertyValue } from './format'
import { ReceiptAllocation } from './receipt-allocations'

// Gesetzliche Standard-Restnutzungsdauer nach § 7 Abs. 4 EStG, nur als
// Startwert gedacht. Ein Restnutzungsdauergutachten kann davon abweichen
// (typischerweise 10-50 Jahre) und geht dann vor.
export function suggestUsageDuration(buildYear: number): number {
  if (buildYear >= 2023) return 33
  if (buildYear >= 1925) return 50
  return 40
}

const KAUFNEBENKOSTEN_AFA_CATEGORIES: ReceiptCategory[] = ['notar_kauf', 'grundbuch_kauf', 'makler_kauf']

// Notar/Grundbuch/Makler sind Anschaffungsnebenkosten (§ 255 Abs. 1 HGB) und
// erhöhen die AfA-Bemessungsgrundlage. Beleg-Summe hat Vorrang vor der alten
// manuellen Eingabe (property.incidental_costs, aus dem inzwischen entfernten
// Posten-Modus im Objekt-Formular) - sobald mindestens ein passender Beleg
// existiert, ersetzt er den Alt-Wert komplett statt ihn aufzuaddieren, sonst
// Doppelzählung für Bestandsobjekte mit alten manuellen Einträgen.
// Grunderwerbsteuer bewusst NICHT über Belege gezählt (auch wenn die
// Beleg-Kategorie 'grunderwerbsteuer' existiert) - das automatisch berechnete
// property.grunderwerbsteuer-Feld bleibt dafür allein maßgeblich, sonst zählt
// ein zusätzlich hochgeladener Steuerbescheid doppelt.
export function calcIncidentalCostsForAfa(
  propertyId: string,
  allocations: ReceiptAllocation[],
  property: Pick<Property, 'incidental_costs' | 'grunderwerbsteuer'>
): number {
  const receiptSum = allocations
    .filter(a => a.property_id === propertyId && KAUFNEBENKOSTEN_AFA_CATEGORIES.includes(a.category))
    .reduce((s, a) => s + a.amount, 0)
  const notarGrundbuchMakler = receiptSum > 0 ? receiptSum : property.incidental_costs
  return notarGrundbuchMakler + (property.grunderwerbsteuer ?? 0)
}

export function calcAnnualAfa(property: Property, incidentalCostsForAfa: number = 0): number {
  // Nur der Gebäudeanteil ist abschreibbar - Kaufnebenkosten werden daher im
  // bestehenden Grundstücks-/Gebäude-Verhältnis anteilig aufgeteilt, nicht
  // komplett der Gebäude-AfA-Basis zugeschlagen.
  const effectiveBuildingValue = property.purchase_price > 0
    ? property.building_value + incidentalCostsForAfa * (property.building_value / property.purchase_price)
    : property.building_value
  return effectiveBuildingValue * (property.afa_rate / 100)
}

export function calcCumulativeAfa(property: Property, asOfYear: number): number {
  const startYear = new Date(property.purchase_date).getFullYear()
  const years = Math.max(0, asOfYear - startYear + 1)
  return Math.min(calcAnnualAfa(property) * years, property.building_value)
}

// Bewegliche Wirtschaftsgüter (z.B. Einbauküche) haben eine eigene, meist
// kürzere Nutzungsdauer als das Gebäude und werden linear über diese
// abgeschrieben - kein Monats-Pro-Rata, analog zur Gebäude-AfA oben (das
// Anschaffungsjahr zählt voll).
export function calcAnnualMovableAfa(item: Pick<DepreciableItem, 'acquisition_cost' | 'usage_duration_years'>): number {
  return item.acquisition_cost / item.usage_duration_years
}

export function isMovableAfaActiveInYear(item: Pick<DepreciableItem, 'acquisition_date' | 'usage_duration_years'>, year: number): boolean {
  const startYear = new Date(item.acquisition_date).getFullYear()
  return year >= startYear && year < startYear + item.usage_duration_years
}

// Ein Nutzungsdauergutachten (Kurzgutachten zur Restnutzungsdauer) kann eine
// kürzere als die gesetzlich unterstellte Restnutzungsdauer nachweisen und so
// die jährliche AfA erhöhen - lohnt sich tendenziell bei älteren Gebäuden
// (Baujahr vor 2000, da der gesetzliche Standardwert dann oft noch 40-50
// Jahre Restnutzungsdauer unterstellt, obwohl das Gebäude schon deutlich
// älter ist) oder wenn mehrere Ausstattungsmerkmale als "alt" markiert sind
// (Indiz für tatsächlich kürzere Restnutzungsdauer als der Standardwert).
export function shouldRecommendNutzungsdauergutachten(
  property: Pick<Property, 'build_year' | 'condition_windows' | 'condition_electrical' | 'condition_bathroom' | 'condition_heating'>
): boolean {
  if (property.build_year < 2000) return true
  const conditions = [property.condition_windows, property.condition_electrical, property.condition_bathroom, property.condition_heating]
  return conditions.filter(c => c === 'alt').length >= 2
}

export interface EhegattenschaukelPotential {
  current_annual_afa: number
  potential_annual_afa: number
  delta_annual_afa: number
  new_usage_duration: number
}

/**
 * Ehegattenschaukel: Verkauf an den Ehepartner zum aktuellen Marktwert lässt
 * AfA-Bemessungsgrundlage und Restnutzungsdauer neu starten. Potenzial ist
 * die Differenz zur bisherigen AfA - wächst mit Wertsteigerung seit Kauf und
 * mit bereits verstrichener Nutzungsdauer. Rein informativ, keine
 * Steuerberatung; Grundstücks-/Gebäude-Verhältnis wird dabei unverändert
 * übernommen, da eine neue Kaufpreisaufteilung ohnehin erst beim tatsächlichen
 * Verkauf feststünde.
 */
export function calcEhegattenschaukelPotential(property: Property): EhegattenschaukelPotential {
  const currentAnnualAfa = calcAnnualAfa(property)
  const buildingShare = property.purchase_price > 0 ? property.building_value / property.purchase_price : 0
  const newBuildingValue = propertyValue(property) * buildingShare
  const newUsageDuration = suggestUsageDuration(property.build_year)
  const potentialAnnualAfa = newBuildingValue * (100 / newUsageDuration) / 100

  return {
    current_annual_afa: currentAnnualAfa,
    potential_annual_afa: potentialAnnualAfa,
    delta_annual_afa: potentialAnnualAfa - currentAnnualAfa,
    new_usage_duration: newUsageDuration,
  }
}
