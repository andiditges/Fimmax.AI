-- Nebenkosten je Mieter zuordenbar (bei mehreren Mietparteien pro Objekt,
-- z.B. Wohnung + separat vermietete Garage).
alter table operating_costs add column tenant_id uuid references tenants(id) on delete set null;

-- Eigene Rücklagen je Objekt (Mietausfall, Sonderumlage, Sonstiges) - im
-- Unterschied zur Instandhaltungsrücklage der WEG, die weiterhin über
-- operating_costs.category = 'ruecklage_zufuehrung' erfasst wird und
-- kumuliert über alle Jahre ausgewertet wird.
create type reserve_category as enum ('mietausfall', 'sonderumlage', 'sonstiges');

create table property_reserves (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  category reserve_category not null,
  name text,
  current_value numeric(12,2) not null default 0,
  monthly_contribution numeric(10,2) not null default 0,
  funded_from_rent boolean not null default false,
  note text,
  created_at timestamptz default now()
);

alter table property_reserves enable row level security;

create policy "own via property" on property_reserves
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
