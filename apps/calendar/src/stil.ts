/**
 * Calendar · stilul LOCAL al aplicatiei — adus din V1 neschimbat (cerere user, 10.09.2026:
 * „să respecți mesajele și grafica din V1 — este multă muncă acolo pe care nu vreau s-o refac").
 *
 * Se lipeste DUPA stilul global al carcasei (`@xc/ui`) si il suprascrie.
 */
export const LOCAL = `
/* Paleta e a carcasei. Aici stau numai variabilele pe care le foloseste doar calendarul:
   negrul titlurilor din lista si rosul palid al butonului AZI. */
:root { --negru:#2B2F38; --rosu-palid:rgba(198,34,52,.06); --rosu-linie:rgba(198,34,52,.45) }
@media (prefers-color-scheme: dark) { :root:not([data-tema="light"]) {
  --negru:#C3C9D3; --rosu-palid:rgba(240,97,111,.09); --rosu-linie:rgba(240,97,111,.45);
} }
:root[data-tema="dark"] {
  --negru:#C3C9D3; --rosu-palid:rgba(240,97,111,.09); --rosu-linie:rgba(240,97,111,.45);
}
.c-rosu { color:var(--rosu) }
.c-albastru { color:var(--albastru) }

/* Ancorele #azi / #zi trebuie sa cada sub antetul lipicios, care la calendar e mai scund decat
   masura carcasei: 130px in loc de 170px. Randul de unelte tine de la 12.09.2026 si sirul lunilor,
   dar randul era acolo si inainte — masura n-a trebuit sa se schimbe. */
html { scroll-padding-top:130px }

.cap { padding:10px 0 4px }
.cap .eyebrow { margin:0 0 14px }
.an-calculat { margin:16px 0 0; padding:10px 14px; border:1px dashed; border-radius:10px;
               opacity:.75; font-size:.86em; line-height:1.5 }

.cod { color:var(--rosu) }
.sursa { color:var(--soft); font-size:14.5px; margin:0 0 16px; max-width:58ch }

/* RANDUL DE UNELTE din antet (refacut 12.09.2026): navigarea, abonarea si listele de sarbatori.
   Navigarea ia spatiul ramas, restul stau cat le tine scrisul — de aceea numai .luni-rand creste. */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui;
             letter-spacing:.06em }
.btns .mic svg { vertical-align:0 }
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }

/* FEREASTRA DE ABONARE, adusa intocmai de la Program (user, 12.09.2026: „la click pe Abonare să
   apară un pop-up la fel") — dialog nativ: fundalul intunecat, focusul si Escape vin de la browser,
   noi scriem doar cum arata. Cutia nu creste peste ecran, ca pe telefon sa nu iasa in afara. */
.modal { border:0; padding:0; border-radius:14px; width:min(420px, calc(100vw - 32px));
         background:var(--paper); color:var(--ink); box-shadow:0 18px 50px rgba(0,0,0,.22) }
.modal::backdrop { background:rgba(10,12,16,.45) }
/* ⚠️ display:block si margin:0 nu sunt de prisos: carcasa are o regula pe TOATE formularele
   (form { display:flex; gap:8px; flex-wrap:wrap; margin:14px 0 }), facuta pentru randurile de
   cautare. Fara ele, titlul, textul si bifele ferestrei se insira ca niste jetoane, fiecare cat
   scrisul lui, iar X-ul ramane lipit de titlu in loc sa stea in coltul din dreapta. */
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
/* scrisul bifelor e NORMAL, nu ingrosat: carcasa face din toate etichetele capete de camp
   (label { font:600 12px … }), potrivite deasupra unei casute, nu langa o bifa */
.bifa { display:flex; align-items:center; gap:10px; margin:0 0 11px;
        font:400 14.5px/1.4 ui-sans-serif,system-ui; color:var(--soft) }
.bifa input { flex:0 0 auto; width:17px; height:17px; accent-color:var(--rosu) }
.modal-jos { display:flex; justify-content:flex-end; margin:20px 0 0 }
/* butonul plin: singurul loc din pagina unde rosul e fundal, nu scris — e fapta ferestrei */
.btn-plin { font:600 13px/1 ui-sans-serif,system-ui; letter-spacing:.06em; padding:13px 22px;
            color:var(--paper); background:var(--rosu); border:1px solid var(--rosu); border-radius:10px;
            cursor:pointer }

/* LISTELE DE SARBATORI, doua butoane in locul meniului „Informații utile" (user, 12.09.2026).
   Deosebirea dintre ele o face CULOAREA CRUCII, ca in calendarul tiparit — cuvantul de langa ea
   cade pe telefon, culoarea nu. Butonul intreg ramane in cerneala obisnuita: rosul aprins e al
   locului in care te afli (clasa .activ), nu al unei simple destinatii.
   ⚠️ Al treilea buton („Sfinții cu evlavie") isi are locul aici, langa ele, cand lista lui exista. */
.btns .sarb { text-decoration:none }
.btns .sarb-rosie svg { color:var(--rosu) }
.btns .sarb-neagra svg { color:var(--negru) }
.btns .sarb:hover { border-color:var(--rosu); color:var(--rosu) }
.btns .sarb.activ { border-color:var(--rosu); color:var(--rosu); font-weight:700;
                    background:var(--rosu-palid); cursor:default }

.inainte-de-titlu { margin:0 0 14px }
.btn.inapoi { display:inline-flex; align-items:center; flex:none; padding:9px 16px }
.titlu-lista { font-size:30px; font-weight:400; letter-spacing:-.02em; line-height:1.2;
               margin:0 0 6px }
.cate { font:12px/1 ui-sans-serif,system-ui; letter-spacing:.08em; text-transform:uppercase;
        color:var(--faint); margin:0 0 10px }
.sarbatori .sursa { margin:0 }

.luni-alege { display:grid; grid-template-columns:repeat(6,1fr); gap:7px; margin:18px 0 6px }
.luni-alege > * { display:block; text-align:center; padding:9px 2px; border-radius:8px;
                  border:1px solid var(--rule); background:var(--paper); color:var(--soft);
                  text-decoration:none; font:600 12px/1 ui-sans-serif,system-ui;
                  letter-spacing:.06em; text-transform:uppercase }
.luni-alege .toate { grid-column:1 / -1; letter-spacing:.1em }
.luni-alege a:hover { color:var(--rosu); border-color:var(--rosu) }
.luni-alege .acum { color:var(--paper); background:var(--rosu); border-color:var(--rosu) }
.luni-alege .gol { opacity:.3 }

/* Pe telefon butoanele isi lasa cuvintele si raman numai iconitele — altfel randul, care tine acum
   si navigarea, s-ar rupe in doua. Numele intreg sta in title si aria-label, deci nu se pierde. */
@media (max-width:600px) {
  .btns { gap:7px }
  .btns .mic { padding-left:11px; padding-right:11px }
  .btns .sarb .cuv, .btns .abon .cuv { display:none }
}

/* „AZI" E O BULINA (user, 12.09.2026: „AZI să fie o bulină ca la Program"): butonul n-are text, are
   un punct desenat din CSS, cat cel din navigarea Programului (9 px). Rosul i-a ramas — el spune ca
   tinta e ziua de azi; masura din laturi e mai mare decat ar cere punctul, ca sa fie la fel de usor
   de nimerit cu degetul ca butoanele lunilor de langa el. Inaltimea e pusa sa cada exact cat a unei
   luni (punct 9 + 12 sus + 12 jos + 2 de chenar = 35 px): daca umbli la .luna-buton, umbla si aici. */
.azi-buton { flex:none; display:flex; align-items:center; justify-content:center;
             color:var(--rosu); background:var(--rosu-palid);
             border:1px solid var(--rosu-linie); border-radius:999px; padding:12px 20px;
             text-decoration:none }
.azi-buton::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.azi-buton:hover { border-color:var(--rosu) }
.luni-rand .azi-buton { margin-right:6px }

/* NAVIGAREA A URCAT IN ANTET (user, 12.09.2026: „mută navigarea sus") — de aceea .luni-rand nu mai
   are margini de sus si de jos si e singura din rand care creste (flex:1 1 auto, min-width:0):
   restul butoanelor stau cat le tine scrisul, iar prisosul il ia fasia lunilor. */
/* ⚠️ MASURA DE PORNIRE E 0 (flex:1 1 0), NU auto — aceeasi capcana ca la pastila Programului:
   randul are flex-wrap, iar wrap-ul se hotaraste dupa masura IPOTETICA a fiecarui buton, inainte de
   orice strangere. Cu auto, fasia pornea de la latimea celor 13 luni (~1000 px), umplea singura
   randul, si abonarea cu sarbatorile cadeau pe al doilea rand. Cu 0, navigarea ia numai ce ramane
   dupa ele si se deruleaza inauntru, cum ii e felul. */
.btns .luni-rand { flex:1 1 0; min-width:0; margin:0 }
.luni-rand { display:flex; align-items:center; gap:0; margin:14px 0 2px }
.sageata { flex:none; border:none; background:none; color:var(--faint);
           cursor:pointer; font:300 22px/1 ui-sans-serif,system-ui; padding:9px 7px;
           border-radius:999px }
.sageata:hover:not([disabled]) { color:var(--rosu) }
.sageata[disabled] { opacity:.2; cursor:default }
.fasie { flex:1 1 auto; min-width:0;
         position:relative; overflow-x:auto; overscroll-behavior-x:contain;
         -webkit-overflow-scrolling:touch; scrollbar-width:none;
         -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);
         mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%) }
.fasie::-webkit-scrollbar { display:none }
.luni { display:flex; gap:7px; width:max-content; padding:0 14px }
.luna-buton { flex:none; color:var(--soft); text-decoration:none; background:var(--paper);
              border:1px solid var(--rule); border-radius:999px; padding:10px 16px;
              font:600 13px/1 ui-sans-serif,system-ui; letter-spacing:.1em;
              text-transform:uppercase }
.luna-buton:hover { color:var(--rosu); border-color:var(--rosu) }
.luna-buton.activa { color:var(--paper); background:var(--rosu); border-color:var(--rosu) }
.luna-buton.an-vecin { color:var(--faint); border-style:dashed }

h2.luna { font:400 13px/1 ui-sans-serif,system-ui; letter-spacing:.2em; text-transform:uppercase;
          color:var(--faint); margin:26px 0 6px; padding-bottom:8px;
          border-bottom:1px solid var(--rule) }

.zi { display:grid; grid-template-columns:46px 1fr; gap:0 12px;
      padding:11px 8px 11px 6px; border-bottom:1px solid var(--rule);
      margin:0 -8px 0 -6px; border-radius:3px }
.zile .zi:last-child { border-bottom:0 }
.zi > .ce::after { content:""; display:block; clear:both }
.zi.duminica { background:var(--tinta) }
.zi.azi { box-shadow:inset 4px 0 0 var(--azi); background:var(--azi-fund) }
.zi.azi .cand .nr { color:var(--azi); font-weight:600 }

.cand { text-align:right; padding-top:1px; line-height:1.2; text-decoration:none; display:block }
.nr { display:block; font-size:20px; color:var(--ink) }
.zi.duminica .nr { color:var(--rosu) }
.zs { display:block; font:11px/1.4 ui-sans-serif,system-ui; color:var(--faint);
      text-transform:uppercase; letter-spacing:.05em }
.cand:hover .nr { color:var(--rosu) }

.ce > p { margin:0 }
.titlu-zi { font-size:16.5px; line-height:1.45 }
.titlu-zi a { color:inherit; text-decoration:none }
.titlu-zi a:hover { text-decoration:underline; text-decoration-color:var(--rule) }
.zi.azi .titlu-zi { font-weight:600 }
.cr { margin-right:5px; font-size:15px }
.cruce-rosie .cr { color:var(--rosu) }
.cruce-albastra .cr { color:var(--albastru) }
.cruce-neagra .cr { color:var(--negru) }

.ce > .titlu-zi ~ p { margin-top:2px }
.sfinti { font-size:15px; color:var(--soft); margin-top:2px }
.sfinti a { color:inherit; text-decoration:none }
.sfinti a:hover { text-decoration:underline; text-decoration-color:var(--rule) }
.subtitlu { font-size:14px; color:var(--soft); margin-top:2px; font-style:italic }
.pericope { font:12.5px/1.5 ui-sans-serif,system-ui; color:var(--faint); margin-top:4px }
.pericope a { color:inherit; text-decoration:none;
              border-bottom:1px dotted var(--rule); padding-bottom:1px }
.pericope a:hover { color:var(--rosu); border-bottom-color:var(--rosu) }
.glas { font-weight:600; color:var(--soft) }
.zi.duminica .titlu-zi { font-size:17.5px }
.zi.duminica .titlu-zi, .pagina-zi.duminica .titlu-mare { color:var(--rosu) }

.semne { margin-top:5px; display:flex; flex-wrap:wrap; gap:5px }
.semn { font:11px/1 ui-sans-serif,system-ui; letter-spacing:.03em; padding:4px 8px;
        border-radius:3px; border:1px solid var(--rule); color:var(--soft); white-space:nowrap }

.randuiala-mesei { float:right; width:118px; margin:2px 0 6px 14px;
                   display:flex; flex-direction:column; align-items:stretch;
                   gap:4px; padding-left:12px; border-left:1px solid var(--rule) }
.randuiala-mesei .semn { white-space:normal; text-align:center; line-height:1.3; padding:5px 6px }
.semn[class*="post-"] { border-style:dashed }
.semn.perioada { color:var(--faint) }
.semn.morti { border-color:var(--albastru); color:var(--albastru) }
.semn.slujba { border-color:var(--soft); color:var(--ink) }
.semn.aliturgica { border-style:dashed; color:var(--faint) }
.semn.libera { border-color:var(--rosu); color:var(--rosu) }

.data-mare { font-size:44px; font-weight:400; letter-spacing:-.02em; margin:0 0 2px }
.titlu-mare { font-size:23px; line-height:1.35; margin:0 0 6px }
.pagina-zi .sfinti { font-size:16px; margin:0 0 6px }
.pagina-zi .pericope { margin:14px 0 0 }
.pagina-zi .subtitlu { font-size:15px; margin:0 0 10px }
.pagina-zi .semne { margin:12px 0 0 }
.randuiala { font:12px ui-sans-serif,system-ui; color:var(--faint); margin:12px 0 0 }
.zs-mare { color:var(--soft); margin:0 0 10px }

.text { margin:38px 0 }
.text h1, .text h2 { font-size:20px; font-weight:400; margin:0 0 10px; line-height:1.3 }
.text h3 { font:600 11px/1 ui-sans-serif,system-ui; letter-spacing:.16em; text-transform:uppercase;
           color:var(--rosu); margin:0 0 14px }
.text p { margin:0 0 14px; text-align:justify; hyphens:auto }
.text blockquote { margin:20px 0; padding-left:18px; border-left:3px solid var(--rule);
                   color:var(--soft); font-style:italic }
.text img { max-width:100%; height:auto; border-radius:3px; margin:8px 0 }
.text .ref { font:12.5px/1.5 ui-sans-serif,system-ui; color:var(--faint); margin:-4px 0 10px }
.text .ref a { color:inherit }
.gol { color:var(--faint) }

.vecini { display:flex; justify-content:space-between; gap:12px; margin-top:44px;
          padding-top:18px; border-top:1px solid var(--rule);
          font:13px ui-sans-serif,system-ui }
.vecini a { text-decoration:none }

/* ————— fereastra cu textele zilei ————— */
body.cu-fereastra { overflow:hidden }
dialog.fereastra { display:flex; flex-direction:column; inset:0; margin:auto;
                   width:min(700px,94vw); max-width:none; max-height:88vh; max-height:88dvh;
                   padding:0; border:none; border-radius:10px;
                   background:var(--paper); color:var(--ink);
                   box-shadow:0 24px 70px rgba(0,0,0,.4) }
dialog.fereastra:not([open]) { display:none }
dialog.fereastra::backdrop { background:rgba(8,10,14,.55) }
.bara-fereastra { flex:none; display:flex; justify-content:flex-end; padding:6px 8px 0 }
.cuprins-fereastra { flex:1 1 auto; overflow-y:auto; padding:10px 34px 40px;
                     overscroll-behavior:contain }
.cuprins-fereastra .text { margin:0 0 30px }
.cuprins-fereastra .text:first-of-type { margin-top:0 }
.cuprins-fereastra .text h1:first-child,
.cuprins-fereastra .text h2:first-child { margin-top:0 }
.fel-fereastra { font:400 30px/1.15 "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
                 color:var(--rosu); margin:0 0 10px }
.cand-fereastra { font:600 11px/1 ui-sans-serif,system-ui; letter-spacing:.16em;
                  text-transform:uppercase; color:var(--faint); margin:0 0 22px;
                  padding-bottom:16px; border-bottom:1px solid var(--rule) }
.titlu-fereastra { font-size:20px; font-weight:400; line-height:1.35; margin:0 0 8px }
.titlu-fereastra a { color:inherit; text-decoration:none;
                     border-bottom:1px dotted var(--rule); padding-bottom:1px }
.titlu-fereastra a:hover { color:var(--rosu); border-bottom-color:var(--rosu) }
.inchide { border:none; background:none; color:var(--faint); cursor:pointer;
           font:300 28px/1 ui-sans-serif,system-ui; padding:8px 14px; border-radius:999px }
.inchide:hover { color:var(--rosu) }

@media (max-width:520px) {
  /* bulina ramane cat o luna si aici: 9 + 12 + 12 + 2 = 35, fata de 12.5 + 20 + 2 = 34.5 */
  .azi-buton { padding:12px 16px }
  .luna-buton { padding:10px 14px; font-size:12.5px }
  .sageata { display:none }
  h1 { font-size:42px }
  .data-mare { font-size:34px }
  .titlu-lista { font-size:25px }
  .titlu-mare { font-size:20px }
  .zi { grid-template-columns:30px 1fr; gap:0 8px; padding:11px 5px; margin:0 -5px }
  .randuiala-mesei { width:80px; margin-left:10px; padding-left:8px }
  .randuiala-mesei .semn { font-size:10px; padding:4px 5px }
  .titlu-zi { font-size:16px }
  .text p { text-align:left }
  .cuprins-fereastra { padding:8px 22px 34px }
  dialog.fereastra { width:96vw; max-height:90vh; max-height:90dvh }
}
`
