# Platforma parohiei — V2

Rescrierea de la zero a platformei. Aplicațiile V1 rămân neatinse; V2 se construiește în
paralel, pe resurse Cloudflare noi, iar aplicațiile se mută în ea una câte una.

**Nimic din V1 nu e refolosit** — nici cod, nici baze de date, nici bucketuri. Unde e nevoie de
date existente, ele se copiază, nu se partajează.

## Ce e aici

| Zonă | Ce conține |
|---|---|
| `apps/` | aplicațiile-client: `account`, `admin`, `program` (pilot), `gateway` (doar preview local) |
| `services/` | serviciile interne: identitate, autorizare, audit, evenimente, automatizare, comunicare, fișiere |
| `packages/` | codul comun: contracte Zod, auth, autorizare, D1, evenimente, observabilitate, UI, config |
| `infrastructure/` | migrații SQL, scripturi de seed și de creare a resurselor |
| `docs/` | arhitectură, ADR-uri, runbook-uri, planul de migrare |

## Cum îl pornești local

```bash
pnpm install
pnpm approve-builds --all --yes     # o singură dată: esbuild + workerd au scripturi de build
node infrastructure/migrations/ruleaza.mjs --local
node infrastructure/migrations/seed.mjs --local
pnpm dev
```

`pnpm dev` pornește toate cele 11 worker-e deodată (`wrangler dev` cu mai multe configurații),
cu Service Bindings funcționale între ele, și expune gateway-ul pe `127.0.0.1:8787`.

În containerul de test, Apache trimite `https://rubik:8474` către acest port.

> **Atenție la starea locală**: toate comenzile locale folosesc `--persist-to .wrangler/state`.
> Fără asta fiecare configurație își face propria bază și migrațiile ajung într-un loc pe care
> aplicația nu-l citește niciodată.

## Cum intri

**Fără parolă.** Dai adresa de email, primești un link, îl deschizi — ai intrat. Prima dată,
același link îți deschide și contul. Sesiunea ține 30 de zile; „Închide toate sesiunile" o
revocă oriunde.

În mediul `dev` nu pleacă niciun email: linkul apare direct în pagină. Pe staging și producție
scrisoarea pleacă prin Cloudflare Email Service, de pe `no-reply@posta.sfantul-ilie.ro`.

Adresa din variabila `EMAIL_SUPERADMIN` primește automat rolul `super-admin` la deschiderea contului.

## Comenzi

| Comandă | Ce face |
|---|---|
| `pnpm dev` | pornește toată platforma local |
| `pnpm typecheck` | verifică tipurile în toate pachetele |
| `pnpm test` | rulează testele |
| `pnpm migreaza` / `pnpm migreaza:staging` | aplică migrațiile |
| `pnpm seed` / `pnpm seed:staging` | date de pornire (audiențe, șabloane, reguli) |
| `pnpm deploy:staging` | publică pe staging — **doar la cerere explicită** |

## Ce NU face încă

- **Nu trimite comunicări în masă.** Adaptoarele din `communication-worker` sunt sandbox;
  livrările se înregistrează, dar nu pleacă. Doar linkurile de intrare pleacă real, pe staging.
- **Nu atinge V1.** Niciun worker, DNS, D1, R2 sau KV existent nu e modificat.
