// Radialer Meter (Energiekreis-Optik): zeigt den Anteil der ursprünglichen
// Kreditsumme, der bereits getilgt ist. Füllung = Akzentfarbe, Track = hellere
// Stufe derselben Farbe (gleicher Rahmen wie ein linearer Meter, nur radial).
export function TilgungRing({ percent, size = 96 }: { percent: number; size?: number }) {
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
      aria-label={`${clamped.toFixed(0)} Prozent des ursprünglichen Kreditvolumens getilgt`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#dbeafe" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-gray-900" style={{ fontSize: size * 0.22 }}>{clamped.toFixed(0)}%</span>
        <span className="text-gray-400" style={{ fontSize: size * 0.09 }}>getilgt</span>
      </div>
    </div>
  )
}
