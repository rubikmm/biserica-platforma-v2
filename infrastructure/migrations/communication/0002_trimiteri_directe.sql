-- Trimiteri directe (o aplicatie compune scrisoarea, comunicarea o livreaza si o arhiveaza) si
-- adresa destinatarului legata de contul lui. Arhiva a ceea ce a plecat sta AICI, nu in aplicatii.

ALTER TABLE requests ADD COLUMN sursa TEXT;            -- aplicatia care a cerut: 'curatenie', 'program'…
ALTER TABLE requests ADD COLUMN subject TEXT;          -- subiectul, la trimiterile directe
ALTER TABLE requests ADD COLUMN body_html TEXT;        -- corpul HTML, arhivat o singura data
ALTER TABLE requests ADD COLUMN test INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN meta_json TEXT;        -- ce mai vrea aplicatia sa tina minte (ex. duminica vizata)

ALTER TABLE deliveries ADD COLUMN user_id TEXT;
ALTER TABLE deliveries ADD COLUMN detaliu TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_sursa ON requests (sursa, created_at DESC);
