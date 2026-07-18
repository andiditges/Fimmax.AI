'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { generateStaffelSchedule } from '@/lib/rent-schedule'
import { lookupVpiForMonth } from '@/lib/vpi-history'
import { Tenant } from '@/lib/types'

const UNIT_TYPES = ['Wohnung', 'Garage/Stellplatz', 'Sonstiges'] as const
type RentType = 'fest' | 'staffel' | 'index'

export function TenantForm({ tenant }: { tenant?: Tenant }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null }[]>([])
  const [form, setForm] = useState({
    property_id: tenant?.property_id ?? searchParams.get('property') ?? '',
    name: tenant?.name ?? '',
    unit: tenant?.unit ?? 'Wohnung',
    move_in_date: tenant?.move_in_date ?? '',
    move_out_date: tenant?.move_out_date ?? '',
    rent_amount: '',
    has_furnishing_surcharge: tenant?.furnishing_surcharge != null,
    furnishing_surcharge: tenant?.furnishing_surcharge != null ? String(tenant.furnishing_surcharge) : '',
    first_month_amount: '',
    rent_type: 'fest' as RentType,
    staffel_percent: '',
    staffel_years: '',
    index_base_value: '',
  })

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label').then(({ data }) => {
      setProperties(data ?? [])
    })
  })

  // Sobald "Indexmiete" gewählt ist und ein Einzugsdatum feststeht, den
  // VPI-Basiswert automatisch aus der eingebauten Tabelle vorschlagen -
  // überschreibt aber keine bereits manuell eingetragene Zahl.
  useEffect(() => {
    if (form.rent_type !== 'index' || !form.move_in_date || form.index_base_value) return
    const looked_up = lookupVpiForMonth(form.move_in_date)
    if (looked_up !== null) setForm(f => ({ ...f, index_base_value: String(looked_up) }))
  }, [form.rent_type, form.move_in_date, form.index_base_value])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id) return alert('Bitte eine Immobilie auswählen')
    setLoading(true)

    if (tenant) {
      const { error } = await supabase.from('tenants').update({
        name: form.name,
        unit: form.unit || null,
        move_in_date: form.move_in_date,
        move_out_date: form.move_out_date || null,
        furnishing_surcharge: form.has_furnishing_surcharge ? (parseFloat(form.furnishing_surcharge) || null) : null,
      }).eq('id', tenant.id)
      if (!error) router.push(`/tenants/${tenant.id}`)
      else { alert('Fehler: ' + error.message); setLoading(false) }
      return
    }

    const rentAmount = parseFloat(form.rent_amount)
    const { data: newTenant, error } = await supabase.from('tenants').insert({
      property_id: form.property_id,
      name: form.name,
      unit: form.unit || null,
      move_in_date: form.move_in_date,
      move_out_date: form.move_out_date || null,
      rent_base: rentAmount,
      advance_payment: 0,
      furnishing_surcharge: form.has_furnishing_surcharge ? (parseFloat(form.furnishing_surcharge) || null) : null,
    }).select().single()

    if (error || !newTenant) {
      alert('Fehler: ' + error?.message)
      setLoading(false)
      return
    }

    let agreementRows: Record<string, unknown>[]
    if (form.rent_type === 'staffel') {
      const steps = generateStaffelSchedule(
        rentAmount,
        parseFloat(form.staffel_percent) || 0,
        parseInt(form.staffel_years) || 1,
        form.move_in_date
      )
      agreementRows = steps.map(s => ({
        property_id: form.property_id,
        tenant_id: newTenant.id,
        rent_amount: s.rent_amount,
        start_date: s.start_date,
      }))
    } else if (form.rent_type === 'index') {
      agreementRows = [{
        property_id: form.property_id,
        tenant_id: newTenant.id,
        rent_amount: rentAmount,
        start_date: form.move_in_date,
        is_index_rent: true,
        index_base_value: parseFloat(form.index_base_value) || null,
        index_base_date: form.move_in_date,
      }]
    } else {
      agreementRows = [{
        property_id: form.property_id,
        tenant_id: newTenant.id,
        rent_amount: rentAmount,
        start_date: form.move_in_date,
      }]
    }

    const { error: agreementError } = await supabase.from('rental_agreements').insert(agreementRows)
    if (agreementError) {
      alert('Fehler: ' + agreementError.message)
      setLoading(false)
      return
    }

    if (form.first_month_amount) {
      const monthStart = form.move_in_date.slice(0, 7) + '-01'
      const { error: adjustmentError } = await supabase.from('rent_adjustments').insert({
        tenant_id: newTenant.id,
        month: monthStart,
        override_amount: parseFloat(form.first_month_amount),
        note: 'Abweichender erster Monat',
      })
      if (adjustmentError) {
        alert('Fehler: ' + adjustmentError.message)
        setLoading(false)
        return
      }
    }

    // Zur eigenen Mieterseite statt zurück zum Objekt, damit die
    // Miethistorie (spätere Mieterhöhungen etc.) direkt sichtbar/erreichbar ist.
    router.push(`/tenants/${newTenant.id}`)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{tenant ? 'Mieter bearbeiten' : 'Neuer Mieter'}</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Immobilie *</label>
            <select
              value={form.property_id}
              onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!tenant}
            >
              <option value="">Bitte wählen...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Was wird vermietet?</label>
            <p className="text-xs text-gray-400 mb-1">Falls z.B. eine Garage separat von der Wohnung vermietet wird (auch an einen anderen Mieter)</p>
            <select
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einzugsdatum *</label>
              <input type="date" value={form.move_in_date} onChange={e => setForm(f => ({ ...f, move_in_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auszugsdatum</label>
              <input type="date" value={form.move_out_date} onChange={e => setForm(f => ({ ...f, move_out_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {tenant && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <input type="checkbox" checked={form.has_furnishing_surcharge}
                  onChange={e => setForm(f => ({ ...f, has_furnishing_surcharge: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                Enthält Zuschlag für Küche, Stellplatz, Möbel o.ä.
              </label>
              {form.has_furnishing_surcharge && (
                <>
                  <p className="text-xs text-gray-400 mb-1">Anteil der Kaltmiete, der nicht auf die reine Wohnraummiete entfällt</p>
                  <input type="number" step="0.01" value={form.furnishing_surcharge} onChange={e => setForm(f => ({ ...f, furnishing_surcharge: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </>
              )}
            </div>
          )}

          {!tenant && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Miete (€) ab Einzugsdatum *</label>
                <p className="text-xs text-gray-400 mb-1">Gilt automatisch fortlaufend jeden Monat, bis du eine Mieterhöhung oder Abweichung erfasst</p>
                <input type="number" step="0.01" value={form.rent_amount} onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <input type="checkbox" checked={form.has_furnishing_surcharge}
                    onChange={e => setForm(f => ({ ...f, has_furnishing_surcharge: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  Enthält Zuschlag für Küche, Stellplatz, Möbel o.ä.
                </label>
                {form.has_furnishing_surcharge && (
                  <>
                    <p className="text-xs text-gray-400 mb-1">Anteil der Kaltmiete oben, der nicht auf die reine Wohnraummiete entfällt</p>
                    <input type="number" step="0.01" value={form.furnishing_surcharge} onChange={e => setForm(f => ({ ...f, furnishing_surcharge: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Miete im ersten Monat, falls abweichend (€)</label>
                <p className="text-xs text-gray-400 mb-1">Nur ausfüllen, wenn der erste Monat nicht der volle Betrag oben ist – z.B. bei Einzug zur Monatsmitte</p>
                <input type="number" step="0.01" value={form.first_month_amount} onChange={e => setForm(f => ({ ...f, first_month_amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mietart</label>
                <select
                  value={form.rent_type}
                  onChange={e => setForm(f => ({ ...f, rent_type: e.target.value as RentType }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fest">Feste Miete</option>
                  <option value="staffel">Staffelmiete</option>
                  <option value="index">Indexmiete</option>
                </select>
              </div>

              {form.rent_type === 'staffel' && (
                <div className="grid grid-cols-2 gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Jährliche Erhöhung (%) *</label>
                    <input type="number" step="0.01" value={form.staffel_percent} onChange={e => setForm(f => ({ ...f, staffel_percent: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Anzahl Jahre der Staffel *</label>
                    <input type="number" value={form.staffel_years} onChange={e => setForm(f => ({ ...f, staffel_years: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <p className="col-span-2 text-xs text-gray-500">
                    Legt automatisch alle Staffelstufen ab Einzugsdatum an (Miete oben = Jahr 1), jeweils +{form.staffel_percent || 'X'}% gegenüber dem Vorjahr.
                  </p>
                </div>
              )}

              {form.rent_type === 'index' && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Basis-Indexstand (VPI, optional)</label>
                  <p className="text-xs text-gray-400 mb-2">
                    Der Verbraucherpreisindex (VPI) ist die amtliche Inflationszahl des Statistischen Bundesamts (Basis: Jahr 2020 = 100 Punkte).
                    Bei einer Indexmiete ist die Miete an diesen Wert gekoppelt – damit die App später berechnen kann, wie stark du erhöhen darfst,
                    braucht sie den Indexstand zum Vertragsbeginn. Wird zum Einzugsdatum automatisch aus einer eingebauten Tabelle vorgeschlagen
                    (bei Bedarf mit dem tatsächlichen Wert aus eurem Mietvertrag überschreiben). Kein Vorschlag möglich? Dann leer lassen –
                    kannst du später auf /indexmiete nachtragen.
                  </p>
                  <input type="number" step="0.001" value={form.index_base_value} onChange={e => setForm(f => ({ ...f, index_base_value: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? 'Wird gespeichert...' : tenant ? 'Änderungen speichern' : 'Mieter anlegen'}
          </button>
        </form>
      </Card>
    </div>
  )
}
