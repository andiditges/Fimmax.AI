-- Anteil der Kaltmiete, der auf Küche, Stellplatz, Möbel o.ä. entfällt
-- (nicht Teil der reinen Wohnraummiete).
alter table tenants add column furnishing_surcharge numeric(10,2);
