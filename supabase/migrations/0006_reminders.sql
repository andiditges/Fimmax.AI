-- Reminders & ToDos (Mieterhöhungen, Eigentümerversammlungen, Wohnungs-ToDos, ...)

create type reminder_category as enum (
  'mieterhoehung', 'eigentuemerversammlung', 'hausverwaltung', 'instandhaltung', 'sonstiges'
);
create type reminder_status as enum ('offen', 'in_arbeit', 'erledigt');

create table reminders (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  title text not null,
  description text,
  category reminder_category not null default 'sonstiges',
  due_date date,
  status reminder_status not null default 'offen',
  depends_on_id uuid references reminders(id) on delete set null,
  created_at timestamptz default now()
);

alter table reminders enable row level security;

create policy "own via property" on reminders
  for all using (is_property_owner(property_id)) with check (is_property_owner(property_id));
