# ADR 0005 — Outbox tranzacțional peste Cloudflare Queues

**Stare**: acceptat, 10.09.2026

## Context

Când un eveniment de calendar e publicat, trebuie și salvat, și anunțat. Dacă publicăm direct în
coadă după scriere, o cădere între cele două lasă evenimentul salvat, dar nespus — pentru totdeauna.

## Decizie

Mutația de domeniu și rândul de outbox se scriu în **aceeași tranzacție D1** (`db.batch()`).
Publicarea în coadă vine după commit. Ce nu apucă să plece rămâne cu `published_at IS NULL` și e
luat de un cron la 5 minute.

`ctx.waitUntil()` nu e considerat garanție — dacă izolatul moare, rândul rămâne oricum.

## Idempotență

Coada livrează cel puțin o dată. Două niveluri de apărare:

1. `evenimente_procesate (event_id, consumer)` — `INSERT OR IGNORE`.
2. La nivel de efect: `automation-worker` cheie pe `idempotencyKey`, nu pe id-ul envelope-ului.

Al doilea nivel nu e redundant: două publicări ale aceluiași eveniment produc envelope-uri
**diferite** cu aceeași cheie. Fără el, s-ar trimite două anunțuri pentru aceeași slujbă.

## Consecințe

- Nicio pierdere de evenimente la cădere.
- Cost: o tabelă de outbox per aplicație producătoare și un cron de curățare.
- Mesajele care nu trec de contract merg direct în DLQ — reîncercarea nu repară un mesaj stricat.
