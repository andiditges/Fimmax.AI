import { OperatingCost, Property, CATEGORY_LABELS, ReceiptCategory } from './types'
import { calcAnnualAfa } from './afa'
import { propertyLabel } from './format'
import { deductibleOwnCosts, OPERATING_COST_CATEGORY_MAP } from './operating-costs'
import { ReceiptAllocation } from './receipt-allocations'

function formatNumberDe(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

export interface TaxExportRow {
  objekt: string
  jahr: number
  einnahmen: number
  kosten_nach_kategorie: Record<ReceiptCategory, number>
  afa: number
  weg_nicht_umlagefaehig: number
  werbungskosten_gesamt: number
  ergebnis: number
}

export function buildTaxExportRow(
  property: Property,
  year: number,
  allocations: ReceiptAllocation[],
  incomeTotal: number,
  loanInterest: number = 0,
  operatingCosts: OperatingCost[] = []
): TaxExportRow {
  const yearAllocs = allocations.filter(a => a.tax_year === year)
  const kosten_nach_kategorie = {} as Record<ReceiptCategory, number>
  for (const cat of Object.keys(CATEGORY_LABELS) as ReceiptCategory[]) {
    kosten_nach_kategorie[cat] = yearAllocs.filter(a => a.category === cat).reduce((s, a) => s + a.amount, 0)
  }
  // Kreditzinsen kommen aus dem tatsächlichen Tilgungsplan (siehe
  // interestPaidInYear), nicht ausschließlich aus manuell erfassten
  // "Zinsen"-Belegen - sonst fehlten die Zinsen hier komplett, solange kein
  // entsprechender Beleg (z.B. Jahreszinsbescheinigung der Bank) erfasst ist.
  kosten_nach_kategorie.zinsen += loanInterest
  const afa = calcAnnualAfa(property)
  const belegeSumme = yearAllocs.reduce((s, a) => s + a.amount, 0)
  // Nicht umlagefähige Kosten aus dem Nebenkostenassistenten (WEG-/
  // Hausgeldabrechnung) - siehe deductibleOwnCosts. Wer diese Kosten dort
  // erfasst, sollte dafür keinen zusätzlichen Beleg mehr anlegen, sonst
  // zählen sie doppelt.
  const weg_nicht_umlagefaehig = deductibleOwnCosts(operatingCosts.filter(c => c.year === year)).reduce((s, c) => s + c.amount, 0)
  const werbungskosten_gesamt = belegeSumme + afa + loanInterest + weg_nicht_umlagefaehig

  return {
    objekt: propertyLabel(property),
    jahr: year,
    einnahmen: incomeTotal,
    kosten_nach_kategorie,
    afa,
    weg_nicht_umlagefaehig,
    werbungskosten_gesamt,
    ergebnis: incomeTotal - werbungskosten_gesamt,
  }
}

// Anlage-V-orientiertes CSV (Semikolon-getrennt, deutsches Zahlenformat) –
// zum manuellen Eintragen in Elster oder Importieren in WISO Steuer o.ä.
export function rowsToCsv(rows: TaxExportRow[]): string {
  const categories = Object.keys(CATEGORY_LABELS) as ReceiptCategory[]
  const header = ['Objekt', 'Jahr', 'Einnahmen', ...categories.map(c => CATEGORY_LABELS[c]), 'AfA', 'WEG nicht umlagefähig (Verwaltung/Instandhaltung/etc.)', 'Werbungskosten gesamt', 'Ergebnis (Anlage V)']
  const lines = [header.join(';')]

  for (const row of rows) {
    const cells = [
      row.objekt,
      String(row.jahr),
      formatNumberDe(row.einnahmen),
      ...categories.map(c => formatNumberDe(row.kosten_nach_kategorie[c])),
      formatNumberDe(row.afa),
      formatNumberDe(row.weg_nicht_umlagefaehig),
      formatNumberDe(row.werbungskosten_gesamt),
      formatNumberDe(row.ergebnis),
    ]
    lines.push(cells.map(c => `"${c}"`).join(';'))
  }

  return '﻿' + lines.join('\r\n')
}

// Eine Zeile je Position (Beleg bzw. Beleg-Position) statt der einen
// aggregierten Jahreszeile - für den Fall, dass alle Einzelnachweise
// (Datum, Betrag, Beschreibung) auf einen Blick gebraucht werden, z.B. zum
// Vorlegen beim Steuerberater.
export interface TaxExportDetailRow {
  datum: string
  kategorie: string
  beschreibung: string
  betrag: number
  renovierung: boolean
}

export function buildTaxExportDetailRows(
  property: Property,
  year: number,
  allocations: ReceiptAllocation[],
  afa: number,
  loanInterest: number = 0,
  operatingCosts: OperatingCost[] = []
): TaxExportDetailRow[] {
  const propertyId = property.id
  const yearAllocs = allocations
    .filter(a => a.property_id === propertyId && a.tax_year === year)
    .sort((a, b) => a.receipt_date.localeCompare(b.receipt_date))

  const rows: TaxExportDetailRow[] = yearAllocs.map(a => ({
    datum: a.receipt_date,
    kategorie: CATEGORY_LABELS[a.category],
    beschreibung: [a.vendor, a.description].filter(Boolean).join(' – '),
    betrag: a.amount,
    renovierung: a.is_renovation,
  }))

  if (afa > 0) {
    rows.push({ datum: '', kategorie: 'AfA', beschreibung: 'Jährliche Gebäude-Abschreibung', betrag: afa, renovierung: false })
  }
  if (loanInterest > 0) {
    rows.push({ datum: '', kategorie: CATEGORY_LABELS.zinsen, beschreibung: 'Kreditzinsen laut Tilgungsplan', betrag: loanInterest, renovierung: false })
  }
  for (const c of deductibleOwnCosts(operatingCosts.filter(o => o.year === year))) {
    if (c.amount <= 0) continue
    rows.push({
      datum: '',
      kategorie: OPERATING_COST_CATEGORY_MAP[c.category]?.label ?? c.category,
      beschreibung: c.note ?? 'Nicht umlagefähig laut Nebenkostenassistent',
      betrag: c.amount,
      renovierung: false,
    })
  }

  return rows
}

export function detailRowsToCsv(property: Property, year: number, rows: TaxExportDetailRow[]): string {
  const header = ['Objekt', 'Jahr', 'Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'Renovierung']
  const lines = [header.join(';')]
  const objekt = propertyLabel(property)

  for (const row of rows) {
    const cells = [
      objekt,
      String(year),
      row.datum ? row.datum.split('-').reverse().join('.') : '',
      row.kategorie,
      row.beschreibung,
      formatNumberDe(row.betrag),
      row.renovierung ? 'Ja' : 'Nein',
    ]
    lines.push(cells.map(c => `"${c}"`).join(';'))
  }

  const summe = rows.reduce((s, r) => s + r.betrag, 0)
  lines.push(['', '', '', '', 'Summe Werbungskosten', formatNumberDe(summe), ''].map(c => `"${c}"`).join(';'))

  return '﻿' + lines.join('\r\n')
}
