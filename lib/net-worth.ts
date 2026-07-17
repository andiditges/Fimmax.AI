import { Asset } from './types'

export interface NetWorthSummary {
  total_assets: number
  total_property_equity: number
  net_worth: number
  monthly_savings_rate: number
}

export function aggregateNetWorth(assets: Asset[], propertyEquity: number): NetWorthSummary {
  const totalAssets = assets.reduce((s, a) => s + a.current_value, 0)
  const monthlySavingsRate = assets.reduce((s, a) => s + a.monthly_contribution, 0)
  return {
    total_assets: totalAssets,
    total_property_equity: propertyEquity,
    net_worth: totalAssets + propertyEquity,
    monthly_savings_rate: monthlySavingsRate,
  }
}
