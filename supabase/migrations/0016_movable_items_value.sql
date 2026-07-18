-- Bewegliche Gegenstände (z.B. Einbauküche, Markise) mindern laut Kaufvertrag
-- oft die Bemessungsgrundlage für die Grunderwerbsteuer.

alter table properties add column movable_items_value numeric(12,2);
