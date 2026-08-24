'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { SensitiveEuro } from '@/components/privacy/sensitive'
import { formatDate } from '@/lib/format'
import { CapitalRecovery } from '@/lib/types'

// Sonstige, nicht aus Miete stammende Rückflüsse (z.B. der Immobilien-Anteil
// einer Steuerrückerstattung, zurückzuführen auf abgesetzte Werbungskosten/
// AfA/Nutzungsdauergutachten) - portfolioweit statt je Objekt, weil sich eine
// Steuererklärung nie sauber auf ein einzelnes Objekt herunterbrechen lässt.
// Fließt über capitalRecoveries in calcEquityBreakEven ein (lib/equity-breakeven.ts).
export function CapitalRecoveries({ recoveries }: { recoveries: CapitalRecovery[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ recovery_date: '', amount: '', description: '' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('capital_recoveries').insert({
      recovery_date: form.recovery_date,
      amount: parseFloat(form.amount) || 0,
      description: form.description || null,
    })
    if (!error) {
      setForm({ recovery_date: '', amount: '', description: '' })
      setOpen(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  async function onDelete(id: string) {
    if (!confirm('Diesen Rückfluss wirklich löschen?')) return
    const { error } = await supabase.from('capital_recoveries').delete().eq('id', id)
    if (error) alert('Fehler: ' + error.message)
    else router.refresh()
  }

  const total = recoveries.reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Sonstige Rückflüsse</h2>
        {!open && <button onClick={() => setOpen(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Rückfluss erfassen</button>}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2 mb-3">
        Geld, das nicht aus der Miete stammt, aber wirtschaftlich dein eingesetztes Eigenkapital zurückgewinnt - z.B. der auf die Immobilien entfallende Anteil einer Steuerrückerstattung. Fließt zum jeweiligen Datum in den Break-even ein.
      </p>

      {recoveries.length > 0 && (
        <Card className="mb-3">
          <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            <span>Bisher erfasst</span>
            <span><SensitiveEuro seed="capital-recoveries-total" amount={total} /></span>
          </div>
          <div className="space-y-1.5">
            {recoveries.map(r => (
              <div key={r.id} className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {formatDate(r.recovery_date)}{r.description ? ` · ${r.description}` : ''}
                </span>
                <span className="flex items-center gap-2">
                  <SensitiveEuro seed={`${r.id}-amount`} amount={r.amount} />
                  <button type="button" onClick={() => onDelete(r.id)} className="text-xs text-red-500 dark:text-red-400 hover:underline">
                    Löschen
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recoveries.length === 0 && !open && (
        <Card className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">Noch keine sonstigen Rückflüsse erfasst</Card>
      )}

      {open && (
        <Card>
          <CardTitle>Neuer Rückfluss</CardTitle>
          <form onSubmit={onSubmit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Datum *</label>
                <input type="date" value={form.recovery_date} onChange={e => setForm(f => ({ ...f, recovery_date: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Betrag (€) *</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notiz (optional)</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="z.B. Steuerrückerstattung 2024 (Immo-Anteil)"
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2 hover:text-gray-700 dark:hover:text-gray-200">
                Abbrechen
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
