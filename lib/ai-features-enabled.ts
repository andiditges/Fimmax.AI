// Zentrale Freischaltungs-Logik für alle KI-Endpunkte (Beleg-Analyse,
// Standortrisiko, Tipps-Chat). Standardmäßig AUS für alle - bewusst so,
// damit ein vergessener/fehlender Eintrag nie versehentlich KI aktiviert.
// Zwei Wege, KI zu aktivieren:
//   1. AI_FEATURES_ENABLED=true - global für ALLE Nutzer (für die geplante
//      kostenpflichtige "mit KI"-Stufe)
//   2. AI_FEATURES_ALLOWED_EMAILS - Komma-getrennte Liste einzelner
//      E-Mail-Adressen, die KI unabhängig vom globalen Schalter nutzen
//      dürfen (z.B. Andis eigener Account zum Testen, während der Rest der
//      Beta noch ohne KI läuft)
export function isAiEnabledForUser(email: string | null | undefined): boolean {
  if (process.env.AI_FEATURES_ENABLED === 'true') return true
  if (!email) return false
  const allowList = (process.env.AI_FEATURES_ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return allowList.includes(email.toLowerCase())
}

export const AI_DISABLED_MESSAGE = 'Diese KI-Funktion ist in dieser Version noch nicht freigeschaltet.'
