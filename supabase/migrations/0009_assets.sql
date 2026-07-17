-- Sonstige Vermögenswerte (Wertpapiere, Tagesgeld/Festgeld, Bausparvertrag, VL-Vertrag,
-- Rentenversicherung/Altersvorsorge) fürs Finanz-Cockpit / Nettovermögen.

create type asset_category as enum (
  'wertpapiere', 'tagesgeld_festgeld', 'bausparvertrag', 'vl_vertrag', 'rentenversicherung', 'sonstiges'
);

create table assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  category asset_category not null,
  name text not null,
  institution text,
  current_value numeric(12,2) not null,
  monthly_contribution numeric(10,2) not null default 0,
  valuation_date date not null default current_date,
  note text,
  created_at timestamptz default now()
);

alter table assets enable row level security;

create policy "own assets" on assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
