import { Bundesland } from './types'

// Grunderwerbsteuersätze der 16 Bundesländer, Stand 2026. Ändert sich
// gelegentlich per Landesgesetz (z.B. Sachsen 01.01.2023 3,5% -> 5,5%,
// Thüringen 01.01.2024 6,5% -> 5,0%, Bremen 01.07.2025 5,0% -> 5,5%) –
// bei einer künftigen Änderung hier den Satz anpassen.
export const GRUNDERWERBSTEUER_RATES: Record<Bundesland, number> = {
  'Bayern': 3.5,
  'Sachsen': 5.5,
  'Baden-Württemberg': 5.0,
  'Bremen': 5.5,
  'Hamburg': 5.5,
  'Niedersachsen': 5.0,
  'Rheinland-Pfalz': 5.0,
  'Sachsen-Anhalt': 5.0,
  'Thüringen': 5.0,
  'Berlin': 6.0,
  'Hessen': 6.0,
  'Mecklenburg-Vorpommern': 6.0,
  'Brandenburg': 6.5,
  'Nordrhein-Westfalen': 6.5,
  'Saarland': 6.5,
  'Schleswig-Holstein': 6.5,
}

export const BUNDESLAND_LIST: Bundesland[] = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg',
  'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen',
  'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
]

export function calcGrunderwerbsteuer(taxableBase: number, bundesland: Bundesland): number {
  return Math.round(Math.max(0, taxableBase) * (GRUNDERWERBSTEUER_RATES[bundesland] / 100) * 100) / 100
}

// Photon/OSM liefert bei deutschen Adressen i.d.R. den offiziellen
// Bundesland-Namen im properties.state-Feld – 1:1-Abgleich gegen unsere
// Liste, ohne Match wird nichts automatisch gesetzt (Nutzer wählt manuell).
export function matchBundesland(raw: string): Bundesland | null {
  const trimmed = raw.trim()
  return BUNDESLAND_LIST.find(b => b === trimmed) ?? null
}
