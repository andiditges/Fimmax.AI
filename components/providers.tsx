'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { PrivacyModeProvider } from '@/components/privacy/privacy-mode-context'
import { NoNumberInputScroll } from '@/components/no-number-input-scroll'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyModeProvider>
        <NoNumberInputScroll />
        {children}
      </PrivacyModeProvider>
    </ThemeProvider>
  )
}
