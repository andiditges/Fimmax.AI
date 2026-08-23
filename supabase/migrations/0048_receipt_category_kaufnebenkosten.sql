-- Grunderwerbsteuer, Notar, Grundbuch und Makler beim Immobilienkauf sind
-- Anschaffungsnebenkosten (§ 255 Abs. 1 HGB) - sie erhöhen die
-- AfA-Bemessungsgrundlage und sind KEINE sofort abziehbaren
-- Werbungskosten. Eigene Kategorien (mit "_kauf"-Suffix bei notar/
-- grundbuch/makler, um sie von späteren, tatsächlich sofort abziehbaren
-- Varianten wie Makler für Neuvermietung zu unterscheiden), die
-- lib/tax-export.ts bewusst über NON_DEDUCTIBLE_CATEGORIES von der
-- Werbungskosten-Summe ausschließt (siehe dort) - rein zu
-- Dokumentationszwecken in der Belege-Liste, analog zu Migration 0045.
alter type receipt_category add value 'grunderwerbsteuer';
alter type receipt_category add value 'notar_kauf';
alter type receipt_category add value 'grundbuch_kauf';
alter type receipt_category add value 'makler_kauf';
