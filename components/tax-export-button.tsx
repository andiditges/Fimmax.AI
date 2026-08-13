'use client'

export function TaxExportButton({ csv, filename, label }: { csv: string; filename: string; label?: string }) {
  function onClick() {
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
