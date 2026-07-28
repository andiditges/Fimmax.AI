-- Optionale Aufteilung der Kaufnebenkosten auf einzelne Posten (Notar,
-- Grundbuch, Makler, ...). Der Gesamtbetrag bleibt weiterhin in
-- properties.incidental_costs gepflegt (Summe der Posten, falls vorhanden) -
-- diese Tabelle dient nur der Aufschlüsselung/Nachvollziehbarkeit, nicht
-- als alleinige Quelle.

create type incidental_cost_category as enum (
  'notar', 'grundbuch', 'makler', 'grundschuld', 'gutachten', 'sonstiges'
);

create table incidental_cost_items (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  category incidental_cost_category not null,
  amount numeric(10,2) not null,
  note text,
  created_at timestamptz default now()
);

alter table incidental_cost_items enable row level security;

create policy "own via property" on incidental_cost_items
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
