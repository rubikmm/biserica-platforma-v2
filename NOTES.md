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
3. ✅ **Portarea aplicațiilor — ÎNCHISĂ pe 14.09.2026**: ✅ calendar (A1), ✅ program (A2),
   ✅ tipic (A9), ✅ biblia (A10), ✅ biblioteca (A12), ✅ buletin (A3), ✅ newsletter (A8),
   ✅ curățenie (A6), ✅ **transmisiuni (A5) — împărțită în DOUĂ: `live` + `radio`**.
   ⚠️ Biblioteca, buletinul și newsletterul au fost cerute **înaintea rândului lor** (user,
   13.09.2026).
   **Ultimele trei nu mai sunt portări** (user, 14.09.2026, patru mesaje scurte):
   - **A7 comunicări — NU se portează.** Din el rămân **două funcții**, e-mailul (Cloudflare) și
     WhatsApp-ul (WAHA de pe NAS, prin puller), puse în **Dispecerat** — **anexă în `admin`**, fără
     subdomeniu nou, „cum am făcut Contul";
   - **A4 website „este chiar pagina de staging.sfantul-ilie.ro"**, adică `home` — gata;
   - **A13 cont se stinge** (îi ia locul `cont` + `identity`).
4. ⏳ **CUTOVER — pornit pe 14.09.2026** („pornește înlocuirea v1 cu v2"). Vezi NEXT, punctul 0.
5. ⏳ **Curățenia de la final**: nicio urmă V1 pe Cloudflare, **și staging-ul dispare** (user:
   „aștept să nu mai avem staging și să nu mai avem V1"). Poartă: backupul pe Syno.

**Curățenia (A6)**: programarea voluntarilor la duminici, pe poziții, plus cele trei rapoarte care ies
din ea. Portată pe 14.09.2026. ⚠️ **V1-ul ei NU e aplicația PHP de pe cPanel**, ci un Worker scris pe
8 septembrie 2026 (containerul `biserica-curatenie-nou`, v2.0.0) și comutat pe viu pe 9 septembrie:
`curatenie.sfantul-ilie.ro`, D1 `biserica-curatenie`, cron orar care **chiar trimite** scrisori. PHP-ul
vechi doar redirectează încoace.

Datele s-au copiat rând cu rând în **D1 `xc-curatenie-staging`** (`0c60549b-9f84-4f92-a788-835929a2f8c7`):
29 de voluntari, 81 de programări (mai–sept. 2026), 529 de mesaje de jurnal, 31 de rapoarte (368.144
de semne de HTML), 7 setări — **677 de rânduri, verificate sumă cu sumă față de V1**.

Ce s-a schimbat față de V1, și de ce:
- **voluntarii au rămas ai aplicației** (nume, e-mail, telefon în baza ei), iar omul se recunoaște
  alegându-și numele din listă, fără cont. Utilizatorul a ales asta anume, dintre trei variante, după
  ce i s-a spus că se abate de la „datele stau într-un loc, autentificarea la fel";
- **parola locală de admin a ieșit cu totul** — cele trei hash-uri bcrypt, sesiunea semnată, resetarea
  prin email, fila „Schimbă parola" și „modul de inițializare". Panoul cere `cleaning.manage`, cheie
  care exista deja în contracte (deci **fără republicarea lui authz**). `is_admin` din tabel a rămas
  **etichetă a echipei**: cine e „Admin" pe cartelă și primește rapoartele din oficiu;
- **scrisorile pleacă prin `communication-worker`** (`/trimite`), nu prin SMTP propriu către
  `no-reply@`. Cheia de idempotență e `curatenie:<fel>:<duminică>`, iar trimiterile de probă din panou
  au cheia lor, ca să nu blocheze plecarea celei adevărate. ⚠️ **Un raport pleacă acum întreg sau
  deloc** — în V1 putea reuși pentru unii și cădea pentru alții;
- **numele duminicii se cere de la calendar (A1)**, `/v1/interval`, o singură întrebare pe pagină. În
  V1 erau 52 de rânduri scrise de mână care acopereau numai 2026: din 2027 toate duminicile ar fi
  apărut ca „Duminica - 3 ianuarie", și în pagină, și în scrisori;
- **assets-urile au ieșit**: `app.js` stă acum în pagină (`src/sloturi-js.ts`), ca la toate aplicațiile
  V2, iar manifestul și iconițele PWA ale V1 nu s-au portat — carcasa dă doar meta-urile;
- carcasa, meniul contului și „vezi ca" vin din `@xc/ui`; fiecare apăsare de slot poartă jeton CSRF
  (V1 n-avea niciunul).

Ce a rămas **neatins**, fiindcă așa trebuie: „trenulețul" pozițiilor (mută tot la +1000, apoi trage
pozițiile una câte una), pragul de patru voluntari, ora 18 la care duminica trece în trecut, lunea în
care pleacă raportul lunar, înfățișarea scrisorii (cu tot cu potrivelile pentru modul întunecat al
Outlook-ului și al Apple Mail), meniul adminului pe slot și „Participarea" cu bife.

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

### Răsfoitul numărului (13.09.2026, seara)

**În loc să se deschidă PDF-ul, numărul se RĂSFOIEȘTE** — cerere user: „există un mod turn-page-3D
asociat cu PDF-urile din site editoriale și revista - aș vrea să preluăm scriptul și să facem și noi
așa - în loc să deschidem pdf-ul". Modulul e **Real3D FlipBook v3.7.10** (CodeCanyon,
creativeinteractivemedia), chiar cel de la `jurnaluldeafaceri`, de unde s-au și luat asseturile.

