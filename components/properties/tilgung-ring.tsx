// Radialer Meter (Energiekreis-Optik): Füllung = Akzentfarbe, Track = hellere
// Stufe derselben Farbe (gleicher Rahmen wie ein linearer Meter, nur radial).
export function Ring({
  percent, size = 96, label, color = '#2563eb', trackColor = '#dbeafe', ariaLabel,
}: {
  percent: number
  size?: number
  label: string
  color?: string
  trackColor?: string
  ariaLabel: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const strokeWidth = Math.round(size * 0.1)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-gray-900" style={{ fontSize: size * 0.22 }}>{clamped.toFixed(0)}%</span>
        <span className="text-gray-400" style={{ fontSize: size * 0.09 }}>{label}</span>
      </div>
    </div>
  )
}

export function TilgungRing({ percent, size = 96 }: { percent: number; size?: number }) {
  return (
    <Ring
      percent={percent}
      size={size}
      label="getilgt"
      color="#2563eb"
      trackColor="#dbeafe"
      ariaLabel={`${Math.max(0, Math.min(100, percent)).toFixed(0)} Prozent des ursprünglichen Kreditvolumens getilgt`}
    />
  )
}

// LTV (Loan-to-Value / Beleihungsauslauf) = Restschuld / Immobilienwert.
// Farbe nach Risiko-Schwelle statt immer gleicher Akzentfarbe, da hier -
// anders als bei der Tilgung - "höher" nicht automatisch "besser" bedeutet:
// grün bis 60% (typ. Grenze für die besten Konditionen), gelb bis 80%
// (normale Finanzierung), rot darüber (höheres Risiko bei Wertverfall/
// Anschlussfinanzierung). Faustregel, keine Bankvorgabe.
export function ltvColor(ltvPercent: number): { color: string; trackColor: string } {
  if (ltvPercent <= 60) return { color: '#16a34a', trackColor: '#dcfce7' }
  if (ltvPercent <= 80) return { color: '#d97706', trackColor: '#fef3c7' }
  return { color: '#dc2626', trackColor: '#fee2e2' }
}

export function LtvRing({ percent, size = 96 }: { percent: number; size?: number }) {
  const { color, trackColor } = ltvColor(percent)
  return (
    <Ring
      percent={percent}
      size={size}
      label="LTV"
      color={color}
      trackColor={trackColor}
      ariaLabel={`Beleihungsauslauf (LTV) ${Math.max(0, Math.min(100, percent)).toFixed(0)} Prozent`}
    />
  )
}
