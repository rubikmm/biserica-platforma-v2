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

/* ── ANTETUL: abonarea, o liniuta verticala, Arhiva si lupa (asezarea din V1) */
.btns .gol { opacity:.35; pointer-events:none }
/* bara verticala dintre abonare si butoanele aplicatiei */
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }
/* butoanele mici (abonarea, Arhiva, lupa): stau cat le tine iconita, nu cresc sa umple randul */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px }
.btns .mic svg { vertical-align:0 }
.btns .abon { font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.06em;
              background:none; color:var(--ink); cursor:pointer }
/* formularul de cautare, sub linia antetului (slotul subantet) */
#cautare { margin:2px 0 8px }
#cautare button { flex:0 0 auto; padding:9px 18px; border:1px solid var(--rule);
                  border-radius:10px; background:none; color:var(--ink);
                  font:15px ui-sans-serif,system-ui; cursor:pointer }
#cautare button:hover { border-color:var(--rosu); color:var(--rosu) }
@media (max-width:600px) {
  .btns { gap:7px; flex-wrap:wrap }
  .btns .cuv { display:none }
  .btns .mic { padding-left:10px; padding-right:10px }
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
.btns.vecini { margin:22px 0 0 }

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
.sub-fasie { margin-top:0 }

/* ── ARHIVA */
/* anul ALES ramane link (a.acum), ca in V1: se poate apasa si cand e selectat. */
.capitole a.acum { border-color:var(--rosu); color:var(--rosu); font-weight:600 }
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