- ⚠️ **LICENȚA, pas deschis**: licența Envato se socotește **pe produs final** (un sit), nu după câți
  oameni intră. Copia de aici e a doua folosință și cere licența ei. Utilizatorul a hotărât s-o
  cumpere („vreau același script chiar dacă e a doua licență"; „nu e un site - e o micro aplicație
  pentru 10 oameni"). **De confirmat înainte de cutover-ul pe producție** — până atunci stă doar pe
  staging. I-am spus o dată că numărul de cititori nu schimbă cerința; a ales știind.
- **Unde stau asseturile**: în depozitul buletinului, sub `flipbook/` (35 de fișiere, 3,8 MB), servite
  de worker la `/flipbook/*` cu cache de un an. Nu în codul workerului (prea mari) și nu de pe un CDN
  străin (pagina parohiei n-are de ce să atârne de altcineva). Se urcă cu
  `node apps/buletin/unelte/urca-flipbook.mjs --din /tmp/fb`.
  ⚠️ Numele fișierelor **nu se schimbă**: modulul își află singur adresele fraților lui
  (`three.`, `pdf.`, `flipbook.webgl.`) din propria adresă. `rootFolder` i se dă în opțiuni, altfel
  își caută sunetul și iconițele lângă PAGINĂ.
  Nu s-au adus cele **168 de `js/cmaps/*.bcmap`** (codări chinezești/japoneze) și nici CSS-urile de
  administrare ale pluginului. Dacă vreun PDF le va cere, se adaugă și `cMapUrl`.
- **Cum arată**: fereastră `<dialog>` peste pagină, pe tot ecranul (cerere user), fundal închis.
  Modulul își pune singur uneltele — numărul paginii sus-stânga, bara de jos (zoom, autoplay, semn de
  carte, cuprins, miniaturi, sunet), săgețile pe margini. ⚠️ De aceea **butonul de închidere stă
  `position:fixed` cu z-index maxim**, nu într-un rând de antet: acolo ar fi acoperit, iar pe telefon
  nu există tastă Escape. Tipărirea, descărcarea și partajarea modulului sunt **stinse**.
- **Butoanele de PDF au ieșit de tot** (cerere user: „iese de tot"): „Deschide PDF-ul" și „Descarcă"
  au fost înlocuite de **„Răsfoiește"**, iar coperta deschide tot răsfoitul. Amândouă au rămas
  **linkuri adevărate** către fișier (`data-rasfoit`, JS-ul le ia clicul): pe un telefon fără
  `<dialog>` omul tot ajunge la foaie, în loc să apese în gol. Adresele `/fisier/…` rămân vii — le
  citează newsletterul.
- **`?rasfoit=1`** deschide răsfoitul de la sine: e și legătura de dat mai departe, și calea prin care
  se fotografiază pagina cu Browser Rendering.
- ⚠️ **PE TELEFON modulul face ALTCEVA, din fabrică** (reclamat de user, 13.09.2026, 22:14: „scrie
  Răsfoiește dar deschide varianta free — nu e icoană de sunet pe bara de jos … și nici efectele
  normale"). Nu era nici cache, nici alt motor: era Real3D în varianta lui de mobil. Două comutatoare
  o produc, și trebuie scrise ANUME:
  - `singlePageModeIfMobile` — dacă e `true`, forțează o pagină pe ecran și sărăcește întoarcerea
    (`isMobile && (P.singlePageMode = !!P.singlePageModeIfMobile || P.singlePageMode)`). Îl pusesem
    `true` crezând că ajut; pe `jurnaluldeafaceri` e `false`. Acum e `false` și aici;
  - **butoanele au `hideOnMobile` din fabrică**: fără `btn*IfMobile` scrise, sunetul, cuprinsul și
    miniaturile dispar de pe telefon. Se scriu toate, pe față.
  Măsurat înainte/după, pe iPhone și Android simulate: pânza **332×469 → 390×738**, iconițele
  ajung de la 5 la 7 (apar `fa-volume-up/off`). Buletin **0.3.3**.
  ⚠️ **De aici, regula**: orice probă a răsfoitului se face cu **user-agent de telefon**
  (`unelte/`… vezi `tmp/poza-mobil.mjs`, `tmp/diag-mobil.mjs`) — un viewport îngust NU e destul,
  fiindcă modulul se uită la user-agent, nu la lățime.
- **Varianta liberă, dacă se renunță vreodată la licență**: a existat și a mers, cu `page-flip` 2.0.7
  (MIT) + `pdf.js` 6.3.289 (Apache-2.0), în commit-ul dinaintea trecerii pe Real3D. ⚠️ Acolo se ia
  build-ul **`legacy/`** al lui pdf.js: cel de serie a căzut cu „n.toHex is not a function" chiar în
  browserul de probă al Cloudflare, darămite pe telefoanele vechi.

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

0. **⚠️ CUTOVER — pornit 14.09.2026, seara. Unde s-a ajuns și ce urmează.**

   **Descoperirea care schimbă tot**: producția V2 **nu exista deloc** (zero `xc-*-production`),
   deci cutover-ul nu e mutarea rutelor, e **construirea mediului de producție**. Rutarea V1 nu stă
   pe `zones/.../workers/routes` (lista e goală), ci pe **Custom Domains** — un hostname ține de un
   singur worker, deci comutarea e o reasignare cu drum înapoi de câteva minute.

   **FĂCUT** (uneltele sunt în `infrastructure/cutover/`, toate reluabile):
   - 12 baze D1, 6 depozite R2, 2 cozi, 1 KV — toate `xc-*-production`; migrațiile rulate (19 fișiere);
   - blocurile `env.production` din cele 22 de configurații, umplute cu `scrie-productie.mjs`
     (⚠️ **fără `routes`, dinadins**: ruta se adaugă la comutare, una câte una);
   - **cei 21 de workeri de producție, publicați fără rute** — există, merg, nu-i vede nimeni.
     Cercurile `program↔chat` și `live↔radio` cer ocolul din `publica-cu-ocol.mjs` (cod 10143);
   - secretele: `SECRET_INTERN` **nou** pe cei patru cu acțiuni, emisia cu valorile din V1, AI Gateway;
   - datele: **R2 GATA în întregime** (14.09.2026, 21:30) — toate cele **6.310 obiecte, 1,97 GB**, în
     `xc-*-production`: biblia 82, tipic 3 (108 MB), media 0, biblioteca 2.996, newsletter 1.423,
     buletin 1.891. Verificat prin relistarea ambelor capete (`--socoteala`), nu după log.
     Din D1: conturile și asocierile (29+29) mutate; restul, cu `date-d1.mjs` (are acum răbdare la 971).

   **⚠️ RUTELE AU FOST COMUTATE — 14.09.2026, 22:45–23:05. V2 ESTE LIVE.**
   Toate cele 11 hostname-uri de producție țin acum de `xc-*-production`: admin, biblia, biblioteca,
   buletin, calendar, cont (→ `xc-account`), curatenie, newsletter, program, tipic, website (→ `xc-home`).
   Unealta: `infrastructure/cutover/rute.mjs` (`--muta <nume>`, `--inapoi <nume>`, fără argumente = starea).
   Probate toate după comutare: `/health` răspunde cu datele reale (biblia 80 de cărți, biblioteca 1.349
   de titluri, buletin 619 numere, curățenie 29 de voluntari și 82 de programări, tipic 97+365).
   - **⚠️ `override_existing_origin: true` e obligatoriu** la `PUT /workers/domains`; fără el, 409.
   - **⚠️ ORDINEA CONTEAZĂ: `cont` se mută devreme.** Un cookie de la `cont` V1 nu e recunoscut de
     identitatea V2, deci între mutarea lui `cont` și a ultimei aplicații e o fereastră de nepotrivire.
     De aceea restul se mută **în șir, repede**, nu pe îndelete.
   - **⚠️ CEASURILE V1 S-AU STINS** (cronurile nu țin de rute, deci supraviețuiau comutării):
     `biserica-curatenie` (`0 * * * *`, trimitea scrisori voluntarilor), `biserica-biblioteca` (`0 6 * * *`),
     `biserica-cont` (`0 3 * * *`). Golite cu `PUT /workers/scripts/<w>/schedules` cu `[]`.
     Pe V2 au rămas cele care trebuie: `xc-curatenie-production` orar, `xc-biblioteca-production` la 6.
     ⚠️ ~~`xc-account-production` nu are cronul de la 3 al lui V1~~ **✓ LĂMURIT ȘI REPARAT 15.09.2026**:
     mătura sesiunile și codurile trecute (`oameni.matura`). Readus la **`xc-identity`** (acolo stau
     tabelele), `0 3 * * *`, worker 0.3.0 — vezi „Ceasul de noapte al identității".
   - **⚠️ Biblia e acum PUBLICĂ**: V1 cerea intrare (303 spre `cont`), V2 primește sesiune anonimă
     (`apps/biblia/src/index.ts:304`). E din cod, nu din greșeală — dar e o schimbare pe care o vede lumea.
   - **NU s-au mutat, dinadins**: `comunicari` (A7 nu se portează), `predici`, `rugaciuni` (se șterg),
     `audio` (adrese vechi), `transmisiuni` (emisia, pas separat — vezi 0b).

   **DE FĂCUT, în ordine**:
   1. ~~reia copierile R2 picate~~ **✓ FĂCUT 14.09.2026, 21:30** (vezi mai sus). Regula rămâne:
      **un singur transfer mare o dată**, nimic altceva pe API în acel timp — inclusiv hookul de
      backup de la `git push`, care bate pe același API al contului.
   2. `node infrastructure/cutover/date-d1.mjs --scrie` pentru restul bazelor;
   3. ~~migrația `communication/0003` + publicarea Dispeceratului~~ **✓ FĂCUT 14.09.2026, 22:30.**
      ⚠️ 0003 nu era aplicată **nici pe staging**, deși codul o cerea. `d1_migrations` e GOL pe
      producție (schema a intrat altfel decât prin `migrations apply`), deci migrațiile se aplică
      acolo cu `d1 execute --file`, nu cu `migrations apply` — altfel reia 0001–0002 peste tabele vii.
      `SECRET_INTERN` pus pe `admin` în ambele medii; e altul decât cel al celor patru cu `/_actiuni`
      (`admin` nu are `/_actiuni`, îl folosește doar pentru ușa pullerului).
   4. ~~pullerul de WhatsApp~~ **trimis la `#agent-server` 14.09.2026, 23:10.** Valoarea secretului
      i-a fost lăsată în `/volume1/docker/biserica-whatsapp-puller/.secret-v2-nou` (600), ca să nu
      treacă prin Slack; el o mută în `puller.env` și șterge fișierul. **De verificat că s-a făcut.**
   5. ~~comutarea Custom Domains~~ **✓ FĂCUT** — vezi mai sus.
   6. urmează aparatul din biserică (vezi 0b) și curățenia de la final (vezi 0c).
   7. **⚠️ DE PRIVIT A DOUA ZI, cu ochii pe ele**: prima duminică pe V2 (programul și curățenia),
      ceasul curățeniei la ora fixă, buletinul de sâmbătă. Toate merg acum pe date proaspăt mutate.

   ⚠️ **Abonații**: audiența buletinului are **un singur membru** pe staging — lista din V1 n-a fost
   niciodată importată. User (14.09): „nu cred că avem, dar dacă sunt, importă-i" — **de căutat în
   V1 înainte de comutarea buletinului**, altfel foaia pleacă spre nimeni.

0c. **⚠️ CURĂȚENIA DE LA FINAL** (user, 14.09.2026). Trei cerințe:
   - **nicio urmă de V1 pe Cloudflare** — se șterge tot ce n-are prefixul `xc-`. Excepție știută:
     depozitul `biserica-transmisiuni` (11 GB), refolosit dinadins;
   - **și staging-ul dispare** („aștept să nu mai avem staging și să nu mai avem V1");
   - **repo-urile V1 se curăță din git la câteva zile DUPĂ trecere**, nu în ziua cutover-ului.
   **POARTA**: `node infrastructure/cutover/backup-syno.mjs` — coboară în `/backup/_arhiva-cloudflare/<zi>/`
   bazele D1 (și ale V1, luate prin API), depozitele R2, KV-urile, logurile AI Gateway și inventarul
   contului. **Nimic nu se șterge până nu e scrisă și verificată.** Secretele nu se pot exporta —
   în inventar rămân doar numele lor.
   **`predici` și `rugaciuni`**: aplicații V1 vii, niciodată în lista celor 12 (de acolo golul A11).
   User: „șterge și le facem când ajungem acolo" — deci intră la ștergere, se refac în V2 mai târziu.
   **AI Gateway**: rămâne **o singură poartă, `xc-chat`** (nu se face una de producție: staging-ul
   oricum dispare). Din `biserica` (poarta V1) se salvează logurile, apoi se șterge.

   **⚠️ PORNITĂ 15.09.2026** (user: „nu mai trebuie să fie nimic staging și să închidem v1"; „să avem
   și local curățenie și pe CF"). **FĂCUT**:
   - **arhiva**: toate cele **32 de baze D1** (77 MB), KV-urile și logurile AI Gateway, în
     `/backup/_arhiva-cloudflare/2026-09-15/`. Copierea celor 8 depozite R2 ale V1 rula la închidere
     (se sare peste `biserica-transmisiuni`, care rămâne — unealta are acum `--doar-r2`);
   - **adresele vechi ale emisiei**, salvate ca redirectări în `home`: `transmisiuni.` și `audio.` →
     `live`, `transmisiuni/radio*` → `radio` (301). Alese de user dintre trei drumuri, ca să nu ținem
     un worker doar pentru atât. `xc-home-production` v0.3.1, cele două hostname-uri reasignate;
   - **localul pe producție**: `local-spre-productie.mjs` a mutat blocul de bază al celor 17
     `wrangler.jsonc` pe resursele de producție (`services` NU se atinge — sunt workerii din aceeași
     sesiune `wrangler dev`);
   - **`modul:chat` salvat**: KV-ul de producție era GOL, iar modelul + „Îndrumările" scrise de user
     existau doar pe staging. Copiate pe producție. **La cutover s-au mutat D1 și R2, dar nu KV.**
   **UNEALTA**: `node infrastructure/cutover/curatenie-cloudflare.mjs --v1|--staging [--chiar]`.
   Fără `--chiar` doar arată lista. **Poarta e în ea**: refuză să șteargă orice bază D1 sau depozit R2
   care n-are pereche în arhiva zilei. La depozitele de staging are un **al doilea drum**: trece dacă
   geamănul `-production` rămâne în picioare, cu cel puțin tot atâtea obiecte (numărate, nu presupuse).

   **✅ TERMINATĂ — 15.09.2026, 10:30. Contul are un singur mediu: producția.**
   - **V1 dusă**: 3 adrese, 16 workeri, 8 baze D1, 8 depozite (~6.600 obiecte), KV `biserica-proba`,
     gateway `biserica`;
   - **staging dus**: 13 adrese, 21 workeri, 12 baze D1, 2 cozi, KV, 6 depozite;
   - **inventarul final**: 21 workeri, 15 adrese, 12 baze D1, 7 depozite, 1 KV, 2 cozi, 1 gateway —
     **totul `xc-*-production`**, cu singura excepție știută `biserica-transmisiuni` (R2).
   - **Containerele V1 de pe NAS** (15, fără `biserica-site`) — verificate 15.09: **niciun commit
     nepushat**; necommise sunt doar fișiere `src/comun/` din 11 volume, adică versiunea V1 a funcției
     „vezi ca", **deja reimplementată în V2**. Gata de șters — le șterge **#agent-server**.
     ⚠️ **`biserica-site` NU intră în listă**: e pagina principală a parohiei (`sfantul-ilie.ro`, pe
     cPanel/FTP), vie. `biserica-website` e altceva — workerul de pe `website.`.
   - **KV-ul a fost recreat cu prefix**: `CONFIG-production` → **`xc-config-production`**
     (`f63560361bd9489aa34e873732807696`). Cloudflare nu redenumește un spațiu KV, deci: spațiu nou,
     cheia `modul:chat` mutată și verificată bit cu bit, **trei** workeri republicați, vechiul șters.
     ⚠️ **Trei, nu doi**: `xc-admin`, `xc-chat` **și `xc-program`** — al treilea s-a aflat numărând
     bindingurile workerilor PUBLICAȚI, nu citind fișierele.
   ⚠️ **Arhiva KV a zilei era MINCINOASĂ**: `CONFIG-production.json` avea 2 octeți (`[]`), fiindcă
   `wrangler kv key list` citește **local** dacă nu i se dă `--remote`. Conținutul adevărat a fost
   salvat abia la recreare, în `kv/CONFIG-production__modul-chat.json`. **La orice `wrangler kv`, dă
   `--remote`** — altfel „copia" e un fișier gol care trece de orice poartă.

0b. **⚠️ CUTOVER-UL EMISIEI — urmează, cerut de utilizator** (14.09.2026: „urmează să facem
   cutoverul", „când cutover ștergem transmisiuni"). E primul cutover al platformei, deci pașii se
   scriu aici înainte, nu se improvizează. **Nimic din ce urmează nu se face fără cerere explicită.**
   - **drumul comenzii e PROBAT pe staging** (14.09.2026), prin API-ul mașinii: o telemetrie de
     probă trimisă la `/intern/aparat/stare` cu `APARAT_SECRET` a trecut prin `preiaDecizia` →
     `live` a scris ceasul **din celălalt worker** → radioul a pornit pe o selecție adevărată
     (20 de piese, secunda exactă, se știe ce urmează) → o hotărâre „live" a **stins** ceasul, iar
     modul a devenit `porneste-live` → repus pe radio. Fișierul piesei curente curge (206).
     **Excluderea LIVE/radio peste doi workeri e dovedită.**
   - ⚠️ **ce a rămas neprobat: numai stratul HTTP+autorizare al butonului** (sesiune cu
     `broadcast.manage` → `/admin/comanda`). Cere un om intrat cu contul; o apăsare ajunge.
   - ⚠️ pe staging a rămas o telemetrie de probă, cu aparatul numit **„probă-agent (staging)"** —
     nu e un aparat adevărat. Se suprascrie singură la prima telemetrie a celui din biserică.
   - **ordinea la cutover**: (1) ~~`wrangler deploy` pentru `xc-live` și `xc-radio` cu rutele~~
     **✓ FĂCUT 14.09.2026, 23:20** — `live.` și `radio.sfantul-ilie.ro` legate de `xc-live-production`
     și `xc-radio-production` cu `rute.mjs --muta live|radio` (gazde NOI, Custom Domain le-a făcut și
     DNS-ul; certificatele emise pe loc, DNS-ul a mai avut de propagat); (2) ~~secretele~~ ✓ (cele
     patru, puse din 14.09 seara); (3) ~~se întoarce aparatul din biserică~~ **✓ FĂCUT 15.09.2026,
     08:10** — vezi mai jos.
     **⚠️ APARATUL E PE PRODUCȚIE din 15.09.2026, 08:10.** În `~/aparat-nou/aparat.env` pe rpi4:
     `WORKER_URL=https://live.sfantul-ilie.ro`, `PROGRAM_URL=https://program.sfantul-ilie.ro/v1/interval`
     (copie de siguranță: `aparat.env.bak-20260915-0810`), apoi `sudo systemctl restart aparat`.
     La pornire: „legătura cu Workerul: bună", microfonul emite pe gazda nouă, programul citit de pe
     producție, radioul reluat din selecția de producție — **fără bâlbâială**, jurnalul tăcut de atunci.
     **⚠️ Ce l-a scos la iveală**: userul n-a putut porni LIVE din panou. `xc-live-production` refuză
     LIVE dacă n-a primit telemetrie de **75 s** (`APARAT_VIU_S`), iar aparatul bătea încă în
     `live.staging` — unde fusese mutat pentru probe pe 14.09. **Deci panoul și boxele erau
     deconectate**: comanda lui de la 07:47 s-a scris în producție (v1, „01. Octoih"), în gol.
     **De probat înainte de orice mutare a aparatului**: că `APARAT_SECRET` e același în mediul-țintă
     — de pe Pi, `GET /intern/aparat/comanda?versiune=-1` cu secretul lui (200 cu el, 401 cu altul).
     **De ce s-a grăbit (1)**: mutarea lui `cont` pe V2 a rupt intrarea
     în `transmisiuni` V1 (`/radio` cerea `cont.sfantul-ilie.ro/intra?app=A5`, protocol V1), iar
     home-ul V2 trimitea spre `live.`/`radio.` care nu existau — „domeniile dau eroare", user 23:16;
   - ⚠️ **aparatul e singura piesă din afara Cloudflare**: schimbă `/intern/live/whip`,
     `/intern/mic/whip` și `/intern/aparat/*` pe gazda nouă. Parolele rămân aceleași, dinadins;
   - **`transmisiuni` se șterge** (cerut anume): worker, rută, DNS, container, volume — DAR
     **bucketul R2 `biserica-transmisiuni` NU**, e chiar depozitul folosit de `radio`;
   - de dus și restul aplicațiilor pe producție odată cu ele, altfel `URL_*` din antet duc în gol.
0d. **⚠️ ABONAREA — scrisă, probată local, NEPUBLICATĂ** (15.09.2026). Cinci workeri așteaptă:
   `calendar`, `program`, `buletin`, `tipic` (are și legătură nouă, `COMUNICARE`) și `home`
   (pagina de termeni, la care trimit toate ferestrele). **Se urcă `version` în `package.json`
   înainte de fiecare.** ⚠️ Fără `home`, linkul „termenii și condițiile" duce la 404 — deci `home`
   se publică **primul**, nu ultimul.
   ⚠️ **ÎNTREBAREA CARE RĂMÂNE DESCHISĂ: cine trimite?** Audiențele există și se umplu, dar
   **nimic nu trimite periodic** spre `calendar-abonati`, `program-abonati`, `tipic-abonati` —
   doar Dispeceratul, de mână. Adică omul se abonează și nu primește nimic până nu punem ceasurile.
   De întrebat userul ce și când pleacă la fiecare (zilnic? sâmbăta? la validarea săptămânii?).
   ⚠️ `newsletter` nu e în registru fiindcă e ARHIVĂ, nu trimite încă; când va trimite, e primul
   care intră. `biblia`, `biblioteca`, `live`, `radio`, `curatenie` n-au serviciu periodic deschis.
   ⚠️ Rămas neprobat: **fereastra apăsată de un om în browser** (roșul validării, deschiderea barei
   lunilor, derularea la ziua de azi). Probat cap-coadă e DRUMUL, prin cereri.
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
   - ✅ **`program.retrage_validarea` E ÎN LISTA DE UNELTE din 15.09.2026** (a cincea), cu îndrumarea
     rescrisă ca să o cheme pe nume. A stat trei zile publicată de aplicație, dar nevăzută de model:
     regula „validat → propus" din Îndrumări era fără braț, iar chatul răspundea omului „cere-i
     administratorului" la o treabă pe care o putea face singur. Probele: alegerea uneltei rămâne
     bună la toate cele 19 fraze, deci a cincea unealtă n-a încurcat modelul mic.
   - ⚠️ **DE FĂCUT: probele au nevoie de date semănate local.** Baza D1 locală e goală de la trecerea
     localului spre producție, deci 9 din 19 probe pică la EXECUȚIE cu unealta aleasă corect —
     scorul nu mai spune nimic despre model. Setul cere un „semănat" (o săptămână propusă + una
     validată + slujbele lor) înainte de rulare, altfel citește doar alegerea uneltei.
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
4. **Curățenia (A6), ce a rămas după portare** (14.09.2026):
   - ⚠️ **panoul n-a fost umblat cu un om adevărat**, iar de pe 14.09 seara are ecrane NOI (cererile,
     „+ Adaugă", comutatorul de admin care acordă cheia): cer sesiune cu `cleaning.manage`, iar prin
     curl nu se poate intra (cookie-uri `Secure`). Probate sunt schema, interogările, `tsc`, cele
     196 de probe și pagina publică (poze la 390 și 1100 px); **de mers o dată cap-coadă din browser**:
     Cereri → Primește, „+ Adaugă", comutatoarele Voluntar/Monitor/Admin, Editează fișa;
   - ⚠️ **de probat și drumul omului**: cont nou → `cont.staging` → „Aplicațiile mele" → „Cer să intru"
     → adminul îl primește → poate apăsa pe sloturi. Nimeni n-a mers pe el cap-coadă;
   - **sloturile atârnă de DUMINICI, nu de slujbele programului** — alegere a utilizatorului
     (13.09.2026), pentru că steagul `curatenie` din A2 e „da" din fabrică la 2213 din 2623 de slujbe:
     ar fi ieșit ~10 poziții pe săptămână în loc de una duminica. Dacă se vrea vreodată legătura cu
     A2, **întâi se curăță steagul în Program** — după care slotul se poate lega de `slujba_id`;
   - **vacanța e ascunsă din pagină**, ca în V1 (`VACANTA_IN_PAGINA = false`), cu spatele întreg;
   - **cutover-ul cere oprirea ceasului din V1**, altfel cei 29 de voluntari primesc câte două
     scrisori: acolo se stinge `NEWSLETTER_ACTIV`, aici se rutează subdomeniul.
   ⚠️ **Cutover-ul curățeniei s-a îngreunat pe 14.09 seara**: cei 29 au acum conturi pe platformă, dar
   **pe STAGING**. Când se face cutover-ul, conturile trebuie să existe pe producție — adică `users`,
   `asocieri` și granturile de `cleaning.manage` se copiază și acolo, cu același script. Altfel oamenii
   ajung pe o curățenie fără echipă, iar V1-ul e deja stins.

4b. **Asocierile — echipele aplicațiilor** (14.09.2026, cerere a utilizatorului). Ce a rămas:
   - ⚠️ **numai curățenia are asocieri.** Registrul (`packages/contracts/src/asocieri.ts`) e generic și
     ține o singură intrare. Biblioteca are încă tabelul ei de **cereri de acces** (păstrat anume pe
     13.09) și dreptul `library.borrow` dat de mână — adică **două mecanisme pentru același lucru**.
     De întrebat utilizatorul dacă biblioteca trece și ea pe asocieri, cu `library.borrow` legat de
     eticheta ei, ca la curățenie;
   - **ecranul „Oameni" din Administrare e nou și minimal**: listează conturile și schimbă rolul
     global. N-are căutare, n-are paginare (merge până pe la o sută de conturi) și nu arată
     granturile punctuale (`cleaning.manage`, `library.borrow`) — alea se văd doar în aplicația lor;
   - **omul nu e înștiințat** când i se acceptă sau i se refuză cererea: o vede abia când intră pe
     contul lui. O scrisoare prin comunicare ar fi firească — de cerut;
   - **adminul nu e înștiințat** când apare o cerere: o vede la următoarea deschidere a panoului;
   - ⚠️ `/utilizatori/lista` întoarce **toți** utilizatorii platformei, fără plafon. E bine la zeci de
     conturi; la mii, aici se pune `LIMIT` (locul e însemnat în `depozit.ts` al identității).
4c. **SETĂRILE (`@xc/setari`) — ce a rămas deschis** (15.09.2026):
   - ✅ **PUBLICAT PE PRODUCȚIE 15.09.2026, 15:45** — **16 workeri**, în ordinea care contează:
     întâi `xc-authz` singur (cheia nouă `audience.manage` și scoaterea lui `audit.read` trăiesc în
     `@xc/contracts`, iar un authz vechi respinge cheia necunoscută și traduce orice răspuns prost
     în REFUZ), apoi `xc-audit` și `xc-communication`, apoi cele 13 aplicații. Toate cele 12
     hostname-uri răspund, `/setari` dă 303 spre `cont` la cine nu e intrat.
     ⚠️ Aplicațiile care au primit legături noi în `wrangler.jsonc` **trebuie republicate ca să le
     capete** — o legătură scrisă în fișier nu există la Cloudflare până la deploy. De aceea au
     intrat în publicare și cele care n-aveau cod nou, ci doar legături;
   - ⚠️ **PROBAT LOGAT DOAR LOCAL.** Pe producție nu mă pot autentifica: codul de șase cifre pleacă
     în cutia poștală a userului, iar `123456` merge numai în dev. Deci partea văzută de un om
     intrat — pagina de Setări cu cele trei trepte ȘI **poarta panoului de Administrare** — e
     verificată doar pe local. **De cerut userului să deschidă `admin.sfantul-ilie.ro` și
     `<app>/setari`** la prima ocazie; panoul e cel cu miză, fiindcă acolo s-a mutat poarta;
   - ⚠️ **`curatenie`, `live`, `radio` n-au putut fi probate local deloc** (nu sunt în `pnpm dev`).
     Pe producție răspund, dar Setările lor n-au fost văzute cu ochii de nimeni — mai ales
     curățenia, unde e singura rubrică de **apartenență** din platformă;
   - ⚠️ **părintele pierde `admin/schema`** odată cu `audit.read`. Userul a ales știind; dacă se
     răzgândește, drumul curat e o cheie proprie a schemei, nu `audit.read` înapoi la admin;
   - **abonații se văd pe e-mail și pe `user_id`**, nu pe nume: lista vine de la comunicare
     (`audience_members`), care nu ține numele. Dacă userul vrea nume, se cer de la identitate la
     afișare — nu se copiază în aplicație;
   - **jurnalul aplicației e gol acolo unde aplicația nu scrie nimic**. Din runda asta scriu faptele
     Setărilor peste tot; restul acțiunilor rămân nescrise în aplicațiile care n-au avut niciodată
     audit (biblioteca, curățenia, biblia, newsletter, live, radio, home). De întrebat ce merită
     scris în fiecare — altfel zona arată mai goală decât e viața aplicației.
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

14. **Răsfoitul, ce a rămas** (13.09.2026, seara):
    - ⚠️ **licența a doua pentru Real3D FlipBook** — de cumpărat, e singurul lucru care ține răsfoitul
      pe staging. Fără ea nu se face cutover pe producție;
    - **probat pe staging, cu ochii, la 1280 px și la 390 px**; ce NU s-a probat: sunetul paginii
      întoarse (poza nu-l aude), zoomul cu două degete pe un telefon adevărat, și un număr cu 8
      pagini (toate probele au fost pe unul de 4);
    - modulul aduce **jQuery** în platformă — singura bibliotecă străină de până acum. Trăiește numai
      în fereastra răsfoitului, adusă la prima apăsare, deci nu atinge restul paginilor;
    - **newsletterul n-are răsfoit** și nici nu-i trebuie: numerele lui sunt HTML, nu PDF;
    - de întrebat dacă răsfoitul se cuvine și la **Tipic** (cele trei cărți scanate, până la 67 MB).
      Acolo ar conta `Range` și numărul de pagini — altă socoteală decât o foaie de 4 pagini.

15. **Textele citite la chinonic, ce a rămas** (16.09.2026, după REPARSAREA ÎNTREGII ARHIVE, seara —
    Website **0.7.0**, publicat):
    - ⚠️⚠️ **CIFRELE DE ACUM** (după reparsare, măsurate pe `/stare`): la chinonic **252 bune din 317**
      (erau 186), fără textul întreg 46, fără autor 21, adresă moartă 8, **fără titlu 0**, **fără
      bucata din buletin 0**, fără sursă 0, numai cu mențiune (fără legătură) 10. La textele din
      buletinul parohiei: **61 bune din 131**, 68 fără textul întreg (PDF-uri scanate). Aducerea:
      334 cu text întreg (erau 295), **14 nesigure (erau 52)**, 74 fără text, 16 erori.
    - ⚠️⚠️ **CAUZA CELOR TREI DEFECTE DE CLASĂ ERA UNA: celulele `mailpoet_blockquote` nu se citeau.**
      Când redactorul a pus textul citit ca CITAT, corpul articolului stătea într-un tabel încuibat:
      celula de afară se taie la primul `</td>` (al dungii citatului), deci ieșea goală, iar cea de
      dinăuntru n-avea clasa cerută de `blocuri()`. Urmarea: articolul rămânea cu titlul și numele
      autorului drept tot corpul lui — de unde „fără autor cu numele drept text", bucățile sub 40 de
      semne și textele bune ținute „nesigure". **Articole cu corp sub 200 de semne: 85 → 3.** Userul
      avea dreptate: „vizual se vede mereu, 10-12 rânduri de text după autor".
    - ⚠️ Ce a mai ieșit la reparsare: `sursa_text` care e doar numele gazdei **nu se mai scrie**
      (`eNumeleGazdei` — se compară numai literele, deci și „Cuvântul Ortodox" față de
      `cuvantul-ortodox.ro`); mențiuni scrise de om rămase: 156 din 448, în loc de 290 de nume de gazdă.
    - **De lucrat mai departe** (munca omului, nu a uneltei): cele **21 fără autor** și **46 fără
      textul întreg** de la chinonic; la fiecare, pricina e scrisă pe rând în `/stare`.
    - ⚠️ **CE N-A IEȘIT CURAT: coada a vreo 40 de fișe.** Măsurat pe cele 348 cu text întreg: 230 se
      sfârșesc curat, 20 cu mențiunea sursei (așa trebuie), **98 nici una nici alta** — din care cele
      mai multe sunt sfârșituri adevărate fără punct („…în veci. Amin", „Ed. Egumeniţa, 2008"), dar
      vreo 40 au în coadă o rămășiță de site („Urmăriți-ne pe Facebook", un titlu de articol vecin) ori
      se opresc la mijloc de frază. Sunt pagini-adunătură, unde hotarul de jos nu se poate ghici după
      formă. **Nu se repară la nimereală**: se cere userului o fișă anume și se măsoară pe ea.
    - ⚠️ **LOCUL DE INVESTIGAT E PAGINA `/texte-citite-la-chinonic/stare`** (16.09.2026): categoriile
      cu probleme, fiecare rând cu pricina lui și cu numărul de buletin din care vine. Pentru lucru în
      terminal, aceleași liste se scot și cu `stari.mjs` (`--lista=<nesigur|fara-text|eroare|
      fara-link|link-mort|fara-autor|gata>`, Markdown la ieșire; fără argumente, socoteala).
    - **448/448 cu titlu · 420/448 cu autor** (61 au „Sinaxar", după regula din `titlu-autor.mjs`).
      Cele **28 rămase fără autor** sunt cuvinte și predici unde buletinul n-a scris niciun nume —
      nici în cap, nici în text: **de căutat la sursă**, e munca rămasă.
    - **Cele trei fără titlu s-au închis** (nr. 198, 250, 556: buletinul n-a scris niciunul, iar textul
      începe de-a dreptul). Titlurile sunt luate de la sursă, din adresa paginii, și stau în
      `indreptari.json` sub „__3". ⚠️ Slugul lor rămâne cel înghețat (`text-198-2`): el e adresa fișei.
    - cele **75 „fără text"** sunt în cea mai mare parte **PDF-uri scanate** (fotografii ale unei foi,
      fără strat de text): de acolo nu se poate scoate nimic fără OCR adevărat.
    - ⚠️ **HOTĂRÂREA DESPRE LINK S-A SCHIMBAT la 16.09.2026** și înlocuiește regula veche („când
      textul e adus peste tot, se scoate linkul și rămâne doar numele"): **legătura se pune efectiv,
      iar pragul nu mai e textul, ci adresa** — vie, se scrie; moartă (404/410) ori mută, rămâne doar
      numele, nelegat, „ca să știu că nu mai era valabil linkul". Starea se ține în bază
      (`link_stare`) și se aduce la zi cu `verifica-linkurile.mjs` (`--reia`, `--picate`, `--doar=`).
      **De reluat din când în când**: adresele mor în tăcere, iar pagina arată ce s-a măsurat ultima dată.
    - ⚠️ **HOTĂRÂRILE USERULUI DE DINAINTEA REPARSĂRII** (16.09.2026, seara, întrebat pe cele trei):
      (a) rândul „din: Editura…" de la capătul articolului **se PĂSTREAZĂ** — e cinstirea sursei;
      (b) subtitlurile dinăuntrul articolului devin **paragraf îngroșat**, nu titlu (`<p class="ch-sub">`);
      (c) textul se rescrie **la toate**, nu doar la cele stricate. Iar întrebarea despre cele 33 de
      fișe cu bucată prea scurtă a căzut de la sine: erau tocmai defectul de citire de mai sus, iar
      acum categoria e goală.
    - ⚠️ **AMÂNDOUĂ PAGINILE SE FILTREAZĂ** (16.09.2026, Website 0.6.3, cerut anume: „totul ascuns în
      afară de ce e selectat, la intrare prima opțiune selectată"). Lista mare: **bara anilor**
      (`?an=`), prima opțiune = anul cel mai nou, **fără „toate"** — asta era tocmai lista grea; 2026
      se deschide în 33 KB, față de 211 KB cât avea întreaga. Pagina de stare: **cuprinsul E filtrul**
      (`?ce=`), o singură categorie o dată, prima la intrare, plus o **bară a anilor înăuntrul
      categoriei**, unde prima opțiune E „Toți anii" (pe o pagină de investigat, a ascunde din pornire
      tot afară de anul curent ar ascunde tocmai ce e de cercetat). Filtrul e o **navigare**, nu o
      ascundere din JS: merge fără script, are adresă, iar serverul trimite numai rândurile alese.
      Bara e cea de la Program și Newsletter (`bara-ani` / `an-buton`), fără săgeți (aici nu e antetul
      care le scrie). Probe: încă 7 în `tests/chinonic-fisa.test.ts` (27 cu totul).
    - ⚠️ **NUMAI TEXTELE LEGATE DE UN NUMĂR TRIMIS se investighează** (user: „vreau să mă uit doar pe
      texte care fac parte dintr-un anumit buletin online publicat și transmis… pune-le separat, că nu
      vreau să mă uit pe ele"). Un text fără asociere **iese din toate categoriile** și stă în ultima,
      „Fără număr de buletin" — dar numai dacă Newsletterul **chiar a răspuns**: harta goală e
      necunoaștere, nu lipsă, și atunci pagina rămâne întreagă.
    - ⚠️⚠️ **CAPCANĂ: `chinonic/asocieri.json` din R2 se învechește în tăcere.** `asocieri.mjs` îl
      scrie din `/data/chinonic.json` **pe slug**, deci orice rundă care schimbă sluguri (titluri noi
      din `indreptari.json`) îl lasă în urmă, iar pagina de stare scrie „număr necunoscut" fără ca
      ceva să pară stricat. **S-a întâmplat**: 114 din 448 rămăseseră pe sluguri vechi de felul
      `text-232-1` — de acolo venea plângerea userului („nu știu din ce număr sunt"). Reparat la
      16.09.2026 rulând `asocieri.mjs --chiar`; verificat 0 sluguri nepereche în ambele sensuri.
      **După orice import care atinge slugurile, rulează unealta din nou.**
    - ⚠️⚠️ **VIEȚILE DE SFINȚI, HOTĂRÂRE A USERULUI** (16.09.2026, 15:06: „viețile de sfinți — să le
      validezi, lasă doar Sinaxar la sursă și atât — mută-le la valide"). Website **0.6.4**. Trei
      urmări, toate REGULI ÎN COD (nu îndreptări în bază, ca să țină la reimport):
      **(1)** la „Sursa" scrie **doar «Sinaxar»** — fără mențiunea din buletin, fără numele site-ului,
      fără legătură. `sursa_url` **rămâne în bază**: de acolo se aduce textul, doar că nu se mai scrie.
      **(2)** o adresă moartă **nu mai e problema lor** (ies din categoria „adresă moartă": 16 → 12) —
      sursa unei vieți de sfânt n-a fost niciodată site-ul.
      **(3)** textul adus se **validează** chiar dacă nu începe ca fragmentul (`adu-textul.mjs`, la
      `!par.potrivit`): o viață de sfânt e aceeași povestire REPOVESTITĂ de fiecare sinaxar, deci proba
      fragmentului cade pe nedrept. ⚠️ **La textele CUIVA proba rămâne întreagă** — acolo textul chiar
      e al unui om, iar o nepotrivire înseamnă alt text.
      Urmarea în cifre: 3 vieți „nesigure" au trecut pe `gata` (aveau fragment de 28, 17 și 0 semne —
      n-a existat niciodată cu ce fi verificate), deci **38 din 64 de sinaxare sunt gata**.
      ⚠️ **Rămân 26 de vieți fără NICIUN text adus**: 9 n-au deloc adresă în buletin, 13 au adresă vie
      dar pagina/PDF-ul n-a dat text (scanări), 4 au adresa moartă. Ele nu se pot „muta la valide" —
      n-au ce arăta. **Deschis**: le căutăm textul într-un sinaxar oarecare, după numele sfântului?
      Hotărârea userului tocmai a deschis drumul (sursa nu mai contează), dar e muncă de pornit anume.
    - ⚠️⚠️ **CELE TREI PAGINI, FORMA CERUTĂ SEARA** (user, 16.09.2026, Website 0.7.0): pe **ușa
      Website-ului** stau **DOUĂ categorii** (chinonic și buletin), zece rânduri fiecare, **doar titlul
      și autorul**, plus „Vezi toate" — fișa bogată de dinainte (bucată de text, „Citește tot", sursa)
      a IEȘIT de pe ușă, cu tot cu scriptul desfășurării și cu ruta `?bucata=text`; **lista întreagă**
      arată **numai cele bune**, filtrate pe ani, și spune câte au rămas de lămurit; **pagina de
      probleme** (`/stare`) ține restul, pe feluri de lipsă, o categorie o dată.
      ⚠️ **Fiecare grămadă are pagina ei de probleme**: `/texte-citite-la-chinonic/stare` ȘI
      `/texte-din-buletin/stare` — altfel, de când lista arată numai ce e bun, grămada de lucru a
      userului ar fi devenit invizibilă.
      ⚠️ **Un singur `eBun` ține toate trei paginile.** Dacă se lărgește judecata, se lărgește și ce
      urcă pe fața parohiei — de aceea nu se atinge fără măsurătoare.

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
| newsletter | `newsletter.staging.sfantul-ilie.ro` | 460 de numere trimise din 2017 (R2, 722 MB) — la zi 15.09.2026 |
| live | `live.staging.sfantul-ilie.ro` | directul slujbei: starea emisiei, aparatul din biserică, SFU |
| radio | `radio.staging.sfantul-ilie.ro` | 777 de piese / 62,5 ore (R2 refolosit), ceasul, muzica, microfonul |
| admin | `admin.staging.sfantul-ilie.ro` | audit, livrări, automatizări |

## Stare tehnică

⚠️ **„LIVE" înseamnă STAGING** cât timp nu s-a făcut cutover-ul (user, 13.09.2026: „Live = staging
pana nu facem cutover"). Când cere ceva „pe live", locul e `*.staging.sfantul-ilie.ro`. Producția V2
e goală — **zero workeri `xc-*-production`**, fără resurse și fără rute —, iar pe subdomeniile
parohiei trăiesc încă aplicațiile V1. Mutarea rutelor rămâne pas explicit, cerut anume.

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

## DISPECERATUL — ce a rămas din A7 „comunicări" (14.09.2026)

**Nu e o portare și nu e o aplicație**: e o **anexă în `admin`**, la `/dispecerat` (user: „pe
Dispecerat le-aș pune", „nu vreau să mai am un alt subdomeniu", „dispeceratul este o anexă în
admin"). Din A7 se iau **două funcții**: e-mailul (Cloudflare) și WhatsApp-ul (WAHA de pe NAS).

Ce are ecranul: **cele două canale scrise separat** (e-mailul: „trimite" / „sandbox"; WhatsApp:
câte-s în coadă + când a întrebat ultima oară pullerul), **audiențele** cu membri pe canal,
**trimiterea** către o audiență și **arhiva** a ce a plecat de acolo. Ecranul e BFF — nu ține nimic.

Patru lucruri care se încalcă ușor:

1. **⚠️ „În coadă" NU înseamnă „trimis".** E-mailul pleacă din Cloudflare, pe loc; WhatsApp-ul pleacă
   **de acasă**, prin puller. Paginile n-au voie să le scrie la fel — e păzit de probe.
2. **⚠️ Coada stă în `deliveries`**, nu într-un tabel nou: arhiva a ce a plecat rămâne **una
   singură**. Stări: `in_asteptare` → `in_lucru` (luat de puller) → `sent` / `failed`
   (migrația `communication/0003`).
3. **⚠️ Ușa pullerului e singurul loc din Administrare fără sesiune.** `admin/dispecerat/coada` și
   `/livrat`, numai POST, legitimare cu `x-xc-intern`; fără el **404, nu 403**. Trece prin `admin`
   fiindcă `communication-worker` n-are adresă publică și nici nu capătă una. Probe:
   `tests/dispecerat.test.ts` (5), inclusiv „dacă workerul n-are secret, ușa e închisă pentru toți".
4. **Drepturi**: vederea cere `communication.create` (vine cu `admin`), trimiterea
   `communication.send` — care azi vine **numai cu super-admin**. ⚠️ **De întrebat utilizatorul**
   dacă părintele (administrator) trebuie să poată trimite: e o schimbare de model, nu o potriveală.

⚠️ **Pullerul nu e încă întors spre V2**: `COMUNICARI_URL` arată spre `comunicari.sfantul-ilie.ro`.
Schimbarea cere recrearea containerului → **#agent-server**, nu acest agent.

## LIVE și RADIO (A5 din V1) — emisia parohiei, în două aplicații

Portat pe 14.09.2026. `transmisiuni` din V1 a fost **împărțită în două aplicații**, cerere a
utilizatorului: „una se numește radio și alta live". Pe `radio` a venit **tot ce era pe
transmisiuni** (playerul public, panoul, muzica, microfonul); `live` e al doilea subdomeniu, cu
publicul „ce se transmite acum" și **același panou**.

**Cine ce ține** — asta e singura decizie care contează, restul decurge din ea:

- **`live` e CREIERUL**: starea emisiei, aparatul din biserică (comandă + telemetrie),
  semnalizarea WebRTC (două canale: slujba și microfonul), numărătoarea ascultătorilor.
  Obiecte durabile: `Direct`, `Aparat`, `Ascultatori`.
- **`radio` ține muzica și CEASUL**: ce selecție curge și de când. Obiect durabil: `Radio`.
- ⚠️ **PAGINA MICROFONULUI e la `live`, pe `/mic`** (mutată 15.09.2026, cerută anume: „aș vrea să fie
  în live.sfantul-ilie.ro/mic — tot așa vizibil doar super-adminilor"). Stă acum acolo unde sunt și
  canalele SFU, deci cheamă semnalizarea direct (`/mic/stare`, `/mic/asculta`, `/mic/asculta/<sid>`),
  fără săritură prin alt worker; `/_intern/mic/*` a ieșit din `live`, n-o mai cere nimeni. Pe `radio`
  a rămas **303 spre `live/mic`**, pentru legăturile vechi. Poarta rămâne **super-administrator**
  (pricina e scrisă în `apps/live/src/mic.ts`: microfonul se aude și când publicul ascultă radio).
  Nu se bate cu „panoul e unul singur, la radio": microfonul nu comandă nimic, doar ascultă.
- ⚠️ **LIVE și radioul se exclud**, ca pe aparatul din V1 — dar acum trăiesc în workeri diferiți.
  Regula: **`live` hotărăște, `radio` ascultă.** Când pornește directul, `live` stinge ceasul
  radioului; la STOP îl pornește la loc. **Dacă `radio` ajunge vreodată să comande directul singur,
  cele două se contrazic și se aud amândouă.**
- Vorbesc prin **Service Binding**, pe adrese `/_intern/…` care **nu se servesc de pe internet**
  (fără antetul `x-xc-intern` → **404**, nu 403 — ca `/_actiuni` din chat, ADR 0007). Verificat.

**Ce e scris o singură dată** (`packages/comanda`, `@xc/comanda`): socoteala ceasului (`ceSeAude`),
playerul cu două surse și trecere lină, **panoul de administrare** și butonul play/stop. Panoul e
montat identic la `/admin` în amândouă; el nu știe care aplicație îl servește, fiindcă vorbește
numai cu originea lui, iar fiecare aplicație compune răspunsul cerându-i celeilalte partea ei.

**⚠️ Cele două pagini publice NU se poartă la fel** (user, 14.09.2026, după ce le-a văzut):

- **`live` e a SLUJBEI.** Dacă nu se transmite în direct, pagina **nu pornește radioul ca să umple
  liniștea** — scrie „Nu e nicio transmisiune în direct acum" și arată **următoarea slujbă** din
  program („Următoarea slujbă transmisă: … — mâine, la 18:00"). Cartela radioului nici nu se
  randează acolo. În cod: `jsPlayer(prefix, { doarDirect: true })`.
- **`radio` e a PAROHIEI.** Acolo playerul e cel din V1: cântă radioul, iar când începe slujba
  trece lin pe direct — omul a venit să asculte parohia, nu anume slujba.

**⚠️ „Administrare" din meniul contului duce la PANOUL EMISIEI**, nu la administrarea platformei —
și duce la **aceeași adresă** din amândouă aplicațiile: panoul de pe `radio` (user, 14.09.2026: „să
ducă în același admin de la Radio, care e și acum la transmisiuni"). E o **potriveală locală readusă
dinadins**: în V1 fiecare aplicație trimitea „Administrare" la panoul ei, iar la trecerea pe V2
lucrul ăsta a fost șters peste tot. Aici s-a refăcut, fiindcă emisia are un singur panou și omul
care intră pe `live` sau pe `radio` îl caută pe ăla. Probe în `tests/emisie.test.ts` — altfel
următorul care „aliniază meniul cu restul platformei" îl scoate fără să știe de ce era acolo.

**⚠️ Contul e în antet pe AMÂNDOUĂ paginile publice** (user: „trebuia să fie Cont pe ambele… nu e
nevoie, dar Cont acolo sus e o invitație"). În V1 pagina de ascultare era singura fără el („un
player simplu, nu e nevoie de login"). Regula aia a căzut, și **nu din motive tehnice**: ascultatul
rămâne la liber, dar omul care ascultă e chemat să-și facă un cont. Nu-l scoate înapoi.

**Comutatorul**, cum a fost cerut: **RADIO | LIVE**, plus **OPRIT** rămas doar la super-admin.
⚠️ Ordinea e cea cerută pe 14.09.2026 („la admin trebuie să fie LIVE pe mijloc și RADIO stânga"):
în V1 LIVE era primul, acum stă la **mijloc**, ca butonul care pornește transmisiunea din biserică
să nu mai fie cel de la marginea din stânga. Pe butonul din stânga scrie **RADIO**, dar modul se
cheamă `stop` în cod și pe sârmă (`ActiunePanou`) — eticheta spune ce se aude, numele intern spune
ce se întâmplă cu directul; se unifică numai amândouă odată (contract + `live/stare.ts` + `radio` +
teste). ⚠️ **STOP nu e liniște** — oprește directul, iar radioul reia de unde rămăsese. Liniștea de tot e
OPRIT, și a rămas la super-admin ca în V1 („radioul vreau să meargă permanent… opritul manual nu
are sens decât pentru mine ca super-admin" — Părintele dă mute).

**Patru lucruri care se încalcă ușor:**

1. **Sunetul NU trece prin worker.** Directul: aparat → WHIP → Cloudflare Realtime SFU → ascultător;
   radioul: depozit → browser. Workerul schimbă doar SDP-uri și servește fișiere. Cine „optimizează"
   trecând sunetul prin worker plătește fiecare ascultător.
2. **Ceasul, nu starea.** Nu se ține scris ce piesă se aude — se ține DE CÂND curge selecția și se
   socotește. De aceea radioul merge singur la nesfârșit, fără cron și fără aparat. Corolar:
   **duratele trebuie să fie EXACTE** (numărate din cadre), altfel eroarea se adună și după o oră
   pagina arată altă melodie decât se aude — asta era „schimbă melodia în mijlocul uneia" din V1.
3. **Se servește numai ce e în indice.** Bucketul ține și `remote/` (înregistrările slujbelor) și
   `predici/`. Ruta de fișier verifică lista înainte să dea ceva, iar `caleCurata` **refuză** (nu
   „repară") orice cale absolută, cu `..` sau cu componente ascunse. Probat.
4. **Paginile vorbesc numai cu originea lor.** Cele două stau pe subdomenii diferite; dacă un script
   ar cere direct de la celălalt, ar avea nevoie de CORS și de cookie-uri între origini. O probă
   păzește regula (`tests/emisie.test.ts`).

**⚠️ Depozitul e cel din V1, REFOLOSIT** — hotărâre a utilizatorului (14.09.2026: „cei 11gb poți să
îi folosești sau să redenumești R2-ul… ca să nu mai faci atâtea operații"). Redenumirea unui bucket
R2 **nu există** la Cloudflare, deci s-a ales refolosirea: `biserica-transmisiuni`, cu `mp3player/`
(muzica, 777 de piese, 62,5 ore), `remote/` și `predici/`. E o **abatere știută** de la „nu se
refolosește nimic din V1, tot ce e nou poartă prefixul `xc-`" — luată ca să nu copiem 11 GB cu
câteva zile înainte de cutover. **La curățenia de la final bucketul ăsta NU se șterge.**

**Secretele** (`SFU_APP_ID`, `SFU_APP_SECRET`, `WHIP_SECRET`, `APARAT_SECRET`) au fost trecute din
V1 cu aceleași valori, dinadins: așa aparatul din biserică are de schimbat **numai adresa** la
cutover, nu și parolele.

**Adresa veche a indicelui, ținută dinadins**: aparatul cere duratele de la Worker, de pe
`GET /v1/radio/biblioteca` (`aparat/worker.py: ia_indice`) — cu ele își ține ceasul radioului în
boxe. Muzica stă acum pe `radio` (`/v1/biblioteca`), deci `live` răspunde și pe adresa veche,
luând indicele prin binding-ul RADIO. Fără ea, promisiunea „aparatul schimbă NUMAI adresa" era
falsă: daemonul ar fi mers pe indicele din cache, scriind „nu pot lua indicele de la Worker" la
fiecare rundă. Probat pe staging: 777 de piese, aceeași semnătură ca în V1 (`eb7e0df1747616c0`).

**Ce NU s-a adus din V1**: `/schema` (pagina de documentație a împărțirii — nu mai descrie
realitatea, aplicația e acum două) și `/intern/aparat/continut` a rămas ca o adresă care răspunde
politicos, dar **nu mai scrie indicele**: de când muzica stă în depozit, adevărul e acolo, nu pe
aparat.

## Capcane de ținut minte

- **⚠️ UN WORKER PUBLICAT FĂRĂ RUTĂ NU E INOFENSIV — cronurile nu au nevoie de rută.**
  Descoperit 14.09.2026: `xc-curatenie-production`, publicat fără rută, rulează `0 * * * *` de la
  publicare — bătaia lui e scrisă în `app_settings.newsletter_cron_last_check` din baza de PRODUCȚIE.
  Se vede acolo ora exactă a ultimei bătăi; de acolo a ieșit la iveală.
  - **În V2 NU mai există `NEWSLETTER_ACTIV`** (comutatorul din V1): ceasul decide singur, după ziua
    și ora din panou (`apps/curatenie/src/cron.ts`) — alertă vineri 9, săptămânal sâmbătă 16, lunar.
  - **Singura plasă e `LIVRARE_REALA: "nu"`** în `services/communication-worker/wrangler.jsonc`,
    pusă în toate cele trei medii. Cât e „nu", totul intră în nisip: se înregistrează, nu pleacă.
  - **⚠️ ORDINEA LA CUTOVER: întâi se stinge ceasul V1, abia apoi `LIVRARE_REALA="da"` pe V2.**
    Invers, cei 29 de voluntari primesc câte două scrisori.
  - **Înainte de orice scriere în `xc-*-production`, întreabă-te ce cron s-ar putea trezi peste
    datele proaspete.** Aici a fost în regulă fiindcă livrarea e stinsă — dar asta s-a *verificat*,
    nu s-a presupus.
- **⚠️ REGULA FERESTRELOR: pop-up deschis → pagina din spate NU se derulează** (user, 13.09.2026:
  „să fie o regulă generală când faci un pop-up"). Se scrie **o singură dată, în carcasă**
  (`@xc/ui`), nu la aplicație:
  - stilul e `html.cu-fereastra, html.cu-fereastra body { overflow:hidden; overscroll-behavior:none }`;
  - `JS_CAP` **îmbracă `HTMLDialogElement.prototype.showModal`**, deci **orice `<dialog>`** deschis
    modal capătă regula singur, oriunde ar fi scris, iar „close" (Escape, `<form method="dialog">`,
    `.close()`) o scoate. Numărătoare pentru ferestre suprapuse;
  - ce **nu** e `<dialog>` (panoul chatului, lupa copertei din bibliotecă) cheamă
    `window.xcFereastra.blocheaza()` / `.dezblocheaza()`.
  **Capcana care a ținut regula stricată** (scrisă de mână în patru aplicații, degeaba): `body`.
  Carcasa are `html { overflow-y:scroll }`, iar `overflow` de pe `body` **nu se mai propagă** la
  fereastră când rădăcina are overflow declarat — clasa se punea și pagina se derula mai departe.
  Blocarea merge **numai pe `<html>`**. (`scrollbar-gutter:stable` ține locul barei, deci nimic nu
  sare în lături.) Probe: `tests/carcasa.test.ts` — inclusiv una care umblă prin `apps/` și
  `packages/` și cade dacă o aplicație își rescrie blocarea pe cont propriu.
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

### Rândul de unelte din antet (refăcut 15.09.2026, după chipul Calendarului)

⚠️ **Asta e starea de acum; cea de dinainte — două grupuri despărțite de bara verticală, cu
întrerupătorul și cele trei hârtii în dreapta — a ținut din 11.09 până în 15.09.2026.** Cererea nouă a
venit în șase puncte („butonul cu bulina să fie primul… o zonă de scris (ca la Calendar)… iconița cu
săgeata dreapta - însemna săptămâna viitoare… Arhiva vine după săptămâna viitoare… butonul de abonare
o să vină ultimul ca în Calendar… întrerupătorul vine în pastilă după arhivă și după urmează un buton
download care adună butoanele").

**PASTILA ia tot rândul** (`flex:1 1 auto`), cu șase segmente în ordinea cerută:

1. **bulina** săptămânii de azi (măsură fixă, 46 px; 42 pe telefon);
2. **ZONA DE SCRIS** (`.acum`), care ia tot prisosul: „Săptămâna curentă" / „Săptămâna viitoare" /
   intervalul săptămânii deschise din arhivă / „Arhiva" pe pagina arhivei (`scrisulSaptamanii`).
   ⚠️ **Nu e buton, e zonă de semnalizare**, ca la Calendar: fundal de hârtie (`--paper`), scris roșu,
   fără `:hover`, fără `cursor:pointer`. Forma scurtă („Săpt. curentă") se scrie alături și o alege
   CSS-ul sub 600 px; datele stau în `title`;
3. **săgeata-dreapta** = săptămâna viitoare, **numai iconița, la orice lățime** (cuvintele ei s-au
   mutat în zona de scris — scrise în amândouă, ar fi spus de două ori același lucru).
   ⚠️ **Desenul stă SINGUR în buton, fără niciun înveliș** (18:28: „săgeata … nu e centrată vertical").
   Avea un `<span class="sgt">` moștenit de la Tipic, unde segmentul poartă și cuvântul „Mâine"; aici
   cuvântul a ieșit și învelișul rămas era chiar pricina abaterii: un copil flexibil care ține un desen
   **în linie** e o LINIE DE SCRIS, deci sub săgeată rămâne locul cozilor literelor. Măsurat: **9 sus /
   13 jos** cu înveliș, **10,5 / 10,5** fără el — aceleași cifre ca la cutia Arhivei, care n-a avut
   niciodată înveliș. **Regula**: un segment cu o singură iconiță nu primește `<span>` în jurul ei;
4. **Arhiva** — **CHEIA care coboară fâșia anilor** (numai la admini), vezi mai jos;
5. **întrerupătorul „Calendar"**, intrat în pastilă;
6. **butonul de DESCĂRCARE**, ultimul (numai la admini), cu meniul celor trei hârtii sub el.

**AFARĂ a rămas NUMAI Abonarea** (18:08: „butonul de download trebuie să fie în pastilă, ultimul, iar
butonul de abonare să fie singurul la dreapta, în exterior"). **Bara verticală și învelișul
`.unelte-dr` au căzut** — la Calendar n-au existat niciodată; pastila ia tot prisosul, deci abonarea
ajunge oricum lipită de marginea din dreapta (`margin-left:auto` o ține acolo și când rândul se rupe).

⚠️ **Pastila NU mai are `overflow:hidden`** — cu meniul descărcării atârnat de ultimul segment, l-ar
tăia și meniul n-ar mai apărea deloc (capcană plătită la Calendar cu o zi înainte). Rotunjirea
colțurilor o duc acum segmentele de la capete (`.pastila > :first-child` / `:last-child`, plus
`summary`-ul descărcării când ea e ultima).

Segmentul pe care ești e roșu și neapăsabil. Navigarea „săptămâna trecută" rămâne ieșită: „nu se mai
deschide săptămâna trecută, se poate selecta din pagina arhivei". Căsuța `.nav-jos` a dispărut de la
11.09.2026 și nu se întoarce.

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

**⚠️ CHEIA ARHIVEI ȘI FÂȘIA ANILOR** (15.09.2026, 18:28: „iconița de arhivă să afișeze anii cum sunt
lunile în Calendar"; ales din trei variante — „bară de ani sub antet"). Iconița cutiei **nu mai duce
dintr-o apăsare la `/arhiva`**: e o cheie (`#ani-cheie`, `aria-expanded`) care coboară **bara a doua**
de sub rândul de unelte (`.bara-ani`, `baraAnilor`), fâșie derulabilă stânga-dreapta cu anii
descrescător; un an duce la `/arhiva?an=<an>`. E aceeași unealtă ca `baraLunilor` din Calendar,
copiată cu anii în locul lunilor — aceleași săgeți ‹ ›, scrise de JS **numai dacă anii chiar nu încap**
(pe desktop încap toți; pe un telefon de 390 se văd vreo patru și jumătate).

- **`hidden` îl scrie SERVERUL**, la fiecare pagină: fâșia se strânge singură după alegerea unui an,
  fără nicio linie de JS — alegerea e o navigare, iar pagina următoare se naște cu bara sus.
  ⚠️ **AFARĂ DE PAGINA ARHIVEI, unde NU se scrie `hidden`** (18:56) — vezi punctul următor.
- ⚠️ **Așezarea anului deschis la mijloc se face DUPĂ coborâre** (cât timp bara e `hidden`, `offsetLeft`
  și `clientWidth` sunt 0), iar `.fasie` are `position:relative` — fără el `offsetParent` ajunge pagina
  și fâșia se deschide derulată la capăt. Amândouă sunt capcane plătite la Calendar.
- **Anii vin din baza de date** (`aniiArhivei`), deci un an nou apare singur. ⚠️ Fâșia stă în antetul
  **oricărei** pagini, nu doar pe `/arhiva`, așa că lista se cere **o dată cu săptămâna**, în același
  `Promise.all`, și **numai pentru admini** — pagina nu așteaptă nicio interogare în plus.
- ⚠️ **Fără ani (paginile care nu întreabă baza — mesajele de eroare), segmentul rămâne LINKUL** de
  până acum spre `/arhiva`: o cheie care ar coborî o fâșie goală nu face nimic la apăsare, iar butonul
  nu se ascunde niciodată (regula rândului de unelte).
- **Aprins de la fâșie** (`aria-expanded="true"`) și **marcat de loc** (`.activ`, pe pagina Arhivei și
  pe săptămânile deschise din ea) sunt două lucruri: al doilea rămâne și cu fâșia strânsă.
- **Drumul înapoi n-a slăbit**: săptămânile deschise din arhivă își păstrează butonul „← Înapoi la
  arhivă" de deasupra titlului, care le duce chiar unde rămăsese omul.
- **⚠️ PE `/arhiva` FÂȘIA E PERMANENT LA VEDERE, IAR RÂNDUL DE ANI DIN PAGINĂ A FOST SCOS**
  (15.09.2026, 18:56: „scoate din pagină anii atunci când ne aflăm în arhivă și să faci bara cu ani,
  care apare sub antet, permanent vizibilă cât mă aflu pe o pagină arhivă"). `nav.capitole` din corpul
  paginii a dispărut cu totul, cu potriveala lui de stil (`.capitole a.acum`) — clasa rămâne în carcasă,
  pentru alte aplicații. **Cele două jumătăți se țin una de alta**: fâșia e acum SINGURUL drum dintre
  ani, deci:
  - **cheia se scrie INERTĂ acolo** (`aria-disabled="true"`, `aria-expanded="true"`, `aria-current`, ca
    bulina și săgeata când ești chiar pe săptămâna lor), iar JS-ul **nu-i mai pune ascultătorul de
    apăsare** — altfel omul ar putea strânge peste el singurul selector rămas. `:hover` și
    `cursor:pointer` se scot cu `:not([aria-disabled="true"])`;
  - **fâșia se scrie și pentru omul FĂRĂ drepturi de admin**, dar numai pe `/arhiva`: adresa n-a fost
    niciodată încuiată (pagina de mesaj o dă ca link tuturor), iar fără fâșie ar rămâne închis într-un
    singur an. Atunci bara stă **singură sub rândul de unelte**, fără cheie deasupra — de aceea JS-ul
    merge și cu `cheie` lipsă (`if (!bara || !fasie) return`, nu `!cheie`);
  - **așezarea la mijloc se face la încărcare**, nu la coborâre, fiindcă bara e deja jos.
  Probele: `tests/program-arhiva-ani.test.ts` (5) — păzesc o regulă de DRUM, nu o funcție: oricare
  dintre cele trei scăpări de mai sus lasă omul închis într-un an, fără nicio eroare vizibilă.

**Pagina arhivei se cheamă doar „Arhiva"**, iar **sub titlu nu mai stă NIMIC**: numărătoarea
(„655 săptămâni, din 2014 până azi") a ieșit la 15.09.2026, 19:22 („scoate textul acesta de la
Arhiva"), după ce mai demult ieșise propoziția despre importul din situl vechi. **Nu le readuce.**
⚠️ Odată cu numărătoarea au plecat și `total`/`deLa` din socoteala paginii **și interogarea
`acoperire` din `index.ts`**, care doar pentru ea se făcea — o cerere la bază mai puțin la fiecare
deschidere a arhivei. Cifrele întregi se văd oricând la `/health`.

### Pe telefon

**⚠️ CADE SCRISUL BUTOANELOR, NU ZONA DE SCRIS** (regula Calendarului, 15.09.2026: „pe mobil, neapărat
să se vadă scrisul"). Sub 600 px: Abonarea rămâne numai plic (din `@xc/abonare`), zona de scris trece
pe forma scurtă, butoanele-iconiță ale pastilei se fac **pătrate de 42 px** (38 sub 380 px) și
padingul se strânge. Numele întregi stau în `title`/`aria-label`, deci nu se pierd.

**⚠️ FORMA DE TELEFON A ZONEI E UN SINGUR CUVÂNT: „Curentă" / „Viitoare"** — nu „Săpt. curentă".
Măsurat pe un telefon de 390: pastila ia tot rândul (335), butoanele ei cer 42×3 = 126 + întrerupătorul
(~74) + descărcarea (~36) = **236**, deci zonei îi rămân ~79 px, iar „Săpt. curentă" cere ~85 și **ieșea
tăiată la amândouă capetele** (scrisul e centrat). Cuvântul singur cere ~55 și încape și la 360.
Plasă: `text-overflow:ellipsis` pe scris — la o strâmtare și mai mare se taie cu trei puncte, nu la
mijlocul literelor.

**⚠️ TOT RÂNDUL STĂ PE O SINGURĂ LINIE, ȘI LA ADMIN** (user, 15.09.2026, 18:20: „nu trebuie să fie pe
mai multe rânduri meniul mai ales la admini"). Ce a făcut loc: **becul întrerupătorului, care cerea
35 px** — pe telefon segmentul rămâne un pătrat cu iconița, iar **starea o spune segmentul: aprins, se
umple cu cerneală și iconița se face hârtie** (exact ce făcea becul; roșul rămâne interzis aici, după
regula din 11.09). Pe desktop becul e neatins.

**Socoteala, la un super-admin (rândul cel mai plin), pe un telefon de 390 cu 335 de folosit**:
42×3 = 126 (bulină, săgeată, Arhivă) + întrerupătorul 42 + descărcarea 35 + zona de scris ~75 = **278**,
plus spațiul de 5 și abonarea de 44 = **327**. Încape, cu 8 px de prisos. **La 360** (305 de folosit)
butoanele scad la 36, descărcarea la 29 și padingul zonei la 6 → **~300**; cu 38/31 și padding 8 cerea
312 și se rupea, deci marja e de un deget. ⚠️ **Dacă mai adaugi ceva în rând, socoteala asta se reface
— nu mai e loc de împrumut.**

**⚠️ Dacă adaugi ceva în rândul de unelte, măsoară din nou** (rețeta e mai jos) — zona de scris e prima
care se strânge.

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
- **Butonul de download e UNUL SINGUR, cu meniu sub el, și stă ULTIMUL ÎN PASTILĂ** (15.09.2026: „un
  buton download care adună butoanele download program afișat (singur/dublu), program tipar pdf,
  program tipar jpg"; la 18:08: „în pastilă, ultimul") — aceeași
  mutare ca la cele trei cruci ale Calendarului, cu o zi înainte. Trei rânduri: **Programul afișat**
  (poza paginii), **Program tipar — PDF**, **Program tipar — JPG**; fiecare cu numele scris, nu doar
  cu iconița.
  - **Rândul „Programul afișat" dă exact ce se vede**: aprins → săgeată **dublă** + `?coloane=2`,
    stins → săgeată **simplă** + `?coloane=1`. Se scriu **amândouă rândurile** (`.poza-1`/`.poza-2`),
    iar CSS-ul îl alege pe cel potrivit după `cu-calendar` — JS-ul nu umblă la `href`, deci nu
    clipește. Implicitul rutei a rămas `coloane=2`.
  - ⚠️ **E un `<details>`, deci merge fără JS**; JS-ul adaugă doar închiderea la Escape și la apăsare
    în afară. ⚠️ **Carcasa îmbracă orice `<details>` într-o cutie** — cele șase linii care o scot sunt
    în STIL, la `.btns .desc` (aceeași capcană ca la meniul crucii din Calendar).
  - ⚠️ **Când nu e nimic de apăsat, butonul se scrie STINS, fără meniu** (un `<span>`, nu un
    `<details>`): pagina Arhivei și adminul simplu pe o săptămână veche. Pricina stă în `title`.
    Rândurile PDF/JPG rămân scrise, dar pălite, când săptămâna n-are program validat.
  - Poza calendarului de la A1 a ieșit din antet, definitiv.

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

### Calendarul · lupa de căutare și pastila pe telefon (15.09.2026, seara)

Cerere scurtă a userului: „să avem o iconiță lupă de căutare înainte de cruce". Calendar **0.8.0**.

**Ce s-a făcut.** Pastila are acum **cinci segmente**: bulina „azi" · DATA · calendarul · **lupa** ·
crucea. Lupa e o **cheie**, ca aceea a lunilor: coboară o bară a ei sub antet, cu un câmp și un buton.

- **Formular GET adevărat** (`/cauta?q=…&an=…`), nu un câmp legat de JS: merge fără JavaScript, iar
  rezultatul are adresă — se poate da mai departe și pune la semne de carte, ca listele de sărbători.
- **Cele două bare de sub antet se exclud** (lunile și căutarea): două deschise deodată ar fi împins
  lista cu ~100 px, fără să spună nimic în plus. JS-ul o ridică pe cealaltă, `JS_NAV`.
- **Pagina rezultatelor** (`paginaCautare`): zilele scrise cu `randZi`, grupate pe luni, bara
  **deschisă** și întrebarea în câmp. Se caută în **titlul** zilei, cu `cauta` din `depozit.ts` —
  aceeași funcție ca la `/v1/cauta` și la unealta Asistentului —, fără diacritice, cel mult 100 de
  rânduri (când vine lista plină, pagina spune „primele 100 de zile", nu pretinde că atât s-a găsit).
- ⚠️ **SE CAUTĂ ÎNTR-UN SINGUR AN**, cel din adresă. Peste toți anii preluați, același sfânt ar ieși
  de câte ori se repetă, iar lista ar fi un șir de duplicate mutate cu o zi. Anul călătorește ascuns
  în formular, iar ruta îl **coboară la unul PRELUAT**: pe un an calculat (2027, 2028) `cauta` ar fi
  cotrobăit în tabelul `zile`, unde anul acela nu s-a scris niciodată, și ar fi întors **tăcut** o
  listă goală — omul ar fi crezut că sfântul nu e în calendar.
- ⚠️ **Lupa NU atârnă de rol**, spre deosebire de cruce (regula din 13.09.2026): crucea TAIE lista
  după însemnul zilei, căutarea doar o caută, iar cititul e la liber. Probe: `tests/cautare-calendar.test.ts`.
- Pragul de **3 litere** e al căutării întregi (e și la `/v1/cauta`). Sub el nu se caută și se scrie
  de ce, în pagină — nu e eroare.

**⚠️ POZA A GĂSIT DOUĂ REGULI MOARTE ÎN `stil.ts`, amândouă de dinainte de lupă** — vechi exact cât
regula „la orice schimbare de așezare în rândul de unelte, fă o poză". Amândouă din **aceeași
pricină**: un bloc `@media` scris în capul fișierului răstoarnă o regulă care vine **mai jos**, iar la
specificitate egală câștigă cea de jos. Deci `@media`-ul nu făcea nimic:

1. **Zona datei era GOALĂ pe telefon** (sub 400 px): media stingea forma lungă, iar regula de jos
   ținea forma scurtă stinsă. Adică tocmai lucrul cerut anume în dimineața aceea („pe mobil,
   neapărat să se vadă scrisul cu data") lipsea cu totul. Se vede în poza de la 390 px.
2. **Strâmtarea segmentelor la 42 px** nu se aplica: pe un telefon de 390 ieșeau tot de 46.

Amândouă au fost **mutate sub regulile pe care le răstoarnă**, cu avertisment scris lângă ele.

**Măsurat cu Browser Rendering** (`/content` + script injectat care scrie lățimile pe `body`), de la
320 la 1100 px:

- rândul **se rupea în două între 401 și 430 px** și **înainte** de lupă; al cincilea segment ar fi
  lățit banda la ~450. Leacul e vechea regulă a rândului: **`flex:1 1 0` pe pastilă, nu `1 1 auto`** —
  ruperea se hotărăște după măsura *ipotetică* a copiilor, înainte de orice strângere. Acum rândul e
  **pe o singură linie de la 320 la 1100 px**;
- pragul formei scurte a datei a urcat de la **400 la 460 px**: între 401 și 460 data lungă nu mai
  încape lângă cele patru chei și era tăiată de `overflow:hidden` (la 410: text de 176 px într-o
  cutie de 169). Telefoanele din bandă nu sunt rare — 412, 414, 430;
- sub 400 px se ia din toate câte puțin (chei 36 px, `gap` 6, marginile plicului 9, scrisul 12) ca
  „15 sep. 2026" să încapă **întreg de la 360 px în sus**. Sub 360 se taie data, nu se rupe rândul.
- ⚠️ **Crucea are DOUĂ măsuri de strâns**: lățimea o ține învelișul `<details>` (`.btns .filtre`), nu
  butonul dinăuntru. Fără el, crucea rămânea de 46 px când celelalte se strângeau.

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
`unelte` (lista canonică a ce vede modelul — pe program `modifica_slujba`, `adauga_slujba`,
`valideaza_saptamana`, `sterge_slujba` și, din 15.09.2026, `retrage_validarea`; „fără rapoarte,
enumerări, arhivă"), exemple cu argumente la
acțiuni (`{fraza, argumente}`), setul de probe `infrastructure/eval/chat.mjs`. **Dacă cineva lărgește
lista de unelte, să reruleze probele** — modelele mici cad exact la alegerea între unelte.

⚠️ **Lista din panou e un filtru, nu o listă de dorințe**: o unealtă nouă publicată de aplicație NU
ajunge la model până nu i se scrie numele acolo (goală = toate; `chat-worker/src/index.ts`, `permis`).
Așa a stat `program.retrage_validarea` **trei zile** (publicată 12.09.2026, scrisă în panou abia pe
15.09.2026, după ce omul a lovit lipsa în pagină: a validat din greșeală și chatul i-a răspuns că nu
poate retrage). ⚠️ **Semnul care trădează filtrul**: chatul spune „nu am cu ce" ori trimite omul la
administrator pentru o treabă pe care codul o ȘTIE face. Când auzi asta, uită-te întâi în listă, nu în cod.

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
- **`curatenie`** (A6): D1 `xc-curatenie-staging` (`0c60549b-…`), 677 de rânduri copiate din V1.
  Amănuntele, sus, la „Curățenia (A6)". Trei lucruri de știut înainte să umbli la ea:
  - ⚠️ **schema poartă numele din V1** (`volunteers`, `assignments`, `notifications_log`,
    `app_settings`, `newsletter_history`, `volunteer_vacations`), nu nume în românește ca restul
    aplicațiilor V2. Dinadins: interogările s-au portat cuvânt cu cuvânt, iar un rebotez ar fi cerut
    rescrierea fiecărui SELECT fără să câștige nimic;
  - ⚠️ **`is_admin` NU dă drept de administrare** — e eticheta echipei. Poarta panoului e
    `cleaning.manage`, de la autorizarea centrală;
  - **rapoartele se compun aici, dar pleacă prin comunicare**, iar `newsletter_history` rămâne arhiva
    a CE A SCRIS curățenia (ca `scrisori` la bibliotecă); arhiva livrărilor e a poștei.
  Import: `node infrastructure/import/curatenie-din-v1.mjs --scrie staging` (golește întâi tabelele,
  copil înainte de părinte — vezi capcana cu `INSERT OR REPLACE` de mai jos).
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

- **⚠️ `INSERT OR REPLACE` + cheie străină `ON DELETE RESTRICT` = a doua rulare a importului cade**
  (pățit la curățenie, 14.09.2026). REPLACE înseamnă „șterge rândul de dinainte și pune-l pe ăsta";
  ștergerea unui părinte care are deja copii (un voluntar cu programări) se lovește de RESTRICT și
  scriptul moare cu `FOREIGN KEY constraint failed`. Prima rulare merge, fiindcă tabela e goală —
  deci se vede abia la reluare. **Leacul**: importul golește întâi tabelele, **copil înainte de
  părinte**, și abia apoi scrie. La o copiere de date, reluabilitatea contează mai mult decât ce era
  acolo (oricum venea tot din V1).
- **⚠️ D1 primește cel mult 100 de valori legate într-o comandă.** `insereazaLoturi` socotește singură
  câte rânduri intră într-un lot (`100 / numărul de coloane`); dacă scrii `lot:` de mână și treci de
  prag, cade cu `too many SQL variables`. Scrie `lot:` doar ca să faci loturile MAI MICI (rânduri
  grele, ca scrisorile de zeci de KB), niciodată mai mari.
- **⚠️ Backtick într-un comentariu dintr-un template literal: `tsc` poate să-l ratedeze, esbuild NU**
  (14.09.2026). Regula de mai jos (fără backtick în comentariile de stil) e aceeași, dar acolo o
  prindea `tsc`; într-un JS de pagină lipit cu `String.raw`, `tsc` a trecut curat și build-ul de la
  `wrangler deploy` a picat cu „Expected ";" but found …". **Deci: `tsc` curat NU garantează că se
  publică** — la prima publicare a unei aplicații noi, rulează și un deploy, nu doar typecheck-ul.
- **⚠️ O aplicație cu o rută care poartă CHIAR NUMELE ei își taie singură calea** (pățit la buletin,
  13.09.2026, reclamat de user: „nu merg linkurile de sub ultimul număr"). `prefixSiCale(url, '/x')`
  nu poate deosebi prefixul de montaj al gateway-ului de preview de o rută adevărată `/x/…`: pe
  subdomeniu, `buletin.staging…/buletin/615-2026-09-06` ajungea în worker ca `/615-2026-09-06`, nu se
  potrivea nicio rută și pagina numărului da **404**. Restul linkurilor (PDF, arhivă, căutare) mergeau
  — de aceea se vede greu. **Leacul**: montajul se ia din MEDIU, nu din cale —
  `prefixSiCale(url, env.MEDIU === 'dev' ? '/buletin' : '')`; prin gateway (numai în dev) aplicația
  chiar stă sub `/buletin`, în staging și producție stă la rădăcină. Probe în
  `tests/buletin-newsletter.test.ts`. Verificat: **buletinul e singura** aplicație cu ciocnirea asta.
  ⚠️ Se repetă la orice aplicație viitoare a cărei rută V1 începe cu numele ei.
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
  ⚠️ **Și în comentariile din JS-ul paginilor**, nu doar în CSS (13.09.2026): `JS_PAGINI` e tot un
  template literal, deci un `` `loadFromImages` `` într-un `//` îl taie la fel.
- **⚠️ Un modul de browser se probează ÎN browser, nu din citit** (13.09.2026, la răsfoit): trei
  împiedicări una după alta — un API schimbat, un build prea modern, o randare încețoșată — s-au
  lămurit în câteva minute cu Browser Rendering `/content` + un script care scrie ce iese într-un
  `<div id="proba">`, citit apoi din HTML-ul întors. Mult mai iute decât deploy-poză-ghicit, și
  singurul fel de a vedea **cifre** (dimensiuni măsurate), nu impresii de pe un JPEG.
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

### 2026-09-16

- **TEXTE CITITE LA CHINONIC — secțiune nouă pe Website** (user, în noapte). Website **0.4.0**, publicat.
  Un număr de buletin are trei părți: programul liturgic (din A2), buletinul parohiei (din A3) și
  **textele citite la strană**. Primele două trăiesc în aplicațiile lor; al treilea nu era salvat
  nicăieri. Acum e.
  - **448 de texte, din 318 numere**, scoase din arhiva newsletterului. Pe număr: 215 cu unul, 81 cu
    două, 17 cu trei, 5 cu patru — de aceea asocierea e pe listă, nu unu-la-unu.
  - ⚠️ **CUM SE RECUNOAȘTE UN ARTICOL**: nu după un titlu de secțiune (nu există în HTML), ci după
    rândul de la sfârșit, „**Sursă:**". Se merge ÎNAPOI de la el până la un hotar: „Sursă"-a
    dinainte, poza buletinului, titlul „Programul Liturgic", un bloc cu semnul „⁞" (ora slujbei),
    poza din subsol, ori o etichetă („S-a citit la strană:", „Descărcare PDF", „2% din impozit").
    Mersul înainte, dintr-o „zonă", nu merge: la vreo sută de numere lipsește hotarul de sus.
  - ⚠️ **SURSA ARE DOUĂ PĂRȚI CARE COEXISTĂ** (cerut anume): mențiunea scrisă („Fișier PDF", o carte
    întreagă cu editură și pagini) ȘI legătura — care de multe ori **nu e în rândul „Sursă", ci pe
    POZA articolului**, și e adesea un **PDF al parohiei**. Măsurat: **131 PDF · 307 pagină web · 10
    fără link**. ⚠️ Prima socoteală dădea **zero PDF**, fiindcă regexul cerea `https://` iar
    adresele lor sunt relative (`/media/…`) — se vedea în cifre, nu în cod.
  - **ARHITECTURA, cum a cerut-o userul**: articolul e al **Website-ului** (baza nouă
    `xc-home-production`, tabelul `texte_chinonic` — prima bază a lui `home`, care până azi n-avea
    niciun depozit), iar **asocierea număr ↔ articol e a Newsletterului**
    (`chinonic/asocieri.json` în R2). Fiecare ține ce e al lui.
  - **Pe ușa Website-ului: cele mai noi 10 + „Vezi toate"**; pagina `/texte-citite-la-chinonic` le
    dă pe toate, pe ani; fiecare text are fișa lui la `/texte-citite-la-chinonic/<slug>`.
  - **ADUCEREA TEXTULUI ÎNTREG** (`adu-textul.mjs`): PDF și HTML trec amândouă prin unealta de
    conversie a Cloudflare (`ai/tomarkdown`), apoi printr-o curățare de meniuri.
    ⚠️⚠️ **NU SE INSEREAZĂ HTML STRĂIN ÎN PAGINILE NOASTRE**: tot ce vine de pe alt site se trece
    prin TEXT CURAT și se reîmbracă de noi în paragrafe — așa nu poate intra niciun `<script>` și
    nicio urmă de numărătoare.
    ⚠️ **CRITERIUL DE VERIFICARE, dat de user**: textul adus trebuie să **înceapă la fel ca
    fragmentul din buletin**. E și reper de tăiere, și probă: unde nu se potrivește, rândul rămâne
    `nesigur` și pagina arată mai departe fragmentul — nu pretindem un text întreg pe care nu-l avem.
    ⚠️ **Capcana care a ținut proba stricată**: fragmentul păstrat în bază e HTML de email, cu
    `&icirc;` în el; normalizat de-a dreptul, „s-a născut în 1821" ajungea „s a nascut icirc n 1821".
    Se potrivea 1 din 9. Cu entitățile decodate: **8 din 9**.
  - **STARE, la ora scrierii**: aducerea rulează în fundal (`/data/chinonic-adus.log`), ~80 din 438
    făcute, cam 40% cu text verificat, 30% „nesigure", 30% erori (linkuri moarte, 404 la PDF-uri care
    lipsesc din depozit). Reluabilă oricând: `--reia` ia și căzuturile, `--refa` ia tot.
  - ✅ **REPARAT ÎN ACEEAȘI NOAPTE (01:15): titlurile — 445 din 448** (erau 399). Două capcane în
    `titluDin`: un `<strong></strong>` GOL în capul lui `<h1>` (regexul se oprea la el și lua drept
    titlu nimicul), și etichetele de așezare dinaintea titlului la celulele încuibate. Importul cu
    `--curata` a scos **114 sluguri vechi** (adresele nu fuseseră date nimănui). Au rămas 3 fără titlu.
  - ✅ **FIȘA E TEXT CURAT, NU HTML DE EMAIL** (user, 01:09: „nu se afișează bine ca și cum copiezi
    HTML-ul… să ai texte brute pe care le poți afișa atât pe tema dark, cât și pe tema light").
    Fragmentul din MailPoet avea `color:#000000` și tabele inline — pe tema întunecată nu se vedea.
    Acum `fragment` = paragrafe de text (`paragrafeCurate` în `extrage.mjs`), îmbrăcate de noi în
    `<p>`, deci iau culorile temei. **Ordinea în fișă: titlu, autor sub el, apoi textul.**
  - ✅ **PRIMA ADUCERE COMPLETĂ (02:04)**: 162 gata · 200 nesigure · 46 fără text · 30 erori · 10 fără
    link. Prea multe „nesigure" — diagnosticat pe date, nu pe presupuneri, și găsite **patru cauze,
    toate ale mele**, reparate în `adu-textul.mjs` (02:10–02:35):
    (1) **blocul de metadate al PDF-ului** nu era tăiat decât în scriptul de probă — 69 din 70 de
    PDF-uri „nesigure" începeau cu „xmpmm documentid uuid…"; (2) **fereastra de potrivire se căuta
    în rândurile brute din markdown** (cu etichete HTML și adrese), nu în textul curățat care se
    stochează — 35 din 60 „nesigure" aveau fragmentul CHIAR în text; acum ce se caută = ce se
    păstrează (`curataLinia`, o singură funcție); (3) **entități dublu-codate** (`&amp;atilde;`,
    `&amp;shy;`) în 45 de fragmente — se decodează de două ori, și în `extrage.mjs`; (4)
    **cuvantul-ortodox.ro** (cea mai mare sursă, 103 texte) are lanțul de certificat incomplet —
    la cădere de TLS se reîncearcă pe `http://`, fără a opri verificarea certificatelor.
    **Criteriu de rezervă, nou**: la ~25 de texte buletinul avea doar poză + link + NUMELE AUTORULUI,
    deci fragmentul e un nume de om și nu probează nimic; atunci se cere ca **adresa sursei să poarte
    titlul** (≥ 60 % din cuvintele lungi ale titlului în cale). Rezultat pe primele 57 reluate:
    **30 ✓** (12 prin fragment, 18 prin adresă) față de **0 din 71** înainte.
    **STAREA FINALĂ (03:25, după șase treceri)**: **258 gata** (220 pagini + 38 PDF) · **86 nesigure**
    (53 + 33) · **77 fără text** (21 pagini goale + 56 PDF scanate/ilizibile) · 17 erori (gazde moarte,
    404) · 10 fără link. Pornise de la 162 gata / 200 nesigure.
    Ce s-a mai adăugat la treceriile 4–6: **hotare de sfârșit** noi („Pentru a adăuga un comentariu",
    liste de etichete după formă — ≥ 6 virgule, bucăți scurte, fără punct; firimituri), care lucrează
    NUMAI după ce s-a strâns un rând de text (unele site-uri scriu „Comentarii (0)" deasupra
    articolului și tăiau totul); **proba de lizibilitate** — un PDF scanat prost trecea ca „gata"
    fiindcă numele fișierului purta titlul; se măsoară câte bucăți sunt cuvinte (cifrele se numără
    cuvinte) și câte semne străine sunt. ⚠️ **Numai pentru PDF**: pe pagini web dădea fals „ilizibil"
    la textele cu multe date și citate (19 pagini, măsurat).
    ⚠️ **Reziduul e greu, nu ieftin**: ultima trecere a mai câștigat 2. Cele 33 de PDF-uri „nesigure"
    sunt fișierele NOASTRE (nu poate fi altă pagină), dar unele țin mai multe predici într-un
    fișier, deci fără potrivirea fragmentului nu se știe unde se taie; iar glifele stricate din
    extracție (ț → „ i") fac potrivirea imposibilă. **De hotărât cu userul**: se acceptă PDF-ul
    întreg acolo unde e o singură predică? Cele 53 de pagini „nesigure" sunt, la verificare pe
    eșantion, texte diferite de ce s-a citit (alt articol despre același sfânt, sinaxar) — corect
    lăsate ca fragment.
    ⚠️ **3 perechi din același număr au același titlu** (13.07.2020 Sofronie/Paisie, 07.04.2020,
    02.04.2025): buletinul avea un titlu de secțiune peste două texte, iar al doilea l-a moștenit.
    Textul adus e cel bun (proba a ținut), titlul nu — de îndreptat de mână, 3 rânduri.
    ⚠️ Erorile rămase sunt reale: gazde dispărute (comuniune.ro, renasterea.net, tripod) și 404.
    ⚠️ `--reia` = tot ce nu e „gata" (netras, eroare, nesigur, fără text); `--refa` = tot.
  - ✅ **NORMALIZARE** (user, 01:13: „referințele păstrează-le, dar imaginile șterge-le și adresele
    și tot"): `normalizeaza()` scoate `http…`/`www.…` și parantezele rămase goale; pozele pleacă cu
    etichetele. Referințele („(Psalmul 18)", cărțile) sunt cuvinte și rămân. Aceeași curățare și la
    textul adus de la sursă. ⚠️ Cu fragmentul curat, proba „începe ca fragmentul" potrivește mult
    mai bine (22 ✓ / 3 ? din primele 44, față de ~40 % înainte).
  - **Deschis, spus de user**: „e posibil ca, în final, să nu afișăm link-ul către alt site, ci doar
    să reținem denumirea site-ului". Azi legătura se scrie DOAR unde textul întreg lipsește; când
    va fi adus peste tot, rămâne numai numele. ⚠️ Tot el a hotărât, întrebat anume, preluarea
    textelor întregi — i-am spus că republicarea integrală a articolelor altor site-uri e o
    chestiune de drepturi de autor; a ales știind.
  - ✅ **TITLURI CIUNTITE, AUTORI LIPSĂ, COZI DE SITE — runda de îndreptare (03:50–05:00).** Userul a
    arătat două fișe și amândouă au dus la aceeași rădăcină.
    **(1) TITLUL RUPT PE RÂNDURI.** „Predică la duminica a VI-a după Paști –" avea drept autor
    „Despre vindecarea minunată a orbului din naștere · Sfântul Nicolae Velimirovici". `titluDin` lua
    primul rând drept titlu și TOT restul drept autor, lipit cu „·". În buletin titlul e rupt de
    **lățimea coloanei, nu de înțeles**. Regula nouă (`import/chinonic/titlu-autor.mjs`): se caută
    primul rând care e un NUME de om și care nu e urmarea celui dinainte; de acolo în jos e autorul,
    deasupra e titlul. Rândurile titlului se lipesc cu spațiu, cu linie doar între două propoziții.
    **(2) AUTORUL DIN CAPUL TEXTULUI.** La ~100 de articole numele nu e îngroșat, deci nu intra în
    „cap": ajungea primul paragraf al fragmentului. Acum trece la `autor` și **iese din text**.
    ⚠️ Nu se scoate când ce rămâne e sub 200 de semne (la ~25 de texte numele CHIAR e tot fragmentul).
    **Rezultat: 144 → 239 de articole cu autor.**
    **(3) COADA DE „ARTICOLE RECOMANDATE".** User: „Aici trebuia să se oprească: din: Preot Varnava
    Iankos… Ce e sub trebuie șters". Recomandările WordPress sunt **îngroșate**, deci rândul începe
    `* **[`, iar tiparul vechi cerea `* [` — treceau toate, și sunt rânduri lungi, de proză nu se
    deosebesc prin lungime (18 rânduri deasupra textului, 24 sub el, la un singur articol). Hotar nou
    de sfârșit: **mențiunea sursei („din: …") se păstrează și sub ea se taie**.
    ⚠️ **Tot ele explicau și „nesigurele"**: `semneleInceputului` tăia fragmentul în propoziții DUPĂ
    `plat()`, care scoate toată punctuația — deci nu găsea niciun punct și întorcea mereu **un singur
    semn**. Rezerva gândită acolo („e destul ca UNA să se potrivească") **n-a lucrat niciodată**.
    Cu ea reparată + numele scos din capul fragmentului: **258 → 295 gata, 86 → 52 nesigure.**
    ⚠️ **`sql()` nu prindea căderile de rețea** (`fetch` aruncă, nu întoarce răspuns): o rulare peste
    toată arhiva a murit la 119 din 438. Acum reîncearcă și la excepție, iar scrierea în bază e și ea
    în `try` — o rulare de douăzeci de minute nu are voie să cadă de la o pană de o secundă.
    ⚠️⚠️ **LACĂTUL ADRESELOR — `import/chinonic/sluguri.json`.** Slugul se naște din titlu, iar fișele
    erau deja publicate: orice îndreptare de titlu le-ar fi mutat la altă adresă. Lacătul leagă adresa
    de **`<newsletterId>#<k>`** (numărul buletinului + locul articolului în el), singura identitate
    care nu atârnă de titlu. **448/448 adrese păstrate.** De aceea regula veche „nu mai rula
    `--curata`" a expirat: importul se poate relua oricând, fără să omoare o adresă.
    ⚠️ **O eroare adevărată prinsă de probe**: hotarul `\b` de la capătul titlurilor de cinste **nu se
    potrivește niciodată după punct** (între „." și " " nu e hotar de cuvânt), deci „Sf.", „Pr.",
    „Arhim.", „Protos." cădeau toate — și ele sunt jumătate din numele arhivei. Probe:
    `tests/chinonic-titlu-autor.test.ts`, 15 cazuri luate din arhivă.
    ✅ **„Fără autor" se scrie întotdeauna** (user: „dacă nu au autor scriem «Fără autor»"), stins și
    înclinat, ca să nu se citească drept nume. Website **0.4.2**, publicat.
  - ✅ **TITLURILE CARE LIPSEAU DIN BULETIN, LUATE DE LA SURSĂ** (user, 16.09.2026, 12:28: „ia-le de
    acolo și să închidem subiectul"). La 64 de articole buletinul scrisese NUMELE AUTORULUI în locul
    titlului. Unealta: `titluri-din-sursa.mjs` — aduce pagina, o trece prin `tomarkdown`, strânge
    capetele (`#`…`###`) și rândul `title:`, și alege **acela care seamănă cel mai bine cu ADRESA**.
    ⚠️ **Adresa spune CARE e titlul, pagina spune CUM SE SCRIE**: adresa poartă cuvintele articolului
    dar fără diacritice și fără punctuație, iar capul paginii le are pe amândouă — însă pe lângă titlu
    mai are și meniuri și titluri de alte articole. Potrivirea cu adresa e singurul ales pe care nu-l
    facem noi. Găsite 59 din 64; alese cu ochiul, fiindcă unele site-uri scriu cu majuscule, își pun
    numele în coadă și repetă numele autorului în titlu.
    **Rezultat: 54 de îndreptări** — 52 de titluri luate de la sursă + **2 titluri moștenite greșit**
    (07.04.2020 → era predica Sf. Teofan Zăvorâtul la Duminica a cincea din Post; 13.07.2020 → era
    despre Părintele Paisie Aghioritul). Al treilea (02.04.2025) s-a îndreptat odată cu celelalte.
    **Cu autor: 144 → 291.**
    ⚠️ **10 din cele 64 NU s-au atins**: sunt sinaxare, unde titlul CHIAR e numele sfântului
    („Sfântul slăvitul Marele Mucenic Dimitrie") și autor nu există. **2 n-au titlu nicăieri**
    (`sfantul-simeon-noul-teolog`, `sfantul-ioan-gura-de-aur-nr523` — sursa nu mai dă nimic).
    ⚠️⚠️ **ÎNDREPTĂRILE STAU ÎN `indreptari.json`, NU ÎN BAZĂ.** Extragerea citește tot de la capăt
    din arhivă, iar arhiva a rămas cum e — deci fără fișierul ăsta următoarea rulare ar pune la loc
    numele drept titlu. Se pun PESTE ce a scos extragerea, la fiecare rulare, pe cheia `slug` (care e
    înghețată de lacăt). Aceeași regulă ca la bibliotecă: **unealta propune, omul hotărăște, iar
    hotărârea stă într-un fișier care călătorește cu git.**

- **NEWSLETTERUL, RUNDA A DOUA** (user, în noapte). Newsletter **0.6.0**, publicat pe producție în
  patru pași (0.4.0 → 0.6.0). ⚠️ **Din 16.09.2026 se publică DUPĂ FIECARE BUCATĂ**, cerut anume:
  „de fapt de fiecare dată urcă online ce lucrăm".

- **ZONA FIXĂ DIN SUBSOL — ce se vedea altfel decât în e-mail** (user: „imaginea mare nu este sută la
  sută, iar textele care urmează nu sunt centrate"). **O singură regulă era de vină**, și explica
  amândouă reclamațiile: `.email table { width:auto }` din `stil.ts`.
  - `width="100%"` de pe tabelele MailPoet e un **atribut de prezentare**, adică o regulă cu
    specificitate zero — selectorul `.email table` o bătea, iar tabelele se strângeau la lățimea
    conținutului. La paragrafele lungi nu se vedea (umplu rândul oricum); la cele **scurte**,
    `text-align:center` centra textul într-o cutie îngustă, lipită la stânga — deci pe ecran părea
    nealiniat, deși alinierea era pusă. Leacul: `.email table[width="100%"] { width:100% }`.
  - Poza mare: MailPoet închide tot newsletterul într-un `mailpoet_content-wrapper` cu
    **max-width:660px scris INLINE** (măsura ferestrei de inbox). Chenarul nostru are 680, deci
    rămânea o dungă albă. Ridicat cu `!important` (inline nu se bate altfel) + `img[width="660"]`
    trece pe `width:100%`. ⚠️ Se cere anume 660: pozele mici trebuie să rămână la măsura lor.
  - „Eu recomand o stare de veselie…" a rămas **justify**, cum s-a cerut.
  - ⚠️ **Lecție de măsurare**: tăierea scrisului NU se vede pe `.acum`/pe celulă — `text-overflow`
    taie elementul `b` dinăuntru fără ca părintele să crească. Se măsoară `scrollWidth` vs
    `clientWidth` pe **elementul vizibil**.
- **TITLUL DE PE PRIMA PAGINĂ**: „Buletinul Online nr. 571 / 15 septembrie 2026" — cade cuvântul
  „Parohiei", scrisul e mai mic, iar pe telefon luna se prescurtează („15 sept."). Intră pe **un
  rând** de la 320 px în sus (măsurat). ⚠️ Subiectul din `lista.json` **nu se atinge**: acolo e
  arhiva, nu afișajul; se curăță doar la scris.
- **ARHIVA: „ALTELE"** (user: „un nou buton numit «Altele»… să rămână listate în ARHIVĂ doar
  numerele"). Despărțirea se face după `nr` — **405 numerotate, 55 fără număr** (actualizări de
  program și anunțuri), la `/arhiva/altele`, pe ani.
  ⚠️ **Butonul stă ÎN AFARA fâșiei**, lipit de capătul barei: înăuntru era la locul lui logic (după
  2017), dar fâșia se derulează și cei zece ani o umplu — pe 1100 px cădea dincolo de margine și nu
  se vedea deloc. Un buton cerut anume n-are voie să fie ascuns.
- **ȘABLONUL — antetul și subsolul, în Setări** (user: „două bucăți de HTML… pe care să mai putem
  interveni pe viitor"). Luate din **ultimul newsletter**, nu scrise de mână:
  `sablon/antet.html` (crucea + titlul, 975 o.) și `sablon/subsol.html` (poza părintelui Arsenie,
  cuvântul, citatul, WhatsApp, adresa, 5196 o.). Unealta:
  `infrastructure/import/newsletter-live/sablon-din-numar.mjs`.
  ⚠️ **ȘABLONUL NU E ARHIVA**: fiecare număr trimis își păstrează forma lui în `stiri/<id>.html` —
  o fotografie a clipei. Bucățile se **inserează** la buletinul următor; o schimbare în ele nu
  rescrie niciun număr vechi. Regula e scrisă în capul lui `sablon.ts` — nu o încălca.
  ⚠️ `@xc/setari` a căpătat un **punct de prindere**: `rubrici({eAdmin, eSuper})`, rubrici ale
  aplicației, așezate după cele comune. Aplicațiile care nu-l dau au pagina **neschimbată** (probă).
- **AUDITUL NUMERELOR**, cerut de user. Din 405 numerotate (174 → 571):
  - **11 numere dublate**: 202, 203, 204, 205 (retrimise cu aceleași numere o lună mai târziu, în
    vara lui 2018), 326, 393, 466, 511, 535, 541, 546. Cazul 326: al doilea poartă în subiect chiar
    data primului („15 decembrie 2020"), deși a plecat pe 22 — subiect copiat, nu corectat.
    Cazul 546: **trimis de două ori în aceeași zi** (5 feb. 2026, 13:18 și 21:23), al doilea mai mare
    cu 700 de octeți — pare o retrimitere corectată.
  - **4 numere sărite**: 359 (între 4 și 9 aug. 2021) și 481–483 (între 13 și 20 mai 2024). ⚠️ În
    amândouă cazurile ritmul săptămânal e **neîntrerupt**, deci numerele au fost sărite la numărătoare
    — nu lipsesc numere din arhivă.
  - ⚠️ **Nu se îndreaptă de la noi** (regula buletinului): arhiva e mărturia a ce a plecat.
- ✅ **CHINONIC — FIȘA ÎN FORMA CERUTĂ + LISTELE DE INVESTIGAT** (user, la prânz). Website **0.5.0**,
  publicat pe producție. Trei cereri într-un șir, toate făcute.
  **(1) LISTELE SEPARATE, „ca să le pot investiga".** Unealtă nouă: `import/chinonic/stari.mjs` —
  fără argumente dă socoteala, cu `--lista=<categorie>` scrie lista în Markdown (se redirectează
  într-un fișier; cele șapte sunt în `outputs/chinonic-*.md`). Categoriile se exclud, în ordinea
  `fara-link · eroare · fara-text · nesigur · gata · netras`, plus două tăieturi de-a curmezișul:
  `fara-autor` și `link-mort`. ⚠️ `fara-link` se socotește ÎNAINTE de stare: fără adresă rândul a
  rămas „netras", dar pricina lui nu e etapa, e lipsa sursei. Cifre: **295 gata · 75 fără text ·
  52 nesigure · 16 erori · 10 fără link · 94 fără autor · 16 cu adresa moartă**.
  **(2) LEGĂTURA SE PUNE NUMAI DACĂ ADRESA TRĂIEȘTE** (user: „dacă e 404 acel url să nu se pună —
  așa știu că nu mai era valabil linkul"). Unealtă nouă: `verifica-linkurile.mjs`, care întreabă
  fiecare adresă și scrie în bază `link_stare` / `link_cod` / `link_verificat_la` (coloane noi).
  Din 438: **408 vii · 12 moarte (404/410) · 18 picate**.
  ⚠️⚠️ **„N-a răspuns" NU înseamnă „nu mai există"** — lecția rundei. Din cele 18 picate, **14 erau
  vii**: `cuvantul-ortodox.ro` are lanțul de certificate rupt, `ortodoxism.ro` cade la strângerea de
  mână TLS, altele merg numai pe `http`. De aceea scriptul are **a doua șansă** (`node:https`, fără
  cerere de certificat curat, apoi `http`) — fără ea am fi tăiat 14 legături bune. Rămân **16**
  adrese care nu se mai scriu în pagină; la două dintre ele (`comuniune.ro`) a murit chiar și DNS-ul.
  **(3) FORMA FIȘEI, cele cinci lucruri în aceeași ordine**: titlu · autor · **text scurt** (400 de
  semne, tăiate la cuvânt, din textul întreg dacă îl avem, altfel din fragment) · **„Citește tot"** ·
  **Sursa: [carte] · site**. ⚠️ **„Citește tot" E MARCAJUL textului întreg** (cerut anume: „să faci un
  marcaj unde e textul complet"): îl are numai unde aducerea a trecut proba; unde nu, scrie „Doar
  bucata citită la strană". ⚠️ **Desfășurarea merge și fără JS**: „Citește tot" e o legătură adevărată
  spre fișă, iar scriptul o prinde din zbor și aduce corpul de la aceeași adresă cu `?bucata=text`
  (numai corpul, fără carcasă) — 448 de texte întregi n-au ce căuta deodată în pagina cu toate.
  **(4) AUTORUL „SINAXAR"** (user: „autor (Sinaxar sau fără autor ca excepție)"). Regula e în
  `titlu-autor.mjs` (`eSinaxar`, sub probe): titlu care începe cu „Viața / Sinaxar / Pomenirea /
  Icoana / Moaștele / Sfântul…" ȘI nu e un fel scris de cineva („Cuvânt", „Predică", „Tâlcuire",
  „Despre"). **63 de articole** au primit „Sinaxar"; **94 rămân „Fără autor"** — acolo autorul chiar
  e de căutat la sursă. ⚠️ Se pune LA URMĂ, după `indreptari.json`: hotărârea omului bate ghiceala.
  Aplicată peste baza vie cu `autor-sinaxar.mjs`, ca să nu fie nevoie de o extragere întreagă.
  **Probe**: `tests/chinonic-fisa.test.ts` (13, noi) + 3 în `chinonic-titlu-autor.test.ts`.
- ✅ **CHINONIC — LISTA MARE UȘURATĂ + PAGINĂ DEDICATĂ DE STARE** (user, 13:25: „nu mă ajută afișarea
  asta — vreau totul într-o pagină dedicată; lista mare nu o mai fișa complet că se îngreunează
  browser-ul"). Website **0.6.2**, Newsletter **0.6.1**, amândouă publicate.
  ⚠️ **LISTA MARE NU MAI CARĂ TEXTELE.** Trăgea din bază toate cele 448 de fișe ÎNTREGI (`fragment` +
  `text_intreg`, vreo 3 MB) ca să scrie din ele niște titluri; pagina publicată a scăzut de la ~3 MB
  la **211 KB**. Interogare nouă, `rezumate()`: metadate + `LENGTH(fragment)` / `LENGTH(text_intreg)`,
  niciodată conținutul. **Un rând = titlu · autor · două bife** („✓ text", „✓ sursă"), cu pricina în
  `title`. Textul se citește în fișa lui. Fișa bogată (text scurt + „Citește tot") a rămas numai pe
  **ușa Website-ului**, unde sunt zece.
  **PAGINA DE STARE: `/texte-citite-la-chinonic/stare`** — pagină de LUCRU (`private, no-store`,
  neindexabilă), cu cuprins și șase categorii care se pot suprapune: **fără textul întreg 153 · fără
  autor 94 · fără sursă 0 · cu adresa moartă 16 · fără titlu 3 · cu bucată prea scurtă ca să poată fi
  verificat 39**. Fiecare rând: titlu (intră în fișă) · autor · **pricina scrisă** · **numărul de
  buletin, cu legătură spre el**. ⚠️ Ruta se încearcă ÎNAINTEA fișei, altfel „stare" ar fi căutat ca slug.
  ⚠️⚠️ **NUMĂRUL SE CERE DE LA NEWSLETTER, NU SE COPIAZĂ.** Asocierea articol ↔ număr e a lui
  (hotărârea de dimineață), deci `apps/newsletter` a căpătat **`GET /v1/chinonic/asocieri`** (citește
  `chinonic/asocieri.json` din R2), iar `home` un **Service Binding `NEWSLETTER`** în toate cele trei
  medii. Dacă vecinul tace, pagina se scrie mai departe, doar fără numere — o pagină de lucru n-are
  voie să cadă fiindcă altcineva n-a răspuns.
  **Cifra care s-a schimbat**: „fișele aproape goale" nu sunt 33, ci **75 cu fragment sub 40 de semne**
  — dintre ele **36 sunt deja gata**, **33 au textul adus în bază dar stau „nesigur"** (n-a existat cu
  ce fi verificat; ele sunt câștigul de luat) și 6 n-au niciun text.
  **Probe**: încă 7 în `tests/chinonic-fisa.test.ts` (20 cu totul); 373 trec.

- ✅ **CHINONIC — FILTRE PE AMÂNDOUĂ PAGINILE + REPARAREA ASOCIERILOR** (user, 14:52 și 14:55).
  Website **0.6.3**, publicat. Cerut: „filtrare pe ani" la lista mare, „la fel" la pagina de stare —
  „adică totul ascuns în afară de ce e selectat; la intrare prima opțiune selectată".
  **Lista mare**: bara anilor (`?an=`), zece ani, **prima opțiune = cel mai nou**, fără „toate" (asta
  era tocmai lista grea). 2026 se deschide în **33 KB**, față de 211 KB cât avea întreaga.
  **Pagina de stare**: **cuprinsul a devenit filtrul** (`?ce=`) — o singură categorie o dată, prima
  („Fără textul întreg") la intrare, celelalte rămân butoane cu numărul lor — plus o **bară a anilor
  înăuntrul categoriei**, unde prima opțiune E **„Toți anii"**: pe o pagină de investigat, a ascunde
  din pornire tot afară de anul curent ar ascunde tocmai ce e de cercetat.
  ⚠️ Filtrul e o **navigare**, nu o ascundere din JS: merge fără script, fiecare alegere are adresa ei
  și **serverul trimite numai rândurile alese** — pagina chiar se ușurează, nu doar pare mai scurtă.
  Bara e cea de la Program și Newsletter (`bara-ani` / `an-buton`), fără săgeți.
  ⚠️⚠️ **BUG GĂSIT PRIN PLÂNGEREA LUI** („textele care nu au sursă nu știu din ce număr sunt"):
  `chinonic/asocieri.json` din R2 rămăsese pe **sluguri vechi** (`text-232-1`), scrise înainte ca
  titlurile să fie îndreptate — **114 din 448** de texte apăreau cu „număr necunoscut", deși toate 448
  își au numărul. Fișierul se scrie **pe slug**, deci orice rundă care schimbă sluguri îl lasă în urmă,
  **în tăcere**. Reparat rulând `asocieri.mjs --chiar` (318 numere); verificat în ambele sensuri: 0
  sluguri nepereche. **De rulat după orice import care atinge slugurile.**
  **Ce a cerut odată cu bug-ul**: textele nelegate de un număr **ies din toate categoriile** și stau
  separat, în „Fără număr de buletin" — „vreau să mă uit doar pe texte care fac parte dintr-un anumit
  buletin online publicat și transmis". Paza: dacă Newsletterul tace, nu se mută nimic acolo
  (necunoașterea noastră nu e lipsa lor).
  **Cât e bun, întrebat de el**: **245 din 448 sunt complete** — titlu + autor + text întreg —, și
  **toate 245 au și legătura spre sursă vie**. 448 cu sursă scrisă, 445 cu titlu, 354 cu autor (64
  „Sinaxar"), 295 cu text întreg, 448 cu numărul știut.
  **Probe**: încă 7 în `tests/chinonic-fisa.test.ts` (27 cu totul); **380 trec**.

- ✅ **CHINONIC — VIEȚILE DE SFINȚI, REGULA LOR** (user, 15:06: „viețile de sfinți — să le validezi,
  lasă doar Sinaxar la sursă și atât — mută-le la valide"). Website **0.6.4**, publicat.
  Trei urmări, toate **reguli în cod** (nu îndreptări în bază — altfel se pierd la reimport):
  la „Sursa" scrie **doar «Sinaxar»** (fără carte, fără site, fără legătură — dar `sursa_url` rămâne
  în bază, de acolo se aduce textul); **adresa moartă nu mai e problema lor** (categoria a scăzut
  16 → 12); **textul adus se validează** chiar dacă nu începe ca fragmentul, fiindcă o viață de sfânt
  e aceeași povestire repovestită de fiecare sinaxar. ⚠️ **La textele CUIVA proba rămâne** — acolo o
  nepotrivire chiar înseamnă alt text.
  Cifre: 3 vieți „nesigure" → `gata` (fragmentele lor aveau 28, 17 și 0 semne, deci proba n-a avut
  niciodată cu ce lucra), **38 din 64 de sinaxare gata**, complete **245 → 248**.
  ⚠️ **26 de vieți rămân fără niciun text**: 9 fără adresă în buletin, 13 cu pagină/PDF care n-au dat
  text, 4 cu adresa moartă. De întrebat dacă le căutăm textul într-un sinaxar oarecare, după numele
  sfântului — hotărârea de azi deschide drumul, fiindcă sursa nu mai contează.
  **Probe**: încă 4 în `tests/chinonic-fisa.test.ts` (31 cu totul); **384 trec**.

### 2026-09-15

- **NEWSLETTERUL (A8): MENIUL REFĂCUT, ABONARE VIE, ARHIVA LA ZI** (user, seara). Newsletter **0.3.0**,
  publicat pe producție în două rânduri (0.2.0 meniul, 0.3.0 bara anilor + scrisul).
  - **Antetul e acum ca la Calendar și Program**: o **pastilă** cât tot rândul — bulina numărului
    curent · zona de scris · săgeata · Arhiva · lupa —, iar singură afară la dreapta **Abonarea**.
    A căzut toată așezarea din V1 (două săgeți cu bulina între ele, bară despărțitoare, două butoane
    mici). Lupa nu mai e link spre `/cauta`, e **cheie** care coboară o bară, ca la Calendar.
  - ⚠️ **SĂGEATA E O FAPTĂ, NU O NAVIGARE** (lămurit cu userul, întrebat anume): duce la `/nou`,
    ecranul de **adăugare manuală** a unui buletin („actualizare program sau altceva"). E numai a
    adminilor, ca Arhiva Programului. **Ecranul nu compune încă nimic** — s-a hotărât pentru runda
    următoare; pagina există ca săgeata să nu cadă în 404 și spune pe față unde s-a ajuns.
    ⚠️ Poarta e **rolul** (`ctx.eAdmin`), nu o cheie nouă de permisiune: una nouă ar fi cerut și
    republicarea lui `xc-authz`. Când ecranul va scrie în depozit, aici se pune cheia.
  - ⚠️ **„◀ numărul dinainte" a ieșit din rând**, ales de user: înapoi se merge prin Arhivă, ca la
    Program. Răsfoitul din aproape în aproape spre numerele vechi cere acum două apăsări.
  - **Scrisul din pastilă, cerut anume**: „Buletinul nr. 571" pe numărul curent (nu generic
    „Nr. curent"), „Buletin nou", „Arhiva", „Căutare", data pe numerele din arhivă. ⚠️ **Nu se mai
    prescurtează pe telefon** („că e loc") — dar loc chiar N-ERA la 42 px pe buton: măsurat cu Browser
    Rendering, „Buletinul nr. 571" cerea 121 px și primea 101 la un telefon de 390. De aceea banda
    **381–411 px** își ia butoanele la 36 și sub 380 la 34. Acum încape întreg de la 360 în sus.
    ⚠️ **Tăierea NU se vede măsurând `.acum`**: zona nu crește când `b`-ul dinăuntru e tăiat de
    `text-overflow`. Se măsoară `scrollWidth` vs `clientWidth` pe **b-ul vizibil**.
  - **ABONAREA E VIE**: rând nou în `ABONAMENTE` (`@xc/abonare`), audiența `newsletter-abonati`;
    legătura `COMUNICARE` exista deja. ⚠️ **Singura abatere de la regula „un rând = un serviciu de
    trimis"**, cerută de user: A8 nu trimite nimic, deci abonații așteaptă. Scris și în registru, și
    în probă (`tests/abonare.test.ts` păzește lista întreagă, pe ordine).
  - **BARA CU ANII la cheia Arhivei** (user: „când apăs pe History, să apară o bară cu anii, la fel
    cum este la Program"): aceeași unealtă ca la Program — fâșie derulabilă, săgeți ‹ › scrise de JS
    doar dacă anii nu încap, anul deschis adus la mijloc. Pe `/arhiva` bara vine **coborâtă** și cheia
    e **inertă**, iar **pătrățelele cu ani au ieșit din corpul paginii** (un singur loc de ales anul).
    Cele două bare (anii, căutarea) **se exclud**, ca la Calendar.
  - ⚠️ **Lista nu mai stă pe veci în memoria izolatului** (`depozit.ts`): ține **5 minute**, cât și
    cache-ul paginilor. Până azi ținea cât trăia izolatul — la prima aducere la zi depozitul avea 460
    de numere și pagina arăta în continuare 459, iar singurul leac ar fi fost o republicare.
  - ⚠️ **Plătită din nou regula backtick-ului**: accent grav într-un comentariu CSS din `stil.ts`.
    `tsc` a trecut CURAT, esbuild a căzut. A treia oară în trei zile.
  - 27 de probe noi/rescrise în `tests/buletin-newsletter.test.ts`; poze la 390 și 1100 px.

- **ARHIVA NEWSLETTERULUI, ADUSĂ LA ZI DE PE LIVE** (user: „să aduci la zi și newsletterele — ia de pe
  site"). **+1 număr: nr. 571 / 15 septembrie 2026** (id 537). Arhiva: **459 → 460**.
  - Uneltele V1 (`biserica-newsletter/unelte/live/`) au fost **aduse în V2**, la
    `infrastructure/import/newsletter-live/`: `nl-pull.py` + `nl-export.php` + `adu-la-zi.mjs`.
    Procedura, neschimbată la temelie: se urcă prin FTPS un exportator PHP cu nume și jeton aleatoare
    lângă `wp-config.php`, se cheamă **o dată** peste HTTPS, se **șterge** și se verifică peste HTTPS
    că dă 403. Rulat cu `--dry` întâi, cu confirmarea userului între. Nu se atinge nimic altceva pe
    live; se citesc DOAR `wp_mailpoet_newsletters`, `_sending_queues` și `_newsletter_links` (SELECT).
  - ⚠️ **Exportatorul V1 nu era de ajuns**: scotea `body` (structura), nu HTML-ul randat. Acum ia și
    `newsletter_rendered_body` din coada de trimitere — **chiar ce a plecat pe email**, ca cele 459
    dinainte. MailPoet îl păstrează numai pentru numerele recente; tocmai alea ne trebuie.
  - ⚠️ **HTML-ul din coadă NU e la fel cu cel re-randat**: adresele sunt urme de click
    (`[mailpoet_click_data]-<hash>`) și la sfârșit stă un punct de urmărire (`[mailpoet_open_data]`).
    Adresele adevărate vin din `wp_mailpoet_newsletter_links` (hash → url) — iar pentru legăturile de
    abonare tabelul dă înapoi **chiar shortcode-urile V1**, deci după înlocuire HTML-ul arată ca în V1
    și curățarea adusă din `prelucreaza.mjs` merge neschimbată. `utm_source=mailpoet&…` se taie:
    cele 459 n-au așa ceva.
  - ⚠️ **`LEFT JOIN` peste cozi dublează numerele** (nr. 571 a venit de două ori la prima tragere) —
    se ține rândul cu HTML-ul cel mai lung.
  - ⚠️ **Media se caută DUPĂ înlocuirea urmelor**: cât timp adresele sunt urme de click, în HTML nu se
    vede niciun `/wp-content/`, deci pozele și PDF-urile ar fi trecut neobservate. Aduse 2 poze noi.
  - Plase: `lista.json` și `cauta.json` salvate sub `.bak-20260915` **chiar în depozit**, iar un număr
    deja în listă se sare după `id` — a doua rulare nu strică nimic. Newsletterul n-are cron.
  - **Deschis**: aducerea la zi e tot **de mână**. Cât timp numerele se fac în WordPress-ul de pe
    apex, V2 rămâne în urmă între rulări — de hotărât dacă se pune un cron.

- **LUPA DE CĂUTARE ÎN PASTILA CALENDARULUI** (user, 20:14: „să avem o iconiță lupă de căutare înainte
  de cruce"). Calendar **0.8.0**, publicat pe producție.
  - Al patrulea buton al pastilei, între cheia lunilor și cruce. Apăsat, coboară o **bară a lui** sub
    antet (soră cu bara lunilor; cele două se exclud), cu un câmp și un buton. Formular **GET**
    adevărat spre `/cauta?q=…&an=…`: merge fără JavaScript, iar rezultatul are adresă.
  - Pagina rezultatelor: zilele scrise ca peste tot (`randZi`), grupate pe luni, cu bara **deschisă**
    și întrebarea în câmp. Se caută în **titlurile** zilelor (`cauta` din depozit, aceeași funcție ca
    la `/v1/cauta` și la Asistent), fără diacritice, **într-un singur an** — peste toți anii preluați
    același sfânt ar ieși de câte ori se repetă. Anul cerut se coboară la unul **preluat**: pe 2027
    (calculat) căutarea ar fi întors tăcut o listă goală. Sub 3 litere nu se caută, și scrie de ce.
  - ⚠️ **Lupa NU atârnă de rol**, spre deosebire de cruce: căutarea e tot citit, iar cititul e la
    liber. Probe: `tests/cautare-calendar.test.ts` (10), care păzesc și locul ei în rând.
  - ⚠️⚠️ **Poza a găsit DOUĂ reguli moarte în `stil.ts`, vechi de dinainte de lupă** — vezi
    „Calendarul · pastila pe telefon". Cea mai urâtă: **pe telefon zona datei era GOALĂ**, adică exact
    lucrul cerut anume pe 15.09.2026 („neapărat să se vadă scrisul cu data").

- **VALIDAREA APĂSATĂ DIN GREȘEALĂ, RETRASĂ — ȘI CHATUL POATE DE ACUM SĂ O RETRAGĂ SINGUR** (user,
  20:00: „vreau să mut starea pe propus și să dau drepturi Asistentului să facă și el la cerere
  această modificare"). Săptămâna **21 – 27 septembrie 2026** e înapoi în **`propus`** pe producție.
  - **Cauza n-a fost lipsa unei funcții, ci lipsa unui nume într-o listă**: `program.retrage_validarea`
    era publicată din 12.09 și făcea exact ce trebuie, dar nu era în `unelte` din panoul de Module —
    filtru, nu listă de dorințe — așa că modelul n-o vedea și îi răspundea omului „cere-i
    administratorului parohiei". Adăugată a cincea, cu îndrumarea rescrisă ca să o cheme pe nume și
    la frazele omului („am validat din greșeală", „scoate validarea", „treci-o înapoi în propus").
    Copia configurației dinainte: `outputs/modul-chat.bak-20260915-2005.json` (în spațiul agentului).
  - ⚠️ **Retragerea de azi s-a făcut cu SQL pe D1-ul de producție, nu prin aplicație** — și merită
    știut de ce: `retrageValidarea()` e chemată **numai** din acțiunea de chat (n-are rută `/v1`, iar
    `/_actiuni` cere `x-xc-intern`, care nu se poate citi înapoi de la Cloudflare). SQL-ul a
    reprodus fidel toate cele trei scrieri ale funcției — `UPDATE saptamani`, rândul de `istoric`
    (`'retras'`, cu `validat_de`/`validat_la` de dinainte în detalii) și evenimentul
    `program.week.changed.v1` în `outbox` — ca să nu rămână o stare fără urmă. **Dacă mai apare o
    dată nevoia asta, semnul e că retragerea ar trebui să aibă și un drum de om**, nu doar prin chat.
  - **Probele (`infrastructure/eval/chat.mjs`, GLM 5.3 Flash): alegerea uneltei e bună la 19/19**,
    deci a cincea unealtă n-a încurcat modelul mic — inclusiv la perechea care se confundă cel mai
    ușor („programul e bun, validează-l" → `valideaza_saptamana`; „scoate validarea…" →
    `retrage_validarea`). Trei probe noi în set, a doua cu fraza omului din ziua asta.
  - ⚠️ **Scorul la capăt e însă 10/19, și NU din vina modelului: baza D1 LOCALĂ e goală** de la
    trecerea localului spre producție (id-uri de producție, dar date simulate). Probele care cer o
    slujbă existentă pică la execuție, cu unealta aleasă corect. Deci **setul de probe are nevoie de
    date semănate local ca să mai însemne ceva cap-coadă** — altfel citește doar alegerea uneltei.
    Drumul întreg al uneltei noi l-am probat separat, semănând o săptămână validată: propunere cu
    rezumatul bun → „Da" → trecere în `propus`. Săptămâna de probă a fost ștearsă după.
  - ⚠️ **`pkill -f "wrangler dev"` prin `sh -lc` nu omoară nimic** (regula veche, plătită iar):
    tiparul e în linia shell-ului, deci se sinucide întâi. Omoară după PID.
- **NUMĂRĂTOAREA DE SUB TITLUL ARHIVEI, SCOASĂ** (user, 19:22: „scoate textul acesta de la Arhiva").
  Program **0.7.5** pe producție. Sub „Arhiva" nu mai stă nimic, iar odată cu rândul a plecat și
  **interogarea `acoperire`** care îl hrănea — era singurul ei cititor acolo. **Regula**: când scoți un
  rând de afișare, urmărește de unde veneau cifrele; de multe ori pleacă și o cerere la bază.
- **FÂȘIA ANILOR RĂMÂNE JOS ÎN ARHIVĂ, RÂNDUL DE ANI DIN PAGINĂ IESE** (user, 18:56, două cereri într-o
  propoziție). Program **0.7.4** pe producție. Amănuntele, în „Rândul de unelte din antet".
  - **Cele două cereri se țin una de alta**, iar asta a hotărât restul: scoțând `nav.capitole` din corpul
    paginii, fâșia de sub antet rămâne **singurul** drum dintre ani. De aici trei urmări care nu se vedeau
    din cerere: cheia se scrie **inertă** pe `/arhiva` (altfel omul poate strânge peste el singurul
    selector), așezarea anului la mijloc se mută **la încărcare** (bara e deja jos), iar `:hover` și
    `cursor:pointer` se scot de pe cheia inertă.
  - ⚠️ **`/arhiva` NU e încuiată adminilor** (pagina de mesaj o dă ca link tuturor) — găsit uitându-mă
    după rute, nu după cerere. Bara era scrisă **numai** pentru admini, deci scoaterea rândului din
    pagină ar fi lăsat enoriașul nimerit acolo **închis într-un singur an**, fără nicio eroare vizibilă.
    Acum pe `/arhiva` fâșia se scrie pentru oricine, singură sub rândul de unelte, fără cheie deasupra.
    **Regula generală**: când scoți un drum din pagină, întreabă întâi CINE mai ajunge în pagina aceea.
  - **Prima probă a programului în `tests/`**: `program-arhiva-ani.test.ts` (5), pe HTML-ul întors de
    `paginaArhiva`/`paginaMesaj` — nu pe funcții, ci pe regula de drum; tot setul, 292, trece.
  - ⚠️ **A patra oară backtick-ul din comentariu** (același `TS1005` pe linii fără legătură): de data asta
    în DOUĂ locuri deodată, unul în CSS și unul în JS-ul paginii. Comentariile din `STIL`/`SCRIPT` nu
    primesc accente grave, nici măcar în jurul unui nume de funcție.
- **SĂGEATA CENTRATĂ ȘI CHEIA ARHIVEI** (user, 18:28, două puncte). Program **0.7.3** pe producție.
  - **Săgeata „săptămâna viitoare" nu era centrată vertical**: vina o purta un `<span class="sgt">`
    moștenit de la Tipic, rămas în jurul desenului după ce cuvintele au ieșit de pe buton. Un înveliș
    flexibil cu un desen **în linie** e o linie de scris, deci sub săgeată stătea locul cozilor
    literelor. Măsurat cu Browser Rendering (`/content` + script injectat): **9 sus / 13 jos** înainte,
    **10,5 / 10,5** după — la fel ca la cutia Arhivei de lângă, care n-a avut niciodată înveliș.
  - **Iconița Arhivei a devenit CHEIE**: coboară o **bară a doua cu anii**, sub rândul de unelte, exact
    cum coboară cheia Calendarului șirul lunilor („să afișeze anii cum sunt lunile în Calendar").
    L-am întrebat între trei variante și a ales-o pe asta. Amănuntele, în „Rândul de unelte din antet".
    Anii vin din bază, se cer **în același `Promise.all`** cu săptămâna și **numai pentru admini**, deci
    pagina nu așteaptă nimic în plus; fără ani, segmentul rămâne linkul de până acum.
  - ⚠️ **A treia oară backtick-ul din comentariul CSS** (`tsc` l-a prins pe loc, două erori TS1005 pe o
    linie care n-avea nicio legătură). În `stil`/template literals: fără accente grave, oriunde.
- **ANTETUL PROGRAMULUI, REFĂCUT DUPĂ CHIPUL CALENDARULUI** (user, 17:52, în șase puncte; la 18:08 a
  mutat și descărcarea în pastilă). Program **0.7.1** pe producție. Ordinea de acum: **bulina · zona de
  scris · săgeata-dreapta · Arhiva · întrerupătorul · descărcarea**, toate în pastilă, iar afară numai
  **Abonarea**. Amănuntele, în „Rândul de unelte din antet". Patru lucruri învățate sau plătite:
  - **Cuvintele „Săptămâna viitoare" au ieșit de pe buton** și au trecut în zona de scris: scrise în
    amândouă, ar fi spus de două ori același lucru și ar fi umflat rândul. Săgeata rămâne singură, la
    orice lățime.
  - ⚠️ **`overflow:hidden` pe pastilă TAIE meniul** atârnat de ultimul segment — a doua oară în două
    zile (prima la Calendar). Rotunjirea colțurilor trece atunci pe segmentele de la capete.
  - ⚠️ **Scrisul centrat într-o cutie cu `overflow:hidden` se ciuntește la AMÂNDOUĂ capetele**, nu doar
    la coadă: pe telefon „Săpt. curentă" cerea 85 px și avea 79. De aceea forma de telefon e un singur
    cuvânt („Curentă"), cu `text-overflow:ellipsis` ca plasă.
  - **Cele trei hârtii au devenit un meniu** — al doilea buton-cu-meniu din platformă, scris după
    tiparul crucii din Calendar (`<details>` + cele șase linii care scot cutia carcasei + închiderea la
    Escape/clic în afară). Câștigul: fiecare hârtie își are numele scris, nu doar iconița.
  - **⚠️ 18:20, a treia cerere: „nu trebuie să fie pe mai multe rânduri meniul mai ales la admini".**
    Rândul se rupea pe telefon fiindcă zona de scris ceruse lățime. Locul l-a dat **becul
    întrerupătorului** (35 px), care pe telefon iese cu totul: starea trece pe segment (cerneală +
    iconiță hârtie). Acum ține o linie și la 390, și la 360. **Program 0.7.2.** De ținut minte:
    când un rând nu mai încape, întreabă-te ce element are un al doilea fel de a-și spune starea —
    becul avea unul, cuvintele butoanelor aveau `title`, zona de scris n-are niciunul.

- **⚠️ Dungă roșie în mijlocul pastilei** (user: „pare o linie roșie border left pe cruce"). Pricina:
  două reguli scrise pe vremea când crucea era buton de sine stătător, cu chenar de jur împrejur —
  `.btns .sarb:hover` și `.btns .sarb.activ`, amândouă cu `border-color:var(--rosu)`. Puneau roșul pe
  TOATE laturile; de când crucea e **segment al pastilei** și singura ei latură e linia despărțitoare
  din stânga, roșul acela nu mai spunea „butonul e aprins", ci desena o dungă roșie pe mijloc.
  **Regula generală, de ținut minte**: când un buton devine segment într-un grup, `border-color`-ul
  lui de stare trebuie recitit — ce era chenar devine despărțitură, și despărțitura e a grupului, nu
  a butonului. Roșul a rămas unde spune ceva: pe iconiță și pe fundalul palid.
  ⚠️ Se atinge NUMAI culoarea chenarului. Dacă se scrie și `border-radius` în selectorul de `:hover`,
  colțul din dreapta al pastilei se îndreaptă la trecerea cu mausul (`.pastila > :last-child` are
  specificitate mai mică și e acoperită).
- **`<summary>` fără `role="button"`**: browserul îi dă singur rolul de deschizător **și** starea
  deschis/închis; scris de mână, rolul o stinge, iar cititorul de ecran nu mai spune dacă meniul e
  deschis. Semantica nativă e mai bogată decât una pusă peste ea.

- **⚠️ CURSA DERULĂRII LA ZIUA DE AZI — reparată.** La PRIMA venire în pagină ziua rămânea lipită de
  antet, nu la mijloc; abia a doua apăsare pe „Astăzi" o centra (user, 15.09.2026, întâi pe telefon,
  apoi confirmat și pe desktop — **nu era o boală a telefonului, era o cursă, iar cursele nu țin de
  lățimea ecranului**). Trei lucruri se băteau, toate numai la prima venire:
  1. cu ancora `#azi` în adresă, **browserul își face singur saltul la ea**, sub antet
     (`scroll-padding-top:130px`), și saltul lui venea DUPĂ centrarea noastră;
  2. carcasa are `scroll-behavior:smooth`, deci saltul acela e o **animație în curs**, care înghite
     o centrare pornită în timpul ei;
  3. `setTimeout(…, 0)` măsura pagina **înainte să se așeze** (fonturi, poze).
  Leacul, în trei: așezarea de la intrare e **instantanee** (o săritură instantanee taie animația
  browserului), se **repetă după `load`** (și direct, dacă pagina e deja `complete` — altfel `load`
  nu mai vine niciodată), iar linul e **stins cât ținem noi cârma** (`html.fara-lin`). Apăsarea
  butonului rămâne lină: acolo pagina e deja așezată.
  ⚠️ Toate trei arată a cod de prisos la o citire grăbită; `tests/calendar-derulare.test.ts` le
  păzește pe fiecare, cu pricina scrisă.
- **Pastila, forma cerută de user** (15.09.2026): **crucea a intrat ÎN pastilă, după cheia
  calendarului**; pastila ia tot rândul, cele trei butoane (azi · calendar · cruce) au **măsură
  fixă** (46 px, 42 pe telefon) și **numai DATA crește**, cât tot spațiul rămas.
  ⚠️ **Pastila NU mai are `overflow:hidden`** — îl avea cât ținea șirul derulant al lunilor; acum,
  cu meniul crucii atârnat de ultimul segment, l-ar TĂIA și meniul n-ar mai apărea deloc. Rotunjirea
  colțurilor o duc segmentele de la capete.
  ⚠️ Crucea își păstrează clasele `.btn .mic` (pentru măsurile scrisului și ale iconiței), dar
  chenarul, fundalul și rotunjirea LOR se sting: pastila le are pe ale ei, iar două chenaruri unul
  în altul au fost chiar reclamația de acum o oră.

- **⚠️ CARCASA ÎMBRACĂ ORICE `<details>` ÎNTR-O CUTIE — și asta îngroașă randul de unelte.** În
  `@xc/ui`, pe eticheta goală: `details { border:1px solid var(--rule); border-radius:10px;
  padding:10px 14px; margin:14px 0 }`. Făcută pentru cutiile pliante din corpul paginii, a prins și
  meniul de filtre al calendarului: chenar peste chenar (user: „butonul cu crucea este într-un alt
  buton") și 28 px de margine care au înălțat banda („s-a mărit totul pe înălțime"). Se scoate TOATĂ
  local, cum face carcasa pentru `.cont-meniu`. **Orice `<details>` care intră în `.btns` are nevoie
  de aceleași șase linii.**
- **Calendar, forma finală a benzii** (user, 15.09.2026, mai multe treceri):
  - **rândul ține 100% mereu**: pastila la stânga, o **pană** elastică, apoi abonarea și crucea
    lipite de marginea din dreapta. ⚠️ Pană, nu `space-between`: cu `space-between`, un rând rupt pe
    telefon și-ar fi zvârlit bucățile în laturi.
  - **zona cu data NU e buton**, e semnalizare: fundal `--paper` (alb ziua, negru noaptea), nu
    `--tinta` ca butoanele, cu chenar în amândouă laturile. Scrisul e **roșu întotdeauna** — și pe
    luna de azi, și pe alta. ⚠️ Roșul ăsta nu spune „ești pe luna curentă"; aia o spune bulina. Nu-l
    lega de `peLunaAzi`.
  - **cine n-are niciun filtru apăsabil primește crucea STINSĂ, fără meniu** (user: „să nu
    reacționeze nici la apăsare și să nu afișeze butoanele de sub ea"). ⚠️ E un `<span>`, nu un
    `<details>`: un `details` „dezactivat" nu există în HTML, s-ar deschide oricum, iar oprirea ar fi
    căzut pe JS. Azi asta înseamnă neautentificatul, dar regula e scrisă pe DREPT, nu pe treaptă.
- **⚠️ Butonul de abonare are măsură FIXĂ, în `@xc/abonare`** (user: „ca să fie afișat la fel pe
  toate aplicațiile pe care le deschidem"): 118 px cu cuvânt, 44 px fără, sub 600 px. Regula a ieșit
  din cele patru stiluri locale și stă acum lângă buton — singurul fel în care „la fel peste tot"
  rămâne adevărat și mâine. Dacă schimbi scrisul butonului, schimbă și măsura.
- **⚠️ `turbo run typecheck` a picat de două ori cu pachete deosebite** (`authorization-worker`,
  apoi `app-tipic`), iar `tsc` pe fiecare în parte trecea curat; cu `--force` trec toate 36. Pare
  cache/paralelism al lui turbo, nu cod. **La o picare singulară, reia cu `--force` înainte să cauți
  vinovatul în sursă.**

- **Calendar: filtrele au intrat sub O SINGURĂ CRUCE, la dreapta, cu meniu** (user: „fă o singură
  cruce la dreapta, pe care, atunci când apeși, să apară un mic meniu"). Rândurile scriu ce a dictat
  el: *Sfinți cu cruce roșie · Sfinți cu cruce neagră · Sfinți cu evlavie*.
  ⚠️ **Pricina e SPAȚIUL, nu gustul**: trei cruci în rând mâncau ~120 px și data din pastilă nu mai
  încăpea pe telefon („pe mobil, neapărat să se vadă scrisul… cu ziua curentă sau cu luna
  selectată"). Dacă cineva le întoarce în rând, se întoarce și înghesuiala — data cade prima. Proba
  `filtre-calendar.test.ts` păzește că în rând e **o singură** cruce.
  ⚠️ Asta **răstoarnă regula din 12.09.2026** („pe desktop, iconițele cu cruci lasă-le fără text"):
  atunci numele nu încăpeau în rând, într-un meniu încap. De aceea `FILTRE` are acum **două** nume:
  `nume` (al PAGINILOR — „Sărbători cu cruce roșie", că acolo lista e de zile) și `meniu` (cel scris
  de user). Nu le confunda.
  ⚠️ E un **`<details>`**, nu un panou din JS: meniul se deschide și fără JavaScript, iar rândurile
  rămân legături adevărate. JS-ul face doar închiderea la Escape / apăsare în afară.
  Treptele n-au fost atinse: neautentificatul le vede palite, utilizatorul le poate apăsa pe primele
  două, evlavia numai adminul. Crucea din rând **se aprinde în culoarea filtrului pus** — altfel
  meniul închis n-ar spune nimic despre lista de sub el.
- **Admin · Oameni: doar o listă** (user: „elimină coloana cu «acum»… și la fel și coloana cu «de
  transformare a unui utilizator în administrator»… editarea o vedem mai târziu"). Au ieșit ambele
  coloane. **Ordinea**, cerută tot azi: super-administratorii, o linie, administratorii, o linie,
  restul — fiecare ceată alfabetic, cu `localeCompare(…, 'ro')` (altfel „Ștefan" cădea după „Zoe").
  Sus, o **căutare** după nume sau adresă, GET cernut la server (merge fără JS, adresa se poate
  trimite mai departe), fără diacritice și fără majuscule.
  ⚠️ **Ruta `POST /oameni` a rămas ÎNTREAGĂ**, cu poarta `roles.manage`, auditul și cookie-ul CSRF —
  doar nu se mai apasă de nicăieri. Întoarcerea editării e o coloană de scris la loc.
  ⚠️ **Rolurile nu se mai VĂD, dar se CITESC** (`roluriPentru`): pe ele stă gruparea. Cine le scoate
  fiindcă „nu se mai afișează nicăieri" dărâmă ordinea, nu o coloană.
  Semnul „închis" a rămas, mutat lângă nume: nu e rol, e starea contului.

- **⚠️ SETĂRILE APLICAȚIEI: un singur pachet, `@xc/setari`, și un rând nou în meniul contului.**
  Cerute de user: „pe toate paginile celorlalte aplicații… să afișăm un alt buton, în afară de
  Administrare, numit Setări… Fiecare nivel va vedea mai multe lucruri." **Trei trepte**, așa cum
  le-a cerut: utilizatorul simplu își vede **abonarea lui** și o schimbă; administratorul vede pe
  deasupra **toți abonații aplicației** și poate **scoate** pe cineva; super-adminul vede peste tot
  restul **jurnalul aplicației** — ce au făcut adminii și utilizatorii.
  Scris o singură dată, ca abonarea. **Ce rămâne al aplicației: codul, numele, carcasa** și
  legăturile pe care le are. `/setari` e legat în **11 aplicații** (nu în `account`, unde Profilul E
  pagina, și nu în `admin`, care e panoul însuși).
  **Patru hotărâri ale userului**, luate înainte de a scrie o linie:
  **(1)** abonarea arătată e a **aplicației curente**, nu un newsletter al platformei;
  **(2)** butonul apare **peste tot**, cu ce are fiecare — de aceea pagina are și rubrici pentru
  aplicațiile fără audiență, și spune pe față ce lipsește în loc să lase un tabel gol;
  **(3)** `audit.read` **iese din rolul de administrator** (jurnalul e al super-adminului);
  **(4)** adminul **vede și scoate**, atât — adăugarea rămâne gestul omului, cu bifa termenilor și
  cu contul lui, ca să nu se nască abonați fără cont.
  ⚠️ **CONSECINȚA CARE ERA SĂ ÎNCUIE PĂRINTELE AFARĂ**: `audit.read` păzea **pagina de pornire a
  Administrării**, nu doar `admin/schema` — scoasă din rolul de admin așa cum era codul, un
  administrator lua **403 pe TOT panoul**: fără Oameni, fără Dispecerat, fără Module. De aceea
  poarta panoului s-a mutat pe **cheile fiecărei secțiuni** (`roles.manage`, `communication.create`,
  `modules.manage`, `audit.read`): intri dacă ai măcar una și vezi exact ce poți folosi; 403 rămâne
  doar pentru cine n-are niciuna. **Nu o lega la loc de `audit.read`.** Probat sub masca
  „vezi ca administrator": `/admin` dă 200 și arată Dispeceratul. Părintele **pierde `admin/schema`**,
  cum a ales userul știind.
  ⚠️ **Cheie nouă: `audience.manage`** (vede abonații + scoate), implicită la `admin` și `super-admin`.
  Ca orice cheie nouă, cere republicarea lui **`xc-authz`**, nu doar a aplicațiilor.
  ⚠️ **Jurnalul se scrie DIN PACHET**, nu din aplicație (spre deosebire de `@xc/abonare`, care
  primește un `audit()` de la ea). Pricina e chiar zona de loguri: aplicații ca **Tipicul aveau
  legătura `AUDIT` dar nu scriau nimic în ea niciodată**, deci super-adminul ar fi deschis Setările
  și ar fi găsit un tabel gol.
  ⚠️ **Auditul a căpătat `prefixActiune`** (`calendar.` → toate acțiunile calendarului): până azi
  `/citeste` filtra numai pe o acțiune ANUME, deci „ce s-a întâmplat în aplicația asta" nu se putea
  întreba deloc. Prefixul se cere cu punct la coadă și fără `%`/`_`, ca să nu devină tipar LIKE.
  ⚠️ **Comunicarea a căpătat `/preferinte/citeste`**: preferința se putea numai SCRIE, deci nicăieri
  în platformă nu se vedea dacă omul și-a oprit scrisorile.
  ⚠️ **Opt configurații au primit legături noi** (`AUTORIZARE`, `COMUNICARE`, `AUDIT`, după caz, în
  toate cele trei blocuri): buletin, newsletter, biblia, biblioteca, curatenie, live, radio, home.
  Fără ele treptele de admin și super-admin n-ar fi avut pe cine întreba.
  ⚠️ **Rubrica „E-mailul de la platformă" NU e a aplicației**, e a omului, peste tot — și scrie asta
  pe ea, ca omul să nu oprească tot mailul crezând că oprește numai calendarul.
  **Două capcane plătite azi**, amândouă scrise deja în NOTES și călcate iar:
  **(a)** carcasa are `form { display:flex; flex-wrap:wrap }` — fără `display:block` pe formularele
  Setărilor, bifa, mesajul de validare și butonul s-ar fi înșirat ca niște jetoane;
  **(b)** ⚠️ **`const LOCAL = LOCAL_APP + STIL_SETARI` la nivel de modul, în `apps/home/src/index.ts`,
  a oprit workerul din PORNIRE** cu „STIL_SETARI is not defined": la împachetare, corpul modulului de
  intrare se evaluează înaintea pachetului. **`tsc` a trecut curat**; a căzut abia în `wrangler dev`.
  În modulul de INTRARE, concatenarea cu un import se face leneș (funcție); în `stil.ts` merge, ca la
  `STIL_ABONARE`. Ruda bună a regulii „typecheck curat nu înseamnă că se publică".
  Probe: `tests/setari.test.ts` (18), între care poarta cheii la scoaterea unui abonat — cine trimite
  formularul de mână ajunge tot acolo, deci paza nu stă în desenul butonului.
  **Probat pe viu, local**: abonare din Setări → lista de admin arată 2 abonați cu „Scoate" →
  jurnalul arată `calendar.subscribe` cu ora; prin „vezi ca", treptele coboară (user 2 rubrici,
  admin 3, super-admin 4).
  ⚠️ **`curatenie`, `live` și `radio` NU sunt în `pnpm dev`** — nu s-au putut proba local (era așa și
  înainte). Typecheck-ul trece, dar prima lor probă adevărată e pe producție.
- **⚠️ ABONAREA E UN SINGUR PACHET: `@xc/abonare`.** Până azi fereastra de abonare era COPIATĂ în
  patru aplicații (calendar, program, buletin, tipic), identică literă cu literă, și **nu trimitea
  nimic nicăieri**: `<form method="dialog">` o închidea și atât. Userul a tăiat-o scurt („ar trebui
  să fie la fel peste tot. Nu ar trebui să copiez logica în mai multe locuri"), așa că acum butonul,
  fereastra, ecranul celor șase cifre și tot drumul stau într-un loc.
  **Ce a rămas al aplicației: un rând în registrul `ABONAMENTE`** — adică audiența în care se scrie
  omul. Atât. ⚠️ **Un rând acolo = un buton în aplicație**; aplicația fără serviciu de trimis n-are
  buton (regula userului). Azi sunt patru: `calendar`, `program`, `buletin`, `tipic`.
  ⚠️ **Tipicul a căpătat și legătura `COMUNICARE`** (n-o avea deloc — butonul lui era gol pe
  dinăuntru, fără nici măcar o rută dedesubt) și primește acum POST, unde până azi răspundea 405.
  ⚠️ A doua bifă a ferestrei tipicului scria „Vreau să primesc anunțuri" în loc de termeni — o
  scăpare veche din copiere, îndreptată odată cu fereastra comună.
  **Drumul, întreg**: bifă termeni (fără ea nu pleacă — și în pagină, și la server) → dacă ești
  intrat, te abonezi pe loc cu adresa contului; dacă nu, îți vine cod de șase cifre, îl scrii **în
  pagina aplicației** (nu la Cont), și te întorci exact de unde ai plecat, cu cont `user` și abonat.
  ⚠️ **Capcană plătită**: `ctx.spre` al aplicațiilor e o adresă ÎNTREAGĂ (`adresaPaginii`), nu o
  cale — trecută neatinsă la `spreSigur`, ar fi fost refuzată la fiecare abonare și omul ar fi
  aterizat mereu pe rădăcină. Traducerea e în `caleaDin`, cu probă.
- **Calendarul: bara lunilor a coborât, data a urcat.** Șirul derulant al lunilor a ieșit din pastila
  din rândul de unelte și stă acum într-o **bară a doua, sub antet, ascunsă** (`.bara-luni`); în locul
  lui, în pastilă: bulina „Astăzi", **data scrisă** („15 septembrie 2026" pe luna de azi, „octombrie
  2026" pe alta, fără zi) și **cheia cu iconița de calendar** care coboară șirul.
  ⚠️ Închiderea barei la alegerea unei luni **nu e JS**: alegerea e o navigare, iar pagina următoare
  se naște cu `hidden` scris de server. ⚠️ Centrarea lunii deschise se face la FIECARE coborâre a
  barei, nu o dată la încărcare: cât e `hidden`, `offsetLeft` și `clientWidth` sunt 0.
  ⚠️ Data NU e scrisă cu majuscule/răschirat ca lunile, și trece singură pe forma scurtă sub 600 px —
  altfel rândul unic cerut de user s-ar fi rupt pe telefon.
  **Și: la intrarea pe `/` pagina derulează singură la ziua de azi** (clasa `la-azi` pe corp, pusă de
  server numai acolo — nu și când omul a ales el o lună, unde o săritură ar fi o răpire).
- **Calendarul: a treia cruce nu se mai vede decât la admin.** Regula casei rămâne „butoanele fără
  drept se sting, nu se ascund" — ⚠️ **„Sfinți cu evlavie" e singura abatere**, cerută anume pe
  trepte. Primele două cruci rămân palite la neautentificat, apăsabile la restul. Ascunderea NU e o
  poartă: `poateFiltra` taie mai departe `?filtru=evlavie` scris de mână; proba păzește și asta.
- **Termeni și condiții: o pagină, a platformei**, la `home/termeni` — nu una per aplicație, fiindcă
  textul vorbește despre cont, adresă și date, iar fereastra e la patru aplicații. Cuprinsul e cel
  cerut: ce date se țin, că nu facem reclamă, că nu vindem nimic, că se șterg la cerere.
  ⚠️ **Nu e text verificat de un avocat** și nu se poartă ca și cum ar fi.
- **⚠️ `pnpm migreaza` era STRICAT, și cu el tot localul.** Cerea bazele `xc-<x>-staging`, care nu mai
  există: `--local` n-are mediu, iar blocul fără `env` al configurațiilor poartă din 14.09 numele de
  **producție**. Deci baza locală rămânea goală și `pnpm dev` dădea 500 („no such table") la orice
  pagină cu date — taman acum, când localul e singurul loc de probă. Local se cheamă acum prin
  **binding** (`DB`), care nu se schimbă de la un mediu la altul; pe remote rămâne numele.
- **Schema platformei a intrat în admin**, la `admin/schema` (0.3.0), cerută în doi pași: întâi un
  link, apoi „detalieri pe toate aplicațiile și configurația generală". Pagina are desenul, ce e
  scris la fel peste tot (o dată, nu de 21 de ori) și o fișă pentru fiecare worker: versiune, adresă,
  ce ține, ce cheamă, ceas, ultima publicare, variabilele ei proprii, unde e codul. Poartă `audit.read`.
  Unealta: `infrastructure/harta/schema-cloudflare.mjs` — citește **workerii publicați**, scoate
  pagină / `--fragment` / `--ts`. ⚠️ **Conținutul din admin e o FOTOGRAFIE adusă în cod**, nu citit
  live (tokenul contului n-are ce căuta într-un worker); se reface cu `--ts` + deploy.
  ⚠️ **Descrierile aplicațiilor se citesc din comentariul de sus al fiecărui `wrangler.jsonc`** —
  nicio a doua copie care să se învechească singură.
  ⚠️ Două capcane de desen, plătite: **SVG-ul nu taie și nu rupe textul** (ce nu încape curge peste
  cutia vecină, fără nicio eroare — de aceea unealta își măsoară singură etichetele și se plânge la
  stderr); și **un cron scris într-un comentariu de bloc îl închide**, fiindcă începe cu stea-slash.
- **✅ Lămurit 15.09.2026: `URL_HOME` = `https://website.sfantul-ilie.ro` la toate cele 13** (era
  apexul, adică WordPress-ul de pe cPanel). Hotărârea userului: platforma e deocamdată **sistem
  închis**, „Platforma" din meniu duce la home-ul V2, ca să ajungă repede de pe telefon. **Apexul trece
  pe V2 la următoarea schimbare majoră a site-ului** — atunci `URL_HOME` se întoarce pe apex, tot
  peste tot deodată. Schimbat numai în blocurile `env.production` (blocul de bază n-are `URL_*`;
  cele `env.staging` sunt moarte și au rămas cum erau), 13 versiuni urcate cu un patch, 13 deploy-uri,
  schema din admin regenerată.
- **Toate cele 12 aplicații se lucrează de acum de pe un singur canal, #proj-biserica-platforma-v2.**
  Userul a întrebat dacă poate lucra mai departe pe canalele V1 ale aplicațiilor; răspunsul e nu —
  V2 e un singur repo, un arbore git, pachete comune (`@xc/ui` → șase aplicații republicate). Canalele
  V1 se arhivează, containerele lor se șterg (#agent-server), registrul de linkuri locale e curățat:
  pentru platformă rămâne **un singur link local, `https://rubik:8474`**. Pe NAS rămân vii, pe lângă
  V2: `biserica-site` (clona WordPress-ului de pe apex, se mai ține „până suntem gata"),
  `biserica-transmisiuni` (aparatul), `biserica-whatsapp` + puller.
- **V1 și staging-ul s-au închis de tot.** Contul Cloudflare are de acum **un singur mediu**: 21 de
  workeri, 15 adrese, 12 baze D1, 7 depozite, 1 KV, 2 cozi, 1 gateway — toate `xc-*-production`, cu
  singura excepție știută `biserica-transmisiuni`. Socoteala e în NEXT, 0c. Harta întregului cont, pe
  aplicații și resurse, a fost dată utilizatorului.
- **O coadă rămăsese pe staging în fișiere, nu pe Cloudflare.** `local-spre-productie.mjs` mutase D1,
  R2 și KV, dar **sărise cozile**: blocul de bază din `calendar`, `program` și `event-worker` arăta
  spre `xc-events-staging`, ștearsă. Workerii publicați erau corecți, deci nimic nu s-a stricat — dar
  primul `wrangler deploy` fără `--env production` ar fi legat producția de o coadă inexistentă.
  **Când muți un mediu, numără toate FELURILE de resurse, nu doar pe cele la care te gândești.**
- **Ceasul de noapte al identității, readus.** V1 avea la `biserica-cont` un cron la 3 care mătura
  sesiunile și codurile trecute; la trecerea pe V2 s-a pierdut, și o săptămână nimic n-a măturat.
  Acum e la `xc-identity` (acolo stau tabelele), 0.3.0. A ieșit la iveală și `curataIncercariVechi()`,
  scrisă odată cu limitarea încercărilor, **pe care n-o chema nimeni** — tot din lipsa cronului.
  ⚠️ **Capcana zilei**: prima scriere ștergea și din `login_challenges`, tabelă pe care migrația 0002
  o aruncă odată cu linkul de intrare. **`tsc` a trecut curat ȘI deploy-ul a reușit** — ceasul ar fi
  căzut tăcut în fiecare noapte, la o oră la care nu se uită nimeni. S-a prins numărând rândurile pe
  baza ADEVĂRATĂ, înainte de publicare. Interogările unui cron se probează pe baza vie, nu la tastatură.
- **KV-ul a căpătat prefixul casei**: `CONFIG-production` → `xc-config-production`. Cloudflare nu
  redenumește spații KV, deci a fost recreat. Două lucruri de ținut minte: bindingul `CONFIG` îl aveau
  **trei** workeri (și `program`, nu doar `admin` și `chat`) — aflat numărând bindingurile celor
  PUBLICAȚI, nu citind fișierele; iar **arhiva de dimineață a KV-ului era goală** (2 octeți), fiindcă
  `wrangler kv key list` citește local fără `--remote`. Conținutul adevărat s-a salvat abia acum.
- **Containerele V1 de pe NAS, verificate**: niciun commit nepushat în cele 15; necommisele sunt
  versiunea V1 a funcției „vezi ca", deja în V2. Pot fi șterse de #agent-server.
- **Aparatul din biserică a trecut pe producție** și cu el s-a închis cutover-ul emisiei. Pornirea de
  la „nu pot porni LIVE": LIVE cere telemetrie de sub 75 s, iar aparatul bătea în `live.staging`.
  Amănuntele și proba secretului: NEXT, punctul 0b.
- **Curățenia a început** (arhiva D1/KV/gateway pe NAS, adresele vechi redirectate din `home`, localul
  mutat pe resursele de producție, `modul:chat` salvat din staging). Unealta cu poartă:
  `curatenie-cloudflare.mjs`. Ce a rămas: NEXT, punctul 0c.
- ⚠️ **Trei capcane de API Cloudflare**, toate plătite azi în `backup-syno.mjs`: exportul D1 e în doi
  timpi (și `signed_url` stă la `result.result`, iar `output_format` e cerut la fiecare cerere);
  cursorul listei R2 e în `result_info`, nu în `result` — altfel pleci cu primele 1000 de obiecte și
  unealta îți spune „Gata"; `per_page` la logurile AI Gateway nu trece de 50.
- ⚠️ **`pkill -f <tipar>` își omoară propriul shell** când tiparul apare în linia lui de comandă.

### 2026-09-14

- **Emisia (A5) portată în V2, ca DOUĂ aplicații**: `live.staging.sfantul-ilie.ro` și
  `radio.staging.sfantul-ilie.ro`, publicate și legate una de alta. Radio vede cele 777 de piese din
  depozitul refolosit; `live` compune starea din amândouă și cere următoarea slujbă de la program
  (probat: „Sfântul Maslu, 15.09, 18:00"). Panoul, playerul și socoteala ceasului stau într-un
  pachet nou, `@xc/comanda`, scrise **o singură dată** pentru amândouă. 31 de probe noi (227 în
  total), typecheck curat pe 34 de pachete. Amănuntele: secțiunea „LIVE și RADIO" de mai sus.
- ⚠️ **Împărțirea în două a tăiat o legătură care în V1 era o chemare de funcție**: LIVE și radioul
  se exclud, dar acum trăiesc în workeri diferiți. Am întrebat înainte să mă apuc unde stă starea, și
  răspunsul a fost „`live` ține starea, `radio` o ascultă" — de aceea creierul e tot într-un loc, iar
  `radio` cere, nu hotărăște. **Asta e regula care ține cele două aplicații să nu se certe.**
- **Cererea a crescut în patru completări, toate în timpul lucrului**, și fiecare a mărit-o: de la
  „felia cerută" la „tot ce e pe transmisiuni acum pe radio", apoi subdomeniul `live`, apoi
  refolosirea bucketului, apoi cutover-ul și website-ul. **De reținut**: la utilizatorul ăsta,
  cererea de la început e un punct de plecare, nu conturul lucrării — merită așteptat până termină
  de vorbit înainte de a fixa arhitectura. Aici am avut noroc că împărțeala aleasă a suportat
  creșterea fără să fie refăcută.
- ⚠️ **A răsturnat regula prefixului `xc-`, tot el**: bucketul de 11 GB al V1 se REFOLOSEȘTE, ca să
  nu copiem degeaba cu câteva zile înainte de cutover. I-am spus că redenumirea unui bucket R2 nu
  există la Cloudflare. **La curățenia de la final, bucketul ăsta nu se șterge.**
- **Bootstrap între doi workeri care se leagă unul de altul**: fiecare avea binding spre celălalt,
  deci niciunul nu se putea publica primul (`code: 10143`). Leacul: scos temporar bindingul din
  `live`, publicat `live`, publicat `radio`, pus bindingul la loc, republicat `live`. De ținut minte
  pentru orice altă pereche de workeri legați reciproc.
- **Drumul comenzii, probat fără sesiune de om**: API-ul mașinii (`/intern/aparat/stare`, cu
  `APARAT_SECRET`) trece prin exact aceeași hotărâre ca butonul. O telemetrie de probă a pornit
  radioul de la `live`, scriind ceasul din celălalt worker; o hotărâre „live" l-a stins. A rămas
  neprobat **numai stratul HTTP+autorizare al butonului**. V1 e neatinsă și transmite mai departe.
- **Voluntarii curățeniei au devenit CONTURI ale platformei; pickerul a ieșit** (cerere a
  utilizatorului, noaptea). Pe 13.09 ceruse anume contrariul — „pickerul rămâne, ca mod simplu" —
  și i se spusese atunci că se abate de la „datele stau într-un loc, autentificarea la fel". S-a
  răzgândit, și în direcția bună: **ultima abatere de la structura mare a căzut.**
  Cuvintele lui: „butonul Autentificare dispare și funcția lui (doar în această aplicație) este
  preluată de Cont. Schimbă numele și Ieși - dispar"; „toate conturile care sunt acum la Curățenie
  se vor face conturi Utilizator pe platformă"; „datele pentru un utilizator se vor extinde la tot
  ce are un user în Curățenia acum"; „funcția de Adăugare din Administrare se transformă într-o
  schimbare de rol a unui utilizator existent".
- **Fișa omului s-a întregit, la identitate.** `users` a căpătat `first_name`, `last_name`, `phone`,
  `short_name` (migrația `identity/0003`). Erau exact coloanele pe care le ținea curățenia despre
  același om — adică o a doua listă de persoane în platformă, tocmai ce nu trebuia să existe.
- **Asocierea cu o aplicație e acum un comutator pe contul omului** (`asocieri`, tabel generic:
  `user_id`, `aplicatie`, `stare`, `etichete` JSON). Registrul aplicațiilor cu membri stă în
  `@xc/contracts`; identitatea nu știe ce e un „monitor" și nu trebuie să știe.
  ⚠️ **Două stări, nu una**, cerut în aceeași rundă: „să fie totuși o validare la nivel de
  admin.curatenie… nici chiar oricine nu poate ajunge în acest punct". Omul **cere** de pe contul
  lui (`ceruta`), un administrator al aplicației îl **primește** (`acceptata`). **Ieșirea nu cere
  voie** — nimeni nu e ținut cu forța într-o echipă de voluntari.
- **⚠️ Eticheta „Admin" nu mai e o etichetă.** La portare fusese lăsată ca însemn al echipei, iar
  dreptul venea separat, de mână, din `cleaning.manage`. Acum comutatorul **acordă și retrage chiar
  cheia**, la autorizare (`/acorda`, `/retrage`, nou). Cum panoul din care se apasă cere deja
  `cleaning.manage`, un administrator al curățeniei e numit **numai de alt administrator al ei sau
  de un super-admin** — exact cum s-a cerut. Pe cale de consecință, **apărarea ultimului
  administrator s-a întors**: nu se mai poate stinge singurul rămas.
- **Super-adminul e permanent** („pe mine chiar dacă mă scoate cineva — mă pot adăuga singur").
  Până acum rolul se dădea **o singură dată, la nașterea contului**: o revocare l-ar fi închis afară
  pentru totdeauna. Acum garanția stă pe **adresa** din `EMAIL_SUPERADMIN`, iar `/sesiune` pune rolul
  la loc dacă lipsește. Tot atunci s-a îndreptat și `/atribuie`, care era `INSERT OR IGNORE` și **nu
  reaprindea** un rol revocat — tăcut.
- **Ecran nou: „Oameni" în Administrarea platformei** („eu pot să fac pe cineva super-admin — adică
  doar eu (alt super-admin)"). Poarta e `roles.manage`, cheie care vine numai cu `super-admin`.
  Până acum rolurile se scriau numai de mână în D1; un al doilea super-admin nu se putea face din
  platformă. Adresa permanentă se desenează **fără buton**: nu se poate coborî de nicăieri.
- **Panoul curățeniei, fila Voluntari, rescrisă** („o listă +add unde adaugi un user deja existent
  în lista de curățenie - tot acolo și lista Cererilor"): sus **Cererile** în așteptare, cu
  Primește / Refuză; apoi **„+ Adaugă"**, care deschide conturile platformei neasociate, cu căutare;
  apoi **Echipa**. „Adaugă voluntar" — care năștea un om nou în baza aplicației — a ieșit.
  Comutatorul „Activ" s-a făcut **„În echipă"**, iar „Editează" scrie de acum pe **contul** omului
  (adresa nu se poate schimba de acolo: e cheia contului lui).
- **Migrarea: 28 de conturi noi + unul existent** (al super-adminului), 29 de asocieri acceptate,
  2 chei de `cleaning.manage`. Toți cei 29 aveau e-mail și telefon, deci n-a rămas nimeni pe dinafară.
  Apoi `curatenie/0002` a aruncat numele, adresele, telefoanele și steagurile din `volunteers`, care
  a rămas cu `id`, `user_id`, `slug` și datele rândului. Numărătorile de după: 29 / 82 / 530 / 31.
- **Cum ține laolaltă**: `apps/curatenie/src/oameni.ts` — **cartea oamenilor**, cerută o dată pe
  cerere de la identitate și legată de `D1Database` printr-un **înveliș** (`cuOameni`). Așa cele ~45
  de locuri care cheamă depozitul n-au trebuit rescrise: `Voluntar` și-a păstrat forma
  (`first_name`, `is_admin`…), doar izvorul s-a schimbat. Interogările care luau numele prin JOIN
  aduc acum `user_id`, iar numele se lipesc la citire.
  ⚠️ **Capcana rundei**: `tsc` a trecut curat peste vreo zece interogări care cereau coloane tocmai
  șterse — `toate<Voluntar>(...)` nu verifică SQL-ul. S-au găsit cu un `grep` după numele coloanelor,
  nu cu compilatorul. La orice scoatere de coloană: **grep, nu tsc**.
- Publicat pe staging: `xc-authz`, `xc-identity`, `xc-account`, `xc-admin`, `xc-curatenie` (0.2.0).
  196 de probe trec (14 noi, în `tests/asocieri.test.ts`). Producția rămâne neatinsă.

### 2026-09-13

- **Ferestrele opresc derularea din spate — regulă generală, în carcasă** (cerere user, seara:
  „la toate aplicațiile… popupul de abonare sau preview 3d-flip la buletin să blocheze scrollul din
  spate… să fie o regulă generală când faci un pop-up"). Blocarea exista deja, scrisă de mână în
  patru aplicații, dar **pe `body`** — și nu lucra, fiindcă rădăcina are `overflow-y:scroll`.
  Mutată în `@xc/ui`: stilul pe `<html>` + îmbrăcarea lui `showModal`, deci o capătă orice fereastră,
  și cele de mâine. Curățate abonările (calendar, program, tipic, buletin), fereastra textelor zilei,
  răsfoitul 3D și lupa copertei din bibliotecă (ea scria `overflow` direct pe corp); chatul cere acum
  aceeași numărătoare, în loc de clasa lui. Trei probe noi în `tests/carcasa.test.ts`, una care
  păzește ca nicio aplicație să nu-și mai scrie blocarea singură. Amănunte: „Capcane de ținut minte".
  **Publicat pe staging** (cerere user, 23:35) la **toate cele zece aplicații care poartă carcasa** —
  home 0.2.1, cont 0.1.6, admin 0.1.4, biblia 0.1.2, bibliotecă 0.1.2, calendar 0.7.4, program 0.6.4,
  tipic 0.3.3, buletin 0.3.4, newsletter 0.1.1. ⚠️ **O schimbare în `@xc/ui` nu ajunge la om până nu
  se republică fiecare aplicație** — carcasa e legată în fiecare worker, nu servită de undeva.

- **RĂSFOITUL numărului, în locul deschiderii PDF-ului** (cerere user, seara). Modulul **Real3D
  FlipBook v3.7.10**, chiar cel de la `jurnaluldeafaceri`; asseturile (35 de fișiere, 3,8 MB) stau în
  depozitul buletinului sub `flipbook/` și se servesc la `/flipbook/*`. Fereastră peste pagină, pe tot
  ecranul; butoanele de PDF au ieșit de tot, coperta și „Răsfoiește" deschid răsfoitul, iar
  `?rasfoit=1` îl deschide singur. Buletin **0.3.2**. ⚠️ **Licența a doua rămâne de cumpărat** —
  amănunte în „Răsfoitul numărului".
  **Drumul până aici, ca să nu se mai bâjbâie**: întâi varianta liberă (page-flip MIT + pdf.js
  Apache-2.0), cerută ca probă; a mers după trei împiedicări — `getDocument` din pdf.js 6 nu mai
  primește adresa ca șir (cere `{ url }`), build-ul modern cade cu „n.toHex is not a function" (se ia
  `legacy/`), iar `loadFromImages` desenează tot într-o pânză 1x, deci scrisul mărunt iese încețoșat
  (se dau paginile ca HTML). Apoi userul a cerut Real3D, și motorul s-a schimbat fără să se atingă
  fereastra, butonul sau adresa — bucata de JS care umple `#r-carte` a fost scrisă de la început ca
  să poată fi schimbată singură.

- **Reparat, la reclamația userului: paginile numerelor de buletin dădeau 404** („nu merg linkurile
  de sub ultimul număr"). Cauza, subtilă: aplicația își tăia din cale propriul nume, crezând că e
  prefixul gateway-ului de preview — vezi „Capcane tehnice". Montajul se ia de acum din MEDIU.
  Buletin **0.1.1**, trei probe noi (11 în fișier). Verificate pe staging TOATE clasele de linkuri:
  fișele numerelor, vecinii, hârtiile, anii arhivei, rezultatele căutării și adresa scurtă
  `/buletin/615` (302 → numărul întreg). **De reținut**: la portarea următoare, plimbă o dată toate
  linkurile paginii, nu doar rutele pe care le-ai scris tu — `/v1` ieșea identic cu V1 și PDF-ul la
  fel, deci proba de fidelitate a trecut cu pagina numărului ruptă.

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

- **REPARSAREA ÎNTREGII ARHIVE DE CHINONIC + cele trei pagini, forma cerută de user** (seara, Website
  **0.7.0**, publicat). Userul a hotărât cele trei întrebări deschise („păstrează" / „paragraf bold" /
  „da"), a cerut „să faci curățenie și apoi să publici" și a spus cum arată datele adevărate — de acolo
  a ieșit tot restul.
  - ⚠️⚠️ **O SINGURĂ CAUZĂ pentru cele trei defecte de clasă: celulele `mailpoet_blockquote` nu se
    citeau deloc.** Textul pus ca CITAT în buletin stă într-un tabel încuibat — celula de afară se taie
    la primul `</td>`, care e al dungii citatului, deci iese goală; cea de dinăuntru n-avea clasa cerută
    de `blocuri()`. Așa au ieșit „33 de fișe fără autor, cu numele drept corp", bucățile sub 40 de semne
    și textele bune ținute „nesigure": corpul articolului pur și simplu nu ajungea la noi. Userul a
    spus-o exact: „toate au text scurt — chiar dacă structural nu pare că e, vizual se vede mereu,
    10-12 rânduri de text după autor". **Articole cu corp sub 200 de semne: 85 → 3.**
  - **FORMATARE MINIMĂ, scrisă o dată: `import/chinonic/formatare.mjs`** — patru marcaje și nimic mai
    mult (îngroșat, înclinat, liste, citate), folosită ȘI la fragmentul din buletin, ȘI la textul adus
    de la sursă. Subtitlurile devin **paragraf îngroșat** (hotărârea userului), nu `<h2>`: un titlu
    străin n-are ce căuta în ierarhia paginii noastre. ⚠️ **Drumul de siguranță**: marcajele care au
    voie se prefac în semne de control, restul etichetelor se taie, textul se escapează ÎNTREG, și abia
    la urmă semnele devin iar etichete — ale noastre. Un `<strong>` neînchis se aruncă întreg (altfel ar
    îngroșa pagina de la locul lui în jos), iar `<script>`/`<style>` se scot cu tot cu trupul lor.
    Probe: `tests/chinonic-formatare.test.ts` (23).
  - ⚠️⚠️ **PRAGUL DE 60 DE SEMNE A CĂZUT** — el arunca replicile, versurile, subtitlurile și rândurile
    de listă. Apărarea împotriva meniurilor s-a mutat de la LUNGIME la LOC și la NUME: murdăria stă la
    margini, nu în mijloc. Patru lucruri învățate pe drum, toate măsurate:
    **(1)** hotarele de sfârșit se deschid după primul rând de **PROZĂ**, nu după primul rând strâns —
    altfel un „Distribuie" de deasupra articolului reteza totul (`examenul-credintei`: 49 de semne în
    loc de 10.000); **(2)** **fruntea de metadate a uneltei de conversie se taie**: `description:` e
    chiar începutul articolului, deci potrivirea cădea acolo și „începutul" nimerea în capul paginii;
    **(3)** **trei subtitluri unul sub altul sunt un RAFT, nu o structură** — bara laterală a acvila30
    scria treizeci de titluri de cărți în coada fișei; **(4)** un rând care e **numai o legătură** e
    navigare, oricât ar arăta ca text.
    ⚠️ **Ce s-a încercat și s-a scos**: tăierea de la capăt a oricărui rând scurt fără punct. Mânca
    tocmai sfârșitul dialogurilor („— Ce faci, băiete? îl întreabă curios") — adică exact ce se cerea
    păstrat. Ce e murdărie se taie **pe nume**, nu după formă.
  - **Cifre**: 252 bune din 317 la chinonic (erau 186, ținta pusă dimineață era „peste 240"), 61 din
    131 la buletin; 334 cu text întreg (295), **14 nesigure (52)**; 448/448 cu titlu, 420 cu autor.
    Fișa arătată de user ca „inutilizabilă" (`examenul-credintei`) are acum titlu, autor, 10.050 de
    semne de text și o singură linie de sursă, cu legătura vie.
  - **Ordinea rulării, cu plasă**: copie a tabelei pe NAS
    (`_arhiva-cloudflare/2026-09-16/d1/…-inainte-de-reparsare.sql`) → `extrage.mjs` fără scriere,
    măsurat → `--scrie` → `in-baza.mjs --chiar` → `adu-textul.mjs --refa --martori=25` (probă fără
    scriere, nouă: aduce și arată, nu scrie) → `--refa --chiar` peste toate 438 → `asocieri.mjs --chiar`.
  - **Ce a mai ieșit**: `sursa_text` care e doar numele gazdei nu se mai scrie (rândul „Sursa" se scria
    de două ori la 290 din 317); entitățile se decodează acum complet (greacă, latine cu semne, iar
    `&not;` se aruncă — în arhiva asta ține locul cratimei de despărțire); cele 3 fișe fără titlu s-au
    închis din `indreptari.json`, cu titlurile luate de la sursă.
  - ⚠️ **Ce NU e curat**: coada a vreo 40 de fișe din 348 — rămășițe de site ori o frază tăiată la
    mijloc, pe pagini-adunătură unde hotarul de jos nu se ghicește după formă. Se repară pe fișă anume,
    la arătarea userului, nu la nimereală.
