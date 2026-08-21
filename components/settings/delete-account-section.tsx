'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'

const CONFIRM_WORD = 'LÖSCHEN'

export function DeleteAccountSection() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    setDeleting(true)
    setError(null)
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Löschen fehlgeschlagen.')
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Card>
      <CardTitle>Account löschen</CardTitle>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Löscht deinen Account unwiderruflich – alle Objekte, Mieter, Belege, Kredite, Dokumente und Einstellungen werden dauerhaft entfernt. Das kann nicht rückgängig gemacht werden.
      </p>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Account unwiderruflich löschen…
        </button>
      )}

      {open && (
        <div className="mt-4 space-y-3 border border-red-200 dark:border-red-900 rounded-xl p-4 bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Gib zur Bestätigung <span className="font-semibold">{CONFIRM_WORD}</span> ein:
          </p>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder={CONFIRM_WORD}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={confirmText !== CONFIRM_WORD || deleting}
              className="bg-red-600 text-white py-2.5 px-4 rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {deleting ? 'Wird gelöscht...' : 'Account endgültig löschen'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmText(''); setError(null) }}
              disabled={deleting}
              className="py-2.5 px-4 rounded-xl font-medium text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
