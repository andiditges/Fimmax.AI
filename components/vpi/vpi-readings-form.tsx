'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { VpiChart } from '@/components/charts/vpi-chart'
import { formatDate } from '@/lib/format'
import { VpiReading } from '@/lib/types'

export function VpiReadingsForm({ readings }: { readings: VpiReading[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const thisMonth = new Date().toISOString().slice(0, 7) + '-01'
  const [month, setMonth] = useState(thisMonth)
  const [value, setValue] = useState('')

  const sorted = [...readings].sort((a, b) => b.month.localeCompare(a.month))
  const chartData = [...readings].sort((a, b) => a.month.localeCompare(b.month))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('vpi_readings').upsert({
      month,
      value: parseFloat(value),
    }, { onConflict: 'user_id,month' })
    if (!error) {
      setValue('')
      setOpen(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <CardTitle>Verbraucherpreisindex (VPI, Destatis, Basis 2020=100)</CardTitle>
        {!open && <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline whitespace-nowrap">+ Indexstand erfassen</button>}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Manuell gepflegt (aktuellen Wert findest du auf destatis.de unter "Verbraucherpreisindex") – trage ihn ein, sobald Destatis den Monat veröffentlicht.
      </p>

      <VpiChart data={chartData} />

      {open && (
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-100 rounded-xl p-4 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monat *</label>
            <input type="date" value={month} onChange={e => setMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Indexstand *</label>
            <input type="number" step="0.001" value={value} onChange={e => setValue(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {sorted.length > 0 && (
        <div className="mt-3 space-y-1">
          {sorted.slice(0, 6).map(r => (
            <div key={r.id} className="flex justify-between text-sm text-gray-600">
              <span>{formatDate(r.month)}</span>
              <span className="font-medium text-gray-900">{r.value.toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
