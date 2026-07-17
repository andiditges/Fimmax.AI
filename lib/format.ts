export function euro(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

// Zeigt die eigene Wohnungsbezeichnung (z.B. "Wohnung 1"), falls hinterlegt,
// sonst die offizielle WE/Einheit-Nummer.
export function propertyLabel(p: { address: string; unit?: string | null; unit_label?: string | null }): string {
  const label = p.unit_label || p.unit
  return `${p.address}${label ? ' · ' + label : ''}`
}

export function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('de-DE')
}

export function percent(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`
}

// Aktueller Wert, falls gepflegt, sonst Kaufpreis als Näherung.
export function propertyValue(p: { purchase_price: number; current_value?: number | null }): number {
  return p.current_value ?? p.purchase_price
}
