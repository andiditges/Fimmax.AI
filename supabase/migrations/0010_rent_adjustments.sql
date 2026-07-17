create table rent_adjustments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  month date not null,
  override_amount numeric(10,2) not null,
  note text,
  created_at timestamptz default now()
);

create or replace function is_tenant_owner(tid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from tenants t where t.id = tid and is_property_owner(t.property_id)
  )
$$;

alter table rent_adjustments enable row level security;

create policy "own via tenant" on rent_adjustments
  for all using (is_tenant_owner(tenant_id)) with check (is_tenant_owner(tenant_id));
