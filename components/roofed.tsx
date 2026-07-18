import { ReactNode } from 'react'

// Gleiches Dach-Motiv wie im Fimmax.AI-Logo (components/logo.tsx) über einem
// Wort, für konsistentes CI überall, wo "Immobilie(n)" als eigenständiges
// Wort vorkommt. Anders als im Logo (fixes Seitenverhältnis über 2 Buchstaben)
// braucht es hier eine von der Wortbreite unabhängige, feste Höhe relativ zur
// Schriftgröße (em) – sonst würde das Dach bei längeren Wörtern viel zu hoch
// und mitten durch den Text laufen. preserveAspectRatio="none" erlaubt genau
// das: Breite folgt dem Wort, Höhe bleibt fix.
export function Roofed({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <svg
        className="absolute left-0 w-full"
        style={{ top: '-0.28em', height: '0.26em' }}
        viewBox="0 0 100 13.4"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,13.4 L50,0 L100,13.4" fill="none" stroke="#8f3a1a" strokeWidth="1.15" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </span>
  )
}
