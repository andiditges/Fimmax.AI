import { Receipt, ReceiptItem, ReceiptCategory } from './types'

// Zentraler Umrechnungspunkt: alle Auswertungen (Steuerübersicht, 15%-Grenze,
// Kosten-Hochrechnung, Beleg-Liste) gehen hier durch, statt an jeder Stelle
// selbst zwischen "Beleg hat Items" / "Beleg hat keine Items" zu
// unterscheiden. Ein Beleg ohne Items ergibt genau eine Allocation (1:1 vom
// Beleg selbst); ein Beleg mit Items ergibt eine Allocation pro Item -
// Datum/Steuerjahr/archiviert kommen dabei vom Beleg, Objekt/Kategorie/
// Betrag/Renovierung von der jeweiligen Position.
export interface ReceiptAllocation {
  receipt_id: string
  property_id: string
  category: ReceiptCategory
  amount: number
  is_renovation: boolean
  receipt_date: string
  tax_year: number
  archived: boolean
}

export function getReceiptAllocations(receipts: Receipt[], items: ReceiptItem[]): ReceiptAllocation[] {
  const itemsByReceipt = new Map<string, ReceiptItem[]>()
  for (const item of items) {
    const list = itemsByReceipt.get(item.receipt_id)
    if (list) list.push(item)
    else itemsByReceipt.set(item.receipt_id, [item])
  }

  return receipts.flatMap(r => {
    const receiptItems = itemsByReceipt.get(r.id)
    if (!receiptItems || receiptItems.length === 0) {
      return [{
        receipt_id: r.id,
        property_id: r.property_id,
        category: r.category,
        amount: r.amount,
        is_renovation: r.is_renovation,
        receipt_date: r.receipt_date,
        tax_year: r.tax_year,
        archived: r.archived,
      }]
    }
    return receiptItems.map(item => ({
      receipt_id: r.id,
      property_id: item.property_id,
      category: item.category,
      amount: item.amount,
      is_renovation: item.is_renovation,
      receipt_date: r.receipt_date,
      tax_year: r.tax_year,
      archived: r.archived,
    }))
  })
}
