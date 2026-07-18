-- Bundesland des Kaufs + automatisch daraus berechnete Grunderwerbsteuer.

create type bundesland as enum (
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg',
  'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen',
  'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'
);

alter table properties add column bundesland bundesland;
alter table properties add column grunderwerbsteuer numeric(12,2);
