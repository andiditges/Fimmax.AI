'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPropertyImageSignedUrl } from '@/app/actions/property-images'
import { Card } from '@/components/ui/card'
import { PropertyImage } from '@/lib/types'
import { ALLOWED_IMAGE_TYPES } from '@/lib/upload-validation'

export function PropertyImages({ propertyId, images }: { propertyId: string; images: PropertyImage[] }) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(images.map(async img => [img.id, await getPropertyImageSignedUrl(img.file_path)] as const))
      .then(entries => {
        if (cancelled) return
        setUrls(Object.fromEntries(entries.filter(([, url]) => url) as [string, string][]))
      })
    return () => { cancelled = true }
  }, [images])

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files ?? [])
    if (allFiles.length === 0) return
    const files = allFiles.filter(f => ALLOWED_IMAGE_TYPES.includes(f.type))
    if (files.length < allFiles.length) {
      alert('Nur JPEG, PNG oder WebP werden unterstützt – SVG und andere Formate wurden übersprungen.')
    }
    if (files.length === 0) { if (fileRef.current) fileRef.current.value = ''; return }
    setUploading(true)

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) { setUploading(false); return }

    for (const file of files) {
      const path = `${userId}/${propertyId}/images/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('property-images').upload(path, file)
      if (uploadError) { alert('Fehler beim Hochladen von ' + file.name + ': ' + uploadError.message); continue }
      await supabase.from('property_images').insert({
        property_id: propertyId,
        file_path: path,
        is_cover: images.length === 0,
      })
    }

    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    router.refresh()
  }

  async function setCover(id: string) {
    setBusyId(id)
    await supabase.from('property_images').update({ is_cover: false }).eq('property_id', propertyId)
    await supabase.from('property_images').update({ is_cover: true }).eq('id', id)
    setBusyId(null)
    router.refresh()
  }

  async function saveCaption(id: string, caption: string) {
    await supabase.from('property_images').update({ caption: caption || null }).eq('id', id)
  }

  async function deleteImage(img: PropertyImage) {
    if (!confirm('Dieses Bild wirklich löschen?')) return
    setBusyId(img.id)
    await supabase.storage.from('property-images').remove([img.file_path])
    await supabase.from('property_images').delete().eq('id', img.id)
    setBusyId(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Bilder ({images.length})</h2>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
          {uploading ? 'Wird hochgeladen...' : '+ Bilder hochladen'}
        </button>
        <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} multiple onChange={onFilesChange} className="hidden" />
      </div>

      {images.length === 0 ? (
        <Card className="text-center py-8 text-gray-400 dark:text-gray-500">
          Noch keine Bilder hinterlegt – für das Objekt-Exposé empfehlenswert.
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <Card key={img.id} className="p-2">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden mb-2 relative">
                {urls[img.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[img.id]} alt={img.caption ?? 'Immobilienbild'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs">Lädt...</div>
                )}
                {img.is_cover && (
                  <span className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                    Titelbild
                  </span>
                )}
              </div>
              <input
                type="text"
                defaultValue={img.caption ?? ''}
                onBlur={e => saveCaption(img.id, e.target.value)}
                placeholder="Bildunterschrift..."
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between gap-1">
                {!img.is_cover && (
                  <button type="button" onClick={() => setCover(img.id)} disabled={busyId === img.id} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                    Als Titelbild
                  </button>
                )}
                <button type="button" onClick={() => deleteImage(img)} disabled={busyId === img.id} className="text-[11px] text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 ml-auto">
                  Löschen
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
