-- Verknüpfung einer Anschlussfinanzierung mit dem Kredit, den sie ablöst -
-- ohne diese Verknüpfung kann die App einen echten Anschlusskredit nicht von
-- einem zweiten, unabhängigen Kredit auf dieselbe Immobilie unterscheiden und
-- würde dessen Kreditsumme/Restschuld nach Auszahlung fälschlich doppelt
-- zählen (siehe lib/amortization.ts isSupersededAt/aggregateLoanChains).
alter table loans add column replaces_loan_id uuid references loans(id) on delete set null;
