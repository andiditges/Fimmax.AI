'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { specialPaymentAllowanceRemaining } from '@/lib/amortization'
import { euro } from '@/lib/format'
import { Loan, LoanSpecialPayment } from '@/lib/types'

export function SpecialPaymentForm({ loan, existingPayments }: { loan: Loan; existingPayments: LoanSpecialPayment[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [confirmOverLimit, setConfirmOverLimit] = useState(false)

  // Kontingent bezieht sich auf das Kalenderjahr der eingegebenen Sondertilgung
  // (nicht zwingend das laufende Jahr) - und muss bereits vorhandene
  // Sondertilgungen desselben Jahres mit einrechnen, egal ob die neue Zahlung
  // in einer Summe oder aufgeteilt auf mehrere Raten erfolgt.
  const overLimitBy = useMemo(() => {
    if (loan.special_payment_limit_percent == null || !date || !amount) return 0
    const enteredAmount = parseFloat(amount)
    if (isNaN(enteredAmount) || enteredAmount <= 0) return 0
    const remaining = specialPaymentAllowanceRemaining(loan, existingPayments, new Date(date))
    if (remaining === null) return 0
    return Math.max(0, enteredAmount - remaining)
  }, [loan, existingPayments, date, amount])

  const isOverLimit = overLimitBy > 0.01

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isOverLimit && !confirmOverLimit) return
    setSaving(true)
    const { error } = await supabase.from('loan_special_payments').insert({
      loan_id: loan.id,
      payment_date: date,
      amount: parseFloat(amount),
      note: note || null,
    })
    if (!error) {
      setDate('')
      setAmount('')
      setNote('')
      setConfirmOverLimit(false)
      setOpen(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:underline"
      >
        + Sondertilgung erfassen
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Datum *</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setConfirmOverLimit(false) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Betrag (€) *</label>
          <input type="number" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setConfirmOverLimit(false) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notiz</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {isOverLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-amber-800">
            Diese Sondertilgung liegt {euro(overLimitBy)} über dem für {new Date(date).getFullYear()} vereinbarten kostenlosen Kontingent
            ({loan.special_payment_limit_percent}% p.a. der Darlehenssumme) – zusammen mit ggf. bereits erfassten Sondertilgungen desselben Jahres.
            Die Bank kann für den übersteigenden Teil eine Vorfälligkeitsentschädigung verlangen.
          </p>
          <label className="flex items-center gap-2 text-xs text-amber-800">
            <input type="checkbox" checked={confirmOverLimit} onChange={e => setConfirmOverLimit(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600" />
            Trotzdem in dieser Höhe erfassen
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving || (isOverLimit && !confirmOverLimit)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? 'Speichert...' : 'Speichern'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">
          Abbrechen
        </button>
      </div>
    </form>
  )
}
