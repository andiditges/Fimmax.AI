'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { suggestUsageDuration } from '@/lib/afa'
import { BUNDESLAND_LIST, calcGrunderwerbsteuer, matchBundesland } from '@/lib/grunderwerbsteuer'
import { findGemeindeForAddress, MIETRECHT_STATUS_LABEL } from '@/lib/mietrecht'
import { GRUNDERWERBSTEUER_RATES } from '@/lib/grunderwerbsteuer'
import { Card } from '@/components/ui/card'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { trackEvent } from '@/lib/analytics'
import { euro } from '@/lib/format'
import {
  Bundesland, IncidentalCostCategory, IncidentalCostItem, INCIDENTAL_COST_CATEGORY_LABELS,
  Property, PropertyConditionGrade, PROPERTY_CONDITION_GRADE_LABELS,
  EnergyCertificateType, ENERGY_CERTIFICATE_TYPE_LABELS, ENERGY_EFFICIENCY_CLASSES,
} from '@/lib/types'

const CONDITION_FIELDS: { key: 'condition_windows' | 'condition_electrical' | 'condition_bathroom' | 'condition_heating'; label: string }[] = [
  { key: 'condition_windows', label: 'Fenster' },
  { key: 'condition_electrical', label: 'Elektro' },
  { key: 'condition_bathroom', label: 'Sanitär / Bad' },
  { key: 'condition_heating', label: 'Heizung' },
]

interface ItemRow {
  category: IncidentalCostCategory
  amount: string
  note: string
}

