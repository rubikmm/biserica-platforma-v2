# NOTES — biserica-platforma-v2

Memoria proiectului. Călătorește cu repo-ul.

⚠️ **Aici stau amănuntele**: cum arată interfața fiecărei aplicații și de ce, ce s-a portat și cu ce
deosebiri, capcanele tehnice, rețetele de lucru, jurnalul. Memoria agentului (`memory/repere.md`)
ține doar **regulile care se aplică mai departe** și trimite încoace. Curățenia asta s-a făcut pe
12.09.2026, la cererea utilizatorului, fiindcă `repere.md` ajunsese la 65 KB cu istoric de interfață.

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
3. ⏳ **Portarea aplicațiilor**: ✅ calendar (A1), ✅ program (A2), ✅ tipic (A9), ✅ biblia (A10),
   ✅ biblioteca (A12), ✅ buletin (A3), ✅ newsletter (A8), ⏳ curățenie (A6), apoi A7 → A5 → A4 →
   A13 se stinge.
   ⚠️ Biblioteca, buletinul și newsletterul au fost cerute **înaintea rândului lor** (user,
   13.09.2026); curățenia rămâne următoarea.

**Buletinul (A3)**: foaia periodică față-verso și arhiva ei — **619 numere apărute din 2012
încoace**. Portat pe 13.09.2026 din `biserica-buletin` v0.5.0. Datele s-au copiat în resurse NOI:
**D1 `xc-buletin-staging`** (`63edbc94-001d-4097-8a40-9ddd98227e94`) — 619 rânduri, **4.785.016
semne de text, exact cât în V1** — și **R2 `xc-buletin-staging`** — 1856 de obiecte, 964 MB (PDF-ul
și două poze ale paginii întâi, `<an>/buletin-<nr>-<data>[-mic].<ext>`).

**Proba portării**: `/v1/curent`, `/v1/arhiva?an=2019` și `/v1/numar/2026/615` ies din V2
**identice octet cu octet** cu cele din V1 din producție (doar rădăcina adresei diferă), iar PDF-ul
numărului curent are același md5.

Ce s-a schimbat față de V1, și de ce:
- **lista de abonați nu mai e a aplicației**: V1 avea tabelul `abonati` (e-mail, nume, `persoana_id`)
  în baza lui A3. Tabelul **nu s-a copiat** — în V2 abonarea e o **audiență a comunicării**
  (`buletin-abonati`), iar aplicația nu ține nicio adresă;
- **abonarea arată ca la Program**: butonul cu plic + fereastra, ca la Calendar și Tipic, nu câmpul
  de e-mail din rândul de unelte al V1. ⚠️ Ca și acolo, **fereastra nu trimite încă nimic**
  (`<form method="dialog">`); rutele `POST /abonare` · `/dezabonare` sunt întregi și scriu în
  audiență — se leagă odată cu celelalte trei;
- **modul de probă a ieșit** cu totul (`/proba`, persoanele inventate, `PROBA=da`): local = staging;
- carcasa vine din `@xc/ui`, iar cine e omul se află din sesiunea centrală.
- **zilele scurte din raft** se scriu cu `LUNI_SCURT` din `@xc/ui` („mart.", „noiem."), unde V1
  scria „mar.", „noi." — singura vorbă schimbată; restul textelor sunt cuvânt cu cuvânt din V1.
- ⚠️ `plat()` din `src/depozit.ts` e funcția V1 **neatinsă**, și trebuie să rămână așa: păstrează
  lungimea literă cu literă, iar căutarea taie fragmentul din `text` la poziția găsită în
  `text_plat`. `faraDiacritice` din `@xc/ui` NU e bună aici (poate schimba lungimea).
- ⚠️ **6 numere au semnul U+FFFD în text** — așa au venit din V1 (scoaterea textului din PDF), nu
  s-au stricat la copiere: V1 și V2 au aceleași 6 rânduri și același număr de semne.
- **Redactarea unui număr nou** (șablonul față-verso, programul cerut de la A2, sfinții de la A1)
  nu există nici în V1; rămâne de făcut, ca acolo.
- `Range` pe PDF-uri: ca în V1, se răspunde întreg (fișierele au ~0,7 MB). Tipicul, cu PDF-uri de
  zeci de MB, răspunde pe bucăți — aici n-a fost nevoie.

**Newsletterul (A8)**: **arhiva PUBLICĂ a celor 459 de numere** trimise pe email din 2017 încoace,
aduse în V1 din MailPoet și re-randate cu chiar motorul MailPoet. Portat pe 13.09.2026 din
`biserica-newsletter` v0.6.5. Depozitul: **R2 `xc-newsletter-staging`** — 1423 de obiecte, 722 MB
(`lista.json`, `cauta.json`, `stiri/<id>.html`, `media/uploads/…`), copiate obiect cu obiect.
N-are D1: fișele și textele stau în depozit.

**Proba portării**: corpul unui număr (`/n/535`) iese din V2 **identic octet cu octet** cu cel din
V1 din producție (13.412 semne, același md5), iar o poză din `media/` are aceiași octeți.

Ce s-a schimbat față de V1, și de ce:
- ⚠️ **dus-întorsul tăcut prin Cont a ieșit**. În V1, A8 n-avea poartă și nici cookie comun cu
  celelalte aplicații, așa că întreba Contul „îl cunoști?" la prima navigare (`tacut=1`, cookie
  `newsletter_recunoscut`, cel mult o dată pe oră) **numai** ca să scrie numele omului în antet. În
  V2 sesiunea e a platformei și se citește dintr-o dată de la `IDENTITATE` — deci ocolul, cookie-ul
  și `private, no-store` de pe toate paginile nu mai au rost. Paginile se pot iar ține în cache
  când nu poartă niciun nume;
- carcasa vine din `@xc/ui`, nu din `src/comun/` copiat în aplicație.
- ⚠️ **Trimiterea nu există nici acum** — n-a existat nici în V1 (A8 era numai arhivă). Când se va
  face, scrisoarea pleacă prin `communication-worker`, iar abonații sunt o audiență a lui.

**Biblioteca (A12)**: catalogul bibliotecii de la Hanul Colței — **1349 de titluri, 1964 de
exemplare, 520 de autori, 297 de edituri**. E un **catalog, nu o bibliotecă de texte**: cărțile se
împrumută fizic, de la pangar. Portată pe 13.09.2026 din `biserica-biblioteca` v0.15.0.
Depozitul: **`xc-biblioteca-staging`** (R2) — 2996 de obiecte, 164 MB, copiate obiect cu obiect din
bucketul V1 (`catalog.json`, `imbogatire.json`, coperțile în trei mărimi, 2 PDF-uri); **D1
`xc-biblioteca-staging`** (`cbf83fce-8c2a-4548-a576-929f460d0bd3`) pentru cereri, scrisori și
cererile de acces — baza V1 era **goală**, deci nu s-a copiat niciun rând.

**Proba portării, cea care contează**: `/v1/carti`, `/v1/autori` și `/v1/edituri` ies din V2
**identice octet cu octet** cu cele din V1 din producție (verificat 13.09.2026). Toată logica grea —
despărțirea căsuței de autor în oameni, unirea felurilor de a scrie același om (`ACEIASI`, 33 de
perechi), întregirea inițialelor (`INTREGI`), curățarea numelor de edituri — a trecut neatinsă.

