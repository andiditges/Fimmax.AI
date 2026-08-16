'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { getReceiptSignedUrl } from '@/app/actions/receipts'
import { euro, propertyLabel } from '@/lib/format'
import { CATEGORY_LABELS, Property, Receipt, ReceiptItem } from '@/lib/types'

export function ReceiptBrowser({
  receipts,
  items = [],
  properties,
  showPropertyColumn = false,
}: {
  receipts: Receipt[]
  items?: ReceiptItem[]
  properties?: Property[]
  showPropertyColumn?: boolean
}) {
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const archivedCount = useMemo(() => receipts.filter(r => r.archived).length, [receipts])

  const propertyById = useMemo(
    () => Object.fromEntries((properties ?? []).map(p => [p.id, p])),
    [properties]
  )

  const itemsByReceipt = useMemo(() => {
    const map = new Map<string, ReceiptItem[]>()
    for (const item of items) {
      const list = map.get(item.receipt_id)
      if (list) list.push(item)
      else map.set(item.receipt_id, [item])
    }
    return map
  }, [items])

  const categorySummary = useCallback((r: Receipt): string => {
    const receiptItems = itemsByReceipt.get(r.id)
    if (!receiptItems || receiptItems.length === 0) return CATEGORY_LABELS[r.category]
    const labels = Array.from(new Set(receiptItems.map(i => CATEGORY_LABELS[i.category])))
    return labels.join(', ')
  }, [itemsByReceipt])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return receipts
      .filter(r => {
        if (r.archived && !showArchived) return false
        if (from && r.receipt_date < from) return false
        if (to && r.receipt_date > to) return false
        if (!q) return true
        const haystack = [r.vendor, r.description, categorySummary(r), String(r.tax_year)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => b.receipt_date.localeCompare(a.receipt_date))
  }, [receipts, query, from, to, showArchived, categorySummary])

  async function openReceipt(r: Receipt) {
    if (!r.file_url) return
    setOpeningId(r.id)
    const url = await getReceiptSignedUrl(r.file_url)
    setOpeningId(null)
    if (url) window.open(url, '_blank')
    else alert('Datei konnte nicht geöffnet werden.')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Suche, z.B. "Wasserhahn 2024"...'
          className="flex-1 min-w-[220px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="self-center text-gray-400 dark:text-gray-500 text-sm">–</span>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {archivedCount > 0 && (
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600" />
          Archivierte Belege einblenden ({archivedCount})
        </label>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Keine Belege gefunden.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {r.vendor ?? r.description ?? '–'}
                  {showPropertyColumn && propertyById[r.property_id] && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal"> · {propertyLabel(propertyById[r.property_id])}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {new Date(r.receipt_date).toLocaleDateString('de-DE')} · {categorySummary(r)}
                  {r.is_renovation && ' · Renovierung'}
                  {r.archived && ' · archiviert'}
                </p>
              </div>
              <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{euro(r.amount)}</span>
              <div className="flex items-center gap-2 whitespace-nowrap">
                {r.file_url ? (
                  <button
                    type="button"
                    onClick={() => openReceipt(r)}
                    disabled={openingId === r.id}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    {openingId === r.id ? 'Öffnet...' : 'Öffnen ↗'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-300 dark:text-gray-600">kein Scan</span>
                )}
                <Link href={`/receipts/${r.id}/edit`} className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                  Bearbeiten
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{filtered.length} von {receipts.length} Belegen</p>
    </div>
  )
}
