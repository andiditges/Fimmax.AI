'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { suggestInitialRepaymentRate } from '@/lib/amortization'
import { Roofed } from '@/components/roofed'
import { propertyLabel, euro } from '@/lib/format'
import { PaymentFrequency, DayCountConvention } from '@/lib/types'

export default function NewLoan() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null; purchase_price: number; incidental_costs: number }[]>([])
  const [form, setForm] = useState({
    property_id: searchParams.get('property') ?? '',
    name: '',
    lender: '',
    principal: '',
    nominal_interest_rate: '',
    disbursement_date: '',
    initial_fixed_period_years: '',
    annuity_amount: '',
    payment_frequency: 'monatlich' as PaymentFrequency,
    day_count_convention: 'act/365' as DayCountConvention,
    incidental_costs_amount: '',
    renovation_amount: '',
    interest_only_months: '',
  })

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label, purchase_price, incidental_costs').then(({ data }) => {
      setProperties(data ?? [])
    })
  })

  const principal = parseFloat(form.principal)
  const rate = parseFloat(form.nominal_interest_rate)
  const annuity = parseFloat(form.annuity_amount)
  const suggestedRate =
    !isNaN(principal) && !isNaN(rate) && !isNaN(annuity) && principal > 0
      ? suggestInitialRepaymentRate(principal, rate, annuity, form.payment_frequency)
      : null

  const selectedProperty = properties.find(p => p.id === form.property_id)
  const overage = selectedProperty && !isNaN(principal) ? principal - selectedProperty.purchase_price : 0
  const showOverageFields = overage > 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id) return alert('Bitte eine Immobilie auswählen')
    setLoading(true)

    const name = form.name || (form.lender ? `${form.lender} Kredit` : 'Kredit')
    const incidentalAmount = showOverageFields && form.incidental_costs_amount ? parseFloat(form.incidental_costs_amount) : 0
    const renovationAmount = showOverageFields && form.renovation_amount ? parseFloat(form.renovation_amount) : null

    const { error } = await supabase.from('loans').insert({
      property_id: form.property_id,
      name,
      lender: form.lender || null,
      principal: parseFloat(form.principal),
      nominal_interest_rate: parseFloat(form.nominal_interest_rate),
      disbursement_date: form.disbursement_date,
      initial_fixed_period_years: form.initial_fixed_period_years ? parseInt(form.initial_fixed_period_years) : null,
      annuity_amount: parseFloat(form.annuity_amount),
      payment_frequency: form.payment_frequency,
      day_count_convention: form.day_count_convention,
      planned_renovation_amount: renovationAmount,
      interest_only_months: form.interest_only_months ? parseInt(form.interest_only_months) : null,
    })
    if (error) { alert('Fehler: ' + error.message); setLoading(false); return }

    if (incidentalAmount > 0 && selectedProperty) {
      const { error: propertyError } = await supabase.from('properties')
        .update({ incidental_costs: selectedProperty.incidental_costs + incidentalAmount })
        .eq('id', form.property_id)
      if (propertyError) { alert('Fehler: ' + propertyError.message); setLoading(false); return }
    }

    router.push(`/properties/${form.property_id}`)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neuer Kredit</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><Roofed>Immobilie</Roofed> *</label>
            <select
              value={form.property_id}
              onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Bitte wählen...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
            <p className="text-xs text-gray-400 mb-1">Optional – nur nötig, um mehrere Kredite auseinanderzuhalten. Ohne Eingabe wird &bdquo;Kreditgeber + Kredit&ldquo; verwendet.</p>
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

          {showOverageFields && (
            <div className="space-y-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                Die Darlehenssumme liegt {euro(overage)} über dem Kaufpreis dieser <Roofed>Immobilie</Roofed>. Wofür ist die Differenz?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">davon Kaufnebenkosten (€)</label>
                  <input type="number" step="0.01" value={form.incidental_costs_amount}
                    onChange={e => setForm(f => ({ ...f, incidental_costs_amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">davon Renovierung/Sanierung (€)</label>
                  <input type="number" step="0.01" value={form.renovation_amount}
                    onChange={e => setForm(f => ({ ...f, renovation_amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="text-xs text-amber-700">
                Kaufnebenkosten werden bei der <Roofed>Immobilie</Roofed> hinterlegt. Der Renovierungsbetrag wird als geplantes Budget
                auf der Objektseite angezeigt – zählt aber erst zur 15%-Hürde, sobald du die tatsächlichen Belege erfasst.
              </p>
            </div>
          )}

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
            <p className="text-xs text-gray-400 mb-1">Bei Abweichung von der echten Bank-Tilgung hier umstellen</p>
            <select value={form.day_count_convention}
              onChange={e => setForm(f => ({ ...f, day_count_convention: e.target.value as DayCountConvention }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="act/365">act/365 (kalendertagsgenau)</option>
              <option value="30/360">30/360 (kaufmännisch)</option>
            </select>
          </div>

          {suggestedRate !== null && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              Rechnerische anfängliche Tilgungsrate: <strong>{suggestedRate.toFixed(2)}%</strong> p.a.
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? 'Wird gespeichert...' : 'Kredit anlegen'}
          </button>
        </form>
      </Card>
    </div>
  )
}
