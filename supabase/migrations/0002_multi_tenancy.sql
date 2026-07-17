-- Multi-Tenancy Retrofit: Auth + Row Level Security
--
-- Nur `properties` bekommt eine echte user_id-Spalte. Alle Kind-Tabellen
-- (tenants, rental_agreements, receipts, income_records, utility_settlements)
-- werden per Join über property_id -> properties.user_id geschützt, statt
-- eine eigene user_id-Spalte zu duplizieren (eine Quelle der Wahrheit,
-- kein Drift-Risiko zwischen Parent und Child).

-- Schritt 1: Spalte erst nullable anlegen, da bestehende Properties noch
-- keinen Owner haben.
alter table properties add column user_id uuid references auth.users(id);

-- Schritt 2 (manuell, einmalig): Nach dem ersten Signup via /login die
-- bestehenden Properties dem eigenen Account zuordnen, z.B.:
--   update properties set user_id = '<eigene-auth-uid-aus-auth.users>' where user_id is null;

-- Schritt 3: Erst NACH Schritt 2 ausführen, um bestehende Zeilen nicht zu blockieren.
-- alter table properties alter column user_id set not null;
alter table properties alter column user_id set default auth.uid();

-- Schritt 4: RLS-Helper-Funktion (security definer + gepinnter search_path,
-- damit sie unabhängig von der aufrufenden Rolle auf properties zugreifen kann).
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

-- Schritt 5: RLS aktivieren
alter table properties enable row level security;
alter table tenants enable row level security;
alter table rental_agreements enable row level security;
alter table receipts enable row level security;
alter table income_records enable row level security;
alter table utility_settlements enable row level security;

-- Schritt 6: Policies
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

-- Schritt 7: Storage-RLS für die beiden privaten Buckets, gescoped per
-- user_id-Ordner-Präfix im Dateipfad (z.B. "receipts/<user_id>/...").
create policy "own receipt files" on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own contract files" on storage.objects for all
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);
