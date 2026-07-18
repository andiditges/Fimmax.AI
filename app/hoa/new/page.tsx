'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildStoragePath } from '@/lib/storage-path'
import { Card } from '@/components/ui/card'
import { propertyLabel } from '@/lib/format'
import { Roofed } from '@/components/roofed'
import { HOA_RESOLUTION_STATUS_LABELS, HoaResolutionStatus } from '@/lib/types'

export default function NewHoaDocument() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const propertyIdFromQuery = searchParams.get('property') ?? ''

  const [userId, setUserId] = useState<string | null>(null)
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null }[]>([])
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [propertyId, setPropertyId] = useState(propertyIdFromQuery)
  const [form, setForm] = useState({
    title: '',
    meeting_date: '',
    year: String(new Date().getFullYear()),
  })

  const [resolution, setResolution] = useState({ title: '', description: '', status: 'offen' as HoaResolutionStatus })
  const [savingResolution, setSavingResolution] = useState(false)
  const [resolutionsAdded, setResolutionsAdded] = useState<string[]>([])

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label').then(({ data }) => setProperties(data ?? []))
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  })

  async function onSubmitDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!propertyId) return alert('Bitte eine Immobilie auswählen')
    setSaving(true)

    let file_url: string | null = null
    if (file && userId) {
      const path = buildStoragePath(userId, propertyId, 'weg-protokolle', parseInt(form.year), file.name)
      const { error: uploadError } = await supabase.storage.from('hoa-documents').upload(path, file)
      if (!uploadError) file_url = path
    }

    const { data, error } = await supabase.from('hoa_documents').insert({
      property_id: propertyId,
      title: form.title,
      meeting_date: form.meeting_date || null,
      year: parseInt(form.year),
      file_url,
    }).select().single()

    if (!error && data) setDocId(data.id)
    else alert('Fehler: ' + error?.message)
    setSaving(false)
  }

  async function onAddResolution(e: React.FormEvent) {
    e.preventDefault()
    if (!docId || !propertyId) return
    setSavingResolution(true)
    const { error } = await supabase.from('hoa_resolutions').insert({
      property_id: propertyId,
      hoa_document_id: docId,
      year: parseInt(form.year),
      title: resolution.title,
      description: resolution.description || null,
      status: resolution.status,
    })
    if (!error) {
      setResolutionsAdded(a => [...a, resolution.title])
      setResolution({ title: '', description: '', status: 'offen' })
    } else alert('Fehler: ' + error.message)
    setSavingResolution(false)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">WEG-Dokument hochladen</h1>

      <Card className="mb-5">
        <form onSubmit={onSubmitDocument} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><Roofed>Immobilie</Roofed> *</label>
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              disabled={!!docId}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              required
            >
              <option value="">Bitte wählen...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              disabled={!!docId} placeholder="z.B. Protokoll Eigentümerversammlung 2025"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Versammlungsdatum</label>
              <input type="date" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))}
                disabled={!!docId}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jahr *</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                disabled={!!docId}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Protokoll (PDF/Bild)</label>
            <input type="file" accept="image/*,application/pdf" disabled={!!docId}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm" />
          </div>

          {!docId && (
            <button type="submit" disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Wird gespeichert...' : 'Dokument speichern'}
            </button>
          )}
        </form>
      </Card>

      {docId && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Beschlüsse erfassen</h2>
          {resolutionsAdded.length > 0 && (
            <ul className="text-sm text-green-700 mb-3 space-y-1">
              {resolutionsAdded.map((t, i) => <li key={i}>✓ {t}</li>)}
            </ul>
          )}
          <form onSubmit={onAddResolution} className="space-y-3">
            <input type="text" value={resolution.title} onChange={e => setResolution(r => ({ ...r, title: e.target.value }))}
              placeholder="Titel des Beschlusses" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" value={resolution.description} onChange={e => setResolution(r => ({ ...r, description: e.target.value }))}
              placeholder="Beschreibung (optional)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={resolution.status} onChange={e => setResolution(r => ({ ...r, status: e.target.value as HoaResolutionStatus }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(HOA_RESOLUTION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={savingResolution}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {savingResolution ? 'Speichert...' : '+ Beschluss hinzufügen'}
              </button>
              <button type="button" onClick={() => router.push(`/properties/${propertyId}`)}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:text-gray-900">
                Fertig
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
