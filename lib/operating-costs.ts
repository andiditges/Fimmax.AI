import { OperatingCost, OperatingCostCategory, Tenant } from './types'

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
  {
    key: 'heizung', label: 'Heizkosten', group: 'umlagefaehig', defaultAllocable: true,
    highlight: 'Seit dem CO2-Kostenaufteilungsgesetz (2023) trägst du je nach energetischem Zustand des Gebäudes einen Anteil der CO2-Kosten selbst – dieser Anteil darf nicht auf die Mieter umgelegt werden. Steht auf der Heizkostenabrechnung des Energieversorgers.',
  },
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
  {
    key: 'gemeinschaftsantenne_kabel', label: 'Gemeinschaftsantenne / Kabel / Breitband', group: 'umlagefaehig', defaultAllocable: true,
    highlight: 'Seit der TKG-Novelle zum 01.07.2024 ist das frühere "Nebenkostenprivileg" für TV-Signalkosten entfallen – Kabel-/Sammelanschlusskosten sind seitdem in der Regel NICHT mehr auf Mieter umlegbar. Vor Ansatz prüfen, sonst droht ein Rückzahlungsanspruch des Mieters.',
  },
  { key: 'wascheinrichtung', label: 'Wascheinrichtung', group: 'umlagefaehig', defaultAllocable: true },
  {
    key: 'rauchwarnmelder', label: 'Rauchwarnmelder (Miete / Wartung)', group: 'umlagefaehig', defaultAllocable: true,
    highlight: 'Wird oft separat vom Dienstleister abgerechnet und geht dadurch leicht unter, statt in die Abrechnung übernommen zu werden.',
  },
  {
    key: 'verbrauchserfassung', label: 'Verbrauchserfassung (Wärme-/Wasserzähler, Ablesedienst)', group: 'umlagefaehig', defaultAllocable: true,
    highlight: 'Miete und Ablesekosten für Erfassungsgeräte sind eine eigene Kostenposition (nicht Teil der Heizkosten selbst) und werden deshalb oft vergessen.',
  },
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

// Kumulierte Instandhaltungsrücklage über alle Jahre hinweg (nicht nur das
// aktuell gewählte Jahr) - die WEG-Rücklage baut sich über die Zeit auf,
// daher summieren wir hier bewusst über den gesamten Datenbestand.
export function sumInstandhaltungsruecklage(costs: OperatingCost[]): number {
  return costs.filter(c => c.category === 'ruecklage_zufuehrung').reduce((s, c) => s + c.amount, 0)
}

// Nicht umlagefähige Kosten aus der WEG-/Hausgeldabrechnung, die der
// Eigentümer selbst trägt und als Werbungskosten absetzen kann - mit
// Ausnahme der Rücklagenzuführung: die ist laut aktueller BFH-Rechtsprechung
// (IX R 19/21) erst abzugsfähig, wenn die WEG das Geld tatsächlich für eine
// Maßnahme ausgibt, nicht schon bei Einzahlung ins Hausgeld.
export function deductibleOwnCosts(costs: OperatingCost[]): OperatingCost[] {
  return costs.filter(c => OPERATING_COST_CATEGORY_MAP[c.category]?.group === 'nicht_umlagefaehig' && c.category !== 'ruecklage_zufuehrung')
}

// Anzahl der Kalendermonate, die ein Mieter im gegebenen Jahr im Mietverhältnis war.
export function monthsActiveInYear(tenant: Tenant, year: number): number {
  const moveIn = new Date(tenant.move_in_date)
  const moveOut = tenant.move_out_date ? new Date(tenant.move_out_date) : null
  let months = 0
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1)
    const monthEnd = new Date(year, m + 1, 0)
    if (moveIn <= monthEnd && (!moveOut || moveOut >= monthStart)) months++
  }
  return months
}

// Grobe Schätzung der im Jahr eingegangenen Nebenkostenvorauszahlungen: Monate
// aktiv im Jahr * aktuelle Vorauszahlung. Ersetzt keine exakte, unterjährig
// gestaffelte Abrechnung, dient nur als Anhaltspunkt für Nachzahlung/Guthaben.
export function sumAdvancePaymentsForYear(tenants: Tenant[], year: number): number {
  return tenants.reduce((sum, t) => sum + monthsActiveInYear(t, year) * t.advance_payment, 0)
}

