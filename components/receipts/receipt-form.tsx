'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildStoragePath } from '@/lib/storage-path'
import { trackEvent } from '@/lib/analytics'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { CATEGORY_LABELS, Receipt, ReceiptCategory, ReceiptItem } from '@/lib/types'
import { ALLOWED_DOCUMENT_TYPES as ALLOWED_RECEIPT_TYPES } from '@/lib/upload-validation'

interface PropertyOption {
  id: string
  address: string
  unit: string | null
  unit_label: string | null
  expected_non_allocable_operating_cost_annual?: number | null
}

// Kategorien, die typischerweise in die pauschale Nebenkosten-Schätzung
// (expected_non_allocable_operating_cost_annual) einfließen - wird für den
// Prognose-Hinweis nach dem Speichern genutzt.
const FORECAST_RELEVANT_CATEGORIES: ReceiptCategory[] = ['grundsteuer', 'hausgeld', 'abfall']

interface ForecastNudge {
  property_id: string
  label: string
  current: number
  suggested: number
}

interface LineItem {
  key: string
  property_id: string
  category: ReceiptCategory
  amount: string
  description: string
  is_renovation: boolean
}

interface AiItem {
  category: ReceiptCategory
  amount: number | null
  description: string | null
  suggested_property_id: string | null
  is_renovation: boolean
}

interface AiResult {
  receipt_date: string | null
  amount: number | null
  vendor: string | null
  items: AiItem[]
  needs_review: boolean
  review_note: string | null
  confidence: number
}

// Leichtgewichtiger Hinweis statt echtem Wiederkehrend-Kosten-Modell: prüft
// nur, ob die neu erfassten Grundsteuer-/Hausgeld-/Abfall-Positionen deutlich
// (>10%) von der bisherigen pauschalen Jahres-Schätzung je Immobilie
// abweichen - nutzt das bestehende Feld, keine Zeitreihen-/Stichtag-Logik.
function computeForecastNudges(
  parsedLines: { property_id: string; category: ReceiptCategory; amountNum: number }[],
  properties: PropertyOption[]
): ForecastNudge[] {
  const sumsByProperty = new Map<string, number>()
  for (const l of parsedLines) {
    if (!FORECAST_RELEVANT_CATEGORIES.includes(l.category)) continue
    sumsByProperty.set(l.property_id, (sumsByProperty.get(l.property_id) ?? 0) + l.amountNum)
  }

  const nudges: ForecastNudge[] = []
  for (const [propertyId, suggested] of sumsByProperty) {
    const property = properties.find(p => p.id === propertyId)
    const current = property?.expected_non_allocable_operating_cost_annual
    if (current == null || current <= 0) continue
    if (Math.abs(suggested - current) / current > 0.1) {
      nudges.push({ property_id: propertyId, label: property ? propertyLabel(property) : propertyId, current, suggested })
    }
  }
  return nudges
}

function newLine(propertyId = ''): LineItem {
  return {
    key: Math.random().toString(36).slice(2),
    property_id: propertyId,
    category: 'sonstiges',
    amount: '',
    description: '',
    is_renovation: false,
  }
}

