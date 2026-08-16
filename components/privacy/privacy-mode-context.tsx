'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const STORAGE_KEY = 'fimmax-privacy-mode'

const PrivacyModeContext = createContext<{ enabled: boolean; toggle: () => void } | null>(null)

// Erster Render (Server UND Client-Hydration) startet immer mit false -
// alles andere würde einen Hydration-Mismatch verursachen, da der Server
// kein localStorage kennt. Der Effect zieht direkt nach dem Mount nach.
export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  }, [enabled])

  const toggle = () => setEnabled(e => !e)

  return <PrivacyModeContext.Provider value={{ enabled, toggle }}>{children}</PrivacyModeContext.Provider>
}

export function usePrivacyMode() {
  const ctx = useContext(PrivacyModeContext)
  if (!ctx) throw new Error('usePrivacyMode muss innerhalb von PrivacyModeProvider verwendet werden')
  return ctx
}
