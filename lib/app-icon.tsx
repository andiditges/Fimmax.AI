// Geteilte Grafik für alle generierten App-Icons (Browser-Tab, iOS-Homescreen,
// PWA-Manifest): die mittleren Elemente "imm" mit dem Dach aus dem Logo
// (components/logo.tsx), auf weißem Grund - erkennbar auch als kleines Icon,
// anders als der volle Schriftzug "Fimmax.AI".
export function AppIconElement({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.46)
  const roofHeight = fontSize * 0.16
  const roofDrawHeight = fontSize * 0.08
  // Wie tief das Dach über die reservierte Dach-Zeile hinaus nach unten in die
  // "imm"-Zeile hineinreicht, damit die Spitze unter den Punkt des "i" rutscht.
  // "i" und Dach überlappen sich horizontal nicht (Dach sitzt nur über "mm"),
  // ein vertikales Hineinreichen in die Textzeile ist daher unproblematisch,
  // solange die Basis oberhalb der "mm"-Balken (x-Höhe) bleibt.
  const roofDepth = fontSize * 0.36
  const textStyle = { display: 'flex', fontSize, fontWeight: 700, fontFamily: 'sans-serif', lineHeight: 1 } as const

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
        {/* Breite von "i" und "mm" wird über unsichtbaren Text derselben
            Schriftgröße gemessen statt geschätzt, damit das Dach exakt über
            beide "m" sitzt, egal welche Zeichenbreiten die Render-Engine nutzt. */}
        <div style={{ display: 'flex', flexDirection: 'row', height: roofHeight, overflow: 'visible' }}>
          <div style={{ ...textStyle, opacity: 0 }}>i</div>
          <div style={{ position: 'relative', display: 'flex' }}>
            <div style={{ ...textStyle, opacity: 0 }}>mm</div>
            {/* overflow:visible auf der Dach-Zeile + top über roofHeight hinaus,
                damit das Dach in die "imm"-Zeile hineinreichen kann, ohne deren
                Position zu verschieben (die Zeilenhöhe roofHeight bleibt für
                die Flex-Berechnung unverändert). */}
            <svg
              style={{ position: 'absolute', left: 0, top: roofHeight - roofDrawHeight + roofDepth, width: '100%', height: roofDrawHeight }}
              viewBox="0 0 100 13.4"
            >
              <path d="M0,13.4 L50,0 L100,13.4" fill="none" stroke="#8f3a1a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div style={{ ...textStyle, color: '#8f3a1a', marginTop: fontSize * 0.03 }}>
          imm
        </div>
      </div>
    </div>
  )
}
