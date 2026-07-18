'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { calcIndexmieteStatus } from '@/lib/vpi'
import { Property, RentalAgreement, Tenant, VpiReading } from '@/lib/types'

interface Item {
  tenant: Tenant
  property: Property
  agreement: RentalAgreement
}

export function IndexmieteOverview({ items, latestReading }: { items: Item[]; latestReading: VpiReading | null }) {
  if (items.length === 0) {
    return (
      <Card className="text-center py-8 text-gray-400">
        Noch keine Mietverhältnisse mit Indexmiete hinterlegt. Beim Anlegen eines Mieters oder bei "+ Neue Miethöhe erfassen" die Mietart "Indexmiete" wählen.
      </Card>
    )
  }

  if (!latestReading) {
    return (
      <Card className="text-center py-8 text-gray-400">
        {items.length} Mietverhältnis{items.length !== 1 ? 'se' : ''} mit Indexmiete hinterlegt, aber noch kein aktueller VPI-Indexstand oben erfasst.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <IndexmieteRow key={item.tenant.id} item={item} latestReading={latestReading} />
      ))}
    </div>
  )
}

function IndexmieteRow({ item, latestReading }: { item: Item; latestReading: VpiReading }) {
  const router = useRouter()
  const supabase = createClient()
  const [applying, setApplying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))

  const status = calcIndexmieteStatus(item.agreement, latestReading)
  if (!status) return null

  async function onApply(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('rental_agreements').insert({
      property_id: item.property.id,
      tenant_id: item.tenant.id,
      rent_amount: status!.possible_new_rent,
      start_date: effectiveDate,
      is_index_rent: true,
      index_base_value: latestReading.value,
      index_base_date: effectiveDate,
    })
    if (!error) {
      router.refresh()
    } else {
      alert('Fehler: ' + error.message)
    }
    setSaving(false)
    setApplying(false)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/tenants/${item.tenant.id}`} className="font-semibold text-gray-900 hover:text-blue-700">{item.tenant.name}</Link>
          <p className="text-xs text-gray-400">{propertyLabel(item.property)}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${status.eligible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {status.eligible ? 'Erhöhung möglich' : `Erst ab ${formatDate(status.earliest_next_date)}`}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Aktuelle Miete</p>
          <p className="font-medium text-gray-900">{euro(status.current_rent)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Basis-Index ({formatDate(status.base_date)})</p>
          <p className="font-medium text-gray-900">{status.base_value.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Aktueller Index ({formatDate(status.latest_month)})</p>
          <p className="font-medium text-gray-900">{status.latest_value.toFixed(3)} ({status.percent_change >= 0 ? '+' : ''}{status.percent_change.toFixed(2)}%)</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Rechnerisch möglich</p>
          <p className="font-medium text-blue-700">{euro(status.possible_new_rent)}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Rein rechnerisch, ersetzt keine Rechtsberatung – die Erhöhung muss dem Mieter aktiv in Textform erklärt werden.
      </p>

      {status.eligible && !applying && (
        <button onClick={() => setApplying(true)} className="text-sm text-blue-600 hover:underline mt-2">
          + Erhöhung erfassen
        </button>
      )}

      {applying && (
        <form onSubmit={onApply} className="mt-3 bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Gilt ab</label>
            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <p className="text-sm text-gray-600">Neue Miete: <strong>{euro(status.possible_new_rent)}</strong> (Basis-Index wird auf {status.latest_value.toFixed(3)} zurückgesetzt)</p>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Speichert...' : 'Bestätigen'}
            </button>
            <button type="button" onClick={() => setApplying(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
