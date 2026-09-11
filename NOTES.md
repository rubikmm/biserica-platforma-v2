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
4. ⏳ **Modulul de Chat și acțiunile interne** (11.09.2026) — fiecare aplicație își publică
   verbele la `/_actiuni` (lista folosibilă de un AI, de altă aplicație sau de o unealtă), iar bula
   de chat se aprinde per aplicație din panoul de admin. Detalii:
   `docs/architecture/chat-si-actiuni.md`. Regula: **o acțiune nu conține logică proprie** — cheamă
   aceeași funcție de domeniu ca ruta `/v1`.
5. ⏳ **Curățenia finală** — se șterge tot ce NU are prefix `xc-`.

## NEXT

1. **Modulul de Chat, ce a rămas** (11.09.2026):
   - bula e montată doar pe `program`; `calendar` și `tipic` au acțiuni, dar nu și bulă (aceleași
     trei linii: `modulChat`, `ruteaza`, `chat` în opțiunile comune ale paginilor);
   - ✅ acțiunile care scriu + confirmarea sunt probate cap-coadă pe program (11.09, seara);
     rămâne `comunicare.trimite_obiect` (trimiterea unei foi la o audiență) — a comunicării;
   - nimic nu e publicat pe staging: acolo trebuie `wrangler secret put SECRET_INTERN` la fiecare
     worker cu acțiuni (`program`, `calendar`, `tipic`, `chat`) și migrația bazei `xc-chat-staging`;
   - de probat cu ochii pe telefon: bula pe ecran mic (panoul ia toată lățimea sub 480 px).
2. **Ce a mai rămas deosebit între local și public** (user, 11.09.2026: „să nu fie nicio diferență
   între testare și public"). Trei deosebiri, toate **structurale**, nu de afișare:
   - **emailul nu poate pleca din `wrangler dev`** — de aceea codul apare în pagină și `123456`
     merge oricând pentru super-admin;
   - **un singur host, cu căi** (`/program`, `/cont`) față de subdomenii pe staging;
   - **cache**: în dev paginile ies `no-store`, pe staging `max-age=300` — dinadins.
     (`calendar` n-are ramura asta: și local cachează 5 min.)
3. **PDF-urile cărților tipicului în R2** — Anuarul (41 MB), Mineiul pe noiembrie (67 MB) și ROEA
   stau în R2-ul V1 și n-au fost copiate. Fără ele, cardul spre pagina zilei din carte nu se scrie.
4. **Curățenia (A6)** — schema, sloturile din slujbele programului (`curatenie: true`), rapoartele
   prin serviciul de comunicare. Voluntarii devin conturi: adresele din V1 trec prin
   `identity /utilizatori/asigura`, iar aplicația ține doar `user_id`.
5. **Testul real de email**, de către utilizator: `https://cont.staging.sfantul-ilie.ro` → cont nou
   cu `rubikmm@gmail.com` → codul vine pe email → super-admin automat.
6. **Pornire automată în container** — `pnpm dev` se lansează manual; de pus în `app-init.sh`.
   ⚠️ De acum are nevoie și de tokenul Cloudflare în mediu (binding-ul `ai` al chatului).
7. Comunicare reală (`LIVRARE_REALA=da`) abia când A7 se portează — nu înainte.
8. Vocabularul de nume al subdomeniilor V2 (lista de 15) — de confirmat cu utilizatorul.
9. **Titlul zilei din calendar** (`titlu_html`): V2 îl reface din segmente, fără `<strong>`/`<em>`
   din sursa Patriarhiei; V1 le păstra. De lămurit dacă vrea bold-ul înapoi — se schimbă în calendar.

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
- **Modulul de chat pe staging** (11.09.2026, seara): publicat și **aprins** — `xc-chat-staging`
  (nou), plus program, calendar, tipic, admin și authz republicate. Pornit pentru **program**, treapta
  **„doar adminii"**, creier `workers-ai`. ⚠️ Lanțul întreg **n-a fost probat pe staging** (codul de
  intrare vine pe email, `123456` merge doar în dev); proba cap-coadă e făcută numai pe local.
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
  cache și după ce masca fusese scoasă, așa că ieșirea din mască părea că nu face nimic (reclamat
  de user, 11.09.2026). Din 11.09 condiția e `ctx.utilizator || ctx.veziCa` în
  program / calendar / tipic / home. La orice aplicație nouă: **masca intră în decizia de cache**.
