-- Sammelt Fälle, in denen die Beleg-KI eine Position keiner der festen
-- receipt_category-Werte zuordnen konnte und stattdessen auf "sonstiges"
-- zurückgefallen ist. Bewusst kein automatisches Anlegen neuer Kategorien:
-- receipt_category ist ein Postgres-Enum und fließt direkt in steuer-/
-- abrechnungsrelevante Logik ein (15%-Grenze, Nebenkosten-Prognose,
-- Steuer-Export) - eine neue Kategorie braucht immer eine bewusste
-- Entscheidung (u.a. umlagefähig/nicht umlagefähig), keine KI-Fantasie-
-- Bezeichnung. Andi sichtet diese Tabelle direkt im Supabase-Dashboard
-- (gleiches Muster wie die bestehende "feedback"-Tabelle) und legt bei
-- Bedarf manuell eine neue Kategorie an.
create table if not exists ai_category_gaps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  raw_label text not null,
  vendor text,
  description text,
  created_at timestamptz default now()
);

alter table ai_category_gaps enable row level security;

create policy "own ai category gaps" on ai_category_gaps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.ai_category_gaps to authenticated;