// Frist zur Zustellung der Betriebskostenabrechnung: 12 Monate nach Ende des
// Abrechnungszeitraums (§ 556 Abs. 3 BGB) - bei Kalenderjahr-Abrechnung also
// der 31.12. des Folgejahres. Nach Fristablauf sind Nachforderungen (nicht
// aber Rückzahlungen an den Mieter) i.d.R. ausgeschlossen.
export function settlementDeadline(year: number): Date {
  return new Date(year + 1, 11, 31)
}

export function settlementDeadlineStatus(year: number, asOfDate: Date = new Date()) {
  const deadline = settlementDeadline(year)
  const daysRemaining = Math.round((deadline.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24))
  return {
    deadline,
    daysRemaining,
    overdue: daysRemaining < 0,
    urgent: daysRemaining >= 0 && daysRemaining <= 60,
  }
}

// Garagen/Stellplätze werden i.d.R. pauschal ohne eigene Nebenkostenabrechnung
// vermietet - für die Abrechnungsschreiben standardmäßig ausgeschlossen (kann
// pro Kostenposition per tenant_id-Zuordnung dennoch gezielt überschrieben werden).
export function isUtilityBillableTenant(tenant: Tenant): boolean {
  return tenant.unit !== 'Garage/Stellplatz'
}

export function activeTenantsInYear(tenants: Tenant[], year: number): Tenant[] {
  return tenants.filter(t => monthsActiveInYear(t, year) > 0)
}

export interface TenantAllocationRow {
  label: string
  amount: number
}

export interface TenantAllocation {
  tenant: Tenant
  rows: TenantAllocationRow[]
  total: number
  advancePayments: number
  balance: number // positiv = Nachzahlung von Mieter, negativ = Guthaben
}

/**
 * Verteilt die umlagefähigen Kostenpositionen eines Objekts/Jahres auf die
 * einzelnen Mieter für die Abrechnungsschreiben. Positionen mit fester
 * tenant_id-Zuordnung gehen komplett an diesen Mieter (auch an Garagen-Mieter,
 * falls explizit so zugeordnet). Nicht zugeordnete Positionen werden auf alle
 * regulär abzurechnenden Mieter (ohne Garage/Stellplatz) verteilt, gewichtet
 * nach im Jahr aktiven Monaten - mangels erfasster Wohnfläche der
 * praktikabelste faire Schlüssel für diese Portfolio-Größe.
 */
export function allocateOperatingCostsToTenants(
  costs: OperatingCost[],
  tenants: Tenant[],
  year: number
): TenantAllocation[] {
  const active = activeTenantsInYear(tenants, year)
  const billable = active.filter(isUtilityBillableTenant)
  const totalWeight = billable.reduce((s, t) => s + monthsActiveInYear(t, year), 0)

  const rowsByTenant = new Map<string, TenantAllocationRow[]>()
  const addRow = (tenantId: string, label: string, amount: number) => {
    if (amount <= 0) return
    const list = rowsByTenant.get(tenantId) ?? []
    list.push({ label, amount })
    rowsByTenant.set(tenantId, list)
  }

  for (const c of costs) {
    if (!c.allocable_to_tenant || c.amount <= 0) continue
    const config = OPERATING_COST_CATEGORY_MAP[c.category]
    if (!config || config.group !== 'umlagefaehig') continue

    if (c.tenant_id) {
      addRow(c.tenant_id, config.label, c.amount)
      continue
    }

    const pool = billable.length > 0 ? billable : active
    const poolWeight = pool === billable ? totalWeight : pool.reduce((s, t) => s + monthsActiveInYear(t, year), 0)
    if (poolWeight <= 0) continue
    for (const t of pool) {
      const share = c.amount * (monthsActiveInYear(t, year) / poolWeight)
      addRow(t.id, config.label, share)
    }
  }

  return billable.map(t => {
    const rows = rowsByTenant.get(t.id) ?? []
    const total = rows.reduce((s, r) => s + r.amount, 0)
    const advancePayments = monthsActiveInYear(t, year) * t.advance_payment
    return { tenant: t, rows, total, advancePayments, balance: total - advancePayments }
  })
}
