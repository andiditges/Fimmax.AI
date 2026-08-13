'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildStoragePath } from '@/lib/storage-path'
import { HoaDocument } from '@/lib/types'

// Löst die häufige Verwechslung "Nebenkosten-/Hausgeld-Einzelabrechnung
// versehentlich unter WEG-Dokumente hochgeladen" auf: verschiebt oder
// dupliziert die Datei zur Jahresabrechnung im Nebenkostenassistenten
// (utility-statements-Bucket + utility_settlements-Zeile für das Jahr),
// statt manuell herunterladen + neu hochladen zu müssen.
export function HoaDocumentMove({ doc, propertyId }: { doc: HoaDocument; propertyId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(String(doc.year))
  const [action, setAction] = useState<'move' | 'copy'>('move')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!doc.file_url) { alert('Zu diesem Eintrag ist keine Datei hinterlegt - nur Titel/Datum lassen sich nicht verschieben.'); return }
    const targetYear = parseInt(year)
    if (!targetYear) return
    setSaving(true)

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) { setSaving(false); return }

    const { data: blob, error: downloadError } = await supabase.storage.from('hoa-documents').download(doc.file_url)
    if (downloadError || !blob) { alert('Fehler beim Lesen der Datei: ' + downloadError?.message); setSaving(false); return }

    const filename = doc.file_url.split('/').pop() ?? doc.title
    const newPath = buildStoragePath(userId, propertyId, 'nebenkosten', targetYear, filename)
    const { error: uploadError } = await supabase.storage.from('utility-statements').upload(newPath, blob)
    if (uploadError) { alert('Fehler beim Ablegen im Nebenkostenassistenten: ' + uploadError.message); setSaving(false); return }

    const { data: existing } = await supabase.from('utility_settlements')
      .select('*').eq('property_id', propertyId).eq('year', targetYear).maybeSingle()

    const { error: settlementError } = await supabase.from('utility_settlements').upsert({
      property_id: propertyId,
      year: targetYear,
      total_costs: existing?.total_costs ?? 0,
      status: existing?.status ?? 'draft',
      source_file_url: newPath,
    }, { onConflict: 'property_id,year' })
    if (settlementError) { alert('Fehler: ' + settlementError.message); setSaving(false); return }

    if (action === 'move') {
      await supabase.storage.from('hoa-documents').remove([doc.file_url])
      await supabase.from('hoa_documents').delete().eq('id', doc.id)
    }

    setSaving(false)
    setOpen(false)
    router.push(`/properties/${propertyId}/nebenkosten?year=${targetYear}`)
    router.refresh()
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
        {open ? 'Abbrechen' : 'Falsch abgelegt? → Nebenkostenassistent'}
      </button>
      {open && (
        <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2 flex-wrap bg-blue-50 border border-blue-100 rounded-lg p-2">
          <select
            value={action}
            onChange={e => setAction(e.target.value as 'move' | 'copy')}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white"
          >
            <option value="move">Verschieben</option>
            <option value="copy">Duplizieren</option>
          </select>
          <span className="text-xs text-gray-500">Jahr</span>
          <input
            type="number"
            value={year}
            onChange={e => setYear(e.target.value)}
            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white text-xs px-3 py-1 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Los'}
          </button>
        </form>
      )}
    </div>
  )
}