Ce s-a schimbat față de V1, și de ce:
- **catalogul e deschis**: în V1 poarta cădea după `/v1`, deci și fișa unei cărți cerea cont; acum
  cere cont doar ce e AL OMULUI („totul la liber, deocamdată");
- **scrisorile chiar pleacă**. În V1 se compuneau și rămâneau în tabel cu `trimisa_la` gol: platforma
  n-avea furnizor de email, iar A12 n-avea voie să ceară adresa nimănui. În V2 pleacă prin
  `communication-worker`, iar adresa se cere de la identitate **în clipa trimiterii** și nu se
  păstrează. Tabelul `scrisori` a rămas ca jurnal al bibliotecii, cu o coloană nouă, `necaz`:
  ce n-a plecat se vede la `/pangar/scrisori`, cu pricina scrisă. **Nu pretindem că a plecat ceva
  când n-a plecat** — regula ținută din V1;
- **rolul de pangar e o permisiune a platformei**, `library.manage`, nu `rol === "admin"` citit
  local; dreptul omului de a cere cărți e `library.borrow`, dat individual la cont;
- `persoana_id` → `user_id`; **modul de probă a ieșit** cu totul (în V2 local = staging);
- `/propuneri` (unealta de îmbogățire) trăia în V1 numai pe gazda locală, fiindcă acolo nu exista
  autorizare; în V2 e o pagină ca oricare, păzită de `library.manage`.

⚠️ **Cererile de acces (`cereri_acces`) au fost păstrate anume** (user, 13.09.2026), deși se abat de
la „drepturile stau într-un loc": tabelul ține **cererea**, niciodată dreptul. Omul apasă „Solicită
acces" în „Cărțile mele", pangarul o vede pe ecranul lui și o închide după ce dreptul a fost dat din
`/admin`. Nimic din ce scrie acolo nu acordă vreun drept.

**Biblia (A10)**: Vechiul și Noul Testament, pe cărți, capitole și versete — ediția **sinodală**,
preluată în V1 de pe bibliaortodoxa.ro (hotărâre user, 27 aug. 2026). Cele **80 de cărți** (39 VT +
14 anaginoscomena + 27 NT) stau în JSON, una pe fișier, în depozit propriu: **`xc-biblia-staging`**,
bucket NOU — s-au copiat din bucketul V1 `biserica-biblia`, obiect cu obiect, nu s-a refolosit nimic.
Portată pe 13.09.2026 din `biserica-biblia` v0.8.4, cu afișarea, markup-ul și textele de acolo.
Ce s-a schimbat față de V1, și de ce:
- pagina e **deschisă** (V1 cerea cont) — „totul la liber, deocamdată";
- carcasa vine din `@xc/ui`, nu din `src/comun/` copiat în aplicație;
- textele văzute de om s-au scris **cu diacritice** acolo unde V1 le pierduse („Căutare în text:",
  „80 de cărți citite", „Nu am înțeles referința") — aceleași cuvinte, aceeași ordine;
- **PDF-urile n-au ce căuta aici**: Biblia n-are cărți scanate, ca Tipicul.
Rutele sunt cele din contractul V1, întregi: `/`, `/carte/<slug>[/<cap>]`, `/cauta?q=`, `/pasaj?ref=`
(redirect la capitol), plus API-ul `/v1`, `/v1/carti`, `/v1/pasaj?ref=`, `/v1/cauta?q=[&carte=&max=]`
și **adresa stabilă** `/v1/<slug>/<cap>[/<verset>[-<până>]]`.
⚠️ **Adresele stabile sunt PERMANENTE** odată publicate: buletinul și newsletterul citează prin ele.
⚠️ **Calendarul cere textul prin Service Binding** (`BIBLIA`), nu prin internet: până pe 13.09.2026
`URL_BIBLIA` arăta spre worker-ul V1 `biblia.sfantul-ilie.ro`, deci pericopele din Calendar și din
Tipic veneau, pe staging, tot din V1. Acum `URL_BIBLIA` rămâne doar pentru **legătura pe care o apasă
omul** (`/carte/<slug>/<cap>#v<nr>`); în dev e gol și se face `/biblia`, calea gateway-ului.
Citirea referinței (versete discontinue, treceri peste capitol, „și") e codul V1 mutat cuvânt cu
cuvânt, cu probă a lui: `tests/referinte-biblia.test.ts`.

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
- ✅ **cărțile scanate au intrat** (13.09.2026): cele trei PDF-uri (ROEA 0,4 MB, Anuarul 41 MB,
  Mineiul pe noiembrie 67 MB) s-au copiat din R2-ul V1 în depozitul NOU `xc-tipic-staging` (R2,
  binding `TEXTE`), iar **cardul care duce la pagina zilei din carte** e înapoi în pagină, cu
  adresele publice din V1 neatinse: `/roea-2026.pdf`, `/anuar-2026.pdf`, `/minei-noiembrie.pdf`.
  Se răspunde și la cereri pe bucăți (`Range` → 206), altfel cititorul de PDF ar trage 67 MB ca să
  deschidă o pagină. Harta e în `src/carti-pdf.ts`, cu cheia = **codul cărții** din depozit
  (`roea`, `anuar`, `minei-11`): lunile Mineiului culese de pe sit n-au PDF și n-au nici card.
- **numele zilei e cel din V1** (13.09.2026): `2026-11-22 — DUMINICĂ` — data cifre și ziua **așa cum
  o scrie cartea**, nu ziua săptămânii calculată de noi și nu data lungă.
- **forma veche a adresei** (`/zi/<data>`, din V1) redirectează permanent (301), ca legăturile
  tipărite să nu cadă după cutover.
- **fără bulă de chat** (user, 13.09.2026: „6 nu punem") — acțiunile rămân, bula nu se montează.

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
   - ⚠️ **credite AI Gateway** — fără ele nici Claude, nici Workers AI nu răspund (402). Dashboard:
     AI Gateway → Credits Available → Manage → Top-up. Apoi un token dedicat cu „AI Gateway – Run"
     în locul celui mare (`wrangler secret put AI_GATEWAY_TOKEN --env staging`);
   - bula e montată doar pe `program`; `calendar` și `tipic` au acțiuni, dar nu și bulă (aceleași
     trei linii: `modulChat`, `ruteaza`, `chat` în opțiunile comune ale paginilor);
   - ✅ acțiunile care scriu + confirmarea sunt probate cap-coadă pe program (11.09, seara);
     rămâne `comunicare.trimite_obiect` (trimiterea unei foi la o audiență) — a comunicării;
   - nimic nu e publicat pe staging: acolo trebuie `wrangler secret put SECRET_INTERN` la fiecare
     worker cu acțiuni (`program`, `calendar`, `tipic`, `chat`) și migrația bazei `xc-chat-staging`;
   - de probat cu ochii pe telefon: bula pe ecran mic (panoul ia toată lățimea sub 480 px);
   - ⚠️ **`program.retrage_validarea` (nou, 12.09.2026) nu e încă în lista de unelte din panou** —
     până nu i se scrie numele acolo, modelul n-o vede și regula „validat → propus" din Îndrumări
     rămâne fără braț. După ce se adaugă: reformulat îndrumarea ca să cheme unealta pe nume și
     rerulate probele (a cincea unealtă îngreunează alegerea pentru modelele mici).
2. **Ce a mai rămas deosebit între local și public** (user, 11.09.2026: „să nu fie nicio diferență
   între testare și public"). Trei deosebiri, toate **structurale**, nu de afișare:
   - **emailul nu poate pleca din `wrangler dev`** — de aceea codul apare în pagină și `123456`
     merge oricând pentru super-admin;
   - **un singur host, cu căi** (`/program`, `/cont`) față de subdomenii pe staging;
   - **cache**: în dev paginile ies `no-store`, pe staging `max-age=300` — dinadins.
     (`calendar` n-are ramura asta: și local cachează 5 min.)
3. ✅ **PDF-urile cărților tipicului** — copiate pe 13.09.2026 în `xc-tipic-staging`; cardurile sunt
   înapoi în pagină. A rămas: **Mineiul pe celelalte 11 luni** n-are scanare (lunile vin de pe sit),
   deci acolo cardul lipsește pe drept.
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
10. **Treptele rolului — numai la calendar, ori peste tot?** (13.09.2026) Filtrele-cruce atârnă de acum
    de rol; regula a fost cerută pentru calendar. De întrebat utilizatorul dacă același fel de trepte
    se cuvine și la Program/Tipic, și ce anume se închide acolo — altfel platforma capătă câte o regulă
    de vizibilitate pe aplicație, ceea ce e tocmai ce n-a vrut la structura mare.

11. **Biblia (A10), ce a rămas după portare** (13.09.2026):
    - **fereastra de abonare de la Tipic nu e legată de rute** — ca la Calendar și la Program, e
      deocamdată numai înfățișare; când se leagă una, se leagă toate trei deodată;
    - **căutarea în text citește toate cele 80 de cărți din R2** la fiecare cerere rece (așa era și în
      V1). Merge, dar dacă ajunge să fie folosită des, textul cere un index — nu o memorie mai mare;
    - Biblia **n-are acțiuni de chat** (`/_actiuni`): calendarul e cel care vorbește cu ea, deci o
      unealtă „caută în Biblia" ar dubla legătura. De hotărât dacă se vrea totuși;
    - ⚠️ **CSS-ul pastilei e acum în trei copii** (Program, Calendar, Tipic). La a patra cerere, locul
      lui e `@xc/ui` — dar atunci se republică toate cele șase aplicații care folosesc carcasa.

12. **Biblioteca (A12), ce a rămas după portare** (13.09.2026):
    - ⚠️ **fluxul de împrumut n-a fost probat cu un om adevărat**: cererea, ecranul pangarului și
      scrisorile cer sesiune, iar prin curl nu se poate intra (cookie-uri `Secure`). Probate sunt
      schema, interogările și poarta (rutele personale duc la cont); **de mers o dată cap-coadă din
      browser**, cu un cont care are `library.borrow`, și un al doilea cu `library.manage`;
    - **cele două chei noi nu sunt date nimănui**: `library.manage` vine cu rolul de admin, dar
      `library.borrow` se dă individual, la cont, din `/admin`. Până atunci nimeni nu poate cere o
      carte, iar cutia de pe fișă scrie asta;
    - **cronul de 6:00 UTC e înregistrat, dar n-a rulat încă** (prima oară mâine dimineață). Local se
      declanșează cu `curl http://127.0.0.1:8787/cdn-cgi/local/scheduled`;
    - ⚠️ **foaia de îmbogățire din depozit are 800 de fișe, cea de pe discul V1 are 803**: în V1 s-au
      strâns trei fișe după ultima urcare și n-au mai ajuns niciodată sus. Am copiat fidel ce era în
      depozitul V1. Se aduc la zi cu `node apps/biblioteca/unelte/urca.mjs sus` — de întrebat întâi;
    - **cele 131 de propuneri de îmbogățire te așteaptă** la `/propuneri` (aceleași din V1, cu tot cu
      hotărârile de până acum: ce ai respins nu se mai propune). Uneltele merg în V2 — probate:
      `actualizeaza.mjs raport` (1349 → 1349, zero schimbări) și `propuneri.mjs`;
    - **periodicele** (fila a doua a foii parohiei, 651 de rânduri) n-au intrat nici în V1: e altă
      formă de date, un periodic fiind un teanc de numere. Rămâne întrebarea deschisă din V1;
    - **abonarea nu există la bibliotecă** (nici în V1 n-avea). Dacă se vrea, e a treia regulă de
      abonare după Calendar/Program/Tipic — se hotărăște o dată, pentru toate.

13. **Buletinul (A3) și Newsletterul (A8), ce a rămas după portare** (13.09.2026):
    - ⚠️ **abonarea buletinului**: butonul și fereastra sunt acolo, rutele scriu în audiența
      `buletin-abonati`, dar **fereastra nu trimite încă nimic** — ca la Calendar, Program și Tipic.
      Acum sunt PATRU ferestre de legat deodată; e cea mai coaptă datorie a interfeței;
    - ⚠️ **fereastra de abonare e a patra copie de cod** (Program, Calendar, Tipic, Buletin): HTML-ul
      și ~35 de rânduri de CSS stau la fel în toate patru. La legarea de rute, locul lor e `@xc/ui` —
      se face o dată, cu republicarea aplicațiilor care folosesc carcasa;
    - **niciuna din cele două n-are bulă de chat și nici `/_actiuni`**. De hotărât dacă buletinul
      merită verbe („dă-mi numărul de duminica trecută", „caută «Crăciun» în buletine") — atunci
      intră și în lista `APLICATII_CU_CHAT` din admin, unde acum nu sunt;
    - **redactarea unui număr nou de buletin** nu există (nici în V1): șablonul față-verso, programul
      cerut de la A2 (`/v1/foaie`), sfinții de la A1, apoi urcarea în R2 + rândul în D1. Ăsta e pasul
      care l-ar face pe A3 să PRODUCĂ, nu doar să păstreze;
    - **ținerea la zi a arhivelor**: amândouă s-au copiat o dată, cu mâna. În V1, newsletterul se
      aducea de pe live cu o unealtă rulată manual. Cât timp numerele noi se fac tot în V1, V2 rămâne
      în urmă — de hotărât dacă se pune un cron sau se grăbește cutover-ul;
    - ⚠️ **cele două numere fără PDF** (325/2019-12-25 și 368/2020-12-13) au rămas și în V2 doar cu
      poza — butonul lor scrie „Fără PDF", stins. Întrebarea din V1 (dacă parohia le mai are pe
      undeva) rămâne deschisă;
    - **trimiterea newsletterului** nu s-a portat fiindcă nu există: A8 e numai arhivă, și în V1.

## Aplicațiile de pe staging

| Aplicație | Adresă | Ce ține |
|---|---|---|
| home | `staging.sfantul-ilie.ro` | ușa platformei: lista aplicațiilor. Fără date |
| cont | `cont.staging.sfantul-ilie.ro` | intrarea fără parolă; singurul loc cu date personale |
| calendar | `calendar.staging.sfantul-ilie.ro` | 730 de zile oficiale (2025–2026) + anii calculați |
| program | `program.staging.sfantul-ilie.ro` | 654 săptămâni / 2619 slujbe copiate din V1 |
| tipic | `tipic.staging.sfantul-ilie.ro` | 3 cărți: ROEA 97 zile, Anuar 365, Mineiul 366 |
| biblia | `biblia.staging.sfantul-ilie.ro` | 80 de cărți, ediția sinodală |
| biblioteca | `biblioteca.staging.sfantul-ilie.ro` | 1349 de titluri, 800 de fișe cu copertă; rezervări |
| buletin | `buletin.staging.sfantul-ilie.ro` | 619 numere din 2012 încoace (D1) + 964 MB PDF/poze |
| newsletter | `newsletter.staging.sfantul-ilie.ro` | 459 de numere trimise din 2017 (R2, 722 MB) |
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

## Programul (A2) — interfața, așa cum a cerut-o utilizatorul

Baza afișării e **V1 verbatim** (10.09.2026: „identice ca program.sfantul-ilie.ro"): stilul, markup-ul
și textele din `stil.ts` + `pagini.ts` ale V1. Ce urmează sunt **abaterile cerute explicit** — nu le
„repara" înapoi spre V1.

### Rândul de unelte din antet (refăcut 11.09.2026, trei runde într-o oră — starea finală)

Două grupuri, despărțite de bara verticală:

- **STÂNGA — pastila navigării**, care ia tot spațiul rămas (`flex:1`; prisosul îl ia doar segmentul
  cu scris). Trei segmente: **Arhiva** (iconița cutiei, numai la admini), **bulina** săptămânii de azi
  și **„Săptămâna viitoare"** scris în litere (datele au trecut în `title`/`aria-label`). Segmentul pe
  care ești e roșu și neapăsabil. Navigarea „săptămâna trecută" a ieșit: „nu se mai deschide săptămâna
  trecută, se poate selecta din pagina arhivei".
- **DREAPTA, lipit de margine** (`.unelte-dr`, `margin-left:auto` — 10:48: „tot ce este după bara
  verticală… să fie aliniate la dreapta, dar restul spațiului să fie folosit de butoanele celelalte"):
  **întrerupătorul „Calendar"**, **butonul de download**, **PDF**, **JPG**. Numai pentru admini.
- **Abonarea** stă îndată după pastilă, la omul FĂRĂ drepturi de admin.
- **Căsuța `.nav-jos` a dispărut cu totul** — PDF și JPG au urcat în rând. A căzut și golul de 34 px
  de sub antet.

**⚠️ Butoanele se sting, nu se ascund** (11.09, 23:23: „când intru pe Arhivă, întrerupătorul doar se
dezactivează și la fel și butonul lui de download, acum se ascund și strică interfața"; 12.09, 00:06:
„la fel și pentru admini… să fie doar dezactivate"). Stins = `.gol` (un `<span>` pălit,
`pointer-events:none`), cu pricina scrisă în `title` (`deCeStinsa`). Cele două trepte au rămas drept
de **FOLOSIRE** (`poateLuaHartiile`, fost `vedeHartiile`); **vederea** s-a despărțit de ele: orice
admin vede tot grupul pe orice pagină. Enoriașul tot nu vede hârtiile.

**⚠️ Săptămânile deschise din arhivă poartă `?din=arhiva`** (11.09, 16:24). De el atârnă două lucruri:
butonul **„← Înapoi la arhivă"** deasupra titlului (link adevărat spre `/arhiva`, dar JS-ul îl face să
dea **pasul înapoi al browserului** când chiar de acolo s-a venit — `document.referrer` conține
`/arhiva` —, ca arhiva să se redeschidă derulată unde a rămas omul) și **marcajul roșu rămas pe
segmentul Arhivei** (marcat, dar tot apăsabil; neapăsabil e numai pe pagina arhivei). Nu se ghicește
din `referer`: acela lipsește des și ar face pagina să arate altfel de la o deschidere la alta.

**⚠️ Săptămâna pe care tocmai ai apăsat se vede încercuită roșu la întoarcere** (`.baton a.vazuta`),
pusă de JS. **NU din `:visited`** — încercat 11.09 la 16:32 și respins la 16:38: „vreau doar ca,
atunci când dau înapoi, să se vadă unde am apăsat… doar pe moment". `:visited` nici nu se vedea la
„înapoi": pagina vine din **bfcache** și browserul nu repictează starea vizitat. Acum clasa se pune
**la apăsare**, deci la întoarcerea din bfcache e deja în DOM; dacă pagina chiar se reîncarcă, se
reface din `sessionStorage`, **o singură dată** (cheia se șterge la folosire).

**Pagina arhivei se cheamă doar „Arhiva"** (nu „Arhiva programelor"); sub titlu a rămas doar
numărătoarea („654 săptămâni, din 2014 până azi") — propoziția despre importul din situl vechi a ieșit
la cererea utilizatorului. Nu o readuce.

### Pe telefon

**⚠️ TOT RÂNDUL STĂ PE O LINIE** (11.09, 15:43: „nu încap restul butoanelor pe aceeași linie"). Două
lucruri își lasă scrisul sub 600 px: **„Săptămâna viitoare" devine o săgeată-dreapta** (`IC_INAINTE`,
clasele `.cuv`/`.sgt` scrise amândouă, alege CSS-ul) și **PDF/JPG rămân doar iconițele** (`.fel`
ascuns; de aceea au căpătat `aria-label`). Restul se strânge la padding; sub **380 px** cade și bara
verticală. **Cifre măsurate** pe pagina unui super-admin: rândul cerea **431 px**, un telefon de 390
are 335 de folosit, unul de 360 doar 305. Sub ~330 px tot se rupe — `flex-wrap` a rămas dinadins, ca
plasă. Pe desktop nu s-a schimbat nimic.

**⚠️ ANTETUL ARE DOUĂ ÎNFĂȚIȘĂRI, după drepturi** (11.09, 16:02). Pastila omului **fără** drepturi
poartă clasa **`larga`** (`ctx.eAdmin` o decide) și, sub 600 px: se întinde cât rândul, segmentul
„viitoare" scrie **cuvintele ȘI săgeata** (cerute anume în ordinea asta), iar **bulina stă lată**
(22 px în laturi, „să fie mai ușor de apăsat"). ⚠️ `flex:1 1 0`, NU `1 1 auto`: cu măsura de pornire
`auto` cuvintele umflau pastila peste ecran și întrerupătorul sărea pe rândul doi.

**Și pastila adminului ia spațiul rămas** (16:20): `flex:1 1 auto` pe pastilă (măsura de pornire rămâne
`auto` — înăuntru sunt numai iconițe, deci rândul se rupe cinstit când nu încape, în loc să le taie) și
`1 1 auto` pe `.viit`. La admin butoanele-iconiță s-au făcut **pătrate** (padding 9 px în laturi, cât
cel de sus din carcasă → ținte de ~36×36; „să fie atâta spațiu sus cât este stânga dreapta"), iar
bulina 15 px. Rămâne strâmt: 331 px din 335 la un telefon de 390.

**⚠️ Dacă adaugi ceva în rândul de unelte, măsoară din nou** (rețeta e mai jos).

⚠️ **La utilizatorul simplu rândul se rupe în două**: bulina + „Săptămâna viitoare" scrisă + abonarea +
întrerupătorul cer ~380 px. Nimic nu se taie — pastila rămâne sus, abonarea și întrerupătorul coboară.
Ca să încapă ar trebui prescurtat textul („Săpt. viitoare") sau strâmtată bulina; utilizatorul știe.

### Întrerupătorul „Calendar" și butonul de download

- **Pornește APRINS** (11.09, 11:14: „starea implicită este On"; la 10:47 ceruse invers — dacă revine
  vorba, asta e istoria). Clasa `cu-calendar` vine **de pe server** (`clasaCorp` în `paginaSaptamana`),
  iar JS-ul o scoate doar dacă omul a stins-o — altfel pagina ar clipi pe o coloană la fiecare
  încărcare. localStorage se citește „aprins dacă nu scrie anume «0»".
- **⚠️ Lucrează pe orice săptămână pentru care CHIAR avem calendarul** (12.09.2026: „să fie activ pe
  toate săptămânile din anul curent… unde știm că avem calendarul, dar și pe anii care trec, adică
  anul viitor. Dacă mă uit în arhivă și văd 2026, să pot să văd ecranul împărțit în două coloane").
  Regula e **a datelor, nu a anilor** (`areCalendarulSaptamanii`): niciun an scris în cod, deci când
  calendarul (A1) mai capătă un an, săptămânile lui se aprind singure. ⚠️ `calendarulIntervalului`
  răspunde **mereu** cu șapte zile — ce lipsește îl **împrumută** din anul curent, însemnat
  `aproximativ` (așa se colorează roșu sărbătorile din arhiva veche) —, deci întrebarea nu e „a venit
  ceva?", ci „a venit măcar o zi **adevărată**?". „Măcar una", nu toate șapte: săptămâna călare pe 31
  decembrie e pe jumătate adevărată și e tot o săptămână a anului curent. Azi A1 acoperă **2025–2028**;
  2024 în jos rămâne stins.
- ⚠️ `id="b-calendar"` se scrie **doar pe cel viu**: JS-ul se leagă de id și ar pune `cu-calendar` pe
  body, iar pe săptămânile fără calendar clasa aceea scoate la iveală zilele goale
  (`body:not(.cu-calendar) .zi.goala`).
- ⚠️ A fost scos la 10:01 și repus la 10:47 — utilizatorul lămurise că „fără buton în meniu" se referea
  la **bulină**, nu la el. Nu-l scoate decât la o cerere care-l numește.
- **Becul aprins NU e roșu** (11:14: „întrerupătorul să fie alb"): pista se umple cu `--soft`, bila se
  face `--paper`. Roșul e rezervat locului în care te afli (pastila, masca din meniu).
- **Butonul de download** dă exact ce se vede: aprins → săgeată **dublă** + `?coloane=2`, stins →
  săgeată **simplă** + `?coloane=1`. Se scriu **amândouă înfățișările** (`.poza-1`/`.poza-2`), iar
  CSS-ul o alege pe cea potrivită după `cu-calendar` — JS-ul nu umblă la `href`, deci nu clipește.
  Implicitul rutei a rămas `coloane=2`. Poza calendarului de la A1 a ieșit din antet, definitiv.

### Pagina săptămânii

- **Două coloane**: program stânga, calendar paralel dreapta (zilele fără slujbe apar doar pe dreapta).
- **⚠️ ZILELE ROȘII CU SLUJBE NU SE ÎMPART** (11.09.2026): duminicile și sărbătorile cu cruce roșie
  rămân pe **o singură coloană, cât e pagina de lată** — programul lor spune deja sărbătoarea și
  sfinții, pe rândurile „→" ale slujbei de dimineață, iar coloana din dreapta le-ar scrie a doua oară.
  Coloana **nici nu se mai scrie** (`ziuaHtml` → `cuCal`), iar secțiunea poartă clasa `fara-cal`, care
  desface grila. Zilele roșii **fără** slujbe rămân împărțite. Regula era până atunci doar pe telefon;
  acum e peste tot, **și în poza JPEG** (aceeași `zileleSaptamanii`).
- **Coloana calendarului** arată **sfinții, unul sub altul, cu săgeată în față**, deasupra lor
  denumirea zilei roșie-îngroșată; **fără** pericope (Ap./Ev.), glas și voscreasnă — „cel mai mult mă
  interesează sfinții" (10.09, 17:34). Se construiește din câmpurile zilei (`denumire` + `sfinti`),
  **nu** din `titlu_html`. Culoarea e a rangului, sfânt cu sfânt.
- Deasupra datelor, momentul scrie **„Săptămâna viitoare"** (nu „următoare"), ca butonul.
- În stânga, zilele fără slujbe rămân **complet goale** (fără titlu) — numele zilei se vede în capul
  listei din dreapta.
- **În dev paginile nu se cachează** (`no-store`; pe staging `max-age=300`) — cele 5 minute făceau
  schimbările să pară nefăcute. (`calendar` n-are ramura asta: și local cachează 5 min.)

### Hârtiile

Trei, toate pe aceleași două trepte: **PDF** (foaia A4) și **JPG** (foaia ca poză) în rândul de
unelte, plus **poza paginii** — `GET /v1/poza/saptamana/<luni>.jpg?coloane=1|2` (`.html` pentru probe
locale), la 680 px (măsura `.w`). `zileleSaptamanii` e aceeași și pentru pagină, și pentru poză — nu
le despărți. Fiecare hârtie poartă **iconița felului** ei (`ICOANE.pdf` / `ICOANE.jpg`).

**Toate imaginile generate ies pe fundal DESCHIS** (11.09: „m-am răzgândit"; pe 10.09 ceruse invers) —
și poza programului, și PNG-ul săptămânii din calendar; tema se scrie pe `html`. Titlul pozei e
intervalul **calculat** (`titluSaptamanii`), ca pe foaia A4 — nu cel din bază, care vine din V1 cu
cratimă în loc de linie de dialog. În pagină rămâne cel din bază.

**Foaia „Sfinții zilei"** — butonul e **numai al adminilor**. Foaia **nu mai e identică cu V1**
(10.09, 21:05): subsolul (parohia + adresa sitului) a ieșit cu totul, iar Ap./Ev. au ieșit de pe rândul
mărunt — rămân glasul/voscreasna, postul și notele, iar rândul nu se mai scrie dacă rămâne gol. Restul
hârtiilor rămân verbatim V1.

**Sfinții grupați după sursă** (publicat 11.09): foaia scrie **două liste, fiecare cu cartea ei
deasupra** — „Calendarul bisericesc" și pomenirile Mineiului (volumul, ediția și creditul culegătorului
— condiția sursei). Capul de grup se scrie doar când chiar sunt două liste. Pomenirile se cer de la
`tipic /v1/sfinti/<data>` (binding-ul TIPIC + `src/tipic.ts`), nu se țin în program.
**În cascadă, fără repetări** („Calendarul și apoi Mineiul și Tipicul, doar sfinți care nu au fost
menționați mai sus"): potrivirea se face pe **numele proprii** (cuvintele cu literă mare, fără ranguri),
cu toleranță la ortografia altei ediții — Cornelie/Corneliu, Macrovie/Macrobie, Ili/Ilie,
Joachim/Ioachim. Regula greșește **deliberat păstrând**: o pomenire cade doar dacă TOATE numele ei
s-au scris deja.
**Anuarul aproape nu adaugă nimic** și e bine să știi de ce: titlul lui e practic titlul calendarului
oficial (aceeași editură). Grupul lui apare la ~24 de zile pe an, mai ales cu **odovaniile și
înainte-prăznuirile**, pe care calendarul le ține în `titlu` dar NU în `sfinti`. Singurul sfânt în plus
din tot 2026: Sf. Mc. Lup din Tesalonic, 27 octombrie. Textul Anuarului e OCR de pe o scanare, deci
trece printr-o sită — **n-o slăbi**.

### Abonarea

A revenit în interfață (11.09, 16:36), dar **deocamdată nu face nimic** — cerut anume. Buton cu plic
îndată după pastilă, numai la omul fără drepturi de admin; fereastra e un `<dialog>` nativ cu câmp de
e-mail și două bife. Formularul e `method="dialog"`, deci **orice buton din el doar închide** fereastra.
Când se leagă cu adevărat, capătă `action` către `POST /abonare` (ruta a rămas întreagă tot timpul).

## Calendarul (A1) — antetul, refăcut la 12.09.2026

Rândul de unelte al calendarului a fost refăcut într-o singură dimineață, la zece cereri ale
utilizatorului. **TOTUL STĂ PE O SINGURĂ LINIE** (cerut anume, 10:55: „butoanele au coborât jos - să
fie totul pe o linie"), în ordinea: **pastila navigării · Abonare · | · Cruce roșie · Cruce neagră**.

### ⚠️ BARA E UN SET DE FILTRE, nu un rând de destinații

Aceasta e cheia întregului antet (user, 11:12: „tot ce este în bara de sus, cu excepția butonului de
azi, este ca un filtru"). Nu mai există „pagina de sărbători" ca destinație de sine stătătoare: sunt
**stări ale aceleiași liste**, iar bara arată care stare e pusă.

- **Filtrul de lună** — pastila. Alegi o lună, se arată luna aceea.
- **Filtrul de fel** — cele **trei** butoane. **Roșie** lasă zilele cu cruce roșie **și duminicile**
  („rămân doar Sfinții cu cruce roșie și duminicile din acea lună" — duminica e sărbătoare chiar când
  nu poartă însemnul); **neagra** lasă doar zilele cu cruce neagră, fără duminici; **evlavia** lasă
  zilele în care se pomenește un sfânt din lista parohiei. Sunt **reciproc exclusive** (cerut anume) și
  se sting apăsând încă o dată pe cel aprins.
- ⚠️ **BUTOANELE N-AU CUVINTE, nici pe desktop** (user, 13:34: „pe desktop, iconițele cu cruci lasă-le
  fără text… să fie ca pe mobil"). Le deosebește **culoarea crucii** — roșu, negru, mov —, iar numele
  întreg stă în `title` și `aria-label`. De aici vine și spațiul: cu cuvinte, cele trei ar fi cerut
  ~470 px din 680 și pastilei i-ar fi rămas 40; fără ele, pastila are **362 px**, adică șase luni la
  vedere în loc de trei.
- **SFINȚII CU EVLAVIE** (user, 13:31: „mai pune un buton cu o cruce. Culoare diferită") — al treilea
  filtru **nu se sprijină pe calendarul oficial**: e o listă de nume ținută de noi (`SFINTI_CU_EVLAVIE`
  în `pagini.ts`), fiindcă sfinții aceștia sunt scriși în calendar **fără cruce** (rang `simplu`) și
  n-ar apărea în niciun alt filtru.
  ⚠️ **LISTA VINE DIN ARHIVA PROGRAMULUI** (user, 14:17: „pune toți sfinții la care am făcut
  priveghere"): 40 de slujbe numite „Priveghere" între 2017 și 2025, la **18 sărbători** — plus
  Sf. Cuv. Porfirie Cavsocalivitul, cerut anume la 13:31, la care nu s-a privegheat. În frunte:
  hramul (Sf. Proroc Ilie, 20 iulie, de 7 ori) și Sf. Cuv. Siluan Athonitul (24 septembrie, de 5 ori).
  Raportul întreg, cu note: `outputs/privegheri-2014-2026.md`.
  ⚠️ **ANII SE SCRIU ÎN PAGINĂ**, sub numele zilei — „**Privegheri:** 2018, 2019, 2021" (user, 14:20,
  cu formatul cerut anume). Se scriu **numai în lista evlaviei**, unde sunt însăși pricina pentru care
  ziua e acolo, și numai dacă sunt: la Porfirie rândul lipsește.
  ⚠️ **Anii se leagă de ZIUA privegherii, nu doar de sfânt** (câmpul `data`, `LL-ZZ`): Sf. Cuv. Dimitrie
  cel Nou se pomenește și pe 13 iulie (aducerea moaștelor), dar privegherile au fost pe 27 octombrie.
  Ziua de iulie rămâne în listă — sfântul e același —, însă fără ani, ca să nu spună ce n-a fost.
  ⚠️ **La Anul Nou sunt trecuți și 2014 și 2015**, deși acolo slujba e scrisă „Te Deum, Utrenia și
  Sfânta Liturghie" (22:30), fără cuvântul priveghere: ca rânduială e tot o priveghere, iar din 2018
  aceeași slujbă e scrisă „PRIVEGHERE". Dacă se cere numai ce poartă numele în arhivă, se scot.
  ⚠️ Potrivirea se face pe numele **curățat** (`slug`: fără diacritice, cu cratime), nu pe numele exact
  din sursă. Cheia trebuie să fie destul de lungă cât să nu prindă pe altcineva: „porfirie" singur ar
  fi prins și pe episcopul Gazei (26 februarie), și pe Sf. Mc. Onisifor și Porfirie (9 noiembrie).
  **Toate cele 19 chei au fost probate una câte una** pe anul 2026: fiecare prinde exact ziua ei.
  ⚠️ **Când se adaugă un nume nou**, caută-l întâi cu `/v1/cauta?q=` și ia cheia din numele găsit acolo.
  Lista trăiește în cod, deci fiecare adăugare cere o publicare — dacă ajunge să se schimbe des, locul
  ei firesc e în D1, cu un rând în pagina de administrare.
- ⚠️ **FILTRELE ATÂRNĂ DE ROL** (user, 13.09.2026, 01:26: „sunt felul cum afectează rolul userului a
  ce vede în app" — regulă nouă, cerută anume, prima abatere de la „totul la liber"): **neautentificatul
  niciun filtru**, **utilizatorul cele două cruci** ale calendarului oficial, **adminul și evlavia**,
  lista parohiei. Poarta e `poateFiltra(ctx, fel)` în `pagini.ts` — `ctx.utilizator` pentru cruci,
  `ctx.eAdmin` pentru evlavie.
  - **Nicio cheie nouă de permisiune**, deci nici republicarea lui `xc-authz-staging`: amândouă
    câmpurile vin din sesiunea **efectivă**, cum o dă identitatea, iar masca „vezi ca" coboară singură
    cu ele (masca „neautentificat" întoarce chiar `SESIUNE_ANONIMA`). De aici și folosul: calendarul e
    locul unde se **vede** ce face masca.
  - **Butoanele fără drept se sting, nu se ascund** (regula din 11–12.09): `<span class="… gol">`,
    palit, cu pricina în `title` („intră în cont ca să filtrezi" / „numai pentru administratori").
    Rândul are aceeași formă la toți trei — probat cu poze pe toate stările.
  - **Poarta e și pe rute, nu doar pe butoane**: `?filtru=` scris de mână se poartă ca și cum n-ar fi
    (luna întreagă, fără eroare), iar `/sarbatori/<fel>/<an>` trimite la anul nefiltrat. **Cititul
    rămâne la liber** — se închide unealta care taie lista, nu conținutul.
  - Proba care păzește treptele: `tests/filtre-calendar.test.ts`.
- **Se păstrează unul pe altul**: schimbi luna, filtrul crucii rămâne pus; schimbi felul, luna rămâne.
  De aceea adresele se scriu una din alta.
- **„Toate lunile"** deselectează luna și întinde filtrul peste anul curent (user, 11:13). Butonul se
  scrie **numai când un filtru de fel e pus** — fără el, „toate lunile" ar însemna tot calendarul, o
  listă de 365 de zile pe care n-a cerut-o nimeni. Pe lista anului e marcat și neapăsabil.
- **Bulina „azi" NU e filtru** (spus explicit) și nu duce filtrul cu ea: înseamnă „arată-mi ziua de
  azi", iar ziua de azi poate să nu fie în lista filtrată.
- **Abonarea** e singurul lucru din bară care nu filtrează — de aceea stă despărțită de bara verticală.
  ⚠️ **O văd TOȚI, și adminii** (user, 13:39: „să lăsăm totuși iconița de abonare și la admini. Că și ei
  se comportă ca un utilizator care poate vor să fie anunțați"). Dimineața ceruse invers și așa fusese
  făcută, ca la Program; acum regula e a **amândurora** — dreptul de a administra nu-l scoate pe om din
  rândul celor care vor să primească vestea. Dacă o schimbi într-un loc, schimb-o în amândouă.
  ⚠️ **Cât timp fereastra e deschisă, pagina din spate nu se derulează** (user, 13:42), și își capătă
  derularea înapoi la închidere. `<dialog>` face pagina inertă, dar rotița mouse-ului tot mișcă
  fundalul — și omul se trezește în altă parte a lunii când închide. Clasa e `body.cu-fereastra`,
  aceeași cu a ferestrei textelor zilei; închiderea se prinde din evenimentul `close`, ca să acopere
  dintr-o singură ascultare și Escape, și butoanele dinăuntru. **La fel în Program.**

Stările și adresele lor:

| ce se vede | adresă |
| --- | --- |
| luna întreagă | `/<an>-<luna>` |
| luna, numai zilele roșii și duminicile | `/<an>-<luna>?filtru=rosie` |
| luna, numai zilele negre | `/<an>-<luna>?filtru=neagra` |
| luna, numai sfinții cu evlavie | `/<an>-<luna>?filtru=evlavie` |
| anul întreg, un fel („toate lunile") | `/sarbatori/cruce-rosie\|cruce-neagra\|evlavie/<an>` |

⚠️ Parametrul se cheamă `?filtru=` de când felurile sunt trei (`?cruce=` era impropriu pentru evlavie);
vechiul nume e primit mai departe, ca sinonim. Tipul `FelCruce` s-a făcut `FelFiltru`, iar `CRUCILE` →
`FILTRE`, din aceeași pricină.

⚠️ **Grila de douăsprezece luni de pe vechea pagină de sărbători a ieșit** — lunile se aleg din pastila
de sus, ca peste tot; în locul ei a rămas doar „Toate lunile".
⚠️ **`/sarbatori/cruce-<fel>/<an>-<luna>` face acum redirect** către `/<an>-<luna>?cruce=<fel>`:
adresa cu lună a fost înlocuită de filtru, dar legăturile vechi nu trebuie să cadă.
⚠️⚠️ **CE ÎNSEAMNĂ „CRUCE NEAGRĂ": HOTĂRĂȘTE SFÂNTUL, NU ZIUA** (user, 12:56: „sfinții cu albastru au
cruce în față / este neagră - de ce nu apar?"). Regula calendarului tipărit: **fiecare sfânt cu semn
are o cruce, iar culoarea ei e roșie numai la zilele cu ținere; în rest e neagră.** Albastrul **nu e
un fel de cruce** — e culoarea cu care Patriarhia scrie sfinții români. Crucea lor e tot neagră.
De aceea la „cruce neagră" intră rangurile `cruce_neagra`, `cruce_albastra` **și** `cruce_nedeclarata`
(sfânt cu semn într-o zi care nu-și declară culoarea — de pildă o duminică).
⚠️ Cifrele, măsurate pe 2026: **113 sfinți români, toți cu cruce, nu apăreau nicăieri**; lista anului
a crescut de la **18 zile la 116**, iar septembrie de la 1 zi la 13. Asta e măsura adevărată a
lucrului — nu te speria de ea și nu o „repara" înapoi.
⚠️ Filtrul întreabă acum **sfinții zilei** (`zi.sfinti`), nu doar crucea rândului: altfel 13
septembrie — duminică în care se prăznuiește Sf. Cuv. Ioan de la Prislop, cu cruce — nu intra nicăieri,
fiindcă ziua e „duminica", nu „neagra". Felul zilei a rămas doar ca plasă.
⚠️ `cruce_albastra` vine din `rangulSfantului`, unde **culoarea bate însemnul**: un sfânt scris albastru
primește rangul ăsta chiar dacă semnul lui spune altceva. Rangul nu mai poate răspunde atunci la „ce
culoare are crucea?" — de aceea alegerea se face în `pagini.ts` (`RANGURILE`), nu în traducere. Dacă
vreodată se desparte culoarea (român/local) de însemn în `Rang`, locul acela se simplifică.
⚠️ **CULOAREA, ÎN LISTELE FILTRATE, VINE DIN RANGUL SFÂNTULUI** — aceeași regulă ca la sfinții de sub
titlul duminicii: roșu la cruce roșie și la praznice, albastru la sfinții români. Când capul zilei se
scrie din sfinți, marcajul de culoare al sursei se pierde; așa ajunseseră sărbătorile cu cruce roșie
să fie scrise cu cerneală în lista lor (user, 13:04: „nu sunt notate cu roșu, cum sunt duminicile").
⚠️ **Eticheta de lângă numele lunii spune felul întreg și e în culoarea lui** (user, 13:28): „septembrie
2026 · **cruce roșie**" / „· **cruce neagră**", nu „roșie"/„neagră". Roșul e `--rosu` (pe tema de noapte
se deschide, dar rămâne roșu); negrul e `--ink`, cerneala paginii, care **se întoarce singură în alb pe
întuneric** — chiar ce s-a cerut. De aceea `CRUCILE` are și `scurt` (intră în propoziții care spun deja
„cruce": „nicio zi însemnată cu cruce roșie"), și `eticheta`, care stă singură și poartă cuvântul cu ea.
⚠️ **Și data zilei cu cruce roșie se scrie roșu**, nu doar a duminicii (`.zi.cruce-rosie .nr`) — ca în
calendarul tipărit, unde ziua cu ținere e roșie cu totul. **Fundalul palid rămâne însă numai al
duminicii**: el spune „e duminică", nu „e sărbătoare".
⚠️ Două lucruri de înfățișare, în lista **neagră**: capul zilei nu se mai scrie roșu la duminici
(`.zi.fara-rosu`) — roșul ar spune „sărbătoare cu ținere", taman ce lista nu cuprinde —, iar rândul de
sfinți de sub titlu nu se mai scrie când titlul s-a făcut DIN sfinți (altfel duminica își spunea de
două ori sfinții: sus cei ai felului, jos toți).

⚠️ **ÎN LISTA FILTRATĂ SE SCRIU DOAR SFINȚII FELULUI, nu titlul întreg al zilei** (`capulFiltrat`).
Prima variantă scria titlul zilei cu toți sfinții ei și în „cruce neagră" se vedeau nume albastre
(reclamația userului, 11:22: „sunt incluși aici și cei cu cruce albastră"). De pildă 20 ianuarie: ziua
e a Sf. Cuv. Eftimie cel Mare, cruce neagră — pe drept în listă —, dar titlul ei cuprinde și „Sf. Mc.
In, Pin și Rim", scriși albastru de Patriarhie.
⚠️ **Alegerea se face pe RANGUL sfântului** (`zi.sfinti[].rang`), nu pe culoarea din `titlu_html`:
sfinții aceia albaștri au `rang: "simplu"` — albastrul e doar un marcaj al sursei. Rangul e singurul
care spune adevărul despre însemn. Duminicile își păstrează numele lor (intră în lista roșie fără să
aibă sfinți roșii), iar dacă pentru o zi nu iese niciun sfânt cu rangul cerut, se scrie titlul întreg.
**Lista nefiltrată a rămas neatinsă**: acolo ziua se scrie întreagă, cu albastrul sursei cu tot.
⚠️ **Un singur predicat, `trecePrinFiltru`**, și pe lună, și pe an — de aceea lista anului nu mai vine
din `zileleCuCruce` (care nu știa de duminici), ci din `randurileAnului` filtrat. Altfel filtrul ar fi
însemnat două lucruri deosebite, după cât de larg te uiți.
⚠️ Paginile filtrate **nu se dau la indexat**: e același conținut, ciuntit.

- **NAVIGAREA A URCAT ÎN ANTET** („mută navigarea sus"). Șirul lunilor stătea în corp, sub antet, și
  fugea la derulare; antetul e lipicios, deci acum lunile rămân la îndemână pe toată pagina.
- **E O PASTILĂ, ca la Program** („să fie o pastilă ca la Program și lunile să fie text în capsulă"):
  un singur corp cu chenar și colțuri rotunjite, în care bulina lui „azi" și lunile stau lipite,
  despărțite doar de o linie de 1 px. Lunile sunt **text simplu** — fără chenar, fără fundal, fără
  rotunjire a lor; luna deschisă e segmentul roșu (`color-mix(rosu 11%)`, ca la Program, nu roșu tare
  cu scris alb, cum era când fiecare lună era o pastiluță a ei).
- ⚠️ **PASTILA IA NUMAI CE RĂMÂNE** (`flex:1 1 0`) — 217 px din 680, din care fâșiei îi rămân ~132,
  adică **vreo trei luni la vedere**; restul vin din derulare. Am încercat pe la 10:45 varianta cu
  pastila pe un rând al ei (atunci încap toate treisprezece), dar utilizatorul a cerut **înapoi rândul
  unic**. Dacă se cere iar mai mult loc, câștigul ieftin e la butoanele de sărbători: fără cuvinte, cu
  numele doar în `title` (cum sunt deja pe telefon), fâșia sare de la ~132 la ~430 px.
  ⚠️ Măsura de pornire trebuie să fie **`flex:1 1 0`, NU `1 1 auto`** — aceeași capcană ca la pastila
  Programului: `.btns` are `flex-wrap`, iar ruperea rândului se hotărăște după măsura **ipotetică** a
  fiecărui copil, înainte de orice strângere. Cu `auto`, pastila pornește de la lățimea celor 13 luni,
  umple singură rândul și **tocmai butoanele coboară** — exact reclamația de la 10:55.
- **Segmentele sunt strânse cât se poate**, ca în puținul acela să intre cât mai multe luni: spațiul
  dintre litere `.1em → .03em`, cel din laturi 14 → 8 px, scrisul 13 → 12,5 px. Cu totul, lunile cer
  636 px — atât cât le-ar trebui ca să încapă toate, dacă pastila ar avea rândul ei. Măsoară cu
  `scrollWidth` vs `clientWidth` pe `.fasie`, nu cu ochiul.
- ⚠️ **`.fasie` are `position:relative`, și nu de podoabă**: JS-ul aduce luna deschisă la mijloc cu
  `offsetLeft`, iar acela se măsoară față de cel mai apropiat strămoș așezat. Fără el, `offsetParent`
  ajungea `.sus` (antetul e `sticky`), numărul ieșea cu ~270 px mai mare și pastila se deschidea
  derulată la capăt — se vedea „NOI DEC IAN 2027" în loc de luna curentă.
- **Se derulează stânga-dreapta** oriunde nu încap — pe telefon întotdeauna („pe mobil tot așa să se
  poată muta stânga dreapta"). Bulina stă **în afara fâșiei**, la capul pastilei: ea nu se derulează
  niciodată. Săgețile ‹ › se scriu **numai dacă e ceva de derulat** (JS: `scrollWidth > clientWidth`),
  ca pe desktop să nu stea două segmente moarte în pastilă; sub 520 px nu se scriu deloc — acolo e
  degetul.
- **„AZI" E O BULINĂ**, ca la Program („AZI să fie o bulină ca la Program"): butonul n-a mai rămas cu
  niciun cuvânt, punctul de 9 px se desenează din CSS (`.azi-buton::before`), iar numele stă în
  `title`/`aria-label`. De când stă în pastilă, chenarul și rotunjirea lui au căzut: le are pastila.
  Clasa `azi-buton` e și mânerul JS-ului care derulează la ziua de azi.
  ⚠️ **ROȘUL E AL LOCULUI, NU AL BUTONULUI** (user, 13:56: „butonul azi să nu mai fie roșu tot timpul -
  doar când ești pe luna curentă"). Până atunci bulina stătea roșie pe orice pagină, și atunci roșul nu
  mai spunea nimic: părea un buton aprins mereu, nu semnul locului. Acum stă în cerneala celorlalte
  segmente și se face roșie **numai pe luna de azi** (clasa `activ`, pusă din `sirulLunilor`), ca luna
  deschisă din șirul de lângă ea.
  ⚠️ Butonul se cheamă **„Astăzi"**, în `title` și în `aria-label` (user, 14:17: „textul buton Azi să
  fie chiar «Astăzi» - nu mergi la luna…"). Un nume, nu o poruncă: bulina spune CE e, nu ce face cu tine.
  ⚠️ **Fundalul e efemer**: se aprinde doar cât ține apăsarea (`:active`) și cât ține focusul de la
  tastatură, apoi se stinge („să fie ceva efemer"). Pe luna de azi, unde butonul nu duce nicăieri ci
  doar derulează la ziua curentă, ăsta e singurul semn că apăsarea a fost primită.
- ⚠️ **NAVIGAREA E PE TOATE PAGINILE**, nu doar pe lista lunii (user: „să nu se mai ascundă când intru
  pe sărbători cruce neagră roșie") — ca la Program, rândul are aceeași formă peste tot. Pe pagina
  zilei e marcată luna zilei; pe listele de sărbători **nicio lună** (`luna: 0`), fiindcă acolo nu
  ești într-o lună a calendarului, ci într-o listă peste tot anul — un marcaj ar minți. De aceea
  scriptul navigării a ieșit din `script()` într-un `JS_NAV` al lui, pus pe toate paginile.
- **Butonul se cheamă „Abonare"** („butonul după navigare să se numească Abonare"), cu plicul de la
  Program. ⚠️ La 09:38 a fost scos de la administratori, iar la 13:39 **repus, și la Calendar, și la
  Program** — vezi mai sus; nu-l ascunde iar.
- **Propoziția lămuritoare de lângă el a fost ștearsă** („șterge acel text") — „Ca să te abonezi, îți
  trebuie cont." / „Îți trimitem calendarul pe adresa contului." Ce spunea a trecut în `title`.
- **Meniul „Informații utile" a ieșit cu totul** („în loc de butonul de info să fie două butoane cu
  Sărbătorile… pune niște iconițe acolo"): cele două liste sunt acum butoane adevărate, cu cruce
  desenată și cuvânt — un drum, nu două apăsări. Crucea e aceeași; **culoarea** le deosebește, ca în
  calendarul tipărit. Butonul listei pe care ești se scrie marcat (`.activ`, roșu, neapăsabil).
  Odată cu meniul a căzut și `JS_MENIU` (închiderea lui la clic în afară).
  ⚠️ **Al treilea buton, „Sfinții cu evlavie", e anunțat de utilizator** și își are locul lângă ele.
- ⚠️ **FEREASTRA DE ABONARE, adusă întocmai de la Program** („la click pe Abonare să apară un pop-up
  la fel"), cu câmp de e-mail și cele două bife. Utilizatorul a ales varianta aceasta **știind ce
  aduce**: ca la Program, fereastra e deocamdată doar înfățișare (`method="dialog"`), deci **abonarea
  calendarului nu se mai face din pagină** până când fereastra se leagă de rute. Ce a rămas întreg
  dedesubt: `POST /abonare` · `/dezabonare` și audiența `calendar-abonati`. Odată cu butonul vechi a
  ieșit și `eAbonat` din rutele paginilor — întrebarea „e omul pe listă?" ar fi fost o cerere la
  comunicare pe fiecare pagină, degeaba.

**⚠️ MĂSURI.** `.w` are 680 px, iar butoanele cer, măsurate în pagină: Abonare 117 + bara 1 + Cruce
roșie 142 + Cruce neagră 157 + spațiile = 457; pastilei îi rămân 217. **Al treilea buton („Sfinții cu
evlavie") nu mai încape cu cuvânt cu tot** — când vine, ori se scurtează numele, ori sărbătorile rămân
doar iconițe (și atunci navigarea câștigă mult). Pe telefon (sub 600 px) cuvintele cad deja și rămân
iconițele: cu ele, cele trei ar cere ~446 px, iar un telefon de 390 are 335 de folosit.

### Propunerea săptămânii — și privegherile din anii trecuți (12.09.2026)

Propunerea are acum **patru izvoare**: obiceiul ultimelor 52 de săptămâni, aceeași dată în anii
trecuți, **privegherile** și calendarul. La sfârșit se face o **curățare**.

- ⚠️ **PRAGUL E UNU** (user, 15:18: „pragul pentru o priveghere nu e să fie de mai multe ci să fi fost
  măcar o slujbă de la ora 21"). Privegherea nu e un obicei săptămânal, e o hotărâre: dacă s-a stat o
  dată noaptea la un sfânt, merită amintită la anul. De aceea izvorul 2 nu le prindea — el cere două
  apariții **și** jumătate din ani, iar privegherile sunt rare (40 în 12 ani) și împărțite pe trei
  coduri: `priveghere_liturghie` (26, ora 21:00), `priveghere_utrenia` (11, 18:00),
  `priveghere_ceasurile_liturghie` (3, 21:00).
- **Cum se recunoaște una**: ora de la **21:00** în sus **ori** codul care spune el însuși
  „priveghere". Ora e semnul adevărat, cum a spus utilizatorul; codul e plasa pentru
  `priveghere_utrenia`, care se ține de la 18:00 și s-ar pierde dacă ne-am lua numai după ceas.
  Se propune slujba care **chiar a fost** — același cod, aceeași oră —, nu o priveghere închipuită.
- **Motivul se scrie pe față**: „priveghere: în 2018, 2019, 2021". Numele sfântului vine din `detalii`
  al privegherii de atunci — de aceea `istoriculSlujbelor` aduce acum și coloana `detalii`.
- ⚠️ **CURĂȚAREA, ca să nu se scrie de două ori aceeași slujbă.** Așa s-a făcut dintotdeauna, se vede
  în arhivă: după `priveghere_liturghie` (21:00) a doua zi **nu** se mai face Liturghie, fiindcă
  privegherea o cuprinde; după `priveghere_utrenia` (18:00) a doua zi urmează `ceasurile_liturghie`
  la 08:00. Deci privegherea ține locul vecerniei din aceeași seară și, numai când are Liturghie, al
  slujbei de dimineață a zilei următoare.
- ⚠️ **Liturghia duminicii nu se atinge niciodată.** În toată arhiva nu e nicio priveghere sâmbătă
  seara (cele de la sfârșit de săptămână sunt toate duminică seara, pentru luni), deci cazul n-a fost
  văzut — iar a șterge din greșeală Liturghia duminicii ar fi cea mai urâtă greșeală cu putință.
- **Probat pe viu**: săptămâna 26 octombrie 2026 propune privegherea de luni seara (Sf. Cuv. Dimitrie
  cel Nou, 2018 și 2020), iar marți dimineața nu mai apare Liturghie.
- **Opt probe în `tests/propunere.test.ts`** păzesc toate regulile de mai sus. ⚠️ Slujba se caută
  acolo **pe ziua ei**, nu pe cod: cu un istoric mic, izvorul obiceiului umple și alte zile cu același
  cod (o săptămână din una înseamnă 100%) și proba ar privi slujba nepotrivită — chiar așa a picat
  prima oară.

### API-ul programului

`slujba_urmatoare`, `slujba_curenta` (în curs = începută de cel mult **3 ore**), `slujbele_zilei`,
`slujbele_saptamanii`, `text_saptamanii`, `cauta_slujba` (fără diacritice, pe vocabular), `paternuri`
(fundal), `arhiva` (JSON, 1,28 MB), `foaia_sfintilor`, `foaia_saptamanii`, `poza_paginii`. Perechile
publice: `/v1/curenta`, `/v1/saptamana/<data>.txt`, `/v1/cauta?slujba=`, `/v1/paternuri`,
`/v1/arhiva.json`. `Slujba` rămâne obiectul întreg („lasă-le așa acum").

**Partea executivă** stă în `depozit.ts` (`scrieSaptamana`, `modificaSlujba`, `adaugaSlujba`,
`stergeSlujba`, `valideazaSaptamana`), fiecare cu mutația + `istoric` + `outbox` în ACELAȘI batch.
⚠️ Săptămâna viitoare NU e scrisă (propunere din zbor): orice schimbare o scrie întâi
(`scrisa: false` → `scrieSaptamana`). Validată atinsă → `modificat_dupa_validare`. `dataCeruta`
înțelege numele zilelor („luni" = lunea care vine, azi inclusiv).

## Modulul de Chat (AI) și acțiunile interne

**Două lucruri separate, nu unul** — pe larg în `docs/architecture/chat-si-actiuni.md` și
`docs/adr/0007-actiuni-interne-si-chat.md`:

1. **Registrul de acțiuni** — `@xc/actiuni`; fiecare aplicație își declară verbele în `src/actiuni.ts`
   și le publică la `GET /_actiuni` (manifest din zod) / `POST /_actiuni/<nume>`.
2. **Chatul** — `services/chat-worker` (creierul, D1 `xc-chat-staging`,
   `a3d30428-fba0-46bf-9895-1ed0478a7039`) + `@xc/chat` (bula, rutele `/chat/*`, comutatorul). E
   **primul client** al registrului, nu proprietarul lui.

**Întrerupătorul are două niveluri**: (a) în cod — 3 linii + `actiuni.ts` în aplicație; (b) din
`apps/admin` → `/module`, scris în KV `xc-config-staging` (`4fb91926da484c4395160390d5348950`), cheia
`modul:chat` = `{activ, aplicatii:{…}, cineVede}`. **Stingerea oprește ȘI rutele**, nu doar bula.
Implicit: STINS peste tot. Permisiunea cerută: `modules.manage` (doar super-admin). Chatul cere CONT
chiar la treapta „toți" (discuția se ține pe `user_id`).

**Creierul**: Claude prin AI Gateway, o singură factură, fără SDK. `fetch` la
`…/xc-chat/anthropic/v1/messages` cu **Unified Billing**: `cf-aig-authorization: Bearer <token CF>`,
FĂRĂ `x-api-key`. Poarta: `authentication: true` (altfel „x-api-key header is required"),
`workers_ai_billing_mode: unified`, **credite încărcate** (altfel `402`). Secretul `AI_GATEWAY_TOKEN`
la chat-worker; local în `services/chat-worker/.dev.vars` (gitignored). Modelul/efortul: varsurile
`MODEL_CLAUDE` / `EFORT_CLAUDE`. Modelele gratuite (Workers AI, `postpaid`) merg fără credite; lista e
în `@xc/chat/modele.ts`, `creier` se deduce din id (`@cf/…` = Workers AI).

**Hățurile, toate din panoul de Module, nimic în cod**: `indrumari` (text liber, în instrucțiuni),
`unelte` (lista canonică a ce vede modelul — pe program doar `modifica_slujba`, `adauga_slujba`,
`valideaza_saptamana`, `sterge_slujba`; „fără rapoarte, enumerări, arhivă"), exemple cu argumente la
acțiuni (`{fraza, argumente}`), setul de probe `infrastructure/eval/chat.mjs`. **Dacă cineva lărgește
lista de unelte, să reruleze probele** — modelele mici cad exact la alegerea între unelte.

⚠️ **Lista din panou e un filtru, nu o listă de dorințe**: o unealtă nouă publicată de aplicație NU
ajunge la model până nu i se scrie numele acolo (goală = toate; `chat-worker/src/index.ts`, `permis`).
Așa a stat `program.retrage_validarea` după publicarea ei (12.09.2026).

**Drumul de antrenament, convenit prin practică**: utilizatorul se joacă pe staging → export
(`node infrastructure/eval/discutii.mjs --remote --env staging`) → fiecare discuție dusă la capăt intră
în probe, cu fraza LUI și sursa notată → orice schimbare la instrucțiuni/unelte/model se rulează pe
probe înainte de deploy. Când spune „am discuții bune", asta așteaptă.

**Măsurători**: 6 modele × 5 întrebări (11.09) — `@cf/openai/gpt-oss-120b` 5/5; llama-4-scout,
glm-5.3, glm-5.3-flash, deepseek-v4-flash 3/5; qwen3-30b 2/5. Pe 14 fraze: **GLM 5.3 Flash 14/14**,
gpt-oss-120b 13/14. Temperatura la Workers AI e 0. Utilizatorul vrea să se joace cu modelele — nu bate
unul în cuie fără el.

**Urmarea deterministă** (11.09, 21:48): după fiecare schimbare confirmată, întrebarea „validez
săptămâna?" o pune CHATUL, nu modelul. Mecanism generic în `@xc/actiuni`: `urmare: { actiune,
argumente: {câmp urmare: câmp de aici} }`; chat-worker previzualizează urmarea (deja validată → tace)
și o propune cu Da/Nu; reîncărcarea paginii așteaptă până se răspunde. Discuțiile expiră după **6 h**;
panoul se strânge după o schimbare și pagina se reîncarcă.

**Previzualizarea**: `rezuma` în acțiune; antet `x-xc-previzualizare: 1` → validare + drept + rezumat,
FĂRĂ execuție. Chat-worker o cheamă înainte de „Da/Nu".

**Cunoștințe de FUNDAL**: o acțiune cu `fundal: true` (fără argumente, de citire) se cheamă ÎNAINTE de
orice răspuns, ca serviciu, și intră în instrucțiuni. Ține o oră în memoria izolatului; rezultatul
trebuie să rămână MIC (se plătește la fiecare mesaj). Prima: `program.paternuri` (~4 KB). Regula scrisă
modelului: **obiceiul nu e programare** — dacă „următoarea" lipsește, spune că nu e pusă încă.

**Capcane măsurate:**

- **⚠️ Numele de acțiune cu PUNCT rup apelarea uneltelor.** Cu `program.slujbele_zilei` modelul alege
  bine dar scrie apelul ca TEXT și nu se execută nimic; cu `__` în loc de punct, `tool_calls` curat.
  Traducerea stă doar în `numeUnealta`/`actiuneaDupaUnealta`; numele canonic rămâne cu punct.
- **⚠️ Bucla model→unealtă→model**: rezultatul unei unelte trebuie să poarte `tool_call_id`, iar
  apelurile cerute se pun înapoi în istoric ca mesaj al agentului — altfel modelul primește rezultate
  fără întrebare și **tace**. Și: **un răspuns prea mare taie tot** — tăiat la 2500 de caractere,
  JSON-ul se rupe la mijloc și modelul tace la fel. Regula pentru acțiunile noi: **răspunde cu ce se
  poate citi, nu cu tot ce ai** (`calendar.cauta` dă cel mult 10 zile).
- **⚠️ gpt-oss: gândirea (canalul `analysis`) poate ajunge în răspuns** când modelul e oprit de
  `max_tokens` în mijlocul ei. Modelul GÂNDEȘTE din bugetul de `max_tokens`; cu fundal + zece unelte +
  română, 800 nu ajung. Apărările în `creier.ts`: `curataCanalele` (doar canalul `final`), buget 2500 +
  reîncercare la 6000 când e tăiat fără unealtă, `reasoning` niciodată luat drept text. **Fundalul
  intră ca TEXT, nu JSON** (JSON-ul cu diacritice îl încurca). Dacă apare bolboroseală: întâi
  `finish_reason`, apoi bugetul.
- **Fără ziua de azi în instrucțiuni, „duminică" nu se poate socoti** — se dă în system.

**Probat cap-coadă pe local** (sesiune adevărată): întrebare → acțiune → date reale; „trimite-mi foaia
cu sfinții de duminică" → PDF 54 KB prin Browser Rendering, în R2, descărcabil prin
`/program/chat/fisier/<cheie>`. **Neprobate**: bula pe calendar și tipic (au acțiuni, n-au bulă).

## Aplicațiile portate — amănunte

- **`calendar`** (A1): D1 `xc-calendar-staging`, 730 de zile (2025+2026) + sinaxare, `/v1` în forma
  contractului, **Pascalie proprie** (2027–2028 calculați), corecturi cu audit, abonare prin comunicare
  (⚠️ din 12.09.2026 **nelegată de interfață** — vezi „Calendarul (A1) — antetul").
  Șirul lunilor: doar anul curent + „Ian <an+1>" (alți ani „nu ne ajută la nimic"); din 12.09.2026 stă
  în antet, nu în corp. **Antetul are secțiunea lui** mai sus — citește-o înainte să umbli la el.
  **Poza săptămânii**: `GET <calendar>/v1/poza/saptamana/<zi>` — PNG cu antetul intervalului și cele 7
  zile. E a CALENDARULUI, se face **la cerere** prin Browser Rendering și stă în cache-ul de muchie, cu
  cheia pe amprenta HTML-ului. În V1 se generau dinainte pentru tot anul și stăteau în R2.
- **`program`** (A2): 654 săptămâni / 2619 slujbe copiate din V1, vocabularul închis de 29 de nume,
  propunerea săptămânii. Interfața: secțiunea de mai sus.
- **`tipic`** (A9): D1 `xc-tipic-staging` (`8c5ab60e-d3d8-4e96-aa89-f52492fdd83e`), trei cărți copiate
  din V1 — ROEA 97 zile, Anuarul 365, Mineiul 366. **Mineiul nu ține de an**: cheia e (luna, zi).
  **API-ul sfinților**: `GET /v1/sfinti/<data>|azi|maine` și `/v1/sfinti/minei/<luna>/<zi>` — 2041 de
  pomeniri pe an (5,6/zi); Mineiul dă 5–10 nume în plus față de calendar, dar **nu-i are pe sfinții
  români canonizați după ediție** (Prislop, Antim, Stăniloae).
- **`home`**: afișarea de la `website.sfantul-ilie.ro` din V1, fără textul de jos și cu **toate
  butoanele la fel** — nimic șters, nimic punctat. O aplicație intră în listă abia când adresa ei
  răspunde.
- **`biblioteca`** (A12): R2 `xc-biblioteca-staging` (2996 de obiecte, 164 MB) + D1
  `xc-biblioteca-staging`. Amănuntele, sus, la „Biblioteca (A12)". Câteva lucruri de știut înainte
  să umbli la ea:
  - **identitatea unei cărți e numărul de inventar** (`nr`), nu titlul, iar **slugul nu se schimbă**
    cât timp rândul e aceeași carte: el e adresa fișei, cheia copertei din depozit și `carte_slug`
    din cereri. Cele două cărți care și-au schimbat rândul stau în `MUTATE` și fac 301;
  - **copertele au trei mărimi**, și fiecare are rostul ei: `coperti-mici/` (160 px) la începutul
    fiecărui rând de listă — o căutare are până la 300 de rânduri, iar cu coperțile de fișă ar fi
    ~10 MB pe pagină —, `coperti/` (480 px) pe fișă, `coperti-mari/` (originalul) numai la lupă;
  - **uneltele de întreținere sunt în `apps/biblioteca/unelte/`** (portate odată cu aplicația, cerere
    user): actualizarea catalogului din foaia parohiei (`actualizeaza.mjs`, cu `xlsx.py` alături),
    îmbogățirea din 19 librării (`imbogatire.mjs` + `librarii.mjs` + `potrivire.mjs`), urcarea
    coperților (`urca.mjs`) și propunerile (`propuneri.mjs`). Datele lor de lucru — inclusiv
    **hotărârile utilizatorului**, `respins-de-om.json` și `hotarari.json` — s-au mutat în
    `/data/imbogatire/` (215 MB). ⚠️ Fără fișierele acelea, unealta ar reface fișele respinse;
  - **politețea la cules nu e opțională**: un singur fir, pauză între cereri (10–20 s unde cere
    `robots.txt`), User-Agent care spune cine suntem și duce la `/despre-imbogatire`. Nu se folosește
    căutarea magazinului — sitemapul o dată, potrivirea local.
- **`curatenie`** (A6): D1 `xc-curatenie-staging` creată. **Urmează la rând.**
- **Legătura V2 → V1, singura de acum**: calendarul cere textul pericopelor de la Biblia din V1
  (`URL_BIBLIA`), la afișare, cu cache de o zi. E doar citire și dispare la portarea lui A10.
  Referința e a noastră; textul nu se stochează niciodată.
- **Curățenii făcute pe drum** (nu le redescoperi ca lipsă): `dataCeruta` era copiată în calendar,
  program și tipic → acum în `@xc/ui`; `asiguraCsrf`/`jetonCsrfNou` erau în `apps/account` → acum în
  `@xc/auth`; `saptamanaOriPropunere` și facerea hârtiilor au ieșit din rute în
  `apps/program/src/hartii.ts`, iar compunerea zilei tipicului în `apps/tipic/src/zi.ts`. **Hârtiile**
  sunt în `@xc/ui` (`packages/ui/src/hartie.ts`) — nu le copia înapoi într-o aplicație.

## Rețete de lucru

### Cum vezi o pagină de admin la lățime de telefon (drum bătut 11.09.2026 — a luat jumătate de oră)

Trei pași, fără sesiune și fără browser:

1. **HTML-ul** — un test vitest de o clipă (`tests/zz-probe.test.ts`, se șterge după) care cheamă
   `paginaSaptamana` cu `ctx.eAdmin/eSuperAdmin: true` și scrie rezultatul în `/tmp`. ⚠️ `npx tsx` NU
   merge: `foaie.ts` importă un font `.otf` și Node se împiedică; vitest îl tratează ca asset.
2. **Poza** — `POST api.cloudflare.com/client/v4/accounts/<id>/browser-rendering/screenshot` cu
   `{html, viewport:{width,height,deviceScaleFactor}}` și tokenul din `/backup/_setup/cloudflare.env`.
3. **Măsurătorile** (mai bune decât ochiul la „încape/nu încape") — același API, ruta `/content`, cu un
   `<script>` injectat care scrie lățimile în DOM; `/content` întoarce HTML-ul **după** ce a rulat
   scriptul, deci cifrele se citesc din răspuns (JSON, câmpul `result`).

⚠️ **Login prin curl pe local NU merge**: cookie-urile sunt `Secure`, iar `http://127.0.0.1:8787` nu le
păstrează; Apache-ul de pe 8474 nu e în container. Mergi pe `https://127.0.0.1` din container și **nu
forța antetul `Host`**.

### Browser Rendering

- **MERGE în container** (probat 11.09.2026: JPEG-ul ecranului împărțit în ~0,9 s). Nota mai veche
  „doar pe staging" e depășită — pozele se pot vedea cu ochii pe local.
- ⚠️ La fotografierea paginii programului: randarea pe HTML brut n-are localStorage, iar scriptul
  întrerupătorului scoate clasa la încărcare — ca să vezi starea „aprins", scoate scriptul din HTML și
  pune tu `cu-calendar` pe `body`.
- ⚠️ Serviciul de screenshot **cachează** după conținut: schimbă înălțimea cu 1 px ca să-l ocolești.

### Capcane tehnice

- **⚠️ Copiile din `tmp/` se desincronizează de container** (pățit 11.09, 21:18). Editez uneori direct
  în container și alteori în copia locală, apoi `docker cp` peste — când copia locală e mai veche,
  **suprascrierea șterge editările din container**. Așa s-a pierdut o regulă din `creier.ts` și a trecut
  în commit și pe staging: **esbuild NU verifică tipurile la deploy**, doar `tsc` o prinde.
- **⚠️ `wrangler dev` se vede în `ps` ca `MainThread`, nu ca „wrangler dev".** Verificarea veche
  (`ps -ef | grep -c "[w]rangler dev"`) dă **0** deși sesiunea rulează, iar pornirea următoare cade cu
  „Address already in use (8787)". Caută `MainThread` ȘI `workerd`, omoară întâi părintele, apoi copiii.
- **DOUĂ sesiuni `pnpm dev` deodată = container sufocat.** Dacă s-a întâmplat: nu te grăbi să ceri
  `docker restart` — pkill-urile trimise „în gol" plus OOM killer-ul au curățat singure în câteva
  minute. Staging-ul nu e atins (rulează la Cloudflare).
- **Când `docker exec` nu răspunde**, întâi `docker stats --no-stream` și `docker top` din afară (nu cer
  exec): memorie la limită = container sufocat, nu „lent". Comenzile omorâte de unealtă la timeout NU
  omoară procesele din container.
- **⚠️ Carcasa are stiluri GLOBALE pe `form` și `label`** (`form { display:flex; gap:8px; flex-wrap:wrap }`),
  făcute pentru rândurile de căutare. Orice formular nou trebuie să și le scoată: fără `display:block`,
  titlul, textul și bifele se înșiră ca niște jetoane.
- **⚠️ Fără backtick în comentariile CSS** — `STIL`/`STIL_COMUN` sunt template literals; un accent grav
  într-un `/* … */` închide șirul și `tsc` scoate erori fără legătură cu locul vinovat („Property 'cuv'
  does not exist on type…", `TS1005`). Pățit de trei ori într-o seară.
- **Capcană DNS**: un subdomeniu `*.staging` nou răspunde public în câteva minute, dar de pe NAS rămâne
  nerezolvat mult mai mult (cache negativ). Probează cu
  `curl --resolve <host>:443:188.114.97.8`.
- **Diacriticele stricate la export (U+FFFD)**: exportul programului din V1 a transformat cinci litere
  cu diacritice în semne de înlocuire, iar V1 era curat — deci vina e a exportului. `insereazaLoturi`
  strigă acum la orice import; **repară exportul, nu baza**.
- **Foaia A4 se compară cu V1 punând imaginile una lângă alta**, nu doar textul: textele pot fi
  identice și liniile tabelului nu. `docker exec biserica-program …/v1/foaie/<luni>.jpg` dă foaia V1.
- **Import în D1**: `infrastructure/import/d1.mjs` — `wrangler d1 execute --file` refuză instrucțiunile
  peste 100 KB (SQLITE_TOOBIG). Se scrie cu parametri legați: local prin `node:sqlite` pe
  `.wrangler/state`, pe staging prin API-ul D1.
- `ruleaza.mjs --doar <baze>`: pe remote, o migrație care schimbă o bază citită de un worker deja
  publicat îl strică până la publicarea celui nou.
- **Gateway-ul de preview** are doar aplicațiile pornite în sesiune — în `wrangler dev`, un binding
  către un worker nepornit oprește toată sesiunea.
- **Nu pune `| tail -N` după o comandă lungă** — nu se vede nimic până la sfârșit; scrie în fișier.
  Shell-ul uneltei nu e bash: `$SECONDS` e gol.

## Istoric — ce a fost și a ieșit (nu le readuce)

- **Modul de probă local** (10–11.09): banner cu trei butoane (neautentificat / utilizator / admin) care
  schimba afișarea, cu rolul în cookie-ul `proba_rol`. **Scos de tot pe 11.09, 09:45**: „scoate bara cu
  probă locală… să fie la fel ca pe staging". Au ieșit bannerul `.proba`, `bannerProba`, tipurile
  `RolProba`/`StareProba`, câmpurile `proba`/`caleAcum`/`navProba` din `Ctx`, ruta `/proba/<rol>` și
  blocul `rolProba`. Pe local se intră acum cu cont adevărat (`123456`), masca se pune din meniul
  contului.
- **Banda roșie de jos a măștii „vezi ca"** — scoasă 11.09 („să dispară banner-ul de jos. Nu am nevoie
  de el"). Au rămas două semne, amândouă în antet: **numele contului scris roșu** cât timp masca e pusă
  și, în meniu, cele trei rânduri „Vezi ca …" ca **comutatoare** (rândul măștii purtate e roșu și,
  apăsat a doua oară, scoate masca). Butonul „Revino la super admin" nu mai există. ⚠️ Sub masca
  „neautentificat" antetul scrie tot „Cont", dar cuvântul deschide un meniu cu un singur lucru în el —
  **acela e singurul drum de întoarcere**; scăparea de urgență e `/cont/vezi-ca?ca=real`.
- **Ce a mai rămas deosebit între local și public** (întrebarea lui: „putem să nu fie nicio
  diferență?") — trei lucruri, toate structurale: emailul nu poate pleca din `wrangler dev` (de aici
  sandbox-ul și `123456`); local e un singur host cu căi (`/program`) față de subdomenii; cache-ul e
  `no-store` în dev, dinadins.
- **Tiparul V1, de unde vine problema de scalare**: fiecare aplicație e un worker de sine stătător, cu
  `wrangler.jsonc`, custom domain, D1 și R2 proprii; codul partajat (`src/comun/`) e **duplicat prin
  copiere în fiecare aplicație** — de aici costul oricărei schimbări transversale (antetul în 12 locuri).

## Jurnal

### 2026-09-13

- **BULETINUL (A3) ȘI NEWSLETTERUL (A8) portate în V2** (user, seara: „Mai portează: buletinul
  parohiei, newsletter"). Doi workeri noi pe `buletin.` și `newsletter.staging.sfantul-ilie.ro`,
  amândoi **0.1.0**. Date copiate în resurse noi: buletinul **619 rânduri D1** (4.785.016 semne,
  exact cât în V1) + **1856 de obiecte R2 / 964 MB**; newsletterul **1423 de obiecte / 722 MB**.
  Probele care contează, amândouă trecute: `/v1/*` al buletinului iese **identic octet cu octet** cu
  V1 din producție (și PDF-ul are același md5), iar corpul unui număr de newsletter la fel
  (13.412 semne, același md5). 8 probe noi (`tests/buletin-newsletter.test.ts`), `tsc` curat.
  **Verificarea copierii**: liste R2 comparate cheie cu cheie — 0 nepotriviri la amândouă.
  ⚠️ **Cele două abateri de la V1, amândouă cerute de regulile platformei**: lista de abonați a
  buletinului **nu s-a copiat** (e audiență a comunicării acum), iar abonarea arată ca la Program
  (buton + fereastră), nu ca acel câmp de e-mail din antetul V1. Newsletterul a scăpat de ocolul
  `tacut=1` prin Cont — în V2 sesiunea se citește dintr-o dată.
  **Toate aplicațiile republicate** pentru `URL_BULETIN`/`URL_NEWSLETTER` (regula de pe 13.09: setul
  întreg de adrese la fiecare worker, și pe staging, și pe producție): home 0.2.0, account 0.1.5,
  admin 0.1.3, calendar 0.7.3, program 0.6.3, tipic 0.3.2, biblia 0.1.1, biblioteca 0.1.1.
  Home le arată acum pe amândouă în lista aplicațiilor.
  ⚠️ **Rate-limit la Cloudflare** (cod 971) când cele două copieri de 4 fire au mers deodată:
  407 obiecte au picat la newsletter și 508 la buletin, iar **migrația D1 a fost refuzată de trei
  ori**. Scriptul e reluabil, așa că nu s-a pierdut nimic — dar regula pentru data viitoare e
  **un singur transfer o dată, cel mult 4 fire**, și migrațiile ÎNAINTE de copieri, nu în timpul lor.
  `biblioteca-din-v1.mjs` a devenit **`r2-din-v1.mjs`**, generic (`--din`/`--in`), cu `.html` și
  `.webp` în tabelul de tipuri.

- **BIBLIOTECA (A12) portată în V2**, cu tot cu stratul personal și cu uneltele (user: „portează și
  aplicația Biblioteca"). Worker nou `xc-biblioteca-staging` pe `biblioteca.staging.sfantul-ilie.ro`,
  cu cron `0 6 * * *`. Depozitul: 2996 de obiecte / 164 MB copiate obiect cu obiect din R2-ul V1
  (`infrastructure/import/biblioteca-din-v1.mjs`, reluabil — a lovit 429 la 8 fire, a mers la 3).
  D1-ul V1 era **gol**, deci stratul personal s-a portat ca funcție, nu ca date; abia în V2 poate
  funcționa cu adevărat (în V1 Contul era schelet, iar emailul nu putea pleca).
  **Proba**: `/v1/carti`, `/v1/autori`, `/v1/edituri` identice **octet cu octet** cu V1 din producție.
  24 de probe noi (`tests/biblioteca.test.ts`, 149 în total), `tsc` curat, poze la 390 și 900 px.
  Chei noi: `library.manage` (pangarul) și `library.borrow` (dreptul omului) → authz republicat, plus
  toate aplicațiile, pentru `URL_BIBLIOTECA`.
  **Trei hotărâri ale userului la pornire**: portăm tot (nu doar catalogul); `cereri_acces` rămâne ca
  în V1 (deși se abate de la „drepturile stau într-un loc" — i-am spus, a ales-o știind); uneltele se
  portează acum, cu tot cu cei 215 MB de date de lucru și cu hotărârile lui de până acum.
  ⚠️ Rămâne de probat fluxul de împrumut **din browser**, cu sesiune — vezi NEXT 12.

- **Tipicul: cărțile scanate, capul paginii și adresele vechi** — cele șase puncte ale inventarului,
  hotărâte de user. **1 reparat**: cele trei PDF-uri copiate în `xc-tipic-staging` (R2 nou) și cardul
  cărții pus înapoi, cu `Range` și cu adresele publice din V1. **2 da**: capul paginii s-a întors la
  forma V1, `2026-11-22 — DUMINICĂ`. **5**: `/zi/<data>` redirectează 301. **6 nu punem**: fără bulă
  de chat la Tipic. **7 reparat**: `SECRET_INTERN` ieșise din greșeală ÎNĂUNTRUL tipului `VERSIUNE`.
  **3**: rândul mărunt rămâne cum e. Tipic **0.3.1**.

- **Toate aplicațiile legate între ele pe staging și pe producție** (user: „vreau să ștergem curând
  restul și să le înlocuim pe subdomeniile corespunzătoare"). Fiecare worker are acum setul întreg de
  `URL_*` — calendar +4, program +2, tipic +2, admin +8 — în amândouă mediile, deci antetul și
  întoarcerea după intrare nu mai cad pe calea de dev. ⚠️ La calendar, `URL_BIBLIA` ajunsese scris de
  **două ori** în același bloc (o dată vechi, o dată nou): dubluri scoase, valorile erau identice.
  Republicate: calendar 0.7.2, program 0.6.2, admin 0.1.2, tipic 0.3.1.
  **Rămâne de hotărât cutover-ul**: mutarea rutelor de producție de pe workerii V1 pe `xc-*` e pas
  explicit, cerut anume — nimic nu se comută singur.

- **BIBLIA (A10) portată în V2** (user: „să portăm și biblia"). Worker nou `xc-biblia-staging` pe
  `biblia.staging.sfantul-ilie.ro`, cu depozit NOU `xc-biblia-staging`: cele **82 de obiecte** ale
  bucketului V1 (index, pericope, 80 de cărți) copiate unul câte unul cu `wrangler r2 object get/put`.
  Amănuntele, sus, la „Biblia (A10)". Probe: 10 în `tests/referinte-biblia.test.ts`; căutarea în text
  citește toate cele 80 de cărți și răspunde („manastire" găsește „mănăstire").
  - ⚠️ **Legătura cu V1 s-a rupt abia acum**: `URL_BIBLIA` din calendar arăta spre worker-ul V1, deci
    textul pericopelor — și în Calendar, și în Tipic — venea din V1 chiar pe staging. Acum calendarul
    cere prin **Service Binding** `BIBLIA`; adresa publică a rămas doar pentru legătura omului.
  - Înregistrată peste tot: `packages/config` (`URL_BIBLIA` + `nav.biblia`), gateway (`/biblia`),
    `pnpm dev`, butonul din `home` (0.1.4) și `URL_BIBLIA` la `cont` (0.1.4). Calendar **0.7.1**.
  - ⚠️ Rămâne al V1: **PDF-urile cărților tipicului**; Biblia n-avea cărți scanate, deci n-a rămas nimic.

- **Rândul de unelte al Tipicului, refăcut după Program și Calendar** (user, 16:35: „meniul principal
  să semene ca la Program și Calendar - vom avea abonare pe aceleași principii"; 16:39: „să fie
  abonare și calendar", „și ieri nu are sens"). Tipic **0.2.0** pe staging.
  - **Pastila** e cea `larga` de la Program, cu două segmente: **bulina** zilei de azi (fără text) și
    **„Mâine"**, care ia prisosul de lățime. Treptele sunt socotite față de ZIUA DE AZI, ca la Program;
    pe o zi venită din calendar niciun segment nu e marcat. **„Ieri" nu există, cerut anume.**
  - După pastilă, **Abonarea** — butonul și fereastra luate cuvânt cu cuvânt de la Program prin
    Calendar, cu tot cu câmpul de e-mail și cele două bife; ca acolo, e deocamdată doar înfățișare.
    Butonul îl văd toți, și adminii (regula celor două aplicații, acum a trei).
  - La dreapta, după bara verticală, **calendarul**: aceeași iconiță și același lucru, dar buton mic
    (`.mic`), nu unul lat cât o treime din rând. Poze pe 1100 px și pe 390 px: rândul ține o linie la
    amândouă, iar pe telefon cade doar cuvântul „Abonare", plicul rămâne.
  - ⚠️ CSS-ul pastilei e **a treia copie** (Program, Calendar, acum Tipic). Dacă se mai cere o dată,
    locul lui e `@xc/ui` — dar atunci se republică toate cele șase aplicații.

- **Filtrele calendarului au căpătat trepte de rol** (user, 01:26, regulă nouă: „sunt felul cum
  afectează rolul userului a ce vede în app"): neautentificatul niciun filtru, utilizatorul cele două
  cruci, adminul și evlavia. Amănuntele, în „BARA E UN SET DE FILTRE". Calendar **0.7.0** pe staging.
  - **Întâi am întrebat, fiindcă e prima abatere de la „totul la liber"**, și fiindcă în cod nu exista
    nicio urmă de așa ceva — anonim, și localul, și staging-ul dădeau toate trei crucile. Utilizatorul
    a confirmat că e regulă nouă, nu reclamație.
  - Poarta stă pe `ctx.utilizator` / `ctx.eAdmin`, adică pe sesiunea **efectivă**: nicio cheie nouă de
    permisiune, deci nici republicarea lui `xc-authz-staging`, iar masca „vezi ca" coboară singură cu
    ea. Calendarul e de acum locul unde se **vede** ce face masca — pentru asta a fost cerută regula.
  - Pozele celor trei stări s-au făcut fără sesiune, cu rețeta „probă vitest → Browser Rendering":
    `paginaLuna` cu trei `ctx` scrise de mână, HTML-ul în `/tmp`, poza din API. Bun de ținut minte
    pentru orice regulă „cine ce vede" — altfel ar fi cerut trei conturi și trei intrări.

### 2026-09-12

- **Meniul contului: cele trei rânduri ale măștii s-au redenumit** (user, 22:25: „în loc de
  «vezi ca…» să fie o săgeată") — „→ Utilizator", „→ Administrator", „→ Neautentificat".
  Doar numele; comutatorul, rândul roșu al măștii purtate și drumul înapoi sunt neatinse. Stau
  într-un singur loc, `randuriVeziCa` din `@xc/ui`, deci s-au schimbat în toate aplicațiile deodată,
  și se văd numai la super-admin. ⚠️ **Regulă nouă a utilizatorului: „mereu publică pe staging"** —
  orice schimbare se urcă în aceeași rundă, fără să se mai ceară. La o atingere de `@xc/ui` se
  republică **toate cele șase** aplicații care o folosesc: account 0.1.3, admin 0.1.1, calendar 0.6.1,
  home 0.1.3, program 0.6.1, tipic 0.1.3.

- **Antetul calendarului, refăcut din șapte cereri** (user, 09:33–10:55), în două valuri:
  **întâi** (staging 0.2.0) navigarea a urcat în rândul de unelte, „AZI" a devenit bulină, propoziția
  de lângă abonare a fost ștearsă, butonul se cheamă „Abonare" și nu se mai scrie la administratori,
  meniul „Informații utile" a fost înlocuit cu două butoane cu iconiță, iar clicul pe Abonare deschide
  fereastra de la Program; **apoi** (staging 0.3.1) navigarea a devenit **pastilă ca la Program**, cu
  lunile text în capsulă, derulabilă cu degetul, și a fost pusă **pe toate paginile**, nu doar pe lista
  lunii; **la urmă** (staging 0.4.0) utilizatorul a dat întregului antet înțelesul care lipsea —
  **bara e un set de filtre**: lunile filtrează, crucile filtrează peste luna aleasă și se exclud
  reciproc, „Toate lunile" deselectează luna. Pagina de sărbători a încetat să fie o destinație și a
  devenit starea „toate lunile" a filtrului. 103 teste, `tsc` curat. Amănuntele și măsurile: secțiunea
  **Calendarul (A1) — antetul**.
  ⚠️ Pe drum, pastila a stat o clipă pe un rând al ei (așa încap toate lunile), dar utilizatorul a
  cerut **totul pe o linie** — așa a rămas.
  ⚠️ **Trei greșeli prinse cu poza, nu cu ochiul**: rândul rupt în două (`flex:1 1 auto`), lunile care
  nu încăpeau, și fâșia care se deschidea la capăt (`offsetParent` greșit, fără `position:relative`).
  ⚠️ **Backtick în comentariu CSS, a doua oară în aceeași zi**: build-ul cade fără zgomot, iar
  `wrangler dev` servește mai departe versiunea VECHE — am căutat o vreme o cauză de așezare care nu
  exista. Rulează `tsc` după fiecare atingere de stil.

- **Validarea are, în sfârșit, drum înapoi: `program.retrage_validarea`** (user, 02:28, după ce
  scrisese în Îndrumări „dacă programul este deja VALIDAT trebuie mai întâi să-l transformi în
  PROPUS"). ⚠️ Regula aceea era **nefolosibilă**: în cod nu exista nicio cale `validat → propus` —
  nici funcție, nici acțiune, nici rută. Starea urca doar: `valideazaSaptamana` o ducea în `validat`,
  iar orice editare a unei săptămâni validate o muta automat în `modificat_dupa_validare`
  (`stareaDupaSchimbare`). Acum: `retrageValidarea` (`depozit.ts`) trece săptămâna în `propus`,
  golește `validat_de`/`validat_la` și lasă urma în `istoric` (`ce = 'retras'`, cu starea și
  validarea dinainte în `detalii`). Scrie **`program.week.changed.v1`**, nu `...validated.v1`, ca
  automatizarea să nu trimită anunțul a doua oară.
- **Dreptul: `program.publish`, același cu al validării** (decizie user, 02:35) — cine poate valida
  poate și retrage, adminii îl au implicit, deci **nicio cheie nouă și nicio republicare a lui
  `xc-authz-staging`**.
- **Blocarea rămâne moale, nu în cod** (decizie user, 02:35): `modifica/adauga/sterge_slujba` NU
  refuză o săptămână validată — regula trăiește în Îndrumările din panou, iar unealta e cea care o
  face executabilă. Publicat pe staging, 0.5.0; 103 teste trec, `tsc` curat.

- **Întrerupătorul „Calendar" lucrează oriunde AVEM calendarul, nu doar pe săptămâna de azi și pe cea
  viitoare** (user, 00:03: „să fie activ pe toate săptămânile din anul curent… unde știm că avem
  calendarul, dar și pe anii care trec, adică anul viitor. Dacă mă uit în arhivă și văd 2026, să pot
  să văd ecranul împărțit în două coloane"). Regula e **a datelor, nu a anilor**
  (`areCalendarulSaptamanii`, `pagini.ts`): niciun an scris în cod, deci când calendarul (A1) mai
  capătă un an, săptămânile lui se aprind singure. ⚠️ `calendarulIntervalului` răspunde **mereu** cu
  șapte zile — ce lipsește îl **împrumută** din anul curent, însemnat `aproximativ` —, așa că
  întrebarea nu e „a venit ceva?", ci „a venit măcar o zi adevărată?". „Măcar una", nu toate șapte:
  săptămâna călare pe 31 decembrie e pe jumătate adevărată și e tot o săptămână a anului curent.
  Azi A1 acoperă **2025–2028** (2025+2026 preluați, 2027–2028 calculați din Pascalie), deci arhiva
  se deschide în două coloane din 2025 în sus; 2024 în jos rămâne stinsă.

- **Butoanele din meniu nu mai dispar în arhivă nici pentru adminul simplu** (user, 00:06: „la fel și
  pentru admini; să nu mai dispară butoanele din meniu în arhivă, să fie doar dezactivate"). Cele
  **două trepte au rămas neatinse ca drept de FOLOSIRE** (`poateLuaHartiile`, fost `vedeHartiile`);
  ce s-a despărțit de ele e **vederea**: orice admin vede tot grupul din dreapta pe orice pagină —
  întrerupător, download, PDF, JPG —, stinse unde treapta lui nu ajunge, cu pricina scrisă în `title`
  (`deCeStinsa`). Enoriașul tot nu vede hârtiile: el are navigarea, întrerupătorul și abonarea.
  Publicat pe staging, 0.4.9.

### 2026-09-11

- **Arhiva: întrerupătorul „Calendar" și butonul de download se DEZACTIVEAZĂ, nu se mai ascund**
  (user, 23:23: „când intru pe Arhivă, întrerupătorul doar se dezactivează și la fel și butonul lui
  de download, acum se ascund și strică interfața"). Până acum lipseau cu totul — pe Arhivă amândouă,
  pe săptămânile vechi întrerupătorul —, iar rândul de unelte se scurta de la o pagină la alta. Acum
  se scriu stinse, cu același `.gol` ca hârtiile PDF/JPG (`<span>` pălit, `pointer-events:none`):
  `intrerupatorCalendar(m)` când `m.calendar` e fals, `pozaPaginii` când `m.luni` e null. Vizibilitatea
  rămâne a drepturilor: download-ul stins tot pe cele două trepte (pe Arhivă — doar super-adminul),
  întrerupătorul stins îl vede toată lumea, ca și cel viu. ⚠️ **`id="b-calendar"` numai pe cel viu** —
  JS-ul se leagă de id și ar pune `cu-calendar` pe body, iar pe săptămânile vechi clasa aceea scoate
  la iveală zilele goale (`body:not(.cu-calendar) .zi.goala`). Măsura pe telefon n-a trebuit refăcută:
  rândul Arhivei are acum exact butoanele rândului unei săptămâni, deci nu apare un caz mai lat decât
  cel deja măsurat (331 px din 335, la super-admin pe un telefon de 390). Publicat pe staging, 0.4.8.

- **Trei cereri de la joacă** (user, 21:48): (1) cât e panoul deschis, pagina de dedesubt nu se
  derulează (`html.xc-chat-deschis { overflow:hidden }`); (2) după o schimbare făcută, panoul se
  STRÂNGE și pagina se reîncarcă; la click se vede ultima discuție; discuțiile **expiră după 6 h**
  de la ultimul mesaj (server: `conversatia()` deschide alta; client: `xc-chat-la`); (3) după
  fiecare schimbare confirmată, chatul întreabă **deterministic** „Îl validez?" — nu la voia
  modelului. Mecanismul e generic, în contract: **`urmare`** pe acțiune (`{ actiune, argumente:
  { câmpul urmării: câmpul de aici } }`); chat-worker previzualizează urmarea (dacă săptămâna e deja
  validată, previzualizarea cade și nu întreabă) și o propune ca a doua propunere cu Da/Nu;
  reîncărcarea așteaptă până se răspunde. Programul: `modifica/adauga/sterge_slujba` și
  `scrie_propunerea` au urmarea `valideaza_saptamana`; `program.valideaza_saptamana` intră în
  uneltele permise. Probat cap-coadă pe local: adăugare → Da → validez? → Da → `stare: validat`.
  ⚠️ De urmărit: „acatist" a nimerit „Denia Acatistului Bunei Vestiri" (cel mai scurt nume care
  conține cuvântul) — vocabularul n-are un „Acatist" generic; de lămurit cu userul ce vrea.

- **Din joaca userului pe staging** (21:32–21:42), trei lucruri:
  1. „a modificat corect programul dar nu a reîncărcat pagina" → după un „Da" executat, bula
     **reîncarcă pagina** peste o clipă; discuția stă pe server, panoul se redeschide unde era;
  2. „să ții minte toate conversațiile — și de referință și pentru training… chiar și erorile" →
     migrația `chat/0002` (`conversatii.stearsa_la`): coșul din bulă doar **ascunde**, nimic nu se
     șterge; în `date_json` al mesajului agentului se păstrează **modelul și apelurile** (nume,
     argumente, rezultat), iar o cădere a chatului se scrie și ea. Export JSONL:
     `node infrastructure/eval/discutii.mjs --remote --env staging`. Iconiță de **discuție nouă**;
  3. **două discuții adevărate, ambele 100%** (GLM 5.3 Flash): „Slujba de luni să fie de la ora 7"
     și „Adaugă marți la 18 slujba Sfântul Maslu" → intrate în setul de probe (16 acum), cu sursa.
     **Drumul de acum înainte**: joacă → export → ce a mers intră în probe → orice schimbare se
     măsoară și pe vorbirea omului. (Prima încercare picase cu 402 — Claude fără credite.)

- **Toate discuțiile se păstrează, și erorile** (user, 21:33–21:34: „să ții minte toate
  conversațiile — și de referință și ca să mai facem training… le-aș salva pe toate, chiar și
  erorile"). Migrația `chat/0002_pastrare.sql`: `conversatii.stearsa_la` — coșul din bulă **ascunde**
  (nu se mai redeschide omului), nu șterge. În mesajul agentului se păstrează acum `model` și
  `apeluri` (unealta, argumentele, cum a ieșit: ok / propusa / cod de eroare); o cădere a chatului
  se scrie și ea în discuție (`date.eroare`). Export: `node infrastructure/eval/discutii.mjs
  --remote --env staging > discutii.jsonl` — un rând pe discuție, cu mesaje, apeluri și propuneri
  (stare făcută/refuzată/expirată); de aici se scot probe noi pentru `chat.mjs`.
- **Bula: după o acțiune făcută, pagina se reîncarcă** (user, 21:32: „nu a reîncărcat pagina") —
  discuția stă pe server, panoul se redeschide unde era. **Iconiță de discuție nouă** lângă coș
  (user, 21:33); cea veche rămâne pe server.

- **Măsurat, cu hățurile puse (setul de 14 probe, doar `modifica_slujba` + `adauga_slujba`)**:
  **glm-5.3-flash 14/14** (98 s), **gpt-oss-120b 13/14** (86 s; ratarea se mută de la o rulare la
  alta — variație, de aceea temperatura la Workers AI e acum 0; și gândirea lui se scurge uneori
  în text fără marcaj, „analysis …" — prinsă și ea, cu reîncercare). Concluzia userului se
  confirmă: cu propunerea bună (fără model) și două unelte limpezi, **un model gratuit ajunge**.
  Scorurile stau în lista din panou (`@xc/chat/modele.ts`). Rerulează probele la orice lărgire a
  listei de unelte — modelele mici cad exact acolo.

- **„Antrenamentul" pentru modelele gratuite** (user, 21:04–21:08: „un câmp de instrucțiuni pe care
  să-l pot scrie eu… ai putea să faci tu acest antrenament?… scurtează lista de unelte, pune
  restricții… practic doar trebuie adăugate slujbe și modificate"). Nu e reantrenare — sunt patru
  hățuri, toate din panoul de Module:
  1. **Îndrumări** (`indrumari`, text liber, ≤ 8000): intră în instrucțiuni la fiecare mesaj, sub
     regulile fixe. Le-am umplut din **tiparele măsurate** („Sfântul Maslu: de obicei marți, la
     18:00") + patru reguli de lucru — userul le corectează de acolo;
  2. **Uneltele permise** (`unelte`, un nume canonic pe rând; gol = toate): chatul vede DOAR ce e pe
     listă; pe staging și local: `program.modifica_slujba`, `program.adauga_slujba`. Registrul
     aplicațiilor rămâne întreg pentru alte aplicații. Regula 9 în instrucțiuni: „aici poți DOAR
     atât; pentru altceva spune că nu e de aici";
  3. **Exemple cu argumente** la acțiuni (`exemple: [{ fraza, argumente }]`) — antrenament în
     context: modelul vede „mută liturghia de luni la 7" → `{zi:"luni", slujba:"liturghie",
     schimbari:{ora:"07:00"}}`. Puse la `modifica_slujba` (6) și `adauga_slujba` (4);
  4. **Setul de probe** `infrastructure/eval/chat.mjs`: 14 fraze (adăugări, modificări, ambigue,
     „nu e de aici") prin bucla reală, pe local, model cu model (`node infrastructure/eval/chat.mjs
     @cf/openai/gpt-oss-120b claude-opus-4-8`); măsoară unealta chemată + propunerea. Răspunsul
     chatului poartă acum `unelte: string[]` (ce a chemat). În dev comutatorul se recitește la 3 s.
  **Propunerea săptămânii** e fără model (`propunere.ts`: obiceiul ultimelor 52 de săptămâni,
  aceeași dată în anii trecuți, praznicele) — de aceea modelului îi rămân doar retușuri.

- **Selecția de modele în panoul de Module** (user, 20:56: „o selecție de modele - cele free și cele
  cu plată… aș vrea să mă mai joc cu ele puțin"). Lista stă într-un singur loc, `@xc/chat/modele.ts`,
  pe două grupuri: **gratuite** = Workers AI (10.000 neuroni/zi fără plată — poarta e pusă înapoi pe
  `workers_ai_billing_mode: postpaid`, ca gratuitul să fie gratuit), cu scorul MĂSURAT la proba
  uneltelor lângă fiecare; **cu plată** = Claude (Opus 4.8 implicit, Opus 5, Sonnet 5, Sonnet 4.6,
  Haiku 4.5), din creditele AI Gateway, cu prețul de listă orientativ. Configul ține acum
  **`model`** (id), iar `creier` se deduce din el (`@cf/…` = Workers AI, restul = Claude); o
  configurare veche cu doar `creier` se traduce fără pierdere. 100 de teste.

- **Creierul: Claude Opus 4.8, prin AI Gateway, cu factura la Cloudflare** (user, 19:48–19:56:
  „prefer să folosim Claude 4.8… putem să folosim ceva mai bun… vreau tot prin AI Gateway, nu ocoli
  această cale… nu facem nimic prin SDK propriu… o singură factură foarte clară… nu trebuie să ne
  ducem mai sus, dar parcă nici mai jos"). Făcut așa:
  - poarta **`xc-chat`** creată în cont (loguri pornite, 120 cereri/min), **autentificată**
    (`authentication: true`), cu `workers_ai_billing_mode: unified` — totul din creditele AI Gateway;
  - drumul Claude = **cereri simple** către `…/xc-chat/anthropic/v1/messages` (fără SDK, fără cheie
    Anthropic): antetul `cf-aig-authorization: Bearer <token Cloudflare>` — **Unified Billing**,
    Cloudflare plătește Anthropic, parohia plătește Cloudflare. `thinking: adaptive`, efort
    `EFORT_CLAUDE` (medium), `max_tokens` 16000; tura asistentului se pune înapoi cu blocurile brute
    (gândirea trebuie să însoțească apelul de unealtă); rezultatele uneltelor într-un singur mesaj;
  - **și Workers AI trece prin poartă**, mereu; fără poartă configurată nu se cheamă niciun model;
  - panoul de Module: „Claude (Anthropic)" implicit, „Workers AI" rezervă, „Fără model";
  - secretul `AI_GATEWAY_TOKEN` pus la chat-worker (staging + `.dev.vars` local); varsurile
    `AI_GATEWAY`, `CLOUDFLARE_ACCOUNT_ID`, `MODEL_CLAUDE`, `EFORT_CLAUDE`.
  ⚠️ **Blocat pe credite**: proba dă `402` — contul n-are credite AI Gateway. Se cumpără din
  dashboard: AI Gateway → *Credits Available* → *Manage* → *Top-up credits*. Până atunci chatul
  răspunde limpede că nu are credite. Tokenul din `cf-aig-authorization` e deocamdată cel mare al
  proiectului; mai curat ar fi unul cu doar „AI Gateway – Run" (se face din dashboard).
  95 de teste (7 noi pe traducerea istoricului în forma Anthropic).

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
