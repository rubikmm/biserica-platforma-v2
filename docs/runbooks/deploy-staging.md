# Deploy pe staging

Deploy-ul se face **numai la cererea explicită a utilizatorului**. Nimic din ce e scris aici nu
se execută automat.

## Înainte

```bash
pnpm typecheck && pnpm test
node infrastructure/migrations/ruleaza.mjs --remote --env staging
node infrastructure/migrations/seed.mjs --remote --env staging
```

Scriptul de migrare refuză `--remote` cu orice altceva decât `--env staging`.

## Ordinea

Serviciile înaintea aplicațiilor care le folosesc, altfel bindingurile arată către workeri
inexistenți:

```bash
wrangler deploy --env staging --config services/audit-worker/wrangler.jsonc
wrangler deploy --env staging --config services/authorization-worker/wrangler.jsonc
wrangler deploy --env staging --config services/identity-worker/wrangler.jsonc
wrangler deploy --env staging --config services/communication-worker/wrangler.jsonc
wrangler deploy --env staging --config services/automation-worker/wrangler.jsonc
wrangler deploy --env staging --config services/event-worker/wrangler.jsonc
wrangler deploy --env staging --config services/media-worker/wrangler.jsonc
wrangler deploy --env staging --config apps/account/wrangler.jsonc
wrangler deploy --env staging --config apps/calendar/wrangler.jsonc
wrangler deploy --env staging --config apps/admin/wrangler.jsonc
```

Înainte de orice `wrangler`, în același shell:

```bash
set -a; . /backup/_setup/cloudflare.env; set +a
```

## Rutele

Sunt **comentate** în `wrangler.jsonc`. Decomentarea creează înregistrări DNS pe
`sfantul-ilie.ro` — pas separat, cu confirmare explicită, fiindcă atinge zona DNS a producției.

Subdomeniile `*.staging.sfantul-ilie.ro` sunt noi și nu se ciocnesc cu V1.

## Rollback

Workerii V2 sunt separați de cei V1; un deploy prost nu atinge producția. Rollback:

```bash
wrangler rollback --env staging --config <cale>
```

Dacă rutele erau deja legate, întoarcerea se face ștergând ruta — nu workerul.

## Verificare după deploy

1. `/auth/inregistrare` răspunde;
2. login în doi pași merge (link primit pe email real, dacă e configurat);
3. aceeași sesiune funcționează pe `calendar.staging` și `admin.staging`;
4. cookie-ul are `Domain=.staging.sfantul-ilie.ro`, **nu** `.sfantul-ilie.ro`;
5. aplicațiile V1 răspund neschimbat.
