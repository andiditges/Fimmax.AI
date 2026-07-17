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

-- Wiederverwendet is_property_owner() aus 0002_multi_tenancy.sql
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
