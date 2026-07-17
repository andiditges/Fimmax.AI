-- Eigene, alltägliche Wohnungsbezeichnung (z.B. "Wohnung 1"), unabhängig von der
-- offiziellen WE/Einheit-Nummer laut Teilungserklärung.

alter table properties add column unit_label text;
