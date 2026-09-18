/**
 * Stilul LOCAL al buletinului. Se lipeste DUPA stilul comun din `@xc/ui` si il suprascuie — la
 * specificitate egala castiga ce e mai jos.
 *
 * Vine din V1 (`biserica-buletin/src/stil.ts`, v0.5.0), cu doua deosebiri:
 *  - randul de abonare al V1 (camp de e-mail in antet) a iesit; in locul lui, butonul cu plic si
 *    FEREASTRA de la Program, deci si stilul ferestrei, adus intocmai de la Tipic;
 *  - a intrat randul de veste al abonarii (`.veste`), pe care V1 il scria langa camp.
 *
 * ⚠️ Fara accent grav in comentariile de aici: stilul e un template literal, iar un backtick intr-un
 * comentariu inchide sirul si `tsc` scoate erori fara legatura cu locul vinovat.
 *
 * ⚠️ La coada lui se lipeste `STIL_ABONARE` din `@xc/abonare`: bucatile NOI ale ferestrei (randul
 * rosu al validarii, linkul din bifa, cele sase casute ale codului) stau o singura data, langa
 * HTML-ul lor. Restul ferestrei (`.modal`, `.camp`, `.bifa`, `.btn-plin`) e mai jos, neatins.
 */
import { STIL_ABONARE } from '@xc/abonare'
import { STIL_SETARI } from '@xc/setari'

