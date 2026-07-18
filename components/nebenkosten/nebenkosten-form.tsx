'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildStoragePath } from '@/lib/storage-path'
import { Card, CardTitle } from '@/components/ui/card'
import { euro } from '@/lib/format'
import { OPERATING_COST_CATEGORIES, OperatingCostCategoryConfig } from '@/lib/operating-costs'
import { OperatingCost, OperatingCostCategory, Property, Tenant, UtilitySettlement } from '@/lib/types'

type Row = { amount: string; allocable: boolean; tenant_id: string }

export function NebenkostenForm({
  property, year, existingCosts, settlement, advancePaymentsForYear, tenants,
}: {
  property: Property
  year: number
  existingCosts: OperatingCost[]
  settlement: UtilitySettlement | null
  advancePaymentsForYear: number
  tenants: Tenant[]
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(settlement?.source_file_url ?? null)

  const [rows, setRows] = useState<Record<OperatingCostCategory, Row>>(() => {
    const initial = {} as Record<OperatingCostCategory, Row>
    for (const c of OPERATING_COST_CATEGORIES) {
      const existing = existingCosts.find(e => e.category === c.key)
      initial[c.key] = {
        amount: existing ? String(existing.amount) : '',
        allocable: existing ? existing.allocable_to_tenant : c.defaultAllocable,
        tenant_id: existing?.tenant_id ?? '',
      }
    }
    return initial
  })

  function setAmount(key: OperatingCostCategory, amount: string) {
    setRows(r => ({ ...r, [key]: { ...r[key], amount } }))
    setSaved(false)
  }
  function setAllocable(key: OperatingCostCategory, allocable: boolean) {
    setRows(r => ({ ...r, [key]: { ...r[key], allocable } }))
    setSaved(false)
  }
  function setTenant(key: OperatingCostCategory, tenant_id: string) {
    setRows(r => ({ ...r, [key]: { ...r[key], tenant_id } }))
    setSaved(false)
  }

  const umlagefaehig = OPERATING_COST_CATEGORIES.filter(c => c.group === 'umlagefaehig')
  const nichtUmlagefaehig = OPERATING_COST_CATEGORIES.filter(c => c.group === 'nicht_umlagefaehig')

  const totalAllocable = umlagefaehig.reduce(
    (s, c) => s + (rows[c.key].allocable ? parseFloat(rows[c.key].amount || '0') || 0 : 0), 0
  )
  const totalNotAllocable = OPERATING_COST_CATEGORIES.reduce(
    (s, c) => s + (!rows[c.key].allocable ? parseFloat(rows[c.key].amount || '0') || 0 : 0), 0
  )
  const diff = totalAllocable - advancePaymentsForYear

  async function onSave() {
    setSaving(true)

    let source_file_url = fileUrl
    if (file) {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (userId) {
        const path = buildStoragePath(userId, property.id, 'nebenkosten', year, file.name)
        const { error: uploadError } = await supabase.storage.from('utility-statements').upload(path, file)
        if (!uploadError) source_file_url = path
      }
    }

    const costRows = OPERATING_COST_CATEGORIES
      .filter(c => rows[c.key].amount !== '')
      .map(c => ({
        property_id: property.id,
        year,
        category: c.key,
        amount: parseFloat(rows[c.key].amount) || 0,
        allocable_to_tenant: rows[c.key].allocable,
        tenant_id: rows[c.key].tenant_id || null,
      }))

    if (costRows.length > 0) {
      const { error } = await supabase.from('operating_costs').upsert(costRows, { onConflict: 'property_id,year,category' })
      if (error) { alert('Fehler: ' + error.message); setSaving(false); return }
    }

    const { error: settlementError } = await supabase.from('utility_settlements').upsert({
      property_id: property.id,
      year,
      total_costs: totalAllocable,
      source_file_url,
      status: settlement?.status ?? 'draft',
    }, { onConflict: 'property_id,year' })

    if (settlementError) { alert('Fehler: ' + settlementError.message); setSaving(false); return }

    setFileUrl(source_file_url)
    setFile(null)
    setSaved(true)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {!property.is_self_managed && (
        <Card className="bg-blue-50 border-blue-100">
          <CardTitle>Jahresabrechnung der Hausverwaltung</CardTitle>
          <p className="text-sm text-gray-600 mt-1 mb-3">
            Lade die Jahresabrechnung als Beleg ab und trag die Summen unten aus den einzelnen Positionen ein.
            Automatisches Auslesen per KI ist technisch vorbereitet, aber erst mit aktivem KI-Zugang live – bis dahin bitte manuell übertragen.
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          {fileUrl && !file && <p className="text-xs text-gray-400 mt-2">✓ Jahresabrechnung bereits hinterlegt</p>}
        </Card>
      )}

      <Card className="bg-amber-50 border-amber-100">
        <CardTitle>Nicht vergessen</CardTitle>
        <p className="text-sm text-gray-700 mt-1">
          <strong>Grundsteuer</strong> wird in Hausgeld-/WEG-Abrechnungen oft nicht separat ausgewiesen – auf der Jahresabrechnung gezielt danach suchen.{' '}
          <strong>Restmüll</strong> für die eigene Tonne läuft nicht immer über das Hausgeld – falls du dafür direkt an Stadt/Gemeinde zahlst, trägst du diese Kosten oft selbst, statt sie umzulegen.
        </p>
      </Card>

      <Card>
        <CardTitle>Umlagefähige Betriebskosten (an Mieter weiterberechenbar)</CardTitle>
        {tenants.length > 1 && (
          <p className="text-xs text-gray-400 -mt-0.5 mb-2">
            Mehrere Mietparteien bei diesem Objekt (z.B. Wohnung + separat vermietete Garage) – bei Bedarf je Position zuordnen, wem die Kosten weiterberechnet werden. Ohne Auswahl gilt die Position für alle.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {umlagefaehig.map(c => (
            <CostRow
              key={c.key}
              config={c}
              row={rows[c.key]}
              showAllocableToggle
              tenants={tenants.length > 1 ? tenants : undefined}
              onAmount={v => setAmount(c.key, v)}
              onAllocable={v => setAllocable(c.key, v)}
              onTenant={v => setTenant(c.key, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Nicht umlagefähige Kosten (trägst du selbst)</CardTitle>
        <p className="text-xs text-gray-400 -mt-0.5 mb-2">Für Wohnraum gesetzlich nicht auf Mieter umlegbar (§ 556 BGB), aber relevant, damit nichts vergessen wird.</p>
        <div className="space-y-3">
          {nichtUmlagefaehig.map(c => (
            <CostRow
              key={c.key}
              config={c}
              row={rows[c.key]}
              showAllocableToggle={false}
              onAmount={v => setAmount(c.key, v)}
              onAllocable={v => setAllocable(c.key, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Zusammenfassung {year}</CardTitle>
        <div className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Umlagefähig gesamt</span>
            <strong className="text-gray-900">{euro(totalAllocable)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Selbst getragen</span>
            <strong className="text-gray-900">{euro(totalNotAllocable)}</strong>
          </div>
          <div className="flex justify-between border-t pt-1.5">
            <span className="text-gray-500">Nebenkostenvorauszahlungen der Mieter (geschätzt)</span>
            <strong className="text-gray-900">{euro(advancePaymentsForYear)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{diff >= 0 ? 'Nachzahlung von Mieter zu erwarten' : 'Guthaben – Rückzahlung an Mieter fällig'}</span>
            <strong className={diff >= 0 ? 'text-red-500' : 'text-green-600'}>{euro(Math.abs(diff))}</strong>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Grobe Schätzung auf Basis der hinterlegten Vorauszahlung je Mieter – ersetzt keine korrekte Umlage nach Wohnfläche/Verbrauch.
        </p>
      </Card>

      <button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Wird gespeichert...' : saved ? '✓ Gespeichert' : 'Speichern'}
      </button>
    </div>
  )
}

function CostRow({ config, row, showAllocableToggle, tenants, onAmount, onAllocable, onTenant }: {
  config: OperatingCostCategoryConfig
  row: Row
  showAllocableToggle: boolean
  tenants?: Tenant[]
  onAmount: (v: string) => void
  onAllocable: (v: boolean) => void
  onTenant?: (v: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <label className="flex-1 text-sm text-gray-700">{config.label}</label>
        <input
          type="number"
          step="0.01"
          value={row.amount}
          onChange={e => onAmount(e.target.value)}
          placeholder="0,00"
          className="w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showAllocableToggle && (
          <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
            <input
              type="checkbox"
              checked={row.allocable}
              onChange={e => onAllocable(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
            />
            umlagefähig
          </label>
        )}
      </div>
      {tenants && onTenant && (
        <select
          value={row.tenant_id}
          onChange={e => onTenant(e.target.value)}
          className="mt-1.5 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Für: alle Mieter</option>
          {tenants.map(t => <option key={t.id} value={t.id}>Für: {t.name}{t.unit ? ` (${t.unit})` : ''}</option>)}
        </select>
      )}
      {config.highlight && <p className="text-xs text-amber-700 mt-1">{config.highlight}</p>}
    </div>
  )
}
