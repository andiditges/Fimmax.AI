'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { UserSettings } from '@/lib/types'

export function UserSettingsForm({ settings }: { settings: UserSettings | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(settings?.landlord_name ?? '')
  const [addressLine, setAddressLine] = useState(settings?.address_line ?? '')
  const [postalCode, setPostalCode] = useState(settings?.postal_code ?? '')
  const [city, setCity] = useState(settings?.city ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function markDirty() {
    setSaved(false)
  }

  async function onSave() {
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) { setSaving(false); return }

    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      landlord_name: name || null,
      address_line: addressLine || null,
      postal_code: postalCode || null,
      city: city || null,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      alert('Fehler: ' + error.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    router.refresh()
  }

  return (
    <Card>
      <CardTitle>Vermieter-Stammdaten</CardTitle>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); markDirty() }}
            placeholder="Max Mustermann"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Straße und Hausnummer</label>
          <input
            value={addressLine}
            onChange={e => { setAddressLine(e.target.value); markDirty() }}
            placeholder="Musterstraße 1"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
            <input
              value={postalCode}
              onChange={e => { setPostalCode(e.target.value); markDirty() }}
              placeholder="12345"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
            <input
              value={city}
              onChange={e => { setCity(e.target.value); markDirty() }}
              placeholder="Musterstadt"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Wird gespeichert...' : saved ? '✓ Gespeichert' : 'Speichern'}
      </button>
    </Card>
  )
}
