-- Ersetzt das bisherige, events-basierte Tageslimit (lib/ai-usage-limit.ts)
-- durch ein atomares Zwei-Ebenen-Limit direkt in Postgres:
--   1. Geteiltes Monats-Gesamtlimit über ALLE Nutzer (schützt das knappe
--      Anthropic-Spend-Limit, das Andi selbst gesetzt hat)
--   2. Tageslimit pro Nutzer (verhindert, dass eine Person das Monatsbudget
--      allein in einer Sitzung verbraucht)
-- Beide Zähler werden in EINER Postgres-Funktion atomar erhöht und geprüft
-- (INSERT ... ON CONFLICT ... RETURNING ist pro Statement atomar durch
-- Postgres' Row-Locking) - anders als die bisherige "erst zählen, dann
-- eintragen"-Logik im App-Code gibt es hier kein Zeitfenster, in dem zwei
-- gleichzeitige Anfragen das Limit gemeinsam reißen könnten. Bewusst
-- entkoppelt von der events-Tabelle (die hat gelegentlich PostgREST-
-- Schema-Cache-Aussetzer - für eine kostenkritische Sperre keine gute Basis).

create table if not exists ai_usage_counters (
  scope text not null,   -- 'global' oder 'user'
  key text not null,     -- 'YYYY-MM' (global) bzw. '<user_id>:YYYY-MM-DD' (user)
  endpoint text not null,
  count int not null default 0,
  primary key (scope, key, endpoint)
);

alter table ai_usage_counters enable row level security;
-- Kein Policy für direkten Zugriff - ausschließlich über die untenstehende
-- SECURITY DEFINER-Funktion erreichbar, damit niemand die Zähler von außen
-- manipulieren kann.

create or replace function public.try_consume_ai_quota(
  p_endpoint text,
  p_user_daily_limit int,
  p_global_monthly_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_day_key text;
  v_month_key text := to_char(now(), 'YYYY-MM');
  v_user_count int;
  v_global_count int;
begin
  if v_user_id is null then
    return false;
  end if;
  v_day_key := v_user_id::text || ':' || to_char(now(), 'YYYY-MM-DD');

  insert into ai_usage_counters (scope, key, endpoint, count)
  values ('global', v_month_key, p_endpoint, 1)
  on conflict (scope, key, endpoint) do update set count = ai_usage_counters.count + 1
  returning count into v_global_count;

  if v_global_count > p_global_monthly_limit then
    update ai_usage_counters set count = count - 1 where scope = 'global' and key = v_month_key and endpoint = p_endpoint;
    return false;
  end if;

  insert into ai_usage_counters (scope, key, endpoint, count)
  values ('user', v_day_key, p_endpoint, 1)
  on conflict (scope, key, endpoint) do update set count = ai_usage_counters.count + 1
  returning count into v_user_count;

  if v_user_count > p_user_daily_limit then
    update ai_usage_counters set count = count - 1 where scope = 'user' and key = v_day_key and endpoint = p_endpoint;
    update ai_usage_counters set count = count - 1 where scope = 'global' and key = v_month_key and endpoint = p_endpoint;
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.try_consume_ai_quota(text, int, int) to authenticated;
