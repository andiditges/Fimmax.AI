-- Vermieter-Cockpit Datenbankschema

create extension if not exists "uuid-ossp";

-- Immobilien
create table properties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  address text not null,
  unit text,
  purchase_date date not null,
  purchase_price numeric(12,2) not null,
  incidental_costs numeric(12,2) not null default 0,
  land_value numeric(12,2) not null,
  building_value numeric(12,2) not null,
  build_year int not null,
  afa_rate numeric(4,2) not null default 2.0,
  usage_duration int not null default 50,
  is_self_managed boolean not null default true,
  created_at timestamptz default now()
);

-- Mieter
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  unit text,
  move_in_date date not null,
  move_out_date date,
  rent_base numeric(10,2) not null default 0,
  advance_payment numeric(10,2) not null default 0
);

-- Mietverträge
create table rental_agreements (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  file_url text,
  rent_amount numeric(10,2) not null,
  start_date date not null,
  is_index_rent boolean not null default false,
  index_base_value numeric(8,3),
  index_base_date date,
  last_increase_date date,
  next_reminder_date date,
  created_at timestamptz default now()
);

-- Belege
create type receipt_category as enum (
  'instandhaltung', 'verwaltung', 'versicherung',
  'grundsteuer', 'zinsen', 'hausgeld', 'sonstiges'
);

create table receipts (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  file_url text,
  receipt_date date not null,
  amount numeric(10,2) not null,
  vendor text,
  description text,
  category receipt_category not null default 'sonstiges',
  is_renovation boolean not null default false,
  ai_confidence numeric(4,3),
  tax_year int not null,
  created_at timestamptz default now()
);

-- Einnahmen
create table income_records (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  date date not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('miete', 'nebenkosten', 'sonstiges'))
);

-- Nebenkostenabrechnungen
create table utility_settlements (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  year int not null,
  total_costs numeric(10,2),
  items jsonb,
  source_file_url text,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz default now()
);

-- Storage Bucket für Scans
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false);

-- Multi-Tenancy: Row Level Security
-- Nur properties hat eine echte user_id-Spalte. Alle Kind-Tabellen werden per
-- Join über property_id -> properties.user_id geschützt (eine Quelle der Wahrheit).
create or replace function is_property_owner(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from properties p
    where p.id = pid and p.user_id = auth.uid()
  )
$$;

alter table properties enable row level security;
alter table tenants enable row level security;
alter table rental_agreements enable row level security;
alter table receipts enable row level security;
alter table income_records enable row level security;
alter table utility_settlements enable row level security;

create policy "own properties" on properties
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own via property" on tenants
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "own via property" on rental_agreements
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "own via property" on receipts
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "own via property" on income_records
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "own via property" on utility_settlements
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));

create policy "own receipt files" on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own contract files" on storage.objects for all
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);

-- Finanz-Cockpit: Kredite / Tilgung / Sondertilgungen
create table loans (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  lender text,
  principal numeric(12,2) not null,
  nominal_interest_rate numeric(6,4) not null,
  disbursement_date date not null,
  initial_fixed_period_years int,
  initial_repayment_rate numeric(6,4),
  annuity_amount numeric(10,2) not null,
  payment_frequency text not null default 'monatlich'
    check (payment_frequency in ('monatlich','vierteljährlich','jährlich')),
  day_count_convention text not null default 'act/365'
    check (day_count_convention in ('act/365','30/360')),
  created_at timestamptz default now()
);

create table loan_special_payments (
  id uuid primary key default uuid_generate_v4(),
  loan_id uuid not null references loans(id) on delete cascade,
  payment_date date not null,
  amount numeric(10,2) not null,
  note text,
  created_at timestamptz default now()
);

create or replace function is_loan_owner(lid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from loans l where l.id = lid and is_property_owner(l.property_id)
  )
$$;

alter table loans enable row level security;
alter table loan_special_payments enable row level security;

create policy "own via property" on loans
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "own via loan" on loan_special_payments
  for all using (is_loan_owner(loan_id)) with check (is_loan_owner(loan_id));
