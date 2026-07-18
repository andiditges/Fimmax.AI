'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateStaffelSchedule } from '@/lib/rent-schedule'
import { lookupVpiForMonth } from '@/lib/vpi-history'

type RentType = 'fest' | 'staffel' | 'index'

export function RentChangeForm({ tenantId, propertyId }: { tenantId: string; propertyId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [amount, setAmount] = useState('')
  const [rentType, setRentType] = useState<RentType>('fest')
  const [staffelPercent, setStaffelPercent] = useState('')
  const [staffelYears, setStaffelYears] = useState('')
  const [indexBaseValue, setIndexBaseValue] = useState('')

  useEffect(() => {
    if (rentType !== 'index' || !startDate || indexBaseValue) return
    const looked_up = lookupVpiForMonth(startDate)
    if (looked_up !== null) setIndexBaseValue(String(looked_up))
  }, [rentType, startDate, indexBaseValue])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    let rows: Record<string, unknown>[]
    const rentAmount = parseFloat(amount)
    if (rentType === 'staffel') {
      const steps = generateStaffelSchedule(rentAmount, parseFloat(staffelPercent) || 0, parseInt(staffelYears) || 1, startDate)
      rows = steps.map(s => ({ property_id: propertyId, tenant_id: tenantId, rent_amount: s.rent_amount, start_date: s.start_date }))
    } else if (rentType === 'index') {
      rows = [{
        property_id: propertyId,
        tenant_id: tenantId,
        rent_amount: rentAmount,
        start_date: startDate,
        is_index_rent: true,
        index_base_value: parseFloat(indexBaseValue) || null,
        index_base_date: startDate,
      }]
    } else {
      rows = [{ property_id: propertyId, tenant_id: tenantId, rent_amount: rentAmount, start_date: startDate }]
    }

    const { error } = await supabase.from('rental_agreements').insert(rows)
    if (!error) {
      setStartDate('')
      setAmount('')
      setRentType('fest')
      setStaffelPercent('')
      setStaffelYears('')
      setIndexBaseValue('')
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

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mietart</label>
        <select
          value={rentType}
          onChange={e => setRentType(e.target.value as RentType)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="fest">Feste Miete</option>
          <option value="staffel">Staffelmiete</option>
          <option value="index">Indexmiete</option>
        </select>
      </div>

      {rentType === 'staffel' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Jährliche Erhöhung (%) *</label>
            <input type="number" step="0.01" value={staffelPercent} onChange={e => setStaffelPercent(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Anzahl Jahre *</label>
            <input type="number" value={staffelYears} onChange={e => setStaffelYears(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
        </div>
      )}

      {rentType === 'index' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Basis-Indexstand (VPI, optional)</label>
          <p className="text-xs text-gray-400 mb-1">Wird zum Datum oben automatisch vorgeschlagen, bei Bedarf mit dem Wert aus dem Mietvertrag überschreiben</p>
          <input type="number" step="0.001" value={indexBaseValue} onChange={e => setIndexBaseValue(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

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
