'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { getLoanStatus, simulateSpecialPayment, specialPaymentAllowanceRemaining, iso } from '@/lib/amortization'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { Loan, LoanSpecialPayment, Property } from '@/lib/types'

export function SondertilgungSimulator({
  loans,
  specialPaymentsByLoan,
  properties,
}: {
  loans: Loan[]
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>
  properties: Property[]
}) {
  const router = useRouter()
  const propertyById = Object.fromEntries(properties.map(p => [p.id, p]))
  const [loanId, setLoanId] = useState(loans[0]?.id ?? '')
  const [mode, setMode] = useState<'euro' | 'prozent'>('euro')
  const [value, setValue] = useState('')
  const [applying, setApplying] = useState(false)
  const [confirmOverLimit, setConfirmOverLimit] = useState(false)

  const loan = loans.find(l => l.id === loanId)
  const existingSpecialPayments = useMemo(
    () => (loan ? specialPaymentsByLoan[loan.id] ?? [] : []),
    [loan, specialPaymentsByLoan]
  )

  const remainingBalance = useMemo(() => {
    if (!loan) return 0
    return getLoanStatus(loan, existingSpecialPayments).remaining_balance
  }, [loan, existingSpecialPayments])

  const hypotheticalAmount = useMemo(() => {
    const n = parseFloat(value)
    if (isNaN(n) || n <= 0) return 0
    return mode === 'prozent' ? remainingBalance * (n / 100) : n
  }, [value, mode, remainingBalance])

  const simulation = useMemo(() => {
    if (!loan || hypotheticalAmount <= 0) return null
    return simulateSpecialPayment(loan, existingSpecialPayments, hypotheticalAmount)
  }, [loan, existingSpecialPayments, hypotheticalAmount])

  // Kontingent bezieht sich auf das Kalenderjahr von "heute" und muss bereits
  // erfasste Sondertilgungen desselben Jahres mit einrechnen.
  const overLimitBy = useMemo(() => {
    if (!loan || loan.special_payment_limit_percent == null || hypotheticalAmount <= 0) return 0
    const remaining = specialPaymentAllowanceRemaining(loan, existingSpecialPayments, new Date())
    if (remaining === null) return 0
    return Math.max(0, hypotheticalAmount - remaining)
  }, [loan, existingSpecialPayments, hypotheticalAmount])
  const isOverLimit = overLimitBy > 0.01

  async function applyNow() {
    if (!loan || hypotheticalAmount <= 0) return
    if (isOverLimit && !confirmOverLimit) return
    setApplying(true)
    const supabase = createClient()
    const { error } = await supabase.from('loan_special_payments').insert({
      loan_id: loan.id,
      payment_date: iso(new Date()),
      amount: hypotheticalAmount,
      note: 'Über Sondertilgungs-Simulator erfasst',
    })
    if (!error) {
      setValue('')
      setConfirmOverLimit(false)
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setApplying(false)
  }

  if (loans.length === 0) return null

  return (
    <Card>
      <CardTitle>Sondertilgungs-Simulator</CardTitle>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Zunächst rein hypothetisch – erst mit Klick auf &bdquo;Jetzt genau so erfassen&ldquo; unten wird die Sondertilgung heute mit dem berechneten Betrag tatsächlich gespeichert.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kredit</label>
          <select
            value={loanId}
            onChange={e => setLoanId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loans.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} · {propertyById[l.property_id] ? propertyLabel(propertyById[l.property_id]) : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sondertilgung heute</label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={e => { setValue(e.target.value); setConfirmOverLimit(false) }}
              placeholder={mode === 'prozent' ? 'z.B. 5' : 'z.B. 10000'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => setMode('euro')}
                className={`px-3 py-2.5 text-sm ${mode === 'euro' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>€</button>
              <button type="button" onClick={() => setMode('prozent')}
                className={`px-3 py-2.5 text-sm ${mode === 'prozent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>%</button>
            </div>
          </div>
        </div>

        {mode === 'prozent' && hypotheticalAmount > 0 && (
          <p className="text-xs text-gray-400">Entspricht {euro(hypotheticalAmount)} von aktuell {euro(remainingBalance)} Restschuld.</p>
        )}

        {simulation && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Restlaufzeit verkürzt sich um</span>
              <strong className="text-green-700">{simulation.months_saved} Monate</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Neues Zieldatum (schuldenfrei)</span>
              <strong className="text-gray-900">{simulation.new_payoff_date ? formatDate(simulation.new_payoff_date) : '–'}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Zinsersparnis über die Restlaufzeit</span>
              <strong className="text-green-700">{euro(simulation.interest_saved_total)}</strong>
            </div>
            <p className="text-xs text-gray-500 pt-1 border-t border-green-100">
              Die monatliche Rate bleibt dabei unverändert – die Sondertilgung verkürzt die Laufzeit, statt die Rate zu senken.
            </p>

            {isOverLimit && loan && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-800">
                  Diese Sondertilgung liegt {euro(overLimitBy)} über dem für {new Date().getFullYear()} vereinbarten kostenlosen Kontingent
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

            <button
              type="button"
              onClick={applyNow}
              disabled={applying || (isOverLimit && !confirmOverLimit)}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {applying ? 'Wird erfasst...' : `Jetzt genau so erfassen (${euro(hypotheticalAmount)} heute, ${formatDate(iso(new Date()))})`}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
