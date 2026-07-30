-- Geschätzte jährliche Betriebskosten je Immobilie (umlagefähig/nicht-
-- umlagefähig getrennt) - Fallback für die Cashflow-Laufrate, solange noch
-- keine reale Jahresabrechnung im Nebenkostenassistenten (operating_costs)
-- erfasst ist. Ersetzt für die Cashflow-Berechnung die grobe Schätzung aus
-- den letzten 12 Monaten hochgeladener Belege, sobald gesetzt (siehe
-- aggregatePortfolioFinancials in lib/amortization.ts).
alter table properties add column expected_allocable_operating_cost_annual numeric(10,2);
alter table properties add column expected_non_allocable_operating_cost_annual numeric(10,2);
