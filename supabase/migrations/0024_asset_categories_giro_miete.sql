-- Girokonto und Mietkonto als eigene Vermögenswert-Kategorien ergänzen
-- (bisher liefen diese nur unter "Sonstiges").
alter type asset_category add value 'girokonto';
alter type asset_category add value 'mietkonto';
