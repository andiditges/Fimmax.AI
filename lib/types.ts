export type ReceiptCategory =
  | 'instandhaltung'
  | 'verwaltung'
  | 'versicherung'
  | 'grundsteuer'
  | 'zinsen'
  | 'hausgeld'
  | 'sonstiges'

export const CATEGORY_LABELS: Record<ReceiptCategory, string> = {
  instandhaltung: 'Instandhaltung',
  verwaltung: 'Verwaltung',
  versicherung: 'Versicherung',
  grundsteuer: 'Grundsteuer',
  zinsen: 'Schuldzinsen',
  hausgeld: 'Hausgeld / WEG',
  sonstiges: 'Sonstiges',
}

export interface Property {
  id: string
  address: string
  unit: string | null
  unit_label: string | null
  purchase_date: string
  purchase_price: number
  current_value: number | null
  incidental_costs: number
  land_value: number
  building_value: number
  build_year: number
  afa_rate: number
  usage_duration: number
  is_self_managed: boolean
  created_at: string
}

export interface Tenant {
  id: string
  property_id: string
  name: string
  unit: string | null
  move_in_date: string
  move_out_date: string | null
  rent_base: number
  advance_payment: number
}

export interface Receipt {
  id: string
  property_id: string
  file_url: string | null
  receipt_date: string
  amount: number
  vendor: string | null
  description: string | null
  category: ReceiptCategory
  is_renovation: boolean
  ai_confidence: number | null
  tax_year: number
  created_at: string
}

export interface IncomeRecord {
  id: string
  property_id: string
  tenant_id: string | null
  date: string
  amount: number
  type: 'miete' | 'nebenkosten' | 'sonstiges'
}

export interface RentalAgreement {
  id: string
  property_id: string
  tenant_id: string | null
  rent_amount: number
  start_date: string
  created_at: string
}

export interface RentAdjustment {
  id: string
  tenant_id: string
  month: string
  override_amount: number
  note: string | null
  created_at: string
}

export interface RentScheduleEntry {
  month: string
  amount: number
  is_override: boolean
  note: string | null
}

export interface ThresholdStatus {
  renovation_total: number
  threshold_15: number
  percentage: number
  within_3_years: boolean
  alert_level: 'safe' | 'warning' | 'danger' | 'exceeded'
}

export type ReminderCategory =
  | 'mieterhoehung'
  | 'eigentuemerversammlung'
  | 'hausverwaltung'
  | 'instandhaltung'
  | 'sonstiges'

export const REMINDER_CATEGORY_LABELS: Record<ReminderCategory, string> = {
  mieterhoehung: 'Mieterhöhung',
  eigentuemerversammlung: 'Eigentümerversammlung',
  hausverwaltung: 'Hausverwaltung',
  instandhaltung: 'Instandhaltung',
  sonstiges: 'Sonstiges',
}

export type ReminderStatus = 'offen' | 'in_arbeit' | 'erledigt'

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  offen: 'Offen',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
}

export interface Reminder {
  id: string
  property_id: string
  title: string
  description: string | null
  category: ReminderCategory
  due_date: string | null
  status: ReminderStatus
  depends_on_id: string | null
  created_at: string
}

export type HoaResolutionStatus = 'offen' | 'in_umsetzung' | 'umgesetzt'

export const HOA_RESOLUTION_STATUS_LABELS: Record<HoaResolutionStatus, string> = {
  offen: 'Offen',
  in_umsetzung: 'In Umsetzung',
  umgesetzt: 'Umgesetzt',
}

export interface HoaDocument {
  id: string
  property_id: string
  title: string
  meeting_date: string | null
  year: number
  file_url: string | null
  created_at: string
}

export interface HoaResolution {
  id: string
  property_id: string
  hoa_document_id: string | null
  year: number
  title: string
  description: string | null
  status: HoaResolutionStatus
  created_at: string
}

export interface NewsItem {
  title: string
  link: string
  source: string | null
  pub_date: string | null
}

