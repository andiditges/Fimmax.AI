'use client'
import { useState, useMemo } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { getLoanStatus, simulateSpecialPayment } from '@/lib/amortization'
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
  const propertyById = Object.fromEntries(properties.map(p => [p.id, p]))
  const [loanId, setLoanId] = useState(loans[0]?.id ?? '')
  const [mode, setMode] = useState<'euro' | 'prozent'>('euro')
  const [value, setValue] = useState('')

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

  if (loans.length === 0) return null

  return (
    <Card>
      <CardTitle>Sondertilgungs-Simulator</CardTitle>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Rein hypothetisch – speichert nichts. Für eine echte Sondertilgung nutze &bdquo;+ Sondertilgung erfassen&ldquo; auf der Kredit-Seite.
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
              onChange={e => setValue(e.target.value)}
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
          </div>
        )}
      </div>
    </Card>
  )
}
