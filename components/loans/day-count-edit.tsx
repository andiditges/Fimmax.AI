'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DayCountConvention } from '@/lib/types'

export function DayCountEdit({ loanId, current }: { loanId: string; current: DayCountConvention }) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<DayCountConvention>(current)
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    const { error } = await supabase.from('loans').update({ day_count_convention: value }).eq('id', loanId)
    if (!error) {
      setEditing(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <p className="text-xs text-gray-400 mt-1">
        Zinsmethode: {current === '30/360' ? '30/360 (kaufmännisch)' : 'act/365 (kalendertagsgenau)'}
        <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline ml-1.5">ändern</button>
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <select value={value} onChange={e => setValue(e.target.value as DayCountConvention)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="30/360">30/360 (kaufmännisch)</option>
        <option value="act/365">act/365 (kalendertagsgenau)</option>
      </select>
      <button onClick={onSave} disabled={saving} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
        {saving ? '...' : 'Sichern'}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
        Abbrechen
      </button>
    </div>
  )
}
