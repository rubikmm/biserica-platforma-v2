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

**Intrarea: email → cod de șase cifre** (user, 10.09.2026, ora 15). Linkul de intrare a fost scos
cu totul — motivul dat: „e prea slabă securitatea doar cu link". Un link din scrisoare poate fi
deschis de scanerele antivirus ale furnizorului, redirecționat sau apăsat de oricine ajunge la
cutia poștală, și intră fără să scrie nimic; codul cere omul la tastatura unde a pornit intrarea.
Fără parolă, în continuare. Codul e bun zece minute, cu cinci greșeli permise. În pagină sunt
**șase căsuțe, grupate 3-3**, ca să se potrivească la ochi cu `123 456` din scrisoare.

**„Vezi ca"** (adusă din V1, user 10.09.2026): super-adminul se uită la platformă cu ochii unui
utilizator, ai unui administrator sau ai unui om neintrat. Masca stă pe **sesiune**, la identitate,
și coboară **și ce vezi, și ce poți face** — decizia o ia tot autorizarea centrală (alegere
explicită a userului), altfel previzualizarea ar minți. Rolul adevărat rămâne neatins.

Etape:

1. ✅ **Nucleul** — monorepo, identitate fără parolă (email → cod de 6 cifre), autorizare centrală,
   contracte, evenimente, audit, automatizare, comunicare, home.
2. ✅ **Staging** — publicat pe `*.staging.sfantul-ilie.ro`, email real prin Cloudflare Email Service.
3. ⏳ **Portarea aplicațiilor**: ✅ calendar (A1), ✅ program (A2), ✅ tipic (A9), ⏳ curățenie (A6), apoi A10 → A3/A8 → A12 → A7 → A5 → A4 → A13 se stinge.

**Tipicul (A9)**: rânduiala slujbei zilei, trei cărți așezate una sub alta, ca în V1 (user, 1 sept.
2026): **Rânduiala Tipicului** (ROEA, 97 de zile) spune CE se face, **Anuarul liturgic și tipiconal**
(IBMO, 365 de zile) o desfășoară, **Mineiul** (366/366 de zile) dă TEXTUL slujbei. Cărțile s-au copiat
din V1 în `xc-tipic-staging` — Mineiul e cel de la slujbe.teologie.net pe unsprezece luni și scanarea
IBMO 2005 pe noiembrie, exact setul pe care îl servește V1. Cartea Mineiului **nu ține de an**: cheia
e (luna, zi), nu data. Afișarea, markup-ul și textele sunt cele din V1; ce s-a schimbat, și de ce:
- pagina e **deschisă** (V1 cerea cont) — „totul la liber, deocamdată";
- titlul zilei se face din ziua **structurată** a calendarului (`denumire` + `sfinti`), nu din
  `titlu_html`: în V2 calendarul dă câmpurile desfăcute, deci nu mai e nimic de despicat;
- **textul pericopelor vine de la calendar**, nu direct de la Biblia: calendarul e singurul care
  vorbește cu ea. Pentru asta a căpătat `GET /v1/pericopa?ref=` (și `?voscreasna=<1..11>`, ca lista
  celor 11 Evanghelii ale Învierii să nu se copieze în aplicații);
- **cardurile care duc la PDF-ul cărții lipsesc**: cele trei PDF-uri (Anuarul 41 MB, Mineiul pe
  noiembrie 67 MB, ROEA) stau în R2-ul V1 și n-au fost încă copiate în `xc-tipic-*`.

**Programul (A2)**: baza afișării e V1 (stilul local, markup-ul și textele din `biserica-program`,
9 sept.), iar **hârtiile — foaia A4, JPG-ul, „Sfinții zilei" — trebuie să rămână identice cu V1**;
se compară ușor, punând una lângă alta paginile `/v1/foaie/<luni>.html` din ambele. **Pagina**, în
schimb, a fost refăcută la cererea userului pe 10.09.2026, seara, și NU mai e cea din V1:

- în antet: **navigarea săptămânii** (trei trepte fixe — trecută · azi · următoare, fiecare o
  destinație socotită față de ziua de azi, treapta curentă marcată roșu și apăsabilă) și, după o
  liniuță, **întrerupătorul „Calendar"** (on/off), care a luat locul meniului „Informații utile";
