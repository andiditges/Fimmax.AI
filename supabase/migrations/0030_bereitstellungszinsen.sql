-- Bereitstellungszinsen: Banken berechnen ab Ende der "bereitstellungsfreien
-- Zeit" (typ. 2-12 Monate nach Vertragsschluss) bis zur tatsächlichen
-- Auszahlung Zinsen auf den noch nicht abgerufenen Darlehensbetrag - relevant
-- v.a. bei Bauzeit/Kaufabwicklung mit verzögerter Auszahlung. Rechnerisch aus
-- Vertragsdatum, bereitstellungsfreier Zeit und Satz ermittelt (siehe
-- lib/amortization.ts calcBereitstellungszinsen), nicht separat gespeichert.

alter table loans add column contract_date date;
alter table loans add column bereitstellungszins_rate numeric(5,2);
alter table loans add column bereitstellungsfreie_monate integer;