export function ReceiptForm({
  properties,
  userId,
  mode,
  receiptId,
  initialReceipt,
  initialItems,
}: {
  properties: PropertyOption[]
  userId: string | null
  mode: 'new' | 'edit'
  receiptId?: string
  initialReceipt?: Receipt
  initialItems?: ReceiptItem[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ai, setAi] = useState<AiResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [nudges, setNudges] = useState<ForecastNudge[] | null>(null)
  const [appliedNudges, setAppliedNudges] = useState<Set<string>>(new Set())
  const [vendor, setVendor] = useState(initialReceipt?.vendor ?? '')
  const [receiptDate, setReceiptDate] = useState(initialReceipt?.receipt_date ?? '')
  const [lines, setLines] = useState<LineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map(item => ({
        key: item.id,
        property_id: item.property_id,
        category: item.category,
        amount: String(item.amount),
        description: item.description ?? '',
        is_renovation: item.is_renovation,
      }))
    }
    if (initialReceipt) {
      return [{
        key: 'primary',
        property_id: initialReceipt.property_id,
        category: initialReceipt.category,
        amount: String(initialReceipt.amount),
        description: initialReceipt.description ?? '',
        is_renovation: initialReceipt.is_renovation,
      }]
    }
    return [newLine()]
  })

  const linesTotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const documentAmount = ai?.amount ?? null
  const totalsMismatch = documentAmount != null && Math.abs(documentAmount - linesTotal) > 0.05

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines(ls => [...ls, newLine(ls[0]?.property_id ?? '')])
  }

  function removeLine(key: string) {
    setLines(ls => (ls.length > 1 ? ls.filter(l => l.key !== key) : ls))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ALLOWED_RECEIPT_TYPES.includes(f.type)) {
      alert('Nicht unterstütztes Dateiformat – bitte JPEG, PNG, WebP oder PDF verwenden.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    analyzeFile(f)
  }

  async function analyzeFile(f: File) {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('properties', JSON.stringify(properties))
      const res = await fetch('/api/analyze-receipt', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Analyse fehlgeschlagen')
      }
      const result: AiResult = await res.json()
      setAi(result)
      setVendor(result.vendor ?? '')
      setReceiptDate(result.receipt_date ?? '')
      const items = result.items && result.items.length > 0 ? result.items : [{
        category: 'sonstiges' as ReceiptCategory,
        amount: result.amount,
        description: null,
        suggested_property_id: null,
        is_renovation: false,
      }]
      setLines(items.map(item => ({
        key: Math.random().toString(36).slice(2),
        property_id: item.suggested_property_id ?? '',
        category: item.category ?? 'sonstiges',
        amount: item.amount != null ? String(item.amount) : '',
        description: item.description ?? '',
        is_renovation: item.is_renovation ?? false,
      })))
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analyse fehlgeschlagen')
    }
    setAnalyzing(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lines.some(l => !l.property_id)) return alert('Bitte für jede Position eine Immobilie auswählen')
    if (lines.some(l => !l.amount)) return alert('Bitte für jede Position einen Betrag angeben')
    setSaving(true)

    const tax_year = receiptDate ? new Date(receiptDate).getFullYear() : new Date().getFullYear()
    const parsedLines = lines.map(l => ({ ...l, amountNum: parseFloat(l.amount) }))
    const primary = parsedLines.reduce((max, l) => (l.amountNum > max.amountNum ? l : max), parsedLines[0])
    const amount = parsedLines.reduce((s, l) => s + l.amountNum, 0)

    let file_url: string | null = initialReceipt?.file_url ?? null
    if (file && userId) {
      const path = buildStoragePath(userId, primary.property_id, 'belege', tax_year, file.name)
      const { error } = await supabase.storage.from('receipts').upload(path, file)
      if (!error) file_url = path
    }

    const receiptPayload = {
      property_id: primary.property_id,
      file_url,
      receipt_date: receiptDate,
      amount,
      vendor: vendor || null,
      description: primary.description || null,
      category: primary.category,
      is_renovation: primary.is_renovation,
      tax_year,
    }

    let savedReceiptId = receiptId
    if (mode === 'new') {
      const { data, error } = await supabase.from('receipts').insert({
        ...receiptPayload,
        ai_confidence: ai?.confidence ?? null,
      }).select('id').single()
      if (error || !data) { alert('Fehler: ' + error?.message); setSaving(false); return }
      savedReceiptId = data.id
      trackEvent('receipt_created')
    } else {
      const { error } = await supabase.from('receipts').update(receiptPayload).eq('id', receiptId)
      if (error) { alert('Fehler: ' + error.message); setSaving(false); return }
      // Bestehende Positionen ersetzen statt einzeln abzugleichen - der
      // Nutzer bearbeitet die Liste als Ganzes, es gibt keine stabile
      // Identität einzelner Zeilen über die Session hinaus.
      await supabase.from('receipt_items').delete().eq('receipt_id', receiptId)
    }

    if (parsedLines.length > 1 && savedReceiptId) {
      const { error } = await supabase.from('receipt_items').insert(
        parsedLines.map(l => ({
          receipt_id: savedReceiptId,
          property_id: l.property_id,
          category: l.category,
          amount: l.amountNum,
          is_renovation: l.is_renovation,
          description: l.description || null,
        }))
      )
      if (error) { alert('Fehler beim Speichern der Positionen: ' + error.message); setSaving(false); return }
    }

    setSaving(false)
    const computedNudges = computeForecastNudges(parsedLines, properties)
    if (computedNudges.length > 0) {
      setNudges(computedNudges)
    } else {
      router.push(mode === 'edit' ? `/properties/${primary.property_id}` : '/')
    }
  }

  function finish() {
    const primaryPropertyId = lines[0]?.property_id
    router.push(mode === 'edit' && primaryPropertyId ? `/properties/${primaryPropertyId}` : '/')
  }

  async function applyNudge(n: ForecastNudge) {
    await supabase.from('properties').update({ expected_non_allocable_operating_cost_annual: n.suggested }).eq('id', n.property_id)
    setAppliedNudges(prev => new Set(prev).add(n.property_id))
  }

  async function onDelete() {
    if (!receiptId || !confirm('Diesen Beleg wirklich löschen?')) return
    setDeleting(true)
    const propertyId = lines[0]?.property_id
    const { error } = await supabase.from('receipts').delete().eq('id', receiptId)
    if (!error) router.push(propertyId ? `/properties/${propertyId}` : '/steuer')
    else { alert('Fehler: ' + error.message); setDeleting(false) }
  }

  if (nudges) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Beleg gespeichert</h1>
        <Card className="mb-5 bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Dieser Beleg weicht deutlich von deiner bisherigen Nebenkosten-Schätzung ab. Jetzt aktualisieren?
          </p>
        </Card>
        <div className="space-y-3">
          {nudges.map(n => (
            <Card key={n.property_id} className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{n.label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bisheriger Richtwert {n.current.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/Jahr
                  {' '}→ dieser Beleg deutet auf {n.suggested.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/Jahr hin
                </p>
              </div>
              {appliedNudges.has(n.property_id) ? (
                <span className="text-sm text-green-600 dark:text-green-500 font-medium">✓ Aktualisiert</span>
              ) : (
                <button type="button" onClick={() => applyNudge(n)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700">
                  Aktualisieren
                </button>
              )}
            </Card>
          ))}
        </div>
        <button type="button" onClick={finish} className="mt-5 w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-3 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-300 transition-colors">
          Fertig
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{mode === 'new' ? 'Beleg erfassen' : 'Beleg bearbeiten'}</h1>

      {mode === 'new' && (
        <Card className="mb-5">
          <div
            onClick={() => { if (!preview) fileRef.current?.click() }}
            className={`border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center transition-colors ${!preview ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40' : ''}`}
          >
            {preview ? (
              <>
                {file?.type.startsWith('image/') ? (
                  <img src={preview} alt="Vorschau" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="py-4">
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium truncate">{file?.name}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">PDF – keine Bildvorschau möglich</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Anderes Foto wählen
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">📷</div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">Foto machen oder Datei auswählen</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">JPG, PNG, PDF</p>
              </>
            )}
            {analyzing && (
              <div className="mt-3 text-blue-600 dark:text-blue-400 text-sm font-medium animate-pulse">KI analysiert Beleg...</div>
            )}
            {ai && !analyzing && (
              <div className="mt-3 text-green-600 dark:text-green-500 text-sm font-medium">
                ✓ Analysiert (Konfidenz: {Math.round(ai.confidence * 100)}%)
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_RECEIPT_TYPES.join(',')}
            capture="environment"
            onChange={onFileChange}
            className="hidden"
          />
        </Card>
      )}

      {analyzeError && !analyzing && (
        <Card className="mb-5 bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900">
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>KI-Analyse fehlgeschlagen:</strong> {analyzeError} – bitte die Felder unten manuell ausfüllen.
          </p>
        </Card>
      )}

      {ai?.needs_review && ai.review_note && (
        <Card className="mb-5 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>KI ist sich nicht sicher:</strong> {ai.review_note}
          </p>
        </Card>
      )}

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum *</label>
              <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lieferant / Firma</label>
              <input type="text" value={vendor} onChange={e => setVendor(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={line.key} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 space-y-3">
                {lines.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Position {i + 1}</span>
                    <button type="button" onClick={() => removeLine(line.key)} className="text-xs text-red-500 dark:text-red-400 hover:underline">
                      Entfernen
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Immobilie *</label>
                  <select
                    value={line.property_id}
                    onChange={e => updateLine(line.key, { property_id: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie *</label>
                    <select value={line.category} onChange={e => updateLine(line.key, { category: e.target.value as ReceiptCategory })}
                      className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Betrag (€) *</label>
                    <input type="number" step="0.01" value={line.amount} onChange={e => updateLine(line.key, { amount: e.target.value })}
                      className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beschreibung</label>
                  <input type="text" value={line.description} onChange={e => updateLine(line.key, { description: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {line.category === 'instandhaltung' && (
                  <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-xl p-3">
                    <input type="checkbox" id={`renovation-${line.key}`} checked={line.is_renovation}
                      onChange={e => updateLine(line.key, { is_renovation: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-amber-600" />
                    <label htmlFor={`renovation-${line.key}`} className="text-sm text-amber-800 dark:text-amber-300">
                      Renovierungsmaßnahme (relevant für 15%-Grenze § 6 EStG)
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addLine} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            + Position hinzufügen
          </button>

          {lines.length > 1 && (
            <p className={`text-xs ${totalsMismatch ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
              Positionen: {linesTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              {documentAmount != null && ` · Beleg-Gesamtbetrag laut KI: ${documentAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
              {totalsMismatch && ' – weicht ab, bitte prüfen'}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || analyzing || deleting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Wird gespeichert...' : mode === 'new' ? 'Beleg speichern' : 'Änderungen speichern'}
            </button>
            {mode === 'edit' && (
              <button type="button" onClick={onDelete} disabled={saving || deleting}
                className="px-4 py-3 rounded-xl font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50">
                {deleting ? '...' : 'Löschen'}
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
