'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { PrivacyModeProvider } from '@/components/privacy/privacy-mode-context'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyModeProvider>{children}</PrivacyModeProvider>
    </ThemeProvider>
  )
}
