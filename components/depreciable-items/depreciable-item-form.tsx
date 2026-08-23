'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { DepreciableItem } from '@/lib/types'

export function DepreciableItemForm({ item, propertyId }: { item?: DepreciableItem; propertyId?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const targetPropertyId = item?.property_id ?? propertyId ?? ''
  const [form, setForm] = useState({
    description: item?.description ?? '',
    acquisition_date: item?.acquisition_date ?? new Date().toISOString().slice(0, 10),
    acquisition_cost: item ? String(item.acquisition_cost) : '',
    usage_duration_years: item ? String(item.usage_duration_years) : '10',
    note: item?.note ?? '',
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetPropertyId) return alert('Keine Immobilie angegeben')
    setLoading(true)
    const payload = {
      property_id: targetPropertyId,
      description: form.description,
      acquisition_date: form.acquisition_date,
      acquisition_cost: parseFloat(form.acquisition_cost),
      usage_duration_years: parseInt(form.usage_duration_years, 10),
      note: form.note || null,
    }

    const { error } = item
      ? await supabase.from('depreciable_items').update(payload).eq('id', item.id)
      : await supabase.from('depreciable_items').insert(payload)

    if (!error) router.push(`/properties/${targetPropertyId}`)
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  async function onDelete() {
    if (!item) return
    if (!confirm('Dieses Wirtschaftsgut wirklich löschen?')) return
    setLoading(true)
    const { error } = await supabase.from('depreciable_items').delete().eq('id', item.id)
    if (!error) router.push(`/properties/${targetPropertyId}`)
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {item ? 'Wirtschaftsgut bearbeiten' : 'Bewegliches Wirtschaftsgut erfassen'}
      </h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bezeichnung *</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder='z.B. "Einbauküche Wohnung 3"'
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anschaffungsdatum *</label>
              <input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anschaffungskosten (€) *</label>
              <input type="number" step="0.01" value={form.acquisition_cost} onChange={e => setForm(f => ({ ...f, acquisition_cost: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nutzungsdauer (Jahre) *</label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Bei beweglichen Wirtschaftsgütern (z.B. Einbauküche) üblicherweise 10 Jahre</p>
            <input type="number" step="1" min="1" value={form.usage_duration_years} onChange={e => setForm(f => ({ ...f, usage_duration_years: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notiz</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? 'Wird gespeichert...' : item ? 'Änderungen speichern' : 'Wirtschaftsgut speichern'}
          </button>

          {item && (
            <button type="button" onClick={onDelete} disabled={loading}
              className="w-full text-center text-sm text-red-500 dark:text-red-400 hover:underline">
              Löschen
            </button>
          )}
        </form>
      </Card>
    </div>
  )
}
