# Evenimente, outbox și workflow-uri

## Envelope

Orice mesaj care intră în coadă are aceeași formă, validată cu Zod **la producere, nu doar la
consum** — un eveniment stricat nu ajunge niciodată în outbox:

```ts
{
  id, type: 'program.event.published.v1', occurredAt, producer,
  actor: { type: 'user' | 'system' | 'ai', id? },
  correlationId, idempotencyKey?, payload
}
```

Versiunea e în numele tipului (`.v1`). O schimbare incompatibilă înseamnă `.v2` alături de `.v1`,
nu modificarea lui `.v1`.

## De ce outbox

O mutație de domeniu și anunțarea ei trebuie să fie inseparabile. Dacă am publica direct în coadă
după `UPDATE`, o cădere între cele două ar lăsa evenimentul nespus, pentru totdeauna.

De aceea, în **aceeași tranzacție D1** se scriu amândouă:

```ts
await batch(env.DB, [
  db.prepare('UPDATE events SET status = ...'),
  declaratieOutbox(db, envelope),
])
```

Publicarea în coadă vine **după** commit. Ce nu apucă să plece rămâne în tabelă cu
`published_at IS NULL` și e luat de trecerea următoare.

`ctx.waitUntil()` **nu** e considerat garanție: dacă izolatul moare, rândul rămâne, iar cron-ul
de la 5 minute îl trimite.

## Livrare cel puțin o dată

Cozile Cloudflare pot livra același mesaj de mai multe ori și în altă ordine. Fiecare consumator
e idempotent, pe două niveluri:

1. `evenimente_procesate (event_id, consumer)` — `INSERT OR IGNORE`; dacă nu s-a inserat nimic,
   mesajul a mai fost procesat și se ignoră.
2. La nivel de efect: `automation-worker` folosește `idempotencyKey` (nu id-ul envelope-ului),
   iar `communication-worker` respinge o cerere cu aceeași cheie.

> Distincția de la punctul 2 contează: două publicări ale aceluiași eveniment de calendar produc
> envelope-uri **diferite**, dar cu aceeași `idempotencyKey`. Fără ea, enoriașii ar primi două
> anunțuri pentru aceeași slujbă.

## Reîncercări și DLQ

| Situație | Ce se întâmplă |
|---|---|
| Consumatorul aruncă | `retry()` — coada reîncearcă, până la 5 ori |
| Envelope invalid | `ack()` imediat, cu motivul în log — reîncercarea nu ar face un mesaj stricat valid |
| După 5 eșecuri | mesajul ajunge în `xc-events-dlq-staging` |

Replay-ul din DLQ: vezi `docs/runbooks/replay-dlq.md`.

## Automatizare

O regulă are declanșator, filtru, acțiune, proprietar, stare și politică de aprobare. Riscul
decide singur dacă acțiunea se execută:

- `risc: low` → `aprobata_automat`, se execută pe loc;
- `risc: high` → `asteapta_aprobare`, se oprește și așteaptă un om.

Publicarea, ștergerea, trimiterea în masă și schimbările de roluri sunt întotdeauna `high`.

## AI

Există doar contractul, nu execuția. Traseul prevăzut:

```
mesaj extern → interpretare structurată → policy → propunere
                                            ├─ risc mic → executare permisă
                                            └─ risc mare → aprobare umană obligatorie
```

AI-ul nu primește acces la D1, R2, roluri, cozi sau API-uri administrative. Toate acțiunile lui
trec prin aceeași poartă ca ale oricui altcuiva.
