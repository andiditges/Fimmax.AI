-- Bezeichnung bei Vermögenswerten ist nicht für jede Kategorie sinnvoll
-- (z.B. bei einem einzelnen Tagesgeldkonto) - daher optional statt Pflichtfeld.
alter table assets alter column name drop not null;
