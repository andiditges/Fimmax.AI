-- Nebenkostenassistent: Vermieter-Stammdaten (Absender für Abrechnungsschreiben)
-- + zwei zusätzliche, oft vergessene Betriebskostenarten nach § 2 BetrKV.

create table user_settings (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  landlord_name text,
  address_line text,
  postal_code text,
  city text,
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "own settings" on user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rauchwarnmelder (Miete/Wartung) und Kosten der Verbrauchserfassung
-- (z.B. Wärmemengenzähler-Miete, Ablesedienst) sind eigene, umlagefähige
-- Betriebskostenarten, die aber oft unter "Sonstiges" untergehen oder ganz
-- vergessen werden. ALTER TYPE ... ADD VALUE außerhalb eines Blocks mit
-- Verwendung der neuen Werte, damit es in einer Migrations-Transaktion läuft.
alter type operating_cost_category add value 'rauchwarnmelder';
alter type operating_cost_category add value 'verbrauchserfassung';
