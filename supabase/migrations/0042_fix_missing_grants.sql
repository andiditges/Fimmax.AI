-- Root-Cause-Fix für den seit Wochen bestehenden "Could not find the table
-- in the schema cache"-Fehler bei events und receipt_items: es war nie ein
-- PostgREST-Cache-Problem (weder NOTIFY pgrst still das reload schema noch
-- ein Projekt-Neustart haben geholfen), sondern ein fehlendes GRANT. Die
-- Basis-Tabellen aus schema.sql hatten Zugriffsrechte offenbar über eine
-- initiale Supabase-Projekteinstellung automatisch erhalten - bei Tabellen
-- aus späteren Migrationen (0037 receipt_items, 0039 events) fehlte das
-- GRANT, wodurch PostgREST sie nie in seine Introspektion aufgenommen hat.
-- RLS-Policies filtern ohnehin weiterhin auf Zeilenebene, das GRANT
-- erlaubt nur überhaupt erst den Zugriffsversuch.
grant select, insert, update, delete on public.events to anon, authenticated;
grant select, insert, update, delete on public.receipt_items to anon, authenticated;
