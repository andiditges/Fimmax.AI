-- Feedback/Problem-Meldungen aus der App heraus - keine eigene Admin-Ansicht
-- über alle Nutzer hinweg (dafür reicht der Supabase-Dashboard-Zugriff mit
-- Service-Role, der RLS umgeht); Nutzer selbst sehen nur ihre eigenen
-- Meldungen (Historie dessen, was sie gemeldet haben).
create table feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  type text not null default 'feedback' check (type in ('feedback', 'problem')),
  message text not null,
  page_path text,
  created_at timestamptz default now()
);

alter table feedback enable row level security;

create policy "own feedback" on feedback
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
