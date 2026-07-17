-- Kaufnebenkosten (Notar, Grundbuch, Grunderwerbsteuer, ggf. Maklerprovision)
-- zählen zu den Anschaffungskosten und erhöhen die AfA-Bemessungsgrundlage.
-- Werden anteilig nach dem Grundstück/Gebäude-Verhältnis auf building_value
-- verteilt (siehe app/properties/new/page.tsx); diese Spalte ist der
-- Referenzwert, der bei der Eingabe eingerechnet wurde.
alter table properties add column incidental_costs numeric(12,2) not null default 0;
