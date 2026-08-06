-- Müllgebühren fehlten bisher als eigene Kategorie und landeten fälschlich
-- unter "Sonstiges" - z.B. bei einem kombinierten Grundsteuer+Abfall-Bescheid
-- nicht von der Grundsteuer unterscheidbar.
alter type receipt_category add value 'abfall';