export type AssetCategory =
  | 'wertpapiere'
  | 'tagesgeld_festgeld'
  | 'bausparvertrag'
  | 'vl_vertrag'
  | 'rentenversicherung'
  | 'sonstiges'

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  wertpapiere: 'Wertpapiere (Aktien/ETFs/Fonds)',
  tagesgeld_festgeld: 'Tagesgeld/Festgeld',
  bausparvertrag: 'Bausparvertrag',
  vl_vertrag: 'VL-Vertrag',
  rentenversicherung: 'Rentenversicherung/Altersvorsorge',
  sonstiges: 'Sonstiges',
}

export interface Asset {
  id: string
  category: AssetCategory
  name: string
  institution: string | null
  current_value: number
  monthly_contribution: number
  valuation_date: string
  note: string | null
  created_at: string
}

export type PaymentFrequency = 'monatlich' | 'vierteljährlich' | 'jährlich'
export type DayCountConvention = 'act/365' | '30/360'

export interface Loan {
  id: string
  property_id: string
  name: string
  lender: string | null
  principal: number
  nominal_interest_rate: number
  disbursement_date: string
  initial_fixed_period_years: number | null
  initial_repayment_rate: number | null
  annuity_amount: number
  payment_frequency: PaymentFrequency
  day_count_convention: DayCountConvention
  planned_renovation_amount: number | null
  interest_only_months: number | null
  created_at: string
}

export interface LoanSpecialPayment {
  id: string
  loan_id: string
  payment_date: string
  amount: number
  note: string | null
  created_at: string
}

export interface AmortizationEntry {
  date: string
  days_in_period: number
  interest_accrued: number
  scheduled_principal: number
  special_payment: number
  total_payment: number
  remaining_balance: number
}

export interface AmortizationResult {
  entries: AmortizationEntry[]
  payoff_date: string | null
  balance_at_fixed_period_end: number | null
  warning: 'negative_amortization' | null
}

export interface LoanStatus {
  as_of_date: string
  remaining_balance: number
  cumulative_interest_paid: number
  cumulative_principal_paid: number
  next_payment_date: string | null
  current_annuity_amount: number
}

export interface PortfolioFinancialSummary {
  as_of_date: string
  total_debt: number
  total_property_value: number
  total_equity: number
  monthly_debt_service: number
  monthly_rent_income: number
  monthly_operating_cost_runrate: number
  monthly_net_cashflow: number
  loans: LoanStatus[]
}

export interface DailyRateBreakdown {
  as_of_date: string
  period_start: string
  period_end: string
  days_in_period: number
  daily_interest: number
  daily_principal: number
  daily_total: number
}

export interface TodayCashflowSnapshot {
  as_of_date: string
  days_elapsed_in_month: number
  rent_so_far: number
  interest_so_far: number
  principal_so_far: number
  operating_cost_so_far: number
  remaining_so_far: number
  daily_interest_total: number
  daily_principal_total: number
  daily_debt_service_total: number
}

export interface DailyRatePoint {
  date: string
  daily_interest: number
  daily_principal: number
}

export type OperatingCostCategory =
  | 'grundsteuer'
  | 'wasser'
  | 'abwasser'
  | 'heizung'
  | 'warmwasser'
  | 'aufzug'
  | 'strassenreinigung_gewerbemuell'
  | 'restmuell_privat'
  | 'gebaeudereinigung_ungeziefer'
  | 'gartenpflege'
  | 'allgemeinstrom'
  | 'schornsteinreinigung'
  | 'sach_haftpflichtversicherung'
  | 'hauswart'
  | 'gemeinschaftsantenne_kabel'
  | 'wascheinrichtung'
  | 'sonstige_umlagefaehig'
  | 'verwaltungskosten'
  | 'instandhaltung'
  | 'ruecklage_zufuehrung'
  | 'bankgebuehren'
  | 'mietausfallwagnis'
  | 'rechtsverfolgungskosten'
  | 'sonstige_nicht_umlagefaehig'

export interface OperatingCost {
  id: string
  property_id: string
  year: number
  category: OperatingCostCategory
  amount: number
  allocable_to_tenant: boolean
  note: string | null
  created_at: string
}

export interface UtilitySettlement {
  id: string
  property_id: string
  year: number
  total_costs: number | null
  source_file_url: string | null
  status: 'draft' | 'sent'
  created_at: string
}
