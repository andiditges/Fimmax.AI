'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { Tenant } from '@/lib/types'

export function TenantForm({ tenant }: { tenant?: Tenant }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null }[]>([])
  const [form, setForm] = useState({
    property_id: tenant?.property_id ?? searchParams.get('property') ?? '',
    name: tenant?.name ?? '',
    move_in_date: tenant?.move_in_date ?? '',
    move_out_date: tenant?.move_out_date ?? '',
    rent_amount: '',
    first_month_amount: '',
  })

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label').then(({ data }) => {
      setProperties(data ?? [])
    })
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id) return alert('Bitte eine Immobilie auswählen')
    setLoading(true)

    if (tenant) {
      const { error } = await supabase.from('tenants').update({
        name: form.name,
        move_in_date: form.move_in_date,
        move_out_date: form.move_out_date || null,
      }).eq('id', tenant.id)
      if (!error) router.push(`/tenants/${tenant.id}`)
      else { alert('Fehler: ' + error.message); setLoading(false) }
      return
    }

    const rentAmount = parseFloat(form.rent_amount)
    const { data: newTenant, error } = await supabase.from('tenants').insert({
      property_id: form.property_id,
      name: form.name,
      move_in_date: form.move_in_date,
      move_out_date: form.move_out_date || null,
      rent_base: rentAmount,
      advance_payment: 0,
    }).select().single()

    if (error || !newTenant) {
      alert('Fehler: ' + error?.message)
      setLoading(false)
      return
    }

    const { error: agreementError } = await supabase.from('rental_agreements').insert({
      property_id: form.property_id,
      tenant_id: newTenant.id,
      rent_amount: rentAmount,
      start_date: form.move_in_date,
    })
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

    router.push(`/properties/${form.property_id}`)
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

          {!tenant && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Miete (€) ab Einzugsdatum *</label>
                <p className="text-xs text-gray-400 mb-1">Gilt automatisch fortlaufend jeden Monat, bis du eine Mieterhöhung oder Abweichung erfasst</p>
                <input type="number" step="0.01" value={form.rent_amount} onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Miete im ersten Monat, falls abweichend (€)</label>
                <p className="text-xs text-gray-400 mb-1">Nur ausfüllen, wenn der erste Monat nicht der volle Betrag oben ist – z.B. bei Einzug zur Monatsmitte</p>
                <input type="number" step="0.01" value={form.first_month_amount} onChange={e => setForm(f => ({ ...f, first_month_amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
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
