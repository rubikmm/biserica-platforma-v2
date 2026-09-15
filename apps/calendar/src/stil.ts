/**
 * Calendar · stilul LOCAL al aplicatiei — adus din V1 neschimbat (cerere user, 10.09.2026:
 * „să respecți mesajele și grafica din V1 — este multă muncă acolo pe care nu vreau s-o refac").
 *
 * Se lipeste DUPA stilul global al carcasei (`@xc/ui`) si il suprascrie.
 *
 * ⚠️⚠️ FARA BACKTICK IN COMENTARIILE DE MAI JOS. Tot ce urmeaza dupa `export const LOCAL = ` e un
 * TEMPLATE LITERAL: un singur accent grav intr-un comentariu de stil inchide sirul, iar `tsc` si
 * `esbuild` scot erori la zeci de randuri distanta de locul vinovat. S-a intamplat de trei ori
 * intr-o singura zi (15.09.2026) — scrie numele proprietatilor CSS simplu, intre ghilimele
 * romanesti daca trebuie scoase in evidenta.
 *
 * ⚠️ La coada lui se lipeste `STIL_ABONARE` din `@xc/abonare`: bucatile NOI ale ferestrei de abonare
 * (randul rosu al validarii, linkul din bifa, cele sase casute ale codului) stau o singura data,
 * langa HTML-ul lor. Restul ferestrei (`.modal`, `.camp`, `.bifa`, `.btn-plin`) e mai jos, neatins.
 */
import { STIL_ABONARE } from '@xc/abonare'
import { STIL_SETARI } from '@xc/setari'

