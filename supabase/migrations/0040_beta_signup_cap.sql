-- Beta-Limit: maximal 10 registrierte Nutzer. Bewusst als DB-Trigger auf
-- auth.users (nicht nur clientseitig geprüft) - sonst könnte jemand die
-- Supabase-Auth-API direkt mit dem Anon-Key aufrufen und das Limit umgehen.
create or replace function public.enforce_signup_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from auth.users) >= 10 then
    raise exception 'Die Beta ist aktuell auf 10 Nutzer begrenzt.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_signup_cap on auth.users;
create trigger enforce_signup_cap
  before insert on auth.users
  for each row execute function public.enforce_signup_cap();

-- Für eine freundliche Anzeige auf der Login-Seite ("noch X Plätze frei"),
-- ohne dass der Anon-Key die volle auth.users-Tabelle lesen kann/muss.
create or replace function public.beta_signup_slots_remaining()
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(0, 10 - (select count(*)::int from auth.users));
$$;

grant execute on function public.beta_signup_slots_remaining() to anon, authenticated;
