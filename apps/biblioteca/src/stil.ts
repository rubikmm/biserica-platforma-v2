import { STIL_SETARI } from "@xc/setari"
/**
 * A12-biblioteca · stilul LOCAL al aplicatiei.
 *
 * Se lipeste DUPA stilul global al carcasei (src/comun/stil-comun.ts) si il
 * suprascrie. Nu edita src/comun/*: alea vin din biserica-platforma/carcasa/.
 * O regula de aici care se dovedeste buna peste tot se MUTA in stilul global.
 */
export const LOCAL = `
/* Literele de la /autori si /edituri (nav.capitole cu a / b.acum) NU au stil aici:
   patratelele sunt cod comun, in carcasa (stil-comun.ts), mutate acolo din A10 Biblia la
   cererea userului (7 sept. 2026: „ca la Biblia — capitolele", „un stil care sa se puna
   comun"). Nu le readuce local. */
/* fisa unei carti (A12): perechi eticheta-valoare, nu tabel de un rand.
   align-items:baseline NU e de infrumusetare: eticheta e de 10.5px si valoarea de 16px,
   amandoua cu line-height 1.9, deci cutiile de rand ies de inaltimi diferite si eticheta
   statea cu vreo doi pixeli mai sus decat valoarea ei, pe fiecare rand (semnalat de user,
   7 sept. 2026). Aliniate pe linia de scris, cad la fel. */
.fisa { margin:18px 0; display:grid; grid-template-columns:max-content 1fr; gap:2px 18px;
        align-items:baseline }
.fisa dt { font:600 10.5px/1.9 ui-sans-serif,system-ui; letter-spacing:.1em;
           text-transform:uppercase; color:var(--faint) }
.fisa dd { margin:0; line-height:1.9 }
/* --- fisa completata cu ce arata librariile online (A12, 31 aug 2026) --- */
/* coperta la stanga si perechile la dreapta pe ecran lat; una sub alta pe telefon */
.carte { display:grid; grid-template-columns:1fr; gap:0 26px; align-items:start }
.carte .fisa { margin-top:8px }
@media (min-width:620px) { .carte { grid-template-columns:auto 1fr } }
.coperta { margin:18px 0 0; max-width:190px }
.coperta img { display:block; width:100%; height:auto; border:1px solid var(--rule) }
/* Cartea fara coperta isi tine totusi locul (cerere user, 7 sept. 2026): altfel fisele
   cu si fara coperta arata a doua aplicatii diferite, iar rubricile sar de la o carte la
   alta. Proportia e a coperților aduse (13x20 cm, cam 0,65), cu cotorul ingrosat la stanga
   ca sa se citeasca drept carte, nu drept poza care n-a apucat sa se incarce. */
.coperta.fara { display:grid; place-items:center; width:190px; max-width:100%;
                aspect-ratio:13/20; box-sizing:border-box; background:var(--tinta);
                border:1px solid var(--rule); border-left-width:3px }
.coperta.fara span { font:10.5px/1.6 ui-sans-serif,system-ui; letter-spacing:.1em;
                     text-transform:uppercase; color:var(--faint) }
/* LUPA COPERTEI (cerere user, 8 sept. 2026: „as vrea sa pot vedea coperta mare —
   cateodata nu pot nici sa citesc ce scrie"). Pe fisa coperta are 190 px, iar aplicatia
   are pinch-zoom oprit dinadins („aplicatie, nu site", 31 aug) — deci degetele nu pot
   mari. Atunci mareste coperta singura: se deschide peste toata pagina, si la fiecare
   atingere trece prin trei trepte (cat incape pe ecran, marimea ei intreaga, de doua ori
   atat), cadrul plimbandu-se cu degetul. Poza e originalul din coperti-mari/ (R2), tot ce
   avem — librariile nu dau mai mult. */
.coperta a.mareste { display:block; position:relative; cursor:zoom-in }
/* Semnul de marire pe coperta (cerere user, 8 sept. 2026, noaptea: „sa fie iconita de zoom
   pe imagine cand intru pe o carte"): randul de sub coperta nu se baga in seama; o lupa in
   coltul copertei, da. Fund de hartie sub ea, ca sa se vada pe orice coperta. */
.coperta a.mareste .zoom { position:absolute; right:8px; bottom:8px; display:grid;
                           place-items:center; width:34px; height:34px; border-radius:50%;
                           background:var(--paper); color:var(--ink);
                           border:1px solid var(--rule); box-shadow:0 1px 4px rgba(0,0,0,.25) }
.coperta a.mareste .zoom svg { display:block }
.coperta-mare { position:fixed; inset:0; z-index:60; background:var(--paper) }
/* „safe center" NU e o infrumusetare: cand poza marita e mai lata decat cadrul, centrarea
   obisnuita ii taie marginea din stanga, si nu se mai poate ajunge la ea cu degetul.
   Tot asa, flex:none — altfel cadrul ar strange poza inapoi la cat incape. */
.coperta-mare .cadru { position:absolute; inset:0; display:flex;
                       align-items:safe center; justify-content:safe center;
                       overflow:auto; padding:18px; box-sizing:border-box }
.coperta-mare img { flex:none; max-width:100%; max-height:100%; cursor:zoom-in;
                    border:1px solid var(--rule) }
/* marita, poza nu mai incape: cadrul se plimba pe amandoua laturile */
.coperta-mare.marit img { max-width:none; max-height:none; cursor:zoom-out }
.coperta-mare .inchide { position:absolute; top:10px; right:12px; z-index:1;
                         padding:4px 12px; font-size:22px; line-height:1.2;
                         border-radius:10px }
.coperta-mare .ajutor { position:absolute; left:0; right:0; bottom:10px; margin:0;
                        text-align:center; font:10.5px/1.5 ui-sans-serif,system-ui;
                        letter-spacing:.08em; text-transform:uppercase; color:var(--faint) }
/* Coperta mica la inceputul fiecarui rand, in toate listele de carti (cerere user,
   7 sept. 2026). Aceeasi proportie 13x20 ca pe fisa, pe 52 px latime (dublata la cererea
   userului, in aceeasi zi); poza se taie la margine (object-fit:cover), nu se turteste,
   ca randurile sa fie toate la fel de inalte. Cartea fara coperta primeste chenarul de pe
   fisa, micsorat — cu cotorul ingrosat, fara text (n-ar incapea). */
.cm { display:block; flex:none; width:52px; aspect-ratio:13/20; box-sizing:border-box;
      border:1px solid var(--rule); background:var(--tinta); overflow:hidden }
.cm img { display:block; width:100%; height:100%; object-fit:cover }
.cm.fara { border-left-width:3px }
/* Lista de carti (cautare, autor, editura, vecinatati): trei coloane — coperta, titlul cu
   autorul dedesubt, si pe 30% din latime editura cu anul si exemplarele (cerere user,
   7 sept. 2026). Randul are ~96 px, cat coperta plus aerul ei. */
ul.carti { list-style:none; padding:0; margin:12px 0 }
ul.carti li { display:grid; grid-template-columns:52px 1fr 30%; gap:0 14px; align-items:start;
              padding:8px 0; margin:0; font-size:15.5px; border-bottom:1px solid var(--rule) }
ul.carti li:last-child { border-bottom:0 }
ul.carti li > div { min-width:0 }
ul.carti .sub { color:var(--soft); font-size:14px; line-height:1.5; margin-top:2px }
/* „Incarca mai multe" (cerere user, 8 sept. 2026): orice lista mai lunga de 10 titluri se
   deschide cu primele 10, iar restul asteapta ascunse in pagina. Linia de deasupra cutiei
   e chiar marginea de jos a ultimului rand ramas la vedere — de aceea cutia are linie
   numai jos: doua linii la 14 px una de alta ar fi aratat a greseala, nu a chenar.
   Loturile sunt patratele de atins cu degetul, ca literele de la /autori. */
ul.carti li.peste { display:none }
.mai-multe { border-bottom:1px solid var(--rule); padding:12px 0 14px; margin:0 0 16px;
             text-align:center }
.mai-multe .inca { background:none; border:0; padding:2px 8px; cursor:pointer;
                   font:16px ui-sans-serif,system-ui; color:var(--rosu) }
.mai-multe .inca small { color:var(--faint); font-size:14px }
.mai-multe .cate { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:10px }
.mai-multe .cate button { min-width:46px; padding:8px 10px; border:1px solid var(--rule);
  border-radius:8px; background:none; cursor:pointer; color:var(--ink);
  font:15px ui-sans-serif,system-ui }
.mai-multe .cate button.acum { border-color:var(--rosu); color:var(--rosu); font-weight:600 }
.descriere { margin:20px 0; max-width:62ch; color:var(--soft); font-size:15.5px }
.descriere p { margin:0 }
/* Randurile de atribuire stau la DREAPTA (cerere user, 8 sept. 2026): sub coloana fisei,
   nu sub coperta. Marginea de sus era negativa pentru toate fisele — bine cand deasupra
   sta descrierea, dar la cartile fara descriere randurile urcau peste coperta si se
   suprapuneau peste ea (semnalat de user, 8 sept. 2026). Acum urca doar dupa descriere. */
.sursa { margin:8px 0 20px; text-align:right }
.descriere + .sursa { margin-top:-8px }
/* Cele doua randuri (de unde vin completarile; linkul spre surse) stateau prea departe
   unul de altul (user, 8 sept. 2026): textul e de 14px, dar paragraful de 17px/1.55 tinea
   fiecare rand la 26px. Ca bloc, randurile isi iau inaltimea de la textul lor. */
.sursa small { display:block; line-height:1.4 }
/* semnul de langa titlu: se vede, dar nu tipa peste titlu */
.imb { color:var(--rosu); font-size:.78em; vertical-align:.25em; cursor:help }
a:hover .imb { color:inherit }
/* cartile fara autor: linia din tabel duce totusi undeva */
.niciunul { color:var(--faint); text-decoration:none }
.pangar { border-left:2px solid var(--rosu); padding:2px 0 2px 14px; color:var(--soft);
          font-size:15.5px; margin:22px 0 }
/* doua coloane alaturate pe ecran lat (acasa: autorii si editurile), una pe telefon */
.doua { display:grid; grid-template-columns:1fr; gap:0 34px }
.doua > section > h2 { margin-top:30px }
@media (min-width:680px) { .doua { grid-template-columns:1fr 1fr } }
/* --- partea personala (A12, 30 aug 2026): cine esti, ce ai cerut, ce zice pangarul --- */
/* banda de raspuns dupa o apasare de buton */
.raspuns { border-left:2px solid var(--rule); padding:6px 0 6px 14px; margin:16px 0;
           font-size:15.5px; color:var(--soft) }
.raspuns.bun { border-left-color:var(--azi) }
.raspuns.rau { border-left-color:var(--rosu) }
/* lista cererilor: culoarea din stanga spune starea, fara sa scrie nimeni „urgent" */
ul.cereri { list-style:none; padding:0; margin:16px 0 }
ul.cereri li.cer { display:flex; align-items:flex-start; gap:12px;
                   padding:10px 0 10px 13px; margin:0;
                   border-left:2px solid var(--rule); border-bottom:1px solid var(--rule) }
/* coperta sta pe stanga; restul (titlu, stare, butoane) se aseaza pe randuri langa ea,
   nu sub ea — de aceea e intr-o cutie a lui, .ce, nu direct in li */
li.cer .ce { flex:1 1 0; min-width:0; display:flex; flex-wrap:wrap; align-items:baseline;
             gap:4px 12px }
li.cer.buna { border-left-color:var(--azi) }
li.cer.atentie { border-left-color:var(--albastru) }
li.cer.problema { border-left-color:var(--rosu) }
li.cer .stare { flex:1 1 200px; color:var(--faint); font-size:14px }
li.cer form { margin:0 }
li.cer .fapte { display:flex; flex-wrap:wrap; gap:8px }
li.cer button { padding:6px 11px; font-size:14px }
/* butonul care chiar face ceva: cererea unei carti */
form.cere { margin:18px 0 4px }
form.cere button { padding:11px 20px; font-size:16px;
                   border-color:var(--rosu); color:var(--rosu) }
/* Cutia de imprumut, despartita de fisa si de vecinatati printr-o linie subtire deasupra
   si una dedesubt (user, 8 sept. 2026, 02:34) — aceeasi linie ca la hr. Primul si
   ultimul copil isi lasa marginile, ca liniile sa stea la aceeasi departare de text. */
.cutie { border-top:1px solid var(--rule); border-bottom:1px solid var(--rule);
         padding:16px 0; margin:26px 0 }
.cutie > :first-child { margin-top:0 }
.cutie > :last-child { margin-bottom:0 }
/* Butonul si bara rosie cu explicatia pangarului pe acelasi rand, butonul inainte
   (user, 8 sept. 2026). Butonul nu se strange; textul de langa el se frange cat trebuie. */
.imprumut { display:flex; align-items:center; gap:18px; margin:22px 0 }
.imprumut form.cere { margin:0; flex:none }
.imprumut > .btn { margin:0 }
.imprumut .pangar { margin:0 }
/* Acelasi buton, dar legatura in loc de formular: acasa duce in Cartile mele, iar acolo
   se cere dreptul de imprumut (user, 8 sept. 2026). Se vede la fel cu butonul cererii. */
a.btn.cere { border-color:var(--rosu); color:var(--rosu); font-size:16px }
/* Butoanele cu iconita din antet — lupa, pangarul, raftul meu (user, 8 sept. 2026).
   Randul comun (.btns) le face pe toate la fel de late (flex:1), si asta e bine cat
   sunt trei; cu cinci, pe un telefon de 360 px raman vreo 57 px de buton si cuvantul
   „Autori" (48 px la 15 px) se lipeste de margini sau se rupe. Iconita isi ia doar cat ii
   trebuie si lasa restul randului cuvintelor. */
.btns .btn.icon { flex:none; padding:9px 13px }
` + STIL_SETARI;
