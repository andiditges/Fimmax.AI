'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { BrickLoader } from '@/components/brick-loader'

export default function Login() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [slotsRemaining, setSlotsRemaining] = useState<number | null>(null)

  useEffect(() => {
    supabase.rpc('beta_signup_slots_remaining').then(({ data }) => {
      if (typeof data === 'number') setSlotsRemaining(data)
    })
  }, [supabase])

  const betaFull = slotsRemaining === 0

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
      if (!acceptedTerms) {
        setError('Bitte bestätige die AGB, den Haftungsausschluss und die Datenschutzerklärung.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(/beta ist aktuell auf 10 nutzer begrenzt/i.test(error.message) ? 'Die Beta ist aktuell voll (10 von 10 Plätzen belegt).' : error.message)
      else setInfo('Konto angelegt. Falls Bestätigung aktiv ist: bitte E-Mail-Postfach prüfen.')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 md:mt-16 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
      <div>
        <div className="relative w-full h-56 md:h-80 rounded-2xl overflow-hidden shadow-sm">
          <Image
            src="/andi-mit-kindern.jpg"
            alt="Andi mit seinen beiden Kindern bei Sonnenuntergang"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 uppercase tracking-wide">Warum es Fimmax.AI gibt</p>
        <p className="brick-text text-lg font-semibold mt-1">
          „Ich glaube, dass die Zeit eines Investors in Entscheidungen gehört – nicht in Ordner.“
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
          Fimmax.AI gibt dir deine Zeit zurück. Verbring sie mit dem, was wirklich zählt.
        </p>
      </div>

      <div className="max-w-sm w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="brick-text text-3xl font-bold tracking-tight">Immobilien, aber richtig.</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Belege, Kredite, Steuern, Nachrichten und Erinnerungen – alles an einem Ort für Vermieter, egal ob privat, geschäftlich oder irgendwas dazwischen.
          </p>
        </div>
        <h2 className="brick-text text-lg font-semibold mb-4 text-center">
          {mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
        </h2>

        {mode === 'signup' && (
          <div className="mb-4 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-xl px-3 py-2.5">
            <p className="font-medium">Beta-Version{slotsRemaining != null && !betaFull ? ` – noch ${slotsRemaining} von 10 Plätzen frei` : ''}</p>
            <p className="mt-1">Noch nicht alle Funktionen sind freigeschaltet. KI-Funktionen (Beleg-Analyse, Standortrisiko-Einschätzung, Tipps-Chat) laufen in dieser Version noch nicht - Belege können weiterhin ganz normal manuell erfasst werden.</p>
          </div>
        )}

        {betaFull && mode === 'signup' ? (
          <Card className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            Die Beta ist aktuell voll (10 von 10 Plätzen belegt). Bitte später erneut versuchen.
          </Card>
        ) : (
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={6}
                required
              />
            </div>

            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400"
                  required
                />
                <span>
                  Ich habe die{' '}
                  <Link href="/agb" target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline">AGB</Link>,
                  den{' '}
                  <Link href="/haftungsausschluss" target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline">Haftungsausschluss</Link>{' '}
                  und die{' '}
                  <Link href="/datenschutz" target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline">Datenschutzerklärung</Link>{' '}
                  gelesen und akzeptiere sie.
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-600 dark:text-green-500">{info}</p>}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !acceptedTerms)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
            >
              {loading ? <BrickLoader /> : mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
            </button>
          </form>
        </Card>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
          className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline mt-4"
        >
          {mode === 'signin' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </button>
      </div>
    </div>
  )
}
