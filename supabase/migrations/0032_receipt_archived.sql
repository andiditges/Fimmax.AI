-- Ermöglicht, Belege eines Steuerjahres als "archiviert" zu markieren,
-- sobald die Steuererklärung dafür rechtsgültig durch ist - archivierte
-- Belege werden aus der normalen Belegsuche ausgeblendet (aber weiterhin in
-- allen steuerlichen Berechnungen berücksichtigt, da sich an den Zahlen
-- nichts ändert - nur an der Sichtbarkeit im Tagesgeschäft).
alter table receipts add column archived boolean not null default false;
