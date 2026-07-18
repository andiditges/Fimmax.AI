'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildStoragePath } from '@/lib/storage-path'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { CATEGORY_LABELS, ReceiptCategory } from '@/lib/types'

interface AiResult {
  receipt_date: string | null
  amount: number | null
  vendor: string | null
  description: string | null
  category: ReceiptCategory | null
  is_renovation: boolean
  suggested_property_id: string | null
  confidence: number
}

export default function NewReceipt() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null }[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [ai, setAi] = useState<AiResult | null>(null)
  const [form, setForm] = useState({
    property_id: '',
    receipt_date: '',
    amount: '',
    vendor: '',
    description: '',
    category: 'sonstiges' as ReceiptCategory,
    is_renovation: false,
  })

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label').then(({ data }) => {
      setProperties(data ?? [])
    })
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  })

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    analyzeFile(f)
  }

  async function analyzeFile(f: File) {
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('properties', JSON.stringify(properties))
      const res = await fetch('/api/analyze-receipt', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const result: AiResult = await res.json()
      setAi(result)
      setForm({
        property_id: result.suggested_property_id ?? '',
        receipt_date: result.receipt_date ?? '',
        amount: result.amount != null ? String(result.amount) : '',
        vendor: result.vendor ?? '',
        description: result.description ?? '',
        category: result.category ?? 'sonstiges',
        is_renovation: result.is_renovation ?? false,
      })
    } catch {
      // KI-Analyse fehlgeschlagen – User füllt manuell aus
    }
    setAnalyzing(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id) return alert('Bitte eine Immobilie auswählen')
    setSaving(true)

    const tax_year = form.receipt_date ? new Date(form.receipt_date).getFullYear() : new Date().getFullYear()

    let file_url: string | null = null
    if (file && userId) {
      const path = buildStoragePath(userId, form.property_id, 'belege', tax_year, file.name)
      const { error } = await supabase.storage.from('receipts').upload(path, file)
      if (!error) file_url = path
    }

    const { error } = await supabase.from('receipts').insert({
      property_id: form.property_id,
      file_url,
      receipt_date: form.receipt_date,
      amount: parseFloat(form.amount),
      vendor: form.vendor || null,
      description: form.description || null,
      category: form.category,
      is_renovation: form.is_renovation,
      ai_confidence: ai?.confidence ?? null,
      tax_year,
    })

    if (!error) router.push('/')
    else { alert('Fehler: ' + error.message); setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Beleg erfassen</h1>

      {/* Upload-Bereich */}
      <Card className="mb-5">
        <div
          onClick={() => { if (!preview) fileRef.current?.click() }}
          className={`border-2 border-dashed border-gray-200 rounded-xl p-8 text-center transition-colors ${!preview ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50' : ''}`}
        >
          {preview ? (
            <>
              {file?.type.startsWith('image/') ? (
                <img src={preview} alt="Vorschau" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="py-4">
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-gray-600 font-medium truncate">{file?.name}</p>
                  <p className="text-gray-400 text-xs mt-1">PDF – keine Bildvorschau möglich</p>
                </div>
              )}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Anderes Foto wählen
              </button>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">📷</div>
              <p className="text-gray-600 font-medium">Foto machen oder Datei auswählen</p>
              <p className="text-gray-400 text-sm mt-1">JPG, PNG, PDF</p>
            </>
          )}
          {analyzing && (
            <div className="mt-3 text-blue-600 text-sm font-medium animate-pulse">KI analysiert Beleg...</div>
          )}
          {ai && !analyzing && (
            <div className="mt-3 text-green-600 text-sm font-medium">
              ✓ Analysiert (Konfidenz: {Math.round(ai.confidence * 100)}%)
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={onFileChange}
          className="hidden"
        />
      </Card>

      {/* Formular */}
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Immobilie *</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
              <input type="date" value={form.receipt_date} onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Betrag (€) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant / Firma</label>
            <input type="text" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie *</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ReceiptCategory }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <input type="checkbox" id="renovation" checked={form.is_renovation}
              onChange={e => setForm(f => ({ ...f, is_renovation: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-amber-600" />
            <label htmlFor="renovation" className="text-sm text-amber-800">
              Renovierungsmaßnahme (relevant für 15%-Grenze § 6 EStG)
            </label>
          </div>

          <button type="submit" disabled={saving || analyzing}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Wird gespeichert...' : 'Beleg speichern'}
          </button>
        </form>
      </Card>
    </div>
  )
}
