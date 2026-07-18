import { ReactNode } from 'react'

// Gleiches Dach wie im Fimmax.AI-Logo (components/logo.tsx) über einem Wort,
// für konsistentes CI überall, wo "Immobilie(n)" als eigenständiges Wort
// vorkommt. Skaliert automatisch mit der Textgröße (em-Einheiten).
export function Roofed({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <svg className="absolute left-0 top-[0.1042em] w-full aspect-[100/13.4]" viewBox="0 0 100 13.4" aria-hidden="true">
        <path d="M0,13.4 L50,0 L100,13.4" fill="none" stroke="#8f3a1a" strokeWidth="1.15" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </span>
  )
}
