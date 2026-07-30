import { differenceInCalendarMonths } from 'date-fns'
import { Asset } from './types'

export interface NetWorthSummary {
  total_assets: number
  total_property_equity: number
  total_reserves: number
  net_worth: number
  monthly_savings_rate: number
}

// Sparpläne (z.B. Bausparvertrag) mit einer monatlichen Sparrate: statt den
// zuletzt eingetragenen current_value einfrieren zu lassen, bis der Nutzer
// ihn manuell nachträgt, wird er um die seit dem Erfassungsdatum tatsächlich
// vergangenen vollen Monate hochgerechnet (nicht per Kalenderjahr-Differenz -
// sonst würde ein z.B. im November erfasster Wert direkt zum 1. Januar um
// eine volle Jahresrate springen, obwohl erst ein Monat vergangen ist). Der
// Nutzer kann den tatsächlichen Stand bei Kenntnis (z.B. Jahreskontoauszug)
// weiterhin manuell korrigieren.
export function projectedAssetValue(
  asset: Pick<Asset, 'current_value' | 'valuation_date' | 'monthly_contribution'>,
  asOfDate: Date = new Date()
): number {
  if (asset.monthly_contribution <= 0) return asset.current_value
  const monthsPassed = differenceInCalendarMonths(asOfDate, new Date(asset.valuation_date))
  if (monthsPassed <= 0) return asset.current_value
  return asset.current_value + asset.monthly_contribution * monthsPassed
}

export interface AssetFundingCheck {
  projected_value: number
  required_amount: number
  sufficient: boolean
  shortfall: number
}

// Prüft, ob ein Sparplan (z.B. Bausparvertrag) bis zu einem bestimmten
// Termin (typ. das Auszahlungsdatum eines darüber finanzierten Kredits,
// siehe Loan.funded_by_asset_id) hochgerechnet die benötigte Summe erreicht.
export function checkAssetFunding(
  asset: Pick<Asset, 'current_value' | 'valuation_date' | 'monthly_contribution'>,
  requiredAmount: number,
  byDate: Date
): AssetFundingCheck {
  const projected = projectedAssetValue(asset, byDate)
  return {
    projected_value: projected,
    required_amount: requiredAmount,
    sufficient: projected >= requiredAmount,
    shortfall: Math.max(0, requiredAmount - projected),
  }
}

// Rücklagen (Instandhaltungsrücklage kumuliert + eigene Rücklagen für
// Mietausfall/Sonderumlage/Sonstiges) zählen wirtschaftlich als Vermögen -
// es ist dein Geld, auch wenn es (noch) nicht frei verfügbar ist -, werden
// aber bewusst als eigene Zeile geführt statt in "sonstige Anlagen" vermischt.
export interface NetWorthTier {
  min: number
  max: number | null
  title: string
  subtitle: string
}

// Rein zur Auflockerung im Dashboard: niemand wird durch eine einzelne
// vermietete Immobilie "in 30 Jahren finanziell unabhängig" - die Stufen
// sollen den tatsächlichen (meist bescheidenen, langsamen) Fortschritt
// selbstironisch einordnen statt ihn zu beschönigen. Grenzen bewusst grob
// gerundet (keine Feinjustierung nötig für einen Spaß-Indikator).
export const NET_WORTH_TIERS: NetWorthTier[] = [
  { min: 0, max: 100_000, title: 'Sparschwein mit Ambitionen', subtitle: 'Der Anfang ist gemacht.' },
  { min: 100_000, max: 250_000, title: 'Erste Bude', subtitle: 'Ein Dach, viele Träume.' },
  { min: 250_000, max: 500_000, title: 'Häuslebauer', subtitle: 'Die Nachbarn grüßen jetzt zurück.' },
  { min: 500_000, max: 750_000, title: 'Zinshaus-Azubi', subtitle: 'Der Steuerberater kennt jetzt deinen Namen.' },
  { min: 750_000, max: 1_000_000, title: 'Fast-Millionär', subtitle: 'Auf der Zielgeraden zur siebten Stelle.' },
  { min: 1_000_000, max: 2_000_000, title: 'Millionär (Einsteigermodell)', subtitle: 'Willkommen im Club - hinterer Eingang.' },
  { min: 2_000_000, max: 5_000_000, title: 'Monopoly-Fortgeschritten', subtitle: 'Erste eigene Straßenzüge.' },
  { min: 5_000_000, max: 10_000_000, title: 'Straßenzug-Sammler', subtitle: 'Fehlt nur noch das Hotel.' },
  { min: 10_000_000, max: 50_000_000, title: 'Stadtviertel-Tycoon', subtitle: 'Du bist quasi die Hausverwaltung der Stadt.' },
  { min: 50_000_000, max: 100_000_000, title: 'Schlossallee-Niveau', subtitle: 'Die teuerste Straße im Spiel gehört jetzt dir.' },
  { min: 100_000_000, max: null, title: 'Dagobert-Liga', subtitle: 'Zeit für einen eigenen Geldspeicher.' },
]

export function netWorthTier(netWorth: number): { index: number; total: number; tier: NetWorthTier } {
  const clamped = Math.max(0, netWorth)
  const index = NET_WORTH_TIERS.findIndex(t => t.max == null || clamped < t.max)
  const safeIndex = index === -1 ? NET_WORTH_TIERS.length - 1 : index
  return { index: safeIndex, total: NET_WORTH_TIERS.length, tier: NET_WORTH_TIERS[safeIndex] }
}

export function aggregateNetWorth(assets: Asset[], propertyEquity: number, totalReserves: number = 0): NetWorthSummary {
  const totalAssets = assets.reduce((s, a) => s + projectedAssetValue(a), 0)
  const monthlySavingsRate = assets.reduce((s, a) => s + a.monthly_contribution, 0)
  return {
    total_assets: totalAssets,
    total_property_equity: propertyEquity,
    total_reserves: totalReserves,
    net_worth: totalAssets + propertyEquity + totalReserves,
    monthly_savings_rate: monthlySavingsRate,
  }
}
