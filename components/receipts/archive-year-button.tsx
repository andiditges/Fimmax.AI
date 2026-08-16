'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Rein für die Belegsuche im Tagesgeschäft gedacht: archivierte Belege
// verschwinden nur aus der Standard-Ansicht des ReceiptBrowser, fließen
// aber unverändert in alle steuerlichen Berechnungen (AfA, 15%-Grenze,
// Steuer-Export) ein - da sich an den bereits erklärten Zahlen nichts
// ändert, nur an der Übersichtlichkeit für künftige Jahre.
export function ArchiveYearButton({ year, receiptCount, archivedCount }: { year: number; receiptCount: number; archivedCount: number }) {
  const router = useRouter()
  const supabase = createClient()
  const [archiving, setArchiving] = useState(false)

  const openCount = receiptCount - archivedCount
  if (openCount <= 0) return null

  async function archive() {
    if (!window.confirm(
      `${openCount} Beleg${openCount === 1 ? '' : 'e'} aus ${year} archivieren? Sie verschwinden danach aus der Standard-Belegsuche (bleiben aber weiterhin für die Steuerberechnung dieses Jahres erhalten und können jederzeit wieder eingeblendet werden).`
    )) return
    setArchiving(true)
    const { error } = await supabase.from('receipts').update({ archived: true }).eq('tax_year', year)
    if (error) alert('Fehler: ' + error.message)
    setArchiving(false)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={archive}
      disabled={archiving}
      className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline disabled:opacity-50"
    >
      {archiving ? 'Wird archiviert...' : `Belege ${year} archivieren (Steuererklärung durch)`}
    </button>
  )
}
