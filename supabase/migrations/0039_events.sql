-- Eigenes, cookiefreies Event-Logging (Seitenaufrufe + ausgewählte
-- Feature-Nutzung) statt Drittanbieter-Analytics: keine Cookies, keine
-- Datenübermittlung an Dritte, kein Cookie-Consent-Banner nötig. Analog zu
-- feedback.sql: keine eigene Admin-Ansicht über alle Nutzer hinweg - dafür
-- reicht der Supabase-Dashboard-Zugriff mit Service-Role, der RLS umgeht.
create table events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  event_name text not null,
  page_path text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table events enable row level security;

create policy "own events" on events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
