-- Objekt-Exposé (PDF für Bank/Beleihung oder Käufer): zusätzliche Objektdaten
-- (Zimmeranzahl, Energieausweis-Pflichtangaben) + Bildupload/-verwaltung.

alter table properties add column rooms numeric(3,1);
alter table properties add column energy_certificate_type text check (energy_certificate_type in ('verbrauch', 'bedarf'));
alter table properties add column energy_certificate_value numeric(6,2);
alter table properties add column energy_efficiency_class text;
alter table properties add column heating_year int;

create table property_images (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  file_path text not null,
  caption text,
  is_cover boolean not null default false,
  created_at timestamptz default now()
);

alter table property_images enable row level security;

create policy "own via property" on property_images
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));

insert into storage.buckets (id, name, public) values ('property-images', 'property-images', false);

create policy "own property image files" on storage.objects for all
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);
