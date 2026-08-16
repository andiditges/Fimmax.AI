'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'fimmax-theme'

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null)

// Erster Render (Server UND Client-Hydration) startet immer mit 'light' -
// alles andere würde einen Hydration-Mismatch verursachen, da der Server
// kein localStorage/matchMedia kennt. Das Blocking-Script in app/layout.tsx
// setzt data-theme auf <html> bereits vor dem ersten Paint korrekt (dafür
// sorgt suppressHydrationWarning dort), dieser State hier zieht per Effect
// direkt nach dem Mount nach - kurzes Icon-Flackern statt Hydration-Fehler.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const initial = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(initial)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme muss innerhalb von ThemeProvider verwendet werden')
  return ctx
}