export const LOCAL = `
.marunt { font-size:14px; color:var(--faint) }
.gol { color:var(--faint); font-style:italic }
/* vestea de dupa abonare, sub antet */
.veste { margin:0 0 14px; font:14px ui-sans-serif,system-ui }
.veste.bine { color:var(--albastru) }
.veste.rau { color:var(--rosu) }

/* ── MENIUL DIN ANTET, REFACUT LA 17.09.2026 DUPA CHIPUL CALENDARULUI, AL PROGRAMULUI SI AL
   NEWSLETTERULUI (user: "sa aranjam meniul principal cum am facut la Calendar si Programul
   liturgic"): o PASTILA cat tot randul — bulina · zona de scris · sageata · Arhiva · lupa — si,
   singura afara la dreapta, ABONAREA. Asezarea V1 (abonarea intai, o liniuta despartitoare, doua
   butoane mici si un formular de cautare sub antet) a cazut toata.
   Ce a ramas neschimbat: butonul fara tinta se scrie estompat (.gol), pe loc, ca randul sa nu joace
   de la o pagina la alta. */
/* Carcasa comuna lasa .btns sa se rupa (flex-wrap:wrap); aici randul nu se rupe pe desktop —
   butoanele se string, nu sar pe randul urmator. */
.btns { flex-wrap:nowrap }
.btns .gol { opacity:.35; pointer-events:none }
.btns .btn { min-width:0 }
/* treapta pe care CHIAR esti (aria-disabled): nu duce nicaieri, dar se apasa — atunci ia focusul si
   ramane ea marcata, ca sa se vada unde ne aflam. */
.btns .btn[aria-disabled="true"] { cursor:default }
.btns .btn[aria-disabled="true"]:focus { outline:none;
                 background:color-mix(in srgb, var(--rosu) 18%, transparent) }

/* PASTILA: segmentele lipite intr-un singur corp, ca sa se citeasca drept UN obiect cu o pozitie,
   nu cinci destinatii deosebite. Chenarul si rotunjirea stau pe pastila, nu pe butoane; intre
   segmente ramane o linie de 1 px.
   ⚠️ MASURA DE PORNIRE E 0 (flex:1 1 0), NU auto — regula platita la Calendar pe 15.09.2026: randul
   are flex-wrap, iar ruperea lui se hotaraste dupa marimea IPOTETICA a copiilor, inainte de orice
   strangere. Cu "auto", pastila ar cere cat scrisul intreg plus cele patru butoane si ar cobori
   abonarea pe al doilea rand pe ecranele de 400-460 px.
   ⚠️ Fara overflow:hidden: rotunjirea colturilor o duc segmentele de la capete, fiecare al lui. */
.btns .pastila { display:flex; flex:1 1 0; min-width:0; align-items:stretch;
                 border:1px solid var(--rule); border-radius:10px; background:var(--tinta) }
.btns .pastila .btn { flex:0 0 auto; border:0; border-radius:0; background:transparent }
.btns .pastila > :first-child { border-radius:9px 0 0 9px }
.btns .pastila > :last-child { border-radius:0 9px 9px 0 }
.btns .pastila .btn + .btn { border-left:1px solid var(--rule) }
.btns .pastila a.btn:hover { color:var(--rosu); background:var(--paper) }
.btns .pastila .btn.activ { color:var(--rosu); font-weight:600;
                 background:color-mix(in srgb, var(--rosu) 11%, transparent) }
/* cele PATRU butoane-iconita: aceeasi masura, ca pastila sa arate la fel pe orice pagina */
.btns .pastila .punct, .btns .pastila .viit, .btns .pastila .arh, .btns .pastila .cheie {
                 flex:0 0 46px; width:46px; padding-left:0; padding-right:0;
                 display:flex; align-items:center; justify-content:center }
.btns .pastila .viit svg, .btns .pastila .arh svg, .btns .pastila .cheie svg { vertical-align:0 }
/* bulina: un punct, fara text, la fel de inalt ca segmentele de langa el; duce mereu la numarul
   curent si ramane apasata cand chiar pe el esti */
.btns .punct::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.btns .punct:hover { color:var(--rosu) }
/* cheile sunt <button>, nu linkuri: le trebuie spuse cursorul si hoverul, fiindca regula de mai sus
   prinde numai a.btn */
.btns .pastila button.cheie { cursor:pointer; color:inherit }
.btns .pastila button.cheie:hover { color:var(--rosu); background:var(--paper) }
/* cat timp bara ei e coborata, cheia sta aprinsa — ca omul sa stie de unde a iesit ce vede sub antet */
.btns .pastila .cheie[aria-expanded="true"] { color:var(--rosu);
                 background:color-mix(in srgb, var(--rosu) 11%, transparent) }
.btns .pastila button.arh:not([aria-disabled="true"]) { cursor:pointer }
.btns .pastila button.arh:not([aria-disabled="true"]):hover { color:var(--rosu); background:var(--paper) }
.btns .pastila .arh[aria-expanded="true"] { color:var(--rosu);
                 background:color-mix(in srgb, var(--rosu) 11%, transparent) }
/* ZONA DE SCRIS — pe ce numar esti. Ia tot prisosul, iar butoanele stau la masura lor fixa.
   ⚠️ NU E UN BUTON, E O ZONA DE SEMNALIZARE (regula Calendarului): fundalul ei e hartia paginii
   (--paper), nu umplutura butoanelor (--tinta), deci se vede ca o fereastra taiata in pastila.
   Nu-i pune :hover si nu-i da cursor:pointer — nu se apasa. Scrisul e rosu: rosul spune "aici esti". */
.btns .pastila .acum { display:flex; align-items:center; justify-content:center;
                 flex:1 1 auto; min-width:0; padding:11px 13px;
                 white-space:nowrap; overflow:hidden;
                 border-left:1px solid var(--rule); border-right:1px solid var(--rule);
                 background:var(--paper);
                 font:600 14px/1 ui-sans-serif,system-ui; color:var(--rosu) }
.btns .pastila .acum .scurt { display:none }
/* Plasa: daca zona ajunge totusi mai stramta decat scrisul (scris marit din setarile telefonului),
   se taie CU TREI PUNCTE, nu la mijlocul literelor. */
.btns .pastila .acum b { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
/* Abonarea, singura afara: ramane lipita de marginea din dreapta */
.btns .abon { margin-left:auto }
/* butoanele mici: nu cresc, stau cat le tine continutul — aici numai abonarea */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui;
             letter-spacing:.06em; background:none; color:var(--ink); cursor:pointer }
.btns .mic svg { vertical-align:0 }

/* BARA ANILOR — sub randul de unelte, ascunsa pana se apasa cheia Arhivei, coborata din capul
   locului pe pagina Arhivei (unde a luat locul patratelelor cu ani din corpul paginii).
   ⚠️ Aici overflow:hidden E BUN (spre deosebire de pastila): din bara nu atarna nimic, iar taierea e
   tocmai ce tine colturile rotunde peste fasia derulata. */
.bara-ani { display:flex; align-items:stretch; margin:0 0 6px;
            border:1px solid var(--rule); border-radius:10px; background:var(--tinta);
            overflow:hidden }
.bara-ani[hidden] { display:none }
/* ⚠️ position:relative NU e de podoaba: JS-ul aduce anul deschis la mijloc cu offsetLeft, iar acela se
   masoara fata de cel mai apropiat stramos asezat. Fara el, offsetParent ajunge pagina si fasia se
   deschide derulata la capat (capcana platita la Calendar). */
.bara-ani .fasie { flex:1 1 auto; min-width:0; position:relative;
                   overflow-x:auto; overscroll-behavior-x:contain;
                   -webkit-overflow-scrolling:touch; scrollbar-width:none }
.bara-ani .fasie::-webkit-scrollbar { display:none }
.bara-ani .ani { display:flex; align-items:stretch; gap:0; width:max-content; padding:0 }
/* ANII: text simplu in capsula — fara chenar, fara fundal, fara rotunjire a lor; despartitura e o
   linie de 1 px, ca intre segmentele pastilei. Arhiva buletinului tine 15 ani (2012 incoace), deci
   fasia chiar se deruleaza, si pe desktop. */
.an-buton { flex:none; display:flex; align-items:center; justify-content:center;
            color:var(--soft); text-decoration:none; background:transparent;
            border:0; border-radius:0; padding:11px 13px;
            font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.03em; white-space:nowrap }
.an-buton + .an-buton { border-left:1px solid var(--rule) }
.an-buton:hover { color:var(--rosu); background:var(--paper) }
/* anul deschis: rosu si plin, ca segmentul pe care esti din pastila */
.an-buton.activ { color:var(--rosu); font-weight:700;
                  background:color-mix(in srgb, var(--rosu) 11%, transparent) }
/* Sagetile — segmentele de la capetele barei, pentru cine n-are deget. JS-ul le ascunde cu totul cand
   anii incap, ca sa nu stea doua segmente moarte in bara. */
.bara-ani .sageata { flex:none; border:0; background:transparent; color:var(--faint); cursor:pointer;
                     font:300 19px/1 ui-sans-serif,system-ui; padding:0 6px; border-radius:0 }
.bara-ani .sageata + .fasie, .bara-ani .fasie + .sageata { border-left:1px solid var(--rule) }
.bara-ani .sageata:hover:not([disabled]) { color:var(--rosu); background:var(--paper) }
.bara-ani .sageata[disabled] { opacity:.25; cursor:default }
.bara-ani .sageata[hidden] { display:none }

/* BARA CAUTARII — sub randul de unelte, ascunsa pana se apasa lupa din pastila. Are chenarul si
   rotunjirea pastilei de deasupra, ca sa se recunoasca: e acelasi lucru, mutat cu un rand mai jos.
   ⚠️ appearance:none e pentru iOS, care altfel deseneaza campul de cautare cu chenarul si rotunjirea
   lui, inauntrul chenarului nostru — chiar "buton in buton". */
.bara-cautare { display:flex; align-items:stretch; margin:0 0 6px;
                border:1px solid var(--rule); border-radius:10px; background:var(--tinta);
                overflow:hidden }
.bara-cautare[hidden] { display:none }
.bara-cautare .cauta { display:flex; align-items:stretch; flex:1 1 auto; min-width:0; margin:0 }
.cauta-camp { flex:1 1 auto; min-width:0; appearance:none; -webkit-appearance:none;
              border:0; border-radius:0; background:transparent; color:var(--ink);
              padding:11px 14px; outline:none; font:400 14px/1.2 ui-sans-serif,system-ui }
.cauta-camp::placeholder { color:var(--faint) }
.cauta-camp::-webkit-search-cancel-button { -webkit-appearance:none }
/* butonul de trimis: un segment la capat. Lupa lui e aceeasi cu a cheii de sus. */
.cauta-du { flex:0 0 46px; display:flex; align-items:center; justify-content:center;
            border:0; border-left:1px solid var(--rule); border-radius:0;
            background:transparent; color:var(--soft); cursor:pointer }
.cauta-du:hover { color:var(--rosu); background:var(--paper) }

/* ⚠️ PE TELEFON TOT RANDUL STA PE O SINGURA LINIE (regula Programului si a lui A8, 15.09.2026). Ce
   cade e cuvantul ABONARII, al carui plic se citeste singur; zona de scris NU se ascunde niciodata
   (regula Calendarului: "pe mobil, neaparat sa se vada scrisul"), si nici nu se prescurteaza cat
   incape: "Buletinul nr. 615" cere ~121 px, iar zona are ~120 la un telefon de 390 — de aceea banda
   381-411 px isi ia butoanele la 36, iar sub 380 la 34.
   ⚠️ DACA MAI ADAUGI UN SEGMENT IN PASTILA, SOCOTEALA ASTA SE REFACE. */
@media (max-width:600px) {
  .btns { gap:5px; flex-wrap:wrap }
  .btns .btn { flex:0 0 auto; white-space:nowrap }
  .btns .pastila { flex:1 1 0 }
  /* butoanele-iconita sunt PATRATE: padingul de sus e cel al carcasei (9px, din .btn), deci se
     scrie 9px si in laturi — o tinta de ~36x36, mai usoara de nimerit cu degetul. */
  .btns .mic { padding:9px }
  .btns .pastila .punct, .btns .pastila .viit, .btns .pastila .arh, .btns .pastila .cheie {
                 flex:0 0 42px; width:42px }
  .btns .cuv { display:none }
  .btns .pastila .acum { padding:11px 10px; font-size:13px }
  .btns .pastila .acum .lung { display:none }
  .btns .pastila .acum .scurt { display:inline }
}
/* ⚠️ PRAGUL E 411, nu 400: telefoanele din banda nu sunt rare — 390 (iPhone 14/15), 393 (Pixel 7),
   400 (Galaxy). De la 412 in sus scrisul incape si cu butoane de 42. */
@media (max-width:411px) {
  .btns .pastila .punct, .btns .pastila .viit, .btns .pastila .arh, .btns .pastila .cheie {
                 flex:0 0 36px; width:36px }
  .btns .pastila .acum { padding:11px 6px }
}
@media (max-width:380px) {
  .btns { gap:4px }
  .btns .mic { padding-left:7px; padding-right:7px }
  .btns .pastila .punct, .btns .pastila .viit, .btns .pastila .arh, .btns .pastila .cheie {
                 flex:0 0 34px; width:34px }
  .btns .pastila .acum { padding:11px 5px; font-size:12.5px }
}

/* ── FEREASTRA DE ABONARE, adusa intocmai de la Program prin Tipic — dialog nativ: fundalul
   intunecat, focusul si Escape vin de la browser, noi scriem doar cum arata.
   ⚠️ Oprirea derularii din spate NU se mai scrie aici: o face carcasa (@xc/ui), la orice fereastra. */
.modal { border:0; padding:0; border-radius:14px; width:min(420px, calc(100vw - 32px));
         background:var(--paper); color:var(--ink); box-shadow:0 18px 50px rgba(0,0,0,.22) }
.modal::backdrop { background:rgba(10,12,16,.45) }
/* display:block si margin:0 nu sunt de prisos: carcasa are o regula pe TOATE formularele, facuta
   pentru randurile de cautare; fara ele, titlul, textul si bifele s-ar insira ca niste jetoane. */
.modal-cutie { display:block; margin:0; padding:20px 22px 22px }
.modal-cap { display:flex; align-items:flex-start; justify-content:space-between; gap:14px }
.modal-cap h2 { margin:0; font-size:23px; font-weight:400 }
.modal-x { flex:0 0 auto; width:34px; height:34px; display:flex; align-items:center; justify-content:center;
           font:400 21px/1 ui-sans-serif,system-ui; color:var(--faint); background:transparent;
           border:1px solid var(--rule); border-radius:9px; cursor:pointer }
.modal-x:hover { color:var(--rosu); border-color:var(--rosu) }
.modal-spune { margin:10px 0 18px; color:var(--soft) }
.camp { display:block; margin:0 0 16px }
.camp span { display:block; font:600 10.5px/1 ui-sans-serif,system-ui; letter-spacing:.12em;
             text-transform:uppercase; color:var(--faint); margin:0 0 7px }
.camp input { width:100%; box-sizing:border-box; padding:11px 12px; font:15px ui-sans-serif,system-ui;
              color:var(--ink); background:var(--tinta); border:1px solid var(--rule); border-radius:10px }
/* scrisul bifelor e NORMAL, nu ingrosat: carcasa face din toate etichetele capete de camp */
.bifa { display:flex; align-items:center; gap:10px; margin:0 0 11px;
        font:400 14.5px/1.4 ui-sans-serif,system-ui; color:var(--soft) }
.bifa input { flex:0 0 auto; width:17px; height:17px; accent-color:var(--rosu) }
.modal-jos { display:flex; justify-content:flex-end; margin:20px 0 0 }
/* butonul plin: singurul loc din pagina unde rosul e fundal, nu scris — e fapta ferestrei */
.btn-plin { font:600 13px/1 ui-sans-serif,system-ui; letter-spacing:.06em; padding:13px 22px;
            color:var(--paper); background:var(--rosu); border:1px solid var(--rosu); border-radius:10px;
            cursor:pointer }

/* ── RĂSFOITUL: fereastra cu numarul, peste pagina, pe tot ecranul (cerere user, 13.09.2026),
   cu modulul Real3D FlipBook — acelasi de la jurnaluldeafaceri.
   Fundalul e inchis dinadins, ca hartia alba sa iasa in fata. */
.rasfoit { width:100vw; max-width:100vw; height:100vh; max-height:100vh; margin:0; padding:0;
           border:0; background:#14161a; color:#e9e9ea; overflow:hidden }
.rasfoit::backdrop { background:#14161a }
/* ⚠️ Capul sta DEASUPRA modulului, nu langa el: modulul isi aseaza singur uneltele peste toata
   fereastra (numarul paginii sus-stanga, bara jos), asa ca un cap in randul de sus ar fi acoperit
   si omul ar ramane fara buton de inchidere pe telefon, unde nu exista tasta Escape. */
.rasfoit-cap { position:fixed; top:8px; right:8px; z-index:2147483000;
               display:flex; align-items:center; gap:10px;
               font:14px/1 ui-sans-serif,system-ui }
.rasfoit-cap b { font-weight:600 }
.rasfoit-cand { color:rgba(233,233,234,.72) }
.rasfoit-cap b, .rasfoit-cand { text-shadow:0 1px 4px rgba(0,0,0,.75) }
.rasfoit .modal-x { color:#fff; border-color:rgba(255,255,255,.3); background:rgba(20,22,26,.72) }
.rasfoit .modal-x:hover { border-color:#fff }
/* scena ia toata fereastra; modulul se aseaza in ea */
.rasfoit-scena { position:absolute; inset:0; display:flex }
.rasfoit-carte { flex:1 1 auto; min-width:0; min-height:0 }
.rasfoit-vorba { position:absolute; left:0; right:0; bottom:18px; margin:0; text-align:center;
                 color:rgba(233,233,234,.7); font:14px ui-sans-serif,system-ui }
/* pe telefon, langa X incape doar numarul — data ar ajunge peste uneltele modulului */
@media (max-width:600px) {
  .rasfoit-cand { display:none }
}


/* ── CAPUL unui numar: eticheta, numarul mare, ziua */
.cap-numar { text-align:center; margin:26px 0 16px }
.cap-numar h2 { margin:2px 0 0; font-size:30px; letter-spacing:.02em }
.cap-numar .eticheta { margin:0; font:600 10.5px/1 ui-sans-serif,system-ui; letter-spacing:.14em;
                       text-transform:uppercase; color:var(--faint) }
.cap-numar .eticheta a { color:inherit; text-decoration:none }
.cap-numar .eticheta a:hover { color:var(--rosu) }
.cap-numar .cand { margin:6px 0 0; color:var(--soft); font-size:15px }

/* ── BULETINUL NOU. Capul e cel de la ORICE numar (.cap-numar): eticheta marunta, numarul mare,
   ziua. Se schimba doua lucruri, cerute de user (17.09.2026: "textul cu verde de deasupra vroiam sa
   fie la fel ca la oricare buletin, un text mic unde scrie numarul curent. Aici vroiam sa scrie
   numarul urmator. Doar culoarea vroiam sa fie putin mai evidentiata"):
   eticheta scrie "Numărul următor" si e VERDE, iar numarul mare e ROSU — culoarea bulinei din
   pastila, adica a numarului de care ne ocupam acum.
   ⚠️ Verdele NU e --azi: verdele "zilei de azi" (#12D96A) e facut pentru o dunga sau un fundal, nu
   pentru scris — pe hartie alba iese aprins si tipa (reclamat de user: "mi se pare ca verdele asta e
   prea aprins"). Aici e un verde SOBRU, de cerneala, iar noaptea se deschide doar cat sa ramana
   citet pe fundal inchis. */
.cap-nou { --verde:#0A6B41 }
@media (prefers-color-scheme: dark) { :root:not([data-tema="light"]) .cap-nou { --verde:#5FBF8D } }
:root[data-tema="dark"] .cap-nou { --verde:#5FBF8D }
/* eticheta pastreaza masura si spatierea celei obisnuite (vine din .cap-numar .eticheta); se schimba
   doar culoarea si greutatea, cat sa se vada ca nu e un numar aparut */
.cap-nou .eticheta.urmator { color:var(--verde); font-weight:700 }
.cap-nou h2 { color:var(--rosu) }
/* CHENARUL GOL, cat pagina intai a unui numar (user: "un chenar mare gol - cam cat este poza
   buletinului curent"). Aceeasi masura si acelasi raport ca .coperta, ca pagina sa se aseze de pe
   acum asa cum va arata cu numarul in ea. */
.chenar-nou { max-width:460px; margin:0 auto; aspect-ratio:460/650;
              border:1px dashed var(--rule); border-radius:6px; background:var(--tinta) }

/* ── FORMULARUL DE COMPUNERE (17.09.2026). Un singur șir de câmpuri, larg cât coloana de citit:
   textul buletinului se scrie seara, dintr-o bucată, nu se completează ca o cerere la ghișeu.
   ⚠️ Socoteala de sub fiecare text e piesa importantă a ecranului — de aceea stă LIPITĂ de câmp,
   nu la piciorul paginii, și se înroșește când s-a trecut peste măsură. */
.compunere { max-width:760px; margin:18px auto 0 }
.compunere .articol { border:1px solid var(--rule); border-radius:8px; padding:14px 16px 6px; margin:0 0 18px }
.compunere legend { font:600 15px ui-sans-serif,system-ui; padding:0 6px; color:var(--faint) }
.camp { margin:0 0 12px }
.camp label { display:block; font:600 13px ui-sans-serif,system-ui; margin:0 0 4px }
.camp input, .camp textarea, .cati-secundari select {
  width:100%; box-sizing:border-box; font:15px/1.45 ui-sans-serif,system-ui;
  padding:8px 10px; border:1px solid var(--rule); border-radius:6px;
  background:var(--paper); color:var(--ink) }
.camp textarea { font-family:Georgia,"Times New Roman",serif; resize:vertical; min-height:160px }
.camp .ajutor { display:block; font-size:13px; color:var(--faint); margin:3px 0 0 }
.doua { display:grid; grid-template-columns:1fr 1fr; gap:0 14px }
.socoteala { font:13px ui-sans-serif,system-ui; color:var(--faint); margin:0 0 10px }
.socoteala.peste { color:var(--rosu); font-weight:600 }
/* TOTALUL ȘI BUTONUL stau pe mijloc, sub ultimul articol scris (user, 18.09.2026: „să fie sub câmpul
   de text de mai sus, cu care este asociat"). Alegerea câtor secundare sunt s-a urcat deasupra
   articolului principal tocmai ca între ultimul text și total să nu mai cadă o listă derulantă. */
.total { font:600 14px ui-sans-serif,system-ui; text-align:center; margin:0 0 12px }
.cati-secundari { margin:0 0 16px }
.cati-secundari label { display:block; font:600 13px ui-sans-serif,system-ui; margin:0 0 4px }
.butoane { text-align:center; margin:0 0 8px }
.btn.mare { font-size:16px; padding:10px 22px }
@media (max-width:640px) { .doua { grid-template-columns:1fr } }

/* ── CIORNA: numarul proaspat compus, aratat CHIAR IN PAGINA, ca un buletin gata de validat
   (user, 18.09.2026). Un chenar in jurul lui, ca sa se vada ca e altceva decat formularul de
   dedesubt: inauntru sta un buletin intreg — coperta, butoanele lui si validarea. */
.ciorna { max-width:760px; margin:0 auto 22px; padding:16px 16px 18px; border:1px solid var(--rule);
          border-radius:10px; background:color-mix(in srgb, var(--ink) 3%, transparent) }
.ciorna .veste { text-align:center }
.ciorna .valideaza { text-align:center; margin:18px 0 0 }
/* Butonul care PUBLICA: verdele faptei duse la capat, nu rosul platformei — rosul e, peste tot aici,
   al lucrului nefacut (numarul nou, atentia, socoteala trecuta peste masura). */
.btn.mare.bun { background:#0A6B41; border-color:#0A6B41; color:#fff }
.btn.mare.bun:hover { background:#095c38; border-color:#095c38 }
.ciorna .marunt { text-align:center; margin:8px 0 0 }

/* ── COPERTA: pagina intai, mare, care duce in PDF. Chenar subtire si o umbra abia simtita,
   ca sa se vada ca e o hartie, nu o poza lipita pe fundal. */
.coperta { display:block; max-width:460px; margin:0 auto; line-height:0 }
.coperta img { width:100%; height:auto; border:1px solid var(--rule); border-radius:6px;
               box-shadow:0 10px 28px rgba(0,0,0,.10); background:var(--paper) }
a.coperta:hover img { border-color:var(--rosu) }
/* butoanele de sub coperta: la mijloc, cat le tine textul */
.btns.hartii { justify-content:center; flex-wrap:wrap; margin:18px 0 0 }
.btns.hartii .btn { display:inline-flex; align-items:center; gap:8px }
.btns.hartii .btn small { color:var(--faint); font-weight:400 }
/* PASTILA lui Tipărește (23:14, 17.09.2026): doua segmente lipite — Tipărește si reversul, o iconita
   de rasturnare fara cuvant. Aceeasi pastila ca in antet, doar ca aici nu se intinde pe tot randul.
   Reversul e intrerupator: aprins (aria-pressed) se scrie ca un segment activ — rosu, fundal palid. */
.btns.hartii .pastila { flex:0 0 auto; display:inline-flex }
.btns.hartii .pastila .btn { display:inline-flex }
.btns.hartii .com-revers { cursor:pointer; font:inherit; color:inherit; padding-left:14px; padding-right:14px }
.btns.hartii .com-revers:hover { color:var(--rosu); background:var(--paper) }
.btns.hartii .com-revers[aria-pressed="true"] { color:var(--rosu);
                 background:color-mix(in srgb, var(--rosu) 11%, transparent) }

/* ── RAFTUL: fisele numerelor, cu pagina intai deasupra. Cate incap pe rand — patru pe ecran de
   birou, doua pe telefon — le hotaraste latimea minima a fisei, nu un numar de coloane scris de noi. */
.raft { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:16px 14px; margin:10px 0 22px }
.fisa { display:block; text-align:center; text-decoration:none; color:var(--ink) }
.fisa .cop { display:block; width:100%; height:auto; aspect-ratio:460/650; object-fit:cover; object-position:top center;
             border:1px solid var(--rule); border-radius:4px; background:var(--paper) }
.fisa:hover .cop { border-color:var(--rosu) }
.fisa b { display:block; margin-top:6px; font:600 13px/1.2 ui-sans-serif,system-ui }
.fisa span { display:block; font:12px/1.3 ui-sans-serif,system-ui; color:var(--faint) }
.fisa:hover b { color:var(--rosu) }
/* numerele ramase in arhiva fara nicio poza: un dreptunghi cu numarul scris in el */
.cop.fara { display:flex; align-items:center; justify-content:center; aspect-ratio:460/650;
            border:1px dashed var(--rule); border-radius:4px; color:var(--faint);
            font:13px ui-sans-serif,system-ui }
/* fasia „numerele dinainte" de pe prima pagina: acelasi raft, dar pe UN rand care se deruleaza
   lateral — pe prima pagina numarul curent trebuie sa ramana ce se vede, nu inceputul unei liste */
.titlu-fasie { margin:34px 0 0; font:600 11px/1 ui-sans-serif,system-ui; letter-spacing:.14em;
               text-transform:uppercase; color:var(--soft) }
.raft.fasie { grid-auto-flow:column; grid-auto-columns:104px; grid-template-columns:none;
              overflow-x:auto; padding-bottom:6px; scrollbar-width:thin }

/* ── ARHIVA */
/* ⚠️ Patratelele cu ani (.capitole) au iesit din corpul paginii la 17.09.2026: anii se aleg din
   fasia de sub antet, un singur loc. Stilul lor local a plecat odata cu ele. */
.an h3 { margin:26px 0 6px }
.an h4 { margin:18px 0 4px; font:600 11px/1 ui-sans-serif,system-ui;
         letter-spacing:.14em; text-transform:uppercase; color:var(--soft) }

/* ── CAUTAREA: un rand pe numar — pagina intai mica, apoi numarul si fragmentul gasit */
.gasite { margin:14px 0 }
.gasit { display:grid; grid-template-columns:56px 1fr; gap:0 14px; align-items:start;
         padding:10px 0; border-bottom:1px solid var(--rule); text-decoration:none; color:var(--ink) }
.gasit:last-child { border-bottom:0 }
.gasit .cop.mica { width:56px; height:auto; aspect-ratio:460/650; object-fit:cover; object-position:top center;
                   border:1px solid var(--rule); border-radius:3px }
.gasit b { font-size:15.5px }
.gasit > div > span { color:var(--soft); font-size:14px; margin-left:6px }
.gasit p { margin:4px 0 0; font-size:14px; line-height:1.5; color:var(--soft) }
.gasit mark { background:var(--azi-fund); color:var(--ink); font-weight:600; padding:0 1px; border-radius:3px }
.gasit:hover b { color:var(--rosu) }
` + STIL_ABONARE + STIL_SETARI
