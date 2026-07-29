// Halbkreis-Meter (Gauge-Optik): Füllung = Akzentfarbe, Track = hellere Stufe
// derselben Farbe. Als Halbkreis statt Vollkreis, damit mehrere Gauges
// nebeneinander (Portfolio-Übersicht je Immobilie) kompakter wirken - analog
// zu gängigen Loan-to-Value-Dashboards.
export function Ring({
  percent, size = 96, label, color = '#2563eb', trackColor = '#dbeafe', ariaLabel, detail,
}: {
  percent: number
  size?: number
  label: string
  color?: string
  trackColor?: string
  ariaLabel: string
  detail?: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const strokeWidth = Math.round(size * 0.14)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const half = circumference / 2
  const fillLength = half * (clamped / 100)
  const arcHeight = size / 2 + strokeWidth / 2
  // Halbkreis-Trick über einen Vollkreis statt eines echten Halbkreis-Bogens:
  // eine SVG-Arc mit exakt 180° ist ein Grenzfall, bei dem large-arc-flag
  // nicht mehr eindeutig ist und pathLength/dasharray in der Praxis falsche
  // Füllstände erzeugen kann. Ein Vollkreis mit bekannter Circumference ist
  // robust - dashoffset=half verankert den sichtbaren Bereich am linken
  // Punkt, dasharray begrenzt seine Länge, und der Container zeigt per
  // overflow:hidden nur die obere Hälfte (linker Punkt → oben → rechter
  // Punkt liegt geometrisch exakt in dieser oberen Hälfte).
  return (
    <div className="inline-flex flex-col items-center shrink-0" style={{ width: size }} role="img" aria-label={ariaLabel}>
      <div style={{ width: size, height: arcHeight, overflow: 'hidden' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={trackColor} strokeWidth={strokeWidth}
            strokeDasharray={`${half} ${circumference - half}`}
            strokeDashoffset={half}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${fillLength} ${circumference - fillLength}`}
            strokeDashoffset={half}
            style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>
      </div>
      <div className="flex flex-col items-center text-center w-full -mt-1">
        <span className="font-bold text-gray-900" style={{ fontSize: size * 0.24 }}>{clamped.toFixed(0)}%</span>
        <span className="text-gray-400 truncate max-w-full" style={{ fontSize: size * 0.1 }}>{label}</span>
        {detail && <span className="text-gray-400 truncate max-w-full" style={{ fontSize: size * 0.085 }}>{detail}</span>}
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