export const LOCAL = `
/* Paleta e a carcasei. Aici stau numai variabilele pe care le foloseste doar calendarul: negrul
   titlurilor din lista, rosul palid al bulinei AZI si movul sfintilor cu evlavie. Movul e ales ca
   sa nu se incurce cu celelalte semne — rosul sarbatorii, albastrul sfintilor romani, verdele zilei
   de azi — si e mai deschis pe tema de noapte, ca sa se citeasca pe fundal intunecat. */
:root { --negru:#2B2F38; --mov:#6B4FA8; --rosu-palid:rgba(198,34,52,.06); --rosu-linie:rgba(198,34,52,.45) }
@media (prefers-color-scheme: dark) { :root:not([data-tema="light"]) {
  --negru:#C3C9D3; --mov:#B9A0E8; --rosu-palid:rgba(240,97,111,.09); --rosu-linie:rgba(240,97,111,.45);
} }
:root[data-tema="dark"] {
  --negru:#C3C9D3; --mov:#B9A0E8; --rosu-palid:rgba(240,97,111,.09); --rosu-linie:rgba(240,97,111,.45);
}
.c-rosu { color:var(--rosu) }
.c-albastru { color:var(--albastru) }

/* Ancorele #azi / #zi trebuie sa cada sub antetul lipicios, care la calendar e mai scund decat
   masura carcasei: 130px in loc de 170px. Randul de unelte tine de la 12.09.2026 si sirul lunilor,
   dar randul era acolo si inainte — masura n-a trebuit sa se schimbe. */
html { scroll-padding-top:130px }
/* ⚠️ Carcasa are scroll-behavior:smooth pe html. La INTRAREA in pagina, saltul liniar al browserului
   la ancora #azi se bate cap in cap cu centrarea noastra si o inghite — ziua ramanea lipita de antet
   pana la a doua apasare (user, 15.09.2026, si pe telefon, si pe desktop). Clasa asta stinge linul
   cat tinem noi carma; JS_NAV o pune si o scoate intr-un cadru. Vezi asazaAzi() in JS_NAV. */
html.fara-lin { scroll-behavior:auto }

.cap { padding:10px 0 4px }
.cap .eyebrow { margin:0 0 14px }
.an-calculat { margin:16px 0 0; padding:10px 14px; border:1px dashed; border-radius:10px;
               opacity:.75; font-size:.86em; line-height:1.5 }

.cod { color:var(--rosu) }
.sursa { color:var(--soft); font-size:14.5px; margin:0 0 16px; max-width:58ch }

/* RANDUL DE UNELTE din antet. ⚠️ TINE INTOTDEAUNA TOATA LATIMEA (user, 15.09.2026: „bara de sus din
   antet, meniul să fie 100% mereu"), si are DOUA bucati, atat: PASTILA, care ia tot ce ramane, si
   ABONAREA, cu masura ei fixa (118 px, din @xc/abonare), lipita de marginea din dreapta.
   ⚠️ Crucea nu mai sta aici: a intrat in pastila, dupa cheia calendarului. Nu mai e nevoie de pana
   elastica de dinainte — pastila insasi umple randul. */
.btns { width:100% }
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

/* FILTRELE SARBATORILOR — O SINGURA CRUCE, LA DREAPTA, CU MENIU SUB EA (user, 15.09.2026).
   ⚠️ Pana azi erau TREI butoane in rand, deosebite doar prin culoarea crucii. Userul le-a strans
   intr-unul ca sa incapa DATA din pastila, mai ales pe telefon. Culorile de mai jos n-au murit: s-au
   mutat pe randurile meniului, langa numele scris. Butonul intreg ramane in cerneala obisnuita;
   rosul aprins (.activ) spune ca lista de sub el e taiata de un filtru. */
.btns .sarb { text-decoration:none }
.btns .sarb-rosie svg { color:var(--rosu) }
.btns .sarb-neagra svg { color:var(--negru) }
/* „Sfinți cu evlavie" (user, 12.09.2026, 13:31: „mai pune un buton cu o cruce. Culoare diferită").
   Movul nu se ciocneste cu niciunul din semnele de pana acum: rosul e al sarbatorii, albastrul al
   sfintilor romani, verdele al zilei de azi. */
.btns .sarb-evlavie svg { color:var(--mov) }
.c-evlavie { color:var(--mov) }
.btns .sarb:hover { border-color:var(--rosu); color:var(--rosu) }
.btns .sarb.activ { border-color:var(--rosu); color:var(--rosu); font-weight:700;
                    background:var(--rosu-palid) }

/* ⚠️ E un <details>, nu un panou deschis din JS: meniul merge si fara JavaScript. De aceea sagetica
   lui trebuie stinsa de mana, si in Firefox (list-style), si in WebKit (::-webkit-details-marker).

   ⚠️⚠️ CARCASA IMBRACA ORICE <details> INTR-O CUTIE — si asta a ingrosat banda (user, 15.09.2026:
   „butonul cu crucea este într-un alt buton, într-o altă zonă. S-a mărit totul pe înălțime").
   In @xc/ui sta, pe eticheta goala:
       details { border:1px solid var(--rule); border-radius:10px; padding:10px 14px; margin:14px 0 }
   Facuta pentru cutiile pliante din corpul paginii, ea a prins si meniul asta: chenar peste chenar
   (butonul parea in alt buton) si 14+14 px de margine care au inaltat randul intreg.
   Se scoate TOATA aici, nu doar chenarul — cum face si carcasa pentru meniul contului (.cont-meniu).
   Daca vreodata mai intra un <details> in randul de unelte, are nevoie de aceleasi sase linii. */
.btns .filtre { border:0; border-radius:0; padding:0; margin:0; background:none;
                position:relative; flex:0 0 46px; display:flex; align-items:stretch }
.btns .filtre > summary { cursor:pointer; list-style:none; margin:0; color:inherit }

/* ⚠️ CRUCEA E UN SEGMENT AL PASTILEI, NU UN BUTON DE SINE STATATOR (user, 15.09.2026: „mută butonul
   cu cruce după calendar"). Marcajul ii lasa clasele .btn .mic, ca sa ramana aceleasi masuri de
   scris si de iconita — dar chenarul, fundalul si rotunjirea LOR se sting aici: pastila le are pe
   ale ei, iar doua chenaruri unul in altul au fost chiar reclamatia de acum o ora. Ce ramane e linia
   din stanga, ca intre celelalte segmente. */
.pastila .sarb-cheie { border:0; border-left:1px solid var(--rule); border-radius:0;
                       background:transparent; display:flex; align-items:center;
                       justify-content:center }
/* ⚠️ LINIA DINTRE SEGMENTE RAMANE NEUTRA, ORICE AR FACE BUTONUL (user, 15.09.2026: „pare o linie
   roșie border left pe cruce"). Pricina: doua reguli de mai sus, scrise pe vremea cand crucea era un
   buton de sine statator cu chenar de jur imprejur —
       .btns .sarb:hover   { border-color:var(--rosu) }
       .btns .sarb.activ   { border-color:var(--rosu) }
   — pun rosul pe TOATE laturile. De cand crucea e segment al pastilei si singura ei latura e linia
   despartitoare din stanga, rosul acela nu mai spunea „butonul e aprins", ci desena o dunga rosie in
   mijlocul pastilei.
   Se atinge NUMAI culoarea chenarului: rotunjirea nu se scrie aici, altfel la trecerea cu mausul
   coltul din dreapta al pastilei s-ar indrepta (regula .pastila > :last-child are specificitate mai
   mica si ar fi acoperita). Rosul ramane unde spune ceva: pe iconita si pe fundalul palid. */
.pastila .sarb-cheie:hover,
.pastila .sarb-cheie.activ,
.pastila .sarb-cheie:focus-visible { border-color:var(--rule) }
.pastila .sarb-cheie:hover { background:var(--paper) }
.pastila .sarb-cheie.activ { background:var(--rosu-palid) }
/* crucea stinsa: se vede ca exista, dar nu se apasa (.gol din carcasa da opacitatea si pointer-events) */
.pastila .sarb-cheie.gol:hover { background:transparent }
.btns .filtre[open] > summary { margin-bottom:0 }
.btns .filtre > summary::-webkit-details-marker { display:none }
.btns .filtre > summary::marker { content:"" }
/* meniul atarna SUB buton si e agatat de dreapta lui: la capatul randului, aliniat la stanga ar iesi
   din ecran pe telefon. position:absolute cere stramosul asezat de mai sus (.filtre). */
.filtre-meniu { position:absolute; top:calc(100% + 7px); right:0; z-index:40;
                min-width:244px; padding:5px; text-align:left;
                background:var(--paper); border:1px solid var(--rule); border-radius:12px;
                box-shadow:0 16px 38px rgba(0,0,0,.17) }
.filtre-meniu .f-rand { display:flex; align-items:flex-start; gap:10px; padding:9px 10px;
                        border-radius:9px; color:var(--ink); text-decoration:none; font-style:normal;
                        font:400 14.5px/1.3 ui-sans-serif,system-ui }
.filtre-meniu .f-rand svg { flex:0 0 auto; margin-top:1px }
.filtre-meniu .f-rand b { display:block; font-weight:400 }
.filtre-meniu .f-rand small { display:block; margin-top:2px; color:var(--faint);
                              font-size:11.5px; line-height:1.35 }
.filtre-meniu a.f-rand:hover { background:var(--tinta) }
.filtre-meniu .f-rand.activ { color:var(--rosu); background:var(--rosu-palid) }
.filtre-meniu .f-rand.activ small { color:var(--rosu); opacity:.8 }
/* randul fara drept: se vede ca exista, dar nu duce nicaieri — pricina sta scrisa sub nume */
.filtre-meniu .f-rand.gol { color:var(--faint); cursor:default }
.filtre-meniu .f-rand.gol svg { opacity:.45 }
/* culoarea crucii, sfant cu sfant, ca in calendarul tiparit */
.filtre-meniu .f-rosie svg { color:var(--rosu) }
.filtre-meniu .f-neagra svg { color:var(--negru) }
.filtre-meniu .f-evlavie svg { color:var(--mov) }
.filtre-meniu .f-rand.gol.f-rosie svg, .filtre-meniu .f-rand.gol.f-neagra svg { color:var(--faint) }

.inainte-de-titlu { margin:0 0 14px }
.btn.inapoi { display:inline-flex; align-items:center; flex:none; padding:9px 16px }
.titlu-lista { font-size:30px; font-weight:400; letter-spacing:-.02em; line-height:1.2;
               margin:0 0 6px }
.cate { font:12px/1 ui-sans-serif,system-ui; letter-spacing:.08em; text-transform:uppercase;
        color:var(--faint); margin:0 0 10px }
.sarbatori .sursa { margin:0 }

/* „TOATE LUNILE" — singurul buton ramas din grila de douasprezece luni a paginii de sarbatori (user,
   12.09.2026: lunile se aleg din pastila de sus, aici a mai ramas doar deselectarea lunii). Se scrie
   numai cand un filtru de cruce e pus. Apasat (esti pe tot anul), e rosu si nu mai duce nicaieri. */
.rand-filtru { margin:18px 0 2px }
.toate-lunile { display:inline-block; flex:none; padding:9px 16px; border-radius:999px;
                border:1px solid var(--rule); background:var(--paper); color:var(--soft);
                text-decoration:none; font:600 12px/1 ui-sans-serif,system-ui;
                letter-spacing:.1em; text-transform:uppercase }
.toate-lunile:hover { color:var(--rosu); border-color:var(--rosu) }
.toate-lunile.activ { color:var(--paper); background:var(--rosu); border-color:var(--rosu);
                      font-weight:700 }
/* felul crucii, scris langa numele lunii, ca sa se stie din titlu ce lista se vede */
/* Felul crucii, scris langa numele lunii, in CULOAREA LUI (user, 12.09.2026, 13:28). Rosul e --rosu,
   care pe tema de noapte se face mai deschis, dar ramane rosu; negrul e cerneala paginii, deci se
   intoarce singur in alb pe intuneric — chiar ce s-a cerut („să fie cu negru, iar pe tema dark să fie
   scris cu alb"). */
h2.luna .fel-filtru.f-rosie { color:var(--rosu) }
h2.luna .fel-filtru.f-neagra { color:var(--ink) }
h2.luna .fel-filtru.f-evlavie { color:var(--mov) }

/* PE TELEFON, DATA NU CADE NICIODATA (user, 15.09.2026: „pe mobil, neapărat să se vadă scrisul de
   după azi, scrisul cu data, cu ziua curentă sau cu luna selectată").
   ⚠️ Ce cade sunt CUVINTELE BUTOANELOR, nu data: „Abonare" ramane numai plic, iar numele intreg sta
   in title si aria-label, deci nu se pierde. Cu o singura cruce in loc de trei, randul cere acum
   ~262 px din 335 la un telefon de 390 — deci data incape scrisa intreaga.
   ⚠️ Daca vreodata mai intra un buton in rand, masoara INAINTE: data e prima care s-ar strange. */
@media (max-width:600px) {
  .btns { gap:7px }
  .btns .mic { padding-left:11px; padding-right:11px }
  .pastila .acum { padding:11px 10px; font-size:13px }
  /* ⚠️ Stramtarea segmentelor la 42 px NU se scrie aici, ci sub regula lor de 46 px (cauta
     „SEGMENTELE PASTILEI PE TELEFON"): scrisa in locul asta are aceeasi specificitate ca aceea, dar
     vine INAINTEA ei in fisier, deci pierde. Statea moarta de cand a fost scrisa — masurat
     15.09.2026: pe un ecran de 390 px segmentele ieseau tot de 46. */
  /* meniul nu e mai lat decat ecranul, oricat de ingust ar fi telefonul */
  .filtre-meniu { min-width:0; width:max-content; max-width:calc(100vw - 32px) }
}
/* ⚠️ FORMA SCURTA A DATEI S-A MUTAT MAI JOS, sub regula ei de baza (cauta „DATA PE ECRANE MICI").
   Scrisa aici era moarta, din aceeasi pricina ca stramtarea segmentelor. */

/* PASTILA NAVIGARII (user, 12.09.2026: „să fie o pastilă ca la Program și lunile să fie text în
   capsulă"). Un singur corp: chenarul si rotunjirea stau pe PASTILA, nu pe segmente; inauntru,
   bulina lui „azi" si lunile, despartite doar de o linie de 1 px. Aceeasi retea de reguli ca la
   pastila Programului, ca cele doua aplicatii sa se recunoasca.

   ⚠️ TOTUL STA PE O SINGURA LINIE (user, 12.09.2026: „butoanele au coborât jos - să fie totul pe o
   linie"). Incercasem pastila pe un rand al ei, ca sa incapa tot anul la vedere; utilizatorul a
   cerut inapoi randul unic, deci pastila ia numai ce ramane dupa abonare si sarbatori (~245 px, vreo
   patru luni) si se DERULEAZA pentru rest — JS-ul aduce luna deschisa la mijloc si scrie sagetile.
   ⚠️ MASURA DE PORNIRE E 0 (flex:1 1 0), NU auto: randul are flex-wrap, iar ruperea lui se hotaraste
   dupa masura IPOTETICA a fiecarui copil, inainte de orice strangere. Cu auto, pastila porneste de la
   latimea celor treisprezece luni, umple singura randul, si tocmai butoanele coboara — chiar asta
   s-a si intamplat o data. */
/* ⚠️ DIN 15.09.2026 PASTILA NU MAI TINE LUNILE (user: „bara scrolată cu lunile care apare după
   butonul de AZI din meniul principal aș vrea să se mute într-o bară secundară, inițial ascunsă sub
   zona de antet. În locul ei, să se scrie mai întâi data curentă… iar după ea să fie un buton - ico
   calendar"). In pastila au ramas trei segmente: bulina lui „azi", SCRISUL locului (data de azi, ori
   luna deschisa) si cheia care coboara sirul lunilor. Sirul s-a mutat in .bara-luni, de sub rand.
   ⚠️ De aceea masura de pornire nu mai e „1 1 0" (pastila nu mai are ce derula si n-are de ce sa
   inghita randul), ci „0 1 auto": ia cat ii trebuie si lasa restul butoanelor.
   ⚠️ FARA BACKTICK in comentariile de aici: fisierul intreg e un template literal. */
/* ⚠️ PASTILA IA TOT CE RAMANE DIN RAND, iar inauntru cele TREI butoane au masura FIXA si numai DATA
   creste (user, 15.09.2026: „toată pastila asta fă-o sută la sută cu butoanele de dimensiuni fixe,
   adică butonul de azi, butonul de calendar și butonul cu crucea. Dar zona cu data curentă, luna și
   anul să fie maximă, sută la sută cât tot spațiul").
   Cinci segmente, in ordinea ceruta: bulina · DATA · calendarul · LUPA · crucea.
   ⚠️ FARA overflow:hidden. Il avea cat timp pastila tinea sirul derulant al lunilor; acum, cu meniul
   crucii atarnat de ultimul segment, overflow:hidden l-ar TAIA si meniul n-ar mai aparea deloc.
   Rotunjirea colturilor o duc segmentele de la capete, fiecare al lui.
   ⚠️ MASURA DE PORNIRE E 0 (flex:1 1 0), NU auto — regula veche a randului, reinvatata pe 15.09.2026
   cu lupa: randul are flex-wrap, iar ruperea lui se hotaraste dupa marimea IPOTETICA a copiilor,
   inainte de orice strangere. Cu „auto", marimea ipotetica a pastilei e cat data scrisa intreaga plus
   cele patru butoane; pe ecranele de 400–460 px asta trecea de rand si COBORA abonarea pe al doilea
   rand (masurat: btns h=85 in loc de 41). Cu 0, pastila nu forteaza niciodata ruperea si tot ia ce
   ramane, fiindca are grow 1. ⚠️ Banda era stricata si INAINTE de lupa (401–430); nu o repara inapoi. */
.btns .pastila { display:flex; flex:1 1 0; min-width:0; align-items:stretch;
                 border:1px solid var(--rule); border-radius:10px; background:var(--tinta) }
/* cele PATRU butoane: aceeasi masura fixa, ca pastila sa arate la fel pe orice pagina */
.pastila .azi-buton, .pastila .luni-cheie, .pastila .cauta-cheie, .pastila .sarb-cheie {
                 flex:0 0 46px; width:46px; padding-left:0; padding-right:0 }
/* SEGMENTELE PASTILEI PE TELEFON — patru butoane a 46 px ar lua 184 px din cele ~335 ale unui telefon
   de 390, si atunci data n-ar mai avea unde incapea. Cele 4 px luate fiecaruia se duc toti in ea.
   ⚠️ STA AICI, NU IN BLOCUL @media DE MAI SUS: acolo are aceeasi specificitate ca regula de 46 px,
   dar vine inaintea ei in fisier si pierde — asa a stat moarta pana la masuratoarea din 15.09.2026. */
@media (max-width:600px) {
  .pastila .azi-buton, .pastila .luni-cheie, .pastila .cauta-cheie, .pastila .sarb-cheie {
                 flex:0 0 42px; width:42px }
  /* ⚠️ Crucea are DOUA masuri de strans: latimea o tine invelisul <details>, nu butonul dinauntru.
     Fara randul asta, crucea ramanea de 46 px cand celelalte se strangeau la 42 (masurat 15.09.2026). */
  .btns .filtre { flex:0 0 42px }
}
/* SUB 400 PX — telefoanele mici (360 Galaxy, 375 iPhone). Aici cele patru chei ale pastilei si
   abonarea nu mai lasa datei nici cat scrisul ei scurt: masurat 15.09.2026, „15 sep. 2026" cere 91 px
   si primea 88 la un telefon de 390 — se taia tocmai lucrul care nu are voie sa cada. Se ia din toate
   celelalte, cate putin: cheile 36 px, spatiile dintre butoane 6, marginile plicului 9, scrisul datei
   12. Asa data incape intreaga de la 360 px in sus.
   ⚠️ Mai jos de 360 px se taie iar — si atunci se taie ea, nu se rupe randul. */
@media (max-width:400px) {
  .btns { gap:6px }
  .btns .mic { padding-left:9px; padding-right:9px }
  .pastila .azi-buton, .pastila .luni-cheie, .pastila .cauta-cheie, .pastila .sarb-cheie {
                 flex:0 0 36px; width:36px }
  .btns .filtre { flex:0 0 36px }
}
.pastila > :first-child { border-radius:9px 0 0 9px }
.pastila > :last-child, .pastila > .filtre:last-child > summary { border-radius:0 9px 9px 0 }
/* Scrisul locului. ⚠️ NU e scris cu majuscule si nici raschirat, ca lunile din sir: „15 SEPTEMBRIE
   2026" ar fi cerut vreo 150 px si ar fi rupt randul unic pe telefon. Pe ecrane mici trece de la
   sine pe forma scurta („15 sep. 2026"), scrisa alaturi si ascunsa pana atunci. */
/* ⚠️ SCRISUL E ROSU INTOTDEAUNA (user, 15.09.2026: „să fie cu roșu textul: luna, anul… când sunt pe
   butonul roșu pe AZI, să fie și textul cu data roșie"). Deci rosul de aici NU spune „esti pe luna
   de azi" — aia o spune bulina de langa el, care se aprinde numai pe luna curenta. Rosul scrisului
   spune „aici esti", si atat; el e lucrul dupa care se uita omul intai. Nu-l lega de peLunaAzi. */
/* ⚠️ NU E UN BUTON, E O ZONA DE SEMNALIZARE (user, 15.09.2026: „zona cu textul «15 septembrie 2026»…
   să aibă un fundal alb sau negru, în funcție de ce temă este, astfel încât să nu se confunde cu
   butoanele. Aici este mai mult o zonă de semnalizare"). De aceea fundalul ei e --paper (hartia
   paginii: alb ziua, aproape negru noaptea), nu --tinta, care e umplutura butoanelor si a pastilei.
   Se vede ca o fereastra taiata in pastila — si tocmai asta o deosebeste de bulina si de cheie.
   Nu-i pune :hover si nu-i da cursor:pointer: nu se apasa. */
.pastila .acum { display:flex; align-items:center; justify-content:center;
                 flex:1 1 auto; min-width:0; padding:11px 13px;
                 white-space:nowrap; overflow:hidden;
                 border-left:1px solid var(--rule); border-right:1px solid var(--rule);
                 background:var(--paper);
                 font:600 14px/1 ui-sans-serif,system-ui; color:var(--rosu) }
.pastila .acum .scurt { display:none }
/* DATA PE ECRANE MICI — „15 septembrie 2026" trece pe „15 sep. 2026".
   ⚠️ SCURTATA, NU ASCUNSA: ziua si luna raman scrise, cum s-a cerut anume (15.09.2026, „pe mobil,
   neapărat să se vadă scrisul cu data").
   ⚠️⚠️ BLOCUL ASTA STATEA MAI SUS IN FISIER, INAINTEA REGULII DE DEASUPRA, si de aceea nu facea ce
   scria: are aceeasi specificitate, deci pierdea, iar forma scurta ramanea stinsa in timp ce cea
   lunga era stinsa de el. Pe un telefon de 390 px zona datei era GOALA — se vede in poza facuta pe
   15.09.2026, inainte de mutare. A doua regula moarta din acelasi motiv, in acelasi fisier (cealalta:
   stramtarea segmentelor la 42 px). La orice @media scris in capul fisierului, verifica daca regula
   pe care o rastoarna nu vine cumva mai jos.
   ⚠️ PRAGUL E 460, nu 400: intre 401 si 460 px data lunga nu incape langa cele patru butoane si era
   taiata de overflow:hidden (masurat la 410: text de 176 px intr-o cutie de 169). Telefoanele din
   banda nu sunt rare — 412 (Pixel), 414 (iPhone Plus), 430 (iPhone Pro Max). */
@media (max-width:460px) {
  .pastila .acum { padding:11px 8px; font-size:12.5px }
  .pastila .acum .lung { display:none }
  .pastila .acum .scurt { display:inline }
}
@media (max-width:400px) {
  .pastila .acum { padding:11px 6px; font-size:12px }
}
/* Cheile care coboara barele de sub rand — lunile si lupa cautarii. Cat timp bara lor e coborata, stau
   aprinse, ca omul sa stie de unde a iesit ce vede sub antet. Aceleasi masuri pentru amandoua: sunt
   acelasi fel de buton, si ar fi batut la ochi daca una era mai lata. */
.pastila .luni-cheie, .pastila .cauta-cheie {
                       flex:none; display:flex; align-items:center; justify-content:center;
                       padding:11px 12px; border:0; border-left:1px solid var(--rule);
                       border-radius:0; background:transparent; color:var(--soft); cursor:pointer }
.pastila .luni-cheie:hover, .pastila .cauta-cheie:hover { color:var(--rosu); background:var(--paper) }
.pastila .luni-cheie[aria-expanded="true"], .pastila .cauta-cheie[aria-expanded="true"] {
                       color:var(--rosu);
                       background:color-mix(in srgb, var(--rosu) 11%, transparent) }

/* BARA A DOUA — sirul lunilor, sub randul de unelte, ascunsa pana se apasa cheia. Are chenarul si
   rotunjirea pastilei de dinainte, ca sa se recunoasca: e acelasi lucru, mutat cu un rand mai jos.
   ⚠️ Se inchide singura la alegerea unei luni, fiindca alegerea e o NAVIGARE: pagina urmatoare se
   scrie cu bara ascunsa (user: „la selecție bara cu lunile dispare"). */
.bara-luni { display:flex; align-items:stretch; margin:0 0 6px;
             border:1px solid var(--rule); border-radius:10px; background:var(--tinta);
             overflow:hidden }
.bara-luni[hidden] { display:none }
/* ⚠️ position:relative NU e de podoaba: JS-ul aduce luna deschisa la mijloc cu offsetLeft, iar acela
   se masoara fata de cel mai apropiat stramos asezat. Fara el, offsetParent ajunge sa fie pagina,
   numarul iese cu vreo doua sute de pixeli mai mare si fasia se deschide derulata la capat — se vedea
   „NOI DEC IAN 2027" in loc de luna curenta. */
.bara-luni .fasie { flex:1 1 auto; min-width:0; position:relative;
                  overflow-x:auto; overscroll-behavior-x:contain;
                  -webkit-overflow-scrolling:touch; scrollbar-width:none }
.bara-luni .fasie::-webkit-scrollbar { display:none }
.bara-luni .luni { display:flex; align-items:stretch; gap:0; width:max-content; padding:0 }

/* BARA CAUTARII — sora barei lunilor, cu acelasi chenar si aceeasi rotunjire: sunt doua bare care ies
   din aceeasi pastila, deci trebuie sa se poarte la fel. Nu se vad niciodata amandoua deodata (JS-ul
   o ridica pe cealalta), asa ca randul de sub antet ramane de o singura inaltime.
   ⚠️ appearance:none e pentru iOS, care altfel deseneaza campul de cautare cu chenarul si rotunjirea
   lui, inauntrul chenarului nostru — chiar „buton in buton", reclamatia veche a userului. */
.bara-cautare { display:flex; align-items:stretch; margin:0 0 6px;
                border:1px solid var(--rule); border-radius:10px; background:var(--tinta);
                overflow:hidden }
.bara-cautare[hidden] { display:none }
.bara-cautare .cauta { display:flex; align-items:stretch; flex:1 1 auto; min-width:0; margin:0 }
.cauta-camp { flex:1 1 auto; min-width:0; appearance:none; -webkit-appearance:none;
              border:0; border-radius:0; background:transparent; color:var(--ink);
              padding:11px 14px; outline:none;
              font:400 14px/1.2 ui-sans-serif,system-ui }
.cauta-camp::placeholder { color:var(--faint) }
.cauta-camp::-webkit-search-cancel-button { -webkit-appearance:none }
/* butonul de trimis: un segment la capat, ca sagetile lunilor. Lupa lui e aceeasi cu a cheii de sus,
   ca sa se vada ca bara asta e a ei. */
.cauta-du { flex:0 0 46px; display:flex; align-items:center; justify-content:center;
            border:0; border-left:1px solid var(--rule); border-radius:0;
            background:transparent; color:var(--soft); cursor:pointer }
.cauta-du:hover { color:var(--rosu); background:var(--paper) }

/* LUNILE: text simplu in capsula — fara chenar, fara fundal, fara rotunjire a lor. Despartitura e o
   linie de 1 px, ca intre segmentele Programului. */
/* ⚠️ SEGMENTELE SUNT STRANSE CAT SE POATE, ca in latimea putina a pastilei sa intre cat mai multe
   luni: spatiul dintre litere .03em (era .1em), cel din laturi 8 px (era 14), scrisul 12,5 px (era
   13). Asa lunile cer 636 px cu totul — exact cat le-ar trebui ca sa incapa TOATE, daca pastila ar
   avea randul ei; pe randul comun, cu abonarea si sarbatorile langa, se vad vreo patru si restul vin
   din derulare. Daca umfli vreo masura, se vad si mai putine. Masoara cu scrollWidth vs clientWidth
   pe .fasie, nu cu ochiul. */
.luna-buton { flex:none; display:flex; align-items:center; justify-content:center;
              color:var(--soft); text-decoration:none; background:transparent;
              border:0; border-radius:0; padding:11px 8px;
              font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.03em;
              text-transform:uppercase; white-space:nowrap }
.luna-buton + .luna-buton { border-left:1px solid var(--rule) }
.luna-buton:hover { color:var(--rosu); background:var(--paper) }
/* luna deschisa: rosie si plina, ca segmentul pe care esti din pastila Programului (nu rosu tare cu
   scris alb, cum era cand fiecare luna era o pastiluta a ei) */
.luna-buton.activa { color:var(--rosu); font-weight:700;
                     background:color-mix(in srgb, var(--rosu) 11%, transparent) }

/* „AZI" E O BULINA (user, 12.09.2026: „AZI să fie o bulină ca la Program"): butonul n-are text, are
   un punct desenat din CSS, cat cel din navigarea Programului (9 px). Masura din laturi e mai mare
   decat ar cere punctul, ca sa fie la fel de usor de nimerit cu degetul ca lunile de langa el. De cand
   sta in pastila, chenarul si rotunjirea lui au cazut: le are pastila.

   ⚠️ ROSUL E AL LOCULUI, NU AL BUTONULUI (user, 12.09.2026, 13:56: „butonul azi să nu mai fie roșu tot
   timpul - doar când ești pe luna curentă"). Pana atunci bulina statea rosie pe orice pagina, si atunci
   rosul nu mai spunea nimic: parea un buton aprins mereu, nu semnul locului in care esti. Acum bulina
   sta in cerneala celorlalte segmente si se face rosie numai pe luna de azi — la fel ca luna deschisa
   din sirul de langa ea. La atingere se rumeneste, ca orice segment.

   ⚠️ FUNDALUL E EFEMER: se aprinde doar cat tine apasarea (:active) si cat tine focusul de la
   tastatura, apoi se stinge („fundalul să se facă selectat doar când apăs pe el dar apoi să dispară /
   să fie ceva efemer"). Pe luna de azi, unde butonul nu duce nicaieri ci doar deruleaza la ziua
   curenta, asta e singurul semn ca apasarea a fost primita. */
.azi-buton { flex:none; display:flex; align-items:center; justify-content:center;
             color:var(--soft); background:transparent;
             border:0; border-radius:0; padding:11px 16px; text-decoration:none }
.azi-buton::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.azi-buton:hover { color:var(--rosu); background:var(--paper) }
.azi-buton.activ { color:var(--rosu) }
.azi-buton:active, .azi-buton:focus-visible { background:color-mix(in srgb, var(--rosu) 14%, transparent) }

/* Sagetile — segmentele de la capetele pastilei, pentru cine n-are deget. JS-ul le ascunde cu totul
   cand lunile incap (pe desktop incap), ca sa nu stea doua segmente moarte in pastila. */
/* stranse la os: pe randul unic, fiecare pixel luat de ele e o bucata de luna care nu se mai vede */
.sageata { flex:none; border:0; background:transparent; color:var(--faint); cursor:pointer;
           font:300 19px/1 ui-sans-serif,system-ui; padding:0 6px; border-radius:0 }
.azi-buton + .sageata, .sageata + .fasie, .fasie + .sageata { border-left:1px solid var(--rule) }
.sageata:hover:not([disabled]) { color:var(--rosu); background:var(--paper) }
.sageata[disabled] { opacity:.25; cursor:default }
.sageata[hidden] { display:none }

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
/* ⚠️ Si ziua cu CRUCE ROSIE isi scrie data cu rosu, nu doar duminica (user, 12.09.2026, 13:04:
   „sărbătorile cu Crucea Roșie nu sunt notate cu roșu, cum sunt duminicile"). Asa e si in calendarul
   tiparit: ziua cu tinere se scrie rosu cu totul. Fundalul palid ramane insa numai al duminicii — el
   spune „e duminica", nu „e sarbatoare". */
.zi.duminica .nr, .zi.cruce-rosie .nr { color:var(--rosu) }
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
/* anii privegherilor, sub numele zilei, numai in lista sfintilor cu evlavie (user, 12.09.2026, 14:20).
   Cuvantul „Privegheri:" poarta movul filtrului, anii raman in cerneala obisnuita — ei sunt faptul. */
.privegheri { font:13.5px/1.5 ui-sans-serif,system-ui; color:var(--soft); margin-top:3px }
.privegheri b { color:var(--mov); font-weight:600 }
.pericope { font:12.5px/1.5 ui-sans-serif,system-ui; color:var(--faint); margin-top:4px }
.pericope a { color:inherit; text-decoration:none;
              border-bottom:1px dotted var(--rule); padding-bottom:1px }
.pericope a:hover { color:var(--rosu); border-bottom-color:var(--rosu) }
.glas { font-weight:600; color:var(--soft) }
.zi.duminica .titlu-zi { font-size:17.5px }
.zi.duminica .titlu-zi, .pagina-zi.duminica .titlu-mare { color:var(--rosu) }
/* ⚠️ In lista crucilor NEGRE, duminica nu se mai scrie rosu: acolo capul zilei sunt sfintii cu cruce
   neagra, iar rosul ar spune „sarbatoare cu ținere" — taman ce lista aceasta nu cuprinde. Numarul
   zilei ramane rosu: acolo rosul spune doar „e duminica". */
.zi.fara-rosu.duminica .titlu-zi { color:var(--ink) }
.zi.fara-rosu .nr { color:var(--ink) }

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

/* ————— fereastra cu textele zilei —————
   ⚠️ Oprirea derularii din spate nu se scrie aici: o face carcasa (@xc/ui), la orice fereastra. */
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
  /* pastila se strange, ca sa incapa mai multe luni in ea; derularea o face degetul, deci sagetile
     ies cu totul (user, 12.09.2026: „pe mobil tot așa să se poate muta stânga dreapta") */
  .azi-buton { padding:11px 15px }
  .luna-buton { padding:11px 11px; font-size:12.5px }
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
` + STIL_ABONARE + STIL_SETARI
