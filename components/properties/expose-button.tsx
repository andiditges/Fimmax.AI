'use client'
import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'

export function ExposeButton({ propertyId }: { propertyId: string }) {
  const [includeFinancing, setIncludeFinancing] = useState(false)

  return (
    <div className="flex flex-col items-end gap-1">
      <a
        href={`/api/properties/${propertyId}/expose/pdf?financing=${includeFinancing ? '1' : '0'}`}
        onClick={() => trackEvent('expose_pdf_generated', { includeFinancing })}
        className="text-sm text-blue-600 hover:underline whitespace-nowrap"
      >
        Exposé erstellen (PDF)
      </a>
      <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
        <input
          type="checkbox"
          checked={includeFinancing}
          onChange={e => setIncludeFinancing(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
        />
        mit Finanzierungsdaten (für Bank)
      </label>
    </div>
  )
}
