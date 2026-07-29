'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReminderSuggestion } from '@/lib/reminder-suggestions'

// Bewusst als expliziter Button statt automatisch beim Seitenaufruf angelegt
// (ein GET-Seitenaufruf soll keine Schreibwirkung haben) - Abgleich gegen
// bereits vorhandene offene Erinnerungen (gleiche Immobilie + gleicher Titel)
// verhindert Duplikate bei mehrfachem Klick.
export function GenerateRemindersButton({ label, suggestions }: { label: string; suggestions: ReminderSuggestion[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [createdCount, setCreatedCount] = useState(0)

  if (suggestions.length === 0) return null

  async function onClick() {
    setState('saving')
    const { data: existing } = await supabase
      .from('reminders')
      .select('property_id, title')
      .neq('status', 'erledigt')
      .in('property_id', suggestions.map(s => s.property_id))

    const existingKeys = new Set((existing ?? []).map(r => `${r.property_id}::${r.title}`))
    const toInsert = suggestions
      .filter(s => !existingKeys.has(`${s.property_id}::${s.title}`))
      .map(({ tenant_id: _tenant_id, ...s }) => s)

    if (toInsert.length > 0) {
      const { error } = await supabase.from('reminders').insert(toInsert)
      if (error) { alert('Fehler: ' + error.message); setState('idle'); return }
    }
    setCreatedCount(toInsert.length)
    setState('done')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={state === 'saving'}
        className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {state === 'saving' ? 'Wird angelegt...' : label}
      </button>
      {state === 'done' && (
        <span className="text-xs text-gray-400">
          {createdCount > 0 ? `${createdCount} Erinnerung${createdCount === 1 ? '' : 'en'} angelegt.` : 'Bereits alle angelegt.'}
        </span>
      )}
    </div>
  )
}
