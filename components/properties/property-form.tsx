'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { suggestUsageDuration } from '@/lib/afa'
import { BUNDESLAND_LIST, calcGrunderwerbsteuer, matchBundesland } from '@/lib/grunderwerbsteuer'
import { Card } from '@/components/ui/card'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { Bundesland, Property } from '@/lib/types'

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
    bundesland: property?.bundesland ?? ('' as Bundesland | ''),
    movable_items: property?.movable_items_value != null ? String(property.movable_items_value) : '',
    grunderwerbsteuer: property?.grunderwerbsteuer != null ? String(property.grunderwerbsteuer) : '',
    current_value: property?.current_value != null ? String(property.current_value) : '',
    incidental_costs: property ? String(property.incidental_costs) : '0',
    land_value: property ? String(property.land_value) : '',
    building_value: property ? String(property.building_value) : '',
    build_year: property ? String(property.build_year) : '',
    usage_duration: property ? String(property.usage_duration) : '',
    is_self_managed: property?.is_self_managed ?? true,
  })
  const [deleteConfirm, setDeleteConfirm] = useState('')

  function onBuildYearBlur() {
    const year = parseInt(form.build_year)
    if (!isNaN(year) && form.usage_duration === '') {
      setForm(f => ({ ...f, usage_duration: String(suggestUsageDuration(year)) }))
    }
  }

  // Grundstücks- und Gebäudeanteil ergänzen sich immer zum Kaufpreis: welches
  // der beiden Felder zuletzt verlassen wird, füllt das jeweils andere mit der
  // Differenz – unabhängig davon, ob dort schon ein Wert stand.
  function round2(n: number) {
    return Math.round(n * 100) / 100
  }

  function onLandBlur() {
    const price = parseFloat(form.purchase_price)
    const land = parseFloat(form.land_value)
    if (!isNaN(price) && !isNaN(land)) {
      setForm(f => ({ ...f, building_value: String(round2(price - land)) }))
    }
  }

  function onBuildingBlur() {
    const price = parseFloat(form.purchase_price)
    const building = parseFloat(form.building_value)
    if (!isNaN(price) && !isNaN(building)) {
      setForm(f => ({ ...f, land_value: String(round2(price - building)) }))
    }
  }

  // Bewegliche Gegenstände (Einbauküche, Markise etc.) mindern laut
  // Kaufvertrag oft die Bemessungsgrundlage für die Grunderwerbsteuer.
  function grunderwerbsteuerBase(price: number, movable: number) {
    return Math.max(0, price - (isNaN(movable) ? 0 : movable))
  }

  function onPriceBlur() {
    const price = parseFloat(form.purchase_price)
    const land = parseFloat(form.land_value)
    const building = parseFloat(form.building_value)
    const movable = parseFloat(form.movable_items)
    if (isNaN(price)) return

    setForm(f => {
      const next = { ...f }
      if (!isNaN(land)) next.building_value = String(round2(price - land))
      else if (!isNaN(building)) next.land_value = String(round2(price - building))
      if (f.bundesland) next.grunderwerbsteuer = String(calcGrunderwerbsteuer(grunderwerbsteuerBase(price, movable), f.bundesland))
      return next
    })
  }

  function onMovableBlur() {
    const price = parseFloat(form.purchase_price)
    const movable = parseFloat(form.movable_items)
    if (isNaN(price) || !form.bundesland) return
    setForm(f => ({
      ...f,
      grunderwerbsteuer: String(calcGrunderwerbsteuer(grunderwerbsteuerBase(price, movable), f.bundesland as Bundesland)),
    }))
  }

  // Grunderwerbsteuer füllt sich automatisch aus (Kaufpreis - bewegliche
  // Gegenstände) x Satz des gewählten Bundeslands – bleibt danach aber ein
  // normales, überschreibbares Feld (z.B. bei Befreiungen oder Sonderfällen).
  function onBundeslandChange(bundesland: Bundesland | '') {
    setForm(f => {
      const price = parseFloat(f.purchase_price)
      const movable = parseFloat(f.movable_items)
      const grunderwerbsteuer = bundesland && !isNaN(price)
        ? String(calcGrunderwerbsteuer(grunderwerbsteuerBase(price, movable), bundesland))
        : f.grunderwerbsteuer
      return { ...f, bundesland, grunderwerbsteuer }
    })
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
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      land_value: parseFloat(form.land_value),
      building_value: parseFloat(form.building_value),
      build_year: parseInt(form.build_year),
      afa_rate: 100 / parseInt(form.usage_duration),
      usage_duration: parseInt(form.usage_duration),
      is_self_managed: form.is_self_managed,
      bundesland: form.bundesland || null,
      movable_items_value: form.movable_items ? parseFloat(form.movable_items) : null,
      grunderwerbsteuer: form.grunderwerbsteuer ? parseFloat(form.grunderwerbsteuer) : null,
      incidental_costs: form.incidental_costs ? parseFloat(form.incidental_costs) : 0,
    }

    const { error } = property
      ? await supabase.from('properties').update(payload).eq('id', property.id)
      : await supabase.from('properties').insert(payload)

    if (!error) router.push(property ? `/properties/${property.id}` : '/')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  async function onDelete() {
    if (!property || deleteConfirm !== property.address) return
    setLoading(true)
    const { error } = await supabase.from('properties').delete().eq('id', property.id)
    if (!error) router.push('/properties')
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
        onBlur={
          key === 'build_year' ? onBuildYearBlur
            : key === 'purchase_price' ? onPriceBlur
            : key === 'land_value' ? onLandBlur
            : key === 'building_value' ? onBuildingBlur
            : key === 'movable_items' ? onMovableBlur
            : undefined
        }
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        required={key !== 'unit' && key !== 'unit_label' && key !== 'current_value' && key !== 'movable_items' && key !== 'incidental_costs'}
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
              onStateDetected={state => {
                const matched = matchBundesland(state)
                if (matched) onBundeslandChange(matched)
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bundesland (Kauf)</label>
            <p className="text-xs text-gray-400 mb-1">Wird beim Auswählen eines Adressvorschlags automatisch erkannt, kann aber jederzeit korrigiert werden.</p>
            <select
              value={form.bundesland}
              onChange={e => onBundeslandChange(e.target.value as Bundesland | '')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Bitte wählen...</option>
              {BUNDESLAND_LIST.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {field('WE / Einheit', 'unit', 'text', 'Optional – offizielle Bezeichnung laut Teilungserklärung/WEG, z.B. "WE 3", falls du mehrere Einheiten unter derselben Adresse hast')}

          {field('Wohnungsbezeichnung', 'unit_label', 'text', 'Optional – deine eigene, alltägliche Bezeichnung, z.B. "Wohnung 1" (kann von der offiziellen WE-Nummer abweichen). Wird überall dort angezeigt, wo die Immobilie aufgelistet wird.')}

          {field('Besitzübergang (Lasten-Nutzen-Wechsel)', 'purchase_date', 'date',
            'Steht im Kaufvertrag, meist unter "Besitzübergang" oder "Übergabe" – NICHT der Notartermin, oft aber nahe am Tag der vollständigen Kaufpreiszahlung. Dieser Tag zählt für AfA und die 15%-Grenze.')}
          {field('Kaufpreis gesamt (€)', 'purchase_price', 'number', 'Reiner Kaufpreis laut notariellem Kaufvertrag, ohne Nebenkosten')}

          {field('davon entfallend auf Einrichtungsgegenstände (€)', 'movable_items', 'number',
            'Optional – bewegliche Gegenstände wie Einbauküche oder Markise, falls im Kaufvertrag separat ausgewiesen. Mindern die Bemessungsgrundlage für die Grunderwerbsteuer.')}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grunderwerbsteuer (€)</label>
            <p className="text-xs text-gray-400 mb-1">
              Automatisch berechnet aus (Kaufpreis − Einrichtungsgegenstände) × Satz des gewählten Bundeslands (Stand 2026). Kann bei Bedarf angepasst werden, z.B. bei Befreiungen.
            </p>
            <input
              type="number"
              step="0.01"
              value={form.grunderwerbsteuer}
              onChange={e => setForm(f => ({ ...f, grunderwerbsteuer: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {field('Kaufnebenkosten (€)', 'incidental_costs', 'number',
            'Notar, Grundbuch/Amtsgericht, Makler, Grundschuldbestellung, Nutzungsdauergutachten u.ä. – ohne Grunderwerbsteuer (die hat ihr eigenes Feld oben) und ohne Renovierung (kommt als Beleg mit is_renovation-Flag). Fließt in die Eigenkapital-Berechnung im Finanz-Cockpit ein.')}

          {field('Aktueller Wert (€)', 'current_value', 'number',
            'Optional – dein geschätzter aktueller Marktwert, z.B. laut Gutachten oder Vergleichswerten. Fließt ins Finanz-Cockpit (Immobilienwert, Eigenkapital) ein. Leer lassen, um stattdessen den Kaufpreis zu verwenden.')}

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

      {property && (
        <Card className="mt-6 border-red-200 bg-red-50">
          <h2 className="text-sm font-semibold text-red-700 mb-1">Immobilie löschen</h2>
          <p className="text-xs text-red-700/80 mb-3">
            Löscht diese Immobilie unwiderruflich - inklusive aller Mieter, Mietverträge, Belege, Kredite,
            Sondertilgungen, Erinnerungen, Rücklagen und Nebenkosten dazu. Das kann nicht rückgängig gemacht werden.
          </p>
          <label className="block text-xs font-medium text-red-700 mb-1">
            Gib zur Bestätigung die Adresse ein: <strong>{property.address}</strong>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="flex-1 border border-red-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              type="button"
              onClick={onDelete}
              disabled={loading || deleteConfirm !== property.address}
              className="bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Endgültig löschen
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
