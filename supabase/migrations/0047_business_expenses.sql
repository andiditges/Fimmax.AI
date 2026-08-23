-- Ausgaben außerhalb der Anlage V - z.B. für Nutzer, die neben der
-- Vermietung ein eigenes Gewerbe/eine Selbständigkeit betreiben (EÜR/Anlage
-- G/S). Bewusst NICHT property-bezogen (user_id statt property_id, analog
-- zu assets/feedback/ai_category_gaps) und bewusst nicht an
-- lib/tax-export.ts angebunden - das ist eine andere Steuererklärungs-
-- Anlage als die Anlage-V-Werbungskosten der Belege.
create type business_expense_category as enum (
  'edv_software', 'buero_verwaltung', 'reise_fortbildung', 'bewirtung', 'sonstiges'
);

create table business_expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  expense_date date not null,
  category business_expense_category not null default 'sonstiges',
  description text,
  vendor text,
  amount numeric(10,2) not null,
  file_url text,
  tax_year int not null,
  created_at timestamptz default now()
);

alter table business_expenses enable row level security;

create policy "own business expenses" on business_expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.business_expenses to authenticated;
