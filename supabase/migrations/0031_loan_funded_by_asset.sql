-- Verknüpfung eines Kredits (typ. eine geplante Anschlussfinanzierung) mit
-- einem Sparplan-Vermögenswert (z.B. Bausparvertrag), der ihn bei Auszahlung
-- (teil-)finanzieren soll - damit die App hochrechnen kann, ob die
-- Ansparsumme bis dahin ausreicht (siehe lib/net-worth.ts projectedAssetValue).
alter table loans add column funded_by_asset_id uuid references assets(id) on delete set null;
