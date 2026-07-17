-- Optionales Feld zur Unterscheidung mehrerer Wohneinheiten an derselben Adresse
-- (z.B. mehrere Eigentumswohnungen im selben Mehrfamilienhaus).
alter table properties add column unit text;
