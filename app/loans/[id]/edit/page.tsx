'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { suggestInitialRepaymentRate } from '@/lib/amortization'
import { PaymentFrequency, DayCountConvention } from '@/lib/types'

export default function EditLoan() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({
    name: '',
    lender: '',
    principal: '',
    nominal_interest_rate: '',
    disbursement_date: '',
    initial_fixed_period_years: '',
    annuity_amount: '',
    payment_frequency: 'monatlich' as PaymentFrequency,
    day_count_convention: '30/360' as DayCountConvention,
    renovation_amount: '',
    interest_only_months: '',
  })

  useEffect(() => {
    supabase.from('loans').select('*').eq('id', params.id).single().then(({ data }) => {
      if (!data) return
      setForm({
        name: data.name ?? '',
        lender: data.lender ?? '',
        principal: String(data.principal ?? ''),
        nominal_interest_rate: String(data.nominal_interest_rate ?? ''),
        disbursement_date: data.disbursement_date ?? '',
        initial_fixed_period_years: data.initial_fixed_period_years != null ? String(data.initial_fixed_period_years) : '',
        annuity_amount: String(data.annuity_amount ?? ''),
        payment_frequency: data.payment_frequency,
        day_count_convention: data.day_count_convention,
        renovation_amount: data.planned_renovation_amount != null ? String(data.planned_renovation_amount) : '',
        interest_only_months: data.interest_only_months != null ? String(data.interest_only_months) : '',
      })
      setLoaded(true)
    })
  }, [params.id, supabase])

  const principal = parseFloat(form.principal)
  const rate = parseFloat(form.nominal_interest_rate)
  const annuity = parseFloat(form.annuity_amount)
  const suggestedRate =
    !isNaN(principal) && !isNaN(rate) && !isNaN(annuity) && principal > 0
      ? suggestInitialRepaymentRate(principal, rate, annuity, form.payment_frequency)
      : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('loans').update({
      name: form.name || (form.lender ? `${form.lender} Kredit` : 'Kredit'),
      lender: form.lender || null,
      principal: parseFloat(form.principal),
      nominal_interest_rate: parseFloat(form.nominal_interest_rate),
      disbursement_date: form.disbursement_date,
      initial_fixed_period_years: form.initial_fixed_period_years ? parseInt(form.initial_fixed_period_years) : null,
      annuity_amount: parseFloat(form.annuity_amount),
      payment_frequency: form.payment_frequency,
      day_count_convention: form.day_count_convention,
      planned_renovation_amount: form.renovation_amount ? parseFloat(form.renovation_amount) : null,
      interest_only_months: form.interest_only_months ? parseInt(form.interest_only_months) : null,
    }).eq('id', params.id)

    if (error) { alert('Fehler: ' + error.message); setLoading(false); return }
    router.push(`/loans/${params.id}`)
  }

  if (!loaded) return null

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kredit bearbeiten</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
            <input type="text" placeholder="z.B. Volksbank Baufinanzierung 1" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kreditgeber</label>
            <input type="text" value={form.lender} onChange={e => setForm(f => ({ ...f, lender: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Darlehenssumme (€) *</label>
              <input type="number" step="0.01" value={form.principal}
                onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sollzins p.a. (%) *</label>
              <input type="number" step="0.01" value={form.nominal_interest_rate}
                onChange={e => setForm(f => ({ ...f, nominal_interest_rate: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auszahlungsdatum *</label>
              <input type="date" value={form.disbursement_date}
                onChange={e => setForm(f => ({ ...f, disbursement_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zinsbindung (Jahre)</label>
              <input type="number" value={form.initial_fixed_period_years}
                onChange={e => setForm(f => ({ ...f, initial_fixed_period_years: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tilgungsfreie Zeit (Monate)</label>
            <p className="text-xs text-gray-400 mb-1">Optional – z.B. bei KfW-Darlehen oder während der Bauzeit. Ab Auszahlung werden für diese Anzahl Monate nur Zinsen fällig, danach beginnt die reguläre Tilgung mit der unten eingegebenen Rate.</p>
            <input type="number" value={form.interest_only_months}
              onChange={e => setForm(f => ({ ...f, interest_only_months: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate je Zahlung (€) *</label>
              <p className="text-xs text-gray-400 mb-1">Laut Tilgungsplan der Bank</p>
              <input type="number" step="0.01" value={form.annuity_amount}
                onChange={e => setForm(f => ({ ...f, annuity_amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsrhythmus</label>
              <select value={form.payment_frequency}
                onChange={e => setForm(f => ({ ...f, payment_frequency: e.target.value as PaymentFrequency }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="monatlich">Monatlich</option>
                <option value="vierteljährlich">Vierteljährlich</option>
                <option value="jährlich">Jährlich</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zinsmethode</label>
            <p className="text-xs text-gray-400 mb-1">30/360 ist der Standard bei deutschen Annuitätendarlehen und liefert einen gleichmäßig steigenden Tilgungsanteil wie im Bank-Tilgungsplan. Bei Abweichung von der echten Bank-Tilgung hier umstellen.</p>
            <select value={form.day_count_convention}
              onChange={e => setForm(f => ({ ...f, day_count_convention: e.target.value as DayCountConvention }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="30/360">30/360 (kaufmännisch)</option>
              <option value="act/365">act/365 (kalendertagsgenau)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">davon Renovierung/Sanierung geplant (€)</label>
            <input type="number" step="0.01" value={form.renovation_amount}
              onChange={e => setForm(f => ({ ...f, renovation_amount: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {suggestedRate !== null && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              Rechnerische anfängliche Tilgungsrate: <strong>{suggestedRate.toFixed(2)}%</strong> p.a.
            </p>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Wird gespeichert...' : 'Speichern'}
            </button>
            <button type="button" onClick={() => router.push(`/loans/${params.id}`)}
              className="px-5 py-3 rounded-xl font-medium text-gray-500 hover:text-gray-700 transition-colors">
              Abbrechen
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
