import { STIL_SETARI } from "@xc/setari"
/**
 * Stilul LOCAL al newsletterului. Se lipeste DUPA stilul comun din `@xc/ui` si il suprascrie — la
 * specificitate egala castiga ce e mai jos.
 *
 * Vine cuvant cu cuvant din V1 (`biserica-newsletter/src/stil.ts`, v0.6.5): regulile de aici sunt
 * ale emailurilor randate cu motorul MailPoet, adunate bucata cu bucata pana au aratat bine — „e
 * multa munca acolo pe care nu vreau s-o refac acum" (user, 10.09.2026).
 *
 * ⚠️ Fara accent grav in comentariile de aici: stilul e un template literal, iar un backtick intr-un
 * comentariu inchide sirul si `tsc` scoate erori fara legatura cu locul vinovat.
 */
export const LOCAL = `
/* ARHIVA — un rand pe numar: data marunta la stanga, subiectul dupa ea.
   Nu tabel: pe telefon subiectele sunt lungi si un tabel le-ar rupe urat. */
.luna { margin:30px 0 6px }
.numere { list-style:none; padding:0; margin:0 }
.numere li { padding:9px 0; border-bottom:1px solid var(--rule) }
.numere li:last-child { border-bottom:0 }
.numere .cand { display:inline-block; min-width:58px; color:var(--faint);
                font:13px/1.5 ui-sans-serif,system-ui }
.numere a { color:var(--ink); text-decoration:none }
.numere a:hover { color:var(--rosu); text-decoration:underline }
/* la cautare randurile vin din ani diferiti, deci data poarta si anul — ii trebuie loc */
.numere.cu-an .cand { min-width:88px }
.cate { color:var(--faint); font-size:14px; margin:2px 0 0 }

/* NEWSLETTERUL. Ce se vede aici e emailul asa cum a plecat — tabele si culori
   proprii, scrise acum ani. De-aia are nevoie de doua lucruri:
   1. sa scape de stilul global de tabel (chenare, padding, majuscule la <th>),
   2. sa ramana pe fundal alb si text negru si la tema intunecata — un email nu
      are tema, iar culorile lui sunt scrise in el cu inline style. */
.email { background:#fff; color:#111; border:1px solid var(--rule); border-radius:12px;
         overflow:hidden; margin:18px 0 0 }
.email table { border-collapse:collapse; width:auto; font-size:inherit }
/* Resetul NU atinge text-align si vertical-align: emailul isi spune singur alinierea prin
   atributele "align" si "valign" de pe celule, iar acelea pierd in fata oricarei reguli
   de autor. O regula text-align:inherit aici ar descentra tot ce emailul a centrat. */
.email td, .email th { padding:0; border:0;
                       font:inherit; letter-spacing:normal; text-transform:none; color:inherit }
.email img { max-width:100%; height:auto }
/* MailPoet scoate pozele cu display:block — iar un bloc nu se centreaza din text-align,
   oricat ar scrie align="center" pe celula. In inbox trec fiindca clientii de email nu
   respecta display; intr-un browser adevarat stau la stanga. De-aia: margini automate,
   dar numai in celulele care CHIAR cer centrare (crucea din capul fiecarui numar, poza
   de antet, ilustratiile). Cerere user, 8 sept. 2026: "centreaza crucea". */
.email td[align="center"] img { margin-left:auto; margin-right:auto }
/* Previzualizarea buletinului parohiei — pagina scanata a foii. In email sta intr-o
   coloana de 220 px, langa una de 440: bine pentru un inbox, prea mic pentru o pagina
   scrisa marunt. Aici randul se desface pe verticala si scanarea ia toata latimea.
   Semnul dupa care o cunoastem e numele fisierului, "buletin-nr…" (349 din 448 de
   numere) — nu linkul spre PDF, fiindca numerele mai vechi pun scanarea fara link.
   Numai randurile care CHIAR poarta scanarea; celelalte coloane raman cum au fost
   scrise. (Cerere user, 8 sept. 2026: "este mic dar trebuie sa fie 100% width".) */
.email td:has(> div > table img[src*="buletin-nr"]) > div,
.email td:has(> div > table img[src*="buletin-nr"]) > div > table {
  max-width:100% !important; width:100% !important }
.email img[src*="buletin-nr"] { width:100% }
.email a { text-decoration:underline }
.email hr { margin:0 }
/* fundalul cenusiu al ramei de email nu-si are rostul intr-o pagina: pagina e rama */
.email .mailpoet_template, .email .mailpoet-wrapper { background:transparent !important }
/* media queries proprii ale MailPoet, luate din emailurile randate */
@media screen and (max-width: 480px) {
  .email .mailpoet_button { width:100% !important }
}
@media screen and (max-width: 599px) {
  .email .mailpoet_header { padding:10px 20px }
  .email .mailpoet_button { width:100% !important; padding:5px 0 !important;
                            box-sizing:border-box !important }
  .email div, .email .mailpoet_cols-two, .email .mailpoet_cols-three { max-width:100% !important }
}

/* MENIUL DIN ANTET, REFACUT LA 15.09.2026 DUPA CHIPUL CALENDARULUI SI AL PROGRAMULUI (user: "preia
   logica de meniu principal din antet de la Calendar si Program si refa meniul"): o PASTILA cat tot
   randul — bulina · zona de scris · sageata · Arhiva · lupa — si, singura afara la dreapta, ABONAREA.
   Asezarea de dinainte (doua sageti cu bulina intre ele, bara despartitoare, doua butoane mici) venea
   din V1 si a cazut toata. Ce a ramas neschimbat: butonul fara tinta se scrie estompat (.gol), pe
   loc, ca randul sa nu joace de la o pagina la alta. */
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
   ⚠️ Fara overflow:hidden: rotunjirea colturilor o duc segmentele de la capete, fiecare al lui. Daca
   vreodata atarna un meniu de ultimul segment, taierea l-ar inghiti cu totul. */
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
/* cheia-lupa e un <button>, nu un link: ii trebuie spuse cursorul si hoverul, fiindca regula de mai
   sus prinde numai a.btn */
.btns .pastila button.cheie { cursor:pointer; color:inherit }
.btns .pastila button.cheie:hover { color:var(--rosu); background:var(--paper) }
/* cat timp bara ei e coborata, cheia sta aprinsa — ca omul sa stie de unde a iesit ce vede sub antet */
.btns .pastila .cheie[aria-expanded="true"] { color:var(--rosu);
                 background:color-mix(in srgb, var(--rosu) 11%, transparent) }
/* ZONA DE SCRIS — pe ce numar esti. Ia tot prisosul, iar butoanele stau la masura lor fixa.
   ⚠️ NU E UN BUTON, E O ZONA DE SEMNALIZARE (regula Calendarului, 15.09.2026): fundalul ei e hartia
   paginii (--paper), nu umplutura butoanelor (--tinta), deci se vede ca o fereastra taiata in
   pastila. Nu-i pune :hover si nu-i da cursor:pointer — nu se apasa. Scrisul e rosu: rosul spune
   "aici esti". Liniile din stanga si din dreapta tin loc de despartitura intre segmente. */
.btns .pastila .acum { display:flex; align-items:center; justify-content:center;
                 flex:1 1 auto; min-width:0; padding:11px 13px;
                 white-space:nowrap; overflow:hidden;
                 border-left:1px solid var(--rule); border-right:1px solid var(--rule);
                 background:var(--paper);
                 font:600 14px/1 ui-sans-serif,system-ui; color:var(--rosu) }
.btns .pastila .acum .scurt { display:none }
/* Plasa: daca zona ajunge totusi mai stramta decat scrisul (scris marit din setarile telefonului),
   se taie CU TREI PUNCTE, nu la mijlocul literelor — un scris centrat intr-o cutie cu
   overflow:hidden s-ar ciunti la amandoua capetele si nu s-ar mai citi. */
.btns .pastila .acum b { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
/* Abonarea, singura afara: ramane lipita de marginea din dreapta */
.btns .abon { margin-left:auto }
/* butoanele mici: nu cresc, stau cat le tine continutul — aici numai abonarea */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui;
             letter-spacing:.06em }
.btns .mic svg { vertical-align:0 }

/* BARA CAUTARII — sub randul de unelte, ascunsa pana se apasa lupa din pastila. Are chenarul si
   rotunjirea pastilei de deasupra, ca sa se recunoasca: e acelasi lucru, mutat cu un rand mai jos.
   Pana azi cautarea era un formular gol sub antet, fara chenar si fara masura.
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
/* butonul de trimis: un segment la capat. Lupa lui e aceeasi cu a cheii de sus, ca sa se vada ca
   bara asta e a ei. */
.cauta-du { flex:0 0 46px; display:flex; align-items:center; justify-content:center;
            border:0; border-left:1px solid var(--rule); border-radius:0;
            background:transparent; color:var(--soft); cursor:pointer }
.cauta-du:hover { color:var(--rosu); background:var(--paper) }

/* FEREASTRA DE ABONARE — dialog nativ: fundalul intunecat, focusul si Escape vin de la browser, noi
   scriem doar cum arata. Adusa intocmai de la Tipic, ca fereastra sa fie aceeasi peste tot.
   ⚠️ Oprirea derularii din spate NU se scrie aici: o face carcasa (@xc/ui), la orice fereastra. */
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

/* ⚠️ PE TELEFON TOT RANDUL STA PE O SINGURA LINIE (regula Programului, 15.09.2026). Ce cade e
   cuvantul ABONARII, al carui plic se citeste singur; zona de scris NU se ascunde niciodata (regula
   Calendarului: "pe mobil, neaparat sa se vada scrisul") — trece doar pe forma scurta.
   Socoteala la un telefon de 390, cu ~335 de folosit: patru butoane a 42 = 168, plus spatiile de 5
   si abonarea de ~44, raman ~110 pentru scris. "Nr. curent" cere ~72, deci incape intreg, si la 360.
   ⚠️ DACA MAI ADAUGI UN SEGMENT IN PASTILA, SOCOTEALA ASTA SE REFACE — nu mai e loc de imprumut. */
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
/* Telefoanele inguste (Android de 360 px si mai jos): butoanele mai lasa cativa pixeli si zona de
   scris se strange si ea — nu mai sunt patrate la milimetru, dar randul ramane pe o linie. */
@media (max-width:380px) {
  .btns { gap:4px }
  .btns .mic { padding-left:7px; padding-right:7px }
  .btns .pastila .punct, .btns .pastila .viit, .btns .pastila .arh, .btns .pastila .cheie {
                 flex:0 0 36px; width:36px }
  .btns .pastila .acum { padding:11px 6px; font-size:12.5px }
}
mark { background:var(--azi-fund); color:inherit; padding:0 2px; border-radius:3px }
.gol { color:var(--soft) }
` + STIL_SETARI
