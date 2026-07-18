import { OperatingCostCategory, Tenant } from './types'

export interface OperatingCostCategoryConfig {
  key: OperatingCostCategory
  label: string
  group: 'umlagefaehig' | 'nicht_umlagefaehig'
  defaultAllocable: boolean
  highlight?: string
}

// Umlagefähige Kosten folgen den 17 Betriebskostenarten nach § 2 BetrKV (an
// Mieter weiterberechenbar). Verwaltung/Instandhaltung/Rücklage sind für
// Wohnraum gesetzlich NIE umlagefähig (§ 556 BGB) und bleiben deshalb ohne
// Umlagefähig-Schalter in der UI.
export const OPERATING_COST_CATEGORIES: OperatingCostCategoryConfig[] = [
  {
    key: 'grundsteuer', label: 'Grundsteuer', group: 'umlagefaehig', defaultAllocable: true,
    highlight: 'Wird in Hausgeld-/WEG-Abrechnungen oft nicht separat ausgewiesen – auf der Jahresabrechnung gezielt danach suchen, sonst geht sie verloren.',
  },
  { key: 'wasser', label: 'Wasserversorgung', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'abwasser', label: 'Entwässerung / Abwasser', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'heizung', label: 'Heizkosten', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'warmwasser', label: 'Warmwasser', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'aufzug', label: 'Aufzug', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'strassenreinigung_gewerbemuell', label: 'Straßenreinigung / gemeinschaftliche Müllabfuhr', group: 'umlagefaehig', defaultAllocable: true },
  {
    key: 'restmuell_privat', label: 'Restmüll (eigene Tonne)', group: 'umlagefaehig', defaultAllocable: true,
    highlight: 'Läuft nicht immer über das Hausgeld – bei einer eigenen Restmülltonne zahlst du die Gebühr oft direkt an Stadt/Gemeinde und trägst sie dann selbst, statt sie umzulegen.',
  },
  { key: 'gebaeudereinigung_ungeziefer', label: 'Gebäudereinigung / Ungezieferbekämpfung', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'gartenpflege', label: 'Gartenpflege', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'allgemeinstrom', label: 'Allgemeinstrom / Beleuchtung', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'schornsteinreinigung', label: 'Schornsteinreinigung', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'sach_haftpflichtversicherung', label: 'Sach- / Haftpflichtversicherung', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'hauswart', label: 'Hauswart', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'gemeinschaftsantenne_kabel', label: 'Gemeinschaftsantenne / Kabel / Breitband', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'wascheinrichtung', label: 'Wascheinrichtung', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'sonstige_umlagefaehig', label: 'Sonstige umlagefähige Betriebskosten', group: 'umlagefaehig', defaultAllocable: true },
  { key: 'verwaltungskosten', label: 'Verwaltungskosten (Hausverwaltung)', group: 'nicht_umlagefaehig', defaultAllocable: false },
  { key: 'instandhaltung', label: 'Instandhaltung / Reparaturen', group: 'nicht_umlagefaehig', defaultAllocable: false },
  { key: 'ruecklage_zufuehrung', label: 'Zuführung Instandhaltungsrücklage', group: 'nicht_umlagefaehig', defaultAllocable: false },
  { key: 'bankgebuehren', label: 'Bankgebühren / Kontoführung', group: 'nicht_umlagefaehig', defaultAllocable: false },
  { key: 'mietausfallwagnis', label: 'Mietausfallwagnis', group: 'nicht_umlagefaehig', defaultAllocable: false },
  { key: 'rechtsverfolgungskosten', label: 'Rechtsverfolgungskosten', group: 'nicht_umlagefaehig', defaultAllocable: false },
  { key: 'sonstige_nicht_umlagefaehig', label: 'Sonstige nicht umlagefähige Kosten', group: 'nicht_umlagefaehig', defaultAllocable: false },
]

export const OPERATING_COST_CATEGORY_MAP: Record<OperatingCostCategory, OperatingCostCategoryConfig> =
  Object.fromEntries(OPERATING_COST_CATEGORIES.map(c => [c.key, c])) as Record<OperatingCostCategory, OperatingCostCategoryConfig>

// Grobe Schätzung der im Jahr eingegangenen Nebenkostenvorauszahlungen: Monate
// aktiv im Jahr * aktuelle Vorauszahlung. Ersetzt keine exakte, unterjährig
// gestaffelte Abrechnung, dient nur als Anhaltspunkt für Nachzahlung/Guthaben.
export function sumAdvancePaymentsForYear(tenants: Tenant[], year: number): number {
  return tenants.reduce((sum, t) => {
    const moveIn = new Date(t.move_in_date)
    const moveOut = t.move_out_date ? new Date(t.move_out_date) : null
    let months = 0
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1)
      const monthEnd = new Date(year, m + 1, 0)
      if (moveIn <= monthEnd && (!moveOut || moveOut >= monthStart)) months++
    }
    return sum + months * t.advance_payment
  }, 0)
}