- **abonarea a ieșit momentan** din interfață (rutele și audiența rămân);
- sub antet, doar **hârtiile — Arhiva, PDF, JPG**, pe două trepte: adminul le are pe săptămâna de acum
  și pe cea următoare, super-adminul pe tot istoricul; de aici urmează că istoricul e al adminilor,
  navigarea nefiind un istoric;
- lângă întrerupător, butonul cu **săgeată în jos** deschide poza săptămânii, făcută de calendar;
- **calendarul aprins = a doua coloană**, în dreapta programului: titlul zilei, apoi sfinții unul
  sub altul cu săgeată, fără pericope și fără glas. Ține exact cât navigarea (cele trei săptămâni);
- în stânga, zilele fără slujbe rămân goale (fără titlu); eticheta de stare se scrie doar când NU e
  „validat" (adică practic doar „propunere", la săptămâna următoare). Pe telefon, în zilele roșii cu
  slujbe, calendarul nu se mai scrie: sărbătoarea și sfinții sunt deja pe rândurile slujbei.

**Fără scriere manuală**: pagina `/admin` (scrierea și validarea săptămânii) a fost scoasă cu totul —
„nu vreau să fac nimic manual" (user, 16:36). Programul are săptămânile importate din V1 și
propunerea automată, ca în V1.
4. ⏳ **Curățenia finală** — se șterge tot ce NU are prefix `xc-`.

## NEXT

