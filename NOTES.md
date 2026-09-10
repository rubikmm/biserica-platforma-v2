# NOTES — biserica-platforma-v2

Memoria proiectului. Călătorește cu repo-ul.

## PLAN

Rescrierea de la zero a platformei parohiei, cu migrarea treptată a celor 12 aplicații V1.

**Regula de aur**: V1 rămâne funcțională și neatinsă. V2 se construiește în paralel, pe resurse
Cloudflare noi cu prefix `xc-`. Nu se refolosește nimic din V1 — nici cod, nici date; unde e
nevoie de date existente, ele se copiază. Din V1 se preiau **funcțiile** (ce face fiecare
aplicație), nu implementarea.

**Structura mare, care nu se încalcă la nicio portare** (user, 10.09.2026):
- **datele stau într-un loc** — aplicația ține doar ce e al domeniului ei; ce e al altcuiva se cere;
- **autentificarea la fel** — un singur cont, la `identity`; nicio aplicație nu are identitate proprie,
  listă de nume, parolă locală sau cookie de om;
- **datele personale nu se copiază** — aplicațiile țin `user_id`, nu nume/email/telefon;
- **abonările** sunt audiențe ale serviciului de comunicare, nu liste în aplicații;
- **emailul** pleacă doar prin `communication-worker`, care ține și arhiva a ce a plecat.

**Grafica**: carcasa V1 (antet, subsol, temă după soare) mutată în `@xc/ui`. Nu se inventează altă
variantă grafică — se umblă la ea mai târziu, peste tot deodată (user, 10.09.2026).

**Deocamdată totul e la liber**: nicio pagină de citit nu cere cont. Se închide mai târziu, după ce
toate aplicațiile ajung la același nivel (user, 10.09.2026). Scrierea cere permisiune centrală.

Etape:

1. ✅ **Nucleul** — monorepo, identitate fără parolă (email → link), autorizare centrală,
   contracte, evenimente, audit, automatizare, comunicare, home.
2. ✅ **Staging** — publicat pe `*.staging.sfantul-ilie.ro`, email real prin Cloudflare Email Service.
3. ⏳ **Portarea aplicațiilor**: ✅ calendar (A1), ✅ program (A2), ⏳ curățenie (A6), apoi
   A9/A10 → A3/A8 → A12 → A7 → A5 → A4 → A13 se stinge.
4. ⏳ **Curățenia finală** — se șterge tot ce NU are prefix `xc-`.

## NEXT

1. **Curățenia (A6)** — schema, sloturile din slujbele programului (`curatenie: true`), rapoartele
   prin serviciul de comunicare. Voluntarii devin conturi ale platformei: adresele lor din V1 se
   trec prin `identity /utilizatori/asigura`, iar aplicația ține doar `user_id`.
2. **Testul real de email**, de către utilizator: `https://cont.staging.sfantul-ilie.ro` → cont nou
   cu `rubikmm@gmail.com` → linkul vine pe email → super-admin automat.
