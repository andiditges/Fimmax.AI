'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { BUSINESS_EXPENSE_CATEGORY_LABELS, BusinessExpense, BusinessExpenseCategory } from '@/lib/types'

export function BusinessExpenseForm({ expense }: { expense?: BusinessExpense }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    expense_date: expense?.expense_date ?? new Date().toISOString().slice(0, 10),
    category: expense?.category ?? 'sonstiges' as BusinessExpenseCategory,
    vendor: expense?.vendor ?? '',
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount) : '',
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      expense_date: form.expense_date,
      category: form.category,
      vendor: form.vendor || null,
      description: form.description || null,
      amount: parseFloat(form.amount),
      tax_year: new Date(form.expense_date).getFullYear(),
    }

    const { error } = expense
      ? await supabase.from('business_expenses').update(payload).eq('id', expense.id)
      : await supabase.from('business_expenses').insert(payload)

    if (!error) router.push('/business-expenses')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  async function onDelete() {
    if (!expense) return
    if (!confirm('Diese Ausgabe wirklich löschen?')) return
    setLoading(true)
    const { error } = await supabase.from('business_expenses').delete().eq('id', expense.id)
    if (!error) router.push('/business-expenses')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{expense ? 'Ausgabe bearbeiten' : 'Betriebsausgabe erfassen'}</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum *</label>
              <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Betrag (€) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie *</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as BusinessExpenseCategory }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(BUSINESS_EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anbieter / Empfänger</label>
            <input type="text" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beschreibung</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? 'Wird gespeichert...' : expense ? 'Änderungen speichern' : 'Ausgabe speichern'}
          </button>

          {expense && (
            <button type="button" onClick={onDelete} disabled={loading}
              className="w-full text-center text-sm text-red-500 dark:text-red-400 hover:underline">
              Löschen
            </button>
          )}
        </form>
      </Card>
    </div>
  )
}
