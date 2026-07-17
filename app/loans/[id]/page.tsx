import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { SpecialPaymentForm } from '@/components/loans/special-payment-form'
import { DebtOverTimeChart } from '@/components/charts/debt-over-time-chart'
import { generateAmortizationSchedule, getLoanStatus } from '@/lib/amortization'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { Loan, LoanSpecialPayment, Property } from '@/lib/types'

export default async function LoanDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()

  const { data: loan } = await supabase.from('loans').select('*').eq('id', id).single()
  if (!loan) notFound()

  const [{ data: specialPayments }, { data: property }] = await Promise.all([
    supabase.from('loan_special_payments').select('*').eq('loan_id', id).order('payment_date'),
    supabase.from('properties').select('*').eq('id', loan.property_id).single(),
  ])

  const l = loan as Loan
  const sp = (specialPayments ?? []) as LoanSpecialPayment[]
  const p = property as Property

  const schedule = generateAmortizationSchedule(l, sp)
  const status = getLoanStatus(l, sp)

  const chartData = schedule.entries.map(e => ({ date: e.date, remaining_balance: e.remaining_balance }))
  chartData.unshift({ date: l.disbursement_date, remaining_balance: l.principal })

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/properties/${l.property_id}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">
          ← {p ? propertyLabel(p) : 'Immobilie'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{l.name}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {l.lender ? `${l.lender} · ` : ''}{euro(l.principal)} · {l.nominal_interest_rate}% Sollzins · {l.payment_frequency}
        </p>
      </div>

      {schedule.warning === 'negative_amortization' && (
        <Card className="bg-red-50 border-red-100">
          <p className="text-sm text-red-700">
            Die eingegebene Rate deckt nicht einmal die Zinsen dieser Periode – bitte Eingaben prüfen (Sollzins, Rate).
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardTitle>Restschuld heute</CardTitle>
          <p className="text-2xl font-bold text-gray-900">{euro(status.remaining_balance)}</p>
        </Card>
        <Card>
          <CardTitle>Rate je Zahlung</CardTitle>
          <p className="text-2xl font-bold text-blue-600">{euro(status.current_annuity_amount)}</p>
        </Card>
        <Card>
          <CardTitle>Zinsen kumuliert</CardTitle>
          <p className="text-2xl font-bold text-red-500">{euro(status.cumulative_interest_paid)}</p>
        </Card>
        <Card>
          <CardTitle>Tilgung kumuliert</CardTitle>
          <p className="text-2xl font-bold text-green-600">{euro(status.cumulative_principal_paid)}</p>
        </Card>
      </div>

      {l.initial_fixed_period_years && schedule.balance_at_fixed_period_end !== null && (
        <Card className="bg-gray-50">
          <p className="text-sm text-gray-600">
            Zinsbindung endet nach {l.initial_fixed_period_years} Jahren am{' '}
            <strong>{formatDate(addYearsIso(l.disbursement_date, l.initial_fixed_period_years))}</strong>
            {' '}– Restschuld zu diesem Zeitpunkt voraussichtlich <strong>{euro(schedule.balance_at_fixed_period_end)}</strong>.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Restschuld-Verlauf</CardTitle>
        <DebtOverTimeChart data={chartData} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Sondertilgungen ({sp.length})</CardTitle>
        </div>
        {sp.length > 0 && (
          <div className="space-y-2 mb-4">
            {sp.map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-600">{formatDate(s.payment_date)}{s.note ? ` · ${s.note}` : ''}</span>
                <span className="font-medium text-gray-900">{euro(s.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <SpecialPaymentForm loanId={l.id} />
      </Card>

      <Card>
        <CardTitle>Tilgungsplan</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Datum</th>
                <th className="pb-2 font-medium text-right">Zinsen</th>
                <th className="pb-2 font-medium text-right">Tilgung</th>
                <th className="pb-2 font-medium text-right">Sondertilgung</th>
                <th className="pb-2 font-medium text-right">Restschuld</th>
              </tr>
            </thead>
            <tbody>
              {schedule.entries.slice(0, 60).map((e, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-600">{formatDate(e.date)}</td>
                  <td className="py-1.5 text-right text-red-500">{euro(e.interest_accrued)}</td>
                  <td className="py-1.5 text-right text-green-600">{euro(e.scheduled_principal)}</td>
                  <td className="py-1.5 text-right text-blue-600">{e.special_payment > 0 ? euro(e.special_payment) : '–'}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900">{euro(e.remaining_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedule.entries.length > 60 && (
            <p className="text-xs text-gray-400 mt-2">Zeige die ersten 60 von {schedule.entries.length} Einträgen.</p>
          )}
          {schedule.payoff_date && (
            <p className="text-sm text-green-600 mt-3">Voraussichtlich vollständig getilgt am {formatDate(schedule.payoff_date)}.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function addYearsIso(dateIso: string, years: number): string {
  const d = new Date(dateIso)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}
