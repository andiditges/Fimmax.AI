-- Optionale Aufteilung eines Belegs auf mehrere Kostenarten und/oder mehrere
-- Immobilien (z.B. ein Bescheid, der Grundsteuer und Müllgebühren in einer
-- Zahlungsübersicht bündelt, oder eine Sammelrechnung über mehrere
-- Einheiten). receipts.property_id/category/amount bleiben weiterhin
-- gepflegt (Fallback/Anzeige, Summe der Positionen falls vorhanden) - analog
-- zum Muster in incidental_cost_items: kein Item vorhanden -> der Beleg
-- selbst ist die alleinige Quelle; sobald Items existieren, sind sie die
-- Quelle für Kategorie-/Objekt-Zuordnung.

create table receipt_items (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  category receipt_category not null,
  amount numeric(10,2) not null,
  is_renovation boolean not null default false,
  description text,
  created_at timestamptz default now()
);

alter table receipt_items enable row level security;

create policy "own via property" on receipt_items
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
