-- Nebenkosten / Betriebskosten je Objekt & Jahr, für die Abrechnung an Mieter
-- (Kategorien nach § 2 BetrKV) und als Checkliste gegen vergessene Kostenarten.

create type operating_cost_category as enum (
  'grundsteuer', 'wasser', 'abwasser', 'heizung', 'warmwasser', 'aufzug',
  'strassenreinigung_gewerbemuell', 'restmuell_privat', 'gebaeudereinigung_ungeziefer',
  'gartenpflege', 'allgemeinstrom', 'schornsteinreinigung', 'sach_haftpflichtversicherung',
  'hauswart', 'gemeinschaftsantenne_kabel', 'wascheinrichtung', 'sonstige_umlagefaehig',
  'verwaltungskosten', 'instandhaltung', 'ruecklage_zufuehrung', 'bankgebuehren',
  'mietausfallwagnis', 'rechtsverfolgungskosten', 'sonstige_nicht_umlagefaehig'
);

create table operating_costs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  year int not null,
  category operating_cost_category not null,
  amount numeric(10,2) not null default 0,
  allocable_to_tenant boolean not null default true,
  note text,
  created_at timestamptz default now(),
  unique (property_id, year, category)
);

alter table operating_costs enable row level security;

create policy "own via property" on operating_costs
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));

-- utility_settlements existiert bereits seit dem Ur-Schema, war aber nie an
-- ein UI angebunden. Jetzt: eine Zeile pro Objekt+Jahr für hochgeladene
-- Jahresabrechnung + Summe der umlagefähigen Kosten.
alter table utility_settlements add constraint utility_settlements_property_year_unique unique (property_id, year);

insert into storage.buckets (id, name, public) values ('utility-statements', 'utility-statements', false);

create policy "own utility files" on storage.objects for all
  using (bucket_id = 'utility-statements' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'utility-statements' and (storage.foldername(name))[1] = auth.uid()::text);
