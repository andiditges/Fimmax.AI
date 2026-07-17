'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RentChangeForm({ tenantId, propertyId }: { tenantId: string; propertyId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [amount, setAmount] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('rental_agreements').insert({
      property_id: propertyId,
      tenant_id: tenantId,
      rent_amount: parseFloat(amount),
      start_date: startDate,
    })
    if (!error) {
      setStartDate('')
      setAmount('')
      setOpen(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline">
        + Neue Miethöhe erfassen
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gilt ab *</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Neue Miete (€) *</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
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
  )
}
