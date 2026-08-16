'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln'}
      aria-pressed={isDark}
      className="relative inline-flex h-8 w-14 items-center rounded-full bg-amber-100 dark:bg-indigo-950 border border-amber-200 dark:border-indigo-800 transition-colors"
    >
      <Sun size={13} className="absolute left-1.5 text-amber-500" />
      <Moon size={13} className="absolute right-1.5 text-indigo-300" />
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-7' : 'translate-x-1'}`}
      >
        {isDark ? <Moon size={13} className="text-indigo-600" /> : <Sun size={13} className="text-amber-500" />}
      </span>
    </button>
  )
}
