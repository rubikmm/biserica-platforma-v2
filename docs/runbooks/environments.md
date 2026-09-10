# Medii și resurse

Trei medii: `dev`, `staging`, `production`. Toate resursele noi poartă prefixul **`xc-`**, ca la
curățenia finală să se poată șterge tot ce nu-l are.

> Prefixul e `xc-`, cu cratimă, nu `xc_`: Workers, R2 și Queues nu acceptă underscore în nume.

## Ce există acum (contul „Sfântul Ilie Tesviteanul")

| Tip | Nume | Folosit de |
|---|---|---|
| D1 | `xc-identity-staging` | identity-worker |
| D1 | `xc-authz-staging` | authorization-worker |
| D1 | `xc-audit-staging` | audit-worker, event-worker |
| D1 | `xc-calendar-staging` | app-calendar |
| D1 | `xc-communication-staging` | communication-worker |
| D1 | `xc-automation-staging` | automation-worker |
| R2 | `xc-media-staging` | media-worker |
| KV | `xc-config-staging` | rezervat pentru setări de runtime |
| Queue | `xc-events-staging` | magistrala de evenimente |
| Queue | `xc-events-dlq-staging` | mesaje eșuate |

**Nu există resurse `xc-*-production`.** Configurațiile de producție sunt scrise, dar fără
`d1_databases`, fără rute și fără domenii — se creează abia la un cutover explicit.

## dev

Rulează local, cu `wrangler dev`. Nu atinge nicio resursă din Cloudflare: D1, R2 și cozile sunt
simulate în `.wrangler/state`.

Numele bazelor din configurație sunt cele de staging, dar `--local` nu se conectează la ele.
Ca să atingi bazele reale, ai nevoie de `--remote`, explicit.

> **Toate** comenzile locale folosesc `--persist-to .wrangler/state`, altfel fiecare configurație
> își face propria stare și migrațiile ajung într-o bază pe care aplicația n-o citește.

## staging

Singurul mediu în care se poate publica în această fază, și numai la cererea utilizatorului.

Ierarhia de subdomenii prevăzută (neconectată încă):

```
cont.staging.sfantul-ilie.ro
calendar.staging.sfantul-ilie.ro
admin.staging.sfantul-ilie.ro
```

Cookie-ul de sesiune: `Domain=.staging.sfantul-ilie.ro`. **Niciodată** `.sfantul-ilie.ro` — ar
ajunge și la aplicațiile V1 de pe producție.

Rutele sunt comentate în `wrangler.jsonc`. Decomentarea lor creează înregistrări DNS și e un pas
separat, cu confirmare.

## production

Pregătit configurațional, inactiv. Nu are resurse, rute sau deployment.

## Secrete

| Ce | Unde |
|---|---|
| Token Cloudflare | `/backup/_setup/cloudflare.env` în container; se sursează explicit înainte de `wrangler` |
| Furnizor de email | neconfigurat; vezi `.dev.vars.example` și `email-real.md` |

Niciun secret nu intră în repo, în fixture-uri, în documentație sau în loguri. Loggerul redactează
automat cheile sensibile.

## Binding-uri

| Binding | Ce e | Unde |
|---|---|---|
| `DB` | D1-ul propriu | fiecare serviciu cu bază |
| `IDENTITATE`, `AUTORIZARE`, `AUDIT` | servicii interne | aplicații |
| `COMUNICARE`, `AUTOMATIZARE` | servicii interne | admin, automation |
| `EVENIMENTE` | producător de coadă | app-calendar |
| `FISIERE` | bucket R2 | doar media-worker |
