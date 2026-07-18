'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { euro, formatDate } from '@/lib/format'
import { RentalAgreement } from '@/lib/types'

export function RentHistoryRow({ agreement }: { agreement: RentalAgreement }) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startDate, setStartDate] = useState(agreement.start_date)
  const [amount, setAmount] = useState(String(agreement.rent_amount))

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('rental_agreements').update({
      start_date: startDate,
      rent_amount: parseFloat(amount),
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
      <form onSubmit={onSave} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <button type="submit" disabled={saving} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
          {saving ? '...' : 'Sichern'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
          Abbrechen
        </button>
      </form>
    )
  }

  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-600">seit {formatDate(agreement.start_date)}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{euro(agreement.rent_amount)}</span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
          Bearbeiten
        </button>
      </div>
    </div>
  )
}
