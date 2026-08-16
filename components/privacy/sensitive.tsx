'use client'

import { usePrivacyMode } from '@/components/privacy/privacy-mode-context'
import { fakeName, fakeAddress, fakeAmount } from '@/lib/privacy'
import { euro } from '@/lib/format'

type Kind = 'name' | 'address'

const FAKERS: Record<Kind, (seed: string) => string> = {
  name: fakeName,
  address: fakeAddress,
}

// Zeigt `value` normal an - im Datenschutz-/Demomodus stattdessen einen
// deterministischen Fake-Wert (gleiche `seed` => gleicher Fake-Wert überall).
export function Sensitive({ kind, seed, value }: { kind: Kind; seed: string; value: string }) {
  const { enabled } = usePrivacyMode()
  return <>{enabled ? FAKERS[kind](seed) : value}</>
}

export function SensitiveEuro({ seed, amount }: { seed: string; amount: number }) {
  const { enabled } = usePrivacyMode()
  return <>{euro(enabled ? fakeAmount(seed, amount) : amount)}</>
}
