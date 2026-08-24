-- Sonstige, nicht aus Miete stammende Rückflüsse, die das eingesetzte
-- Eigenkapital wirtschaftlich zurückgewinnen (z.B. der auf Immobilien
-- entfallende Anteil einer Steuerrückerstattung, der durch abgesetzte
-- Werbungskosten/AfA/Nutzungsdauergutachten zustande kam). Portfolioweit
-- statt je Objekt, weil sich eine Steuererklärung nie sauber auf ein
-- einzelnes Objekt herunterbrechen lässt. Fließt zeitlich am angegebenen
-- Datum in die Break-even-Simulation ein (lib/equity-breakeven.ts), analog
-- zu Miete/Tilgung.
create table capital_recoveries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  recovery_date date not null,
  amount numeric(12,2) not null,
  description text,
  created_at timestamptz default now()
);

alter table capital_recoveries enable row level security;

create policy "own capital recoveries" on capital_recoveries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.capital_recoveries to authenticated;
