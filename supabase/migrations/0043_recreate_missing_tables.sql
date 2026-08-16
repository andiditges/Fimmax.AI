-- Korrigiert den eigentlichen Fund: "Could not find the table in the schema
-- cache" war weder ein PostgREST-Cache-Problem noch ein fehlendes GRANT
-- (0042 war ein Fehlschluss) - events existiert schlicht nicht in der
-- Datenbank ("relation public.events does not exist"), obwohl Migration
-- 0039 dafür in einer früheren Session als ausgeführt galt. Mit
-- IF NOT EXISTS geschrieben, damit es unabhängig davon sicher ist, ob
-- receipt_items (0037) zufällig doch schon existiert oder nicht.

create table if not exists receipt_items (
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

drop policy if exists "own via property" on receipt_items;
create policy "own via property" on receipt_items
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  event_name text not null,
  page_path text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table events enable row level security;

drop policy if exists "own events" on events;
create policy "own events" on events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.receipt_items to anon, authenticated;
grant select, insert, update, delete on public.events to anon, authenticated;
