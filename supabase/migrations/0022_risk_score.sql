-- Standort-Risikoeinschätzung je Immobilie (KI-gestützt, manuell per Button
-- angestoßen statt automatisch bei jedem Seitenaufruf - Adressen ändern sich
-- praktisch nie, und jede Neubewertung kostet einen Claude-API-Call).
alter table properties add column risk_score numeric(3,1);
alter table properties add column risk_summary text;
alter table properties add column risk_factors jsonb;
alter table properties add column risk_assessed_at timestamptz;
