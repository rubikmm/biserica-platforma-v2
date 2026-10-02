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

00j. ✅ **02.10.2026, 16:50–16:54 — subdomeniile program, buletin, calendar, tipic, biblia, biblioteca fac 301 spre
    `https://sfantul-ilie.ro/<app>/<cale>`** (comitul `f2e8618`, desfășurat pe producție; aplicațiile sunt servite pe apex
    de workerele V3). Version ID-urile și probele: jurnalul 02.10. Rămân pe subdomenii: curatenie, newsletter, home, live, radio.

00i. ✅ **PUBLICAT 21.09.2026, 00:47–00:52** — PROGRAMAREA săptămânii + „PUBLIC DOAR CE E CURENT" la PROGRAM (program 0.9.6 → **0.11.0**, Version ID `110c4213-443c-41af-b179-ea558dfcc30b`) + buletin 0.17.0 → **0.18.0** (`64079844-bcd0-42da-9d9d-fc29824f995c`). Migrația 0003 aplicată pe producție înaintea workerului; cronurile păstrate. Amănuntele și probele de după publicare: jurnalul 20.09, blocul „Publicat 21.09". **Nimic de făcut mai jos — se păstrează doar ca istoric.**
    Cererea userului (22:47): „La programul liturgic aceeași poveste cu Validare și publicare / Validare și programare, la fel
    ca la Buletinul bisericii."; apoi (23:33) „Buletinul și programul sunt programate D-12:00, adică atunci devin curente și
    publice" + „Public arătăm doar ce e curent". Regulile durabile: „Programul (A2)" → „Programarea, din 20.09.2026" și
    „Vizibilitatea și săptămâna curentă, din 20.09.2026"; amănuntele zilei: jurnalul din 20.09.2026.
    Probe: `tests/program-programare.test.ts` (52) + `tests/program-vizibilitate.test.ts` (51 noi), suita 1292/1292,
    typecheck 36/36, mutanți 11/11 pe cernere.
    **DE FĂCUT, în ordinea asta** — ⚠️ **migrația 0003 → program → buletin**, fiindcă buletinul are nevoie de UȘA INTERNĂ
    (`x-xc-intern`) ca să mai primească tabelul unei săptămâni nepublicate:
    1. ✅ **migrația**: `node infrastructure/migrations/ruleaza.mjs --remote --env production --chiar-productia --doar program`
       (aplică 0003; ALTER **fără** `IF NOT EXISTS`, deci o singură rulare pe mediu) **ÎNAINTEA** workerului;
       — **rulată 21.09, 00:47**: `0001 ok, 0002 ok, 0003 ok`, 656 săptămâni / 2625 slujbe neatinse. **Nu o repeta**: a doua oară cade pe „duplicate column name".
    2. ✅ `wrangler deploy` pe **program** (0.11.0) — **21.09, 00:49**;
    3. ✅ **apoi buletinul** — **PUBLICAT 21.09, 00:52**, buletin 0.17.0 → 0.18.0. **FĂRĂ MIGRAȚIE** (nicio
       coloană nouă; tot ce se păstrează în plus intră în JSON-ul din R2, `compus/…json`). Are antetul intern pe
       `/v1/tabel-tipar` (`apps/buletin/src/compune.ts`) și, la validare, cere programul VALIDAT — 409 pe propus,
       503 pe program mut, recompunere când s-a schimbat (regulile durabile: „BULETINUL — foaia tipărită" →
       „PROGRAMUL VALIDAT LA VALIDARE, din 21.09.2026"; amănuntele: jurnalul 20.09, blocul de la 21.09, 00:10).
       ⚠️ ÎNTRE 2 și 3 E O FEREASTRĂ în care compunerea buletinului pe o săptămână încă nevalidată primește
       `404 {ok:false, cod:'nepublicat'}` și ecranul `/nou` scrie „Programul nu e publicat încă." Nimic nu se strică, dar
       cele două urcări se fac una după alta, nu la zile distanță. (Nota veche „Buletinul NU se republică" NU mai e valabilă.)
       ⚠️ **De verificat ÎNAINTE de deploy** că `SECRET_INTERN` e pus pe `xc-buletin-staging` ȘI pe
       `xc-buletin-production` (`npx wrangler secret list --env staging|production` din `apps/buletin`): e secret
       Cloudflare, nu `vars`, deci nu se vede în `wrangler.jsonc`. Pe producție a fost pus pe 20.09.2026 (rotit pe
       toți cinci — `infrastructure/cutover/secrete-productie.sh` are `apps/buletin` în `CU_ACTIUNI`, dar rulează
       **numai `--env production`**); pe **staging nu e nicăieri scris că s-a pus** (lista din 11.09 avea doar
       program/calendar/tipic/chat), iar **pe local nu există deloc**: singurul `.dev.vars` din arbore e al lui
       `chat-worker` și n-are `SECRET_INTERN`. Fără el, ușa internă rămâne închisă și `/nou` nu mai compune
       săptămâna viitoare — iar mesajul din ecran o spune pe nume.
    4. de verificat în `/schedules` că programul chiar are cronul înregistrat (buletinul căzuse acolo pe `0` ca zi a săptămânii;
       al programului e `*/5 * * * *`, fără zi, deci n-ar trebui — dar se uită ușor);
    5. aceeași santinelă lipsă ca la buletin (vezi 00h.1): un cron căzut lasă săptămâna `propus` cu ceasul pe ea, iar
       programul NU apare duminică și nimeni nu află. Aici e mai rău decât la buletin: acum, cu „public doar ce e curent",
       un cron căzut înseamnă că prima pagină rămâne pe săptămâna trecută — vizibil pentru toată parohia.
    6. **WordPress-ul (prima pagină) n-are nevoie de nicio schimbare** — verificat în
       `docs/runbooks/wp-program-prima-pagina.md`: `sfilie_program_bucata()` cere `200` ȘI `'validat' === $d['stare']`, iar
       la orice altceva ține ultima copie bună (`sfilie_program_ultima_buna`) și reîncearcă peste 5 minute. Un 404
       `nepublicat` cade exact pe ramura aceea. Rămâne o îndreptare **de dorit, nu de nevoie**: ritmul orar aliniat la
       minutul 0 face ca săptămâna apărută duminică la 12:00 să ajungă pe prima pagină la 13:00 (vezi jurnalul 20.09).

00h. **PROGRAMAREA numărului de buletin (validare înainte de duminică, ora 12:00) — scrisă pe 20.09.2026, după-amiaza (buletin 0.17.0).**
    Cererea userului (13:56): „dacă este înainte de ziua pentru care este programat buletinul — adică înainte de ora 12.00,
    duminica aceea — se poate doar «Validează și programează»; dacă este duminică după ora 12.00 — «Validează și publică»";
    (14:11): „să fie o programare reală — adică din uneltele de cron din Cloudflare"; (13:58) iconița de anulare verde cât e
    programat + „dacă s-a validat și publicat și a început lucrul la ciornă să nu se mai poată anula publicarea acelui număr —
    dar să am posibilitatea să șterg ciorna — resetare complet la zero". Regulile durabile: „BULETINUL — foaia tipărită" →
    „PROGRAMAREA, din 20.09.2026"; amănuntele zilei: jurnalul din 20.09.2026. **Publicat 20.09, 14:59** (migrația pe D1 de producție, apoi worker 0.17.0, versiunea `f8361da2`; cron înregistrat `*/5 9-10 * * SUN`).
    **Deschise, în ordinea în care dor**:
    1. ⚠️ **cronul căzut n-are alarmă**: dacă `scheduled` nu rulează duminică între 09 și 10 UTC, numărul rămâne `programat`
       până duminica următoare — nu scapă public, dar NU apare, și nimeni nu află. De pus o santinelă (audit
       `buletin.publica-programat` citit de dispecerat ori un al doilea cron care se plânge);
    2. **de întrebat userul**: ce vrea să se întâmple cu un număr rămas neapărut — publicare de mână dintr-un buton, trecere
       automată la prima intrare a adminului pe `/nou`, ori doar alarmă?
    3. poarta fișierelor costă o căutare pe cheia primară la fiecare foaie cu ziua trecută (mic, dar e pe drumul cald);
    4. migrația `0002_programare.sql` e ALTER **fără** `IF NOT EXISTS` — o singură rulare pe mediu; la orice refacere a bazei,
       ordinea e migrația întâi, workerul pe urmă.

00g. **RETRAGEREA unui număr publicat greșit + justify la piciorul coloanelor — scrise pe 20.09.2026, dimineața (buletin 0.16.0).**
    Cererea userului (08:07): „Trebuie să avem și buton de ne-publicare — dacă s-a publicat greșit — și să poată face asta
    și chat-ul"; (08:11): „col2, jos, nu mai este justify". Amănuntele în jurnalul zilei (20.09.2026).
    ✅ **PUBLICATE pe 20.09.2026, 08:54** (user: „1" = tot, în ordine), împreună cu runda de aseară (rolul global `admin`
    stins, carcasa cu `ca=admin:<cod>`): authz 0.4.0 → identity 0.4.0 → account 0.2.5 → admin 0.6.0, calendar 0.8.4,
    program 0.9.6, buletin 0.16.0, curatenie 0.4.3, tipic 0.4.3, biblia 0.1.8, biblioteca 0.1.8, newsletter 0.6.5,
    home 0.7.8 — toate 200 cu versiunea în subsol (cont/admin 303 la anonim, normal). Cele două rânduri `role='admin'` din
    producție se mutaseră la 08:05 (Gabriel → super-admin, Laura → admin la curățenie).
    ✅ **`live` și `radio` publicate 20.09, 15:50, ca 0.2.0** (după slujbă, `/v1/stare` verificat: `live:false`, următoarea
    slujbă marți 18:00) — poartă și rândul cosmetic de aici (`Cont.cod`, „→ Administrator" merge acum și pe ele), și
    Setările cu rubrica „Emisia" (jurnal 20.09, după-amiaza). Regula rămâne: **Durable Objects → nu se republică în slujbă**;
    întâi `GET https://live.sfantul-ilie.ro/v1/stare` (public), apoi radio ÎNAINTEA lui live.
    ⚠️ Găsit la publicare (wrangler `--dry-run`): la **calendar, program, tipic** `SECRET_INTERN` e la nivelul de sus al
    `wrangler.jsonc`, nu în `env.production.vars` — wrangler avertizează că nu se moștenește. Probabil e secret Cloudflare
    în producție (funcționau și înainte), dar de verificat că fluxurile interne care-l folosesc chiar merg.
    **Deschise, în ordinea în care dor**:
    1. `buletin.retrage` apare ca bifă NEbifată în Setări → „Chat AI" (lista vine din manifest). Azi e cosmetic — harta
       deterministă nu trece prin poarta `unelte` din KV —, dar dacă harta iese vreodată, retragerea ar tăcea;
    2. curgerea lasă un `<p class="t">` GOL într-o coloană rămasă fix fără loc (`taie()` cu `bun = 0`, `foaie.ts`) —
       invizibil, nu strică socoteala, dar e gunoi în DOM; de curățat;
    3. `schita/arhiva/…` nu se curăță niciodată (câțiva KB pe număr publicat) — lăsat așa dinadins;
    4. retragerea n-are prag de timp: cât nu apare alt număr, cel curent se poate retrage oricând.

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

> [arhivat automat 2026-09-29] 5 secțiuni datate 2026-09-12…2026-09-14 → docs/jurnal/2026-09.md

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
  - ✅ **PORNITĂ pe producție pe 20.09.2026, seara** (user: „Reia"): `LIVRARE_REALA: "da"` numai în `env.production`; dev și staging rămân „nu".
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

> [arhivat automat 2026-09-30] 2 secțiuni datate 2026-09-15…2026-09-15 → docs/jurnal/2026-09.md

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

### Programarea, din 20.09.2026

User: „La programul liturgic aceeași poveste cu Validare și publicare / Validare și programare, la fel
ca la Buletinul bisericii." Deci `program.valideaza_saptamana` face **același lucru**, iar ce se
întâmplă hotărăște **ceasul**, nu omul. Nu există „publică oricum".

- **PRAGUL unei săptămâni = DUMINICA DINAINTEA EI, ora 12:00 a Bucureștiului** (`luni − 1 zi`).
  Nu lunea ei. Motivul e al hârtiei: buletinul de duminica D tipărește pe pagina a patra programul
  săptămânii care începe luni D+1, iar cele două se dau enoriașilor în aceeași clipă, la ieșirea de la
  Liturghie. **Aceeași clipă, o singură socoteală**: `packages/ui/src/prag.ts` (`pragPublicarii`,
  `pragScris`, `seProgrameaza`, `candApare`, cu decalajul cerut de la ICU — 09:00Z vara, 10:00Z iarna).
  `apps/program/src/ceas.ts` = doar traducerea „cheia săptămânii → ziua de prag"
  (`duminicaDinainte`, `pragSaptamanii`, `seProgrameaza`, `candApareSaptamana`);
  `apps/buletin/src/ceas.ts` = re-export din `@xc/ui`, cu numele buletinului.
- **ÎN BAZĂ NU E NICIO STARE NOUĂ.** O săptămână e **programată** când `stare = 'propus'` **ȘI**
  `programat_la IS NOT NULL` (migrația `0003_programare.sql`: două coloane + index pe `programat_la`).
  CHECK-ul de pe `saptamani.stare` n-a fost atins — o stare nouă ar fi cerut refacerea tabelului peste
  datele parohiei, pentru un cuvânt. Întrebarea se pune printr-un singur loc: `eProgramata(rand)` din
  `depozit.ts`, care citește **COLOANA, nu ceasul** (lecția buletinului: un singur adevăr, cel din bază).
- **`programat_la`** = clipa ANUNȚATĂ (ISO UTC); **`programat_de`** = cine a apăsat. La trecere ajung
  chiar în `validat_la` / `validat_de`: validarea rămâne a omului, la ora pe care a citit-o pe buton.
- **CRONUL** (`*/5 * * * *`, deja în toate trei blocurile din `wrangler.jsonc`): `scheduled` →
  `treciLaValidat` (un singur `UPDATE … WHERE stare='propus' AND programat_la IS NOT NULL AND
  programat_la <= ?`, deci idempotent prin chiar forma lui), istoric `'validat'` și eveniment
  **`program.week.validated.v1` per săptămână** — de aici pleacă anunțul —, apoi `golesteOutbox`, în
  aceeași bătaie. La PROGRAMARE se scrie doar `program.week.changed.v1`: trimis atunci, anunțul ar fi
  ajuns la enoriași marți, pentru o săptămână care încă n-a început.
- **RETRAGEREA pe o săptămână programată = anularea programării** (`programat_la/de = NULL`, starea
  rămâne `propus`, istoric `'retras'` cu `din: 'programat'`). ⚠️ Refuzul vechi „e deja «propus»" se dă
  **numai dacă nu e programată**: o programată are tot `propus` scris pe ea, iar refuzul ar fi lăsat-o
  să apară singură duminică, după ce omul tocmai ceruse să n-o facă.
- **MODIFICĂRILE RĂMÂN PERMISE** și nu strică programarea: cronul validează **ce e în bază la prag**,
  nu ce era când s-a apăsat. O slujbă adăugată joi intră firesc în programul care apare duminică.
- **VIZIBILITATE**: pentru lume (site, `/v1/*`, enorias) săptămâna e `propus`, cum și este — contractul
  `STARI_SAPTAMANA` e neschimbat, `saptamanaDin` nu poartă coloanele noi, iar `arhivaIntreaga` își
  scrie coloanele **pe nume** tocmai ca ele să nu iasă pe `/v1/arhiva.json`. Numai **adminul
  programului** vede, pe pagina săptămânii, eticheta verde „Programată — apare duminică, …, la ora
  12:00" în locul lui „propus" (`.stare.programat`, `#0A6B41` / `#5FBF8D`). Foaia A4 (`/v1/foaie`)
  rămâne doar a săptămânilor `validat`.

### Vizibilitatea și săptămâna curentă, din 20.09.2026

User (23:33): „Buletinul și programul sunt programate D-12:00, adică atunci devin curente și publice";
„Public arătăm doar ce e curent" — confirmat anume **și pentru live**: transmisiunea pornește numai din
săptămâni validate. Program **0.11.0**.

- **PUBLICAT ⟺ `validat`.** O săptămână `propus` — inclusiv una PROGRAMATĂ, care tot `propus` scrie pe ea —
  nu există pentru lume: nici pagina ei, nici arhiva, nici `/v1/*`, nici ca slujbă întoarsă de
  `/v1/urmatoarea`. Publicarea o face **ceasul** (`treciLaValidat`), la prag; nu se deduce nicăieri dintr-o
  dată pusă lângă `Date.now()`.
- **O SINGURĂ CLAUZĂ**, în `apps/program/src/depozit.ts`, după chipul buletinului:
  `Vedere = VEDE_TOT | LUMEA`, `vedereaLui(eAdmin)`, `cerne(v, alias?)` = `stare = 'validat'` și
  `cerneSlujbe(v)` = `luni IN (SELECT luni FROM saptamani WHERE stare = 'validat')` — o slujbă se vede dacă
  **săptămâna ei** se vede. Toate citirile o cer ca parametru **obligatoriu** (`saptamana`,
  `slujbeleSaptamanii`, `slujbeInterval`, `saptamaniInterval`, `saptamanileAnului`, `aniiArhivei`, `vecinele`,
  `istoriculSlujbelor`, `urmatoareaSlujba`, `slujbaCurenta`, `slujbeTrecuteDupaNume`, `urmatoareaDupaNume`,
  `tiparele`, `arhivaIntreaga`). ⚠️ **Obligatoriu, nu cu implicit `VEDE_TOT`**: un implicit ar fi lăsat orice
  apelant nou să vadă tot, tăcut. Clauza n-are niciun `?N` (e o constantă), deci nu mișcă numerele celorlalte.
- **SĂPTĂMÂNA CURENTĂ = ULTIMA PUBLICATĂ**, nu cea calendaristică: `saptamanaCurenta(db, azi)` =
  `MAX(luni)` dintre `validat` cu `luni <= luneaSaptamanii(azi) + 7`. ⚠️ **Marginea** taie o săptămână
  validată din import, prea departe în viitor. Duminică de la 12:00, după ce cronul a trecut săptămâna
  următoare, **ea** e curentă — pe `/`, în bulina din antet (`Meniu.curenta`, `pagini.ts`) și pe prima pagină
  a sitului. **La fel pentru admin**: „adminul vede ce vede lumea, plus în plus".
  Fără nimic publicat: admin → săptămâna calendaristică cu propunerea ei (de acolo o validează);
  lume → pagina „Programul nu e publicat încă." (fără propunere).
- **Paginile**: `/saptamana/<data>` public doar pe `validat`, altfel **404** cu același mesaj (ca la o adresă
  greșită). Adminul deschide tot, cu eticheta lui. **Săgeata „săptămâna viitoare" se STINGE la enoriaș**
  (`.btn viit gol`, title „apare duminică, la ora 12:00") — nu se ascunde (regula rândului de unelte) — fiindcă
  săptămâna de după cea curentă nu e publicată **prin definiție**. Arhiva publică ține numai `validat`.
- **UȘA INTERNĂ — CONTRACT FIX, nu-l schimba.** Cerere cu `x-xc-intern` (`ANTET_SECRET` din `@xc/actiuni`) =
  `env.SECRET_INTERN`, comparat **în timp constant** (`egaleInTimpConstant`, ca în
  `packages/actiuni/src/montare.ts`); **secret nescris în mediu ⇒ ușă ÎNCHISĂ**. Cu ea, `/v1/*` se citește cu
  `VEDE_TOT`, iar răspunsul e `private, no-store`. De ce există: user, 23:55 — „Trebuie să putem să lucrăm și
  la buletin cu un program în pagină, altfel nu putem calcula spațiul. Deci aș pune refuz, dar întârzierea
  lucrului la buletin ar fi nejustificată."
  `/v1/tabel-tipar` și `/v1/bucata-site` poartă, pe lângă `amprenta` și `modificat_la`:
  | câmp | înseamnă |
  |---|---|
  | `stare: 'validat'\|'propus'` | **gestul OMULUI**: o săptămână PROGRAMATĂ contează `validat`. De el atârnă dacă buletinul scrie „PROPUS" pe pagina a patra. |
  | `publica: boolean` | `stare = 'validat'` în bază — e chiar afară, o vede enoriașul |
  | `programata: boolean` | validată înainte de vreme, își așteaptă pragul |
  | `apare: string\|null` | ISO-ul pragului: `programat_la`, altfel `validat_la` |
  ⚠️ **`stare` și `publica` nu sunt același lucru, și de aceea sunt două**: validarea e a omului, publicarea e a
  ceasului. Confundate, ori buletinul ar scrie „PROPUS" pe programul programat de paroh, ori site-ul ar da
  afară o săptămână care n-a apărut încă.
  **FĂRĂ antet**, cele două rute dau numai săptămâni publicate; altfel **404 `{ok:false, cod:'nepublicat'}`**
  (formă plată dinadins: `apps/buletin/src/compune.ts` citește `corp.cod`/`corp.mesaj` de la rădăcină, nu
  `eroareApi`-ul înfășurat în `{eroare:{…}}`). **`?data=azi` (ori lipsa lui) = SĂPTĂMÂNA CURENTĂ**, nu
  săptămâna zilei de azi — aici stă toată regula 1: duminică la 12:05 prima pagină a sitului arată săptămâna
  nouă, deși `azi` cade încă în cea care se încheie.
- **ACȚIUNILE (`/_actiuni`) citesc cu `VEDE_TOT`**: modulul cere deja secretul platformei, deci cine ajunge
  acolo e înăuntru. ⚠️ Poarta e atunci **modulul de Chat**, nu cernerea: dacă vreodată chatul se deschide
  enoriașilor, citirile din `actiuni.ts` trebuie să primească `vedereaLui(...)`.
- **LIVE-ul n-a fost atins**: `apps/live/src/program.ts` cere `/v1/urmatoarea` pe Service Binding **fără**
  antet, deci cu ochii lumii; forma răspunsului (`{urmatoarea: Slujba|null}`) e neschimbată și `null` era deja
  tratat („ultima versiune bună"). ⚠️ `urmatoareaSlujba` **sare peste** slujbele săptămânilor nepublicate, nu
  se oprește la prima ascunsă.
- **HÂRTIILE au rămas cu `VEDE_TOT`, dinadins**: `/v1/foaie` (se apără singură — cere `validat`),
  `/v1/propunere` (socoteală din istoric, nu rândurile parohiei), `/v1/poza/saptamana`, `/v1/sfintii-zilei`.
  Butonul de descărcare e al adminului, dar el cere adresele astea **din browser**, fără secret: cernute,
  adminul n-ar mai fi putut lua poza săptămânii pe care tocmai o are pe ecran.
  ⚠️ **Gaura rămasă, cu bună știință**: `/v1/poza/saptamana/<luni>.jpg` arată rândurile din bază ale unei
  săptămâni nepublicate oricui îi ghicește adresa. Era așa și înainte; de îndreptat când `/v1` va ști cine
  întreabă (azi nu citește sesiunea deloc, și e cache-uit public).
- **CACHE**: publicul rămâne la `public, max-age=300`, deci **o săptămână apărută la 12:00 poate fi văzută cu
  până la 5 minute mai târziu** — aceeași notă ca la buletin. Internul e `private, no-store`.

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

> [arhivat automat 2026-10-02] 3 secțiuni datate 2026-09-17…2026-09-17 → docs/jurnal/2026-09.md

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

### 2026-10-02

**Subdomeniile celor 6 aplicații mutate pe apex, cu 301** (16:50–16:54, handoff de la agentul V3, cererea proprietarului). Comitul `f2e8618` („V2 redirects: subdomains → sfantul-ilie.ro/app (301)") desfășurat cu `wrangler deploy --env production` (tokenul: `. /backup/_setup/cloudflare.env`). Version ID-uri: program `5e29216f-a170-46d2-9f4f-07d202f026ad`, buletin `3266a4bd-5e2c-48d1-9937-3d923c7ee199`, calendar `27069575-2dfe-49a5-b211-54b54f9e34c0`, tipic `1227793b-a3a5-42b5-a38d-99cb58c6c0d1`, biblia `dfc89245-c747-4c31-9e81-f2fe36ea9229`, biblioteca `8d323cd9-f5f6-4c1b-aee3-6438ce7a51ae`.
- Probe `curl -sI` (16:53): toate întorc `301`, `Location: https://sfantul-ilie.ro/<app>/<cale>` (interogarea păstrată), `Cache-Control: public, max-age=3600` — rădăcinile, plus `program/arhiva`, `buletin/arhiva?an=2025`, `biblia/geneza/1`, `biblioteca/test-cale?x=1`. Țintele pe apex (servite de workerele V3): `/biblia`, `/biblioteca`, `/calendar`, `/tipic`, `/program`, `/buletin`, `/program/arhiva`, `/buletin/arhiva?an=2025` → 200.
- Neatinse, rămân pe subdomeniile lor până la cutover-urile lor: curatenie, newsletter, home, live, radio.

### 2026-09-20

**Retragerea (ne-publicarea) unui număr publicat greșit — buton + chat** (08:07–09:10, mod auto, trei subagenți). Cererea userului: „Trebuie să avem și buton de ne-publicare — dacă s-a publicat greșit — și să poată face asta și chat-ul." Buletin **0.16.0**.

- **Ce e retragerea**: inversul EXACT al validării. Rândul iese din D1 (`stergeBuletin`, `depozit.ts` — `DELETE … AND sursa='site'`; încuietoarea e în SQL: cele 619 numere din arhiva Word nu se retrag de nicăieri, „nu îndreptăm noi arhiva"), iar numărul se ÎNTOARCE ca schiță pe `/nou`, cu același nr., aceeași zi și tot ce avea. Fișierele (PDF, copertă, broșuri, `compus/…json`, poze) RĂMÂN — sunt ale ciornei, `ciornaDinDepozit` le servește mai departe; pe `/nou` omul vede FOAIA publicată, nu o variantă zero recompusă. Se retrage NUMAI numărul curent (cel fără urmaș) și numai `sursa='site'`.
- **O singură ușă**: `POST /nou` cu `fapta=retrage` (`index.ts`), lângă `valideaza` — publicarea și ne-publicarea sunt aceeași hotărâre în două sensuri. Fapta o face `retrageNumarul()` (`actiuni.ts`), chemată la fel de buton și de acțiunea de chat `buletin.retrage` (`efect: 'scrie'` → Da/Nu; `rezuma` ARUNCĂ când nu se poate, deci omul află de ce ÎNAINTE de orice ștergere). Cernerea stă într-un singur loc, `deRetras()`. `nr`/`data` sunt VERIFICARE, nu țintă: ținta o află serverul (`ultimul`), fiindcă bula stă numai pe `/nou`, unde numărul tocmai publicat nu mai e „următorul", ci CURENTUL. Audit `buletin.retrage` cu `summary.izvor`. Refuzurile ies 409 prin `nuMerge`, izbânda redirectează la `/nou`.
- **Butonul „Retrage"** (`pagini.ts` → `retragerea`, `IC_RETRAGE`, `JS_RETRAGE`): al patrulea de sub copertă, pe `/` și `/buletin/<nr>-<data>`, NUMAI la `ctx.eAdmin && acum && b.sursa === 'site'` (`butoaneleNumarului` a primit al patrulea parametru, `acum`, din `m.acum` deja calculat în ambii apelanți; ciorna de pe `/nou` nu-l capătă). Confirmare într-un `<dialog class="modal">` (regula ferestrelor; stilurile existau în `stil.ts`), cu `window.confirm()` de rezervă unde nu e `<dialog>`.
- **Schița se PUNE DEOPARTE la validare, nu se mai șterge** (`arhiveazaSchita` → `schita/arhiva/<nr>-<data>.json`, `schita.ts`; mutată, nu copiată): retragerea o aduce înapoi întreagă (`dezarhiveazaSchita`), cu ADRESELE POZELOR — cererea din `compus/` ține doar `poza: true/false`, deci refăcută din ea poza s-ar fi pierdut fără nicio eroare. Trei izvoare, în ordine: `arhiva` (drumul bun) → `cerere` (`schitaDinCerere`, pentru numerele publicate înainte de 20.09; poza se dă din nou și i se spune omului) → `implicita`. Schița refăcută din cerere are `gata` PLIN pe toate subiectele, altfel `/nou` ar socoti-o neatinsă și ar porni singur „varianta zero" peste foaia de îndreptat, iar bula ar relua chestionarul. Prefixul `schita/arhiva/` nu se prinde în listarea `schita/<nr>-` (probă anume). Schița se scrie ÎNAINTE de redirect, fără `waitUntil` — altfel `/nou` s-ar putea deschide înaintea ei.
- **`urmatorulCuSchita`** (`pagini.ts`, lângă `buletinulNou`): TOATE locurile care întreabă „ce număr urmează" (`/nou`, `/nou/compune`, `urmatorul()`, `schitaNumarului()`) preferă o schiță existentă pentru `nr+1` (un `R2.list` cu prefix; cea mai veche zi). Fără asta, un număr retras luni (616/20.09) rămânea orfan: ecranul ar fi cerut 616/27.09. ⚠️ Schimbă purtarea și în afara retragerii: o ciornă lăsată peste duminică nu mai sare pe duminica următoare — îndreptare, necerută în cuvinte de user.
- **Harta** (`harta.ts`): fapta `retrage` (subiect `numar`, `confirma: true`, `ascunsa: true` ca `valideaza` — nu se oferă pe butoanele nivelului 2, lângă „compune numărul", ar fi capcană; se recunoaște din vorbe: „retrage numărul", „anulează publicarea", „nepublică", „scoate din arhivă", „dă înapoi la schiță", „l-am publicat greșit", „retrage-l" — ultimele două adăugate după verificare, la început cădeau pe `necunoscut`). `traduFapta` → `buletin.retrage` fără argumente.
- **Poarta `unelte` din KV `modul:chat:buletin` NU se aplică**: buletinul e „cu hartă", `peHarta` din chat-worker cheamă acțiunea direct (`cereActiune`); `adunaUneltele` e doar pe drumul cu model. Deci userul n-are nimic de bifat în Setări → „Chat AI" — dar `buletin.retrage` apare acolo ca bifă nebifată (cosmetic, vezi NEXT 00g).
- Probe: `tests/buletin-retrage.test.ts` (nou, 31 — D1 fals cu tabelă adevărată, ca DELETE-ul să scoată rândul; R2 fals cu `list({prefix})`; `waitUntil` care se poate aștepta), `buletin-harta` (+4, apoi frazele de mai sus), `buletin-ciorna` (+1: ciorna de pe `/nou` NU capătă „Retrage"). Suita întreagă: 1105/1105 (înainte de frazele adăugate la hartă), `turbo typecheck` 36/36.

**Justify la piciorul coloanelor** (08:11; user: „La fiecare pagină ciornă — colțul dreapta jos — adică col2, jos, nu mai este justify — propoziția nu se duce până la capăt"). Cauza, dovedită cu `chromium --dump-dom` + `Range.getClientRects()` pe `proba-foaie.mjs --gol --secundari 2`: curgerea (`CURGE` din `foaie.ts`) taie paragraful la piciorul FIECĂREI coloane și lasă bucata ca `<p>` întreg, iar CSS-ul nu întinde niciodată ultimul rând al unui bloc. NU e regresie: marcajele din 19.09 n-au nicio vină, `text-align-last` n-a existat niciodată în repo. Era la TOATE coloanele — gol dreapta măsurat (coloana 321 px): 1b 91 px, 3b 91 px, 3a 15 px —, dar la col1 golul e ascuns de șanț, la col2 cade în colțul foii, lângă chenar. Leac: `p.t.continua { text-align-last: justify }` + `bucata.className += ' continua'` NUMAI pe ramura `if (coada)` din `curge()` — un paragraf care se încheie în coloană rămâne cu rândul scurt, cum se cuvine. După: 0.00 px la toate cele 6 hotare; raportul curgerii identic (`intrate` 7801, `peDinafara` 0, `coloaneFolosite` 7); `--verifica` verde pe toate 3 variantele; măsurile socotelii neatinse. Capturi în `dist/jos-inainte-1.png` / `dist/jos-dupa-1.png` (gitignorat). Probe: `buletin-foaie` +3 (server-side: regula CSS, atribuirea unică în `if (coada)`, `foaieHtml()` nu scrie clasa). Găsit pe drum, neatins: `<p class="t">` GOL lăsat de `taie()` cu `bun = 0` într-o coloană fără loc (NEXT 00g).

**Publicarea** (08:49, user: „1" — tot, în ordine). 13 workeri, unul câte unul, fără nicio eroare, 08:54: authz → identity → cont → admin, calendar, program, buletin, curatenie, tipic, biblia, biblioteca, newsletter, home; bindingul nou `AUTORIZARE` al contului confirmat în ieșirea wrangler; toate 200 cu versiunea în subsol, `buletin/nou` 403 la anonim (corect), `b-retrage` nu apare ca element la anonim (doar în scriptul defensiv). **`live` și `radio` lăsate nepublicate dinadins** — Durable Objects în timpul slujbei; de făcut după (NEXT 00g). Commit `b9ed8e5`.

**PROGRAMAREA numărului — validarea înainte de duminică nu mai publică, programează** (13:56–14:xx). Buletin **0.16.1 → 0.17.0**. Cererea userului, în trei mesaje: (13:56) „Dacă este înainte de ziua pentru care este programat buletinul — adică înainte de ora 12.00, duminica aceea — se poate doar «Validează și programează»; dacă este duminică după ora 12.00 — «Validează și publică»"; (13:58) „iconița de Anulare să fie verde — doar simbolul — până când trece 12.00 duminică" și „dacă s-a validat și publicat și a început lucrul la ciornă să nu se mai poată anula publicarea acelui număr — dar să am posibilitatea să șterg ciorna — resetare complet la zero — și atunci reapare posibilitatea de a invalida acel număr"; (14:11) „să fie o programare reală — adică din uneltele de cron din Cloudflare"; (14:19) „să faci și deploy la final". Regulile durabile au intrat în „BULETINUL — foaia tipărită" → „PROGRAMAREA, din 20.09.2026"; aici, drumul și ce s-a învățat.

- **Pragul** (`apps/buletin/src/ceas.ts`, nou): `pragPublicarii(data)` = duminica numărului la 12:00 Europe/București, cu decalajul **cerut de la ICU** (`Intl.DateTimeFormat`), nu scris de mână — 09:00Z vara, 10:00Z iarna. `valideazaNumarul` (`actiuni.ts`, de la `POST /nou fapta=valideaza`): `acum >= prag` → `stare='publicat'`, `publicat_la=acum`; altfel `stare='programat'`, `publicat_la=prag`. Auditul spune `fel: programat|publicat`. Schița se pune deoparte (`schita/arhiva/`) și la programare, deci retragerea o aduce înapoi ca până acum.
- **D1**: migrația `infrastructure/migrations/buletin/0002_programare.sql` — `stare TEXT NOT NULL DEFAULT 'publicat'`, `publicat_la TEXT` (NULL la cele 619 din Word), index `(stare, publicat_la)`. ALTER fără `IF NOT EXISTS`, deci **o singură rulare**; la deploy, migrația înaintea workerului.
- **Cron adevărat, nu socoteală la citire** (asta a cerut userul explicit): `triggers.crons: ["*/5 9-10 * * SUN"]` în **toate trei blocurile** din `wrangler.jsonc` — ⚠️ un mediu **nu moștenește** `triggers`, ușor de scăpat. `scheduled` → `programateleScadente` → `treciLaPublicat` (un singur `UPDATE … WHERE stare='programat' AND publicat_la <= ?`), idempotent, audit per număr; `publicat_la` rămâne clipa **anunțată** (12:00), nu clipa trecerii. Cache-ul public (300 s) poate întârzia apariția cu până la 5 minute — lăsat așa, fără purge.
- **O singură clauză de vizibilitate**: `cerne()` în `depozit.ts` (`Vedere: VEDE_TOT | LUMEA`), la toate citirile, inclusiv `/v1/*` care citește **mereu** cu ochii lumii (ușă de mașini). Adminul vede programatul ca număr curent și în arhivă, cu eticheta verde „Programat — apare duminică, <data>, la ora 12:00".
- **Partea care era gata să scape**: `/fisier/` și `/tipar/`. Foaia și coperta au adresă ghicibilă, iar răspunsul cu `?v=` e `immutable` un an — dacă poarta se punea numai pe rândul din D1, o cerere anonimă nimerită înainte de 12:00 ar fi băgat foaia în cache-ul de muchie. Acum poarta socotește **întâi ziua din cheie** (fără D1), apoi starea rândului; număr neapărut → 404 la anonim, `private, no-store` la admin. Pozele din `poze/…` rămân deschise dinadins (Browser Rendering le cere fără cookie). Înăsprire pe drum: foaia unui număr **nevalidat** nu mai e publică deloc.
- **Retragerea, cât e programat**: iconița verde (`#0A6B41` / `#5FBF8D`), doar simbolul, „Anulează programarea nr. N".
- **Ciorna următoare blochează retragerea** (cererea a doua a userului): semnul `atinsa` pe schiță, aprins de `scrieSchita` la orice scriere `fel='om'` (implicit); `'sistem'` numai la nașterea variantei zero și la `buletin.chestionar` — altfel chiar deschiderea lui `/nou` ar fi „început" ciorna. „Retrage" (buton **și** `buletin.retrage`) trece prin aceeași funcție, `ciornaDeDupaEInceputa`; refuzul e 409 „Ciorna nr. N+1 e începută — șterge-o întâi din «buletin nou»". La retragere, o schiță neatinsă a lui nr+1 se șterge, iar schița întoarsă se marchează `atinsa` — altfel a doua retragere ar fi șters tocmai ce se recuperase.
- **„Șterge ciorna" pe `/nou`**: buton lângă validare, `<dialog>` de confirmare („resetare completă la zero"), `POST /nou fapta=sterge-ciorna` → `stergeCiornaIntreaga` (`compune.ts`: JSON + foaie + copertă + cerere + cele patru broșuri din `schita/`; **nu** `schita/arhiva/`, nu arhiva, nu pozele urcate), audit, redirect la pagina numărului curent — **nu** la `/nou`, unde varianta zero renaște pe loc și ștergerea ar părea că n-a mers. Fără acțiune de chat.
- `/nou`: numărul următor se socotește din toate rândurile (și programate), iar sus apare câte un rând „Nr. N e programat pentru duminică, … — vezi-l".
- **Acțiunea de chat `buletin.valideaza` NU s-a inventat** — e refuzată în hartă din 18.09; programarea se face de la buton, ca validarea.
- Probe: `tests/buletin-programare.test.ts` (69 noi), `buletin-retrage` adaptat; **1189/1189**, typecheck 36/36. Mutanți 6/6 — dar abia după ce **falsul de D1 a fost înăsprit să urmeze WHERE/SET din SQL**: lecția zilei, un fals care „știe" ce ar trebui să facă interogarea nu probează interogarea, ci propria lui părere.
- **Publicat 20.09, 14:59** — întâi migrația pe D1 de producție (`ruleaza.mjs --remote --env production --chiar-productia --doar buletin`: 0002 ok, 619 rânduri toate `publicat`), apoi `wrangler deploy` (versiunea `f8361da2`, subsol 0.17.0, `/`, `/arhiva`, `/v1/curent` 200). ⚠️ Prima publicare a CĂZUT la triggere: Cloudflare respinge `0` ca zi a săptămânii („invalid cron string", cod 10100) — ziua e 1-7 / SUN-SAT; codul se urcase, dar fără ceas. Reparat cu `*/5 9-10 * * SUN`, confirmat în `/schedules`. Regulă pentru orice worker cu cron.
- **Rămâne deschis** (NEXT 00h): dacă cronul cade, numărul rămâne `programat` până duminica următoare — nu scapă public, dar nu apare și nimeni nu află; poarta fișierelor costă o căutare pe cheia primară la fiecare foaie cu ziua trecută.

**Live și radio: panoul emisiei e „Setări", doar pentru admini** (09:25; user: „Trebuie reparat și la live și radio: panoul de administrare văzut doar de admini și să se numească Setări"). Radio **0.1.10 → 0.2.0**, live **0.1.11 → 0.2.0**, după tiparul curățeniei din 19.09.
- **Radio**: panoul emisiei a devenit rubrica „Emisia" din `/setari` (poarta `eAdminApp` = `broadcast.manage`; `jsPlayer` + `jsPanou` intră pe carcasă numai când rubrica e în pagină). `GET /admin` → 303 `/setari`. Rutele de mașină `/admin/stare|inventar|comanda` sunt NEATINSE (CSRF de origine, cum erau).
- **Live**: `/admin` → 303 `<radio>/setari`; rubrica „Emisia" din Setările lui e doar legătura spre setările radioului (emisia se conduce dintr-un singur loc). La amândouă, rândul „Administrare" din meniu = super-admin real → `nav.admin`; `urlPanou` a dispărut.
- Probe: `tests/emisie-setari.test.ts` (nou, 12), `emisie` adaptat.

**Curățenie 0.4.3 → 0.4.4** (13:47, trei puncte ale userului): (1) nota de sub „Cine ești?" („Alege-ți numele… rămâne ținut minte…") a ieșit; (2) apăsarea pe un interval gol la vizitator NU mai deschide fereastra „Ești în modul vizualizare" (dialogul a ieșit cu tot cu CSS-ul lui), doar derulează la lista de nume; (3) „Comunicare = simulated" din Administrare e `LIVRARE_REALA: "nu"` pe `communication-worker` — pauza dinadins de la cutover, **neatinsă**: pornirea ar trimite CHIAR scrisorile curățeniei (cron orar, 29 de voluntari) și așteaptă hotărârea userului. Rămas orfan: `.contact-dialog` din `stil.ts` (~30 de linii CSS fără purtător). Probe: `curatenie-fantoma` adaptat.

**Publicarea celor trei** (15:42, user: „Hai"; opus-high). Fetch curat, probe 68/68 pe cele trei fișiere, typecheck (turbo, din cache) 3/3, commit **`055b2df`**, push (backupul zilei exista deja). Înainte de publicare: `GET https://live.sfantul-ilie.ro/v1/stare` (rută publică, `apps/live/src/index.ts`) → `live:false`, `slujba:null`, următoarea „Sfântul Maslu" marți 22.09, 18:00; radioul difuza muzică. Publicate 15:50, în ordinea curatenie → **radio → live** (live nou + radio vechi = Setări fără panou): `a747a3b4`, `7f42aeba`, `cbbf4e05`. Verificate: subsoluri 0.4.4 / 0.2.0 / 0.2.0, `radio/admin` 303 `/setari`, `live/admin` 303 `https://radio.sfantul-ilie.ro/setari`, `/api/fisier` al radioului 200 `audio/mpeg`; ceasul radioului a mers neîntrerupt peste republicare (`secunda` a crescut pe aceeași piesă, `versiune:51`), deci DO-urile au repornit curat. ⚠️ Filtrele turbo se numesc `@xc/app-<nume>`, nu `@xc/<nume>`.

**Livrarea reală de email PORNITĂ pe producție** (seara, user: „Reia"). `LIVRARE_REALA: "nu" → "da"` numai în `env.production` din `services/communication-worker/wrangler.jsonc`; blocul de sus (dev) și `env.staging` rămân „nu". communication-worker **0.1.1 → 0.1.2**, publicat cu `wrangler deploy --env production`, **version id `60b15fb7-6608-48f9-8bed-93201841d585`** (ultima versiune 100% în `deployments list`; bindingurile confirmă `env.LIVRARE_REALA ("da")` și `env.POSTA`). Probe 47/47 (`contracte`, `admini-pe-aplicatie`).
- Două porți verificate înainte: (1) **V1 e mort** — toți cei 21 de workeri ai contului au prefix `xc-`, niciun `biserica-curatenie` / `biserica-biblioteca` / `biserica-cont`, deci nu există dublură la cutover; (2) **automation-worker n-are cron** (fără `triggers` nici sus, nici în `production`), singura regulă activă în `xc-automation-production` e `notificare-eveniment-publicat` (`calendar.event.published.v1`), declanșată de o publicare făcută de om, nu de ceas.
- **Nimic nu pleacă retroactiv**: în `deliveries` de producție sunt 11 rânduri, toate `status='simulated'`, coada e goală — comutatorul se aplică doar cererilor de acum înainte.
- Primele trimiteri reale așteptate: **biblioteca luni 21.09, 09:00** (dacă are ce anunța), **curățenia vineri 25.09, 09:00** (alerta, dacă duminica nu e plină) și **sâmbătă 26.09, 09:00** (săptămânalul).

**PROGRAMAREA săptămânii la program** (22:47–). Cererea userului, într-un rând: „La programul liturgic aceeași poveste cu Validare și publicare / Validare și programare, la fel ca la Buletinul bisericii." Program **0.9.6 → 0.10.0**; buletinul rămâne **0.17.0** (schimbarea lui e pur internă). Regulile durabile au intrat în „Programul (A2)" → „Programarea, din 20.09.2026"; aici, drumul și ce s-a învățat.

- **PRAGUL NU E AL LUNII, E AL DUMINICII DINAINTE** (`luni − 1 zi`, ora 12:00 a Bucureștiului). Asta a fost singura hotărâre care cerea gândit: buletinul de duminica D tipărește pe pagina a patra programul săptămânii care începe luni D+1, iar cele două se dau enoriașilor în aceeași clipă, la ieșirea de la Liturghie. Deci săptămâna 28.09–04.10 apare duminică, 27.09, odată cu numărul. Pe lunea ei, programul ar fi apărut pe site cu o zi DUPĂ foaia pe care o ține omul în mână — și nimic n-ar fi pârâit.
- **SOCOTEALA A URCAT ÎN `@xc/ui`** (`packages/ui/src/prag.ts`: `pragPublicarii`, `pragScris`, `seProgrameaza`, `candApare`, `decalaj`, `ORA_APARITIEI`). A stat o zi la buletin; de când o cer doi, două exemplare ale ei ar fi fost exact felul în care numărul și programul ajung să apară la ore diferite. `apps/buletin/src/ceas.ts` a rămas ca NUME (re-export, semnături neatinse — cele 69 de probe ale lui au trecut nemodificate); `apps/program/src/ceas.ts` e mic și e doar traducerea „cheia săptămânii → ziua de prag". Probă care ține legătura, nu formulele: `pragSaptamanii(luni)` === `pragBuletin(luni − 1)`, pe patru săptămâni din tot anul.
- **D1 fără stare nouă**: `0003_programare.sql` = `programat_la` + `programat_de` + index. CHECK-ul de pe `saptamani.stare` NU s-a atins — o stare nouă ar fi cerut un table-rebuild peste datele parohiei, pentru un cuvânt. Programată = `stare='propus' AND programat_la IS NOT NULL`, întrebat printr-un singur `eProgramata(rand)` care citește COLOANA, nu ceasul. `istoric.ce` n-are CHECK (doar un comentariu care înșiră valorile), deci `'programat'` a intrat curat. Aplicată pe baza LOCALĂ (656 de săptămâni, 0 programate); **producția neatinsă** — vezi NEXT 00i.
- **Cronul exista deja** (`*/5 * * * *`, în toate trei blocurile) și golea outbox-ul; i s-a pus înainte `treciLaValidat`. Un singur `UPDATE … SET validat_de = programat_de, validat_la = programat_la, programat_la = NULL … WHERE stare='propus' AND programat_la IS NOT NULL AND programat_la <= ?` — idempotent prin chiar forma lui —, apoi istoric și `program.week.validated.v1` **pe săptămână**, și abia pe urmă `golesteOutbox`, ca anunțul să nu mai aștepte încă cinci minute. `validat_la` = clipa ANUNȚATĂ, nu a cronului. La programare pleacă doar `changed`: `validated` trimis marți ar fi dus programul la enoriași cu cinci zile înainte, adică exact ce înlătură programarea.
- **Partea care era gata să scape — „e deja «propus»"**. Retragerea refuza orice săptămână `propus`. Cum una programată are tot `propus` scris pe ea, refuzul ar fi părut cuminte — și ar fi lăsat-o să se valideze singură duminică, după ce omul tocmai ceruse să n-o facă. Acum `retrage_validarea` pe o programată ANULEAZĂ programarea (istoric `'retras'` cu `din:'programat'`), iar refuzul vechi se dă numai unde e adevărat.
- **A doua**: `arhivaIntreaga` făcea `SELECT *` și iese pe `/v1/arhiva.json`, ușă deschisă de mașini — cele două coloane noi ar fi plecat în lume de la sine, cu tot cu user-id-ul celui care a apăsat. Acum coloanele se scriu pe nume, cu proba lângă ele.
- **Modificările pe o săptămână programată rămân permise** și nu strică programarea (hotărâre notată userului): cronul validează CE E ÎN BAZĂ la prag. O programare care ar cădea la prima îndreptare ar fi fost mai rea decât niciuna — omul n-ar fi aflat, și programul n-ar fi apărut.
- **Eticheta verde** „Programată — apare duminică, …, la ora 12:00" în locul lui „propus", **numai pentru adminul programului** (`ctx.eAdmin && eProgramata(rand)`, hotărât în `index.ts`, nu în pagină). ⚠️ Pățit: comentariul CSS care scria în clar vorbele etichetei ajungea în CSS-ul FIECĂREI pagini, deci proba „enoriașul nu le vede" cădea pe o pagină în care eticheta nu se scrie deloc.
- **Trecerea nu are voie să înece golirea outbox-ului**: `scheduled` o ține într-un `try` și scrie eroarea în jurnal. Cazul real e ordinea de deploy — workerul urcat înaintea migrației `0003` face interogarea să cadă cu „no such column: programat_la", iar fără plasă ar fi oprit TOATE evenimentele programului, nu doar programarea.
- Probe: `tests/program-programare.test.ts` (**52 noi**) — fals de D1 care CITEȘTE SET-ul și WHERE-ul din SQL (parsare de condiții, `COALESCE`, coloană = coloană) și care întoarce COPII ale rândurilor, ca D1: prima variantă dădea chiar obiectele din tabel, iar `UPDATE`-ul le schimba sub cel care le citise — așa a trecut verde un `treciLaValidat` care întorcea `validat_la: null`. Suita întreagă **1241/1241**, `turbo typecheck` **36/36**, **mutanți 11/11** (clauza de timp din cron, `validat_la` rescris, `<` → `<=`, ramura de anulare din retragere, `changed` → `validated`, pragul pe lunea săptămânii, `SELECT *` în arhivă, eticheta arătată oricui, `eProgramata` fără `stare`, validarea care nu stinge ceasul, plasa de sub outbox).
- **Nepublicat**: migrația 0003 pe producție ÎNAINTEA workerului, apoi `wrangler deploy` (NEXT 00i). ⚠️ Nota „buletinul nu se republică" a căzut o oră mai târziu — vezi blocul următor.

**PUBLIC DOAR CE E CURENT — programul** (23:55–). Cele trei reguli ale userului (23:33): 1. „Buletinul și programul sunt programate D-12:00, adică atunci devin curente și publice." 2. „Public arătăm doar ce e curent." (confirmat anume și pentru live: transmisiunea pornește doar din săptămâni validate). 3. Buletinul preia la validarea LUI programul validat. Întrebat ce se face cu buletinul care are nevoie de program CÂT E ÎNCĂ PROPUS, userul (23:55): „**1. Trebuie să putem să lucrăm și la buletin cu un program în pagină, altfel nu putem calcula spațiul. Deci aș pune refuz, dar întârzierea lucrului la buletin ar fi nejustificată. 2. Da**" — de aici ușa internă. Program **0.10.0 → 0.11.0**. Regulile durabile: „Programul (A2)" → „Vizibilitatea și săptămâna curentă, din 20.09.2026".

- **O singură clauză, ca la buletin** (`depozit.ts`): `Vedere = VEDE_TOT | LUMEA`, `cerne()` = `stare = 'validat'`, `cerneSlujbe()` = subselect pe `saptamani`. Publicată ⟺ validată, fiindcă programarea o face **ceasul**, nu omul. Parametrul e **obligatoriu** la toate cele 14 citiri — un implicit `VEDE_TOT` ar fi lăsat orice apelant nou să vadă tot, tăcut; așa compilatorul a arătat el însuși fiecare loc de atins (24 de erori la prima trecere, toate în `actiuni.ts`).
- **⚠️ Ce s-a învățat aici: cernerea săptămânilor NU e de ajuns.** Slujbele stau în alt tabel, iar `/v1/urmatoarea`, `/v1/curenta`, `/v1/cauta`, `/v1/paternuri` le citesc **direct**, fără să treacă prin `saptamani` — deci cu clauza pusă numai pe săptămâni, live-ul ar fi pornit transmisiunea dintr-o săptămână nepublicată și chatul ar fi spus „următorul Maslu e pe 30" dintr-un program pe care parohia încă nu-l dăduse afară. De aceea a doua clauză, pe `slujbe`, prin **săptămâna lor**.
- **„Curentă" nu mai vine din calendar**: `saptamanaCurenta()` = ultima `validat` cu `luni <= luneaSaptamanii(azi) + 7`. Marginea nu e de prisos — o săptămână validată din import, de peste două luni, ar fi tras prima pagină după ea. Duminică la 12:05, `azi` cade încă în săptămâna care se încheie, dar curentă e cea care începe mâine: exact cea tipărită în buletinul din mâna omului. Lunea ei coboară în antet prin `Meniu.curenta` (bulina, zona de scris, săgeata) și prin `?data=azi` la `/v1/bucata-site`.
- **Ușa internă**: `x-xc-intern` = `env.SECRET_INTERN`, în timp constant, **secret lipsă ⇒ ușă închisă**; răspuns `private, no-store`. Pe `/v1/tabel-tipar` și `/v1/bucata-site` pleacă în plus `stare` / `publica` / `programata` / `apare`. ⚠️ **`stare` ≠ `publica`, și de aceea sunt două**: o săptămână PROGRAMATĂ de un om contează `validat` (validarea e gestul omului, publicarea e a ceasului) — buletinul se uită la prima ca să știe dacă scrie „PROPUS", site-ul la a doua. Fără antet, cele două rute dau 404 `{ok:false, cod:'nepublicat'}` — formă **plată** dinadins, fiindcă `compune.ts` citește `corp.cod`/`corp.mesaj` de la rădăcină, nu `eroareApi`-ul înfășurat în `{eroare:{…}}`.
- **Săgeata „săptămâna viitoare" se stinge la enoriaș** (`.gol`), nu se ascunde: săptămâna de după cea curentă nu e publicată **prin definiție**, deci linkul ar fi dus mereu în zid. Pagina „nu e publicat încă" nu spune nici starea, nici conținutul — doar regula casei („apare duminică, la ora 12:00").
- **Acțiunile (`/_actiuni`) citesc cu `VEDE_TOT`**, fiindcă modulul cere deja secretul. ⚠️ Urmarea, scrisă lângă ele: poarta devine **modulul de Chat**, nu cernerea — dacă vreodată chatul se deschide enoriașilor, `actiuni.ts` are nevoie de `vedereaLui(...)`.
- **Hârtiile au rămas cu `VEDE_TOT`, cu bună știință**: butonul de descărcare e al adminului, dar el cere `/v1/poza`, `/v1/propunere` din **browser**, fără secret — cernute, adminul n-ar mai fi putut lua poza săptămânii de pe ecran. Rămâne o gaură știută: `/v1/poza/saptamana/<luni>.jpg` arată rândurile unei săptămâni nepublicate oricui ghicește adresa (era așa și înainte).
- **Live neatins**, verificat: `apps/live/src/program.ts` cere fără antet, forma `{urmatoarea: Slujba|null}` e neschimbată, `null` era deja tratat („ultima versiune bună"). `urmatoareaSlujba` **sare peste** săptămânile nepublicate, nu se oprește la prima ascunsă.
- **WordPress n-are nevoie de nicio schimbare** (verificat în `docs/runbooks/wp-program-prima-pagina.md`): `sfilie_program_bucata()` cere `200` **și** `'validat' === $d['stare']`, iar la orice altceva ține ultima copie bună și reîncearcă peste 5 minute — un 404 `nepublicat` cade exact acolo. **De dorit, nu de nevoie**: cronul orar aliniat la minutul 0 face ca săptămâna apărută la 12:00 să ajungă pe prima pagină abia la 13:00.
- **Falsul de D1 a ieșit în `tests/program-fals.ts`**, ca să-l folosească amândouă probele. A fost și generalizat (SELECT cu coloane/ORDER BY/LIMIT, `LIKE`, `OR`, aliasuri, și **subselectul cernerii, RULAT, nu presupus**) — altfel o clauză schimbată în `cerneSlujbe` ar fi trecut neobservată. ⚠️ Tăierea WHERE-ului nu se mai face cu `split(/\s+AND\s+/)`: un `AND` ajuns vreodată în subselect ar fi rupt condiția în două jumătăți fără înțeles, tăcut.
- **Două purtări schimbate, de știut**: enoriașul nu mai vede săptămâna „propus" (până acum o vedea cu eticheta ei — proba veche din `program-programare` a fost rescrisă); iar `/v1/tabel-tipar` fără antet nu mai dă nimic nevalidat, deci **buletinul trebuie urcat DUPĂ program, cu antetul pus** (NEXT 00i.3).
- Probe: `tests/program-vizibilitate.test.ts` (**51 noi**). Suita întreagă **1292/1292**, `turbo typecheck` **36/36**, **mutanți 11/11** (`cerne()` gol → 18 căderi, `cerneSlujbe()` gol → 14, marginea săptămânii curente scoasă, curenta luată din calendar, ușa internă mereu deschisă, ușa deschisă când lipsește secretul, programata care nu mai contează `validat`, săgeata vie la enoriaș, `?data=azi` fără săptămâna curentă, paginile fără cernere, `/v1` mereu `VEDE_TOT` → 15).

**BULETINUL PREIA LA VALIDARE PROGRAMUL VALIDAT** (00:10–01:00, 21.09; subagent). Regula userului (20.09, 23:33): „Buletinul și programul sunt programate D-12:00, adică atunci devin curente și publice. Public arătăm doar ce e curent. **Buletinul preia la momentul validării ce program era validat.**" Întrebat dacă, la validarea buletinului cu programul încă propus, se face refuz ori se merge pe propunere, a răspuns (23:55): „**Trebuie să putem să lucrăm și la buletin cu un program în pagină, altfel nu putem calcula spațiul. Deci aș pune refuz, dar întârzierea lucrului la buletin ar fi nejustificată.**" Adică cele două apăsări se despart: **compunerea** merge pe orice program, **validarea** cere programul validat. Buletin **0.17.0 → 0.18.0**. Regulile durabile: „BULETINUL — foaia tipărită" → „PROGRAMUL VALIDAT LA VALIDARE, din 21.09.2026".

- **Antetul intern pe cererea tabelului** (`compune.ts`, `calendarulNumarului`): `x-xc-intern: env.SECRET_INTERN`, pus **doar dacă secretul există** (unul gol e la fel de închis, dar ascunde cauza). `EnvCompunere` a primit `SECRET_INTERN`. Închide NEXT 00i.3 din partea codului.
- **404 `nepublicat` nu mai e „program indisponibil"**: cererea noastră poartă antetul, deci un 404 înseamnă **ușa închisă** — mesajul spune „programul a refuzat ușa internă (secret) … verifică `SECRET_INTERN`". Fără rândul ăsta, omul ar fi căutat prin aplicația Programul, unde totul e la locul lui.
- **Validarea cere programul DIN NOU**, înainte de orice scriere în D1/R2: `stare !== 'validat'` → **409** („Programul săptămânii <interval> nu e validat — validează-l întâi, în Program. Buletinul preia la validare programul validat."); program mut → **503**, fără nicio scriere; amprentă schimbată față de compunere → **se recompune** numărul pe același drum ca butonul (`compuneNumarul`, din schiță, cu pozele ei), apoi se validează foaia nouă. ⚠️ O săptămână **programată** contează `validat` — altfel buletinul n-ar fi putut fi validat niciodată înaintea săptămânii lui.
- ⚠️ **Recompunerea la validare e DRUMUL ZILEI, nu un caz rar**: `stare` intră în amprentă, deci un număr compus pe propunere are întotdeauna altă amprentă decât săptămâna validată între timp. Amprentă **egală** → nu se randează nimic, dar semnele (`publica`, `programata`, `apare`) se scriu proaspete lângă cerere: ele NU intră în amprentă.
- **O reparație găsită pe drum**: `calendarulNumarului` lăsa o legătură căzută să **arunce**, iar `/nou` răspundea 500 — tocmai ecranul de pe care omul ar fi trebuit să afle că programul tace. Acum întoarce `{cod:'program_mut'}`, ca orice alt refuz al programului, iar 503-ul validării chiar ajunge la buton.
- Probe: `tests/buletin-validare-program.test.ts` (**14 noi**). Suita întreagă **1306/1306**, `turbo typecheck` **36/36**. ⚠️ `turbo typecheck` a picat o dată pe `@xc/contracts` imediat după suită (flake de resurse: singur, `tsc --noEmit` dă 0; a doua rulare, 36/36).

**Publicat 21.09, 00:47–00:52** (subagent). Închide NEXT 00i: migrația 0003 + program **0.11.0** + buletin **0.18.0**, în ordinea cerută, pe producție.
- **Starea săptămânilor înainte de orice** (citire pe `xc-program-production`): 14.09 `validat` (validat_la `2026-09-19T14:05:38Z`), **21.09 `validat`** (`2026-09-20T15:00:05Z`), 07.09 `validat` (fără `validat_la` — rând de import). Săptămâna **28.09 nu există ca rând**, deci nimic de arătat public pentru ea. Fereastra de la punctul 00i (buletin fără tabel până urcă programul) **nu s-a deschis**: 21.09 era deja validată.
- **Migrația 0003**: `ruleaza.mjs --remote --env production --chiar-productia --doar program` → `0001 ok, 0002 ok, 0003 ok`. După ea: `programat_la` există, **656 săptămâni / 2625 slujbe / 29 termeni** de vocabular neatinse, **0 programate** (nimic nu era programat).
  ⚠️ **Runnerul NU ține evidența migrațiilor aplicate** — rulează TOT directorul, de fiecare dată, și se oprește la prima cădere. Merge doar fiindcă 0001/0002 sunt idempotente (`CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`; `DROP TABLE IF EXISTS events` atinge doar tabelul pilot). **0003 nu e**: a doua rulare a comenzii de mai sus va cădea cu „duplicate column name: programat_la" înainte să scrie ceva. Nu e o pagubă, dar comanda nu e de repetat din obișnuință.
- **Program** `xc-program-production`, Version ID **`110c4213-443c-41af-b179-ea558dfcc30b`**, trigger păstrat `*/5 * * * *` + producer `xc-events-production`. Verificat: `/` **200** cu `0.11.0` în subsol; `/v1/saptamana/2026-09-28` → **404** `saptamana_inexistenta` (cu vecinele `înainte: 2026-09-21`, `după: null`) — cernerea ține; `/v1/urmatoarea` → **200**, `2026-09-22-maslu`, 18:00.
- **Buletin** `xc-buletin-production`, Version ID **`64079844-bcd0-42da-9d9d-fc29824f995c`**, trigger păstrat `*/5 9-10 * * SUN`. Verificat: `/` **200** cu `0.18.0` în subsol; `/v1/curent` → **200**, nr. **616** din 2026-09-20.
- `SECRET_INTERN` confirmat pe **amândouă** înainte de deploy (`secret list --env production`), deci ușa internă a tabelului de tipar e deschisă.
- ⚠️ De curățat cândva: `wrangler` avertizează la program că `SECRET_INTERN` stă în `vars`-ul de la rădăcină și **nu se moștenește** în `env.production` — inofensiv acum (pe producție e secret Cloudflare adevărat), dar avertismentul apare la fiecare deploy.

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
  - **validarea = publicarea** (⚠️ **nu mai e adevărat din 20.09.2026**: înainte de duminica numărului, ora
    12:00, validarea = **programare** — numărul se scrie cu `stare='programat'` și iese la lumină singur, din
    cron; vezi „PROGRAMAREA, din 20.09.2026" în „BULETINUL — foaia tipărită"): `POST /nou` cu
    `fapta=valideaza` → `scrieBuletin` (`INSERT OR REPLACE`,
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
