'use client'
import { useEffect } from 'react'

// Browser ändern den Wert eines fokussierten type="number"-Felds bei
// Mausrad-Scroll, unabhängig von den (in globals.css ausgeblendeten)
// Spinner-Pfeilen - beim Scrollen über ein ausgefülltes Feld sinkt der
// Betrag sonst ungewollt centweise. Blur beim ersten Scroll-Tick lässt den
// Browser stattdessen normal die Seite scrollen.
export function NoNumberInputScroll() {
  useEffect(() => {
    function onWheel() {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number') el.blur()
    }
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])
  return null
}
