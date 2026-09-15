/**
 * A9 · Tipicul — stilul LOCAL al aplicatiei, adus din V1 (`biserica-tipic/src/stil.ts`, 2 sept.
 * 2026) cuvant cu cuvant: „să respecți mesajele și grafica din V1" (user, 10.09.2026).
 *
 * Se lipeste DUPA `STIL_COMUN` din `@xc/ui` si il suprascrie — la specificitate egala castiga ce
 * e mai jos. Aici stau numai lucrurile care sunt ale Tipicului. Variabilele (--rosu, --soft,
 * --rule, --faint, --paper, --ink, --tinta, --azi) vin din carcasa comuna, nu se redefinesc.
 *
 * ⚠️ La coada lui se lipeste `STIL_ABONARE` din `@xc/abonare`: bucatile NOI ale ferestrei (randul
 * rosu al validarii, linkul din bifa, cele sase casute ale codului) stau o singura data, langa
 * HTML-ul lor. Restul ferestrei (`.modal`, `.camp`, `.bifa`, `.btn-plin`) e mai jos, neatins.
 *
 * ⚠️ Fara backtick in comentariile de dedesubt: stilul intreg e un template literal.
 */
import { STIL_ABONARE } from '@xc/abonare'
import { STIL_SETARI } from '@xc/setari'

