'use client'
import { TaxExportRow, rowsToCsv } from '@/lib/tax-export'

export function TaxExportButton({ rows, filename, label }: { rows: TaxExportRow[]; filename: string; label?: string }) {
  function onClick() {
    const csv = rowsToCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={onClick} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
      {label ?? 'Steuer-Export (CSV)'}
    </button>
  )
}
