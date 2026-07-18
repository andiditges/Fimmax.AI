'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { REMINDER_CATEGORY_LABELS, Reminder, ReminderCategory } from '@/lib/types'

export default function NewReminder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null }[]>([])
  const [openReminders, setOpenReminders] = useState<Reminder[]>([])
  const [form, setForm] = useState({
    property_id: searchParams.get('property') ?? '',
    category: 'sonstiges' as ReminderCategory,
    title: '',
    description: '',
    due_date: '',
    depends_on_id: '',
  })

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label').then(({ data }) => {
      setProperties(data ?? [])
    })
    if (form.property_id) {
      supabase.from('reminders').select('*').eq('property_id', form.property_id).neq('status', 'erledigt')
        .then(({ data }) => setOpenReminders((data ?? []) as Reminder[]))
    }
  })

  async function onPropertyChange(propertyId: string) {
    setForm(f => ({ ...f, property_id: propertyId, depends_on_id: '' }))
    if (!propertyId) { setOpenReminders([]); return }
    const { data } = await supabase.from('reminders').select('*').eq('property_id', propertyId).neq('status', 'erledigt')
    setOpenReminders((data ?? []) as Reminder[])
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id) return alert('Bitte eine Immobilie auswählen')
    setSaving(true)
    const { error } = await supabase.from('reminders').insert({
      property_id: form.property_id,
      category: form.category,
      title: form.title,
      description: form.description || null,
      due_date: form.due_date || null,
      depends_on_id: form.depends_on_id || null,
    })
    if (!error) router.push('/reminders')
    else { alert('Fehler: ' + error.message); setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Erinnerung / ToDo anlegen</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Immobilie *</label>
            <select
              value={form.property_id}
              onChange={e => onPropertyChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Bitte wählen...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie *</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as ReminderCategory }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(REMINDER_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fälligkeitsdatum</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {openReminders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hängt ab von</label>
              <p className="text-xs text-gray-400 mb-1">Optional – z.B. Mieterhöhung erst nach Abschluss einer Reparatur</p>
              <select
                value={form.depends_on_id}
                onChange={e => setForm(f => ({ ...f, depends_on_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">– keine Abhängigkeit –</option>
                {openReminders.map(r => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Wird gespeichert...' : 'Erinnerung speichern'}
          </button>
        </form>
      </Card>
    </div>
  )
}
