'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { CATEGORY_LABELS, ReceiptCategory } from '@/lib/types'

export default function EditReceipt() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null }[]>([])
  const [form, setForm] = useState({
    property_id: '',
    receipt_date: '',
    amount: '',
    vendor: '',
    description: '',
    category: 'sonstiges' as ReceiptCategory,
    is_renovation: false,
  })

  useEffect(() => {
    supabase.from('properties').select('id, address, unit, unit_label').then(({ data }) => {
      setProperties(data ?? [])
    })
    supabase.from('receipts').select('*').eq('id', params.id).single().then(({ data }) => {
      if (!data) return
      setForm({
        property_id: data.property_id ?? '',
        receipt_date: data.receipt_date ?? '',
        amount: String(data.amount ?? ''),
        vendor: data.vendor ?? '',
        description: data.description ?? '',
        category: data.category ?? 'sonstiges',
        is_renovation: data.is_renovation ?? false,
      })
      setLoaded(true)
    })
  }, [params.id, supabase])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id) return alert('Bitte eine Immobilie auswählen')
    setLoading(true)

    const tax_year = form.receipt_date ? new Date(form.receipt_date).getFullYear() : new Date().getFullYear()

    const { error } = await supabase.from('receipts').update({
      property_id: form.property_id,
      receipt_date: form.receipt_date,
      amount: parseFloat(form.amount),
      vendor: form.vendor || null,
      description: form.description || null,
      category: form.category,
      is_renovation: form.is_renovation,
      tax_year,
    }).eq('id', params.id)

    if (!error) router.push(`/properties/${form.property_id}`)
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  async function onDelete() {
    if (!confirm('Diesen Beleg wirklich löschen?')) return
    setDeleting(true)
    const propertyId = form.property_id
    const { error } = await supabase.from('receipts').delete().eq('id', params.id)
    if (!error) router.push(propertyId ? `/properties/${propertyId}` : '/steuer')
    else { alert('Fehler: ' + error.message); setDeleting(false) }
  }

  if (!loaded) return <p className="text-sm text-gray-400">Lädt...</p>

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Beleg bearbeiten</h1>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Immobilie *</label>
            <select
              value={form.property_id}
              onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Bitte wählen...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
              <input type="date" value={form.receipt_date} onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Betrag (€) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant / Firma</label>
            <input type="text" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie *</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ReceiptCategory }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <input type="checkbox" id="renovation" checked={form.is_renovation}
              onChange={e => setForm(f => ({ ...f, is_renovation: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-amber-600" />
            <label htmlFor="renovation" className="text-sm text-amber-800">
              Renovierungsmaßnahme (relevant für 15%-Grenze § 6 EStG)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading || deleting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Wird gespeichert...' : 'Änderungen speichern'}
            </button>
            <button type="button" onClick={onDelete} disabled={loading || deleting}
              className="px-4 py-3 rounded-xl font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting ? '...' : 'Löschen'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
