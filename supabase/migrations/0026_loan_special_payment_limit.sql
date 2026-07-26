-- Jährliche Sondertilgungsgrenze (üblich z.B. 5% der urspr. Darlehenssumme
-- ohne Vorfälligkeitsentschädigung) - ermöglicht dem Sondertilgungs-Tipp zu
-- erkennen, wenn das Jahreslimit für einen Kredit bereits ausgeschöpft ist.
alter table loans add column special_payment_limit_percent numeric(5,2);
