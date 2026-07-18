'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { euro, formatDate } from '@/lib/format'
import { lookupVpiForMonth } from '@/lib/vpi-history'
import { RentalAgreement } from '@/lib/types'

export function RentHistoryRow({ agreement }: { agreement: RentalAgreement }) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startDate, setStartDate] = useState(agreement.start_date)
  const [amount, setAmount] = useState(String(agreement.rent_amount))
  const [isIndexRent, setIsIndexRent] = useState(agreement.is_index_rent)
  const [indexBaseValue, setIndexBaseValue] = useState(agreement.index_base_value != null ? String(agreement.index_base_value) : '')

  useEffect(() => {
    if (!isIndexRent || !startDate || indexBaseValue) return
    const looked_up = lookupVpiForMonth(startDate)
    if (looked_up !== null) setIndexBaseValue(String(looked_up))
  }, [isIndexRent, startDate, indexBaseValue])

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('rental_agreements').update({
      start_date: startDate,
      rent_amount: parseFloat(amount),
      is_index_rent: isIndexRent,
      index_base_value: isIndexRent ? (parseFloat(indexBaseValue) || null) : null,
      index_base_date: isIndexRent ? startDate : null,
    }).eq('id', agreement.id)
    if (!error) {
      setEditing(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  if (editing) {
    return (
      <form onSubmit={onSave} className="py-2 border-b border-gray-50 last:border-0 space-y-2">
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={isIndexRent} onChange={e => setIsIndexRent(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
          Indexmiete
        </label>
        {isIndexRent && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Basis-Indexstand (VPI)</label>
            <input type="number" step="0.001" value={indexBaseValue} onChange={e => setIndexBaseValue(e.target.value)}
              className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
            {saving ? '...' : 'Sichern'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
            Abbrechen
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-600">
        seit {formatDate(agreement.start_date)}
        {agreement.is_index_rent && <span className="text-xs text-blue-600 ml-1.5">Index</span>}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{euro(agreement.rent_amount)}</span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
          Bearbeiten
        </button>
      </div>
    </div>
  )
}
