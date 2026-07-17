'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'

export default function Login() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else { router.push('/'); router.refresh() }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setInfo('Konto angelegt. Falls Bestätigung aktiv ist: bitte E-Mail-Postfach prüfen.')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Immobilien, aber richtig.</h1>
        <p className="text-gray-500 mt-2">
          Belege, Kredite, Steuern und Reminders – alles an einem Ort für private Vermieter.
        </p>
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
        {mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
      </h2>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-600">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Einen Moment...' : mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
          className="w-full text-center text-sm text-blue-600 hover:underline mt-4"
        >
          {mode === 'signin' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </button>
      </Card>
    </div>
  )
}
