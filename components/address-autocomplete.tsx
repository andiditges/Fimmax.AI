'use client'
import { useEffect, useRef, useState } from 'react'

interface PhotonProperties {
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  state?: string
}

interface Suggestion {
  label: string
  state: string | null
}

function formatSuggestion(p: PhotonProperties): string {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const city = [p.postcode, p.city ?? p.town ?? p.village].filter(Boolean).join(' ')
  return [street, city].filter(Boolean).join(', ')
}

// Adress-Vorschläge über Photon (komoot), ein kostenloser OSM-basierter
// Geocoding-Dienst ohne API-Key. Nur Text-Vorschläge, keine Speicherung
// von Koordinaten. Photon liefert bei deutschen Adressen i.d.R. auch das
// Bundesland mit (properties.state) – wird beim Auswählen eines Vorschlags
// über onStateDetected nach oben gereicht.
export function AddressAutocomplete({
  value,
  onChange,
  onStateDetected,
}: {
  value: string
  onChange: (value: string) => void
  onStateDetected?: (state: string) => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
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
        const all: Suggestion[] = (data.features ?? [])
          .map((f: { properties: PhotonProperties }) => ({ label: formatSuggestion(f.properties), state: f.properties.state ?? null }))
          .filter((s: Suggestion) => s.label.length > 0)
        const seen = new Set<string>()
        const unique = all.filter(s => (seen.has(s.label) ? false : (seen.add(s.label), true)))
        setSuggestions(unique)
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
                onChange(s.label)
                if (s.state && onStateDetected) onStateDetected(s.state)
                setSuggestions([])
                setOpen(false)
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
