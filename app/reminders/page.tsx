import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card } from '@/components/ui/card'
import { ReminderRow } from '@/components/reminders/reminder-row'
import { propertyLabel } from '@/lib/format'
import { Property, Reminder } from '@/lib/types'

export default async function RemindersPage() {
  await requireUser()
  const supabase = await createClient()

  const [{ data: reminders }, { data: properties }] = await Promise.all([
    supabase.from('reminders').select('*').order('status').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('properties').select('*'),
  ])

  const list = (reminders ?? []) as Reminder[]
  const props = (properties ?? []) as Property[]
  const propertyById = Object.fromEntries(props.map(p => [p.id, p]))
  const reminderById = Object.fromEntries(list.map(r => [r.id, r]))

  const open = list.filter(r => r.status !== 'erledigt')
  const done = list.filter(r => r.status === 'erledigt')

  function propertyLabelFor(propertyId: string) {
    const p = propertyById[propertyId]
    return p ? propertyLabel(p) : ''
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Erinnerungen & ToDos</h1>
          <p className="text-gray-500 text-sm mt-1">Mieterhöhungen, Eigentümerversammlungen, offene Aufgaben je Wohnung</p>
        </div>
        <Link href="/reminders/new" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap">
          + Erinnerung
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Offen ({open.length})</h2>
        {open.length === 0 ? (
          <Card className="text-center py-12 text-gray-400">Keine offenen Erinnerungen.</Card>
        ) : (
          <div className="space-y-2">
            {open.map(r => (
              <ReminderRow
                key={r.id}
                reminder={r}
                propertyLabel={propertyLabelFor(r.property_id)}
                dependsOnTitle={r.depends_on_id ? reminderById[r.depends_on_id]?.title : null}
              />
            ))}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Erledigt ({done.length})</h2>
          <div className="space-y-2">
            {done.map(r => (
              <ReminderRow key={r.id} reminder={r} propertyLabel={propertyLabelFor(r.property_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
