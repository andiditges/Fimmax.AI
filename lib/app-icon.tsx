// Geteilte Grafik für alle generierten App-Icons (Browser-Tab, iOS-Homescreen,
// PWA-Manifest): die mittleren Elemente "imm" mit dem Dach aus dem Logo
// (components/logo.tsx), auf weißem Grund - erkennbar auch als kleines Icon,
// anders als der volle Schriftzug "Fimmax.AI".
export function AppIconElement({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.46)
  const iWidth = fontSize * 0.3
  const mmWidth = fontSize * 1.05
  const roofHeight = fontSize * 0.16

  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: size * 0.24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', width: iWidth + mmWidth, height: roofHeight }}>
          <div style={{ display: 'flex', width: iWidth }} />
          <svg width={mmWidth} height={roofHeight} viewBox="0 0 100 13.4" style={{ display: 'flex' }}>
            <path d="M0,13.4 L50,0 L100,13.4" fill="none" stroke="#8f3a1a" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', fontSize, fontWeight: 700, color: '#1d4ed8', fontFamily: 'sans-serif', lineHeight: 1, marginTop: fontSize * 0.03 }}>
          imm
        </div>
      </div>
    </div>
  )
}
