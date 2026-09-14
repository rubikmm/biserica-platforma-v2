-- WhatsApp: mesajul NU pleaca din Worker. Cloudflare nu ajunge la WAHA, care sta in casa, pe NAS
-- (`biserica-whatsapp`, 192.168.1.123:8112) — si nici nu vrem sa-l scoatem pe internet.
-- Deci aici se tine COADA: pullerul de pe NAS (`biserica-whatsapp-puller`) intreaba ce are de
-- trimis, trimite prin WAHA local si raporteaza inapoi. Acelasi tipar ca in V1, ales de utilizator
-- pe 14.09.2026 („whatsapp cu puller cum e acum").
--
-- Nu e tabel nou: coada sta in `deliveries`, ca sa ramana O SINGURA arhiva a ce a plecat.
-- Stari: `in_asteptare` -> `in_lucru` (luat de puller) -> `sent` / `failed`.

ALTER TABLE deliveries ADD COLUMN corp TEXT;                      -- ce se trimite (WhatsApp n-are subiect)
ALTER TABLE deliveries ADD COLUMN incercari INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN luat_la TEXT;                   -- cand l-a luat pullerul
ALTER TABLE deliveries ADD COLUMN livrat_la TEXT;

-- Coada se citeste des (la un minut): cautarea dupa canal + stare merge pe index, nu pe tot tabelul.
CREATE INDEX IF NOT EXISTS idx_livrari_coada ON deliveries (channel, status, created_at);
