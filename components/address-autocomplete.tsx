'use client'
import { useEffect, useRef, useState } from 'react'

interface PhotonProperties {
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
}

function formatSuggestion(p: PhotonProperties): string {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const city = [p.postcode, p.city ?? p.town ?? p.village].filter(Boolean).join(' ')
  return [street, city].filter(Boolean).join(', ')
}

// Adress-Vorschläge über Photon (komoot), ein kostenloser OSM-basierter
// Geocoding-Dienst ohne API-Key. Nur Text-Vorschläge, keine Speicherung
// von Koordinaten.
export function AddressAutocomplete({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) {
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&lang=de&limit=5&lat=51.1657&lon=10.4515&zoom=6`
        )
        const data = await res.json()
        const labels: string[] = (data.features ?? [])
          .map((f: { properties: PhotonProperties }) => formatSuggestion(f.properties))
          .filter((s: string) => s.length > 0)
        setSuggestions(Array.from(new Set(labels)))
      } catch {
        setSuggestions([])
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
        required
      />
      {open && value.trim().length >= 3 && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-md overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => {
                onChange(s)
                setSuggestions([])
                setOpen(false)
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
