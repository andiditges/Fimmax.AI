'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { ASSET_CATEGORY_LABELS, Asset, AssetCategory } from '@/lib/types'

export function AssetForm({ asset }: { asset?: Asset }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category: asset?.category ?? 'wertpapiere' as AssetCategory,
    name: asset?.name ?? '',
    institution: asset?.institution ?? '',
    current_value: asset ? String(asset.current_value) : '',
    monthly_contribution: asset ? String(asset.monthly_contribution) : '0',
    valuation_date: asset?.valuation_date ?? new Date().toISOString().slice(0, 10),
    note: asset?.note ?? '',
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      category: form.category,
      name: form.name,
      institution: form.institution || null,
      current_value: parseFloat(form.current_value),
      monthly_contribution: parseFloat(form.monthly_contribution) || 0,
      valuation_date: form.valuation_date,
      note: form.note || null,
    }

    const { error } = asset
      ? await supabase.from('assets').update(payload).eq('id', asset.id)
      : await supabase.from('assets').insert(payload)

    if (!error) router.push('/finanzen')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  async function onDelete() {
    if (!asset) return
    if (!confirm('Diesen Vermögenswert wirklich löschen?')) return
    setLoading(true)
    const { error } = await supabase.from('assets').delete().eq('id', asset.id)
    if (!error) router.push('/finanzen')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{asset ? 'Vermögenswert bearbeiten' : 'Vermögenswert erfassen'}</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie *</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as AssetCategory }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(ASSET_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder='z.B. "Bausparvertrag Schwäbisch Hall"'
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institut / Anbieter</label>
            <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aktueller Wert (€) *</label>
              <input type="number" step="0.01" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stand vom</label>
              <input type="date" value={form.valuation_date} onChange={e => setForm(f => ({ ...f, valuation_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monatliche Sparrate (€)</label>
            <p className="text-xs text-gray-400 mb-1">Optional – wie viel du monatlich regelmäßig einzahlst</p>
            <input type="number" step="0.01" value={form.monthly_contribution} onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? 'Wird gespeichert...' : asset ? 'Änderungen speichern' : 'Vermögenswert speichern'}
          </button>

          {asset && (
            <button type="button" onClick={onDelete} disabled={loading}
              className="w-full text-center text-sm text-red-500 hover:underline">
              Löschen
            </button>
          )}
        </form>
      </Card>
    </div>
  )
}
