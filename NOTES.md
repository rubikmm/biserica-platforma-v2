# NOTES — biserica-platforma-v2

Memoria proiectului. Călătorește cu repo-ul.

## PLAN

Rescrierea de la zero a platformei parohiei, cu migrarea treptată a celor 12 aplicații V1.

**Regula de aur**: V1 rămâne funcțională și neatinsă. V2 se construiește în paralel, pe resurse
Cloudflare noi cu prefix `xc-`. Nu se refolosește nimic din V1 — nici cod, nici date; unde e
nevoie de date existente, ele se copiază.

Etape:

1. ✅ **Nucleul** — monorepo, identitate + SSO, autorizare centrală, contracte, evenimente,
   audit, automatizare, comunicare (sandbox), calendar pilot.
2. ⏳ **Staging** — deploy pe `*.staging.sfantul-ilie.ro`, cu email real. Cere decizia
   utilizatorului (furnizor de email, legare de subdomenii).
3. ⏳ **Portarea aplicațiilor**, în ordinea din `docs/migration/v1-to-v2.md`: calendar → conținut
   (tipic, biblia, biblioteca) → program/buletin → curățenie/transmisiuni → cont → comunicări.
4. ⏳ **Curățenia finală** — se șterge tot ce NU are prefix `xc-`.

## NEXT

1. **Decizia despre email real** — fără un furnizor (Resend/Postmark/SMTP), linkul de confirmare
   nu poate ajunge la oameni în afara mediului `dev`. Vezi `docs/runbooks/email-real.md`.
2. **Deploy pe staging**, când utilizatorul cere — rutele sunt scrise, dar comentate; legarea lor
   atinge DNS-ul zonei `sfantul-ilie.ro`.
3. **Prima aplicație de portat: calendarul** — pilotul există; de adăugat ce are V1 în plus
   (pascalie, rânduieli, evangheliar) și de copiat datele.
4. **Pornire automată în container** — acum `pnpm dev` se lansează manual; de pus în `app-init.sh`
   ca să supraviețuiască unei reporniri.

## Stare tehnică

- **Local**: `https://rubik:8474` (container `biserica-platforma-v2`). 11 workeri prin
  `wrangler dev`, gateway pe `/`.
- **Cloudflare**: 6 baze D1, R2 `xc-media-staging`, KV `xc-config-staging`, cozile
  `xc-events-staging` + DLQ. **Niciun worker publicat**, nicio rută legată.
- **Verificat cap-coadă**: înregistrare → superadmin automat → login în doi pași cu link →
  SSO pe a doua aplicație → creare/publicare eveniment → outbox → coadă → automatizare →
  livrare simulată. 32 de teste unitare trec, typecheck curat pe 20 de pachete.

## Capcane de ținut minte

- **`--persist-to .wrangler/state`** e obligatoriu la toate comenzile locale. Fără el, fiecare
  configurație își face propria bază și migrațiile ajung unde aplicația nu citește.
- **`pnpm approve-builds --all --yes`** după fiecare schimbare de `package.json` — esbuild și
  workerd au scripturi de build, iar pnpm 12 le blochează implicit.
- **Cookie-ul de staging** nu are voie pe `.sfantul-ilie.ro` — ar ajunge la aplicațiile V1.
- **Gazda `rubik`** nu are punct în nume, deci cookie-ul local e host-only. SSO-ul între
  subdomenii se testează pe staging, nu local.

## Jurnal

### 2026-09-10

- Proiect pornit de la zero: container, repo GitHub privat și resursele Cloudflare `xc-*` create
  în aceeași zi.
- Prefixul cerut a fost `xc_`, schimbat în `xc-` la confirmarea utilizatorului: Workers, R2 și
  Queues nu acceptă underscore în nume.
- Auditul stării V1 (pasul 1 din brief) a fost **sărit**, la cererea explicită a utilizatorului.
- Al doilea factor prin link, nu prin cod — decizie de UX a utilizatorului (ADR 0003).
- Găsit și reparat în aceeași rundă: idempotența acțiunilor de automatizare era legată de id-ul
  envelope-ului, deci republicarea aceluiași eveniment trimitea o a doua notificare. Acum e
  legată de `idempotencyKey`.
