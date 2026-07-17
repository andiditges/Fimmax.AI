-- WEG-Dokumente (Eigentümerversammlungs-Protokolle) & Beschlüsse

create type hoa_resolution_status as enum ('offen', 'in_umsetzung', 'umgesetzt');

create table hoa_documents (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  title text not null,
  meeting_date date,
  year int not null,
  file_url text,
  created_at timestamptz default now()
);

create table hoa_resolutions (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  hoa_document_id uuid references hoa_documents(id) on delete set null,
  year int not null,
  title text not null,
  description text,
  status hoa_resolution_status not null default 'offen',
  created_at timestamptz default now()
);

alter table hoa_documents enable row level security;
alter table hoa_resolutions enable row level security;

create policy "own via property" on hoa_documents
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "own via property" on hoa_resolutions
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));

insert into storage.buckets (id, name, public) values ('hoa-documents', 'hoa-documents', false);

create policy "own hoa files" on storage.objects for all
  using (bucket_id = 'hoa-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'hoa-documents' and (storage.foldername(name))[1] = auth.uid()::text);
