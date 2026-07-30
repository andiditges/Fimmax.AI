'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { annuityFromInitialRepaymentRate, calcBereitstellungszinsen, suggestInitialRepaymentRate } from '@/lib/amortization'
import { euro } from '@/lib/format'
import { ASSET_CATEGORY_LABELS, AssetCategory, PaymentFrequency, DayCountConvention } from '@/lib/types'

export default function EditLoan() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [assets, setAssets] = useState<{ id: string; name: string | null; category: string; institution: string | null }[]>([])
  const [otherLoans, setOtherLoans] = useState<{ id: string; name: string; lender: string | null }[]>([])
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
    special_payment_limit_percent: '',
    contract_date: '',
    bereitstellungszins_rate: '',
    bereitstellungsfreie_monate: '',
    funded_by_asset_id: '',
    replaces_loan_id: '',
  })

  useEffect(() => {
    supabase.from('assets').select('id, name, category, institution').then(({ data }) => {
      setAssets(data ?? [])
    })
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
        special_payment_limit_percent: data.special_payment_limit_percent != null ? String(data.special_payment_limit_percent) : '',
        contract_date: data.contract_date ?? '',
        bereitstellungszins_rate: data.bereitstellungszins_rate != null ? String(data.bereitstellungszins_rate) : '',
        bereitstellungsfreie_monate: data.bereitstellungsfreie_monate != null ? String(data.bereitstellungsfreie_monate) : '',
        funded_by_asset_id: data.funded_by_asset_id ?? '',
        replaces_loan_id: data.replaces_loan_id ?? '',
      })
      setLoaded(true)
      supabase.from('loans').select('id, name, lender').eq('property_id', data.property_id).neq('id', params.id).then(({ data: loans }) => {
        setOtherLoans(loans ?? [])
      })
    })
  }, [params.id, supabase])

  const [rateMode, setRateMode] = useState<'eur' | 'percent'>('eur')
  const [repaymentRatePercent, setRepaymentRatePercent] = useState('')

  const principal = parseFloat(form.principal)
  const rate = parseFloat(form.nominal_interest_rate)
  const repaymentPct = parseFloat(repaymentRatePercent)
  const computedAnnuity =
    !isNaN(principal) && !isNaN(rate) && !isNaN(repaymentPct) && principal > 0
      ? annuityFromInitialRepaymentRate(principal, rate, repaymentPct, form.payment_frequency)
      : null
  const annuity = rateMode === 'percent' ? computedAnnuity ?? NaN : parseFloat(form.annuity_amount)
  const suggestedRate =
    rateMode === 'eur' && !isNaN(principal) && !isNaN(rate) && !isNaN(annuity) && principal > 0
      ? suggestInitialRepaymentRate(principal, rate, annuity, form.payment_frequency)
      : null

  const bereitstellungszinsen =
    !isNaN(principal) && principal > 0 && form.contract_date && form.disbursement_date && form.bereitstellungszins_rate
      ? calcBereitstellungszinsen({
          principal,
          contract_date: form.contract_date,
          disbursement_date: form.disbursement_date,
          bereitstellungszins_rate: parseFloat(form.bereitstellungszins_rate),
          bereitstellungsfreie_monate: form.bereitstellungsfreie_monate ? parseInt(form.bereitstellungsfreie_monate) : null,
        })
      : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rateMode === 'percent' && (computedAnnuity == null || isNaN(computedAnnuity))) {
      return alert('Bitte Darlehenssumme, Sollzins und Tilgungsrate ausfüllen, damit die Rate berechnet werden kann')
    }
    setLoading(true)

    const { error } = await supabase.from('loans').update({
      name: form.name || (form.lender ? `${form.lender} Kredit` : 'Kredit'),
      lender: form.lender || null,
      principal: parseFloat(form.principal),
      nominal_interest_rate: parseFloat(form.nominal_interest_rate),
      disbursement_date: form.disbursement_date,
      initial_fixed_period_years: form.initial_fixed_period_years ? parseInt(form.initial_fixed_period_years) : null,
      annuity_amount: rateMode === 'percent' ? computedAnnuity! : parseFloat(form.annuity_amount),
      payment_frequency: form.payment_frequency,
      day_count_convention: form.day_count_convention,
      planned_renovation_amount: form.renovation_amount ? parseFloat(form.renovation_amount) : null,
      interest_only_months: form.interest_only_months ? parseInt(form.interest_only_months) : null,
      special_payment_limit_percent: form.special_payment_limit_percent ? parseFloat(form.special_payment_limit_percent) : null,
      contract_date: form.contract_date || null,
      bereitstellungszins_rate: form.bereitstellungszins_rate ? parseFloat(form.bereitstellungszins_rate) : null,
      bereitstellungsfreie_monate: form.bereitstellungsfreie_monate ? parseInt(form.bereitstellungsfreie_monate) : null,
      funded_by_asset_id: form.funded_by_asset_id || null,
      replaces_loan_id: form.replaces_loan_id || null,
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

          {otherLoans.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Löst ab (Anschlussfinanzierung von)</label>
              <p className="text-xs text-gray-400 mb-1">
                Optional – nur ausfüllen, wenn dieser Kredit die Restschuld eines bestehenden Kredits derselben Immobilie fortführt (z.B. nach Ende der Zinsbindung). Verhindert, dass beide Kreditsummen doppelt in Tilgungsquote und Restschuld gezählt werden.
              </p>
              <select value={form.replaces_loan_id}
                onChange={e => setForm(f => ({ ...f, replaces_loan_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">– keiner –</option>
                {otherLoans.map(l => (
                  <option key={l.id} value={l.id}>{l.name}{l.lender ? ` · ${l.lender}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tilgungsfreie Zeit (Monate)</label>
            <p className="text-xs text-gray-400 mb-1">Optional – z.B. bei KfW-Darlehen oder während der Bauzeit. Ab Auszahlung werden für diese Anzahl Monate nur Zinsen fällig, danach beginnt die reguläre Tilgung mit der unten eingegebenen Rate.</p>
            <input type="number" value={form.interest_only_months}
              onChange={e => setForm(f => ({ ...f, interest_only_months: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Rate je Zahlung</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setRateMode('eur')}
                    className={`px-2.5 py-1 transition-colors ${rateMode === 'eur' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    €
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateMode('percent')}
                    className={`px-2.5 py-1 border-l border-gray-200 transition-colors ${rateMode === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    %
                  </button>
                </div>
              </div>
              {rateMode === 'eur' ? (
                <>
                  <p className="text-xs text-gray-400 mb-1">Laut Tilgungsplan der Bank</p>
                  <input type="number" step="0.01" value={form.annuity_amount}
                    onChange={e => setForm(f => ({ ...f, annuity_amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-1">Anfängliche Tilgungsrate p.a., steht im Vertrag – die Rate in € wird daraus berechnet</p>
                  <div className="relative">
                    <input type="number" step="0.01" value={repaymentRatePercent}
                      onChange={e => setRepaymentRatePercent(e.target.value)}
                      placeholder="z.B. 2"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </>
              )}
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

          {rateMode === 'percent' && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2 -mt-2">
              {computedAnnuity !== null
                ? <>Rechnerische Rate je Zahlung: <strong>{euro(computedAnnuity)}</strong></>
                : 'Für die Berechnung Darlehenssumme, Sollzins und Tilgungsrate ausfüllen.'}
            </p>
          )}

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sondertilgungsgrenze pro Jahr (%)</label>
            <p className="text-xs text-gray-400 mb-1">Optional – üblich sind 5% der Darlehenssumme pro Jahr ohne Vorfälligkeitsentschädigung. Steht im Darlehensvertrag. Ohne Angabe wird kein Limit geprüft.</p>
            <input type="number" step="0.01" value={form.special_payment_limit_percent}
              onChange={e => setForm(f => ({ ...f, special_payment_limit_percent: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="border-t border-gray-100 pt-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Bereitstellungszinsen</h2>
              <p className="text-xs text-gray-400">
                Optional – falls zwischen Vertragsabschluss und Auszahlung Zinsen auf den noch nicht abgerufenen Betrag anfielen (üblich bei Bauzeit/verzögerter Auszahlung). Steht im Darlehensvertrag unter "bereitstellungsfreie Zeit" und "Bereitstellungszins".
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vertragsdatum</label>
              <input type="date" value={form.contract_date}
                onChange={e => setForm(f => ({ ...f, contract_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bereitstellungsfreie Zeit (Monate)</label>
                <input type="number" value={form.bereitstellungsfreie_monate}
                  onChange={e => setForm(f => ({ ...f, bereitstellungsfreie_monate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bereitstellungszins p.a. (%)</label>
                <input type="number" step="0.01" value={form.bereitstellungszins_rate}
                  onChange={e => setForm(f => ({ ...f, bereitstellungszins_rate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {bereitstellungszinsen !== null && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                Rechnerische Bereitstellungszinsen: <strong>{euro(bereitstellungszinsen)}</strong>
                {bereitstellungszinsen === 0 && ' (Auszahlung lag innerhalb der bereitstellungsfreien Zeit)'}
              </p>
            )}
          </div>

          {suggestedRate !== null && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              Rechnerische anfängliche Tilgungsrate: <strong>{suggestedRate.toFixed(2)}%</strong> p.a.
            </p>
          )}

          {assets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wird finanziert durch Vermögenswert</label>
              <p className="text-xs text-gray-400 mb-1">
                Optional – z.B. bei einer geplanten Anschlussfinanzierung über einen Bausparvertrag. Zeigt auf der Kredit-Detailseite, ob der hochgerechnete Stand des Vermögenswerts bis zum Auszahlungsdatum ausreicht.
              </p>
              <select value={form.funded_by_asset_id}
                onChange={e => setForm(f => ({ ...f, funded_by_asset_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">– keiner –</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name || ASSET_CATEGORY_LABELS[a.category as AssetCategory]}{a.institution ? ` · ${a.institution}` : ''}
                  </option>
                ))}
              </select>
            </div>
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