3. **Foaia A4 local** — Browser Rendering merge pe staging; local are nevoie de bibliotecile Chrome
   în container (cerere la #agent-server, 10.09).
4. **Pornire automată în container** — `pnpm dev` se lansează manual; de pus în `app-init.sh`.
5. Comunicare reală (`LIVRARE_REALA=da`) abia când A7 se portează — nu înainte.
6. Vocabularul de nume al subdomeniilor V2 (lista de 15) — de confirmat cu utilizatorul.

## Aplicațiile de pe staging

| Aplicație | Adresă | Ce ține |
|---|---|---|
| home | `staging.sfantul-ilie.ro` | ușa platformei: lista aplicațiilor. Fără date |
| cont | `cont.staging.sfantul-ilie.ro` | intrarea fără parolă; singurul loc cu date personale |
| calendar | `calendar.staging.sfantul-ilie.ro` | 730 de zile oficiale (2025–2026) + anii calculați |
| program | `program.staging.sfantul-ilie.ro` | 654 săptămâni / 2619 slujbe copiate din V1 |
| admin | `admin.staging.sfantul-ilie.ro` | audit, livrări, automatizări |

## Stare tehnică

- **Local**: `https://rubik:8474` (container `biserica-platforma-v2`). 11 workeri prin
  `wrangler dev`, gateway pe `/`. Email în sandbox: linkul apare în pagină.
- **Staging**: `cont.` / `calendar.` / `admin.` `.staging.sfantul-ilie.ro` (custom domains,
  DNS creat automat; certificatul TLS se emite de Cloudflare la primul deploy — poate dura
  minute). Serviciile interne **nu** au adresă publică (`workers_dev: false` peste tot).
  Email real prin binding `send_email` (`POSTA`), de pe `no-reply@posta.sfantul-ilie.ro`.
- **Cloudflare**: 6 baze D1 (migrate remote), R2 `xc-media-staging`, KV `xc-config-staging`,
  cozile `xc-events-staging` + DLQ. **Producție: nimic** — configurații scrise, fără resurse
  sau rute.
- **Verificat cap-coadă local**: cont nou la primul link → super-admin automat → link refolosit
  respins → SSO pe a doua aplicație → intrare repetată fără dublarea contului → publicare
  eveniment → outbox → coadă → automatizare → livrare simulată. 31 de teste unitare, typecheck
  curat pe 20 de pachete.

## Capcane de ținut minte

- **`--persist-to .wrangler/state`** e obligatoriu la toate comenzile locale. Fără el, fiecare
  configurație își face propria bază și migrațiile ajung unde aplicația nu citește.
- **`pnpm approve-builds --all --yes`** după fiecare schimbare de `package.json` — esbuild și
  workerd au scripturi de build, iar pnpm 12 le blochează implicit.
- **`.gitignore` are `.wrangler` fără slash** — e symlink spre `/data/wrangler`; forma cu slash
  nu prinde symlink-uri și ar comite bazele locale.
- **Oprirea platformei**: `pgrep -f` + `kill -9` pe PID-uri, excluzând propriul shell (`$$`) —
  un `pkill -f wrangler` dintr-un `bash -lc '...wrangler...'` se omoară pe sine (exit 137).
- **`workers_dev: false`** pe orice worker nou — Cloudflare pornește implicit o adresă publică,
  iar rutele interne (`/atribuie`, `/scrie`) nu au voie să fie apelabile din afară.
- **Cookie-ul de staging** nu are voie pe `.sfantul-ilie.ro` — ar ajunge la aplicațiile V1.
- **Gazda `rubik`** nu are punct în nume, deci cookie-ul local e host-only. SSO-ul între
  subdomenii se testează pe staging, nu local.
- **Prefixul gateway-ului nu e al aplicației.** Local, calendarul e montat la `/program`; pe
  subdomeniul lui e la rădăcină. Orice aplicație nouă detectează prefixul o dată (vezi
  `apps/program/src/index.ts`) și primește adresele celorlalte prin `URL_CONT/URL_CALENDAR/URL_ADMIN`
  — altfel dă 404 pe staging și trimite la login pe subdomeniul greșit (găsit la primul deploy).
- **Tokenul Cloudflare nu citește Email Routing / certificate** (API răspunde „Authentication
  error"), dar deploy-ul cu `send_email` merge — verificarea e pe Workers API.

## Jurnal

### 2026-09-10

- Proiect pornit de la zero: container, repo GitHub privat și resursele Cloudflare `xc-*` create
  în aceeași zi.
- Prefixul cerut a fost `xc_`, schimbat în `xc-` la confirmarea utilizatorului: Workers, R2 și
  Queues nu acceptă underscore în nume.
- Auditul stării V1 (pasul 1 din brief) a fost **sărit**, la cererea explicită a utilizatorului;
  inventarul funcțiilor s-a făcut totuși, mai târziu, ca bază pentru ordinea portării (canvas).
- Autentificarea a avut trei forme într-o singură zi: „parolă + link" (presupunerea mea) →
  utilizatorul a cerut **fără parolă** → email → link, contul se naște la prima confirmare.
- Găsit și reparat: idempotența acțiunilor de automatizare era legată de id-ul envelope-ului;
  republicarea aceluiași eveniment trimitea o a doua notificare. Acum e pe `idempotencyKey`.
- Emailul real: nu prin furnizor extern, ci prin Cloudflare Email Service — mecanismul pe care
  A13 îl folosește deja din 8.09 (binding `send_email`, expeditor `posta.sfantul-ilie.ro`).
- Staging publicat (10 workeri). Descoperit după primul deploy că toți aveau adrese publice
  `workers.dev` → închise cu `workers_dev: false` și republicat.
