-- Spenden und Fortbildungskosten sind nicht objektgebunden und keine
-- Vermietungs-Werbungskosten (Spenden = Sonderausgaben, Fortbildung
-- objektübergreifend) - landeten bisher gar nicht bzw. fälschlich unter
-- "Sonstiges" in der Anlage-V-Summe eines einzelnen Objekts. Eigene
-- Kategorien, die lib/tax-export.ts bewusst von der Werbungskosten-Summe
-- ausschließt (siehe dort) - rein zu Dokumentationszwecken in der Belege-Liste.
alter type receipt_category add value 'spenden';
alter type receipt_category add value 'fortbildung';
