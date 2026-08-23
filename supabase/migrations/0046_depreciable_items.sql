-- Bewegliche Wirtschaftsgüter (z.B. Einbauküche, Waschmaschine) werden nicht
-- sofort abgezogen, sondern über eine eigene Nutzungsdauer abgeschrieben
-- (AfA), unabhängig von der Gebäude-AfA der Immobilie (lib/afa.ts). Bisher
-- gab es dafür kein Tracking - ein Beleg landete entweder komplett in den
-- Werbungskosten (falsch, da nicht sofort abziehbar) oder gar nicht in der
-- App. property_id statt user_id, da die AfA objektbezogen in die
-- Anlage-V-Werbungskosten des jeweiligen Objekts einfließt (siehe
-- lib/tax-export.ts).
create table depreciable_items (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  description text not null,
  acquisition_date date not null,
  acquisition_cost numeric(10,2) not null,
  usage_duration_years int not null default 10,
  receipt_id uuid references receipts(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

alter table depreciable_items enable row level security;

create policy "own via property" on depreciable_items
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));

grant select, insert, update, delete on public.depreciable_items to anon, authenticated;
