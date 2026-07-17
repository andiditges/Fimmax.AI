'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { suggestUsageDuration } from '@/lib/afa'
import { Card } from '@/components/ui/card'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { Property } from '@/lib/types'

export function PropertyForm({ property }: { property?: Property }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    address: property?.address ?? '',
    unit: property?.unit ?? '',
    unit_label: property?.unit_label ?? '',
    purchase_date: property?.purchase_date ?? '',
    purchase_price: property ? String(property.purchase_price) : '',
    land_value: property ? String(property.land_value) : '',
    building_value: property ? String(property.building_value) : '',
    build_year: property ? String(property.build_year) : '',
    usage_duration: property ? String(property.usage_duration) : '',
    is_self_managed: property?.is_self_managed ?? true,
  })

  function onBuildYearBlur() {
    const year = parseInt(form.build_year)
    if (!isNaN(year) && form.usage_duration === '') {
      setForm(f => ({ ...f, usage_duration: String(suggestUsageDuration(year)) }))
    }
  }

  // Kaufnebenkosten (Notar, Grundbuch, Grunderwerbsteuer, Makler) kommen bewusst
  // noch nicht hier ins Formular – die werden später automatisch aus hochgeladenen
  // Belegen ermittelt und der Immobilie zugeordnet. Bis dahin bleibt die
  // incidental_costs-Spalte in der DB auf ihrem Default (0).
  function onPriceBlur() {
    const price = parseFloat(form.purchase_price)
    const land = parseFloat(form.land_value)
    if (!isNaN(price) && !isNaN(land) && form.building_value === '') {
      setForm(f => ({ ...f, building_value: String(price - land) }))
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      address: form.address,
      unit: form.unit || null,
      unit_label: form.unit_label || null,
      purchase_date: form.purchase_date,
      purchase_price: parseFloat(form.purchase_price),
      land_value: parseFloat(form.land_value),
      building_value: parseFloat(form.building_value),
      build_year: parseInt(form.build_year),
      afa_rate: 100 / parseInt(form.usage_duration),
      usage_duration: parseInt(form.usage_duration),
      is_self_managed: form.is_self_managed,
    }

    const { error } = property
      ? await supabase.from('properties').update(payload).eq('id', property.id)
      : await supabase.from('properties').insert(payload)

    if (!error) router.push(property ? `/properties/${property.id}` : '/')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input
        type={type}
        value={String(form[key])}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))}
        onBlur={key === 'build_year' ? onBuildYearBlur : key === 'purchase_price' || key === 'land_value' ? onPriceBlur : undefined}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        required={key !== 'unit' && key !== 'unit_label'}
      />
    </div>
  )

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{property ? 'Immobilie bearbeiten' : 'Neue Immobilie'}</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <AddressAutocomplete
              value={form.address}
              onChange={address => setForm(f => ({ ...f, address }))}
            />
          </div>

          {field('WE / Einheit', 'unit', 'text', 'Optional – offizielle Bezeichnung laut Teilungserklärung/WEG, z.B. "WE 3", falls du mehrere Einheiten unter derselben Adresse hast')}

          {field('Wohnungsbezeichnung', 'unit_label', 'text', 'Optional – deine eigene, alltägliche Bezeichnung, z.B. "Wohnung 1" (kann von der offiziellen WE-Nummer abweichen). Wird überall dort angezeigt, wo die Immobilie aufgelistet wird.')}

          {field('Besitzübergang (Lasten-Nutzen-Wechsel)', 'purchase_date', 'date',
            'Steht im Kaufvertrag, meist unter "Besitzübergang" oder "Übergabe" – NICHT der Notartermin, oft aber nahe am Tag der vollständigen Kaufpreiszahlung. Dieser Tag zählt für AfA und die 15%-Grenze.')}
          {field('Kaufpreis gesamt (€)', 'purchase_price', 'number', 'Reiner Kaufpreis laut notariellem Kaufvertrag, ohne Nebenkosten')}

          {field('davon Gebäudeanteil – AfA-Basis (€)', 'building_value', 'number',
            'Automatisch berechnet: Kaufpreis minus Grundstücksanteil. Kaufnebenkosten kommen später automatisch über hochgeladene Belege dazu. Kann bei Bedarf überschrieben werden.')}

          {field('davon Grundstücksanteil am Kaufpreis (€)', 'land_value', 'number',
            'Anteil am reinen Kaufpreis (ohne Nebenkosten) laut Kaufvertrag, Bodenrichtwert oder BMF-Tool')}

          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 -mt-2">
            Unsicher bei der Aufteilung? Das Bundesfinanzministerium stellt eine offizielle
            Arbeitshilfe zur Kaufpreisaufteilung bereit:{' '}
            <a
              href="https://www.bundesfinanzministerium.de/Datenportal/Daten/frei-nutzbare-produkte/Anwendungen/Kaufpreisaufteilung-Grundstuecke/Kaufpreisaufteilung-Grundstuecke.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Kaufpreisaufteilung-Tool (BMF)
            </a>
          </p>

          {field('Baujahr', 'build_year', 'number')}

          {field('Restnutzungsdauer (Jahre)', 'usage_duration', 'number',
            'Wird aus dem Baujahr vorgeschlagen (gesetzlicher Standardwert), kann aber frei geändert werden – z.B. laut Restnutzungsdauergutachten (typisch 10-50 Jahre, § 7 Abs. 4 Satz 2 EStG). Der AfA-Satz ergibt sich automatisch als 100 / Restnutzungsdauer.')}

          {!isNaN(parseInt(form.usage_duration)) && parseInt(form.usage_duration) > 0 && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2 -mt-2">
              Daraus ergibt sich ein AfA-Satz von <strong>{(100 / parseInt(form.usage_duration)).toFixed(2)}%</strong> p.a.
            </p>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="self_managed"
              checked={form.is_self_managed}
              onChange={e => setForm(f => ({ ...f, is_self_managed: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="self_managed" className="text-sm text-gray-700">Selbst verwaltet (keine Hausverwaltung)</label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Wird gespeichert...' : property ? 'Änderungen speichern' : 'Immobilie anlegen'}
          </button>
        </form>
      </Card>
    </div>
  )
}
