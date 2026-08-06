import { Property, CATEGORY_LABELS, ReceiptCategory } from './types'
import { calcAnnualAfa } from './afa'
import { propertyLabel } from './format'
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
  werbungskosten_gesamt: number
  ergebnis: number
}

export function buildTaxExportRow(
  property: Property,
  year: number,
  allocations: ReceiptAllocation[],
  incomeTotal: number,
  loanInterest: number = 0
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
  const werbungskosten_gesamt = belegeSumme + afa + loanInterest

  return {
    objekt: propertyLabel(property),
    jahr: year,
    einnahmen: incomeTotal,
    kosten_nach_kategorie,
    afa,
    werbungskosten_gesamt,
    ergebnis: incomeTotal - werbungskosten_gesamt,
  }
}

// Anlage-V-orientiertes CSV (Semikolon-getrennt, deutsches Zahlenformat) –
// zum manuellen Eintragen in Elster oder Importieren in WISO Steuer o.ä.
export function rowsToCsv(rows: TaxExportRow[]): string {
  const categories = Object.keys(CATEGORY_LABELS) as ReceiptCategory[]
  const header = ['Objekt', 'Jahr', 'Einnahmen', ...categories.map(c => CATEGORY_LABELS[c]), 'AfA', 'Werbungskosten gesamt', 'Ergebnis (Anlage V)']
  const lines = [header.join(';')]

  for (const row of rows) {
    const cells = [
      row.objekt,
      String(row.jahr),
      formatNumberDe(row.einnahmen),
      ...categories.map(c => formatNumberDe(row.kosten_nach_kategorie[c])),
      formatNumberDe(row.afa),
      formatNumberDe(row.werbungskosten_gesamt),
      formatNumberDe(row.ergebnis),
    ]
    lines.push(cells.map(c => `"${c}"`).join(';'))
  }

  return '﻿' + lines.join('\r\n')
}
