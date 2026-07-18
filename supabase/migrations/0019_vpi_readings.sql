-- Eigene, manuell gepflegte Verbraucherpreisindex-Stände (Destatis, Basis
-- 2020=100) fürs Indexmieten-Tracking. Portfolio-weit statt pro Objekt, da
-- der VPI ein bundesweiter Wert ist.
create table vpi_readings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  month date not null,
  value numeric(8,3) not null,
  created_at timestamptz default now(),
  unique (user_id, month)
);

alter table vpi_readings enable row level security;

create policy "own vpi readings" on vpi_readings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
