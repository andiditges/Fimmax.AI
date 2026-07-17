'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Reminder, ReminderStatus, REMINDER_CATEGORY_LABELS, REMINDER_STATUS_LABELS } from '@/lib/types'
import { formatDate } from '@/lib/format'

const CATEGORY_COLORS: Record<string, string> = {
  mieterhoehung: 'bg-blue-100 text-blue-800',
  eigentuemerversammlung: 'bg-purple-100 text-purple-800',
  hausverwaltung: 'bg-amber-100 text-amber-800',
  instandhaltung: 'bg-orange-100 text-orange-800',
  sonstiges: 'bg-gray-100 text-gray-700',
}

function dueDateColor(dueDate: string | null, status: ReminderStatus): string {
  if (status === 'erledigt' || !dueDate) return 'text-gray-400'
  const days = (new Date(dueDate).getTime() - Date.now()) / 86400000
  if (days < 0) return 'text-red-600 font-semibold'
  if (days <= 7) return 'text-orange-600 font-medium'
  return 'text-gray-500'
}

export function ReminderRow({
  reminder,
  propertyLabel,
  dependsOnTitle,
}: {
  reminder: Reminder
  propertyLabel?: string
  dependsOnTitle?: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState(reminder.status)
  const [saving, setSaving] = useState(false)

  async function onStatusChange(next: ReminderStatus) {
    setSaving(true)
    setStatus(next)
    const { error } = await supabase.from('reminders').update({ status: next }).eq('id', reminder.id)
    if (error) alert('Fehler: ' + error.message)
    setSaving(false)
    router.refresh()
  }

  return (
    <Card className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[reminder.category]}`}>
              {REMINDER_CATEGORY_LABELS[reminder.category]}
            </span>
            {propertyLabel && <span className="text-xs text-gray-400">{propertyLabel}</span>}
          </div>
          <p className={`text-sm font-medium mt-1 ${status === 'erledigt' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {reminder.title}
          </p>
          {reminder.description && (
            <p className="text-xs text-gray-500 mt-0.5">{reminder.description}</p>
          )}
          {dependsOnTitle && status !== 'erledigt' && (
            <p className="text-xs text-amber-700 mt-1">⏳ hängt ab von: {dependsOnTitle}</p>
          )}
          {reminder.due_date && (
            <p className={`text-xs mt-1 ${dueDateColor(reminder.due_date, status)}`}>
              fällig: {formatDate(reminder.due_date)}
            </p>
          )}
        </div>
        <select
          value={status}
          disabled={saving}
          onChange={e => onStatusChange(e.target.value as ReminderStatus)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {Object.entries(REMINDER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
    </Card>
  )
}
