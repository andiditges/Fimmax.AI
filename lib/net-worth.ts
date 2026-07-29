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
// ihn manuell nachträgt, wird er zu jedem 01.01. nach dem Erfassungsdatum um
// eine volle Jahresrate (12 x monatliche Sparrate) hochgerechnet - bewusst
// als einfacher Jahres-Sprung zum Jahreswechsel statt taggenauer/unterjähriger
// Verzinsung, da das für die grobe Vermögensübersicht ausreicht und der
// Nutzer den tatsächlichen Stand bei Kenntnis (z.B. Jahreskontoauszug)
// weiterhin manuell korrigieren kann.
export function projectedAssetValue(
  asset: Pick<Asset, 'current_value' | 'valuation_date' | 'monthly_contribution'>,
  asOfDate: Date = new Date()
): number {
  if (asset.monthly_contribution <= 0) return asset.current_value
  const yearsPassed = asOfDate.getFullYear() - new Date(asset.valuation_date).getFullYear()
  if (yearsPassed <= 0) return asset.current_value
  return asset.current_value + asset.monthly_contribution * 12 * yearsPassed
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