export function PropertyForm({ property, incidentalCostItems }: { property?: Property; incidentalCostItems?: IncidentalCostItem[] }) {
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
    living_area_sqm: property?.living_area_sqm != null ? String(property.living_area_sqm) : '',
    comparable_rent_min: property?.comparable_rent_min != null ? String(property.comparable_rent_min) : '',
    comparable_rent_max: property?.comparable_rent_max != null ? String(property.comparable_rent_max) : '',
    comparable_rent_source: property?.comparable_rent_source ?? '',
    comparable_rent_as_of: property?.comparable_rent_as_of ?? '',
    renovation_note: property?.renovation_note ?? '',
    expected_allocable_operating_cost_annual: property?.expected_allocable_operating_cost_annual != null ? String(property.expected_allocable_operating_cost_annual) : '',
    expected_non_allocable_operating_cost_annual: property?.expected_non_allocable_operating_cost_annual != null ? String(property.expected_non_allocable_operating_cost_annual) : '',
    rooms: property?.rooms != null ? String(property.rooms) : '',
    energy_certificate_type: property?.energy_certificate_type ?? ('' as EnergyCertificateType | ''),
    energy_certificate_value: property?.energy_certificate_value != null ? String(property.energy_certificate_value) : '',
    energy_efficiency_class: property?.energy_efficiency_class ?? '',
    heating_year: property?.heating_year != null ? String(property.heating_year) : '',
  })
  const [conditions, setConditions] = useState<Record<string, PropertyConditionGrade | ''>>({
    condition_windows: property?.condition_windows ?? '',
    condition_electrical: property?.condition_electrical ?? '',
    condition_bathroom: property?.condition_bathroom ?? '',
    condition_heating: property?.condition_heating ?? '',
  })
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null)
  const isWizard = !property
  const STEP_TITLES = ['Adresse & Objekt', 'Kaufpreis & Nebenkosten', 'Abschreibung (AfA)', 'Zustand & Vergleichsmiete']
  const [step, setStep] = useState(1)
  const [incidentalCostsMode, setIncidentalCostsMode] = useState<'eur' | 'percent' | 'items'>(
    incidentalCostItems && incidentalCostItems.length > 0 ? 'items' : 'eur'
  )
  const [incidentalCostsPercent, setIncidentalCostsPercent] = useState('')
  const [itemRows, setItemRows] = useState<ItemRow[]>(
    incidentalCostItems && incidentalCostItems.length > 0
      ? incidentalCostItems.map(i => ({ category: i.category, amount: String(i.amount), note: i.note ?? '' }))
      : [{ category: 'notar', amount: '', note: '' }]
  )

  function itemRowsSum(rows: ItemRow[]) {
    return round2(rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0))
  }

  function updateItemRows(updater: (rows: ItemRow[]) => ItemRow[]) {
    setItemRows(rows => {
      const next = updater(rows)
      setForm(f => ({ ...f, incidental_costs: String(itemRowsSum(next)) }))
      return next
    })
  }

  function addItemRow() {
    updateItemRows(rows => [...rows, { category: 'sonstiges', amount: '', note: '' }])
  }

  function removeItemRow(index: number) {
    updateItemRows(rows => rows.filter((_, i) => i !== index))
  }

  function updateItemRow(index: number, patch: Partial<ItemRow>) {
    updateItemRows(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const gemeindeMatch = useMemo(() => findGemeindeForAddress(form.address), [form.address])

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
      if (incidentalCostsMode === 'percent') {
        const pct = parseFloat(incidentalCostsPercent)
        if (!isNaN(pct)) next.incidental_costs = String(round2(price * pct / 100))
      }
      return next
    })
  }

  function onIncidentalCostsPercentChange(value: string) {
    setIncidentalCostsPercent(value)
    const price = parseFloat(form.purchase_price)
    const pct = parseFloat(value)
    if (!isNaN(price) && !isNaN(pct)) {
      setForm(f => ({ ...f, incidental_costs: String(round2(price * pct / 100)) }))
    }
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

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!form.address.trim()) return 'Bitte eine Adresse eingeben.'
      if (!form.purchase_date) return 'Bitte das Besitzübergangsdatum eingeben.'
    }
    if (n === 2) {
      if (!form.purchase_price || isNaN(parseFloat(form.purchase_price))) return 'Bitte den Kaufpreis eingeben.'
    }
    if (n === 3) {
      if (!form.build_year || isNaN(parseInt(form.build_year))) return 'Bitte das Baujahr eingeben.'
      if (!form.usage_duration || isNaN(parseInt(form.usage_duration))) return 'Bitte die Restnutzungsdauer eingeben.'
      if (!form.land_value || isNaN(parseFloat(form.land_value))) return 'Bitte den Grundstücksanteil eingeben.'
      if (!form.building_value || isNaN(parseFloat(form.building_value))) return 'Bitte den Gebäudeanteil eingeben.'
    }
    return null
  }

  function goNext() {
    const err = validateStep(step)
    if (err) { alert(err); return }
    setStep(s => Math.min(STEP_TITLES.length, s + 1))
  }

  function goBack() {
    setStep(s => Math.max(1, s - 1))
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
      living_area_sqm: form.living_area_sqm ? parseFloat(form.living_area_sqm) : null,
      comparable_rent_min: form.comparable_rent_min ? parseFloat(form.comparable_rent_min) : null,
      comparable_rent_max: form.comparable_rent_max ? parseFloat(form.comparable_rent_max) : null,
      comparable_rent_source: form.comparable_rent_source || null,
      comparable_rent_as_of: form.comparable_rent_as_of || null,
      renovation_note: form.renovation_note || null,
      expected_allocable_operating_cost_annual: form.expected_allocable_operating_cost_annual ? parseFloat(form.expected_allocable_operating_cost_annual) : null,
      expected_non_allocable_operating_cost_annual: form.expected_non_allocable_operating_cost_annual ? parseFloat(form.expected_non_allocable_operating_cost_annual) : null,
      rooms: form.rooms ? parseFloat(form.rooms) : null,
      energy_certificate_type: form.energy_certificate_type || null,
      energy_certificate_value: form.energy_certificate_value ? parseFloat(form.energy_certificate_value) : null,
      energy_efficiency_class: form.energy_efficiency_class || null,
      heating_year: form.heating_year ? parseInt(form.heating_year) : null,
      condition_windows: conditions.condition_windows || null,
      condition_electrical: conditions.condition_electrical || null,
      condition_bathroom: conditions.condition_bathroom || null,
      condition_heating: conditions.condition_heating || null,
    }

    const { data: savedProperty, error } = property
      ? await supabase.from('properties').update(payload).eq('id', property.id).select('id').single()
      : await supabase.from('properties').insert(payload).select('id').single()

    if (error || !savedProperty) {
      alert('Fehler: ' + error?.message)
      setLoading(false)
      return
    }

    const { error: deleteItemsError } = await supabase.from('incidental_cost_items').delete().eq('property_id', savedProperty.id)
    if (deleteItemsError) {
      alert('Fehler beim Speichern der Kaufnebenkosten-Posten: ' + deleteItemsError.message)
      setLoading(false)
      return
    }

    if (incidentalCostsMode === 'items') {
      const itemsPayload = itemRows
        .filter(r => r.amount && !isNaN(parseFloat(r.amount)))
        .map(r => ({
          property_id: savedProperty.id,
          category: r.category,
          amount: parseFloat(r.amount),
          note: r.note || null,
        }))
      if (itemsPayload.length > 0) {
        const { error: insertItemsError } = await supabase.from('incidental_cost_items').insert(itemsPayload)
        if (insertItemsError) {
          alert('Fehler beim Speichern der Kaufnebenkosten-Posten: ' + insertItemsError.message)
          setLoading(false)
          return
        }
      }
    }

    if (property) router.push(`/properties/${property.id}`)
    else { trackEvent('property_created'); setCreatedPropertyId(savedProperty.id) }
  }

  async function onDelete() {
    if (!property || deleteConfirm !== property.address) return
    setLoading(true)
    const { error } = await supabase.from('properties').delete().eq('id', property.id)
    if (!error) router.push('/properties')
    else { alert('Fehler: ' + error.message); setLoading(false) }
  }

  const OPTIONAL_FIELDS: (keyof typeof form)[] = [
    'unit', 'unit_label', 'current_value', 'movable_items', 'incidental_costs',
    'living_area_sqm', 'comparable_rent_min', 'comparable_rent_max', 'comparable_rent_source', 'comparable_rent_as_of', 'renovation_note',
    'expected_allocable_operating_cost_annual', 'expected_non_allocable_operating_cost_annual',
    'rooms', 'energy_certificate_type', 'energy_certificate_value', 'energy_efficiency_class', 'heating_year',
  ]

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
        required={OPTIONAL_FIELDS.indexOf(key) === -1}
      />
    </div>
  )

  if (createdPropertyId) {
    return (
      <div className="max-w-xl">
        <Card className="text-center py-10">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Immobilie angelegt</h1>
          <p className="text-sm text-gray-500 mb-6">
            Möchtest du direkt das passende Darlehen dazu erfassen? Das geht auch später jederzeit über die Objektseite.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push(`/loans/new?property=${createdPropertyId}`)}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Jetzt Darlehen anlegen
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Später – zum Dashboard
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{property ? 'Immobilie bearbeiten' : 'Neue Immobilie'}</h1>
      <Card>
        {isWizard && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>Schritt {step} von {STEP_TITLES.length}</span>
              <span>{STEP_TITLES[step - 1]}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(step / STEP_TITLES.length) * 100}%` }} />
            </div>
          </div>
        )}
        <form
          onSubmit={onSubmit}
          onKeyDown={e => { if (isWizard && step < STEP_TITLES.length && e.key === 'Enter') e.preventDefault() }}
          className="space-y-5"
        >
          {(!isWizard || step === 1) && (<>
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
            {gemeindeMatch && (
              <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                {gemeindeMatch.name} gilt als Gebiet mit angespanntem Wohnungsmarkt: {MIETRECHT_STATUS_LABEL[gemeindeMatch.status]}.
                Relevant für Mieterhöhungen – siehe Kappungsgrenzen-Countdown unter "Mieterhöhung" nach dem Anlegen von Mietern.
              </p>
            )}
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
          </>)}

          {(!isWizard || step === 2) && (<>
          {field('Kaufpreis gesamt (€)', 'purchase_price', 'number', 'Reiner Kaufpreis laut notariellem Kaufvertrag, ohne Nebenkosten')}

          {field('davon entfallend auf Einrichtungsgegenstände (€)', 'movable_items', 'number',
            'Optional – bewegliche Gegenstände wie Einbauküche oder Markise, falls im Kaufvertrag separat ausgewiesen. Mindern die Bemessungsgrundlage für die Grunderwerbsteuer.')}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grunderwerbsteuer (€)</label>
            <p className="text-xs text-gray-400 mb-1">
              Automatisch berechnet aus (Kaufpreis − Einrichtungsgegenstände) × {form.bundesland ? `${GRUNDERWERBSTEUER_RATES[form.bundesland as Bundesland]}%` : 'Satz'} ({form.bundesland || 'Bundesland wählen'}, Stand 2026) – zum Abgleich mit dem Steuerbescheid. Kann bei Bedarf angepasst werden, z.B. bei Befreiungen.
            </p>
            <input
              type="number"
              step="0.01"
              value={form.grunderwerbsteuer}
              onChange={e => setForm(f => ({ ...f, grunderwerbsteuer: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Kaufnebenkosten</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIncidentalCostsMode('eur')}
                  className={`px-2.5 py-1 transition-colors ${incidentalCostsMode === 'eur' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  €
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentalCostsMode('percent')}
                  className={`px-2.5 py-1 border-l border-gray-200 transition-colors ${incidentalCostsMode === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentalCostsMode('items')}
                  className={`px-2.5 py-1 border-l border-gray-200 transition-colors ${incidentalCostsMode === 'items' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  Posten
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-1">
              Notar, Grundbuch/Amtsgericht, Makler, Grundschuldbestellung, Nutzungsdauergutachten u.ä. – ohne Grunderwerbsteuer (die hat ihr eigenes Feld oben) und ohne Renovierung (kommt als Beleg mit is_renovation-Flag). Fließt in die Eigenkapital-Berechnung im Finanz-Cockpit ein.
            </p>
            {incidentalCostsMode === 'eur' ? (
              <input
                type="number"
                step="0.01"
                value={form.incidental_costs}
                onChange={e => setForm(f => ({ ...f, incidental_costs: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : incidentalCostsMode === 'percent' ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    value={incidentalCostsPercent}
                    onChange={e => onIncidentalCostsPercentChange(e.target.value)}
                    placeholder="z.B. 8"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  = {form.incidental_costs && !isNaN(parseFloat(form.incidental_costs)) ? euro(parseFloat(form.incidental_costs)) : '–'}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {itemRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={row.category}
                      onChange={e => updateItemRow(i, { category: e.target.value as IncidentalCostCategory })}
                      className="border border-gray-200 rounded-xl px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                    >
                      {(Object.keys(INCIDENTAL_COST_CATEGORY_LABELS) as IncidentalCostCategory[]).map(c => (
                        <option key={c} value={c}>{INCIDENTAL_COST_CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={row.note}
                      onChange={e => updateItemRow(i, { note: e.target.value })}
                      placeholder="Notiz (optional)"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={e => updateItemRow(i, { amount: e.target.value })}
                      placeholder="€"
                      className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => removeItemRow(i)}
                      disabled={itemRows.length === 1}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed px-1 shrink-0"
                      aria-label="Posten entfernen"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={addItemRow} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    + Posten hinzufügen
                  </button>
                  <span className="text-sm text-gray-500">
                    Summe: <strong className="text-gray-900">{euro(itemRowsSum(itemRows))}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {field('Aktueller Marktwert (€)', 'current_value', 'number',
            'Optional – dein geschätzter aktueller Marktwert, z.B. laut Gutachten oder Vergleichswerten. Fließt ins Finanz-Cockpit (Immobilienwert, Eigenkapital) ein. Leer lassen, um stattdessen den Kaufpreis zu verwenden.')}

          <div className="grid grid-cols-2 gap-4">
            {field('Erwartete umlagefähige Betriebskosten/Jahr (€)', 'expected_allocable_operating_cost_annual', 'number',
              'Optional – grobe Schätzung, solange noch keine echte Jahresabrechnung im Nebenkostenassistenten erfasst ist. Umlagefähige Kosten sind i.d.R. cash-neutral (über die Nebenkostenvorauszahlung gedeckt) und fließen deshalb nicht ins Cashflow-Cockpit ein.')}
            {field('Erwartete nicht-umlagefähige Betriebskosten/Jahr (€)', 'expected_non_allocable_operating_cost_annual', 'number',
              'Optional – z.B. Verwaltung, Instandhaltung, Rücklage. Ersetzt, sobald gesetzt, die grobe Hochrechnung aus hochgeladenen Belegen im Finanz-Cockpit.')}
          </div>
          </>)}

          {(!isWizard || step === 3) && (<>
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
          </>)}

          {(!isWizard || step === 4) && (<>
          <div className={isWizard ? 'space-y-5' : 'border-t border-gray-100 pt-5 space-y-5'}>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Zustand & Vergleichsmiete</h2>
              <p className="text-xs text-gray-400">
                Alles optional. Hilft dir, deine Miete selbst gegen die ortsübliche Vergleichsmiete einzuordnen –
                die App berechnet hier bewusst nichts automatisch (kein bundesweiter Mietspiegel verfügbar).
              </p>
            </div>

            {field('Wohnfläche (m²)', 'living_area_sqm', 'number', 'Für die €/m²-Einordnung unten')}

            {field('Zimmeranzahl', 'rooms', 'number', 'Optional – z.B. 3.5. Für Exposé/Verkaufsunterlagen')}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Energieausweis</label>
              <p className="text-xs text-gray-400 mb-1">Optional – Pflichtangabe bei Verkauf/Vermietung (§ 87 GEG), für das Objekt-Exposé</p>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.energy_certificate_type}
                  onChange={e => setForm(f => ({ ...f, energy_certificate_type: e.target.value as EnergyCertificateType | '' }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Typ – bitte wählen...</option>
                  {(Object.keys(ENERGY_CERTIFICATE_TYPE_LABELS) as EnergyCertificateType[]).map(t => (
                    <option key={t} value={t}>{ENERGY_CERTIFICATE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <select
                  value={form.energy_efficiency_class}
                  onChange={e => setForm(f => ({ ...f, energy_efficiency_class: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Effizienzklasse – bitte wählen...</option>
                  {ENERGY_EFFICIENCY_CLASSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {field('Energiekennwert (kWh/(m²·a))', 'energy_certificate_value', 'number')}
                {field('Baujahr Heizung', 'heating_year', 'number')}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zustand je Gewerk</label>
              <div className="grid grid-cols-2 gap-3">
                {CONDITION_FIELDS.map(c => (
                  <div key={c.key}>
                    <label className="block text-xs text-gray-500 mb-1">{c.label}</label>
                    <select
                      value={conditions[c.key]}
                      onChange={e => setConditions(v => ({ ...v, [c.key]: e.target.value as PropertyConditionGrade | '' }))}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">–</option>
                      {(Object.keys(PROPERTY_CONDITION_GRADE_LABELS) as PropertyConditionGrade[]).map(g => (
                        <option key={g} value={g}>{PROPERTY_CONDITION_GRADE_LABELS[g]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {field('Sanierungsnotiz', 'renovation_note', 'text', 'Optional – z.B. "Bad 2023 komplett neu", "Fenster noch original von 1985"')}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ortsübliche Vergleichsmiete (€/m², netto kalt)</label>
              <p className="text-xs text-gray-400 mb-1">
                Selbst recherchiert, z.B. aus dem Mietspiegel deiner Gemeinde (falls vorhanden) oder Vergleichsobjekten. Ohne Gewähr, ersetzt keine Rechtsberatung.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {field('von', 'comparable_rent_min', 'number')}
                {field('bis', 'comparable_rent_max', 'number')}
              </div>
            </div>

            {field('Quelle', 'comparable_rent_source', 'text', 'z.B. "Mietspiegel Mönchengladbach 2025" oder "3 Vergleichsobjekte ImmoScout"')}
            {field('Stand', 'comparable_rent_as_of', 'date')}
          </div>
          </>)}

          {isWizard ? (
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="px-5 py-3 rounded-xl font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Zurück
                </button>
              )}
              {step < STEP_TITLES.length ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  Weiter
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Wird gespeichert...' : 'Immobilie anlegen'}
                </button>
              )}
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Wird gespeichert...' : 'Änderungen speichern'}
            </button>
          )}
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
