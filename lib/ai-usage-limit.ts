import { SupabaseClient } from '@supabase/supabase-js'

// Beta-Kostenschutz, zweistufig: Tageslimit pro Nutzer + geteiltes
// Monats-Gesamtlimit über alle Nutzer (schützt das knappe, manuell gesetzte
// Anthropic-Spend-Limit). Beide Grenzen werden atomar in einer einzigen
// Postgres-Funktion geprüft (try_consume_ai_quota, siehe Migration 0041) -
// kein Zeitfenster für eine Race Condition zwischen Zählen und Eintragen.
// Die konkreten Zahlen sind eine bewusst vorsichtige erste Einschätzung,
// keine exakte Kostenrechnung - in der Anthropic Console beobachten und bei
// Bedarf anpassen.
const LIMITS = {
  analyze_receipt: { userDaily: 15, globalMonthly: 150 },
  tips_ask: { userDaily: 10, globalMonthly: 100 },
  property_risk: { userDaily: 5, globalMonthly: 50 },
} as const

export type AiEndpoint = keyof typeof LIMITS

export async function checkAiUsageLimit(
  supabase: SupabaseClient,
  _userId: string,
  endpoint: AiEndpoint
): Promise<boolean> {
  const { userDaily, globalMonthly } = LIMITS[endpoint]
  const { data, error } = await supabase.rpc('try_consume_ai_quota', {
    p_endpoint: endpoint,
    p_user_daily_limit: userDaily,
    p_global_monthly_limit: globalMonthly,
  })
  if (error) {
    console.error('AI-Kontingent-Prüfung fehlgeschlagen:', error)
    return false
  }
  return data === true
}
