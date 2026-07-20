'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { propertyLabel } from '@/lib/format'

interface ResultGroup {
  label: string
  items: { id: string; title: string; subtitle: string | null; href: string }[]
}

// PostgREST-.or()-Filter trennt Bedingungen per Komma - ein Komma in der
// Suche würde den Filter sonst kaputt parsen (kein Sicherheitsproblem, nur
// falsches Matching), deshalb hier rausgefiltert.
function sanitize(q: string) {
  return q.replace(/[,%]/g, ' ').trim()
}

// Wird nur gemountet, solange die Suche offen ist (siehe Nav) - Query/Ergebnisse
// starten dadurch bei jedem Öffnen automatisch frisch, ohne das per Effekt
// zurücksetzen zu müssen.
export function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<ResultGroup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const trimmedQuery = sanitize(query)

  useEffect(() => {
    if (trimmedQuery.length < 2) return
    const debounce = setTimeout(async () => {
      setLoading(true)
      const like = `%${trimmedQuery}%`

      const [{ data: properties }, { data: tenants }, { data: loans }, { data: reminders }] = await Promise.all([
        supabase.from('properties').select('id,address,unit,unit_label')
          .or(`address.ilike.${like},unit.ilike.${like},unit_label.ilike.${like}`).limit(5),
        supabase.from('tenants').select('id,name,property_id').ilike('name', like).limit(5),
        supabase.from('loans').select('id,name,lender,property_id').or(`name.ilike.${like},lender.ilike.${like}`).limit(5),
        supabase.from('reminders').select('id,title,property_id').ilike('title', like).limit(5),
      ])

      const propertyIds = new Set<string>()
      ;(tenants ?? []).forEach(t => propertyIds.add(t.property_id))
      ;(loans ?? []).forEach(l => propertyIds.add(l.property_id))
      ;(reminders ?? []).forEach(r => propertyIds.add(r.property_id))

      const { data: contextProperties } = propertyIds.size
        ? await supabase.from('properties').select('id,address,unit,unit_label').in('id', Array.from(propertyIds))
        : { data: [] }
      const propertyById = Object.fromEntries((contextProperties ?? []).map(p => [p.id, p]))

      const nextGroups: ResultGroup[] = []

      if (properties && properties.length > 0) {
        nextGroups.push({
          label: 'Immobilien',
          items: properties.map(p => ({ id: p.id, title: propertyLabel(p), subtitle: null, href: `/properties/${p.id}` })),
        })
      }
      if (tenants && tenants.length > 0) {
        nextGroups.push({
          label: 'Mieter',
          items: tenants.map(t => ({
            id: t.id, title: t.name,
            subtitle: propertyById[t.property_id] ? propertyLabel(propertyById[t.property_id]) : null,
            href: `/tenants/${t.id}`,
          })),
        })
      }
      if (loans && loans.length > 0) {
        nextGroups.push({
          label: 'Kredite',
          items: loans.map(l => ({
            id: l.id, title: l.name + (l.lender ? ` · ${l.lender}` : ''),
            subtitle: propertyById[l.property_id] ? propertyLabel(propertyById[l.property_id]) : null,
            href: `/loans/${l.id}`,
          })),
        })
      }
      if (reminders && reminders.length > 0) {
        nextGroups.push({
          label: 'Erinnerungen',
          items: reminders.map(r => ({
            id: r.id, title: r.title,
            subtitle: propertyById[r.property_id] ? propertyLabel(propertyById[r.property_id]) : null,
            href: `/reminders`,
          })),
        })
      }

      setGroups(nextGroups)
      setLoading(false)
    }, 300)

    return () => clearTimeout(debounce)
  }, [trimmedQuery, supabase])

  function goTo(href: string) {
    onClose()
    router.push(href)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Immobilie, Mieter, Kredit, Erinnerung suchen..."
            className="flex-1 text-sm focus:outline-none"
          />
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Suche schließen">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && <p className="text-sm text-gray-400 px-4 py-4">Suche...</p>}

          {!loading && trimmedQuery.length >= 2 && groups.length === 0 && (
            <p className="text-sm text-gray-400 px-4 py-4">Keine Treffer für &bdquo;{query}&ldquo;.</p>
          )}

          {!loading && trimmedQuery.length >= 2 && groups.map(group => (
            <div key={group.label} className="py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-1">{group.label}</p>
              {group.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.href)}
                  className="block w-full text-left px-4 py-2 hover:bg-blue-50"
                >
                  <p className="text-sm text-gray-800">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-gray-400">{item.subtitle}</p>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
