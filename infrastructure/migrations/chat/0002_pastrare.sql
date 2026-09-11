-- Toate discutiile se PASTREAZA (user, 11.09.2026, 21:33: „să ții minte toate conversațiile — și de
-- referință și ca să mai facem training pe ele"). Stergerea din bula devine ascundere: discutia
-- nu se mai redeschide omului, dar ramane in baza pentru probe si antrenament.
ALTER TABLE conversatii ADD COLUMN stearsa_la TEXT;
CREATE INDEX IF NOT EXISTS idx_conversatii_vii ON conversatii (user_id, stearsa_la, ultimul_la DESC);
