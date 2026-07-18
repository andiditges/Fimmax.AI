'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { euro } from '@/lib/format'
import { RESERVE_CATEGORY_LABELS, PropertyReserve, ReserveCategory } from '@/lib/types'

export function PropertyReserves({
  propertyId,
  reserves,
  instandhaltungsruecklage,
}: {
  propertyId: string
  reserves: PropertyReserve[]
  instandhaltungsruecklage: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category: 'mietausfall' as ReserveCategory,
    name: '',
    current_value: '',
    monthly_contribution: '',
    funded_from_rent: false,
    note: '',
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('property_reserves').insert({
      property_id: propertyId,
      category: form.category,
      name: form.name || null,
      current_value: parseFloat(form.current_value) || 0,
      monthly_contribution: parseFloat(form.monthly_contribution) || 0,
      funded_from_rent: form.funded_from_rent,
      note: form.note || null,
    })
    if (!error) {
      setForm({ category: 'mietausfall', name: '', current_value: '', monthly_contribution: '', funded_from_rent: false, note: '' })
      setOpen(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  const totalReserves = reserves.reduce((s, r) => s + r.current_value, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Rücklagen</h2>
        {!open && <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline">+ Rücklage erfassen</button>}
      </div>

      {instandhaltungsruecklage > 0 && (
        <Card className="mb-3 bg-blue-50 border-blue-100">
          <CardTitle>Instandhaltungsrücklage (kumuliert, aus Nebenkosten)</CardTitle>
          <p className="text-xl font-bold text-blue-700">{euro(instandhaltungsruecklage)}</p>
          <p className="text-xs text-gray-500 mt-1">Summe aller "Zuführung Instandhaltungsrücklage"-Einträge aus der Nebenkosten-Erfassung, über alle Jahre.</p>
        </Card>
      )}

      {reserves.length > 0 && (
        <Card className="mb-3">
          <div className="flex justify-between text-sm font-semibold text-gray-800 mb-2">
            <span>Eigene Rücklagen</span>
            <span>{euro(totalReserves)}</span>
          </div>
          <div className="space-y-1.5">
            {reserves.map(r => (
              <div key={r.id} className="flex justify-between text-sm text-gray-600">
                <span>
                  {RESERVE_CATEGORY_LABELS[r.category]}{r.name ? ` · ${r.name}` : ''}
                  {r.funded_from_rent && <span className="text-xs text-amber-700"> (aus Kaltmiete)</span>}
                </span>
                <span>{euro(r.current_value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {reserves.length === 0 && instandhaltungsruecklage === 0 && !open && (
        <Card className="text-center py-6 text-gray-400 text-sm">Noch keine Rücklagen hinterlegt</Card>
      )}

      {open && (
        <Card>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Art der Rücklage</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ReserveCategory }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(RESERVE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bezeichnung (optional)</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Aktueller Stand (€)</label>
                <input type="number" step="0.01" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monatliche Zuführung (€)</label>
                <input type="number" step="0.01" value={form.monthly_contribution} onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="funded_from_rent" checked={form.funded_from_rent}
                onChange={e => setForm(f => ({ ...f, funded_from_rent: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <label htmlFor="funded_from_rent" className="text-sm text-gray-700">Wird aus der Kaltmiete gebildet</label>
            </div>
            <p className="text-xs text-gray-400 -mt-1">
              Wenn aktiv, wird die monatliche Zuführung im Cashflow (Finanzen-Übersicht, "Stand heute") als Abfluss berücksichtigt, statt als frei verfügbar zu gelten.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notiz (optional)</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">
                Abbrechen
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
