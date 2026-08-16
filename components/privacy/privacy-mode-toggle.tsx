'use client'

import { Eye, EyeOff } from 'lucide-react'
import { usePrivacyMode } from '@/components/privacy/privacy-mode-context'

export function PrivacyModeToggle() {
  const { enabled, toggle } = usePrivacyMode()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? 'Datenschutzmodus deaktivieren' : 'Datenschutzmodus aktivieren (zeigt Demo-Daten statt echter Werte)'}
      aria-pressed={enabled}
      title={enabled ? 'Datenschutzmodus aktiv – Demo-Daten werden angezeigt' : 'Datenschutzmodus aktivieren'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
        enabled
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
      }`}
    >
      {enabled ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )
}