export const LOCAL = `
/* Capitolele paginii: mai mari decat textul, in gri si intr-un chenar, ca sa se vada
   ca sunt titluri si unde incepe fiecare sectiune (user, 1 sept — inainte erau rosii
   si se pierdeau printre randuri). Comentariul din A9 le da drept comune tuturor
   aplicatiilor; pana se hotaraste, stau local, ca sa nu schimbe paginile celorlalte.
   FARA fundal plin: cu el capitolele arata a butoane, nu a titluri (user, 1 sept).
   Ramane doar chenarul, care desparte sectiunile. */
:root { --capitol:var(--soft) }
h3 { font-size:20px; font-weight:600; color:var(--capitol);
     margin:38px 0 16px; padding:10px 14px;
     border:1px solid var(--rule); border-radius:8px; background:none }

/* Fiecare parte a paginii (Tipiconal, Rânduiala, Mineiul) se inchide DE TOT din
   capul ei, ca pericopele (user, 1 sept). Deosebirea, ceruta tot de user: la pericope
   sageata sta in STANGA, cum o pune browserul, iar aici in DREAPTA barei — asa se vede
   dintr-o privire care e parte mare a paginii si care e pericopa. Titlul ramane cum era
   (chenar, fara fundal plin): acum e si maner, dar tot titlu. */
.parte { border:none; border-radius:0; padding:0; margin:0 }
.parte > summary { list-style:none; cursor:pointer; margin:0; color:inherit }
.parte > summary::-webkit-details-marker { display:none }
.parte[open] > summary { margin-bottom:0 }
.parte > summary h3 { display:flex; align-items:center; justify-content:space-between; gap:12px }
/* Sursa, marunt, chiar in bara titlului (user, 2 sept). Partile pornesc INCHISE, deci
   cardul PDF de dedesubt — care spunea pana acum din ce carte vine partea — nu se mai
   vede la deschiderea paginii; sursa trebuie sa se citeasca din capul locului.
   Sta pe randul de SUB titlu, si pe telefon, si pe ecran lat (user, 2 sept: „nu arata
   bine in continuarea titlului"). Intai fusese asezata in continuare pe ecran lat si
   dedesubt doar pe telefon; asa insa numele partii si numele cartii se citeau ca un
   singur rand lung, desi sunt doua lucruri. Un rand, un lucru. */
.parte > summary h3 .cap { display:flex; flex-direction:column; flex:1 1 auto;
                           min-width:0; gap:3px }
.parte > summary h3 .sursa { font:400 13px/1.4 ui-sans-serif,system-ui; color:var(--faint) }
/* Cuvantul „Sursa:" din fata se scrie cu un ton mai deschis decat numele cartii
   (user, 2 sept: „un pic mai alba") — la 13px si --faint eticheta se pierdea de tot,
   iar randul nu se mai citea ca „Sursa: <cartea>". */
.parte > summary h3 .sursa .et { color:var(--soft) }
.parte > summary h3::after { content:""; flex:none; width:9px; height:9px; margin-right:4px;
                             border-right:2px solid currentColor; border-bottom:2px solid currentColor;
                             opacity:.8; transform:rotate(-45deg); transition:transform .15s ease }
.parte[open] > summary h3::after { transform:rotate(45deg) }
.parte > summary:hover h3, .parte > summary:focus-visible h3 { border-color:var(--soft) }
/* randuiala: slujbele pe randuri stranse, cu eticheta ingrosata — nu bloc de discurs.
   Ingrosatul e rosu in amandoua randuielile (ROEA si Anuar): asta se cauta cu ochiul. */
.tipic p { margin:6px 0 }
.tipic b { font-weight:600; color:var(--rosu) }
/* indemnul de sub zilele fara randuiala — sters, sa nu se ia drept continut */
.indemn { color:var(--faint) }
/* randuiala din Anuar: se tine de cartea tiparita — ingrosat capul de alineat
   (slujba), cursiv ce se canta sau se citeste. */
.anuar p { margin:10px 0 }
.anuar i { font-style:italic }
/* Mineiul — nu randuiala, ci textul slujbei. Cartea tipareste patru feluri de rand si
   tot patru se vad si aici.
   ROSUL E SEMNALIZAREA, si merge pe TOATE semnalizarile (user, 1 sept): si numele
   slujbei („LA UTRENIE"), si indicatia tipiconala („Slavă...", „Podobie:", „Stih:").
   Asa e si in carte — tipicalele sunt tiparite cu rosu peste tot, tocmai fiindca astea
   sunt randurile pe care le cauti cu ochiul cand slujesti. Ce le deosebeste intre ele
   nu e culoarea, ci marimea si asezarea, tot ca in carte: numele slujbei mai mare si
   rarit, indicatia marunta si aplecata. Textul cantat ramane in culoarea paginii, iar
   sinaxarul, ca in carte, e cules mai mic decat cantarile.
   Ce e cules CENTRAT in carte se aseaza centrat si aici — asezarea vine masurata din
   PDF, nu ghicita: vezi scripts/minei.mjs. */
.minei p { margin:9px 0 }
.minei .slujba { margin:26px 0 10px; font:600 13px/1.4 ui-sans-serif,system-ui;
                 letter-spacing:.09em; color:var(--rosu) }
.minei .slujba:first-child { margin-top:4px }
.minei .tipiconal { margin:8px 0; font-size:14px; font-style:italic; color:var(--rosu) }
.minei .sinaxar { font-size:15px; color:var(--soft) }
.minei .centrat { text-align:center; text-wrap:balance }

/* titlul zilei, sus sub data: culorile vin de la A1-calendar, dupa rangul sarbatorii */
.praznic { margin:2px 0 18px; font-size:19px; line-height:1.4 }
.c-rosu { color:var(--rosu) }
.c-albastru { color:var(--albastru) }
/* La DUMINICI titlul se aseaza pe trei randuri, ca la Calendar (user, 1 sept):
   numele duminicii sus, rosu — rosul e AL DUMINICII, deci numai al lui —, sfintii
   sub el cu litera obisnuita (albastru la sfintii romani, rosu doar cand pica o
   sarbatoare cu cruce rosie), iar pericopele si glasul jos, marunt.
   Numele sunt aceleasi ca in A1: aceeasi asezare, acelasi nume. */
.titlu-zi { margin:2px 0 0; font-size:19px; line-height:1.4; color:var(--rosu) }
.sfinti { margin:5px 0 0; font-size:16px; line-height:1.45 }
/* crucea din capul sfantului: doar putin mai mica, fara margine — spatiul dintre ea si
   nume e spatiul obisnuit din text. Cu margine peste el iesea o pauza nefireasca, care
   se vedea mai ales la sfintii romani, scrisi cu albastru (user, 1 sept). */
.titlu-zi .cr, .sfinti .cr { font-size:15px }
.pericope { margin:7px 0 18px; font:13px/1.5 ui-sans-serif,system-ui; color:var(--faint) }
.pericope .glas { font-weight:600; color:var(--soft) }

/* Blocul lung isi tine marginile la el, si taiat, si desfacut de tot: display:flow-root.
   Fara ea, la ultima apasare — cand se scoate overflow:hidden odata cu clasa
   „taiat" — marginea primului paragraf se contopea cu marginea titlului de deasupra
   si tot textul sarea cu cativa pixeli in SUS, ca un tresarit (user, 2 sept).
   Regula de fond: o clasa care aduce si scoate overflow:hidden muta si marginile;
   contextul de asezare trebuie prins in afara clasei care se schimba. */
[data-lung] { display:flow-root }

/* Textele lungi stau taiate la 12 randuri, cu o linie si butonul „mai mult" pe ea.
   Inaltimea de aici e doar cea de pornire: la fiecare apasare scriptul o dubleaza,
   pana incape tot textul (user, 1 sept). Clasa ramane a estomparii de la coada.
   ESTOMPAREA SE MASOARA IN RANDURI, NU IN PROCENTE (user, 1 sept): cu 78% ea
   crestea odata cu blocul, si la Minei, dupa cateva apasari, ajungeau doua-trei
   ecrane de text sters. Acum tine mereu doua randuri si jumatate, oricat s-ar
   desfasura zona — se vede ca textul continua, fara sa manance pagina. */
.taiat { max-height:19.2em; overflow:hidden;
         -webkit-mask-image:linear-gradient(#000 calc(100% - 4em),transparent);
         mask-image:linear-gradient(#000 calc(100% - 4em),transparent) }
.mai-mult { position:relative; text-align:center; margin:14px 0 4px }
.mai-mult::before { content:""; position:absolute; left:0; right:0; top:50%;
                    border-top:1px solid var(--rule) }
.btn-mai { position:relative; background:var(--paper); color:var(--soft);
           border:1px solid var(--rule); border-radius:999px; padding:5px 16px;
           font:600 13px ui-sans-serif,system-ui; cursor:pointer }
.btn-mai:hover { color:var(--rosu); border-color:var(--rosu) }
/* Capatul textului: cand s-a desfacut tot, butonul DISPARE si in locul lui ramane
   linia cu cuvantul SFÂRȘIT (user, 2 sept). Desfacerea e definitiva — inapoi se
   ajunge doar reincarcand pagina —, deci nu mai e nimic de apasat aici; capatul se
   spune o data. Cuvantul poarta chiar hainele liniei pe care statea butonul, ca
   locul sa se recunoasca: aceeasi linie, acelasi mijloc. */
.sfarsit { position:relative; text-align:center; margin:20px 0 4px }
.sfarsit::before { content:""; position:absolute; left:0; right:0; top:50%;
                   border-top:1px solid var(--rule) }
.sfarsit span { position:relative; background:var(--paper); padding:0 14px;
                font:600 12px/1 ui-sans-serif,system-ui; letter-spacing:.18em;
                color:var(--soft) }

/* trimiterea la carte: se poarta ca butoanele din antet (user, 1 sept) — acelasi chenar,
   acelasi fundal (--tinta), aceeasi rotunjire, aceeasi litera si acelasi rosu la atins.
   Ce o deosebeste tine de continut, nu de fel: foaia PDF in stanga si doua randuri
   langa ea (numele cartii + pagina zilei), iar grupul sta la dreapta, sub text. */
.la-carte { margin:16px 0 4px; text-align:right }
.carte { display:inline-flex; align-items:center; gap:12px; text-align:left;
         padding:10px 14px; border:1px solid var(--rule); border-radius:10px;
         background:var(--tinta); color:var(--ink);
         font:15px ui-sans-serif,system-ui; text-decoration:none; cursor:pointer }
.carte:hover { border-color:var(--rosu); color:var(--rosu) }
.carte:hover .pag { color:var(--rosu) }
/* foaia sta libera, fara al doilea chenar — creste ea cat tinea locul insignei.
   Culoarea o mosteneste de la buton, ca sa treaca si ea pe rosu la atins. */
.insigna { display:grid; place-items:center; width:44px; height:44px; flex:none }
.carte .ce { display:flex; flex-direction:column; line-height:1.3 }
.carte .ce b { font-weight:600; font-size:15px }
.carte .pag { font:13px ui-sans-serif,system-ui; color:var(--faint); margin-top:2px }

/* versetele pericopelor: numarul marunt, in fata randului (in V1 statea in stilul comun al
   carcasei; aici e singura aplicatie care scrie versete, deci regula sta local). */
.vers b { color:var(--faint); font:600 12px ui-sans-serif,system-ui; margin-right:4px }

/* RANDUL DE UNELTE din antet, refacut dupa Program si Calendar (user, 13.09.2026: „meniul principal
   să semene ca la Program și Calendar… să fie abonare și calendar"). Doua grupuri: la stanga pastila
   navigarii si abonarea, la dreapta — lipit de margine, dupa bara verticala — calendarul.
   ⚠️ Regulile de mai jos sunt COPIATE din Program (pastila, bulina, segmentul cu scris) si din
   Calendar (butoanele mici, bara, fereastra). Daca se schimba forma pastilei intr-un loc, se schimba
   in toate trei: tocmai asemanarea lor a fost ceruta. */

/* carcasa comuna lasa randul sa se rupa; aici, ca la Program, butoanele se string in loc sa sara */
.btns { flex-wrap:nowrap }
.btns .btn { min-width:0 }
/* treapta pe care CHIAR esti: nu duce nicaieri, dar se apasa — atunci ia focusul si ramane marcata */
.btns .btn[aria-disabled="true"] { cursor:default }
.btns .btn[aria-disabled="true"]:focus { outline:none; background:var(--azi-fund) }

/* PASTILA navigarii: segmentele lipite intr-un singur corp, cu chenarul si rotunjirea pe pastila.
   Aici e „larga" de la Program — cea cu doua segmente —, fiindca tot doua are si Tipicul: bulina
   zilei de azi si „Mâine". Creste cat o tine randul; prisosul il ia doar segmentul cu scris. */
.btns .pastila { display:flex; flex:1 1 auto; min-width:0; border:1px solid var(--rule); border-radius:10px;
                 background:var(--tinta); overflow:hidden }
.btns .pastila .btn { flex:0 0 auto; border:0; border-radius:0; background:transparent }
.btns .pastila .btn + .btn { border-left:1px solid var(--rule) }
.btns .pastila a.btn:hover { color:var(--rosu); background:var(--paper) }
.btns .pastila .btn.activ { color:var(--rosu); font-weight:600;
                            background:color-mix(in srgb, var(--rosu) 11%, transparent) }
.btns .pastila .btn[aria-disabled="true"]:focus { background:color-mix(in srgb, var(--rosu) 18%, transparent) }
.btns .pastila .viit { flex:1 1 auto; min-width:0 }
/* BULINA zilei de azi: un punct, fara text, la fel de inalt ca segmentul de langa el */
.btns .punct { flex:0 0 auto; display:flex; align-items:center; justify-content:center;
               padding-left:20px; padding-right:20px }
.btns .punct::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.btns .punct:hover { color:var(--rosu) }
/* „Mâine" poarta si cuvantul (.cuv), si sageata (.sgt), amandoua scrise in pagina; pe larg se vede
   cuvantul singur. Alegerea o face CSS-ul, nu JS-ul, deci nu apuca sa se vada forma nepotrivita. */
.btns .viit .sgt { display:none }

/* GRUPUL DIN DREAPTA: margin-left:auto il impinge in capat, iar pastila ramane cu tot ce prisoseste */
.btns .unelte-dr { display:flex; align-items:stretch; gap:10px; flex:0 0 auto; margin-left:auto }
/* bara verticala dintre cele doua grupuri */
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }
/* butoanele mici — abonarea si calendarul: nu cresc, stau cat le tine continutul */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui;
             letter-spacing:.06em }
.btns .mic svg { vertical-align:0 }

/* FEREASTRA DE ABONARE, adusa intocmai de la Program prin Calendar — dialog nativ: fundalul
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

/* PE TELEFON randul are de dus doar trei lucruri — pastila, abonarea si calendarul —, deci cuvantul
   „Mâine" RAMANE (ca in pastila larga a Programului) si cade numai cuvantul abonarii, al carui plic
   se citeste singur. Numele intreg sta in title si aria-label, deci nu se pierde. */
@media (max-width:600px) {
  .btns { gap:7px }
  .btns .mic { padding:9px }
  .btns .abon .cuv { display:none }
  .btns .unelte-dr { gap:5px }
  .btns .punct { padding-left:22px; padding-right:22px }
}
/* Telefoanele inguste: cade bara verticala dintre grupuri — pastila se vede oricum ca un corp. */
@media (max-width:380px) {
  .btns .desparte { display:none }
  .btns .mic { padding-left:7px; padding-right:7px }
}

/* calendarul de selectie: doar zilele cu randuiala sunt vii */
.cal td, .cal th { text-align:center; padding:6px 4px }
.cal td { border-bottom:0 }
.cal a { text-decoration:none }
.cal a b { font-weight:600 }
.cal span[aria-disabled] { color:var(--faint); opacity:.55 }
.cal a.acum b { color:var(--ink) }
.cal a.acum { background:var(--azi-fund); outline:1px solid var(--azi); border-radius:8px;
              display:inline-block; min-width:30px }
/* panoul calendarului, deschis din butonul din antet, fara reincarcare */
#cal { padding:10px 2px 6px }
#cal nav { display:flex; justify-content:space-between; align-items:center; margin:0 0 6px }
#cal nav button { padding:5px 12px }
` + STIL_ABONARE + STIL_SETARI;