1. **Ce a mai rămas deosebit între local și public** (user, 11.09.2026: „să nu fie nicio diferență
   între testare și public"). Modul de probă a fost **scos de tot** atunci; local se intră cu cont
   adevărat și masca „vezi ca" se pune din meniul contului, exact ca pe staging. Mai rămân trei
   deosebiri, toate **structurale**, nu de afișare:
   - **emailul nu poate pleca din `wrangler dev`** (binding-ul `send_email` nu funcționează acolo) —
     de aceea codul apare în pagină și `123456` merge oricând pentru super-admin;
   - **un singur host, cu căi** (`/program`, `/cont`) față de subdomenii pe staging;
   - **cache**: în dev paginile ies `no-store`, pe staging `max-age=300` — dinadins, altfel
     schimbările par nefăcute cinci minute. (`calendar` n-are ramura asta: și local cachează 5 min.)
2. **PDF-urile cărților tipicului în R2** — Anuarul (41 MB), Mineiul pe noiembrie (67 MB) și ROEA
   stau în R2-ul V1 și n-au fost copiate. Fără ele, cardul care duce la pagina zilei din carte nu
   se scrie (codul îl așteaptă). De întrebat utilizatorul dacă le vrea.
3. **Sfinții zilei pe foaia A4 a programului** — API-ul e gata (`tipic /v1/sfinti/<data>`);
   rămâne afișarea, **grupată după sursă** (cerere user, 10.09.2026): sfinții calendarului
   într-un grup, pomenirile Mineiului în altul, cu cartea scrisă lângă ele.
4. **Curățenia (A6)** — schema, sloturile din slujbele programului (`curatenie: true`), rapoartele
   prin serviciul de comunicare. Voluntarii devin conturi ale platformei: adresele lor din V1 se
   trec prin `identity /utilizatori/asigura`, iar aplicația ține doar `user_id`.
2. **Testul real de email**, de către utilizator: `https://cont.staging.sfantul-ilie.ro` → cont nou
   cu `rubikmm@gmail.com` → codul vine pe email → super-admin automat.
3. **Foaia A4 local** — Browser Rendering merge pe staging; local are nevoie de bibliotecile Chrome
   în container (cerere la #agent-server, 10.09).
4. **Pornire automată în container** — `pnpm dev` se lansează manual; de pus în `app-init.sh`.
5. Comunicare reală (`LIVRARE_REALA=da`) abia când A7 se portează — nu înainte.
6. Vocabularul de nume al subdomeniilor V2 (lista de 15) — de confirmat cu utilizatorul.
7. **Titlul zilei din calendar** (`titlu_html`, văzut în program la „Afișează calendarul"): V2 îl
   reface din segmente, fără `<strong>`/`<em>` din sursa Patriarhiei; V1 le păstra (sfinții cu
   cruce, bold). De lămurit cu utilizatorul dacă vrea bold-ul înapoi — se schimbă în calendar, nu în program.

## Aplicațiile de pe staging

| Aplicație | Adresă | Ce ține |
|---|---|---|
| home | `staging.sfantul-ilie.ro` | ușa platformei: lista aplicațiilor. Fără date |
| cont | `cont.staging.sfantul-ilie.ro` | intrarea fără parolă; singurul loc cu date personale |
| calendar | `calendar.staging.sfantul-ilie.ro` | 730 de zile oficiale (2025–2026) + anii calculați |
| program | `program.staging.sfantul-ilie.ro` | 654 săptămâni / 2619 slujbe copiate din V1 |
| tipic | `tipic.staging.sfantul-ilie.ro` | 3 cărți: ROEA 97 zile, Anuar 365, Mineiul 366 |
| admin | `admin.staging.sfantul-ilie.ro` | audit, livrări, automatizări |

## Stare tehnică

- **Local**: `https://rubik:8474` (container `biserica-platforma-v2`). 11 workeri prin
  `wrangler dev`, gateway pe `/`. Email în sandbox: codul apare în pagină.
- **Staging**: `cont.` / `calendar.` / `admin.` `.staging.sfantul-ilie.ro` (custom domains,
  DNS creat automat; certificatul TLS se emite de Cloudflare la primul deploy — poate dura
  minute). Serviciile interne **nu** au adresă publică (`workers_dev: false` peste tot).
  Email real prin binding `send_email` (`POSTA`), de pe `no-reply@posta.sfantul-ilie.ro`.
- **Cloudflare**: 6 baze D1 (migrate remote), R2 `xc-media-staging`, KV `xc-config-staging`,
  cozile `xc-events-staging` + DLQ. **Producție: nimic** — configurații scrise, fără resurse
  sau rute.
- **Verificat cap-coadă local**: cont nou la primul cod → super-admin automat → cod refolosit
  respins → SSO pe a doua aplicație → intrare repetată fără dublarea contului → publicare
  eveniment → outbox → coadă → automatizare → livrare simulată. 31 de teste unitare, typecheck
  curat pe 20 de pachete.

## Capcane de ținut minte

- **Intrarea pe local: `123456` merge oricând pentru adresa super-adminului** (⚠️ TEMPORAR, cerere
  user 11.09.2026). Fluxul rămâne întreg: adresă → „Trimite-mi codul" → scrii `123456`. Blocul e în
  `services/identity-worker/src/index.ts`, sub `permiteSecretDebug(cfg)` — pe staging și în
  producție e inert. **De șters când nu mai trebuie.**
- **`Origin` în dev: lista albă nu mai respinge.** `ORIGINE_PUBLICA` e scrisă cu un singur nume
  (`https://rubik:8474`), dar containerul se deschide și de pe IP-ul NAS-ului sau alt nume de casă —
  orice POST de acolo cădea cu „origine neacceptată" și intrarea locală părea stricată. Din 11.09
  `verificaCsrf(req, …, eDev)` sare peste lista albă **doar în dev**; paza adevărată (tokenul CSRF
  pereche cu cookie-ul) se verifică oricum la fiecare rută.
- **Sub masca „vezi ca", pagina e personală chiar dacă n-are niciun nume pe ea.** Regula de cache
  se uita doar la `ctx.utilizator`, deci sub masca „neautentificat" pagina ieșea cu
  `public, max-age=300` — iar `home` o dădea așa **întotdeauna**. Browserul o servea din propriul
  cache și după ce masca fusese scoasă, așa că butonul „Revino la super admin" părea că nu face
  nimic (reclamat de user, 11.09.2026). Din 11.09 condiția e `ctx.utilizator || ctx.veziCa` în
  program / calendar / tipic / home. La orice aplicație nouă: **masca intră în decizia de cache**.
- **Întoarcerea de la „vezi ca" trece printr-o listă albă de origini.** `intoarcereSigura`
  (`apps/account/src/index.ts`) acceptă doar originile din `navigatieDin(cfg)`, deci o aplicație
  fără `URL_<APP>` în varsurile **contului** nu e o destinație validă: omul ajungea pe pagina
  contului, nu înapoi de unde apăsase (pățit cu calendar și tipic pe staging, reparat 11.09).
  La orice subdomeniu nou: adaugă-i `URL_<APP>` și în `apps/account/wrangler.jsonc`.
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
- **Nu publica cu `pnpm deploy:staging` (turbo) cât timp `wrangler dev` merge.** Turbo pornește
  cele 12 publicări în paralel, iar `wrangler dev` singur ține ~1,4 GB din cei 2 GB ai
  containerului — totul se sufocă (10.09: 98% memorie, 611% CPU, `docker exec` mort, repornire de
  container). Publică **un worker o dată**: `pnpm -C <dir> run deploy:staging`, cu `CI=1` (fără
  prompturi) și `timeout` pe fiecare pas — durează ~6 s de worker. La schimbări de schemă:
  migrația, apoi imediat workerul care o citește.
- **`Origin` nu are cale.** Orice listă de adrese permise pentru CSRF se taie la origine
  (`new URL(x).origin`) înainte de comparație — `ORIGINE_PUBLICA` are prefixul gateway-ului în dev.
- **Masca „vezi ca" trebuie să ajungă la autorizare**, nu doar în antet: `principalDin` (din
  `@xc/auth`) o pune în `Principal`, iar `authorization-worker` decide sub ea. O aplicație care
  și-ar scrie singură principalul ar putea s-o uite și ar da drepturi peste mască — de asta
  `principalDin` stă într-un singur loc, în pachet, nu copiat în fiecare aplicație.
- **Tokenul Cloudflare nu citește Email Routing / certificate** (API răspunde „Authentication
  error"), dar deploy-ul cu `send_email` merge — verificarea e pe Workers API.

## Jurnal

### 2026-09-11

- **Modul de probă local a ieșit de tot** (user: „scoate-o de tot... să fie la fel ca pe staging").
  Scoase din `program`: bannerul `.proba` cu tot cu stil și media query, tipurile `RolProba`/
  `StareProba`, câmpurile `proba`/`caleAcum`/`navProba` din `Ctx`, ruta `GET /proba/<rol>`, blocul
  `rolProba` și varianta de navigare `?nav=date` (era cod mort — `navProba` nu se punea nicăieri).
  `eDev` a rămas doar pentru cache. Probat local, intrat cu `123456`: fără cutie, meniul „Vezi ca"
  cu trei măști, banda jos sub fiecare mască, iar „Revino la super admin" o scoate. Program 0.3.2.
- **Intrarea pe local, reparată în două locuri.** (1) POST-urile locale cădeau cu „origine
  neacceptată" când pagina era deschisă de pe alt nume decât `rubik` — lista albă de origini se
  sare acum în dev. (2) `123456` e cod de casă permanent pentru adresa super-adminului, tot numai
  în dev. Probat: POST cu `Origin: https://192.168.1.77:8474` trece, iar `123456` deschide sesiune
  cu drepturi de super-admin. **Emailul de pe staging NU e stricat** — auditul
  (`xc-audit-staging`) arată `livrat: true` cu `messageId=…@posta.sfantul-ilie.ro`, inclusiv la
  intrarea reușită a userului de la 08:49. „Eroarea de trimitere" era pagina de CSRF respins.
- **Cutia de probă locală are ieșire.** X în dreapta (`/proba/inchis`): scoate rolul împrumutat —
  antetul și drepturile revin la contul adevărat — și strânge cutia într-o pastilă „probă", care
  o deschide la loc (`/proba/deschis` șterge cookie-ul). Nota de sub butoane a ieșit, iar pe
  telefon rămân doar butoanele și X-ul. Probat cap-coadă local, cu un cont adevărat: sub
  `proba_rol=admin` antetul zice „Admin de probă" și apare Arhiva; după X zice `rubikmm@gmail.com`
  și Arhiva rămâne (drepturile reale ale super-adminului).
- **Banda „vezi ca" de pe staging: butonul „Revino la super admin" nu răspundea.** Două cauze,
  amândouă reparate și publicate (`account` 0.1.1, `home` 0.1.1, `tipic` 0.1.1, `calendar` 0.1.1,
  `program` 0.3.1): (1) pagina purtată sub mască era cacheabilă public — `home` întotdeauna, restul
  sub masca „neautentificat" — deci browserul o servea înapoi cu banda cu tot după ce masca fusese
  scoasă; (2) `apps/account/wrangler.jsonc` n-avea `URL_CALENDAR` / `URL_TIPIC` / `URL_CURATENIE`,
  așa că întoarcerea spre calendar și tipic era refuzată de `intoarcereSigura` și omul ajungea pe
  pagina contului. Lanțul complet (pun masca → banda apare → „Revino" → banda dispare) probat pe
  local cu sesiune de super-admin.

### 2026-09-10

- **Tipicul publicat pe staging**: `tipic.staging.sfantul-ilie.ro`, cu cele trei cărți în
  `xc-tipic-staging` și cu `GET /v1/sfinti/<data>` — sfinții zilei așa cum îi numără Mineiul
  (2041 de pomeniri pe an, 5,6 pe zi). Calendarul a fost republicat pentru `/v1/pericopa`, iar
  home-ul are butonul Tipicului. Capcană nouă: subdomeniul nou nu se rezolvă din NAS ore în șir
  (cache negativ de DNS), deși public răspunde — se probează cu `--resolve`.

- **Tipicul (A9) portat pe V2, local**: contract `@xc/contracts/tipic`, baza `xc-tipic-staging`
  (97 + 365 + 366 de zile copiate din V1, fără nicio literă stricată), aplicația `apps/tipic` cu
  pagina zilei și `/v1`. Calendarul a căpătat `/v1/pericopa` — textul unei pericope, oricare ar fi
  ea —, ca legătura cu Biblia să rămână într-un singur loc. Probat pe trei zile: duminică cu tot
  (13 sept.), zi doar din Anuar (15 sept.), zi cu Evanghelia Utreniei (1 ian.). Nepublicat.

- Proiect pornit de la zero: container, repo GitHub privat și resursele Cloudflare `xc-*` create
  în aceeași zi.
- Prefixul cerut a fost `xc_`, schimbat în `xc-` la confirmarea utilizatorului: Workers, R2 și
  Queues nu acceptă underscore în nume.
- Auditul stării V1 (pasul 1 din brief) a fost **sărit**, la cererea explicită a utilizatorului;
  inventarul funcțiilor s-a făcut totuși, mai târziu, ca bază pentru ordinea portării (canvas).
- Autentificarea a avut patru forme într-o singură zi: „parolă + link" (presupunerea mea) →
  utilizatorul a cerut **fără parolă** → email → link → **email → cod de șase cifre**, linkul scos
  cu totul. Contul se naște la prima confirmare, indiferent de formă.
- Publicat pe staging intrarea cu cod + „vezi ca" (16:17). Prima încercare, prin turbo, a sufocat
  containerul (12 publicări paralele peste `wrangler dev`); a fost nevoie de `docker restart`, apoi
  publicare secvențială, ~6 s pe worker. Testul real de email rămâne al utilizatorului.
- Găsit reparând altceva: în dev, `ORIGINE_PUBLICA` poartă și prefixul gateway-ului
  (`https://rubik:8474/cont`), dar antetul `Origin` e mereu numai `schemă://gazdă:port` — comparate
  ca șiruri, nu se potriveau niciodată și **orice POST local era respins** cu „origine neacceptată".
  Bug vechi, ascuns de faptul că probele de după se făcuseră pe staging. `verificaCsrf` taie acum
  adresele permise la origine înainte de comparație.
- Găsit și reparat: idempotența acțiunilor de automatizare era legată de id-ul envelope-ului;
  republicarea aceluiași eveniment trimitea o a doua notificare. Acum e pe `idempotencyKey`.
- Emailul real: nu prin furnizor extern, ci prin Cloudflare Email Service — mecanismul pe care
  A13 îl folosește deja din 8.09 (binding `send_email`, expeditor `posta.sfantul-ilie.ro`).
- Staging publicat (10 workeri). Descoperit după primul deploy că toți aveau adrese publice
  `workers.dev` → închise cu `workers_dev: false` și republicat.
- Programul adus la afișarea V1 verbatim (16:30–16:50): stil, markup, texte din `stil.ts` +
  `pagini.ts` ale V1; verificat prin diff de HTML V1 live ↔ V2 local (antet, navigare, zile,
  arhivă: identice; diferă doar `titlu_html` din calendar). Scoasă scrierea manuală (`/admin`),
  la cererea userului. Arhiva grupează acum după anul zilei de luni, ca V1 (înainte, o săptămână
  călare pe 31 dec. apărea în ambii ani).
- Seara (17:00–19:00) pagina programului a fost **refăcută**, într-un șir de cereri mărunte ale
  userului (vezi PLAN): navigarea a urcat în antet ca trei trepte fixe, „Informații utile" a devenit
  întrerupătorul „Calendar", abonarea a ieșit, hârtiile au rămas doar pentru admini, iar calendarul
  aprins deschide a doua coloană, cu sfinții. Regula „afișarea = V1 verbatim" **rămâne valabilă doar
  pentru hârtii**, nu și pentru pagină.
- **Foaia A4 comparată cap la cap cu V1** (19:00), după ce userul a spus că „nu e la fel de detaliată":
  textele erau identice, dar liniile tabelului nu. În V1 ziua e o CASETĂ — nicio linie între slujbele
  aceleiași zile —, piciorul ei e punctat când slujbele se țin lanț peste noapte (Vecernie seara →
  Liturghie dimineața) și plin în rest, iar șirul de zile fără slujbe se arată printr-o singură bandă
  gri. V2 trăgea linie între toate rândurile, punea o bandă per zi goală și centra ora pe verticală.
  Reparat, plus: numele zilei cu majusculă pe foaie, intervalul din casetă calculat mereu (titlurile
  importate au cratimă în loc de linie de dialog), iar „Sfinții zilei" nu mai repetă titlul zilei
  (`titlu_html` ține la un loc sfinții, pericopele și glasul — se vedeau de două ori).
- Liniile foii, runda a doua (19:15–19:25), tot din codul V1, unde erau explicate: chenarele groase
  laterale se **întrerup** la banda zilelor fără slujbe („așa se vede că s-a rupt șirul"), jumătatea de
  zi fără slujbă nu se taie pe verticală, caseta cu intervalul are chenar subțire și umbră dură (nu
  difuză), iar tabelul n-are chenar la stânga și jos: bara groasă o poartă celulele zilei și se oprește
  la duminică, unde colțul din stânga-jos rămâne deschis.
- **Hârtiile pe două trepte de rol** (19:39): adminul vede Arhiva|PDF|JPG doar pe săptămâna de acum și
  pe cea următoare, super-adminul pe tot istoricul. Pe telefon, în zilele roșii cu slujbe, coloana
  calendarului nu se mai scrie — sărbătoarea și sfinții sunt deja pe rândurile slujbei.
- **Cinci diacritice stricate la exportul din V1** (19:52), descoperite de user într-o poză de pe
  telefon: o literă cu diacritice ajunsese două semne de înlocuire („Înainte-pr??znuirea"). V1 era
  curat, deci exportul le-a stricat. Reparate în D1 (local + staging): numele slujbelor luate înapoi
  din vocabular, detaliile cu `REPLACE`. `insereazaLoturi` strigă acum la orice import.
- **Poza săptămânii** (20:28–21:00), adusă din V1 și așezată la CALENDAR, nu la program: ruta
  `GET /v1/poza/saptamana/<zi>` compune antetul (CALENDAR, parohia, intervalul) și cele șapte zile, le
  trece prin Browser Rendering și le ține în cache-ul de muchie. Lată cât un telefon (450 px CSS), pe
  temă închisă. În V1 pozele se generau dinainte, pentru tot anul, cu un script, și stăteau în R2 —
  aici nu mai e nimic de întreținut la preluarea unui an. Programul o deschide cu un buton (săgeată în
  jos) din antet, lângă întrerupătorul Calendar. Ca să n-ajungem la tiparul V1 cu cod copiat între
  aplicații, PDF-ul/JPG-ul/PNG-ul și cache-ul lor au urcat în `@xc/ui` (`packages/ui/src/hartie.ts`),
  iar calendarul a căpătat binding-ul `BROWSER` (dev + staging).
