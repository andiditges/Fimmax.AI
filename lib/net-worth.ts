import { Asset } from './types'

export interface NetWorthSummary {
  total_assets: number
  total_property_equity: number
  total_reserves: number
  net_worth: number
  monthly_savings_rate: number
}

// Rücklagen (Instandhaltungsrücklage kumuliert + eigene Rücklagen für
// Mietausfall/Sonderumlage/Sonstiges) zählen wirtschaftlich als Vermögen -
// es ist dein Geld, auch wenn es (noch) nicht frei verfügbar ist -, werden
// aber bewusst als eigene Zeile geführt statt in "sonstige Anlagen" vermischt.
export function aggregateNetWorth(assets: Asset[], propertyEquity: number, totalReserves: number = 0): NetWorthSummary {
  const totalAssets = assets.reduce((s, a) => s + a.current_value, 0)
  const monthlySavingsRate = assets.reduce((s, a) => s + a.monthly_contribution, 0)
  return {
    total_assets: totalAssets,
    total_property_equity: propertyEquity,
    total_reserves: totalReserves,
    net_worth: totalAssets + propertyEquity + totalReserves,
    monthly_savings_rate: monthlySavingsRate,
  }
}
