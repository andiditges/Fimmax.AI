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
  const [paymentDate, setPaymentDate] = useState(() => iso(new Date()))
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
    if (!loan || hypotheticalAmount <= 0 || !paymentDate) return null
    return simulateSpecialPayment(loan, existingSpecialPayments, hypotheticalAmount, new Date(paymentDate))
  }, [loan, existingSpecialPayments, hypotheticalAmount, paymentDate])

  // Kontingent bezieht sich auf das Kalenderjahr des gewählten Datums (nicht
  // zwingend "heute" - z.B. eine bereits per Terminüberweisung geplante,
  // aber noch nicht ausgeführte Sondertilgung) und muss bereits erfasste
  // Sondertilgungen desselben Jahres mit einrechnen.
  const overLimitBy = useMemo(() => {
    if (!loan || loan.special_payment_limit_percent == null || hypotheticalAmount <= 0 || !paymentDate) return 0
    const remaining = specialPaymentAllowanceRemaining(loan, existingSpecialPayments, new Date(paymentDate))
    if (remaining === null) return 0
    return Math.max(0, hypotheticalAmount - remaining)
  }, [loan, existingSpecialPayments, hypotheticalAmount, paymentDate])
  const isOverLimit = overLimitBy > 0.01

  async function applyNow() {
    if (!loan || hypotheticalAmount <= 0 || !paymentDate) return
    if (isOverLimit && !confirmOverLimit) return
    setApplying(true)
    const supabase = createClient()
    const { error } = await supabase.from('loan_special_payments').insert({
      loan_id: loan.id,
      payment_date: paymentDate,
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
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-3">
        Zunächst rein hypothetisch – erst mit Klick auf &bdquo;Jetzt genau so erfassen&ldquo; unten wird die Sondertilgung zum gewählten Datum mit dem berechneten Betrag tatsächlich gespeichert. Das Datum darf auch in der Zukunft liegen, z.B. für eine bereits per Terminüberweisung geplante Sondertilgung.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kredit</label>
          <select
            value={loanId}
            onChange={e => setLoanId(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sondertilgung</label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={e => { setValue(e.target.value); setConfirmOverLimit(false) }}
              placeholder={mode === 'prozent' ? 'z.B. 5' : 'z.B. 10000'}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => setMode('euro')}
                className={`px-3 py-2.5 text-sm ${mode === 'euro' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'}`}>€</button>
              <button type="button" onClick={() => setMode('prozent')}
                className={`px-3 py-2.5 text-sm ${mode === 'prozent' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'}`}>%</button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => { setPaymentDate(e.target.value); setConfirmOverLimit(false) }}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Auch ein zukünftiges Datum möglich, z.B. für eine bereits geplante, aber noch nicht ausgeführte Terminüberweisung.</p>
        </div>

        {mode === 'prozent' && hypotheticalAmount > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Entspricht {euro(hypotheticalAmount)} von aktuell {euro(remainingBalance)} Restschuld.</p>
        )}

        {simulation && (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 rounded-xl p-4 space-y-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Restlaufzeit verkürzt sich um</span>
              <strong className="text-green-700 dark:text-green-400">{simulation.months_saved} Monate</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Neues Zieldatum (schuldenfrei)</span>
              <strong className="text-gray-900 dark:text-gray-100">{simulation.new_payoff_date ? formatDate(simulation.new_payoff_date) : '–'}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Zinsersparnis über die Restlaufzeit</span>
              <strong className="text-green-700 dark:text-green-400">{euro(simulation.interest_saved_total)}</strong>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-green-100 dark:border-green-900">
              Die monatliche Rate bleibt dabei unverändert – die Sondertilgung verkürzt die Laufzeit, statt die Rate zu senken.
            </p>

            {isOverLimit && loan && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Diese Sondertilgung liegt {euro(overLimitBy)} über dem für {new Date(paymentDate).getFullYear()} vereinbarten kostenlosen Kontingent
                  ({loan.special_payment_limit_percent}% p.a. der Darlehenssumme) – zusammen mit ggf. bereits erfassten Sondertilgungen desselben Jahres.
                  Die Bank kann für den übersteigenden Teil eine Vorfälligkeitsentschädigung verlangen.
                </p>
                <label className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <input type="checkbox" checked={confirmOverLimit} onChange={e => setConfirmOverLimit(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-700 text-amber-600" />
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
              {applying ? 'Wird erfasst...' : `Jetzt genau so erfassen (${euro(hypotheticalAmount)} am ${formatDate(paymentDate)})`}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
