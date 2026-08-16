// Zentraler Schalter für alle KI-Endpunkte (Beleg-Analyse, Standortrisiko,
// Tipps-Chat). Standardmäßig AUS (auch wenn die Umgebungsvariable fehlt) -
// bewusst so, damit ein vergessener/fehlender Eintrag nie versehentlich KI
// aktiviert. Andi plant eine kostenpflichtige "mit KI"-Stufe (4,99 €/Monat);
// bis die steht, laufen alle drei Endpunkte hart auf "nicht verfügbar",
// ohne dass ein einziger Anthropic-Aufruf stattfindet - echte Kosten von
// null, nicht nur ein niedriges Limit. Zum späteren Aktivieren:
// AI_FEATURES_ENABLED=true setzen (z.B. nur für zahlende Nutzer/eine
// separate Umgebung).
export function aiFeaturesEnabled(): boolean {
  return process.env.AI_FEATURES_ENABLED === 'true'
}

export const AI_DISABLED_MESSAGE = 'Diese KI-Funktion ist in dieser Version noch nicht freigeschaltet.'