- **Ieșirea din mască stă într-un singur loc: meniul de cont** (de la 11.09.2026, când banda de jos
  a fost scoasă la cererea userului). Sub masca „neautentificat" meniul e tot ce mai are omul —
  `contul()` din `@xc/ui` îl desenează anume pentru cazul „neintrat, dar cu mască". Dacă se umblă
  acolo, se probează întâi cu `tests/carcasa.test.ts`: altfel un super-admin mascat rămâne închis
  afară și n-are decât să scrie de mână `/cont/vezi-ca?ca=real`.
- **`req.url` NU e adresa din bara browserului.** Prin gateway-ul de preview workerul vede
  `http://127.0.0.1/program/…`, nu `https://rubik:8474/program/…` — iar `spre`, construit din el,
  era refuzat de `intoarcereSigura` și omul ajungea pe pagina contului. Din 11.09 toate aplicațiile
  folosesc `adresaPaginii(cfg, url)` din `@xc/config` (calea paginii pusă pe originea din
  `ORIGINE_PUBLICA`). **La orice adresă pe care o dai mai departe browserului, folosește-o pe ea.**
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

- **⚠️ Gândirea modelului scursă la om** (user, 19:27, cu exemplu: „<|channel|>analysis We need to
  modify slujba of Monday…"). gpt-oss vorbește în canale (Harmony): `analysis` = gândirea, `final` =
  răspunsul. Cu `max_tokens: 800`, fundal + zece unelte + română, gândirea singură trecea de buget,
  modelul era oprit la mijloc și marcajul de canal ajungea în text. Trei apărări în `creier.ts`:
  `curataCanalele` (rămâne doar canalul `final`; fără el, tot ce e după un marcaj se aruncă),
  buget 2500 cu reîncercare la 6000 când e tăiat fără să fi cerut o unealtă, iar `reasoning` nu e
  niciodată luat drept răspuns. Și paternurile intră acum în context ca **text**, nu JSON —
  JSON-ul cu diacritice îl încurca („UUTrenia L liturgie"). 88 de teste, 7 noi pe canale.

- **Partea EXECUTIVĂ: chatul scrie în program** (user, 19:00, cu poza chatului care spunea „nu pot
  modifica"). Programul V2 n-avea NICIUN drum de scriere (`/admin` scos, propunerea din zbor). Acum
  sunt cinci funcții în `depozit.ts` — `scrieSaptamana`, `modificaSlujba`, `adaugaSlujba`,
  `stergeSlujba`, `valideazaSaptamana` — fiecare cu mutația + `istoric` + `outbox` în **același
  batch**, și cinci acțiuni peste ele (`modifica_slujba`, `adauga_slujba`, `sterge_slujba`,
  `scrie_propunerea`, `valideaza_saptamana`), cu `program.write` / `program.publish`.
  **Previzualizarea** (`x-xc-previzualizare: 1` → validare + drept + `rezuma`, fără execuție) face ca
  omul să confirme ceva concret și deja verificat: „Schimb «Utrenia și Sfânta Liturghie» de luni,
  14 septembrie: ora 08:00 → 07:00. Săptămâna nu e scrisă încă — o scriu întâi din propunere."
  Probat cap-coadă pe local: propunere → „Da" → săptămâna scrisă din propunere, ora schimbată,
  două evenimente `program.week.changed.v1` publicate, istoricul cu „scris" + „schimbat".
  Detalii: `docs/architecture/chat-si-actiuni.md` §8.
- **Două lucruri măsurate pe drum**: (1) modelul cerea confirmarea ÎN TEXT („vrei să…?") în loc să
  cheme unealta — regula scrisă: cheamă imediat, chemarea doar pregătește propunerea, confirmarea
  e pe buton; (2) omul spune „luni", nu 2026-09-14 — `dataCeruta` înțelege acum numele zilelor
  (următoarea zi cu numele acela, azi inclusiv), iar numele slujbei e opțional când ziua are una.
  Citirile din acțiuni arată ce arată și pagina: săptămâna scrisă, altfel propunerea ei.

- **API-ul programului știe de istoric** (user, 18:41–18:46: „trebuie să adaptăm api-ul și să știe de
  istoric" — la „Sfântul Maslu" chatul n-avea ce să cheme). Cinci acțiuni noi, toate învelișuri
  peste `depozit.ts`, fiecare cu perechea ei publică:
  - `program.slujba_curenta` / `/v1/curenta` — în curs = a început de cel mult **3 ore** și e ultima
    începută (slujbele au doar oră de început; regulă confirmată de user). Pentru live și radio;
  - `program.text_saptamanii` / `/v1/saptamana/<data>.txt` — săptămâna ca text simplu;
  - `program.cauta_slujba` / `/v1/cauta?slujba=` — după NUME („maslu"): următoarea programată, ultimele
    dăți, obiceiul. Potrivirea pe vocabular e fără diacritice, pe `nume` și `cod_nume`;
  - `program.paternuri` / `/v1/paternuri` — tiparele ultimilor doi ani, ~4 KB: pentru fiecare slujbă
    cât de des, în ce zile, la ce ore, ultima, următoarea;
  - `program.arhiva` / `/v1/arhiva.json` — tot istoricul (654 săptămâni, 2619 slujbe, 1,28 MB); ca
    acțiune iese **obiect JSON în media**, nu în context.
  `urmatoarea_slujba` s-a redenumit `slujba_urmatoare`. `Slujba` rămâne obiectul întreg (user: „nu
  toate câmpurile au sens… dar lasă-le așa acum").

- **Cunoștințe de FUNDAL — cum „știe de istoric" chatul fără să care arhiva.** O acțiune poate purta
  `fundal: true` (fără argumente, de citire): chat-worker o cheamă ÎNAINTE de orice răspuns, ca
  serviciu, ține rezultatul o oră în memoria izolatului și îl pune în instrucțiuni. `program.paternuri`
  e prima. Nu e unealtă de ales (iese din lista modelului), e ce știe dinainte. Regula scrisă modelului:
  **obiceiul nu e programare** — dacă „următoarea" lipsește, spune că nu e pusă încă, nu „va fi".
  Probat: „când e Sfântul Maslu?" → marți, 18:00, ultima pe 1 septembrie, din prima.

- **MODUL NOU: Chat (AI) + acțiunile interne ale aplicațiilor** (user, 16:54 și 17:00: „să poată fi
  implementat pe toate aplicațiile din această platformă cu un simplu întrerupător"). Sunt **două
  lucruri separate**, iar despărțirea e miezul: **registrul de acțiuni** (`@xc/actiuni`, ruta
  `/_actiuni`) e lista verbelor fiecărei aplicații, folosibilă de un AI, de o altă aplicație sau de
  o unealtă de întreținere; **chatul** (`services/chat-worker` + `@xc/chat`) e doar primul lui
  client. Dacă chatul s-ar scoate mâine, registrul rămâne și își merită singur costul. Arhitectura
  întreagă: `docs/architecture/chat-si-actiuni.md`, decizia: `docs/adr/0007-actiuni-interne-si-chat.md`.

  **Regula împotriva dublării**: o acțiune nu conține logică proprie — cheamă exact funcția pe care
  o cheamă și ruta `/v1`. De aceea facerea hârtiilor programului a ieșit din rute în `hartii.ts`, iar
  compunerea zilei tipicului în `zi.ts`: fără mutările astea, acțiunile ar fi repetat cum se adună o
  foaie, adică exact tiparul V1 mutat cu un etaj mai sus.

  **Regula împotriva confuziei cu publicul**: `/_actiuni` răspunde numai prin Service Binding, cu
  secretul platformei; de pe internet calea dă **404**, nu 403.

  **Drepturile**: neschimbate. Acțiunea cu permisiune întreabă `authorization-worker` cu principalul
  real al omului, mască „vezi ca" cu tot — chatul nu poate face nimic ce n-ar putea face omul care
  scrie în el. Acțiunile care **scriu** nu se execută din chat: devin propuneri cu „Da/Nu", expiră în
  zece minute, iar dreptul se verifică din nou la confirmare.

- **„Sfinții zilei" și celelalte hârtii sunt acum OBIECTE care circulă** (user, 17:03). O acțiune
  întoarce fie date, fie un `Obiect`: hârtia se face la cerere, se așază în `media-worker` (R2) și
  mai departe circulă **doar cheia** — octeții nu trec niciodată prin model, prin chat sau prin
  context. Așa aceeași foaie cerută de zece ori se face o dată, iar o corectură în calendar schimbă
  amprenta, deci cheia, deci hârtia se reface singură. Trimiterea lor va fi o acțiune a comunicării,
  nu a aplicației care le face.

- **Alegerile utilizatorului, înainte de cod**: creierul pe **Workers AI** (pentru cost — i-am spus
  că modelele deschise aleg uneltele mai slab decât Claude), bula **doar pentru admini** la pornire,
  **citire + scriere cu confirmare**, discuția **pe server (D1)** ca să treacă din aplicație în
  aplicație. Creierul stă după o singură funcție (`intreabaModelul`): schimbarea furnizorului e o
  linie, nu o rescriere.

- **⚠️ MĂSURAT: numele de acțiune cu PUNCT rup apelarea uneltelor.** Cu `program.slujbele_zilei`
  modelul alege unealta potrivită dar scrie apelul ca **text** (`[program.slujbele_zilei(zi="duminică")]`)
  și nu se execută nimic; cu `program__slujbele_zilei`, același model și aceeași întrebare, întoarce
  `tool_calls` cum trebuie. Numele de funcție acceptat e `^[a-zA-Z0-9_-]{1,64}$`. Traducerea stă
  într-un singur loc (`numeUnealta`); numele canonic cu punct rămâne peste tot în rest.

- **Modelul, ales pe cifre** (6 modele × 5 întrebări omenești, aceleași unelte): `@cf/openai/gpt-oss-120b`
  **5/5** — singurul care a și socotit data duminicii; llama-4-scout, glm-5.3, glm-5.3-flash și
  deepseek-v4-flash 3/5; qwen3-30b 2/5. Greșeala tipică a celorlalte: confundă „slujbele zilei" cu
  „slujbele săptămânii" și cheamă „următoarea slujbă" când li se cere o foaie. Tot atunci s-a văzut
  că **fără ziua de azi în instrucțiuni** „duminică" nu se poate socoti.

- **Întrerupătorul, în două locuri**: în cod, o aplicație capătă chatul cu trei linii plus
  `src/actiuni.ts`; din `apps/admin` → pagina **„Module"**, scrisă în KV `xc-config-staging`
  (cheia `modul:chat`), cu permisiunea nouă `modules.manage` (super-admin: un modul pornit costă bani
  la fiecare apăsare). **Stingerea oprește și rutele**, nu doar bula, iar implicitul e STINS peste tot.

- **Probat cap-coadă pe local**, cu sesiune adevărată: „ce slujbe sunt duminică?" → orele reale din
  bază; „trimite-mi foaia cu sfinții de duminică" → PDF de 54 KB făcut prin Browser Rendering, așezat
  în R2 și descărcat prin `/program/chat/fisier/<cheie>`. Bula e în pagină, cu salutul cerut.

- **⚠️ Două lucruri prinse abia la proba cap-coadă** (11.09.2026, seara):
  1. **Rezultatul unei unelte trebuie să poarte `tool_call_id`**, iar apelurile cerute trebuie puse
     înapoi în istoric ca mesaj al agentului. Fără ele, modelul primește rezultate care nu se leagă
     de nicio cerere de-a lui și **tace** — chatul răspundea „N-am reușit să duc asta la capăt".
  2. **Un răspuns prea mare rupe totul**: `calendar.cauta` întorcea ziua liturgică întreagă pentru
     fiecare potrivire; tăiat la 2500 de caractere înainte de model, JSON-ul se rupea la mijloc și
     modelul tăcea la fel. Acum dă doar data, denumirea și rangul, cel mult zece zile. **Regula
     pentru acțiunile noi: răspunde cu ce se poate citi, nu cu tot ce ai.**

- **⚠️ O CHEIE NOUĂ DE PERMISIUNE CERE REPUBLICAREA LUI `xc-authz-staging`** (pățit cu
  `modules.manage`, 11.09.2026): cheia trăiește în `@xc/contracts`, deci un `authorization-worker`
  publicat mai demult n-o recunoaște, o respinge la validare, iar `ClientAutorizare` traduce orice
  răspuns prost în **REFUZ**. Semnul: un super-admin vede „Îți trebuie permisiunea X" pe o pagină
  nou-nouță. Nu căuta în aplicație — republică întâi authz.

- **⚠️ Secretul intern nu se poate citi înapoi de la Cloudflare.** La adăugarea unui worker nou cu
  acțiuni se generează altul și se pune pe **toți** deodată, altfel jumătate din platformă nu se mai
  recunoaște: `head -c 32 /dev/urandom | od -An -tx1 | tr -d " "` → `wrangler secret put SECRET_INTERN
  --env staging -c <worker>/wrangler.jsonc`, la fiecare worker cu acțiuni.

- **Comutatorul de creier** (panoul de Module): `workers-ai` (acum), `gateway` — prin **AI Gateway**,
  pasul următor cerut de utilizator: codul îl așteaptă, mai trebuie doar creată poarta și scris
  numele ei în varsa `AI_GATEWAY` a lui `chat-worker` — sau `fara`, când vrei doar interfața, fără
  niciun ban cheltuit. **Implicit CONECTAT**: modulul pornit înseamnă modul care răspunde.

- **⚠️ `wrangler dev` nu se mai vede ca „wrangler dev" în `ps`** — procesul se numește
  **`MainThread`** (`ps -eo pid,ppid,comm`). Verificarea veche (`ps -ef | grep -c "[w]rangler dev"`)
  dă **0** deși sesiunea rulează, iar pornirea următoare cade cu „Address already in use (8787)".
  La repornire: caută `MainThread` ȘI `workerd`, omoară întâi părintele, apoi copiii.

- **⚠️ `pnpm dev` cere de acum tokenul Cloudflare în mediu**: binding-ul `ai` n-are variantă locală,
  wrangler face proxy spre Cloudflare și cade cu „Failed to start the remote proxy session" fără el.
  Pornire: `set -a; . /backup/_setup/cloudflare.env; set +a; pnpm dev`.


- **Săptămânile deschise DIN ARHIVĂ au drum de întoarcere** (user, 16:24). Linkurile din pagina
  arhivei poartă acum **`?din=arhiva`**, iar de semnul ăsta atârnă două lucruri: **„← Înapoi la
  arhivă"** deasupra titlului și **marcajul roșu rămas pe segmentul Arhivei** din pastilă (marcat, dar
  tot apăsabil — neapăsabil e numai pe pagina arhivei însăși). Butonul e un **link adevărat** spre
  `/arhiva`; JS-ul îl face să dea **pasul înapoi al browserului** atunci când chiar de acolo s-a venit
  (`document.referrer` conține `/arhiva`), ca arhiva să se redeschidă derulată unde a rămas omul, nu
  de sus. Fără JS, ori intrat de-a dreptul pe adresă (link trimis, semn de carte), linkul duce cinstit
  la `/arhiva`. **De ce nu din `referer`**: acela lipsește des (și la trecerea https→http, și la unele
  telefoane), deci pagina ar arăta altfel de la o deschidere la alta — cu tot cu cache-ul de muchie.
  **Și în pagina arhivei, săptămâna pe care tocmai ai apăsat se vede încercuită roșu la întoarcere**
  (`.baton a.vazuta`). ⚠️ **NU din `:visited`**: așa fusese făcut întâi, iar userul a respins-o la
  16:38 — „vreau doar ca, atunci când dau înapoi, să se vadă unde am apăsat… doar pe moment, atunci.
  Nu vreau să fie ținut minte nu știu câte zile sau ore" — și, pe deasupra, nici nu se vedea: la
  „înapoi" pagina vine din **bfcache**, iar browserul nu repictează starea „vizitat".
  Cum merge acum: clasa se pune **la apăsare**, deci la întoarcerea din bfcache e deja în DOM, cu tot
  cu derularea paginii; dacă pagina chiar se reîncarcă, semnul se reface din `sessionStorage`, **o
  singură dată** — cheia se șterge la folosire, ca la un refresh făcut de om să nu mai rămână nimic.
- **ABONAREA a revenit în interfață, dar goală pe dinăuntru** (user, 16:36 — cerut anume: „momentan,
  să nu facă nimic"). Buton cu plic în rândul de unelte, **îndată după pastilă** („după săptămâna
  viitoare, abonare"), numai la omul **fără** drepturi de admin — și cel neintrat, și utilizatorul
  simplu. Fereastra e un `<dialog>` nativ: titlu „Abonare", textul cerut, câmp de e-mail și două bife
  („Vreau să fac cont.", „Sunt de acord cu termenii și condițiile."). Formularul dinăuntru e
  `method="dialog"`, deci **orice buton din el doar închide** fereastra, fără să trimită nimic — și
  „Abonare", și X-ul; Escape vine de la browser. Când abonarea se leagă cu adevărat, formularul capătă
  `action` către `POST /abonare` — ruta a rămas întreagă tot timpul, doar bucata de interfață lipsea.
  ⚠️ **Pe telefon, la utilizatorul simplu, rândul se rupe acum în două**: cele patru lucruri (bulina,
  „Săptămâna viitoare" scrisă, abonarea, întrerupătorul) cer ~380 px, iar un telefon de 390 px are 335
  de folosit. Nimic nu se taie — pastila rămâne sus, cât ecranul, iar abonarea și întrerupătorul
  coboară, lipite la dreapta. Ca să încapă tot pe un rând ar trebui prescurtat textul („Săpt.
  viitoare") sau strâmtată bulina; userul știe și alege.
- **⚠️ Carcasa are stiluri GLOBALE pe `form` și `label`** (`form { display:flex; gap:8px; flex-wrap:wrap }`,
  `label { font:600 12px … }`), făcute pentru rândurile de căutare. Orice formular nou trebuie să și
  le scoată: fără `display:block` pe formular, titlul, textul și bifele ferestrei se înșirau ca niște
  jetoane, fiecare cât scrisul lui, iar X-ul rămânea lipit de titlu.
- **Antetul pe telefon are acum DOUĂ înfățișări, după drepturi** (patru cereri ale userului, 16:02).
  Pastila omului **fără** drepturi de admin poartă clasa **`larga`** (o decide `ctx.eAdmin`) și, sub
  600 px: **se întinde cât rândul** („cele două butoane de la stânga… să fie dispuse pe toată
  lungimea meniului"), segmentul „viitoare" scrie **cuvintele ȘI săgeata**, în ordinea asta („înainte
  de săgeată să scrie «Săptămâna următoare»+săgeată"), iar **bulina stă lată** — 22 px în laturi, „să
  fie mai ușor de apăsat". La **admin**, unde rândul e plin, butoanele-iconiță s-au făcut **pătrate**:
  padding de 9 px în laturi, cât cel de sus din carcasă, deci ținte de ~36×36 („să fie atâta spațiu
  sus cât este stânga dreapta"). **Și pastila lui ia spațiul rămas** (cerere de la 16:20: „butonul cu
  săgeata pentru admini cât tot spațiul disponibil rămas") — `flex:1 1 auto` pe pastilă și pe `.viit`,
  deci prisosul se adună tot în segmentul săgeții. Acolo măsura de pornire rămâne `auto`, nu 0:
  înăuntru sunt numai iconițe, deci nu umflă nimic, iar rândul se rupe cinstit când chiar nu mai
  încape, în loc să le taie. Se vede pe ecranele late (la 430 px pastila crește de la 115 la 159);
  la 390 px prisosul e de 4 px, deci abia se simte.
  ⚠️ Două capcane, de ținut minte: **`flex:1 1 0`, nu `1 1 auto`** pe pastila largă — cu măsura de
  pornire `auto`, cuvintele o umflau peste lățimea ecranului și întrerupătorul sărea pe rândul doi,
  exact lucrul de care scăpaserăm; și **fără backtick în comentariile CSS**, fiindcă stilul e un
  template literal și un backtick în comentariu închide șirul (erori `tsc` fără legătură cu locul).
  Cifrele de acum, la un super-admin: 331 px din 335 la un telefon de 390, 292 din 305 la unul de 360
  (acolo butoanele lasă câte 2 px și cade bara verticală). **Cuvântul a rămas „viitoare"**, cel ales
  dimineață; userul scrisese „următoare", l-am întrebat dacă vrea schimbarea (ar fi în două locuri:
  butonul și momentul din pagină).
- **Antetul, pe TELEFON, încape acum pe o singură linie** (user: „nu încap restul butoanelor pe
  aceeași linie… săgeată-dreapta"). Sub 600 px, două lucruri își lasă scrisul și rămân doar cu
  semnul: **„Săptămâna viitoare" devine o săgeată-dreapta** (`IC_INAINTE`; amândouă înfățișările se
  scriu — `.lung` și `.scurt` — iar CSS-ul o alege pe cea potrivită, ca la butonul de descărcare) și
  **PDF/JPG rămân doar iconițele felului** (`.fel` ascuns; de aceea au primit `aria-label`, altfel
  butoanele ar fi rămas fără nume). Restul segmentelor se strâng la padding, iar sub **380 px** cade
  și bara verticală dintre grupuri. Pe desktop nu se schimbă nimic.
  **Cifrele** (măsurate pe pagina unui super-admin, care are cele mai multe butoane): rândul cerea
  **431 px**, iar un telefon de 390 px are 335 de folosit, unul de 360 doar 305. Numai cu săgeata ar
  fi cerut 346 — încă se rupea; de aceea au căzut și textele hârtiilor. Acum cere 307 la 390 px și
  288 la 360. Sub ~330 px tot se rupe: `flex-wrap` a rămas dinadins, ca plasă de siguranță.
- **Zilele roșii cu slujbe nu se mai împart în două coloane** (user: „la vizualizarea dublată a zilei
  de duminică să nu se mai afișeze text deloc în partea dreaptă… la fel și la sărbătorile cu cruce
  roșie, care în mod sigur deja au slujba setată"). Duminicile și zilele cu cruce roșie **care au
  slujbe** rămân pe o singură coloană, cât e pagina de lată: programul lor spune deja sărbătoarea și
  sfinții, pe rândurile „→" ale slujbei de dimineață, iar coloana calendarului le scria a doua oară.
  Coloana **nici nu se mai scrie** (`cuCal` în `ziuaHtml`), iar ziua poartă clasa `fara-cal`, care
  desface grila de două coloane. Zilele roșii **fără** slujbe rămân împărțite — acolo calendarul e
  singurul care spune ce zi e. Regula exista din 10.09, dar numai pe telefon (ascunsă din CSS);
  acum e peste tot, **și în poza JPEG** — poza folosește aceeași `zileleSaptamanii` și același stil,
  deci n-a fost nimic de făcut separat pentru ea. Publicat pe staging (program 0.4.1).
- **Pagina arhivei**: titlul e acum doar „Arhiva", iar sub el a rămas doar numărătoarea („654
  săptămâni, din 2014 până azi") — propoziția „Importate din site-ul vechi; se completează de aici
  înainte" a ieșit la cererea userului.
- **Probele pe roluri, mai simple** (trei cereri ale userului, plus una pe parcurs). **Banda roșie
  de jos a ieșit cu totul** („să dispară banner-ul de jos. Nu am nevoie de el"), iar semnele ei s-au
  mutat în meniul de cont: **numele contului din antet e scris roșu** cât timp porți o mască, iar
  cele trei rânduri „Vezi ca …" sunt acum **comutatoare** — rândul măștii purtate e roșu și, apăsat
  a doua oară, te întoarce la super-admin. Butonul „Revino la super admin" a dispărut, n-are ce
  face. ⚠️ Sub masca „neautentificat" antetul scrie tot „Cont", dar cuvântul deschide un meniu cu
  un singur lucru în el (comutatoarele) — **acela e acum singurul drum de întoarcere**; fără el,
  super-adminul mascat rămâne închis afară. Probe noi în `tests/carcasa.test.ts` (55 de teste).
  **Întrerupătorul „Calendar" din program pornește APRINS** („starea implicită este On"), iar becul
  lui **nu mai e roșu**: aprins se umple cu cerneală și bila se face albă. Ca să nu clipească
  pagina, clasa `cu-calendar` vine de pe server (`clasaCorp`), iar JS-ul doar o scoate dacă omul a
  stins-o cu mâna lui. Program 0.4.0; publicate toate cele 6 aplicații pe staging.
- **Întoarcerea la pagina de unde ai plecat**, două cereri ale userului într-una:
  (1) comutatoarele „Vezi ca …" din meniul contului te lasă **în pagina în care erai**, doar o
  reîncarcă — nu te mai duc în pagina contului. Cauza era `spre`, construit din `req.url`: prin
  gateway workerul vede `http://127.0.0.1/…`, adresă pe care contul n-o recunoaște. Acum toate
  aplicațiile folosesc `adresaPaginii(cfg, url)` din `@xc/config`.
  (2) **după intrare** te întorci de unde ai plecat: linkul „Cont" din antet poartă pagina de acum
  (`?spre=`), care călătorește prin cele două formulare (câmp ascuns `spre`) până la cele șase
  cifre. Dacă nu se știe de unde ai venit → **Home**, nu pagina contului (contul nou își păstrează
  urarea). Publicat: cont/home/tipic/calendar 0.1.2, program 0.3.3, admin.
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
