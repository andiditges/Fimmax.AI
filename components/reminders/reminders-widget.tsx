import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ReminderRow } from '@/components/reminders/reminder-row'
import { propertyLabel } from '@/lib/format'
import { Property, Reminder } from '@/lib/types'

export function RemindersWidget({ reminders, properties }: { reminders: Reminder[]; properties: Property[] }) {
  const propertyById = Object.fromEntries(properties.map(p => [p.id, p]))
  const reminderById = Object.fromEntries(reminders.map(r => [r.id, r]))

  const sorted = [...reminders].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  }).slice(0, 6)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Erinnerungen & ToDos</h2>
        <Link href="/reminders" className="text-sm text-blue-600 hover:underline">Alle anzeigen →</Link>
      </div>
      {sorted.length === 0 ? (
        <Card className="text-center py-8 text-gray-400">Keine offenen Erinnerungen. 🎉</Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(r => {
            const p = propertyById[r.property_id]
            return (
              <ReminderRow
                key={r.id}
                reminder={r}
                propertyLabel={p ? propertyLabel(p) : undefined}
                dependsOnTitle={r.depends_on_id ? reminderById[r.depends_on_id]?.title : null}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
