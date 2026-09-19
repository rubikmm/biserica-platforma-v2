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
  ce i s-a spus că se abate de la „datele stau într-un loc, autentificarea la fel". Pickerul a ieșit
  pe 14.09 (voluntarii = conturi) și **s-a întors pe 19.09 într-o formă îngustă**: doar numele, doar
  rezervări în calendar, și dispare cu totul la omul intrat cu contul;
- **parola locală de admin a ieșit cu totul** — cele trei hash-uri bcrypt, sesiunea semnată, resetarea
  prin email, fila „Schimbă parola" și „modul de inițializare". Panoul cere `cleaning.manage`, cheie
  care exista deja în contracte (deci **fără republicarea lui authz**). `is_admin` din tabel a rămas
  **etichetă a echipei**: cine e „Admin" pe cartelă și primește rapoartele din oficiu. **Din 19.09**
  panoul nu mai e pagină la `/admin`, ci rubrică în Setări („Echipa și rapoartele"), iar rândul de
  unelte cu contul („Intră · Contul meu · Administrare") a ieșit din pagini;
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

00f. **BULETINUL 616 — harta, cedările, semnătura, marcajele; scris și PUBLICAT pe 19.09.2026.**
    Vezi jurnalul zilei (19.09.2026) și „BULETINUL — foaia tipărită". Pe producție: buletin **0.15.1**,
    chat-worker **0.6.2**, program **0.9.3**.
    ⚠️ **Prima probă e a userului, pe viu**: (1) **compunerea lui 616** cu scara nouă `CEDARILE` — se
    dă floarea întâi, apoi sfinții, apoi pericopa; de văzut că iese fără floare și că nu refuză cu
    cifre; (2) **meniul și marcajele** în bulă: „meniu" → subiecte → acțiuni → „← Înapoi la meniu",
    și `_cursiv_` / `*aldin*` pe titlu, semnătură, text, sursă.
    **Deschise, în ordinea în care dor**:
    1. **`despre` din hartă e prea lung în textul meniului** — propus un câmp separat `numit`, scurt,
       numai pentru butoane și liste; de hotărât cu userul;
    2. **pragul de 5 cuvinte în stânga lui `:`** (`harta.ts:545`): o frază mai lungă cade pe ramura
       „ce scriu?" în loc să fie citită ca `subiect: valoare`. Cifra e arbitrară, nemăsurată;
    3. **`sursa` se taie la 200 de semne** — de întrebat dacă ajunge (o carte cu editură și an trece);
    4. **`creier: fara` scurtcircuitează ÎNAINTE de hartă**, deci drumul determinist nu se mai încearcă
       deloc — exact invers decât se vrea;
    5. **contorul determinist/model** (`GET /chat/stare?statistica=buletin`) e **cumulativ, fără
       resetare** — nu se poate citi „cât a lucrat AI-ul în runda asta", iar din cifra asta hotărăște
       userul dacă rămâne AI-ul deloc;
    6. **„altul: X" cu text după nu e prins** de `refuz.ts` (doar refuzul curat, „Niciunul", e prins);
    7. **mesajul cedării e trecător pe ecran** — îl păstrează doar bula; omul care compune din pagină
       nu află că i-a căzut floarea sau sfinții;
    8. **`/chat/confirma` e sincron** — leacul adevărat (`waitUntil`, ca la `/mesaj`) e **nefăcut**;
       azi merge pe cârpeala din 01:30 (ceas + sondare `/stare?propunere=`). Vezi 00c;
    9. **arhiva 610–614 e doar în R2** — local avem numai 615, deci forma nouă a sursei (carte între
       steluțe) nu e validată pe un număr adevărat;
    10. **floarea nu se mai întoarce la `strans=1`** (scara e cumulativă dinadins) — de confirmat cu
       userul că așa vrea.

00e. **ROTIREA ALBUMELOR — scrisă și publicată pe 18.09.2026.** Vezi „Rotirea albumelor" la „LIVE și
    RADIO". Ce rămâne: (1) **pragul `PRAG_SUNET_DBFS` e REGLAT la −60 dBFS** (18.09.2026, seara), după
    ce biserica goală s-a măsurat la −67.5 dBFS RMS pe `live.sfantul-ilie.ro/mic`; rămâne **validat la
    slujba de 19.09, ora 18:00**, că vocea trece peste −60 (dacă nu urcă `ultimul_sunet`, pragul e prea
    sus și se coboară spre −65);
    (2) ✅ **verificat pe viu că a sărit primul album** după publicare — confirmat 18.09.2026, 20:18:19
    (contorul semănat cu 24 h în urmă face rotirea scadentă pe loc);
    (3) **de citit graficul de pe `/mic` după slujba de 19.09, ora 18:00**, ca să vedem cu cât trece
    vocea peste −60 dBFS (fereastra de 6 h, linia RMS și vârful) — de acolo se hotărăște dacă pragul
    rămâne la −60 sau coboară spre −65.

00c. **CHATUL, PE APLICAȚIE — scris ȘI PUBLICAT pe 18.09.2026, 13:20** (`e74d10d`, `ce7b7e6`).
    Îndrumările și uneltele au ieșit din cheia comună în `modul:chat:<aplicatie>`; rubrica „Chat AI"
    din Setările fiecărei aplicații; Module a rămas cu ale platformei. Amănuntele: „Modulul de Chat
    (AI)". Publicate: chat-worker 0.3.0, buletin 0.8.1, program 0.8.1, admin 0.5.0 (fără ocol —
    cercul cere ocolul doar când unul dintre workeri nu există încă). KV însămânțat:
    `modul:chat:program` = îndrumările vechi + cele 5 unelte ale lui; `modul:chat:buletin` = îndrumări
    **goale** + `compune`/`socoteala`, ca să nu mai poarte obiceiurile Programului.
    **Rămâne la user**: scrie îndrumările buletinului la `buletin.sfantul-ilie.ro/setari` → „Chat AI".
    ⚠️ **Viteza NU e rezolvată**: măsurat azi pe viu, „Pune titlul articolului principal: Smerenia" a
    luat **2 min 49 s** și s-a sfârșit cu `buletin.compune` → `argumente_invalide` (unealta cere
    numărul întreg, deci modelul a întrebat înapoi de motto). Instrucțiunile s-au scurtat, dar
    drumul lung rămâne: fiecare mesaj face 2 apeluri la model, iar propunerea mai adaugă unul.
    De privit la următoarea rundă, cu `wrangler tail`, pe bucăți.
    ✅ **Viteza și blocarea — rezolvate pe 18.09.2026, seara** (chat-worker 0.4.0, program 0.8.4, buletin 0.9.0): răspunsul e ASINCRON (`/chat/mesaj` întoarce sub o secundă, aplicația ține lucrul cu `waitUntil` al ei, bula sondează `/chat/stare` la 2,5 s, cu etapa curentă și timpul scurs), buget de 90 s pe mesaj în chat-worker, fundalul nu se mai blochează pe desktop (excepție anume de la regula ferestrelor; pe ≤480px rămâne), propunerea Da/Nu se reface din istoric, Enter = rând nou pe telefon, mesajul omului până la 12 000 de semne. Vezi „Modulul de Chat (AI)" → „Asincron și sondare" în `docs/architecture/chat-si-actiuni.md`. **Neprobat viu cu modelul** — prima probă e a userului.
    ⚠️ **`/chat/confirma` a rămas pe drumul vechi, SINCRON** (găsit 19.09.2026, 01:30): execută acțiunea
    pe conexiunea bulei, iar o compunere de buletin trece de un minut → conexiunea cade, butoane moarte.
    Cârpit aditiv (ceas + „renunț" + sondare `/stare?propunere=<id>` în `raspunde()`); **leacul adevărat
    — `waitUntil`, ca la `/mesaj` — e NEFĂCUT**, fiindcă e schimbare în codul comun al tuturor bulelor.
    Celelalte aplicații cu bulă poartă `raspunde()` vechi până la republicare.

00d. **CHESTIONARUL BULETINULUI NOU — scris și publicat pe 18.09.2026, ~23:00 (buletin 0.9.0).** Vezi „CHESTIONARUL BULETINULUI" mai jos în jurnal (18.09.2026). Ce a rămas din lista de mai jos: (1) ✅ formularul a ieșit, `/nou` arată schița; ciorna e JSON în R2 (`schita/<nr>-<data>.json`), nu rând D1 — se poate muta; ✅ **PDF gol la prima intrare — închis pe 19.09.2026**: varianta zero (schiță implicită) se compune singură la prima intrare pe `/nou`; (2) ✅ subiectele = lista închisă din `buletin.raspunde` (chestionarul îi conduce ordinea) — ✅ instrucțiunile punctuale în afara chestionarului („schimbă motto-ul în…") — făcute 18.09, 23:30 (buletin 0.10.1); (3) ✅ fișiere Word/txt/poze în chat — făcute 18.09, 23:30 (chat-worker 0.5.0, program 0.9.1, buletin 0.10.1); vezi jurnalul. Rămân: curățenia pozelor din `poze/` (nu se șterg la validare), urcarea mai multor fișiere cu un singur răspuns. Lista veche, pentru referință:
    (1) **Ciorna ca RÂND CU CÂMPURI** în baza buletinului, nu PDF + cererea păstrată: la prima intrare
    pe `/nou` se generează singură, cu text **gol** (fără Lorem ipsum), rotiță în locul copertei, iar
    când e gata apar poza și butoanele active; la intrările următoare se preia ciorna și așteaptă
    completări. **Formularul nu se mai arată niciodată** — toate modificările trec prin chat.
    (2) **Unelte de EDITARE PUNCTUALĂ** peste ciornă („Schimbă motto-ul în…"), pe o listă închisă de
    subiecte = câmpurile ciornei = întrebările rundei de inițiere. Publicarea rămâne a adminului.
    (3) **Chatul să primească text lung, documente și poze**, și un **link** din care ia textul din
    web, îl curăță și PROPUNE titlu/text/sursă; textul lung se arată strâns, cu „vezi tot / vezi mai
    puțin" (userul trimite la aplicația lui de lecții de chineză ca pildă).
    ⚠️ **Hotărârea care le ține pe toate** (user, 12:45 și 12:54): „prefer o listă de 20 de subiecte pe
    care pot interacționa cu Chat-ul AI decât o judecată avansată de la un model foarte bun" și
    „trebuie să construim ceva care merge cu **modelul free** pus acum — nu vreau să trec pe cel cu
    plată". Deci: partea grea o duce codul, modelul doar potrivește fraza cu un subiect.
    **Lipsește încă lista subiectelor de la user** — i s-a propus una scoasă din câmpurile foii.

00b. **BULA DE CHAT PE `/nou` LA BULETIN — scrisă, publicată și APRINSĂ pe 18.09.2026, 12:50.**
    Vezi „BULA DE CHAT A BULETINULUI". Cercul s-a publicat cu ocolul (`publica-cu-ocol.mjs --intai
    services/chat-worker --fara BULETIN --apoi apps/buletin`), apoi `admin` 0.4.1; comutatorul și
    uneltele scrise în KV. Probat pe viu doar de afară: `/nou` dă 403 fără cont, prima pagină e 200 și
    **nu** poartă bula.
    ⚠️ **Lanțul cu modelul n-a fost încercat**: probele merg cu servicii de probă, iar modelul adevărat
    (glm flash, workers-ai) n-a fost pus niciodată să compună un buletin. Prima încercare e a userului.
    De privit atunci, în ordine: (1) **lasă modelul goale nr. și data?** (dacă le scrie, compune peste
    alt număr — se vede în rezumatul propunerii, care spune numărul adevărat); (2) refuzul cu cifre la
    text prea lung îl face să scurteze și să încerce iar, ori se oprește?; (3) după „Da, fă-o", pagina
    se reîncarcă și formularul vine umplut.

00. **ADMINII PE APLICAȚIE — scris ȘI PUBLICAT pe 18.09.2026, 11:20.** Vezi „ADMINII PE APLICAȚIE".
    Ordinea publicării, care rămâne regula la orice atingere a cheilor: **`xc-authz-production` ÎNTÂI**
    (0.3.0 — el știe cheile noi), apoi aplicațiile. Invers, adminul global ar fi pierdut pe loc
    Newsletterul, Tipicul, Biblia și Website-ul, fiindcă authz ar fi refuzat chei pe care nu le știe.
    Publicate: program 0.8.0, calendar 0.8.1, buletin 0.7.2, newsletter 0.6.2, tipic 0.3.7,
    biblia 0.1.5, biblioteca 0.1.5, home 0.7.4, curatenie 0.2.3, admin 0.4.0.
    **Rămâne la user**: să numească oamenii din Setările aplicațiilor (acum: Programul liturgic,
    `program.sfantul-ilie.ro/setari`), apoi tabelul la `admin.sfantul-ilie.ro/admini`.
    ⚠️ **Nimic nu s-a încercat viu** (`pnpm dev` nu rula în timpul lucrului): probele merg prin `fetch`
    la workeri, cu servicii de probă. Prima încercare vie e a userului.
    ⚠️ Hotărât cu el: bula de **chat** din Program atârnă de acum de adminul Programului, ca să poată
    compune (costă bani la fiecare mesaj — a ales știind).

0a. **COMPUNEREA BULETINULUI — făcută pe 17.09.2026, seara; ce a rămas de probat și de făcut.**

   API-ul care creează foaia tipărită (cerere user: antet fix + motto/nr/dată, două coloane pe
   toate patru paginile, un principal și cel mult doi secundari, calendarul ca la tipar pe pagina a
   patra, plus socoteala lungimii). Amănuntele de formă și măsurile: „BULETINUL — foaia tipărită".

   **PROBAT**: foaia randată local cu Chromium (`apps/buletin/unelte/proba-foaie.mjs`), măsurată
   față de numerele 610–615 — coloana 241.1 pt, rândul 16.5 pt, 45 de rânduri, 36.9 semne pe rând
   (arhiva: 36.67); socoteala prezice 9028 de semne și intră 9053, pe toate patru variantele, cu 0
   pe dinafară. Refactorul programului e **neutru la pixel** (probă: HTML identic, randare identică).
   472 de probe trec, typecheck curat.

   **FĂCUT 17.09.2026, 22:47–23:05 (buletin 0.6.0 + program 0.7.9)**: cele
   cinci reguli ale userului — program PROPUS folosit, cu atenția la început; nr./data needitabile;
   motto precompletat de la numărul trecut; articolul gol umplut cu text de probă la vedere; secundarii
   de probă câte 1/4 la programul întreg. Vezi „BULETINUL — foaia tipărită" → „Cele cinci reguli".
   **Publicate pe production în aceeași seară, 23:12–23:13** (program înaintea buletinului —
   buletinul citește `stare` din răspunsul programului; la orice schimbare care le atinge pe
   amândouă, aceeași ordine).

   **NEPROBAT, în ordinea în care trebuie luat**:
   1. **cap-coadă pe local**: `pnpm dev` nu răspundea la `https://rubik:8474` în timpul lucrului, deci
      ruta `/nou` (GET și POST) și legătura de serviciu spre program **nu s-au încercat vii**;
   2. **Browser Rendering** — VĂZUT 18.09.2026: userul a compus 616 pe live, PDF-ul a ieșit, dar
      textul intra peste floare (scriptul măsura înainte să se decodeze pozele și fonturile — reparat
      în 0.6.1, `dupaIncarcare()`). **0.6.1 e pe production din 18.09.2026, 01:53** (numai buletinul;
      programul era deja 0.7.9 pe live). Rămâne de confirmat, cu 616 **recompus din `/nou`**, că
      (a) pagina a patra iese curată și (b) `data-raport` ajunge înapoi (siguranța „nimic pe
      dinafară"). ⚠️ PDF-ul vechi al lui 616 e tot cel defect — nu se repară singur, trebuie refăcut.
      ⚠️ **616 de pe live (compus 18.09, 09:01) a arătat al doilea defect al paginii a patra** —
      calendarul retezat jos —, reparat în **0.6.2, publicat 18.09.2026, 09:56**. PDF-ul vechi al lui
      616 nu se repară singur: trebuie **recompus din `/nou`**. Din **0.7.0** recompunerea se și vede
      pe loc (ciorna în pagină), iar validarea din ecran îl publică în arhivă;
   3. **fonturile din Chromium-ul de laborator**: săgeata `→` din tabelul programului iese strâmbă
      local — **și la foaia programului, care e cod netins de runda asta**, deci e lipsa fonturilor
      din container, nu un defect nou. De verificat totuși cum iese pe producție.
   4. **pozele se dau azi ca ADRESE** (URL), nu se încarcă din ecran: `p_poza`, `s1_poza`, `s2_poza`.
      Încărcarea în R2 și tăierea la măsura coloanei sunt pasul următor firesc.
   5. ~~floarea decorativă~~ **✓ venită de la user 17.09.2026, 21:49** (`resurse/floare.png`).
   6. **densitatea**: foaia noastră ține cu ~15 rânduri mai mult text decât Word-ul pe același număr
      (615). Nu e greșit — încape mai mult —, dar dacă userul vrea foaia „ca în Word" la rând, de
      strâns pagina 1 (titlul mai jos / mai mare) și de dat 44 de rânduri pe coloană în loc de 45.
   7. **diacriticele**: refacerea lui 615 a cerut punerea lor la loc din sursă, fiindcă PDF-urile din
      Word n-au hartă Unicode pe Cambria. Dacă se vor reface și alte numere vechi din API, e nevoie de
      o unealtă a lor (azi e un script de laborator în `tmp/diacritice-615.py`, în spațiul agentului).

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
   - ⚠️ **panoul n-a fost umblat cu un om adevărat** (din 19.09 se ajunge la el prin `/setari`, nu prin
     `/admin`), iar de pe 14.09 seara are ecrane NOI (cererile,
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

## BULA DE CHAT A BULETINULUI, pe `/nou` (18.09.2026)

**Cererea userului**: „Când am făcut bula de chat AI, am făcut-o să fie transmisibilă. Deci să facem
Buletinul să aibă această funcție și să fie afișată doar pe `/nou` — când fac un buletin nou, ca să pot
trimite instrucțiuni, texte etc. care să se lege la API-ul buletinului nou și să-l completeze."

**A fost chiar „transmisibilă"**: modulul s-a montat cu trei linii, cum scrie în
`docs/architecture/chat-si-actiuni.md` — `modulChat({ aplicatie: 'buletin' })`, `CHAT.ruteaza(…)`,
`ctx.chat = await CHAT.bula(…)`. Nu s-a atins nimic din bulă, din creier și din protocol.

**⚠️ NUMAI PE `/nou`**: bula se pune doar acolo (`apps/buletin/src/index.ts`, ramura GET a lui `/nou`).
Restul buletinului e hârtie publică — o bulă scăpată acolo n-ar da nicio eroare, doar ar sta în colț la
vederea oricui are cont și ar costa bani la fiecare apăsare. Poarta rutelor `/chat…` e însă a
modulului, una pentru tot: stins din Module, ori om fără drept → **404**, nu „stins", nu „n-ai voie".

**Cum „completează" ecranul, fără niciun drum nou**: lanțul e cel de la Program. Omul scrie în bulă →
modelul cheamă `buletin.compune` → fiind acțiune de SCRIERE, se întoarce ca **propunere cu Da/Nu** →
după „Da" acțiunea pune PDF-ul în depozit, păstrează cererea lângă el și răspunsul poartă
`reincarca: true`, deci bula reîncarcă pagina. **Din 18.09.2026 `/nou` se deschide cu ciorna, nu cu
formularul gol**: dacă numărul care urmează are deja o ciornă în depozit, ea se arată (cu butoanele și
cu amprenta `?v=`), iar formularul vine umplut din cererea păstrată (`scrisDinCerere`). Deci „completat
de chat" e starea citită de unde era deja scrisă. ⚠️ Adresa pozei NU se păstrează în cerere (acolo
`poza` e doar da/nu), deci câmpul ei rămâne gol la reumplere.

**⚠️ NR. ȘI DATA NU MAI VIN DE LA MODEL** (`buletin.compune`, `buletin.socoteala`): sunt opționale, iar
lipsa lor e drumul bun — le ia serverul din arhivă (ultimul + 1, duminica următoare), exact ca ecranul,
unde userul a cerut anume să nu fie editabile. Un model care le-ar ghici ar compune peste alt număr, și
PDF-ul se scrie sub cheia numărului. Rezumatul propunerii spune numărul ADEVĂRAT (`rezuma` citește
arhiva), iar răspunsul acțiunii întoarce acum `nr` și `data`, ca modelul să le poată spune omului.

**⚠️ FIECARE BULĂ VEDE NUMAI CE-I TREBUIE** (`CE_VEDE_BULA` în `services/chat-worker/src/index.ts`):
programul vede program+calendar+tipic, buletinul numai buletin. Până acum lista era una pentru toată
platforma, și nu se vedea fiindcă bula era una singură. Cu două, s-ar fi întâmplat două lucruri
nedorite: bula programului ar fi căpătat uneltele buletinului, iar **regulile și măsurile buletinului
(cunoștințe de FUNDAL, cerute la fiecare mesaj) ar fi intrat în contextul programului** — plătite la
fiecare apăsare. O aplicație fără rând în tabel vede tot, ca până acum.

**APRINS pe producție la 18.09.2026, 12:50** (KV `modul:chat`): `aplicatii: {program, buletin}` și
uneltele `buletin.compune` + `buletin.socoteala` adăugate în listă, lângă cele cinci ale programului.
⚠️ **Lista de unelte e o poartă**: dacă e scrisă, ce nu e în ea nu se vede — o bulă bifată fără uneltele
ei răspunde frumos și nu poate face nimic. Se stinge oricând din Administrare → Module.

**⚠️ CERC DE LEGĂTURI**: `xc-buletin` → `CHAT`, `xc-chat` → `BULETIN`. Se publică cu
`infrastructure/cutover/publica-cu-ocol.mjs --intai services/chat-worker --fara BULETIN --apoi apps/buletin`
(altfel cod 10143 — niciunul nu poate fi primul). Al doilea cerc al platformei, după `program↔chat`.

**Probe**: `tests/buletin-chat.test.ts` (18) — bula numai pe `/nou`, poarta rutelor (404 la stins și la
om fără drept), umplerea ecranului din cererea păstrată, nr./data luate din arhivă, `CE_VEDE_BULA`.
⚠️ Comutatoarele se țin un minut în memoria modulului: probele cheamă `uitaConfigChat()` înainte de
fiecare, altfel citesc configurația probei dinainte și trec pe cauză greșită.

## ADMINII PE APLICAȚIE (18.09.2026) — „admin doar pe aplicația respectivă"

**Cererea userului**: „Am nevoie să fac admini două persoane în aplicații diferite — să fie admin doar
pe aplicația respectivă și nu de-a lungul întregii platforme. Vreau apoi să am un tabel la mine în
Administrator." Apoi, lămurind: „vreau să fie valabilă la toate aplicațiile — să aibă toate capacitatea
de a avea setat administratori — **eu îi setez la fiecare aplicație în parte**"; „este vorba fix de
rolul pe care simulez acum din meniul de Cont pe toate aplicațiile, **Intră ca administrator**"; „dar
este vorba de acei admini ai aplicației — nu admini generali ca mine, super-admin". Concret, acum:
**numai Programul liturgic**.

**⚠️ AXA E CHEIA, nu rolul și nu `scope`.** Un administrator de aplicație e un om cu rolul `user` care
a primit punctual cheia aplicației (`permission_grants`, `/acorda` la autorizare). `Scope` există în
contracte (`parish:`, `team:`, `audience:`), dar **toate cele 34 de verificări din aplicații întreabă
cu `global`**, deci un rol cu scope îngust ar fi fost refuzat peste tot. Tiparul nu e nou: așa se dă
`library.borrow`, și așa numește Curățenia adminii ei de pe 14.09.2026.

**Registrul: `packages/contracts/src/admini.ts`** (`APLICATII_ADMINISTRABILE`) — cod, nume, cheia de
admin, cheile însoțitoare, ce poate face adminul. Unsprezece aplicații. Cheile: program `program.write`
(+`program.publish`), calendar `calendar.manage`, buletin `bulletin.write` (+`bulletin.publish`),
newsletter `newsletter.manage` **(nouă)**, curățenie `cleaning.manage`, bibliotecă `library.manage`,
tipic `typicon.manage` **(nouă)**, biblia `bible.manage` **(nouă)**, live+radio `broadcast.manage`,
website `website.manage` **(nouă)**. Cele patru noi sunt și în `PERMISIUNI_IMPLICITE.admin`, ca
adminul global să nu pierdă în tăcere o aplicație.

**Ce s-a schimbat în fiecare aplicație** (o linie, același tipar peste tot):
- `eAdmin` nu se mai citește din `sesiune.roles`, ci din cheia aplicației —
  `eAdminulAplicatiei(env.AUTORIZARE, cid, principal, '<cod>')` din `@xc/authorization`;
- **rândul „Administrare" din meniul contului rămâne al ROLULUI GLOBAL** (`eAdminPlatforma`): acolo un
  admin de aplicație n-are ce face, panoul cere cheile lui. ⚠️ La `live`/`radio` rândul duce dinadins
  la panoul EMISIEI, nu al platformei — acolo cheia e cea potrivită și n-a fost atins nimic.
  ⚠️ La `curatenie` rândul se scria pentru cheia curățeniei, deci un admin al ei vedea o legătură care
  îl întâmpina cu 403. Acum e pe rolul global, ca peste tot.
- adminul global și super-adminul **nu pierd nimic** (cheile vin cu rolul), iar masca „vezi ca" coboară
  singură, fiindcă întrebarea trece prin autorizare. Citit din roluri, masca n-ar fi coborât nimic.

**Numirea: în Setările fiecărei aplicații** (`<app>/setari` → rubrica „Administratorii aplicației"),
scrisă **o singură dată** în `@xc/setari`, deci toate aplicațiile au capacitatea deodată. Poarta e
**cheia aplicației**, nu `roles.manage`: cine ține aplicația poate lua pe cineva alături (tiparul
Curățeniei; super-adminul le are pe toate). Rutele: `POST /setari/admin-numeste` și
`/setari/admin-scoate`. Trei lucruri care se încalcă ușor: **cheile se acordă TOATE odată** (un admin
de Program care poate scrie dar nu valida n-ar duce nimic la capăt) — dacă una cade, fapta se
socotește nereușită; **poarta se cere în rută**, nu pe credit de la pagina care a desenat butonul;
**cine are contul închis nu apare** în lista de numit.

**Tabelul: Administrare → `/admini`** („un tabel cu oamenii și aplicațiile și bulina la intersecție").
Poarta `roles.manage` (super-admin). E de **VEDERE**: numirea stă în aplicații, iar numele din capul
tabelului sunt legături spre Setările lor. **Bulina are două feluri**, fiindcă dreptul vine pe două
drumuri și numai unul se poate lua din aplicație: **plină** = numit acolo (se poate scoate),
**conturată** = din rolul global (se schimbă din Oameni). În tabel intră numai cine are măcar o bulină.
Datele vin într-o singură întrebare: `POST /harta-admini` la authz (cheile toate deodată; `/cine-are`
la plural). Prima coloană rămâne lipită la derularea în lateral — la a șaptea aplicație nu se mai știe
al cui e rândul.

**Probe**: `tests/admini-pe-aplicatie.test.ts` (23) — registrul, decizia pe aplicație, masca, numirea
cu poarta și auditul ei, tabelul randat prin `admin.fetch`. Plus `tests/usa-website.test.ts`, care
acum răspunde ca autorizarea adevărată (înainte avea un `{}` care însemna „refuz la orice") și are
două probe noi: adminul Website-ului vede chenarele cu rolul `user`, adminul Programului nu.

⚠️ **Deschis, de hotărât cu userul**: bula de **chat** din Program se aprinde pe `ctx.eAdmin`, care de
acum înseamnă „adminul Programului" — deci un admin de aplicație poate cheltui pe modelul de limbaj.
Se poate întoarce la rolul global cu o linie (`ctxChat`), dacă nu e ce vrea.

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

**Rotirea albumelor** (cerută 18.09.2026: „radioul cântă azi la nesfârșit același album"). Ceasul sare
singur pe alt director, la întâmplare, de la prima lui piesă, apoi iar la capătul albumului, ocolind
ultimele 3 alese. **Pornește pe două ceasuri**: 24 h fără nicio comandă de OM, SAU o oră de liniște în
biserică — socotită din `max(ultimul_sunet, ultima_om)`, deci o apăsare cere din nou o oră întreagă.
Odată pornită, merge la fiecare capăt orice s-ar auzi; o oprește numai o comandă de om. ⚠️ **Contorul e
al omului, nu al aparatului**: deciziile lui (slujbă, întoarcere la radio) trec prin `preiaDecizia` și
NU-l repun la zero. Sunetul vine în telemetrie (`sunet: {nivel, varf, prag, ultimul_peste_prag,
fereastra_s}`, `null` când aparatul nu măsoară): ⚠️ **pragul e al APARATULUI** — microfonul aude și
boxele, deci „liniște" nu e zero. Workerul ține `ultimul_sunet` ca **maxim monoton** (un `null` ori o
valoare mai veche nu-l coboară) și-l arată pe `/mic`. Socoteala pură: `apps/live/src/rotire.ts` (probe:
`tests/rotire.test.ts`); fapta, în DO-ul `Aparat`, pe ACELAȘI drum ca o apăsare din panou (`puneCeas` +
comandă nouă). Capcane: (1) un DO are **o singură alarmă** — multiplexate în cheia `alarme`, iar
`puneComanda` nu mai cheamă `deleteAlarm()`; (2) „album" = director cu piese CHIAR în el (`pieseDin`
numără recursiv); (3) alarma nu se reprogramează la fiecare telemetrie — la trezire se recitește tot și,
dacă sunetul a mutat scadența, se amână (`asiguraCeasulRotirii` o aprinde când nu e programată).
⚠️ **Contorul se seamănă cu o zi ÎN URMĂ** (user, 18.09.2026: „să fie deja peste 24h"): la prima
atingere a DO-ului `ultima_om` = `acum − FARA_OM_MS` (`contorulDeStart`), deci un radio despre care nu
știm nicio comandă de om se socotește **nepăzit** și rotirea e scadentă pe loc — iar acolo, și numai
acolo, alarma se pune pe `acum`, nu pe capătul albumului (albumul curge în buclă de zile, capătul lui
ar veni la o oră neștiută). Așa prima săritură se vede în ≤20 s de la prima telemetrie de după
publicare, nu peste o zi. Pe același temei, „necunoscut = nepăzit" și în socoteala pură
(`scadentaRotirii`/`eScadentaRotirea` cu `ultimaOm` null dau scadență imediată).

**Graficul sunetului pe `/mic`** (cerut 18.09.2026: „să facem grafic"). Fiecare telemetrie cu `nivel`
măsurat lasă un punct `{la, nivel, varf}` în DO-ul `Aparat`. ⚠️ **Pe chei ORARE**
(`sunet:AAAA-LL-ZZTHH`, UTC, ≤180 puncte/oră ≈ 7 KB), nu într-un singur șir: o valoare de storage are
limita de **128 KB**, iar un array de 7 zile ar fi rescris întreg la fiecare 20 s. Ora din cheie e
UTC fiindcă cheia e un sertar, nu o etichetă — în ora locală, noaptea trecerii la ora de iarnă ar
amesteca două ore într-una. Cheia poartă ora în ea, deci ordinea alfabetică E ordinea cronologică:
citirea unei ferestre e un `list({start, end})`, iar mătura celor peste **7 zile** e
`list({start: 'sunet:', end: limitaVechimii})` + `delete`, făcută o dată pe oră (la schimbarea cheii),
nu la fiecare bătaie. Socoteala pură, cu probe: `apps/live/src/sunet-istoric.ts` +
`tests/mic-sunet.test.ts`. Ruta `GET /mic/sunet?ore=6|24|168` (aceeași poartă de super-admin, fără
cache) întoarce `{prag, puncte, de_la, pana_la, pas_s}`; peste 1200 de puncte se **rarefiază cu
MAXIMUL** fiecărei bucăți (un monitor de prag caută vârful, nu media), iar `pas_s` spune paginii cât
de depărtate sunt punctele, ca să rupă linia la goluri și să nu arate 7 zile ca pe o pană continuă.
Desenul e SVG inline făcut de scriptul paginii (fără biblioteci), după regulile skill-ului `dataviz`:
o singură axă, linia RMS de 2 px cu vârful ca spălare de 10% în **aceeași** culoare (sunt mărimi
cuibărite), grilă subțire plină, pragul punctat cu eticheta lui, zonele peste prag ca o bară subțire
pe talpă, legendă scrisă, cifra doar la capăt, citire la plimbarea mausului ȘI la săgeți. ⚠️ Culorile
sunt tokenuri proprii (`--graf-nivel`, `--graf-prag` în `STIL_MIC`), nu `--albastru`/`--rosu`: pe temă
întunecată accentele carcasei sunt prea deschise pentru marcaje de grafic — pașii de acolo trec
validatorul `dataviz` în amândouă temele.

**`asteaptaComanda` nu mai scoate 500** (18.09.2026). Cele 2–23 de HTTP 500 pe zi de pe
`GET /intern/aparat/comanda` erau **toate la capătul așteptării de 25 s**: ramura de expirare făcea
`return this.comanda()`, adică o citire de storage pornită dintr-un `setTimeout` parcat — iar dacă
între timp obiectul durabil fusese mutat sau repornit, citirea cădea. Acum comanda citită la INTRARE
se ține în mână și se întoarce la expirare, iar `puneComanda` trezește așteptătorii **cu versiunea
nouă în braț**: pe drumul ăsta nu mai există nicio citire de după așteptare. Bucata e în
`apps/live/src/asteptare.ts`, ca să poată fi probată (`tests/mic-sunet.test.ts`).

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

- **⚠️ O PAGINĂ CARE SE MĂSOARĂ SINGURĂ (script inline) NU VEDE POZELE ȘI FONTURILE ÎN BROWSER
  RENDERING.** Găsit 18.09.2026 la buletin (floarea de 13.7 mm lipsea din măsurătoare, textul intra
  peste ea). Chromium-ul din container decodează data-URI-urile la parsare, Cloudflare nu — deci
  proba locală TACE. Regula: orice script care așază text după înălțimi măsurate pornește după
  `load` + `document.fonts.load(...)` + `fonts.ready` (vezi `dupaIncarcare` în `apps/buletin/src/foaie.ts`);
  iar proba locală a unei astfel de pagini se face și cu resursele ca FIȘIERE (încărcare asincronă),
  nu doar ca data-URI.

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

## Programul pe prima pagină a site-ului WP — legătură TEMPORARĂ (18.09.2026)

Până acum programul stătea în **două locuri**: aplicația Program (A2) și, tastat a doua oară de mână,
WordPress-ul de pe apex (`sfantul-ilie.ro`) — tipul de articol `program` cu câmpuri ACF
(`zi_liturgică` → `programul_zilei`), randat de `content-single-program.php` din tema `sfantulilie`.
Cererea userului: „să nu ținem în două locuri programul", cu **formatul actual al site-ului păstrat
neatins** („să creăm acel format după calendarul nostru din aplicația Program și să-l afișăm acolo").

- **Ruta: `/v1/bucata-site?data=azi`** → `{ ok, bucata, titlu, de_la, pana_la, slujbe, stare }`.
  `bucata` e HTML-ul TEMEI, rând cu rând (`<ul>`/`<li>`, „⁞ 07:00 – ", `<strong class="rosu">` la
  slujba de dimineață, detaliile `<em>→ …</em><br/>` în `div.program-detalii`) — pe prima pagină nu
  se schimbă nimic vizual, doar sursa datelor. Codul: `apps/program/src/site.ts`, probe:
  `tests/program-bucata-site.test.ts`. Materia se ia din **`materiaSaptamanii()`** (scoasă din
  `tabelulSaptamanii`, în `hartii.ts`), deci regula „validat / altfel ce e disponibil" se scrie o
  singură dată, pentru buletin și pentru site deodată.
- ⚠️ **E TEMPORARĂ, spus anume de user**: „când vom schimba site-ul, va dispărea și această
  necesitate". De aceea stă într-un fișier singur și atârnă de o rută: la trecerea apexului pe V2 se
  șterg `site.ts`, ruta, rândul din indexul `/v1`, proba și runbook-ul — un commit, fără urme în
  hârtiile care trăiesc mai departe. **Nu o împleti cu foaia sau cu tabelul de tipar.**
- **Partea de WordPress e a canalului `#proj-biserica-website`** (containerul `biserica-site`, FTP,
  niciodată automat): bucata de PHP gata scrisă, cu transient de 10 minute, **ultima copie bună** în
  `wp_options` (ca prima pagină să nu rămână cu gol când workerul tace) și poarta pe `stare` —
  `docs/runbooks/wp-program-prima-pagina.md`.
- ⚠️ **Pe pagina publică se pune numai `stare: "validat"`.** Pagina n-are unde scrie „PROPUS", iar un
  program propus dat drept al parohiei ar minți. (La buletin regula e alta, cerută anume: propusul se
  folosește, dar se spune la început.)
- ⚠️ **Al doilea consumator al acelorași câmpuri ACF a rămas nelegat**: widgetul „Transmisiune audio"
  (`widget_display`, widgetul `custom_html-5` din `functions.php`) scrie „Slujba următoare" /
  „Conectare…" / „LIVE" din aceleași rânduri. Dacă articolul `program` nu mai e completat, el rămâne
  pe „Actualizare program …". Corespondentul în V2 există: `/v1/urmatoarea`, `/v1/curenta` și starea
  emisiei de la `live.`. De legat la o rundă anume.
- **Deosebire de conținut, nu de formă**: textele duminicii vin acum din calendarul nostru, deci sunt
  cele din foaia de pe ușă („Duminica după Înălțarea Sfintei Cruci", „Sf. Mari Mc. Eustație…"), nu
  forma lungă tastată în WP. Se schimbă din calendar, și atunci peste tot deodată.

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

⚠️ **DIN 18.09.2026, HĂȚURILE SUNT ÎN DOUĂ LOCURI** (user, 12:53: „vreau mai întâi să avem
instrucțiuni diferite per aplicație… din Setări aplicație pe un tab Chat AI să avem câmpurile
specifice aplicației"):

- **Administrare → Module** (super-admin, `modules.manage`) — ale PLATFORMEI: pornit/stins, în care
  aplicații, cine-l vede, cu ce model. Lista aplicațiilor vine din `APLICATII_CU_BULA` (`@xc/chat`),
  registru ținut lângă modul: ecranul nu mai oferă spre bifat aplicații în care bula nu e montată.
- **Setări aplicație → „Chat AI"** (adminul APLICAȚIEI) — ale ei: `indrumari` și `unelte`, în cheia
  `modul:chat:<aplicatie>`. Rubrica e scrisă o dată, în `@xc/chat/setari.ts`, și se lipește prin
  punctul de prindere `rubrici` din `@xc/setari` (care dă acum și jetonul CSRF al paginii — o rubrică
  ce și-ar face altul ar fi respinsă la prima salvare). Uneltele se arată **cu bifă**, cerute de la
  chat-worker (`GET /unelte?aplicatie=`); când el tace, bifele nu se desenează deloc și alegerea de
  acum pleacă înapoi în `hidden` — altfel o salvare ar șterge-o fără ca cineva să bage de seamă.
  Ruta de salvare (`POST /chat/setari`) stă **înaintea** porții obișnuite, ca îndrumările să se poată
  scrie și cu chatul stins la aplicația aceea; paza ei: adminul aplicației + CSRF + originea.
- **Chei separate, nu câmpuri în `modul:chat`**: fiecare aplicație scrie în cheia ei, deci un
  citește-schimbă-scrie din două locuri deodată nu mai poate pierde scrisul celuilalt.
- **Moștenirea**: o aplicație fără cheia ei primește vechile `indrumari` + uneltele ei din lista
  veche (filtrate pe prefix). Câmpurile globale au rămas în KV și nu se mai scriu de nicăieri.
- **Instrucțiunile**: regula 8 nu mai e harta uneltelor Programului (slujbe, sfinți, calendar), ci una
  generală („potrivește fraza cu exemplul cel mai apropiat; alege UNA"); regula 9 („AICI POȚI FACE
  DOAR ATÂT… asta nu pot face aici, nu căuta ocoluri") se pune ACUM ȘI când aplicația n-are nicio
  unealtă. Cerere a userului: „să răspundă repede la toate cererile, nu să încerce nu știu ce minuni".

**Hățurile de dinainte de 18.09.2026, toate din panoul de Module**: `indrumari` (text liber, în instrucțiuni),
`unelte` (lista canonică a ce vede modelul — pe program `modifica_slujba`, `adauga_slujba`,
`valideaza_saptamana`, `sterge_slujba` și, din 15.09.2026, `retrage_validarea`; „fără rapoarte,
enumerări, arhivă"), exemple cu argumente la
acțiuni (`{fraza, argumente}`), setul de probe `infrastructure/eval/chat.mjs`. **Dacă cineva lărgește
lista de unelte, să reruleze probele** — modelele mici cad exact la alegerea între unelte.

⚠️ **Lista e un filtru, nu o listă de dorințe**: o unealtă nouă publicată de aplicație NU
ajunge la model până nu e bifată (goală = toate; `chat-worker/src/index.ts`, `permis`). Din
18.09.2026 bifele stau în **Setările aplicației → Chat AI**, nu în panoul de Module — și se aleg
dintr-o listă adusă din manifest, deci un nume scris greșit nu mai poate trece neobservat.
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

## BULETINUL — foaia tipărită, compusă din API (17.09.2026)

Până acum buletinul se făcea în **Word** și se urca gata făcut; de aici înainte se poate **compune**:
`apps/buletin/src/{masuri,foaie,compune,actiuni}.ts`. Arhiva rămâne neatinsă — cele 619 numere vechi
sunt fișiere, nu se recompun.

**Forma cerută de user**, măsurată pe numerele 610–615 (`pdftotext -bbox-layout`, unealta de
calibrare a rămas la `tmp/calibrare-buletin.py` în spațiul agentului):

| ce | cât |
|---|---|
| pagina | A4, 595.32 × 841.92 pt |
| coloana | **241.1 pt** (măsurat 240.93–241.22 pe 24 de coloane), șanț 21.12 pt, marginea stângă 42.6 pt |
| rândul | **16.56 pt**; banda ține **45 de rânduri** de coloană |
| corpul de literă | **15 pt** Cambria → **Caladea** la noi (Calibri → Carlito) |
| semne pe rândul plin | **36.67** (media a 915 de rânduri pline din arhivă) |
| un număr întreg | 8 970–10 485 de semne cu tot cu antet, titluri și calendar |

⚠️ **CORPUL E 15 pt, NU 12.** Interlinia de 16.5 pt ademenește spre „12 pt cu 1.38" — și atunci
socoteala dă 45 de semne pe rând în loc de 37, adică **un articol întreg în plus** față de ce încape.
Mărimea s-a citit din PDF (`pdftohtml -xml`: 23 px la scara 1.5) și s-a probat numărând semnele pe
randare. Dacă cineva „îndreaptă" cifra asta, probele din `tests/buletin-socoteala.test.ts` cad.

**Anatomia foii** (din numerele 613–615, unde se vede și varianta cu secundar):
- **pagina 1**: crucea + „BULETINUL PAROHIEI" + parohia (antet fix, Trajan), **motto** pe două
  rânduri cursive cu cel citat dedesubt, linia cu pastila **„Nr. 615 / 6 septembrie 2026"**. Apoi
  coloana întâi: **poza mare** (o coloană pe 448 pt) și **zona neagră** cu numele autorului, anii și
  pomenirea, scris alb, centrat (din 19.09.2026, `autor` cu ` / ` scoate ce e înaintea barei pe un
  **rând mic deasupra numelui**, Trajan 12 pt: „SFÂNTUL CUVIOS MĂRTURISITOR / SOFIAN de la ANTIM");
  coloana a doua: **titlul** articolului, **semnătura** (dacă e) și începutul textului;
- **paginile 2–3**: patru coloane de text justificat;
- **pagina 4**: textul se termină, „Sursa: …" cu linie deasupra, apoi **PROGRAMUL LITURGIC** cu
  tabelul programului și **subsolul fix** (abonarea + adresa parohiei, al doilea rând **aldin** din
  18.09.2026). Deasupra capului, floarea, cu **0.5 cm** până la el (18.09.2026; capul e **24 pt** —
  18 → 20 → 24, două cereri în aceeași zi).

**MARCAJELE DE TEXT — convenția din 19.09.2026** (`apps/buletin/src/marcaje.ts`), valabilă peste
**toată foaia**: titlu, semnătură, text, sursă, motto, notă.
- `_între linii joase_` = **cursiv**, `*între steluțe*` = **aldin**, amândouă = aldin cursiv.
- ⚠️ **Convenția veche „steluțe = cursiv" e ABROGATĂ** (până pe 19.09 `*…*` scotea cursiv, iar `**…**`
  tot cursiv). Regula e prudentă: se aplică numai la perechi limpezi, ca să nu strice un asterisc
  scris de om; marcajul se pune **după escapare**.
- **Trajan Bold se încorporează în PDF doar când vreun titlu are aldin** (+211 KB, altfel degeaba);
  cursivul în titlu e **oblic sintetic**, fiindcă Trajan n-are italic.
- **`/` = rând nou** în titlu și în semnătură. ⚠️ `randNou` se aplică **înaintea** lui `marcaj` —
  invers, `</b>` se rupea în două.
- `textCurat()` scoate marcajele din textul dus în arhivă (arhiva nu poartă sintaxa).
- ⚠️ La curgere, `CURGE` tăia paragraful cu `textContent` și **pierdea tagurile** la hotarul de
  coloană — reparat în 0.15.0; cine atinge curgerea să nu se întoarcă la `textContent`.

**`semnatura` — rândul de sub titlu** (câmp nou, 19.09.2026, cerere user: „Text de: Părintele Mihail
Stanciu…"): Caladea **15 pt aldin, centrat**, sub titlu, la principal și la secundari, cu acțiune în
hartă (cuvântul „semnatura" i-a fost mutat de la `autor`; regula INGHITE: semnătura înghite
titlu/text). **Intră în `INALTIMI`**, deci în socoteală. Nu-l confunda cu `nota`, care iese la baza
articolului (Carlito 13, ne-aldin).

**`sursa` cu înțeles** (19.09.2026): `*între steluțe*` = aldin cursiv (numele cărții), domeniul/URL-ul
= **aldin**, restul normal; **fără niciun marcaj rămâne toată aldină**, ca înainte. ⚠️ Se taie la
**200 de semne**. Arhiva locală are doar 615 pentru verificat forma — 610–614 sunt numai în R2, deci
convenția nu e încă validată pe un număr cu carte.

**Trei lucruri care se încalcă ușor:**

⚠️⚠️ **JOSUL PAGINII A PATRA NU ARE VOIE SĂ FIE `position: absolute`** (18.09.2026): un tabel dintr-o
cutie absolută **pierde ultimul rând** în Chromium — tabelul își socotește înălțimea fără el, subsolul
urcă peste el și calendarul iese pe hârtie retezat, fără linia de jos. De aceea `.pagina.ultima` e o
cutie **flex** cu `justify-content: flex-end`, iar `.jos` stă în flux, împins la talpă cu marginile lui.
Nu-l muta înapoi „ca la celelalte piese" — celelalte (chenar, coloane) n-au tabel în ele. Amănuntele
și cum s-a scos din cauze: jurnalul din 18.09.2026.

⚠️ **CURGEREA O FACEM NOI, ÎN PAGINĂ** (scriptul din `foaie.ts`), nu CSS-ul: cutiile au înălțimi
diferite (coloana întâi a paginii întâi e plină de poză, cele de pe pagina a patra sunt scurtate de
calendar), iar `column-count` nu curge între pagini separate. Câștigul al doilea e mai important
decât primul: **știm câte semne au intrat cu adevărat** și le scriem în `data-raport`, de unde le ia
`pdfCuRaport` (nou în `@xc/ui`). Dacă a rămas text pe dinafară, numărul **nu se dă drept bun**.
Două capcane măsurate: `scrollHeight` nu coboară niciodată sub `clientHeight` (deci o coloană goală
pare plină), iar `offsetTop/offsetHeight` se rotunjesc la pixel și peste 45 de rânduri sfertul adunat
**taie ultimul rând pe hârtie** — de aceea se măsoară cu `getBoundingClientRect`.

⚠️ **CALENDARUL SE CERE DE LA PROGRAM, nu se desenează în buletin**: `GET /v1/tabel-tipar?data=…`
(Service Binding `PROGRAM`), care întoarce `{ tabel, stil, slujbe, detalii }`. În program s-au scos
din `foaieHtml` două piese refolosibile — `tabelProgram()` și `stilTabel(cuVariabile)` — fără nicio
schimbare de randare (probat: HTML identic, 0 pixeli diferență).
⚠️ **POARTA S-A SCHIMBAT la 17.09.2026, 22:47** (user: „să se folosească fără probleme programul propus
dacă nu este validat — deci ce e disponibil — doar trebuie atrasă atenția la început PROPUS"). Până
atunci o săptămână nevalidată nu dădea tabel. Acum `tabelulSaptamanii` (program, `hartii.ts`) dă
săptămâna VALIDATĂ dacă e; altfel **ce e disponibil** — rândurile din bază (stare „propus") ori
propunerea din istoric, aceeași sursă ca pagina și poza săptămânii (`saptamanaOriPropunere`) — și
răspunde cu **`stare: 'validat' | 'propus'`**. **Foaia de pe ușă (`/v1/foaie`) NU s-a schimbat**: ea
rămâne numai a săptămânilor validate. Buletinul poartă starea mai departe: `Calendar.stare`,
`Compus.atentie[]` (ce nu oprește, dar se spune LA ÎNCEPUT), câmpul `program` din `buletin.compune`,
chenarul roșu „PROPUS." de deasupra formularului din `/nou`. `null` la calendar înseamnă de acum
„programul n-a răspuns deloc", nu „nevalidat".
⚠️ `stilTabel(true)` **numai pentru cine pune tabelul în pagina lui**: variabilele scrise pe tabel ar
bate `--f`-ul coborât de scriptul de potrivire al foii programului.
⚠️ **Se cere ziua de A DOUA ZI după numărul buletinului**: nr. 615, datat 6 septembrie, poartă
programul pentru 7–13 septembrie. Greșeala se vede abia pe hârtie, în 60 de exemplare.

⚠️ **SOCOTEALA REFUZĂ, NU TAIE** (hotărârea userului, 17.09.2026): `masuri.ts` spune câte semne
încap pe fiecare articol și cu cât s-a trecut peste; compunerea se oprește cu cifrele alea. Socoteala
e **aritmetică, fără browser** (un model care întreabă „cât scriu?" trebuie să afle în milisecunde),
iar adevărul îl dă tot randarea. Prezice puțin **mai puțin** decât încape — 9028 față de 9053 —, ceea
ce e direcția bună de greșit.

**Pentru modelul de limbaj** (cerere user: „un sistem care poate lucra cu un AI la final, nu foarte
deștept, dar cu rezultate foarte bune, cum am făcut la Programul liturgic") — `apps/buletin/src/actiuni.ts`:
- **`buletin.masura`** e cunoștință de **FUNDAL**: modelul știe câte semne încap înainte să scrie,
  fără să ceară. Un model mic nu întreabă „cât să scriu?" — scrie;
- **`buletin.socoteala`** răspunde în cifre („mai ai loc pentru 812 semne"), nu în vorbe;
- **`buletin.compune`** (`bulletin.write`) refuză cu cifra exactă cu care trebuie scurtat, deci
  modelul are ce corecta la a doua încercare.

**Hotărârile din a doua rundă (17.09.2026, 21:38–22:00)**, toate ale userului:
- **REGULA COLOANEI ÎNTÂI**: pe pagina 1, coloana din stânga ține **doar poza și zona neagră** —
  niciodată text („asta e regula generală"). Poza umple ce rămâne; fără poză stă un **placeholder**
  desenat. De aceea socoteala are **trei** variante (1 autor / +1 / +2), nu patru: „fără poză" nu
  există ca variantă.
- **Titlul foii: MAJUSCULE, Trajan Pro 3 Regular** (fără aldin, user 17.09.2026 seara). Parohia sub el
  a crescut la 11 pt. **Titlul secundarilor: Trajan Pro 3 Bold adevărat** (din 17.09.2026 seara — până
  atunci aldin sintetic + contur, fiindcă aveam doar un Regular extras dintr-un PDF); cel al
  principalului, pe pagina 1, e Regular, mai mare (21 pt) și stă cu 9 mm sub pastilă, cum e pe hârtie.
  Fonturile: `resurse/TrajanPro3-Regular.otf` = Adobe original v1.012 (cu kerning), `TrajanPro3-Bold.otf`
  din familia trimisă de user (abonament Adobe). Restul familiei (Black…SemiBold) nu e în repo.
  ⚠️ **Înălțimea titlului se MĂSOARĂ, nu se presupune** (19.09.2026): `INALTIMI.titlu` era constanta
  4.4 („două rânduri") și de acolo venea „socoteala zice că încap, hârtia nu" la titluri lungi. Acum
  e **`max(4.4, geometria din font)`**, cu lățimile Trajanului citite din fișierul fontului
  (`unelte/masura-trajan.mjs`): un titlu de 28 de semne = 2 rânduri ≈ 60 de semne.
- **Calendarul strâns, treaptă cu treaptă**: `/v1/tabel-tipar?strans=1` fără sfinții duminicii,
  `strans=2` și fără pericopă („în extremis"). `compune` încearcă 0 → 1 → 2 și se oprește la prima
  care încape; răspunsul spune ce treaptă a folosit. Sărbătoarea zilei rămâne la orice treaptă.
  ⚠️ **Din 19.09.2026 scara e altfel — `CEDARILE` din `compune.ts`, CUMULATIV** (user: „să dispară
  floricica și dacă nici așa nu intră să dispară sfinții din calendar"): `(floare, 0) → (fără floare,
  0) → (fără floare, 1) → (fără floare, 2)`. **Floarea e acum ÎN scară**, prima care cade (înainte
  trăia pe dinafara ei). Scara e una singură, comună **socotelii și randării**: când randarea dă
  deficit, treapta se alege prin aritmetică (floarea ≈ 212 semne, `strans=1` +230, `strans=2` +171)
  și se randează **o singură dată în plus** (cel mult două randări), apoi se refuză cu cifra nouă.
  Pază de ținut minte: o treaptă fără tabel era socotită drept pagină goală → ieșea foaie fără
  program. Deschis: fiind cumulativă, floarea **nu se mai întoarce** la `strans=1`.
  ⚠️ Pericopa vine din program **pe UN rând** („Ap. …; Ev. …; glas 6, voscr. 4") — rândurile
  separate erau doar în datele mele de probă. `PERICOPA` prinde acum și rândul care începe cu „glas".
- **Golul de deasupra calendarului: 6 mm normal, 3 mm la nevoie** („minim cum e acum și dublu în
  mod normal") — scriptul curge o dată cu 6, și numai dacă a rămas text pe dinafară reia cu 3.
- **Floarea** a venit de la user (poză pe Slack) → `resurse/floare.png`, 44 mm lată, cade prima când
  nu e loc — din 19.09.2026 **ca treaptă în `CEDARILE`**, nu doar când pagina a patra n-are loc fizic.
- `nota` (mențiunea de deasupra sursei) și `*cursiv*` (singurul marcaj din text, aplicat după
  escapare). ⚠️ **Marcajul s-a schimbat pe 19.09.2026** — vezi „MARCAJELE DE TEXT" mai sus: acum
  `_cursiv_` / `*aldin*`, peste toată foaia.
- **`buletin.reguli`** — acțiune de fundal cu regulile foii în cuvinte, pentru „un AI simplu care să
  înlocuiască un text, să ceară ceva, să citească niște reguli" (componentele numărului, ce nu are
  voie, ce face când nu încape).

**Proba de fidelitate — nr. 615 refăcut numai prin API** (`proba-foaie.mjs --cerere cerere.json
--original 615.pdf`, cererea păstrată la `tmp/cerere-615.json` în spațiul agentului): textul scos din
PDF **n-avea diacritice** (fontul Cambria din PDF n-are hartă Unicode) — puse la loc după articolul-sursă
(basilica.ro, doxologia.ro), cuvânt cu cuvânt, cu 2 negăsite din ~1 400. Rezultatul: 8 886 de semne,
0 pe dinafară, 7 coloane, gol 6 mm; pagină cu pagină aproape identic cu originalul. **Rămâne mai
dens** decât Word-ul: al nostru termină textul cu vreo 15 rânduri mai sus pe pagina 4 (pagina 1 ține
mai mult text sub titlu). Comparațiile sunt în `outputs/615-comparatie-pagina-*.png`.

**Ecranul `/nou`** are acum formularul (motto, principalul, până la doi secundari) și
**socoteala care merge odată cu scrisul**, sub fiecare câmp de text, din aceleași cifre ca la server.
⚠️ **Chenarul gol a ieșit** — locul lui l-a luat formularul. Capul paginii rămâne neatins (eticheta
verde „Numărul următor", numărul roșu = ultimul din arhivă + 1, duminica lui).

**Cele cinci reguli din 17.09.2026, 22:47** (user, un singur mesaj; buletin 0.6.0 + program 0.7.9):
- **Nr. și data NU se editează**: nu mai sunt câmpuri în formular — nici ascunse. Serverul le ia din
  arhivă (`buletinulNou`: ultimul + 1, duminica următoare), nu din ce a trimis browserul.
- **Motto-ul vine PRECOMPLETAT cu cel al numărului trecut** (`mottoDinainte`, `compune.ts`): întâi din
  **cererea păstrată** a celui mai nou număr compus aici — la fiecare compunere, cererea (ce a scris
  omul, NU umplerea de probă) se pune ca JSON sub **`compus/<an>/buletin-<nr>-<data>.json`**, lângă
  PDF; dacă arhiva e mai nouă decât ce s-a compus, din **textul PDF-ului** numărului din arhivă
  (`mottoDinText`, `depozit.ts`: citatul stă între parohie și pastilă, în ghilimele românești, cu cel
  citat după linie; sedilele Word-ului ş/ţ se aduc la ș/ț). Ce a scris omul în câmp bate precompletarea.
- **Un articol gol NU e greșeală — se umple cu text de probă LA VEDERE** (`umplere.ts`): „NUME AUTOR"
  (+ „1999-1999" — anii de probă vin NUMAI cu autorul de probă), „TITLU ARTICOL", Lorem ipsum,
  „Sursa: -"; poza lipsă are locul ei desenat, ca înainte. `plangeriDeForma` nu se mai plânge de
  câmpuri goale (rămân: nr, data, mai mult de doi secundari); în `buletin.compune` autor/titlu/text
  sunt opționale. Răspunsul spune în `atentie` ce a fost de probă. Sub câmpul gol, socoteala din
  pagină scrie „Gol: intră text de probă (Lorem ipsum), ~N de semne".
- **Cât text de probă: exact cât încape la programul ÎNTREG** (treapta 0, nu strâns): un secundar o
  pătrime din tot textul, doi secundari 1/4 + 1/4 = jumătate, principalul restul — e chiar împărțeala
  din `socoteste` (`max(cât cere, ⌊total/4⌋)`), deci un secundar SCRIS mai lung își ține lungimea.
  Umplerea e în doi pași (capetele întâi, fiindcă „Sursa: -" și zona neagră mănâncă rânduri; textul pe
  urmă, la socoteala refăcută). „Când e text real și e prea mult, apelăm la variante restrânse de
  program" — adică strângerea calendarului rămâne pentru textul adevărat, ca până acum.
- ⚠️ **LOREM IPSUM E MAI LAT DECÂT ROMÂNA**: la măsura socotelii (36,67 semne/rând, măsurată pe text
  românesc) proba a dat **106 semne pe dinafară** și golul de deasupra calendarului strâns la 3 mm —
  cuvintele latinești lungi țin mai puțin pe un rând justificat. `LOREM_FATA_DE_ROMANA = 0.975`,
  probat pe randare: la 0, 1 și 2 secundari intră fix, 0 pe dinafară, gol 6 mm (`proba-foaie.mjs --gol
  [--secundari n]`, unealta are de acum și proba numărului gol). Probele: `tests/buletin-umplere.test.ts`.

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

### Cum aduci local tot ce e online (17.09.2026)

```
docker exec biserica-platforma-v2 sh -lc 'cd /workspace && node infrastructure/import/adu-local.mjs'
# socoteală: câte obiecte și câți octeți are fiecare bază/depozit online. Nu scrie nimic.
pkill -f "wrangler.js dev"                       # ⚠️ dev-ul ține aceleași fișiere de stare
node infrastructure/import/adu-local.mjs --chiar  # (--doar buletin | --fara-r2 | --si-grele)
set -a; . /backup/_setup/cloudflare.env; set +a; pnpm dev &   # abia repornit vede datele noi
```

Bazele D1 se **rescriu întregi** (baza locală se golește întâi), depozitele R2 se completează
obiect cu obiect — ce e deja local cu aceeași mărime se sare, deci o rulare întreruptă se reia
fără să coste de două ori. Unealta **nu scrie niciodată în producție**: spre Cloudflare pleacă
numai GET-uri. Capcanele (SQLITE_TOOBIG, cheile străine, cele 3 s/obiect ale lui `wrangler r2
object put`, `biserica-transmisiuni` de 33 GB) sunt scrise în jurnal, la 17.09.2026.

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

### 2026-09-19

**Varianta zero a buletinului + butonul „Compune numărul" + confirmarea din bulă care nu mai atârnă** (00:50–01:30, mod auto, subagent). Cererea userului: „la prima accesare a /nou să se genereze varianta cu «text» la conținut… toate câmpurile să aibă ceva implicit ca să poți genera varianta 0… un buton manual în pagină… acum nu merg să-i zici să-l compună, tot aștept și nu răspunde".

- **Schița implicită** (`schita.ts` → `schitaImplicita()`): la prima privire pe `/nou` schița se naște cu autor/ani/titlu/sursă de probă și **`text: "text"`** (literal, cum a cerut) și se scrie în R2 (`schitaPastrata`). Pomenirea, mențiunea și poza rămân nescrise dinadins (lipsesc și din numere adevărate; o adresă de poză inventată ar lăsa un pătrat gol). `umplere.ts` are `TEXT_IMPLICIT` + `eDeProba(v)`: un câmp cu valoarea de probă e „doar locul lui" → se umple cu Lorem după regulile din 17.09. `catreCerere` scoate placeholderele la graniță (nu ajung pe hârtie, nici în `compus/*.json`); `rezumatulSchitei` nu le dă drept răspunsuri; `autorPropus('text')` → `null`. Cârligul de fișiere din `index.ts` folosea `!articol.text` — cu placeholderul devenea fals, deci primul .docx n-ar mai fi intrat în schiță; acum `eDeProba`. `de_la_capat` golește de tot (ștergere cerută de om), numărul rămâne compozabil.
- **`POST /nou/compune`** (`index.ts`): aceeași `compuneNumarul()` (extrasă din `actiuni.ts`, singurul loc care compune) ca acțiunea din chat; poarta = adminul buletinului, CSRF global, audit. Butonul „Compune numărul" (`pagini.ts` → `JS_COMPUNE`, `stil.ts` → `.compunerea`) stă SUB blocul `#schita` (în afara lui, ca să nu fie înlocuit din chat); cât compune e stins cu „se compune…", la izbândă reîncarcă, la refuzul socotelii scrie plângerile cu cifra. **Compunere asincronă la prima intrare**: pagina vine îndată cu `data-auto` pe buton și el trage singur POST-ul — în GET, `/nou` ar fi stat alb un minut (Browser Rendering), iar o randare căzută ar fi însemnat un ecran care nu se mai deschide. Auto doar dacă nu există foaie ȘI schița e neatinsă (`eSchitaNeatinsa`). Închide **NEXT 00d**.
- **De ce „compune" din chat nu răspundea**: `buletin.compune` are `efect: 'scrie'` → propunere Da/Nu; la „Da", `raspunde()` din `packages/chat/src/bula.ts` era UN fetch la `/chat/confirma`, fără ceas, fără sondare; `/confirma` din chat-worker execută acțiunea sincron pe conexiunea bulei, iar randarea (20+8+20 s/pagină) trece de un minut → conexiunea cade, butoane moarte, zero cuvinte. Aceeași boală reparată pe `/mesaj` pe 18.09 (comentariul din `chat-worker/src/index.ts`), dar `/confirma` rămăsese pe drumul vechi. NU era modelul: KV `modul:chat:buletin` oferă unealta. Reparat aditiv: `/stare?propunere=<id>` întoarce `propunereStare`; `raspunde()` are ceas + „renunț" și sondează în paralel cu cererea; cine răspunde primul închide. **Nefăcut**: `/confirma` asincron cu `waitUntil` (leacul adevărat, ca la `/mesaj`) — schimbare în codul comun al tuturor bulelor, lăsată pentru zi. Celelalte aplicații cu bulă poartă `raspunde()` vechi până la republicare.
- Probe: `tests/buletin-chestionar.test.ts` (nou), `buletin-umplere`, `buletin-chat`, `chat-asincron` — 851/851. Publicat: buletin **0.11.0**, chat-worker **0.5.2**, `@xc/chat` 0.3.2. Commit `80890bb`, nepushuit. Neprobat cap-coadă ca admin: prima intrare a userului pe `/nou` e prima randare adevărată a variantei zero.

**Harta cu două nivele — „altă abordare cu AI-ul free"** (user, 11:30: un cuprins cu subiecte → acțiuni → confirmare; „cu o hartă așa simplă ar trebui să pot lucra și fără AI"; la ambele nivele „nu înțeleg" e răspuns legitim, iar „nu sunt sigur" se întoarce ca întrebare). Publicată la 12:25: buletin **0.12.0**, chat-worker **0.6.0**, `@xc/chat` 0.4.0, commit `d639818`.

- Harta stă în **manifest** (`Manifest.harta`, `modulActiuni({harta})`) — aplicațiile fără hartă nu simt nimic. Drumul: potrivitor **determinist** (`apps/buletin/src/harta.ts`) → model N1/N2 (JSON strict, `services/chat-worker/src/harta.ts`) → confirmare. Subiectele: motto, principal, s1, s2, numar, program, fiecare cu acțiunile lui; confirmarea se cere la **instrucțiunile libere**, nu la răspunsul dat unei întrebări pendinte. În bulă, butoane cu opțiuni; **`meniu` = drumul întreg fără AI**. `Actiune.ascunsa` (nou) = cerabilă din cod, nevăzută de model și de Setări.
- **Contorul determinist/model**: `GET /chat/stare?statistica=buletin` — cifra din care userul hotărăște dacă mai rămâne AI-ul deloc. Ciorna lui 616 a fost ștearsă din R2 la cererea lui (4 chei), ca proba să fie pe curat. Deschis: **`creier: fara` scurtcircuitează ÎNAINTE de hartă**; contorul e cumulativ, fără resetare; probele vechi `chat-fisiere`/`chat-text-lung` mutate pe `nota` (purtare schimbată anume).

**„Am modificat programul și nu mi-l citește" — NU era cache** (14:20). Service Binding + SELECT-uri proaspete la fiecare compunere; auditul a dat altă poveste: compunere izbutită la 10:47 UTC, programul schimbat la 10:54 (Sf. Maslu marți 22, 18:00), iar compunerea de la 10:55 a **eșuat** (`summary_json` gol, cauza neștiută; textul e la muchie — 9108 semne la ~9178 capacitate), deci pe ecran a rămas foaia veche, fără niciun semn că e veche. Hotărârea userului: „un flag pentru dată, nu regenerare automată". Făcut: `/v1/tabel-tipar` dă `amprenta` (peste tabelul întreg + stare, aceeași la strans 0/1/2) și `modificat_la` (MAX peste `saptamani.modificat`/`slujbe.modificat`); buletinul ține programul folosit în `compus/*.json`, iar `/nou` arată chenarul **„programul s-a schimbat de la ultima compunere"** lângă butonul Compune; `?v=` = etag PDF + amprenta programului; spre program se cere cu `cache-control: no-cache` (ruta publică stă la muchie 300 s). program **0.9.3**, buletin **0.12.1**, commit `a26a465`. ⚠️ Semnul se aprinde abia de la prima compunere izbutită de acum încolo — 616 n-are `program` în `compus`.

**„Am schimbat titlul, am dat compune, nicio modificare" — foaia refuza PE DREPT, dar refuzul nu ajungea la om** (16:10). Titlul urcat de la 8 la 28 de semne peste un text deja la limită = 64 de semne pe dinafară la randare. Refuzul se pierdea pe toate drumurile: chat-worker `/confirma` zicea „Gata." pe `r.ok` (acțiunea a mers — nu lumea s-a schimbat), butonul scria refuzul cu `.rau` nestilat (gri, ca un rând nevinovat), iar `semne_pe_dinafara` ieșea `null`. Reparat: cârligul `raportul`/`RaportFapta` în `@xc/actiuni` (un refuz cuminte se scrie `failure` în audit), `/confirma` întoarce vorba refuzului + propunere „refuzata" + `ok:false`, chenar roșu la buton, `vorbaRefuzului()` comună. buletin **0.12.3** (`0697f96`), chat-worker **0.6.1**.

- Găsit pe drum: la „3 posibile titluri" omul a scris **„Niciunul"** și modelul mic l-a pus drept TITLU — a ajuns în PDF la 11:06 UTC. Reparat determinist: `refuz.ts` (`CUVINTE_DE_REFUZ`, `eRefuz`), prins în hartă + plasă în `scrieRaspuns`, cu steagul `numit` (sintaxa strictă `titlu: Niciunul` rămâne valoare, pentru cine chiar o vrea). buletin **0.12.4** (`4173533`), 930/930. ⚠️ Neprins încă: „altul: X" cu text după.

**„Să dispară floricica și dacă nici așa nu intră să dispară sfinții din calendar"** (user, 16:55). Până atunci treptele (`strans` 0→1→2) trăiau DOAR în socoteală, floarea nu era în scară deloc (cădea numai când pagina a patra n-avea loc fizic), iar refuzul venit din randare nu mai încerca nimic. Acum `CEDARILE` din `compune.ts` e o **scară cumulativă** — `(floare, 0) → (fără floare, 0) → (fără floare, 1) → (fără floare, 2)` — comună socotelii și randării; când randarea dă deficit, treapta se alege prin aritmetică (floarea ≈ 212 semne, `strans=1` +230, `strans=2` +171) și se randează **o singură dată în plus** (cel mult două randări), apoi se refuză cu cifra nouă. Pază găsită pe drum: o treaptă fără tabel era socotită drept pagină goală → ar fi ieșit foaie fără program.

- În aceeași rundă, `INALTIMI.titlu` a încetat să fie constanta 4.4 („două rânduri") și a devenit **`max(4.4, geometria din font)`**, cu lățimile Trajanului citite din fișierul fontului (`unelte/masura-trajan.mjs`): titlul de 28 de semne = 2 rânduri ≈ 60 de semne, exact cele 64 găsite mai devreme. De aici venea „socoteala zice că încap, hârtia nu" la titluri lungi. buletin **0.13.0**, commit-uri `b28dc06` + `c2ae49c`, 954/954. Neprobat viu cu Browser Rendering pe 616. Deschis: floarea nu se mai întoarce la `strans=1` (scara e cumulativă) — de confirmat cu userul; mesajul cedării e trecător pe ecran (îl păstrează doar bula).

**Rândul de sub titlu — câmpul `semnatura`** (17:25–17:50). Întrebarea userului: cum cere prin chat un rând „Text de: Părintele Mihail Stanciu…" sub titlul articolului principal, aldin, la mărimea corpului. Verificat: articolul avea doar `autor/ani/pomenire/titlu/text/sursa/nota/poza`; `nota` iese la baza articolului (Carlito 13, ne-aldin), iar textul avea un singur marcaj, `*cursiv*` (`**` ieșea tot cursiv, nu aldin) — deci NU se putea. Propus și acceptat un câmp nou. Trei schimbări, toate publicate în producție (buletin **0.13.1** → **0.14.0** → **0.14.1**, commit-uri `2a1a49c`, `dcd2e4d`, `fd938aa`; 973/973):

- **`autor` cu ` / `**: ce stă înaintea barei iese pe un rând mic (Trajan 12 pt) deasupra numelui, în zona neagră — cererea era „SFÂNTUL CUVIOS MĂRTURISITOR / SOFIAN de la ANTIM";
- **`semnatura`** — câmp nou sub titlu, Caladea 15 pt aldin centrat, la principal și la secundari, cu acțiune în hartă (cuvântul „semnatura" mutat de la `autor`; regula INGHITE: semnătura înghite titlu/text). Intră în `INALTIMI`, deci în socoteală;
- **`sursa`** cu înțeles: `*între steluțe*` = aldin cursiv (numele cărții), domeniul/URL-ul = aldin, restul normal; fără niciun marcaj rămâne toată aldină, ca înainte.
- ⚠️ Arhiva locală are doar 615 pentru verificat forma sursei — **610–614 sunt doar în R2**, deci convenția nu e validată pe un număr cu carte. Capcane strânse aici: **`--env staging` nu mai există** (comanda veche pică); o frază cu **mai mult de 5 cuvinte în stânga lui `:`** cade pe ramura „ce scriu?" (`harta.ts:545`); `sursa` se taie la **200 de semne**.

**Meniul cu ton de meniu + marcajele peste toată foaia** (18:35; patru runde, toate publicate în producție: buletin **0.14.2** → **0.15.1**, chat-worker **0.6.2**; commit-uri `5345c74`, `b6181a0`, `ad34dac`; 997/997).

- **„Vreau un meniu"** — exista deja (meniu → subiecte → acțiuni → valoare, tot determinist), dar treapta a doua suna a eroare: „Nu știu ce să fac cu…". Acum răspunde ca un meniu — „Articolul principal. Ce vrei să faci?" —, are buton **„← Înapoi la meniu"** și înțelege `inapoi`, `meniul`, `ce subiecte ai`. (buletin 0.14.2 + chat-worker 0.6.2)
- **Convenție NOUĂ de marcaje, peste TOATĂ foaia** (fișier nou `marcaje.ts`): `_cursiv_`, `*aldin*`, împreună = aldin cursiv — în titlu, semnătură, text, sursă, motto, notă. **Convenția veche „steluțe = cursiv" e abrogată.** Trajan Bold se încorporează în PDF **doar când vreun titlu are aldin** (+211 KB, altfel degeaba); cursivul în titlu e oblic sintetic (Trajan n-are italic). Bug vechi reparat pe drum: `CURGE` tăia paragraful cu `textContent` și pierdea tagurile la hotarul de coloană. (buletin 0.15.0)
- **`/` = rând nou** în titlu și în semnătură (`randNou` se aplică ÎNAINTEA lui `marcaj`, altfel `</b>` se rupea în două); `textCurat()` scoate marcajele din textul dus în arhivă. (buletin 0.15.1)
- ⚠️ Capcane noi de build: `*/` într-un comentariu de bloc închide comentariul (esbuild cade), iar accentele grave dintr-un CSS scris în template literal fac același lucru. Deschis: `despre` din hartă e prea lung în textul meniului (propus un câmp separat `numit`).

**CURĂȚENIA — s-a întors „intrarea fantomă", dar îngustă: doar numele, doar calendarul** (curatenie **0.3.0**, publicat în producție). Cererea userului, cuvânt cu cuvânt: „păstrăm intrarea fantomă doar cu numele (ex.: Mihai P.) și astfel pre-logat un om poate face rezervări în calendar. Dacă vrea acces în platformă trebuie să intre pe Cont normal. Dacă ești deja în platformă ca utilizator să nu mai fie selecția fantomă deloc".

- **Cum se recunoaște**: cookie `curatenie_voluntar` (id-ul voluntarului), pus de `POST /alege`, șters de `POST /iesi` (ambele cu jeton CSRF; GET-ul pe `/alege` întoarce 303 spre `/`). `identitate.ts` ține `puneFantoma` / `uitaFantoma` / `voluntarulFantoma`.
- **Poarta e în `api.ts`, nu în interfață** (cine trimite formularul de mână ajunge tot acolo): `ACTIUNI_FANTOMA = new Set(["toggle_slot"])`, iar `if (cine.fantoma && !ACTIUNI_FANTOMA.has(action)) return fail(INTRA_IN_CONT, 403)`. Tot acolo: `isAdmin = cine.eAdmin && !cine.fantoma` și `with_stats` **refuzat** fantomei (vederea de arhivă cu statistica de participare rămâne a conturilor).
- **Antetul rămâne de NEINTRAT** — un singur fel de „cine sunt" în platformă, contul. Fantoma se arată doar în pagină: rândul „Ești Mihai P. · Nu ești tu?" pe slotul personal (POST cu jeton, nu legătură GET), iar pickerul V1 (`#pickerFantoma`, clasa `picker-list`, markup neschimbat din V1 — s-a schimbat doar înțelesul) stă deasupra calendarului.
- **Dispare la omul cu cont**: cine are sesiune adevărată nu vede pickerul deloc și cookie-ul i se șterge; la fel dacă rândul lui a dispărut din listă. Cookie-ul e **nesemnat dinadins** — nu deschide nimic ce nu se poate face oricum apăsând pe un slot.
- **Abatere de la structura mare, asumată de user**: un cookie de om și scriere în date fără să treacă prin permisiunea centrală (authz). Aceeași alegere o făcuse pe 13.09, răsturnată pe 14.09 (voluntarii = conturi); acum se întoarce, dar strâmtată la o singură acțiune.
- Texte noi față de V1: „Cine ești?" (titlul pickerului) și fraza din fereastra „mod vizualizare" — „…trebuie să-ți alegi numele din lista de sus — ori să intri cu contul parohiei, dacă vrei și restul aplicației".
- Probe: `tests/curatenie-fantoma.test.ts` (nou, 16 probe), typecheck curat, 1013/1013 la vitest. Publicare în producție: `xc-curatenie-production`, Version ID `6e466358-a189-4bbf-9d2c-dbcc2cf0b21f`; verificat pe viu că `/` scoate `pickerFantoma`, `picker-list` și `0.3.0` în subsol. Commit `085728b`.

**CURĂȚENIA — meniul de cont ca la toate aplicațiile; administrarea devine Setări** (curatenie **0.4.0**, publicat în producție). Cererea userului, cuvânt cu cuvânt: „Meniul de cont trebuie să se vadă ca la celelalte aplicații. Cele 3 butoane dispar din zona de meniu — administrarea devine setări".

- **Rândul de unelte a ieșit din ambele pagini** — „Intră · Contul meu · Administrare" nu mai există nici ca funcție (`unelte()`), nici ca slot `unelte` al carcasei. Curățenia poartă acum exact meniul de cont al celorlalte aplicații, fără adaos propriu. A ieșit și **panoul de intrare din pagină** (`#authPanel`): „Intră" din fereastra „mod vizualizare" și `?intra=1` duc la **intrarea platformei**, nu la un formular local.
- **Panoul de administrare e RUBRICĂ în `/setari`**, prin cârligul `rubrici` din `@xc/setari`, arătat doar celui cu `cleaning.manage`: titlu „Echipa și rapoartele", filele Voluntari / Newsletter / Mesaje de sistem. `GET /admin[?tab]` → **303 spre `/setari[?tab]`**. Scrierile au rămas pe `POST /admin?tab=` (cu `action` injectat pe formulare, `scriePanou`) și se întorc în `/setari?tab=`; **CSRF-ul e cel al paginii Setărilor**. `/admin/faq` și `/admin/curatare-arhiva` rămân pagini de sine stătătoare, cu „Înapoi" la Setări.
- Cod mort scos în aceeași trecere: `cereAdmin`/`adminAuthed`, CSS-ul `.auth-close`, `.btn-platforma`, `.picker-last*`.
- Probe: `tests/curatenie-setari.test.ts` (nou, 7 probe), `tests/curatenie-fantoma.test.ts` adaptat; **1020/1020** la vitest.
- Publicare în producție: `xc-curatenie-production`, Version ID `e5af0bf3-87d8-4c28-866b-ce9e8d17340b`. Verificat pe viu, doar GET: `/` scoate `pickerFantoma` (×3) și `0.4.0`, iar `btnAutentificare`/`authPanel`/„Contul meu" **nu apar deloc**; `/admin?tab=alert` → 303 `https://cont.sfantul-ilie.ro/intra?spre=…%2Fadmin` (neintrat; **`tab` se pierde la poarta de intrare**, se recapătă doar după autentificare); `/?intra=1` → 303 `https://cont.sfantul-ilie.ro/intra?spre=…%2F`. Commit `4050a99`.
- Deschis: **FAQ-ul adminilor** (`apps/curatenie/src/admin/faq.ts:21`) spune încă, greșit, că bifa Admin nu dă `cleaning.manage`; **titlul rubricii** („Echipa și rapoartele") e de confirmat cu userul.

**Meniul contului la curățenie (CSS V1 mort) + `/setari` rămâne în pagină sub masca „vezi ca", în toate aplicațiile** (curatenie **0.4.1**, `@xc/setari` + 10 aplicații republicate). Cererea userului: „încă se vede ciudat meniul de la Cont… exact ca la Calendar… să pot să modific și vezi ca".

- **Cauza**: două reguli CSS rămase din V1 în `apps/curatenie/src/stil.ts` — `body:not(.cu-platforma) .cont-lista a[href^="https://cont."] {display:none}` și `.cont-lista a.intra-platforma` — tăiau din meniul carcasei **Profil**, **Ieșire** și cele trei rânduri „→ …" ale măștii „vezi ca". Clasa `cu-platforma` nu se mai pune de nicăieri (a plecat cu V1), deci regula lovea mereu: sub mască meniul se golea de tot, iar la poza userului rămâneau doar Setări + Administrare cu două separatoare goale. Scoase amândouă. Tot aici: `/admin` fără sesiune redirectează doar pe `!userId && !veziCa` (sub mască nu mai fugea la Cont).
- **Regula, de acum**: **stilul unei aplicații nu atinge selectoarele carcasei** (antet, meniu, subsol) — ce e de schimbat acolo se schimbă în `@xc/ui`, pentru toate deodată. Curățenia a fost singura care își rescria meniul; de aici și defectul, vizibil doar sub mască.
- **Masca la `/setari`** (`packages/setari/src/index.ts`): pagina nu mai trimite la Cont sub „vezi ca". `UneltleSetarilor.veziCa`, poarta devine `if (!principal && !veziCa)`, sub mască răspunde **200** cu `corpulMastii()` („Un om neintrat n-are setări aici" + cum se iese), iar POST sub mască → **303 `/setari`** (nu scrie nimic). Cele **11 aplicații** transmit `veziCa` la `ruteazaSetari(` (o linie fiecare): biblia, biblioteca, buletin, calendar, curatenie, home, live, newsletter, program, radio, tipic.
- **Principiu confirmat de user**: **Setări = opțiunile specifice aplicației; acolo stau și adminii specifici aplicației.**
- Probe: `tests/curatenie-meniu.test.ts` (8, nou) și `tests/setari-masca.test.ts` (9, nou — inclusiv una structurală: fiecare apel `ruteazaSetari(` poartă `veziCa:`). **1037/1037** la vitest, turbo typecheck **36/36**.
- **Publicat în producție** (11 aplicații, în ordinea: curatenie, calendar, program, tipic, biblia, biblioteca, buletin, newsletter, live, radio, home): curatenie **0.4.1** `92df64e8-d5bf-4355-8514-25c97033dc6a`, calendar **0.8.2** `d46361a7-cd0e-43cc-bfa9-9af2672f77ec`, program **0.9.4** `c7cff306-91bd-49dc-8f26-c2a8d4d034ed`, tipic **0.4.1** `0a65eecf-3a3d-4094-93d9-468d09c6df45`, biblia **0.1.6** `0185a6d4-7643-4a2e-9236-ae108c372fef`, biblioteca **0.1.6** `dac0ae71-eec2-418f-94e8-20597a952d39`, buletin **0.15.3** `042545c2-785c-4ab0-a83f-b8a7a79b77ee`, newsletter **0.6.3** `a6d20ad4-797b-4049-bb41-b5294fefd908`, live **0.1.10** `9a068f83-a212-45f5-8805-d75581cf2837`, radio **0.1.9** `b85c8ea1-321e-4e08-87e2-f85aa9888cae`, home **0.7.6** `4dcb9d88-2081-4c8d-a25d-08f80ef06072`.
- Verificat pe viu, doar GET: toate **11 → 200**, cu versiunea nouă în subsol (home pe `website.sfantul-ilie.ro`); la curățenie `grep -c "cu-platforma"` → **0**, cum se aștepta. Commit `6348ff8`.
- Deschise: **`STIL_ADMIN`** din panoul curățeniei redefinește `.btn` al carcasei (butoanele platformei ies verzi pe `/setari` la admin) — aceeași boală ca regulile scoase azi; **FAQ-ul adminilor** (`admin/faq.ts:21`) încă greșit despre bifa Admin; **titlul rubricii** „Echipa și rapoartele" și **textul măștii** de confirmat cu userul.

**Rândul „Administrare" din meniul contului e NUMAI al super-adminului real** (19:05–19:25; curatenie **0.4.2** + 9 aplicații republicate). Cererea userului: „un admin nu ar trebui să vadă altceva decât Setări" — iar sub masca „→ Administrator" rândul dispare cu totul.

- **Ce s-a schimbat**: o singură linie în `apps/<app>/src/index.ts`, la 10 aplicații (calendar, curatenie, home, biblioteca, biblia, tipic, newsletter, buletin, program, admin). Condiția care hotăra rândul era `sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin')`; acum e `sesiune.roles.some((r) => r.role === 'super-admin')`. Steagul se numește **`eAdminPlatforma`** în cele 9 aplicații și **`eAdmin`** în `apps/admin`. Cheia: se citește **`sesiune.roles`**, adică rolul REAL al omului — nu cheia aplicației și nu rolul luat sub mască (masca doar coboară, deci sub ea rândul nu se mai scrie). În `apps/admin`, `eAdmin` servește DOAR rândul din meniu (`comune(...)` → `cont.admin`); **poarta panoului NU atârnă de el**, ea rămâne pe chei, deci un admin de aplicație intră mai departe pe secțiunea lui, doar că nu i se mai scrie drumul în meniu.
- **`live` și `radio` neatinse dinadins**: acolo rândul duce la panoul emisiei, nu la panoul platformei, și rămâne pe cheia aplicației.
- Probe: `tests/curatenie-meniu.test.ts` **+3** (11 acum), **1040/1040** la vitest, turbo typecheck **36/36**.
- **Publicat în producție** (în ordinea: curatenie, calendar, program, tipic, biblia, biblioteca, buletin, newsletter, home, admin): curatenie **0.4.2** `515269d3-555c-43aa-aa1d-0633a0b735f2`, calendar **0.8.3** `9cc58a26-e750-402e-9661-5bbf9d1481d1`, program **0.9.5** `d208964a-a0e9-4a63-a569-1b5f272ef9ad`, tipic **0.4.2** `a354a95f-7bf6-4fc9-81b3-876baec9cba2`, biblia **0.1.7** `9ec57ddb-f361-4a1b-b84f-bc59d55295b8`, biblioteca **0.1.7** `da6fab0f-2bdf-420f-b282-5c46919245ad`, buletin **0.15.4** `572ad365-5261-413a-8676-517dad8c9780`, newsletter **0.6.4** `2eb7df0d-3290-4c2a-96bc-c56c59a039b6`, home **0.7.7** `344021c5-7b35-4c5a-b489-f0886feb0587`, admin **0.5.1** `eab6462c-8314-4423-b203-cc7bb7901c89`.
- Verificat pe viu, doar GET: 9 din 10 → **200** cu versiunea nouă în subsol (curatenie, calendar, program, tipic, biblia, biblioteca, buletin, newsletter, home pe `website.sfantul-ilie.ro`); `admin.sfantul-ilie.ro/` → **303** `location: https://cont.sfantul-ilie.ro/auth/login` (neintrat — purtarea așteptată, corpul e gol, deci fără versiune de citit).
- Deschise (încă valabile): **`STIL_ADMIN`** din panoul curățeniei redefinește `.btn` al carcasei (butoane verzi pe `/setari` la admin); **FAQ-ul adminilor** (`apps/curatenie/src/admin/faq.ts:21`) încă greșit despre bifa Admin; **titlul rubricii** „Echipa și rapoartele" și **textul măștii** de confirmat cu userul; **`eAdmin`** din `apps/admin` ar merita numele `eSuperAdmin`; **drumul fantomei cap-coadă** n-a fost mers de nimeni pe producție.
- Commit `519a5f8`.

### 2026-09-18

- **ROTIREA ALBUMELOR RADIOULUI** (user, 16:30–17:30: „radioul cântă azi la nesfârșit același album",
  apoi „amândouă" la întrebarea care ceas pornește rotirea). Regula: ceasul sare singur pe alt album,
  la întâmplare, de la prima piesă, apoi la capătul fiecăruia — **pe două ceasuri**, 24 h fără nicio
  comandă de OM **SAU** o oră de liniște în biserică, socotită din `max(ultimul_sunet, ultima_om)`, ca
  o apăsare să ceară din nou o oră întreagă. Odată pornită nu se mai uită la sunet; o oprește numai o
  comandă de om. Făcut: socoteala pură în `apps/live/src/rotire.ts` (+ `tests/rotire.test.ts`), fapta
  în DO-ul `Aparat` (alarma multiplexată în cheia `alarme`, fiindcă un DO are una singură), rândul de
  rotire în `packages/comanda/src/panou.ts`, `sunet`/`rotire` în `packages/contracts/src/live.ts`,
  rândul „Sunet" pe `/mic`. Pe Pi (repo **`biserica-rpi-v2`**): `aparat/sunet.py`, care pune în
  telemetrie `sunet{nivel, varf, prag, ultimul_peste_prag, fereastra_s}` — ⚠️ **pragul e al
  aparatului** (microfonul aude și boxele, deci „liniște" nu e zero); workerul ține `ultimul_sunet` ca
  maxim monoton. **Cererea de la urmă** („să fie deja peste 24h și să înceapă rotirea"): la prima
  atingere a DO-ului contorul se seamănă cu **o zi în urmă** (`contorulDeStart`), deci un radio despre
  care nu știm nicio comandă de om se socotește nepăzit și rotirea e scadentă pe loc; tot acolo, și
  numai acolo, alarma se pune pe `acum` în loc de capătul albumului, ca prima săritură să se vadă în
  ≤20 s de la prima telemetrie de după publicare. 635 de probe, typecheck 36/36. Versiuni: **live
  0.1.8**, **radio 0.1.8** (panoul și contractul s-au schimbat), publicate pe producție.
  **Pragul de sunet, reglat seara la −60 dBFS** (`PRAG_SUNET_DBFS`, `aparat/sunet.py` pe Pi, backup
  `aparat.env.bak-20260918-2024`): biserica **goală** se măsoară la −67.5 dBFS RMS, deci −30 era o
  ghicire cu mult prea joasă — cu el, boxele singure ar fi ținut „liniștea" veșnic nescadentă. Rămâne
  de validat la slujba de 19.09, 18:00, că vocea trece peste −60.
  ⚠️ **HTTP 500 pe `GET /intern/aparat/comanda` NU e de la rotire** (verificat în seara asta, 20:18:04
  și 20:18:45): jurnalul Pi le arată **zilnic de dinainte**, 2–23 pe zi din 11.09 încoace (23 pe 16.09,
  zi fără nicio publicare; azi 3 dintre ele înainte de publicarea de la 20:17), iar `live` nu mai
  fusese publicat din 15.09. E rata de fond a long-poll-ului de 25 s: când obiectul durabil e mutat/
  repornit cât cererea stă parcată în `setTimeout`, `asteaptaComanda` cade pe `return this.comanda()`.
  Aparatul merge mai departe pe ultima comandă, deci n-a pierdut nimic. Tail curat 3 min (0 excepții,
  long-poll-uri de 25 s cu 200), 0 erori pe Pi de la 20:18:45.

- **GRAFICUL NIVELULUI DE SUNET pe `/mic`** (user, 20:35: „să facem grafic"). Istoric în DO-ul
  `Aparat` pe **chei orare** (`sunet:AAAA-LL-ZZTHH`, UTC, ≤180 puncte/oră), ținut **7 zile** și măturat
  o dată pe oră — nu un array rescris la fiecare 20 s, fiindcă o valoare de storage are limita de
  128 KB. Rută nouă `GET /mic/sunet?ore=6|24|168` (aceeași poartă de super-admin), care rarefiază cu
  maximul peste 1200 de puncte. Pe pagină: SVG desenat de scriptul ei, fără biblioteci, după skill-ul
  `dataviz` — linia RMS, vârful ca spălare, pragul punctat cu eticheta lui, zonele peste prag pe talpă,
  trei butoane 6 h / 24 h / 7 zile (ales ținut în localStorage), reîmprospătare la 60 s, citire la maus
  și la săgeți, culori validate pentru amândouă temele. Socoteala pură: `apps/live/src/sunet-istoric.ts`.
  Privit pe viu în Chromium, temă deschisă și întunecată, pe toate cele trei ferestre.

- **`asteaptaComanda`, întărită** — 500-urile de mai sus. Ramura de expirare nu mai citește storage-ul:
  comanda de la intrare se ține în mână, iar `puneComanda` trezește așteptătorii cu versiunea nouă în
  braț. Bucata scoasă în `apps/live/src/asteptare.ts`, cu proba care ar fi prins-o (un storage care
  cade după așteptare nu mai poate strica răspunsul). 672 de probe, typecheck 36/36. **live 0.1.9**.

- **„Să nu ținem în două locuri programul"** (15:25–16:00): programul liturgic era tastat a doua oară
  în WordPress-ul de pe apex (articol `program` + ACF, tema `sfantulilie`, `content-single-program.php`).
  Userul a ales: bucata se cere de la noi **la server, din PHP**, în **formatul actual al site-ului**
  (nimic vizual nu se schimbă), iar partea de WP o aplică **#proj-biserica-website**. Făcut:
  `/v1/bucata-site` + `apps/program/src/site.ts` + `tests/program-bucata-site.test.ts` (9 probe, 582
  total), `materiaSaptamanii()` scoasă din `tabelulSaptamanii` (regula validat/propus, un singur loc),
  program 0.8.2. Runbook cu PHP-ul gata: `docs/runbooks/wp-program-prima-pagina.md`. Probat local pe
  datele adevărate: iese exact lista de pe prima pagină pentru 14–20.09.
  **Trei hotărâri ale userului, pe rând**: (1) „doar săptămâna în curs, apare la ora 00.00 luni" —
  `data=azi` pe ora Bucureștiului, luni→duminică; (2) **forma scurtă a calendarului rămâne** („dacă e
  să scrie pe larg păstrăm asta ca să nu mai tragem altceva"); (3) „cu ocazia asta se rupe de tot
  legătura cu site-ul curent — tick-ul care declanșa începerea transmisiunii — ne vom baza doar pe
  programul scris în aplicația Program". **Verificat pe trei fronturi** (Pi, V2, WP): aparatul cheamă
  numai `program.sfantul-ilie.ro/v1/interval` (jurnal: „programul e neschimbat (304), 6 slujbe până la
  2026-10-02"), sistemul vechi din `/home/pi/Music/script` e disabled+inactive din mai 2026; `live`
  ia `/v1/urmatoarea` prin Service Binding, `radio` prin `live`, zero fetch-uri spre apex; în WP
  tick-ul (`functions.php:1115`, `file_put_contents('/home/sfantuliliero/public_html/audio/live.php','1')`)
  scrie într-o cale care nu mai există — `$live` e mereu 0, a rămas doar afișare. **Legătura e deja
  ruptă în practică; codul mort din WP se scoate odată cu bucla ACF.**
  ⚠️ **Validarea săptămânii e NUMAI gest de om** (chat, `program.valideaza_saptamana`, `program.publish`,
  Da/Nu) — nu există cron. Deci „apare luni la 00:00" înseamnă: dacă săptămâna nu e validată până
  atunci, prima pagină ține copia bună de dinainte (cea veche), nu propunerea.
  **Sincronizarea WP: DIN ORĂ ÎN ORĂ** (user, 16:08) — transient `HOUR_IN_SECONDS` + `wp_schedule_event`
  orar aliniat la minutul 0 (runbook, secțiunea 3); comunicat sesiunii `biserica-website-12`.
- ⚠️⚠️ **TRANSMISIUNEA NU MAI PORNEA SINGURĂ DIN 15.09.2026 — găsit la verificarea „ne bazăm doar pe
  Program"** (15:55–16:40). Aparatul pornește NUMAI slujbele cu `transmisie = 1`
  (`~/aparat-nou/aparat/program.py:205-231`, `de_pornit()` iterează doar `transmise()`), iar propunerea
  V2 le năștea pe toate cu `transmisie: false` FIX (`hartii.ts`, ambele mapări) — validarea din chat le
  scria așa în bază (`depozit.ts:376`), ocolind `DEFAULT 1` din SQL și `default(true)` din contract.
  Jurnalul Pi-ului: ultima pornire după program 15.09 18:00 (Maslu, din `adauga_slujba`, singura cale
  care scria `true`); apoi radio neîntrerupt. Userul a văzut semnul pe pagina live: „Următoarea slujbă
  (nu se transmite)" (`packages/comanda/src/player.ts:210`). **Hotărârea lui: `transmisie` e `true`
  MEREU în propunere** (16:04: „true mereu") — cine nu vrea transmisiune la o slujbă o stinge din chat
  (`program.modifica_slujba` acceptă `transmisie`). Făcut: maparea propunere → `Slujba` stă o singură
  dată în `propunere.ts` (`slujbeDinPropunere`, `transmisie: true`), folosită de ambele locuri din
  `hartii.ts`; probă `tests/program-transmisie-propunere.test.ts`; program 0.8.3. Rândurile deja
  scrise (19.09–27.09) au fost puse pe 1 în producție („update", 16:04) — la 16:38 SELECT-ul arăta 6/6.
  ⚠️ **Regula de ținut minte**: un câmp care pare „de afișare" poate fi comutatorul aparatului —
  înainte de a scrie o valoare fixă într-o propunere, întreabă-te cine o citește ca pe o comandă.
- **„Nu am putut trimite mesajul" în bula buletinului — `SECRET_INTERN` lipsea pe
  `xc-buletin-production`** (12:31–12:36). Secretul dintre workeri se pusese la cutover doar pe cei
  patru cu acțiuni (calendar, program, tipic, chat-worker); buletinul a intrat în familia chatului pe
  18.09 și n-a primit niciunul. Fără el, chat-worker răspunde `Not Found` — **text simplu**, pe care
  bula încearcă să-l citească drept JSON, cade în `catch` și scrie mesajul generic. Semn sigur: în D1
  nu apărea niciun rând al zilei (ultimul mesaj era din 15.09). Valoarea nu se citește înapoi de la
  Cloudflare, deci s-a **rotit**: una nouă, pe toți cinci deodată (o pauză de sub un minut în care și
  celelalte bule dau aceeași eroare). ⚠️ **De reținut**: la orice aplicație nouă care capătă bulă sau
  `/_actiuni`, secretul se pune ODATĂ cu montarea — și `infrastructure/cutover/secrete-productie.sh`
  are lista `CU_ACTIUNI` care trebuie să crească odată cu ea.
  ⚠️ Și: un `Not Found` text simplu ajunge la om ca „nu am putut trimite mesajul" — merită un răspuns
  care spune ce s-a întâmplat.
- **Prima încercare vie a bulei buletinului, cu modelul adevărat** (12:37, după reparație): „Pune
  titlul articolului principal: Smerenia" → modelul a chemat `buletin.compune` cu doar
  `{principal:{titlu}}`, a primit `argumente_invalide` (unealta cere numărul întreg) și a întrebat
  înapoi de motto. **A durat 2 min 49 s.** Două învățături, amândouă ale userului: unealta „compune
  tot" nu poate ține loc de editare punctuală, și viteza e o problemă de drum, nu de model mai bun.
- **CHATUL, PE APLICAȚIE** (user, 12:53: „vreau mai întâi să avem instrucțiuni diferite per aplicație
  — să activăm din Administrare / Super-Admin aplicațiile care primesc chat — și din Setări aplicație
  pe un tab Chat AI să avem câmpurile specifice aplicației. Vreau să răspundă repede la toate
  cererile, nu să încerce nu știu ce minuni. Dacă nu e ceva ce se potrivește cu ce are voie să facă să
  răspundă că nu poate face asta"). Pornise de la: „Chat-ul nu trebuie să stea la Program — trebuie
  să-i găsim alt loc unde să stea toată logica și de unde poate fi cuplat la orice aplicație".
  - **Ce era de fapt**: logica era deja despărțită (`packages/chat` + `xc-chat`), dar CUNOAȘTEREA era
    a Programului — o singură pereche `indrumari`+`unelte` pentru toate, iar regula 8 din
    `instructiuni()` era o hartă scrisă de mână a uneltelor lui. Bula buletinului plătea, la fiecare
    mesaj, regulile programului.
  - **Ce s-a făcut**: chei `modul:chat:<aplicatie>`; rubrica „Chat AI" în Setările fiecărei aplicații
    (scrisă o dată, în `@xc/chat/setari.ts`); unelte cu bifă, aduse din manifest prin ruta nouă
    `/unelte` a creierului; Module a rămas cu ale platformei și listează aplicațiile din
    `APLICATII_CU_BULA`; regulile 8 și 9 rescrise. Amănuntele: „Modulul de Chat (AI)".
  - **Publicat 13:20**: chat-worker 0.3.0, buletin 0.8.1, program 0.8.1, admin 0.5.0. KV însămânțat.
    570 de probe (19 noi), typecheck 36/36.
- **„Compune buletinul… și nu se vede nimic" — acțiunea chatului punea DOAR PDF-ul** (user, 13:53;
  buletin **0.8.2**, publicat 14:00). Erau două drumuri către aceeași treabă: ruta formularului
  (`POST /nou`) punea PDF-ul, **coperta**, cererea păstrată și arunca cele patru broșuri din `tipar/`;
  acțiunea `buletin.compune` — cea prin care lucrează bula — punea numai PDF-ul și cererea. Deci un
  număr recompus din chat rămânea pe ecran cu coperta dinainte, iar „Tipărește" dădea broșura foii
  vechi. **Nimic nu dădea vreo eroare** — amprenta `?v=` se schimba (e etagul PDF-ului), dar fișierul
  de sub ea era tot cel vechi. Acum totul stă în `pastreazaNumarul()` (`compune.ts`), folosit de
  amândouă drumurile; coperta se **șterge** când randarea n-a dat una. 3 probe noi (573).
  ⚠️ **Regula**: când o treabă are și drum de ecran, și drum de acțiune (chat), coada lor se scrie
  O SINGURĂ dată. Ce nu e în acțiune nu se întâmplă când lucrează chatul — și nu se vede nicăieri.
- **ADMINI PE APLICAȚIE, la toate aplicațiile + tabelul din Administrare** (user, 10:40 și trei
  lămuriri la 11:06). Cererea: doi oameni admini în aplicații diferite, „admin doar pe aplicația
  respectivă și nu de-a lungul întregii platforme", cu tabel „la mine în Administrator"; capacitatea
  la **toate** aplicațiile, numirea **în fiecare aplicație în parte**; „este vorba fix de rolul pe care
  simulez din meniul de Cont — **Intră ca administrator**", „nu admini generali ca mine, super-admin".
  Concret acum: **Programul liturgic**.
  - Inventarul dinainte: mecanismul EXISTA pe jumătate — grantul punctual (`/acorda`), folosit deja de
    Curățenie (în producție sunt 2 granturi `cleaning.manage`). Piedica era că jumătate din aplicații
    își citeau adminul din ROLUL global, deci un grant nu deschidea nimic la ele.
  - Făcut: registrul `APLICATII_ADMINISTRABILE` (11 aplicații) + 4 chei noi (`newsletter.manage`,
    `typicon.manage`, `bible.manage`, `website.manage`); `eAdminulAplicatiei()` în `@xc/authorization`;
    `eAdmin` din cheie în program, calendar, buletin, newsletter, tipic, biblia, home (+ `eAdminPlatforma`
    pentru rândul „Administrare" din meniu, inclusiv la biblioteca și curatenie); rubrica de numire
    scrisă o dată în `@xc/setari`; `/harta-admini` la authz; tabelul cu buline la `admin/admini`.
  - 532 de probe trec (23 noi), typecheck curat pe 36. **Publicat la 11:20**, în ordinea care contează:
    `xc-authz` 0.3.0 întâi, apoi cele zece aplicații. Userul numește oamenii din Setările aplicației.
  - Hotărât cu userul: bula de chat din Program atârnă de acum de adminul Programului (cheltuială la
    fiecare mesaj — a ales știind).

- **BULA DE CHAT LA BULETIN, pe `/nou`** (user, 12:03: „când am făcut bula de chat AI am făcut-o să fie
  transmisibilă… să fie afișată doar pe /nou… să se lege la API-ul buletinului nou și să-l completeze").
  A fost chiar transmisibilă: trei linii, fără nimic atins din bulă ori din creier. Ce a cerut lucrul pe
  lângă montaj: **`/nou` se deschide acum cu ciorna** (formular umplut din cererea păstrată + butoanele
  foii), fiindcă lanțul propunerii se închide cu o reîncărcare a paginii — altfel ce compunea chatul se
  pierdea exact atunci; **nr. și data au devenit opționale** în acțiuni, luate din arhivă (un model care
  le ghicește compune peste alt număr); **`CE_VEDE_BULA`** în chat-worker, ca regulile buletinului să nu
  intre în contextul programului la fiecare mesaj. 550 de probe, tsc 36/36. Vezi „BULA DE CHAT A
  BULETINULUI" pentru cerc (publicare cu ocol) și pentru ce trebuie bifat în Module.

- **NUMĂRUL COMPUS SE VEDE ÎN PAGINĂ, CU BUTON DE VALIDARE — buletin 0.7.0** (user, 09:52, două
  mesaje: „să faci ceva cu cache-ul când afișezi buletinul generat — să-l afișezi direct în pagină ca
  și cum e un buletin gata de validat"; „să fie toate butoanele de tipar și download și flip3D + un
  buton de validare"; la întrebarea ce înseamnă validarea, la 09:58: **„validarea = publicarea"**).
  Până acum, după compunere, ecranul spunea „Numărul e compus. Deschide PDF-ul" — un link.
  - **ciorna pe ecran** (`ciornaPeEcran`, `pagini.ts`): ACELAȘI bloc ca la un număr din arhivă —
    `coperta` + `butoaneleNumarului` + `fereastraRasfoit` —, cu un rând de arhivă închipuit din
    cheile ciornei. În plus față de arhivă: butonul de răsfoit (flip3D) se VEDE și e butonul de
    validare. Stil nou `.ciorna` (chenar) și `.btn.mare.bun` (verde: rosul e, aici, al lucrului nefăcut);
  - **coperta iese din aceeași randare ca PDF-ul** — `pdfCuRaportSiCoperta` în `@xc/ui/hartie.ts`,
    o singură sesiune de browser (pagina e deja încărcată; a doua ar fi costat încă o pornire).
    Cheia: `2026/buletin-616-2026-09-20.jpg`, ca la numerele din V1. ⚠️ Una singură, nu și `-mic.jpg`:
    tăierea la 460 nu se poate face în Worker, deci rândul o pune în amândouă coloanele;
  - **validarea = publicarea**: `POST /nou` cu `fapta=valideaza` → `scrieBuletin` (`INSERT OR REPLACE`,
    `sursa: 'site'`, textul pentru căutare din cererea păstrată sub `compus/`), audit
    `buletin.valideaza`, apoi 303 spre pagina numărului. Se validează numărul DE PE ECRAN (nr+data din
    formular, cântărite față de ce urmează acum): dacă între timp s-a validat altceva, nu scrie peste.
    Poarta e tot rolul de admin — o cheie nouă ar fi cerut republicarea lui `xc-authz`;
  - **CACHE-UL** (partea nevăzută, dar cea care l-a păcălit pe user azi-noapte): `/fisier/<cheie>` se
    dădea cu `immutable` pe un an, pe presupunerea „numele poartă numărul și data, deci conținutul nu
    se schimbă". Presupunerea a murit în ziua în care numărul se compune chiar aici: la recompunere
    cheia e ACEEAȘI. Acum: un an **numai cu `?v=<amprenta>`** pe adresă (amprenta = etag-ul R2 al
    randării; ecranul compunerii o pune în TOATE adresele — copertă, foaie, descărcare, broșură,
    răsfoit), altfel o oră cu etag. La fel la `/tipar/`. În plus, la recompunere se **aruncă broșurile
    vechi** ale numărului (cheia lor iese din cheia PDF-ului, deci altfel s-ar fi tipărit foaia veche),
    iar `?v=` a cerut și îndreptarea întrerupătorului „Revers", care lipea `?revers=1` orbește cu „?";
  - **broșura merge și la numărul nevalidat** (`ciornaDinDepozit`): „Tipărește" e chiar butonul după
    care omul se uită pe hârtie înainte să valideze, iar rândul din arhivă încă nu există.
  - Probe noi: `tests/buletin-ciorna.test.ts` (8), plus unealta de laborator
    `apps/buletin/unelte/proba-ecran.mjs` (randează ecranul fără Cloudflare — ecranul se vede cu ochiul,
    nu doar bucăți de HTML în probe). 507 probe trec, tsc curat pe 37 de pachete.
    Ecranul: `outputs/buletin-ecran-nou-ciorna.png`.

- **PATRU ÎNDREPTĂRI LA PAGINA A PATRA (user, 09:11) — buletin 0.6.2, pe disc, NEPUBLICAT.** (1) golul
  floare → „PROGRAMUL LITURGIC" **0.5 cm** (era 1 mm); (2) capul calendarului **20 pt** (era 18);
  (3) **„calendarul este în continuare tăiat în partea de jos"** — vezi mai jos, e un defect adevărat,
  nu o măsură; (4) **adresa din subsol, aldină**. Fișiere: `foaie.ts` (stilul + clasa `.adresa`),
  `masuri.ts` (`floare` 2.2 → 2.9 rânduri, `titluCalendar` 2.6 → 2.75), probă nouă
  `tests/buletin-foaie.test.ts` (5 probe care păzesc cele patru hotărâri). 499 de probe trec, tsc curat;
  `--verifica` BUN pe toate trei variantele, `--gol` 0/1/2 secundari: 0 semne pe dinafară, gol 6 mm.
  Golul de 0.5 cm e **de la cerneală la cerneală**, cum îl măsoară rigla: marginea CSS e 4.9 mm, fiindcă
  peste ea vine aerul de deasupra majusculelor Trajan (600 dpi: floarea se termină la 157.40 mm, capul
  începe la 162.31 → 4.91 mm; pasul următor al rețelei de pixeli ar da 5.17).

- **CAPUL CALENDARULUI, ÎNCĂ O DATĂ: 24 pt (user, 09:48 — „+4pt mai mare PROGRAMUL LITURGIC").**
  A doua cerere pe aceeași piesă în aceeași zi: 18 → 20 (09:11) → **24**. `foaie.ts` (`.cap-calendar`)
  și `masuri.ts` (`titluCalendar` 2.75 → **3.05**: capul merge cu ~0.075 rânduri pe punct, 18 → 2.6,
  20 → 2.75, 24 → 3.05). 499 de probe trec, tsc curat, `--verifica` BUN pe toate trei variantele,
  `--gol` 0/1/2 secundari: 0 semne pe dinafară, gol 6 mm. Randarea: `outputs/buletin-pagina4-titlu-24pt.png`.
  Merge pe live odată cu celelalte patru îndreptări, în **0.6.2**.

- **⚠️⚠️ „TĂIAT ÎN PARTEA DE JOS" ERA UN DEFECT DE AȘEZARE, NU O MĂSURĂ: un tabel dintr-o cutie
  `position: absolute` PIERDE ULTIMUL RÂND în Chromium.** Ce se vedea în nr. 616 de pe live (și,
  reprodus, pe local): tabelul programului se oprea brusc după ultimul rând scris — fără linia de jos,
  cu banda gri de la piciorul duminicii nedesenată deloc —, iar subsolul se lipea de rândul dinainte.
  **Nu e clipping și nu e fragmentare**: tabelul își socotește înălțimea FĂRĂ ultimul rând (măsurat:
  `table` 358.6 px, dar ultimul `tr` pictat la 4385..4406.9, adică peste subsol), iar `.jos` își așază
  copiii după înălțimea aceea greșită. Scos din cauze, unul câte unul: **nu** ține de `rowspan`, de
  conținutul rândului, de `table-layout: fixed`, de `border-collapse`, de `height`-ul benzii, de
  `overflow: hidden` al paginii, de fonturi (nu e o relayout ratată — e determinist, `--dump-dom` dă
  aceleași cifre) și nici de `bottom` anume: și `position: absolute` cu `top` greșește la fel.
  **Singurul lucru care repară: josul să NU fie absolut.** De aceea `.pagina.ultima` e acum o cutie
  **flex** (`flex-direction: column; justify-content: flex-end`), iar `.jos` stă **în flux**, împins la
  talpă, cu `margin: 0 15.03mm 11mm`. Restul pieselor paginii (chenarul, cele două coloane) sunt
  absolute, deci nu simt schimbarea; `scurteaza()` citește tot `jos.offsetTop`, care merge la fel.
  ⚠️ **Foaia de pe ușă a programului NU e atinsă** — acolo tabelul stă în `.continut`, care e în flux.
  Laboratorul (repro minim, izolarea cauzei, măsurarea cernelii la 200/600 dpi) a rămas în spațiul
  agentului, `tmp/foaie-tabel-taiat/`.
  **Lecția**: când o piesă „lipsește" dintr-o randare, măsoară cutiile înainte să cauți în conținut —
  aici chiar așezarea mințea, iar toate explicațiile care porneau de la tabel (rowspan, borduri, bandă)
  erau pe lângă.

- **„CALENDARUL E TĂIAT" (user, 01:37) — buletin 0.6.1: curgerea așteaptă pozele și fonturile.**
  Nr. 616 compus de user pe live la 01:40 (`fisier/2026/buletin-616-2026-09-20.pdf`): pe pagina a
  patra textul coloanelor intră peste floare și peste „PROGRAMUL LITURGIC" — cam 13 mm. Pe proba
  locală (615, `--gol`, `--verifica`) nu se vedea. Cauza: scriptul `CURGE` rula la parsare, când
  floarea (data-URI, 1400×435 px = **13.7 mm la 44 mm lățime**) și fonturile nu erau decodate în
  Browser Rendering; `.jos` se măsura mai scund, coloanele rămâneau prea lungi, iar când sosea
  floarea josul creștea în sus, sub text. **Reprodus local** dând floarea ca fișier (`src="floare.png"`,
  încărcare asincronă): scriptul vechi — text peste floare, ca pe live; cel nou — curat. Fixul:
  `dupaIncarcare()` — `load`, apoi `document.fonts.load()` pe cele șase fețe + `fonts.ready`, abia apoi
  curgerea; `hartie.ts` aștepta oricum `data-potrivit` după `load`, deci hârtia nu iese înainte.
  Probe locale neschimbate (615: 8 886 semne, 0 afară, gol 6 mm; `--verifica` BUN ×3), tsc curat.
  ⚠️ Pe disc era și lucru necomis al altei sesiuni (pastila Tipărește + iconița Revers, 23:14).

- **Comis și publicat (user: „Comite tot și deploy", 01:51).** Un singur commit, `ba31efc`, cu tot
  ce era pe disc: fixul (`foaie.ts`, buletin 0.6.1) **plus** lucrul celeilalte sesiuni (`pagini.ts`,
  `stil.ts`, `tests/buletin-newsletter.test.ts` — pastila Tipărește + iconița Revers), la cererea
  explicită a userului. Înainte: typecheck 36/36, 494 de probe trec. Publicat **numai buletinul** pe
  production (`xc-buletin-production`, versiunea `1e64e881`, 100%) — programul 0.7.9 era deja pe live
  din seara de 17.09, 23:12. „No targets deployed" din wrangler = rutele nu s-au schimbat, nu o
  eroare. **Nevăzut încă**: 616 recompus pe live (NEXT 0a, pct. 2).
  ⚠️ `npm run typecheck` a picat o dată la @xc/auth și a trecut la reluare, fără nicio schimbare —
  cursă între `pnpm install`-urile pornite în paralel de turbo, nu un defect al codului.

- **Tipic 0.4.0 — antetul ca la Calendar** (user, 09:48/21:29: „după bulina cu AZI să avem un text care spune
  unde ne aflăm — de fapt totul să fie ca la Calendar, fără funcția de filtrare cruci; Calendarul să fie
  afișat scrisul zilelor cu negru — doar duminicile roșii și sărbătorile cu roșu"; 21:55: „Mâine e bun").
  Pastila (`pastilaLocului`, `apps/tipic/src/pagini.ts`): bulina AZI · data zilei deschise (`.acum`, lung/scurt)
  · **Mâine** (cuvânt pe lat, săgeată sub 600 px) · cheia calendarului, care coboară **bara cu grila lunii**
  sub antet (`.bara-cal`, ca `.bara-luni` la Calendar) — nu mai e pop-up. Abonarea afară, ca înainte. Fără
  lupă (n-are ce căuta), fără cruce. Grila (`grilaLunii`, scrisă PE SERVER): zilele `--ink`, duminicile și
  sărbătorile (`eRangRosu`: praznic împărătesc / cruce roșie, aceeași regulă ca titlul zilei) `--rosu`; zilele
  fără rânduială inerte, palide; ziua deschisă `.acum`, azi cu bulină mică. Sărbătorile se CER de la Calendar
  prin Service Binding, `/v1/interval` pe luna întreagă (`sarbatorileLunii`, `calendar.ts`) — **o cerere pe
  lună**, nimic copiat; Calendarul tăcut → doar duminicile roșii. Lunile vecine vin de la
  `GET /v1/luna/<AAAA-LL>?zi=<deschisă>` ca HTML gata scris (un singur desen, nu JSON + al doilea desen în JS).
  Probe: `tests/tipic-antet.test.ts` (16). ⚠️ Capcană: `stil.ts` e template literal — un backtick într-un
  comentariu CSS dărâmă workerul la încărcare („…".acum is not a function"), tsc nu-l prinde.

- **CHESTIONARUL BULETINULUI NOU, cu schiță pe server — buletin 0.9.0, publicat 19:57Z** (user, 09:37, cererea; hotărârile lui la 22:1x: formularul iese cu totul, schița pe server, modelul mic rămâne). Comanda „buletin nou" în bula de pe `/nou` → `buletin.chestionar` (citește; creează schița la prima chemare) întoarce ÎNTREBAREA gata formulată de server + instrucțiunea „pune-o exact, apoi cheamă `buletin.raspunde`"; fiecare răspuns al omului → `buletin.raspunde {subiect, valoare}` pe listă ÎNCHISĂ (motto, moto_autor, text, autor, ani, pomenire, titlu, sursa, nota, poza, mai_adaugam, pastreaza, sari, sterge_secundar, de_la_capat) — efect NOU **`ciorna`** în `@xc/actiuni` (scrie doar în schița aplicației, fără Da/Nu; `scrie` rămâne cu Da/Nu; chat-worker îl execută ca pe `citeste`). Ordinea: motto (precompletat de la numărul trecut) → text → autor (euristici în cod, model completează) → ani → pomenire (**codul o caută în calendar**, binding nou `CALENDAR` în buletin, `/v1/cauta`) → 3 titluri (candidați din cod + model) → sursa → „mai adăugăm?" (≤2 secundari) → `buletin.compune` FĂRĂ argumente, din schiță → propunere Da/Nu. Schița: `apps/buletin/src/schita.ts` (JSON în R2 `schita/<nr>-<data>.json`, mașina de stări `urmatoareaIntrebare`, euristici pure), ștearsă la validare. `/nou` FĂRĂ formular: capul, ciorna PDF cu butoanele, blocul „Schița numărului" (text strâns, vezi tot/vezi mai puțin). Setări → „Chestionarul buletinului nou": cele 8 întrebări editabile, cu locuri `{motto}`, `{autor}`, `{ani}`, `{pomenire}`, `{titluri}`, `{sursa}`, `{articol}`, KV `buletin:chestionar` (`POST /setari/chestionar`, „Înapoi la standard" golește cheia). KV `modul:chat:buletin` are acum `chestionar`, `raspunde`, `compune`, `socoteala`. Probe: `tests/buletin-chestionar.test.ts` (42), 757/757, tsc curat. ⚠️ **Neprobat viu cu modelul mic** — de privit dacă pune întrebarea EXACT cum i se dă. Alegeri de confirmat cu userul: „da" fără număr la titluri = titlul 1; pomenirea se caută pe anul numărului.
- **FEREASTRA DE CHAT: asincron + sondare, fără blocarea fundalului — chat-worker 0.4.0, program 0.8.4** (user, 22:15: „mi se cam blochează fereastra de chat"). Cauzele găsite: derularea blocată pe tot timpul gândirii (minute), zero timeout (la >~100 s fetch-ul cădea deși răspunsul se scria în D1), până la 6 apeluri de model pe mesaj, propunerea Da/Nu pierdută la redeschidere. Ce s-a făcut: `/chat/mesaj` în două mișcări (scrie + `chat-worker /lucreaza` ținut cu `waitUntil` al APLICAȚIEI — `waitUntil` al lui chat-worker nu ține prin Service Binding), `GET /chat/stare` („gata" = mesaj de agent după al omului, nu un steag), etapa curentă scrisă în `date_json` al mesajului omului, bula sondează la 2,5 s cu răbdare 5 min + „mai încearcă"; buget 90 s în buclă (spune ce a apucat), reîncercarea cu `max_tokens` dublat sare când bugetul e scurs, `AbortSignal.timeout` pe poarta Anthropic, `Promise.all` pe cele independente; fundalul se blochează DOAR pe ≤480px (excepție anume de la regula ferestrelor, documentată în `bula.ts`; `@xc/ui` neatins), auto-redeschiderea doar pe ecran lat; propunerea refăcută din istoric (expirare socotită); Enter = rând nou pe îngust; „Actualizez pagina…" înainte de reload; semn de viață cu puncte + mm:ss; `TAIERE_MESAJ_OM = 12000`; `CE_VEDE_BULA.buletin = ['buletin','calendar']`. Probe: `tests/chat-asincron.test.ts` (20). `/chat/discutie` nu mai trimite browserului `apeluri`/`model`.
- **FIȘIERE ÎN CHAT (Word/txt/poze) + INSTRUCȚIUNI PUNCTUALE PE OBIECTELE BULETINULUI — chat-worker 0.5.0, program 0.9.1, buletin 0.10.1, publicate 20:28–20:30Z** (user, 22:20: „chat-ul trebuie să accepte fișiere Word sau txt și poze și text ca și acum. Instrucțiunile sunt precise către un obiect din lista de obiecte ce formează buletinul"; referința lui, chineza, are DOAR urcare de poze — de acolo s-au luat clema, micșorarea în browser (1600 px, JPEG 0.82), multipart cu câmpul `fisier`, limita de 12 MB pe `content-length`, lista albă, cheia scrisă de server). Generic, în `@xc/chat`: `packages/chat/src/fisiere.ts` (modul pur: listă albă docx/txt/jpg/png/webp, `extrageTextDocx` citește zip-ul **de la directorul central** (EOCD → CD → antet local, stored sau deflate prin `DecompressionStream('deflate-raw')`, fără biblioteci), paragrafe `<w:p>`, entități, tab/br; `extrageTextTxt` cu BOM și rezervă windows-1250; `TAIERE_MESAJ_OM` = 12000 mutat aici), `POST /chat/urca` sub aceeași poartă ca `/chat/mesaj` (413/415/422 înainte de orice), octeții în MEDIA (`/incarca`, exista) sub `chat/<aplicatie>/<om>/…`, **cârligul `laFisier`** al aplicației; bula: 📎 + drag&drop + paste de poze, card „nume · DOCX · 34 KB · 8 912 semne", **„vezi tot / vezi mai puțin" peste 600 de semne**, după urcare trimite singură mesajul, `xc-chat:raspuns` (CustomEvent) la fiecare răspuns. Buletinul: `laFisierulBuletinului` — docx/txt → dacă întrebarea de acum e `text` (ori articolul n-are text) CODUL scrie textul în schiță (`scrieRaspuns`) și modelul primește „Am pus textul din X (N semne) ca textul articolului principal. Continuă." → cheamă `buletin.chestionar`; poză → `FISIERE` sub `poze/<nr>-<data>/…` (public pe `/fisier/`, `CHEIE_POZA`, cache 300 s — Browser Rendering n-are sesiune) + adresa în schiță. `buletin.raspunde` cu `articol` (`principal|s1|s2`, lipsă = cel curent); în afara chestionarului `intrebare: null` + „spune ce ai schimbat" — nu reia întrebările; 10 exemple punctuale + 3 rânduri în `REGULI` („o instrucțiune care numește un obiect al foii și un articol se traduce DIRECT în buletin.raspunde"). `/nou` se împrospătează fără reîncărcare: `GET /nou?bucata=schita` la evenimentul bulei. chat-worker: `raspunsulDin` scoate `unelte` din `apeluri` (altfel drumul asincron nu împrospăta ecranul). Probe: `tests/chat-fisiere.test.ts` (48), 806/806, tsc curat. Deschise: pozele din `poze/` nu se șterg la validare; fișierele se urcă unul pe rând (cu 90 s buget/mesaj, trei poze = ~3 min); `program` primește și el fișiere (fără `laFisier`, ca mesaj); gif afară; zip64 refuzat.
- **TEXTUL LUNG LIPIT ÎN CHAT INTRĂ DIRECT ÎN SCHIȚĂ — chat-worker 0.5.1, program 0.9.2, buletin 0.10.2, publicate 21:14Z** (user, 23:55: „am pus textul mare de la articol și stă foarte mult"). Diagnostic din D1 (`xc-chat-production`, discuția `93cc78ab…`): „Buletin nou" → chestionar 9 s; „Da" → pastreaza 7 s; textul de **9108 semne** lipit la 20:50:39 → **niciun răspuns, niciodată**; etapa a rămas „mă gândesc…" (pasul 0). Două straturi: (1) modelul mic trebuia să re-scrie 9108 semne ca `valoare` la `buletin.raspunde`; (2) **pe drumul Workers AI nu exista niciun ceas** (`AbortSignal.timeout` era doar la Claude; bugetul de 90 s se cântărea doar ÎNTRE pașii buclei), deci un apel lung trecea nestingherit și cererea `/lucreaza` a fost tăiată de platformă înainte să scrie un rând — boala s-a arătat ca TĂCERE, nu ca eroare. Reparat: cârlig **`laText`** în `@xc/chat` (chemat în `/chat/mesaj` ÎNAINTE de creier; răspunsul poartă `nota` + `unelte`), buletinul: `laTextulBuletinului` (`textulInSchita`, comun cu `laFisierulBuletinului`; prag 400 de semne; **doar când întrebarea de acum e `text`** — mai strict decât la docx, fiindcă un motto dictat lung ar fi devenit altfel textul paginii întâi) → spre model pleacă „Am pus textul (9 108 semne) ca textul articolului principal. Continuă." și `/nou` se împrospătează pe loc; `cuCeas` peste `env.AI.run` (`expirat` → ieșirea „ce am apucat"); `max_tokens` 6000 din prima când istoricul are un mesaj al omului > 3000 de semne (fără reîncercare); argument > 3000 de semne se notează (`semneArgument` în `apeluri` + `log.warn`), nu se respinge. `REGULI`/descrierea lui `raspunde`: textul lung a intrat deja, cheamă `chestionar`. Probe: `tests/chat-text-lung.test.ts` (19), 823/823, tsc curat. ⚠️ Publicarea a dus pe producție și reglajul CSS străin din `packages/ui` (sfantul-ilie.ro la mijloc), necomis de sesiunea lui. Deschise: o instrucțiune > 400 de semne dată exact la pasul `text` e luată drept articol (îndreptare: `de_la_capat`); argumentele lungi rămân întregi în `date_json`.

### 2026-09-17

- **PATRU RETUȘURI LA FOAIE, MĂSURATE — au intrat în buletin 0.6.0 (publicat împreună cu cele cinci reguli)**.
  Userul, 23:07: (1) **aerul cruce → titlu = aerul ramă → cruce** (3.7 mm; la 200 dpi rama se termină
  la 75 px, crucea începe la 104, iar de la talpa crucii la capul literelor sunt acum tot 29 px):
  `.titlu-foaie` `padding-top: 21.2mm`, `.cruce` `top: -21mm`; (2) **rândurile motto-ului la jumătate
  de depărtare** (`line-height` 1.32 → 1.1; golul dintre rânduri 17 → 9 px) — el a spus că cererea de
  la 22:37 („la jumătate distanță") fusese scrisă greșit, deci golul de sub parohie s-a **întors la
  2.6 mm**; (3) chenarul pozei principale **1.2 mm** (în nr. 615 din Word e 1.0 mm = 8 px la 200 dpi);
  (4) **sursa, mențiunea de deasupra ei și subsolul la 13 pt** (`pdftohtml -xml` pe 615: Calibri
  13.3 pt, pas 16.4 pt; erau 10.5 pt — „text scris prea mic"). `INALTIMI`: motto 3.4, sursa 3, subsol
  3.2. Curgerea pe 615 neschimbată (8 886 semne, 0 afară, 7 coloane, gol 6 mm).
- **CINCI REGULI ALE COMPUNERII — buletin 0.6.0 + program 0.7.9 (publicate la 23:2x, la „Deploy"-ul
  cerut pentru retușuri; sesiunea care le-a scris s-a încheiat la 23:07 fără să le comită)**. Userul,
  22:47, un singur mesaj: (1) **programul PROPUS se folosește** când săptămâna nu e validată, „ce e
  disponibil", cu **PROPUS spus la început** — `tabelulSaptamanii` din program cade pe
  `saptamanaOriPropunere` și răspunde cu `stare: 'validat' | 'propus'` (foaia de pe ușă rămâne numai
  validată); în buletin: `Calendar.stare`, `Compus.atentie[]`, câmpul `program` + `atentie` în
  `buletin.compune`, chenar roșu „PROPUS." deasupra formularului din `/nou`, „(PROPUS)" pe rândul
  programului; (2) **nr. și data nu se editează** — au ieșit din formular, serverul le ia din arhivă;
  (3) **motto-ul precompletat cu al numărului trecut** — `mottoDinainte`: cererea păstrată sub
  `compus/<an>/buletin-<nr>-<data>.json` (scrisă la fiecare compunere, din `/nou` și din acțiune) sau
  textul PDF-ului din arhivă (`mottoDinText`, sedile → virgule); (4) **articolul gol se umple cu text
  de probă la vedere** (`umplere.ts`: NUME AUTOR, 1999-1999, TITLU ARTICOL, Lorem ipsum, Sursa: -),
  `plangeriDeForma` nu se mai plânge de goluri, acțiunea are autor/titlu/text opționale; (5) **cât
  încape la programul întreg**, un secundar 1/4, doi 1/2 — împărțeala era deja a socotelii.
  ⚠️ **Lorem ipsum e mai lat decât româna**: 106 semne pe dinafară la măsura socotelii; calibrat
  `LOREM_FATA_DE_ROMANA = 0.975`, probat pe randare la 0/1/2 secundari (0 pe dinafară, gol 6 mm) cu
  `proba-foaie.mjs --gol`, mod nou al uneltei. 494 de probe trec (16 noi: `tests/buletin-umplere.test.ts`
  + 5 în `buletin-newsletter.test.ts`), tsc curat la buletin și program. Probe vizuale în spațiul
  agentului: `outputs/buletin-gol-{un-autor,1-secundar,2-secundari}.pdf`.
- **CAPUL PAGINII 1 ȘI ARTICOLELE, ȘASE RETUȘURI — buletin 0.5.2 (publicat)**. Userul, 22:37–22:39:
  (1) motto-ul la **jumătate** din depărtarea față de titlu + parohie (`.motto` fără margin-top; golul
  văzut 5.3 → 2.7 mm); (2) titlul foii e **„BULETINUL BISERICII"**; (3) aerul dintre cruce și titlu
  **dublat** (1 → 2 mm); (4) **crucea nu mai e centrată pe pagină: stâlpul ei cade pe stâlpul L-ului
  din BULETINUL** — stă absolut, ancorată de `<span class="l">` din jurul literei (`left: 2.45mm`,
  `top: -19.6mm`, măsurate pe randare la 200 dpi; titlul are `padding-top` cât crucea); (5) poza
  principală cu **chenar negru 3 px**; (6) **titlurile secundarilor Trajan Regular, fără aldin** — Bold-ul
  a stat în foaie câteva minute; `resurse/TrajanPro3-Bold.otf` rămâne, dar nu se mai încorporează;
  (7) **cel puțin 1 cm între articole**: clasa `incepe-articol` pe prima bucată a fiecărui secundar
  (`margin-top: 10mm`, zero când deschide o coloană — `.col > .incepe-articol:first-child`), iar în
  socoteală `INALTIMI.aerIntreArticole = 1.7` rânduri pe secundar; `antet` 6.4 → 6.6, `motto` 3.6 → 3.2.
  ⚠️ Capcană: **fără backtick-uri în comentariile din `STIL`** — e un template literal, un backtick în
  comentariu îl închide și tsc dă erori fără sens două-trei linii mai jos.
- **TRAJAN PRO 3 ADEVĂRAT — buletin 0.5.1, program 0.7.8 (publicate seara, la „Deploy")**. Userul a trimis
  familia Trajan Pro 3 (are abonament Adobe, „e liber din Adobe Fonts"). Constatare: Regular-ul folosit
  până acum era **extras dintr-un PDF** (PdfGrabber, fără kerning); în zip erau 6 tăieturi la fel
  (Black…SemiBold, 931 glife, cu diacritice) și un **Regular Adobe original** (v1.012, 1401 glife, GPOS).
  Făcut: Regular-ul original în `resurse/` la buletin și program; `TrajanPro3-Bold.otf` la buletin,
  `@font-face` 400/700, `.titlu-articol` fără `-webkit-text-stroke`. Curgerea pe nr. 615 neschimbată
  (8 886 semne, 0 afară, 7 coloane, gol 6 mm). Întrebarea lui despre **Cambria/Calibri**: sunt fonturi
  Microsoft, nu Adobe — Caladea/Carlito au aceleași lățimi, dacă vrea desenul întocmai le trimite din
  Windows. ⚠️ Colateral, de văzut: în PDF apare și `LiberationSerif-Italic` — Caladea Italic n-are un
  semn din motto. Publicarea a dus online și tot lucrul de mai jos (API-ul buletinului).
- **API-UL CARE COMPUNE BULETINUL — buletin 0.5.0, program 0.x (NEPUBLICATE)**. Cerere a userului,
  seara: antetul fix + `.motto`/`.nr`/`.data` ca start, două coloane pe toate patru paginile, un
  autor principal (poză mare + zonă neagră + titlu + text + sursă) și cel mult doi secundari,
  calendarul de pe pagina a patra „rândat exact ca la tipar", și **lungimea textului calculată
  pentru toate variantele**. Trei hotărâri ale lui pe parcurs: socoteala **spune cât încape, nu
  taie**; livrăm **API + ecranul `/nou`**; grafica fixă se **scoate din PDF-ul ultimului număr**
  (apoi: „ai la dispoziție toate buletinele din urmă"); iar sistemul să poată fi condus de **un AI
  mic**, „cum am făcut la Programul liturgic".
  **Ce s-a făcut**: `masuri.ts` (geometria + socoteala), `foaie.ts` (cele 4 pagini, curgerea în
  pagină), `compune.ts` (calendar → randare → depozit), `actiuni.ts` (`buletin.masura` ca fundal,
  `buletin.socoteala`, `buletin.compune`), formularul din `/nou` cu socoteală vie, `pdfCuRaport` în
  `@xc/ui`, iar în program `tabelProgram()` + `stilTabel()` + ruta `/v1/tabel-tipar`.
  **Măsurătoarea care a schimbat totul**: corpul de literă al foii e **15 pt, nu 12** — interlinia de
  16.5 pt m-a dus întâi la 12, iar socoteala ieșea cu 45 de semne pe rând în loc de 37 (un articol
  întreg în plus). S-a prins numărând semnele pe propria randare și comparând cu arhiva.
  **Probele**: socoteala prezice 9028 de semne, intră 9053, 0 pe dinafară, pe toate cele patru
  variante; refactorul programului e neutru la pixel; 472 de probe trec.
  **Neprobat**: ruta vie (`pnpm dev` nu răspundea) și Browser Rendering — vezi NEXT 0a.
- **A DOUA RUNDĂ, 21:38–22:00 — șlefuirea după ochiul userului și proba de fidelitate.** Cerințe
  venite una după alta: titlul foii caps + aldin, parohia mai mare, titlul articolului aldin; **regula
  coloanei întâi** („doar imaginea și zona neagră"); placeholder de poză; calendarul strâns pe două
  trepte (fără sfinți, apoi fără pericopă); golul deasupra calendarului 6 mm / 3 mm la nevoie; floarea
  (trimisă pe Slack); `buletin.reguli` pentru un model simplu. Apoi: „**să refacem buletinul trecut**
  … doar cu metodele API" — nr. 615 refăcut din PDF (text fără diacritice → puse la loc din
  articolul-sursă) și comparat pagină cu pagină: aproape identic, al nostru puțin mai dens.
  Întrebarea lui de principiu („aș fi preferat o variantă controlată din CSS și calculată JS… cum crezi
  că un AI s-ar descurca mai bine, ceva de nivelul Sonnet") — răspuns în Slack: asta ȘI este (CSS-ul
  dă măsurile, JS-ul din pagină curge și numără), iar socoteala aritmetică e stratul de deasupra care
  scutește modelul de bucla randează-scurtează-randează.

- **CHENARELE DE STARE SE VĂD NUMAI LA ADMIN — website 0.7.3** (seara, „voiam doar admin";
  **NEPUBLICAT**). `corp(nav, eAdmin)` în `apps/home/src/index.ts`: butoanele, numele și adresele
  sunt aceleași pentru toată lumea, se stinge doar culoarea chenarului. Poarta e `eAdmin` din
  sesiunea EFECTIVĂ, deci masca „vezi ca" le stinge singură — super-adminul previzualizează ușa
  omului. Probe noi: `tests/usa-website.test.ts` (8; 454 în repo).
  - ⚠️ **Prima scriere a probelor trecea pe o cauză greșită**: cererea n-avea cookie, deci
    `sesiuneCurenta` întorcea sesiunea anonimă fără să cheme identitatea, și „adminul" primea tot
    ușa omului. A doua capcană, tot tăcută: `scope: '*'` **nu e scope valid** (`global`,
    `parish:<id>`, …), iar o sesiune care nu trece de zod se preface în cea anonimă. Amândouă arată
    ca o probă verde care nu probează nimic — la orice probă de rol, verifică întâi că sesiunea
    falsă chiar e citită.
  - ⚠️ **Cache-ul e curat din întâmplare, nu din grijă**: ușa anonimă poartă `public, max-age=300`,
    dar adminul e mereu „intrat", deci primește `private, no-store`. Dacă cineva schimbă vreodată
    regula aia de cache, chenarele pot ajunge în cache-ul public. O probă o păzește.

- **ORDINEA COLILOR BROȘURII E BUNĂ** (seara, „Este bine ordinea") — probată la imprimantă pe
  `outputs/buletin-615-brosura-A4.pdf`. Formula colilor și probele din `tests/` rămân neatinse;
  subiectul e închis, nu-l redeschide „ca să simplifici".

- **PUBLICAT: buletin 0.4.1 pe producție** (seara, la cuvântul userului). `npx wrangler deploy --env
  production -c apps/buletin/wrangler.jsonc`, versiunea `480fae96`; `buletin.sfantul-ilie.ro` răspunde
  200 și arată 0.4.1. Intră pe live „Descarcă" + „Tipărește" (broșura A4→A5) și capul paginii `/nou`.
  ⚠️ Wrangler scrie la final **„No targets deployed"** — nu e eroare: domeniul custom e deja legat,
  deci n-are rută nouă de făcut. Uită-te la versiunea servită, nu la rândul ăla.

- **BULETINUL (A3): MENIUL DIN ANTET, REFĂCUT CA LA CALENDAR ȘI PROGRAM** (user, după-amiaza).
  Buletin **0.4.0**, deocamdată **numai local** — nepublicat pe producție.
  Cererea, în trei puncte: Abonarea singură la dreapta; pastila la stânga, care începe cu **bulina
  roșie** a numărului curent, apoi **scrisul** („buletinul curent sau buletinul nou, depinzând de
  secțiunea în care intrăm"), apoi **Arhiva și căutarea**; iar **înaintea Arhivei, o săgeată** care
  duce la buletinul nou.
  - **Același tipar ca la A8 pe 15.09**: pastilă cât tot rândul — bulină · zona de scris · săgeată ·
    Arhiva · lupa —, abonarea afară la dreapta. A căzut rândul din V1 (abonarea întâi, liniuța
    despărțitoare, două butoane mici) și **formularul de căutare de sub antet**: lupa e acum **cheie**
    care coboară o bară, iar cheia Arhivei coboară **fâșia anilor**, ca la Program.
  - ⚠️ **Pătrățelele cu ani au ieșit din corpul paginii Arhivei** (ca la A8): anii se aleg dintr-un
    singur loc, fâșia. Pe `/arhiva` fâșia stă coborâtă și cheia e inertă — altfel omul ar putea
    strânge singurul drum către ceilalți ani.
  - **Bulina duce la `/`**, care CHIAR e numărul curent — deci nu mai e nevoie de o a doua întrebare
    la depozit ca să știm unde duce. Pe pagina unui număr, „ești pe cel curent" se citește din
    **vecini** (cel fără urmaș e cel curent), nu dintr-o cerere în plus.
  - ⚠️ **Săgețile „◀ numărul dinainte / numărul următor ▶" de sub un număr RĂMÂN** — la buletin ele
    răsfoiesc arhiva de hârtie, nu țin loc de meniu (spre deosebire de A8, unde au ieșit).
  - **`/nou` — ecranul buletinului care urmează**, numai pentru admini (poarta e rolul, ca la A8):
    **numărul NOU cu ROȘU, numărul de după el cu VERDE deasupra, iar dedesubt ziua numărului nou** —
    prima duminică de azi înainte — și un **chenar gol cât pagina întâi a unui număr** („ce punem în
    pagină mai vedem"). Roșul e roșul bulinei: culoarea numărului de care ne ocupăm acum. ⚠️ Verdele
    nu poate fi `--azi` ca atare (#12D96A se citește palid pe hârtie albă): ziua are un verde închis
    al ei, iar noaptea se întoarce la `--azi`.
    ⚠️ **ROȘUL E NUMĂRUL NOU, NU ULTIMUL DIN ARHIVĂ.** Când a cerut ecranul („scriem numărul 616, dar
    cu roșu"), userul lucra tocmai la **616 / 20.09** — schița tipărită de aseară —, iar în arhivă cel
    mai nou e **615 / 6.09**. Deci roșu = ultimul din arhivă **+ 1**, verde = încă unul peste (617),
    iar ziua e duminica celui roșu. Numerele nu se scriu în cod: ies din arhivă și se mișcă singure
    când intră un număr nou.
  - **Probe**: 12 noi în `tests/buletin-newsletter.test.ts` (50 în fișier, toate trec) — ordinea
    segmentelor, abonarea afară, scrisul pe fiecare fel de pagină, barele care coboară, arhiva goală
    și socoteala duminicii (inclusiv „o duminică deja apărută nu se cere a doua oară").

- **BULETINUL 0.4.1: DESCARCĂ, TIPĂREȘTE (broșură) și capul paginii „buletin nou"** (user, seara).
  - **Butonul „Răsfoiește" a devenit „Descarcă"**, cu iconiță de descărcare, iar lângă el a intrat
    **„Tipărește"**. ⚠️ **Răsfoitul n-a ieșit, a ieșit BUTONUL lui**: coperta deschide mai departe
    fereastra cu FlipBook (`data-rasfoit`). Descărcarea merge prin **`?descarca=1`**, nu doar prin
    atributul `download` — acela e numai pentru browserele de birou, pe iPhone ar fi deschis foaia.
  - **BROȘURA: `/tipar/<nr>-<data>.pdf`**, făcută cu **pdf-lib** din PDF-ul numărului (`src/tipar.ts`).
    Patru pagini A4 → **două coli A4 culcate**: fața `[4|1]`, versoul `[2|3]`; se tipărește față-verso
    și se îndoaie — **iese o broșură A5** (cerut anume: „A4 imprimanta / booklet și îndoit, în final e
    un A5 îndoit"). `?coala=a3` păstrează mărimea naturală (A4 → A3) pentru un copiator mare.
    ⚠️ **Ordinea nu e la nimereală**, e formula broșurii: coala `s` → fața `[n-2s, 1+2s]`, versoul
    `[2+2s, n-1-2s]`; ce nu e multiplu de patru se completează cu **pagini albe**, nu se taie. Probele
    o păzesc — o coală așezată greșit se vede abia după ce s-au tipărit 60 de exemplare.
    ⚠️ **Se ține în R2 sub `tipar/…`**, cu felul colii în cheie: prima apăsare o face, restul o iau
    gata. Un număr fără PDF (două vechi) dă 404, nu o broșură goală.
  - **Capul paginii `/nou` e acum cel de la orice număr** (user: „textul cu verde de deasupra vroiam
    să fie la fel ca la oricare buletin, un text mic… aici vroiam să scrie numărul următor"): eticheta
    măruntă **„NUMĂRUL URMĂTOR", verde**, numărul mare **roșu**, ziua sub el. **Al doilea număr mare
    (617) a ieșit — nu-l readu.** ⚠️ Verdele nu mai e `--azi` (#12D96A, „prea aprins"): e un verde de
    cerneală, `#0A6B41`, iar noaptea `#5FBF8D`.
  - **Probe**: 56 în `tests/buletin-newsletter.test.ts` (ordinea broșurii, numele cheilor, butoanele,
    numărul fără PDF); **446 în tot repo-ul**.

- **TOT CE E ONLINE E ȘI LOCAL** (cerere a userului: „preia baza de date fișiere… ca să văd exact ce
  e online și local"). Unealtă nouă, reluabilă: **`infrastructure/import/adu-local.mjs`**
  (`--chiar`, `--doar`, `--fara-r2`, `--si-grele`; fără argumente doar socotește).
  - ⚠️ **`pnpm dev` trebuie OPRIT cât ține aducerea**: ține aceleași fișiere de stare deschise și
    oricum nu vede datele noi decât repornit. Unealta se oprește singură dacă îl găsește pornit.
  - ⚠️ **D1 nu se importă cu `wrangler d1 execute --file`**: exportul scrie INSERT-uri cu mii de
    rânduri într-o singură instrucțiune, iar motorul local le refuză cu **`statement too long:
    SQLITE_TOOBIG`** (pățit la calendar) — baza rămâne pe jumătate, fără ca ceva să pară stricat.
    Importul se face acum pe fișierul sqlite, prin `node:sqlite`. Fișierul bazei nu se poate ghici
    (Miniflare îl numește cu un hash), deci se pune un **martor** printr-o comandă wrangler și se
    caută fișierul care-l are — prin sqlite, nu cu grep pe octeți: cu WAL, martorul proaspăt încă nu
    e în fișierul mare.
  - ⚠️ **Importul merge cu CHEILE STRĂINE STINSE**: exportul scrie tabelele în ordinea lui, nu în
    ordinea legăturilor (la curățenie `assignments` vine înaintea lui `volunteers`), iar `PRAGMA
    defer_foreign_keys` din capul exportului nu ajunge — el amână verificarea până la capătul unei
    tranzacții, și nu e niciuna.
  - ⚠️ **R2 nu se scrie cu `wrangler r2 object put`**: pornește un proces de fiecare obiect (**3 s**
    bucata, adică ore la 1.891 de fișiere). Se scrie printr-un **worker efemer** pornit cu
    `wrangler dev` pe aceeași stare — aceleași căi ca la `pnpm dev`, fără să ținem noi minte formatul
    lăuntric al Miniflare.
  - ⚠️ **`biserica-transmisiuni` (33 GB) NU se aduce local** — regula e pe **prefix**: ce n-are `xc-`
    e din V1, refolosit dinadins, și n-are ce căuta într-o copie de lucru. `--si-grele` îl aduce
    totuși, dacă vreodată chiar se cere.

- **UȘA WEBSITE-ULUI: SEMNE DE STARE PE CĂSUȚE, TITLU NOU, TIPICUL MUTAT** (user, seara).
  `apps/home` **0.7.2, PUBLICAT pe producție**.
  - **Titlul din antet e acum `WEBSITE`, nu `PLATFORMA`** (`comune.nume`). ⚠️ Au rămas neschimbate,
    fiindcă n-a cerut: `titlu: 'Platforma parohiei'` (ce scrie în filă) și eticheta `'Platforma'` a
    secțiunii de Setări — de întrebat dacă merg și ele pe „Website".
  - **Chenar verde** („aici stăm bine, am avansat destul") la **Calendar, Program, Radio**; **chenar
    roșu** („urgent de rezolvat") la **Transmisiunea în direct** și **Curățenie**. Restul căsuțelor
    rămân cum erau.
  - ⚠️ **Regula „toate butoanele arată la fel" (user, 10.09.2026) s-a RĂSTURNAT.** Semnul stă în date,
    nu în stil: `stare?: 'bine' | 'urgent'` pe rândul aplicației din `APLICATII`, clasele
    `.bine`/`.urgent` pe `<a>`. Se mută de la o căsuță la alta schimbând un cuvânt.
  - **Chenarul e SUBȚIRE, 1px, ca al celorlalte căsuțe** (a cerut anume, după ce prima variantă avea
    2px): se deosebește numai culoarea, nu și grosimea. Culorile sunt ale carcasei — `--azi` și
    `--rosu` —, deci merg și pe tema întunecată. Regulile stau **după** `:hover` și repetă starea și
    pe hover, altfel hover-ul ar spăla culoarea.
  - **Ordinea**: **Tipicul a schimbat locul cu Transmisiunea în direct** (poziția 3 ↔ 6). Radioul a
    rămas lângă Program, de unde vin slujbele care se transmit.
  - ⚠️ **Semnul e de lucru, dar ușa e PUBLICĂ** — enoriașul vede chenarul roșu fără să știe ce
    înseamnă. I-am spus înainte de publicare; a cerut publicarea. De scos când starea se schimbă.
  - ⚠️ **Capcană, a doua oară**: un comentariu CSS scris cu backtick-uri rupe template literal-ul
    `LOCAL_APP` — `tsc` dă „',' expected" pe rândurile de stil. În stiluri, comentarii fără backtick.
  - ⚠️ **Prima publicare a dus codul nou cu VERSIUNEA VECHE**: `/health` scria `0.7.1` deși
    `package.json` era deja `0.7.2` și pagina arăta schimbările. A doua publicare a pus-o la loc.
    **Deci verifică `/health` după fiecare deploy** — dacă versiunea e în urmă, republică.

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
