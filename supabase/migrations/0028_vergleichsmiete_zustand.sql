-- Manuelle Vergleichsmiete + Objektzustand.
--
-- Bewusst KEINE automatisch berechnete "ortsübliche Vergleichsmiete": es
-- gibt keine verlässliche, bundesweit aktuelle, maschinenlesbare Mietspiegel-
-- Datenbank (echte Mietspiegel existieren nur für Gemeinden, die einen
-- veröffentlicht haben, meist größere Städte). Erfundene Werte wären hier
-- gefährlich - zu hoch angesetzt drohen Probleme wegen Mietpreisüberhöhung
-- (§ 5 WiStrG), zu niedrig verschenkt der Vermieter Geld. Der Nutzer trägt
-- daher selbst ein, was er im für sein Objekt gültigen Mietspiegel oder bei
-- Vergleichsobjekten recherchiert hat.

alter table properties add column living_area_sqm numeric(6,2);
alter table properties add column comparable_rent_min numeric(6,2);
alter table properties add column comparable_rent_max numeric(6,2);
alter table properties add column comparable_rent_source text;
alter table properties add column comparable_rent_as_of date;

-- Zustand je Gewerk (die vier klassischen "FESH"-Gewerke: Fenster, Elektro,
-- Sanitär/Bad, Heizung) - hilft beim eigenen Einordnen innerhalb der
-- Vergleichsmieten-Spanne, ohne dass die App selbst eine Bewertung erfindet.
create type property_condition_grade as enum ('alt', 'teilmodernisiert', 'neuwertig');

alter table properties add column condition_windows property_condition_grade;
alter table properties add column condition_electrical property_condition_grade;
alter table properties add column condition_bathroom property_condition_grade;
alter table properties add column condition_heating property_condition_grade;
alter table properties add column renovation_note text;
