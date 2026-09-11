/**
 * Paginile programului liturgic — saptamana (programul scris sau propunerea ei, in aceeasi asezare),
 * arhiva, scrierea si validarea — pe carcasa comuna (@xc/ui).
 *
 * Grafica, markup-ul si TEXTELE de aici sunt cele din V1 (biserica-program, src/pagini.ts + src/stil.ts,
 * starea de la 9 sept. 2026), aduse ca atare — cerere user, 10.09.2026: „să respecți mesajele și grafica
 * din V1" si „afișarea și bara de navigare să fie identice". Ce difera e doar ce tine de structura V2:
 *   - adresele poarta prefixul aplicatiei (in preview toate stau pe un singur host).
 * Scrierea si validarea MANUALA a saptamanii (pagina /admin, care in V1 nu exista) au fost scoase cu totul
 * la cererea userului (10.09.2026, 16:36: „nu vreau să fac nimic manual") — programul are saptamanile
 * importate din V1 si propunerea automata, ca in V1.
 *
 * ⚠️ ANTETUL, REFACUT LA 11.09.2026 (trei runde de cereri intr-o ora; asta e starea finala).
 * Randul de unelte (`.btns` al carcasei) are acum DOUA GRUPURI, despartite de bara verticala:
 *
 *   STANGA — pastila navigarii, care ia tot spatiul ramas („restul spațiului să fie folosit de
 *   butoanele celelalte", user 10:48). Trei segmente:
 *     - ARHIVA (numai la admini), in locul datelor saptamanii trecute — „nu se mai deschide
 *       săptămâna trecută. Se poate selecta din pagina arhivei";
 *     - BULINA saptamanii de azi, fara text (e din 8 sept.; a iesit la 10:01 si s-a intors la 10:47,
 *       cand userul a lamurit ca „fără buton în meniu" se referea la ea, nu la intrerupator);
 *     - „SĂPTĂMÂNA VIITOARE", scris in litere (user, 10:01 — dimineata ceruse invers, date scurte).
 *       Datele au trecut in `title`/`aria-label`, ca sa se stie despre care saptamana e vorba.
 *
 *   DREAPTA, lipit de marginea din dreapta (user, 10:48: „să fie aliniate la dreapta… tot ce este
 *   după bara verticală"): INTRERUPATORUL „Calendar", butonul de DESCARCARE a paginii, apoi
 *   hartiile PDF si JPG. Ultimele trei se scriu numai pentru ADMINI, pe cele doua trepte
 *   (`vedeHartiile`); enoriasul ramane cu navigarea si intrerupatorul.
 *
 * PDF si JPG au URCAT aici din casuta care atarna sub linia antetului (user, 10:48: „să urci sus
 * cele două butoane"). Casuta (`.nav-jos`, slotul `subantet`) a disparut cu totul — daca cineva o
 * cere inapoi, se reface, dar atunci se intoarce si golul de 34 px pe care-l cerea sub antet.
 *
 * ABONAREA a iesit cu totul, momentan („abonează-te iese de tot momentan", user 10.09, 17:01).
 * Rutele `POST /abonare` · `/dezabonare` si audienta comunicarii raman intacte — se readuce doar
 * bucata de interfata.
 */
import type { IntrareVocabular, Slujba, StareSaptamana } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, STIL_COMUN, ZILE_SAPTAMANA, adaugaZile, alerta, esc, intervalLizibil, luneaSaptamanii, pagina, ziuaSaptamanii } from '@xc/ui'
import type { CalendarSaptamana, ZiPeProgram } from './calendar.js'
import { ziRosie } from './calendar.js'
import { PAROHIA, randurileSlujbei } from './foaie.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  /** super-adminul vede hartiile pe tot istoricul, adminul doar pe saptamanile din navigare */
  eSuperAdmin?: boolean
  versiune: string
  modificata: string
  /** „Vezi ca" — vin din sesiune, gata calculate de identitate; doar pentru meniu si banda. */
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/** Ce-i trebuie antetului ca sa se aseze: navigarea si intrerupatorul calendarului. Il umple index.ts. */
export interface Meniu {
  /** lunea saptamanii de pe ecran; `null` pe paginile care nu tin de o saptamana (arhiva, mesaje) */
  luni: string | null
  /** adresa foii FARA extensie si FARA prefix (`/v1/foaie/<luni>`, `/v1/propunere/<luni>`); null = n-are foaie */
  foaie: string | null
  /** ziua de azi (Bucuresti) — din ea ies cele trei trepte ale navigarii */
  azi: string
  /** pagina deschisa e Arhiva (butonul ei din pastila ramane aprins) */
  arhiva?: boolean
  /**
   * Saptamana a fost deschisa DIN arhiva (`?din=arhiva`, pus de linkurile de acolo — user, 11.09.2026,
   * 16:24). Doua urmari: deasupra titlului se scrie butonul „Înapoi la arhivă", iar segmentul Arhivei
   * din pastila ramane marcat, ca omul sa vada de unde a venit. Nu se ghiceste din `referer`: acela
   * lipseste des si ar face pagina sa arate altfel de la o deschidere la alta, cu tot cu cache.
   */
  dinArhiva?: boolean
  /**
   * Calendarul se POATE aprinde pe pagina asta — adica se scrie intrerupatorul, iar coloana zilei
   * liturgice sta in pagina, gata sa iasa la iveala. Adevarat pe saptamana de azi si pe cea viitoare
   * (alegerea userului, 11.09.2026, ora 10:47), fals pe saptamanile din arhiva: acolo calendarul
   * n-are ce spune despre ziua de azi, deci nici intrerupator, nici coloana.
   *
   * Fals => si butonul de descarcare da mereu varianta pe O COLOANA, fiindca alta nu se poate vedea.
   */
  calendar?: boolean
}

const STARE: Record<string, string> = {
  validat: 'validat',
  propus: 'propus',
  modificat_dupa_validare: 'modificat după validare',
  propunere: 'propunere',
}

/**
 * Iconita descarcarii: sageata in jos peste o talpa. E semnul pozei paginii ASA CUM SE VEDE ACUM,
 * pe o singura coloana — adica ori de cate ori intrerupatorul „Calendar" e stins.
 */
const IC_DESCARCA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></svg>`

/**
 * Aceeasi descarcare, dar cu DOUA sageti una langa alta, pe aceeasi talpa — pentru poza paginii cand
 * pagina e DUBLATA, adica atunci cand intrerupatorul „Calendar" e aprins (user, 11.09.2026: „dacă
 * este dublat, butonul de download își schimbă iconița în două săgeți în jos și descarcă acea
 * imagine"). Doua sageti = doua coloane: semnul spune si ce face butonul (descarca), si ce iese din
 * el. Talpa e aceeasi (`M4 20h16`), ca cele doua infatisari ale aceluiasi buton sa se recunoasca una
 * pe alta; sagetile sunt construite ca cea singura — tija pana la 14, varful la 15.
 *
 * Masurile sunt stranse dinadins: fiecare sageata e mai ingusta decat cea singura (±2,8 in loc de ±5),
 * iar cele doua stau la 4 unitati una de alta. La prima incercare erau mai late si varfurile lor se
 * atingeau: la 17 px, cu capete rotunde, cele doua sageti se citeau ca un singur „W".
 */
const IC_DESCARCA_DUBLU = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.2 4.5v9.5"/><path d="m4.4 12.2 2.8 2.8 2.8-2.8"/><path d="M16.8 4.5v9.5"/><path d="m14 12.2 2.8 2.8 2.8-2.8"/><path d="M4 20h16"/></svg>`

/**
 * Iconita ECRANULUI IMPARTIT: o rama despicata in doua, cu cate un rand scris in fiecare jumatate —
 * programul la stanga, calendarul la dreapta. E semnul INTRERUPATORULUI „Calendar", in locul
 * cuvantului (user, 11.09.2026): butonul chiar asta face, imparte ecranul in doua.
 *
 * MAI MARE decat celelalte — 21 px fata de 17 (user: „un pic mai mare; nu se înțelege ce este
 * acolo"). Desenul are inauntru rama, despicatura si patru randuri scurte: la 17 px toate astea se
 * faceau o pata. Restul iconitelor raman cum erau — asta una singura trebuie inteleasa dintr-o
 * ochire, fiindca e singurul buton care schimba pagina sub ochii omului.
 */
const IC_DOUA_COLOANE = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M12 4.5v15"/><path d="M5.6 9.2h3.6M5.6 13h3.6M14.8 9.2h3.6M14.8 13h3.6"/></svg>`

/** Iconita Arhivei: cutie cu capac — exact cea din V1 (18px, cu manerul desenat separat). */
const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`

/**
 * SAGEATA-DREAPTA: „Săptămâna viitoare", stransa la un semn pe TELEFON (user, 11.09.2026 — cele doua
 * grupuri ale randului de unelte nu mai incapeau pe un rand la un admin, care le are pe toate).
 * Aceleasi masuri ca iconita Arhivei, ca cele doua capete ale pastilei sa cantareasca la fel.
 */
const IC_INAINTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12h14"/><path d="m12.5 6 6 6-6 6"/></svg>`

/** Săgeata „înapoi", a butonului de deasupra titlului la săptămânile deschise din arhivă. */
const IC_INAPOI = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 12h-14"/><path d="m11.5 6-6 6 6 6"/></svg>`

// ---------------------------------------------------------------------------
// Stilul local — V1 src/stil.ts, ca atare; adaugirile V2 sunt marcate
// ---------------------------------------------------------------------------

export const STIL = `
.marunt { font-size:14px; color:var(--faint) }


/* capul saptamanii: titlul + starea (navigarea si hartiile au urcat in meniul din antet, 8 sept. 2026) */
/* Eticheta („propunere") se aseaza pe MIJLOCUL titlului, nu pe linia lui de baza: pastila are chenar
   si spatiu inauntru, asa ca aliniata pe baza atarna cu vreo sase pixeli mai jos decat scrisul mare
   de langa ea (semnalat de user, 10.09.2026). */
.sapt-cap { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:26px 0 14px }
.sapt-cap h2 { margin:0 }
/* ⚠️ PROBA (11.09.2026) — MOMENTUL scris in pagina: deasupra datelor saptamanii sta, marunt, „săptămâna
   trecută / aceasta / următoare". Aici se vede cel mai bine ca e acelasi lucru in alt moment, iar
   butoanele din antet pot ramane scurte (doar datele, cum s-a cerut pe 11.09). Pe saptamanile din
   arhiva nu se scrie nimic — acolo nu e niciunul din cele trei momente. */
.sapt-cap .moment { display:block; font:600 10.5px/1 ui-sans-serif,system-ui; letter-spacing:.12em;
                    text-transform:uppercase; color:var(--faint); margin:0 0 7px }
.sapt-cap .moment.acum { color:var(--rosu) }
/* „Înapoi la arhivă" (user, 11.09.2026), deasupra titlului, numai pe saptamanile deschise din arhiva.
   Sta ca un buton mic si stins, de aceeasi masura cu cele din randul de unelte — e un drum inapoi,
   nu o unealta a saptamanii, deci n-are ce cauta printre ele. */
.rand-inapoi { margin:22px 0 0 }
.inapoi { display:inline-flex; align-items:center; gap:7px; font:600 12.5px/1 ui-sans-serif,system-ui;
          letter-spacing:.06em; color:var(--soft); text-decoration:none; background:var(--tinta);
          border:1px solid var(--rule); border-radius:10px; padding:9px 13px }
.inapoi:hover { color:var(--rosu); border-color:var(--rosu) }
.inapoi svg { vertical-align:0 }
/* cu butonul deasupra, titlul n-are nevoie de tot spatiul lui de sus */
.rand-inapoi + .sapt-cap { margin-top:14px }
.stare { font:600 10.5px/1 ui-sans-serif,system-ui; letter-spacing:.12em; text-transform:uppercase;
         padding:5px 9px; border-radius:999px; border:1px solid var(--rule); color:var(--soft); white-space:nowrap }
.stare.validat { border-color:var(--azi); color:var(--ink); background:var(--azi-fund) }
.stare.propus { border-color:var(--albastru); color:var(--albastru) }

/* ANTETUL, refacut la 11.09.2026 (ultima cerere, ora 10:48): randul de unelte (.btns al carcasei) are
   DOUA GRUPURI — pastila navigarii la stanga, care ia tot spatiul ramas, si restul lipit de marginea
   din DREAPTA: intrerupatorul, descarcarea, PDF, JPG. Casuta care atarna sub linia antetului (.nav-jos)
   a disparut: hartiile au urcat aici. */
/* V2: carcasa comuna lasa .btns sa se rupa (flex-wrap:wrap); in V1 randul nu se rupea pe desktop —
   butoanele se string, nu sar pe randul urmator. Pe telefon se rupe (mai jos). */
.btns { flex-wrap:nowrap }
.btns .gol { opacity:.35; pointer-events:none }
/* treapta pe care CHIAR esti (aria-disabled): nu duce nicaieri, dar se apasa — atunci ia focusul si
   ramane ea marcata, ca sa se vada unde ne aflam (cerere user, 10.09.2026). Marginea rosie o are din
   clasa .activ; la apasare se adauga si fundalul, ca apasarea sa se simta. */
.btns .btn[aria-disabled="true"] { cursor:default }
.btns .btn[aria-disabled="true"]:focus { outline:none; background:var(--azi-fund) }
/* INTRERUPATORUL „Calendar" (user, 10.09.2026: „informații utile să fie «Calendar» și să fie un
   întrerupător on-off"). E un buton adevarat, cu bec care aluneca: aprins = calendarul se vede in
   coloana din dreapta. Cere JS; fara el ramane stins, iar programul se citeste ca si pana acum.
   ⚠️ A fost scos la 10:01 si repus la 10:47 — userul lamurise ca „fără buton în meniu" se referea la
   bulina, nu la el. Nu-l mai scoate fara o cerere care sa-i spuna pe nume. */
.btns .com-cal { cursor:pointer; gap:8px }
.btns .com-cal .bec { flex:none; position:relative; width:30px; height:16px; border-radius:999px;
                      border:1px solid var(--rule); background:var(--tinta) }
.btns .com-cal .bec::after { content:""; position:absolute; top:1px; left:1px; width:12px; height:12px;
                             border-radius:50%; background:var(--soft) }
/* ⚠️ Aprins, becul NU mai e rosu (user, 11.09.2026: „să nu mai fie roșu; întrerupătorul să fie alb").
   Rosul e culoarea locului in care te afli — pastila navigarii, masca din meniu — si se irosea pe o
   stare care acum e cea obisnuita. Aprins, becul se umple cu cerneala si bila se face alba, ca hartia
   (in tema de noapte se intorc amandoua, fiindca cerneala si hartia isi schimba locul); stins,
   pista ramane palida si bila cenusie. Ce s-a schimbat spune tot bila care a alunecat in dreapta. */
.btns .com-cal[aria-pressed="true"] .bec { border-color:var(--soft); background:var(--soft) }
.btns .com-cal[aria-pressed="true"] .bec::after { left:auto; right:1px; background:var(--paper) }
.btns .btn { min-width:0 }
/* GRUPUL DIN DREAPTA (user, 11.09.2026, 10:48: „tot ce este după bara verticală… să fie aliniate la
   dreapta, dar restul spațiului să fie folosit de butoanele celelalte"). margin-left:auto il impinge
   in capat, iar pastila ramane cu tot ce prisoseste. Bara verticala calatoreste cu el, ca sa ramana
   granita dintre cele doua grupuri. */
.btns .unelte-dr { display:flex; align-items:stretch; gap:10px; flex:0 0 auto; margin-left:auto }
/* bulina din mijloc (user, 8 sept. 2026: „doar o bulină pe centru"): un punct, fara text, la fel de
   inalt ca segmentele de langa el; duce la saptamana de azi */
.btns .punct { flex:0 0 auto; display:flex; align-items:center; justify-content:center; padding-left:20px; padding-right:20px }
.btns .punct::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.btns .punct:hover { color:var(--rosu); border-color:var(--rosu) }
/* PASTILA navigarii (aleasa de user, 11.09.2026): segmentele lipite intr-un singur corp, ca sa se
   citeasca drept UN obiect cu o pozitie, nu destinatii deosebite. Chenarul si rotunjirea stau pe
   pastila, nu pe butoane; intre segmente ramane o linie de 1 px, iar segmentul pe care esti e PLIN.
   Inauntru: Arhiva (numai la admini), bulina de azi si „Săptămâna viitoare".
   CRESTE cat o tine randul (flex:1), fiindca userul a cerut ca spatiul ramas dupa grupul din dreapta
   sa fie al ei. Ca sa nu se latteasca urat, prisosul il ia DOAR segmentul cu scris — arhiva si bulina
   raman cat le tine desenul. */
.btns .pastila { display:flex; flex:1 1 auto; min-width:0; border:1px solid var(--rule); border-radius:10px;
                 background:var(--tinta); overflow:hidden }
.btns .pastila .btn { flex:0 0 auto; border:0; border-radius:0; background:transparent }
.btns .pastila .viit { flex:1 1 auto; min-width:0 }
/* „Săptămâna viitoare" poarta si cuvintele (.cuv), si sageata (.sgt), amandoua scrise in pagina.
   Pe larg se vad cuvintele singure; pe telefon, vezi media query. Ca la butonul de descarcare —
   alegerea o face CSS-ul, nu JS-ul, deci nu apuca sa se vada infatisarea nepotrivita. */
.btns .viit .sgt { display:none }
.btns .pastila .btn + .btn { border-left:1px solid var(--rule) }
.btns .pastila a.btn:hover { color:var(--rosu); background:var(--paper) }
.btns .pastila .btn.activ { color:var(--rosu); font-weight:600;
                            background:color-mix(in srgb, var(--rosu) 11%, transparent) }
.btns .pastila .btn[aria-disabled="true"]:focus { background:color-mix(in srgb, var(--rosu) 18%, transparent) }
/* segmentul ARHIVEI: n-are text, doar cutia cu capac, deci se centreaza singur si sta mai stramt decat
   unul cu scris (11.09.2026 — a luat locul datelor saptamanii trecute) */
.btns .pastila .arh { display:flex; align-items:center; justify-content:center;
                      padding-left:16px; padding-right:16px }
.btns .pastila .arh svg { vertical-align:0 }
/* bara verticala dintre navigare si butoanele saptamanii (cerere user, 8 sept. 2026) */
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }
/* butoanele mici: nu cresc, stau cat le tine continutul — intrerupatorul, descarcarea, PDF si JPG */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.06em }
.btns .mic svg { vertical-align:0 }
/* BUTONUL DE DESCARCARE are doua infatisari scrise amandoua in pagina, iar CSS-ul o alege pe cea
   potrivita dupa cu-calendar (user, 11.09.2026: „să descarce varianta care se vede"). Asa iconita si
   tinta se schimba in aceeasi clipa cu coloana, fara ca JS-ul sa umble la adresa — si nu apuca sa se
   vada niciodata semnul care nu trebuie. */
.btns .poza-2 { display:none }
body.cu-calendar .btns .poza-1 { display:none }
body.cu-calendar .btns .poza-2 { display:flex }
/* ⚠️ PE TELEFON, TOT RANDUL DE UNELTE INCAPE PE O LINIE (cerere user, 11.09.2026: „nu încap restul
   butoanelor pe aceeași linie"). Pana atunci randul se rupea in doua, cu pastila sus si hartiile
   dedesubt. Ca sa incapa, doua lucruri isi lasa scrisul si raman doar semnul lor: „Săptămâna
   viitoare" se face SAGEATA-DREAPTA (chiar cuvantul userului), iar PDF/JPG raman iconitele felului.
   Restul segmentelor se string putin la padding.
   Cifrele, masurate pe pagina unui super-admin (el are cele mai multe butoane: arhiva, bulina,
   Calendar, descarcarea, PDF, JPG): randul cerea 431 px, iar un telefon de 390 px are 335 de
   folosit, unul de 360 doar 305. Numai cu sageata ar fi cerut 346 — inca prea mult; cu hartiile
   strunse cere 294 si incape pe amandoua. Ruperea randului (flex-wrap) ramane, ca plasa de siguranta la ecrane si
   mai inguste ori la scrisul marit din setarile telefonului. */
@media (max-width:600px) {
  .btns { gap:5px; flex-wrap:wrap }
  .btns .btn { flex:0 0 auto; white-space:nowrap }
  /* ⚠️ Pastila ia si pe telefon spatiul ramas dupa grupul din dreapta (user, 11.09.2026, 16:20: „să
     faci butonul cu săgeata pentru admini cât tot spațiul disponibil rămas"), iar prisosul il ia
     segmentul sagetii — mai jos, .viit. Aici masura de pornire ramane auto (nu 0, ca la pastila
     larga): la admin inauntru sunt numai iconite, deci masura lor nu umfla nimic, iar randul se rupe
     cinstit cand chiar nu mai incape, in loc sa taie iconitele. */
  .btns .pastila { flex:1 1 auto }
  .btns .mic .fel { display:none }
  /* ⚠️ BUTOANELE-ICONITA SUNT PATRATE (user, 11.09.2026, 16:02: „să fie atâta spațiu sus cât este
     stânga dreapta"). Padingul de sus e cel al carcasei (9px, din .btn), deci se scrie 9px si in
     laturi: iconita de 17–18 px iese intr-o tinta de ~36×36, mai usor de nimerit cu degetul decat
     dreptunghiul ingust de pana acum. Se aplica la TOATE cele din rand — si la cele din pastila. */
  .btns .mic { padding:9px }
  .btns .com-cal { gap:5px; padding:9px }
  .btns .pastila .arh { padding:9px }
  .btns .unelte-dr { gap:5px }
  .btns .desparte { margin:0 2px }
  /* BULINA sta mai larga decat celelalte (user, 11.09.2026: „să aibă un spațiu mai mare stânga-dreapta
     … să fie mai ușor de apăsat"): punctul ei are 9 px, deci fara spatiu in plus tinta ar fi cea mai
     mica din rand, desi e drumul inapoi la saptamana de azi. */
  .btns .punct { padding-left:15px; padding-right:15px }
  /* segmentul „viitoare", strans la semn: centrat si tot atat de lat ca iconita Arhivei din celalalt
     capat al pastilei, ca cele doua capete sa cantareasca la fel */
  .btns .viit .cuv { display:none }
  .btns .viit .sgt { display:block }
  .btns .pastila .viit { flex:1 1 auto; display:flex; align-items:center; justify-content:center;
                         padding:9px }
  .btns .pastila .viit svg { vertical-align:0 }
  /* ⚠️ PASTILA LARGA — omul FARA drepturi de admin (user, 11.09.2026, 16:02: „cele două butoane de la
     stânga pentru un utilizator obișnuit… să fie dispuse pe toată lungimea meniului"). El are in
     pastila doar bulina si „viitoare", iar in dreapta doar intrerupatorul: e loc destul, deci pastila
     se intinde cat randul, prisosul il ia segmentul cu scris, iar cuvintele stau LANGA sageata, nu in
     locul ei. Bulina, si ea, se face si mai lata: acolo latimea nu mai e disputata de nimeni. */
  /* ⚠️ flex:1 1 0, nu 1 1 auto: cu masura de pornire 0, pastila nu mai cere randul dupa cat scris
     are in ea, ci ia ce ramane dupa intrerupator — altfel cuvintele o umflau peste latimea ecranului
     si intrerupatorul sarea pe randul urmator, tocmai lucrul de care scapam. */
  .btns .pastila.larga { flex:1 1 0; min-width:0 }
  .btns .pastila.larga .viit { flex:1 1 auto; gap:9px }
  .btns .pastila.larga .viit .cuv { display:inline }
  .btns .pastila.larga .punct { padding-left:22px; padding-right:22px }
}
/* Telefoanele inguste (Android de 360 px si mai jos): acolo randul admin-ului cere cativa pixeli mai
   mult decat are. Cade bara verticala dintre grupuri (pastila se vede oricum ca un corp, deci granita
   nu se pierde) si butoanele lasa un pixel din laturi — nu mai sunt patrate la milimetru, dar randul
   ramane intreg. Pe pastila larga nu se atinge nimic: acolo n-a fost niciodata strans. */
@media (max-width:380px) {
  .btns .desparte { display:none }
  .btns .mic, .btns .com-cal, .btns .pastila .arh, .btns .pastila .viit { padding-left:7px; padding-right:7px }
  .btns .punct { padding-left:12px; padding-right:12px }
  .btns .pastila.larga .punct { padding-left:22px; padding-right:22px }
}

/* o zi din program */
.zi { margin:0 0 22px; padding:0 0 14px; border-bottom:1px solid var(--rule) }
.zi:last-child { border-bottom:0 }
.zi h3 { margin:16px 0 4px; font-size:17px }
/* capul zilei: numele la stanga, iar duminica butonul foii cu sfintii zilei la dreapta
   (cerere user, 9 sept. 2026 — foaia se tipareste si se citeste la sfarsitul Liturghiei) */
.zi-cap { display:flex; align-items:baseline; justify-content:space-between; gap:12px }
.zi-cap h3 { flex:1 1 auto; min-width:0 }
.zi-cap .sfintii { flex:0 0 auto; align-self:center; display:inline-flex; align-items:center; gap:7px;
                   padding:7px 12px; white-space:nowrap;
                   font:600 11.5px/1 ui-sans-serif,system-ui; letter-spacing:.04em;
                   text-decoration:none; border-radius:8px }
/* iconita spune ce fel de fisier e; langa ea doar numele (cerere user, 9 sept. 2026) */
.zi-cap .sfintii svg { flex:none; vertical-align:0; color:var(--soft) }
.zi-cap .sfintii:hover svg { color:inherit }
.zi-cap .sfintii:hover { border-color:var(--rosu); color:var(--rosu) }
/* CALENDARUL zilei de la A1, in COLOANA LUI (user, 10.09.2026: „Programul nu mai vreau să fie
   întrepătruns cu Sfinții — Calendarul"; „Programul să fie într-o coloană pe stânga și Calendarul
   apare paralel și cu linii în plus pe dreapta"). Sta in pagina si se aprinde din intrerupatorul
   „Calendar" din antet (clasa cu-calendar pe body, tinuta minte in localStorage). PORNESTE APRINS
   (user, 11.09.2026: „starea implicită este On"; dimineata ceruse invers) si se scrie doar pe
   saptamana de azi si pe cea viitoare. Aprins, ziua se face doua coloane: la stanga programul
   (.prog), la dreapta ziua liturgica.
   Coloanele se aliniaza SUS, nu rand cu rand — calendarul are de obicei mai multe randuri decat
   programul, iar zilele fara slujbe ies si ele la iveala, ca linii numai pe dreapta. */
.cal { display:none }
body.cu-calendar .zi { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr);
                       column-gap:26px; align-items:start }
body.cu-calendar .zi .prog { min-width:0 }
body.cu-calendar .cal { display:block; min-width:0; padding:0 0 0 18px; border-left:1px solid var(--rule) }
/* ⚠️ Zilele rosii CU slujbe — duminicile si sarbatorile cu cruce rosie — raman pe O SINGURA coloana,
   cat e pagina de lata (user, 11.09.2026): programul lor spune deja sarbatoarea si sfintii, pe
   randurile „→" ale slujbei de dimineata. Coloana din dreapta nici nu se mai scrie (vezi ziuaHtml);
   aici doar se desface grila, ca programul sa nu ramana ingramadit in jumatatea stanga. */
body.cu-calendar .zi.fara-cal { display:block }
/* capul coloanei: numele zilei, cu aceleasi masuri ca titlul din stanga, ca cele doua sa stea pe
   aceeasi linie (cerere user, 10.09.2026 — titlu deasupra fiecarei liste, chiar daca se repeta) */
/* 10px sub titlu, ca in stanga: acolo h3 sta intr-un flex (.zi-cap), deci marginea lui de jos (4px) nu
   se colapseaza si se aduna cu cea de sus a primei slujbe (6px). Aici marginile se colapseaza, asa ca
   distanta se scrie o data, intreaga — altfel lista de sfinti incepe mai sus decat programul. */
.cal-zi { margin:16px 0 10px; font-size:17px; font-weight:600; line-height:1.3 }
.zi.rosie .cal-zi { color:var(--rosu) }
/* pe telefon nu incap doua coloane: calendarul se aseaza sub programul zilei, ca pana acum. Acolo
   numele zilei nu se mai repeta — dar in zilele FARA slujbe stanga e goala, deci lista de sfinti ar
   ramane fara niciun titlu (semnalat de user, 10.09.2026): in ele, titlul din dreapta se aprinde. */
@media (max-width:600px) {
  body.cu-calendar .zi { display:block }
  body.cu-calendar .cal { margin:4px 0 10px; padding:8px 12px; background:var(--tinta);
                          border-left:3px solid var(--rule); border-radius:0 8px 8px 0 }
  .cal-zi { display:none }
  .zi.goala .cal-zi { display:block; margin:0 0 6px }
  /* (Zilele rosii CU slujbe n-au nevoie aici de nicio regula: de la 11.09.2026 coloana lor nu se mai
     scrie nicaieri — vezi ziuaHtml. Pana atunci se ascundea doar pe telefon.) */
}
/* In coloana calendarului, SFINTII stau unul sub altul, cu sageata in fata — ca randurile „→" ale
   slujbelor (cerere user, 10.09.2026: „cel mai mult mă interesează sfinții… pune-le cu săgeată, așa
   cum sunt ele afișate duminica"). Aceleasi masuri ca la .slujba .det, ca cele doua coloane sa se
   citeasca la fel. Rosul si albastrul sunt ale rangului, sfant cu sfant, ca in calendarul A1. */
.cal .det { margin:1px 0 0; font-size:14.5px; color:var(--soft); line-height:1.45 }
.cal .det::before { content:"→ "; color:var(--faint) }
.cal .det.rosu { font-weight:600; color:var(--rosu) }
.cal .det.c-rosu { color:var(--rosu) }
.cal .det.c-albastru { color:var(--albastru) }
.cal-rand { margin:6px 0 0; font:13px/1.5 ui-sans-serif,system-ui; color:var(--soft) }
/* zilele in care nu se slujeste stau in pagina doar ca sa-si arate calendarul (cerere user, 9 sept.
   2026): se vad numai cand calendarul e aprins. Cat sunt ascunse, programul se incheie cu ultima zi
   CU slujbe — ea ramane fara linie dedesubt, fiindca .zi:last-child ar cadea pe o zi ascunsa. */
body:not(.cu-calendar) .zi.goala { display:none }
body:not(.cu-calendar) .zi.ultima { border-bottom:0 }
/* titlul zilei rosu duminica si la praznice / sfinti cu cruce rosie („Joi, 6 august"; user, 8 sept. 2026) */
.zi.rosie h3 { color:var(--rosu) }
.zi.azi h3::after { content:"azi"; font:600 9.5px/1 ui-sans-serif,system-ui; letter-spacing:.14em; text-transform:uppercase;
                    color:var(--ink); background:var(--azi-fund); border:1px solid var(--azi); border-radius:999px; padding:3px 7px; margin-left:10px; vertical-align:2px }
/* align-items:baseline — ora (sans 15px) si numele slujbei (serif 17px) au inaltimi de rand diferite,
   deci asezate la varf ora iesea cu vreo doi pixeli mai sus (user, 10.09.2026). Pe linia de baza stau
   drept, oricat de diferite ar fi fonturile. Randurile „→" de dedesubt n-au pereche, deci nu se schimba. */
.slujba { display:grid; grid-template-columns:56px 1fr; column-gap:12px; margin:6px 0; align-items:baseline }
.slujba .ora { font:600 15px/1.55 ui-sans-serif,system-ui; color:var(--soft); letter-spacing:.02em }
.slujba .nume { font-weight:600 }
.slujba .nume.dimineata { color:var(--rosu) }
.slujba .det { grid-column:2; margin:1px 0 0; font-size:14.5px; color:var(--soft); line-height:1.45 }
.slujba .det::before { content:"→ "; color:var(--faint) }
/* randurile „→" cu numele duminicii si cu sarbatorile cu rosu (praznice, sfinti cu cruce rosie, dupa A1):
   bold + rosu, ca in foaia A4 — si duminica (user, 8 sept. 2026) */
.slujba .det.rosu { font-weight:600; color:var(--rosu) }
.gol { color:var(--faint); font-style:italic }

/* arhiva */
/* butoanele cu anii: patratelele .capitole din carcasa, dar anul ALES ramane link (a.acum,
   nu b.acum ca la literele din A12) — userul vrea sa se poata apasa si cand e selectat (8 sept. 2026). */
.capitole a.acum { border-color:var(--rosu); color:var(--rosu); font-weight:600 }
.an h3 { margin:26px 0 6px }
/* capul de luna, deasupra batonului ei */
.an h4 { margin:18px 0 6px; font:600 11px/1 ui-sans-serif,system-ui;
         letter-spacing:.14em; text-transform:uppercase; color:var(--soft) }
/* saptamanile lunii: un BATON segmentat EGAL (user, 8 sept. 2026) — zone de latime egala, lipite,
   despartite de linii de 1px. Liniile sunt umbre pe zona (dreapta + jos), nu gap prin care se vede
   fundalul batonului: pe telefon randul se rupe (auto-fit face 2 coloane sub ~450 px) si ultima zona
   poate lasa un loc gol — cu fundal colorat ar iesi acolo un dreptunghi gri. Ce iese in afara
   (umbra ultimei coloane, a ultimului rand) taie overflow:hidden.
   In zona: perioada sus, numarul de slujbe dedesubt; starea doar cand NU e „validat". */
.baton { display:grid; grid-template-columns:repeat(auto-fit,minmax(128px,1fr));
         background:var(--paper); border:1px solid var(--rule); border-radius:10px; overflow:hidden }
.baton a { padding:9px 8px 10px; text-align:center; text-decoration:none; color:var(--ink);
           box-shadow:1px 0 0 var(--rule), 0 1px 0 var(--rule);
           /* conturul sta scris de pe acum, TRANSPARENT, ca sa aiba ce colora :visited — vezi jos */
           outline:2px solid transparent; outline-offset:-2px }
.baton a:hover { background:var(--tinta); color:var(--rosu) }
/* ⚠️ SAPTAMANILE DESCHISE se vad marcate (user, 11.09.2026, 16:32) — semnul ca „aici am fost deja",
   cand te intorci in arhiva cu pasul inapoi. Se face din :visited, adica din istoricul browserului:
   nimic de tinut minte de noi, si merge si dupa ce omul inchide telefonul. ⚠️ Browserele lasa la
   :visited NUMAI proprietati de culoare (color, background-color, border-color, outline-color) —
   ca sa nu se poata citi istoricul masurand pagina. De aceea conturul e scris mai sus transparent si
   aici doar se coloreaza; un chenar sau un semn adaugat acum n-ar avea niciun efect.
   Doua semne deodata, dinadins: conturul (se vede si pe fundal colorat) si fundalul stins (se vede si
   acolo unde browserul face nazuri la contur). */
.baton a:visited { outline-color:var(--faint); background-color:var(--tinta); color:var(--soft) }
.baton a:visited:hover { outline-color:var(--rosu); color:var(--rosu) }
.baton b { display:block; font-size:15.5px; font-weight:600; white-space:nowrap }
.baton span { display:block; margin-top:2px; font:12.5px ui-sans-serif,system-ui; color:var(--faint) }
.baton i { display:block; margin-top:4px; font:600 9px/1 ui-sans-serif,system-ui; font-style:normal;
           letter-spacing:.12em; text-transform:uppercase; color:var(--albastru) }

/* propunerea */
.nelamuriri { border-left:3px solid var(--rosu); padding:2px 0 2px 16px; margin:22px 0; color:var(--soft) }

/* foaia A4 de pe usa: doar programul, fara antet, subsol si navigare */
@media print {
  header.sus, .subsol-linie, .versiune, footer.subsol, .btns, .zi-cap .sfintii,
  .zi.goala, .cine, .marunt, .nelamuriri, .cal { display:none !important }
  body { padding:0; font-size:14pt; color:#000; background:#fff }
  main { padding-top:0 !important }
  /* pe hartie merge doar programul, intr-o coloana — calendarul ramane pe ecran */
  body.cu-calendar .zi { display:block }
  .w { max-width:none }
  .zi { break-inside:avoid; border-bottom:0; margin-bottom:10pt; padding-bottom:0 }
  .slujba .nume.dimineata, .slujba .det.rosu, .zi.rosie h3 { color:#000 }
  .stare { display:none }
}
`

/**
 * JS-ul paginilor de om (slotul `scripturi`): intrerupatorul „Calendar" din antet — aprinde si stinge
 * coloana calendarului (clasa `cu-calendar` pe body) si, o data cu ea, infatisarea butonului de
 * descarcare, care se schimba singur din CSS. Scris ca JS-ul comun al carcasei — fara sageti, fara
 * let/const — ca sa mearga si pe telefoanele vechi ale enoriasilor.
 *
 * Alegerea se tine in localStorage, deci ramane de la o pagina la alta; pe paginile fara intrerupator
 * (arhiva, saptamanile vechi) nu se aprinde nimic, dar alegerea se pastreaza pentru cand omul se
 * intoarce la saptamana lui.
 *
 * ⚠️ PORNESTE APRINS (user, 11.09.2026: „să înceapă direct cu întrerupătorul pe On… starea implicită
 * este On"; dimineata alesese invers). De aceea clasa `cu-calendar` vine DE PE SERVER, pusa din capul
 * locului pe `body` (`clasaCorp`, vezi paginaSaptamana), iar JS-ul de aici doar o SCOATE daca omul a
 * stins-o vreodata — asa coloana nu clipeste la incarcare in cazul obisnuit. Cheia se citeste ca
 * „aprins daca nu scrie anume «0»": un localStorage gol inseamna implicitul, nu „stins".
 */
export const SCRIPT = `
(function(){
  var CHEIE = "program_calendar";
  var buton = document.getElementById("b-calendar");
  if (!buton) return;
  function pune(pornit){
    document.body.classList.toggle("cu-calendar", pornit);
    buton.setAttribute("aria-pressed", pornit ? "true" : "false");
    buton.setAttribute("title", pornit ? "Ascunde calendarul zilei" : "Arată calendarul zilei");
  }
  var pornit = true;
  try { pornit = localStorage.getItem(CHEIE) !== "0"; } catch (e) {}
  pune(pornit);
  buton.addEventListener("click", function(){
    pornit = !pornit;
    pune(pornit);
    try { localStorage.setItem(CHEIE, pornit ? "1" : "0"); } catch (e) {}
  });
})();
(function(){
  // „Înapoi la arhivă" (user, 11.09.2026): daca omul chiar vine din pagina arhivei, butonul face
  // PASUL INAPOI al browserului — arhiva se redeschide derulata unde a ramas, cu anul si luna pe
  // care le rasfoia. Daca a intrat de-a dreptul pe adresa (link trimis, semn de carte), pasul inapoi
  // l-ar duce aiurea, asa ca linkul ramane cum e scris si duce la /arhiva.
  var b = document.getElementById("b-inapoi");
  if (!b) return;
  b.addEventListener("click", function(e){
    var vineDinArhiva = document.referrer && document.referrer.indexOf("/arhiva") > -1;
    if (vineDinArhiva && history.length > 1) { e.preventDefault(); history.back(); }
  });
})();
`

// ---------------------------------------------------------------------------
// Bucati comune
// ---------------------------------------------------------------------------

function contDin(ctx: Ctx) {
  return {
    intrat: !!ctx.utilizator,
    nume: ctx.utilizator ?? 'Cont',
    admin: ctx.eAdmin,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    poateVedeaCa: ctx.poateVedeaCa ?? false,
    veziCa: ctx.veziCa ?? null,
    spre: ctx.spre ?? '',
  }
}

function comune(ctx: Ctx) {
  return {
    nume: 'PROGRAMUL',
    titlu: 'Programul liturgic',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: STIL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
  }
}

/**
 * Intervalul unei saptamani, CAT MAI SCURT (cerere user, 11.09.2026) — pentru butoanele navigarii:
 * „7–13.09" cand cele sapte zile sunt in aceeasi luna (luna se scrie o singura data, la sfarsit) si
 * „28.09–4.10" cand saptamana trece dintr-o luna in alta. Anul nu se scrie: navigarea nu iese din
 * cele trei saptamani de langa azi, deci n-are cum sa fie altul. Luna merge cu zero in fata, ca sa
 * se citeasca a data si nu a numar rupt; ziua, nu — ar fi doua semne in plus degeaba.
 */
function intervalScurt(luni: string): string {
  const [, l1, z1] = luni.split('-').map(Number) as [number, number, number]
  const [, l2, z2] = adaugaZile(luni, 6).split('-').map(Number) as [number, number, number]
  const ll = (l: number) => String(l).padStart(2, '0')
  return l1 === l2 ? `${z1}–${z2}.${ll(l2)}` : `${z1}.${ll(l1)}–${z2}.${ll(l2)}`
}

/**
 * NAVIGAREA — randul de unelte din antet (`.btns` al carcasei). A urcat aici la 10.09.2026, in locul
 * abonarii (cerere user: „schimbă locul dintre «Abonează-te» și «Text» și navigarea săptămânilor…
 * să fie sus, înainte de informații utile").
 *
 * ⚠️ REFACUTA LA 11.09.2026, ora 10. Din cele trei trepte de dinainte (saptamana trecuta · bulina
 * saptamanii de azi · saptamana urmatoare) au ramas DOUA segmente, si niciunul nu mai e o treapta:
 *
 *   - ARHIVA, in locul datelor saptamanii trecute (user: „în loc de textul de la săptămâna trecută,
 *     adică data și intervalul, să punem butonul de arhivă… nu se mai deschide săptămâna trecută.
 *     Se poate selecta din pagina arhivei"). Inapoi nu se mai merge dintr-un pas: se alege din arhiva.
 *     E numai a ADMINILOR (alegere a userului, 11.09.2026, intrebat anume) — deci pentru enorias
 *     pastila are un singur segment, iar istoricul ramane, ca pana acum, al adminilor.
 *   - BULINA saptamanii de azi, fara text (user, 8 sept. 2026: „doar o bulină pe centru"). A iesit la
 *     10:01 si s-a INTORS la 10:47, cand userul a lamurit ca „fără buton în meniu" se referea la ea,
 *     nu la intrerupator: „aș vrea să adaug și bulina înapoi".
 *   - „SĂPTĂMÂNA VIITOARE", scrisa in litere (user: „în antet punem «Săptămâna viitoare»") — dupa ce
 *     pe 11.09, dimineata, ceruse invers: date scurte in loc de cuvinte. Datele au trecut acum in
 *     `title` si `aria-label`, ca omul sa poata vedea DESPRE CARE saptamana e vorba. Segmentul asta ia
 *     si prisosul de latime al pastilei (`.viit`), fiindca e singurul cu scris.
 *
 * Segmentul pe care CHIAR esti nu duce nicaieri: e marcat rosu si ramane apasabil, ca la atingere sa
 * primeasca focusul si sa se vada unde esti; de aceea e `<button aria-disabled>`, nu link stins
 * (`.gol` n-ar primi nici click, nici focus). Bulina rosie inseamna „sunt pe saptamana de azi".
 *
 * Inapoi nu se mai merge dintr-un pas: saptamana trecuta se alege din Arhiva.
 */
function navigarea(ctx: Ctx, m: Meniu): string {
  const p = esc(ctx.prefix)
  const aAzi = luneaSaptamanii(m.azi)
  const urmatoarea = adaugaZile(aAzi, 7)
  const zile = intervalScurt(urmatoarea)
  // Segmentul poarta si CUVINTELE, si SAGEATA; care se vad, alege CSS-ul dupa latime si dupa cati
  // sunt in rand — fara JS, ca la butonul de descarcare. Trei infatisari:
  //   - pe larg, cuvintele singure (ca pana acum);
  //   - pe telefon la ADMIN, doar sageata — randul lui e plin de butoane si altfel se rupe;
  //   - pe telefon la omul fara drepturi, cuvintele SI sageata (user, 11.09.2026, 16:02: „înainte de
  //     săgeată să scrie «Săptămâna următoare»+săgeată") — acolo pastila e singura in rand.
  // Numele accesibil nu se schimba niciodata dupa latime: `aria-label` spune intreg „săptămâna
  // viitoare, <zile>" la toate trei.
  const scris = `<span class="cuv">Săptămâna viitoare</span><span class="sgt">${IC_INAINTE}</span>`
  const viitoare = m.luni === urmatoarea
    ? `<button type="button" class="btn viit activ" aria-disabled="true" aria-current="page"`
      + ` title="Ești pe săptămâna viitoare, ${zile}" aria-label="săptămâna viitoare, ${zile}">${scris}</button>`
    : `<a class="btn viit" href="${p}/saptamana/${urmatoarea}" title="Treci la săptămâna viitoare, ${zile}"`
      + ` aria-label="săptămâna viitoare, ${zile}">${scris}</a>`
  const bulina = m.luni === aAzi
    ? `<button type="button" class="btn punct activ" aria-disabled="true" aria-current="page"`
      + ` title="Ești pe săptămâna de azi" aria-label="săptămâna de azi"></button>`
    : `<a class="btn punct" href="${p}/saptamana/${aAzi}" title="Treci la săptămâna de azi"`
      + ` aria-label="săptămâna de azi"></a>`
  // ⚠️ Pe o saptamana deschisa DIN arhiva, segmentul ramane MARCAT (user, 11.09.2026, 16:24: „să se
  // vadă rămas încercuit butonul pe care am apăsat"), dar ramane si APASABIL — altfel omul ar avea
  // marcajul si n-ar avea drumul. Rosu plin, ca pe pagina arhivei; neapasabil e numai acolo.
  const arhiva = !ctx.eAdmin ? ''
    : m.arhiva
      ? `<button type="button" class="btn arh activ" aria-disabled="true" aria-current="page"`
        + ` title="Ești în arhiva programelor" aria-label="Arhiva programelor">${IC_ARHIVA}</button>`
      : `<a class="btn arh${m.dinArhiva ? ' activ' : ''}" href="${p}/arhiva"`
        + ` title="${m.dinArhiva ? 'Săptămâna asta e deschisă din arhivă — întoarce-te la ea' : 'Arhiva programelor — alege săptămâna'}"`
        + ` aria-label="Arhiva programelor">${IC_ARHIVA}</a>`
  // ⚠️ `larga` = pastila omului FARA drepturi de admin: doua segmente (bulina si „viitoare"), iar in
  // randul de unelte nu mai e nimic in afara de intrerupator. Acolo pastila se intinde cat randul, iar
  // segmentul „viitoare" isi tine si cuvintele (user, 11.09.2026, 16:02). La admin, cu arhiva in
  // pastila si cu hartiile in dreapta, nu incape asa ceva — vezi media query.
  return `<span class="pastila${ctx.eAdmin ? '' : ' larga'}">${arhiva}${bulina}${viitoare}</span>`
}

/**
 * Intrerupatorul „Calendar" — primul din grupul din dreapta. Aprins, aduce langa program coloana zilei
 * liturgice (si schimba, o data cu ea, butonul de descarcare de langa el). Se scrie doar pe saptamana
 * de azi si pe cea viitoare — „ON/OFF are sens doar pe ultima săptămână și pe săptămâna următoare"
 * (user, 10.09.2026; reconfirmat 11.09, intrebat anume) —, fiindca doar acolo calendarul are ce spune.
 *
 * N-are cuvant, ci ICONITA ecranului impartit (user, 11.09.2026: „în loc de cuvântul «calendar», pune
 * iconița"). Becul care aluneca ramane — el spune daca e aprins sau stins; ce face butonul spun
 * `title` si `aria-label`, fiindca o rama despicata singura n-ar zice „calendar".
 */
function intrerupatorCalendar(): string {
  return `<button type="button" class="btn mic com-cal" id="b-calendar" aria-pressed="true"`
    + ` title="Ascunde calendarul zilei" aria-label="Calendarul zilei, lângă program">`
    + `${IC_DOUA_COLOANE}<span class="bec" aria-hidden="true"></span></button>`
}

/**
 * Randul din antet, in doua grupuri (user, 11.09.2026, 10:48). La stanga pastila navigarii, care ia
 * spatiul ramas; la dreapta, lipite de margine, bara verticala si apoi intrerupatorul, descarcarea
 * paginii si hartiile PDF/JPG.
 *
 * Grupul din dreapta se scrie doar daca are ce pune in el: la enorias, pe saptamanile din arhiva,
 * ramane doar pastila si atunci nu se mai deseneaza nici bara.
 */
function unelte(ctx: Ctx, m: Meniu): string {
  const dreapta = (m.calendar ? intrerupatorCalendar() : '') + pozaPaginii(ctx, m) + hartiile(ctx, m)
  return navigarea(ctx, m)
    + (dreapta ? `<span class="unelte-dr"><span class="desparte" aria-hidden="true"></span>${dreapta}</span>` : '')
}

/**
 * CINE VEDE HARTIILE saptamanii, pe DOUA TREPTE (user, 10.09.2026, 19:39): **adminul** doar pe
 * saptamana de acum si pe cea urmatoare — atat cat ii trebuie ca sa scoata foaia de pe usa —, iar
 * **super-adminul** pe TOT istoricul, deci si pe saptamanile vechi si pe pagina Arhivei (unde nicio
 * saptamana nu e in context, deci `m.luni` e null).
 *
 * Regula e a TUTUROR hartiilor din grupul din dreapta: descarcarea paginii, PDF-ul si JPG-ul
 * (user, 11.09.2026). Rutele raman deschise ca pana acum — „totul la liber".
 *
 * ⚠️ Butonul ARHIVEI nu mai trece pe aici. Din 11.09.2026 sta in pastila navigarii si se scrie dupa
 * `ctx.eAdmin` simplu: el nu e o hartie a unei saptamani, deci n-are de ce sa se stinga pe saptamanile
 * vechi — dimpotriva, tocmai acolo e singurul drum inapoi.
 */
function vedeHartiile(ctx: Ctx, m: Meniu): boolean {
  if (!ctx.eAdmin) return false
  if (ctx.eSuperAdmin) return true
  const aAzi = luneaSaptamanii(m.azi)
  return m.luni === aAzi || m.luni === adaugaZile(aAzi, 7)
}

/**
 * HARTIILE saptamanii — PDF de tiparit si JPG de trimis pe WhatsApp, in capatul din dreapta al randului
 * de unelte. ⚠️ Au URCAT aici la 11.09.2026 (user, 10:48: „să urci sus cele două butoane: PDF, JPEG,
 * și să fie aliniate la dreapta"); pana atunci stateau intr-o casuta atarnata sub linia antetului, care
 * a disparut cu totul o data cu mutarea.
 *
 * Fiecare hartie isi poarta ICONITA FELULUI ei (user, 11.09.2026): foaia cu randuri scrise la PDF, foaia
 * cu poza la JPG. Numele scurt ramane langa iconita — aici el ESTE felul fisierului, deci nu se repeta
 * degeaba, iar doua foi cu coltul indoit una langa alta s-ar deosebi greu la 17 px.
 *
 * Se scrie DOAR pentru admini (user, 10.09.2026: „care se văd doar pentru admini") — enoriasul are in
 * antet navigarea si intrerupatorul. Rutele (`/v1/foaie/…`) raman deschise ca pana acum: deocamdata
 * nimic din ce se citeste nu cere cont. Pe pagina Arhivei nicio saptamana nu e in context (`m.foaie` e
 * null), deci hartiile se scriu stinse — asa erau si in casuta.
 */
function hartiile(ctx: Ctx, m: Meniu): string {
  if (!vedeHartiile(ctx, m)) return ''
  const p = esc(ctx.prefix)
  // ⚠️ Numele felului (`.fel`) CADE pe telefon, ca tot randul de unelte sa incapa pe o linie (user,
  // 11.09.2026) — raman iconitele, care sunt desenate anume ca sa se deosebeasca. De aceea numele
  // hartiei se scrie si in `aria-label`: fara el, cu scrisul ascuns, butonul ar ramane fara nume.
  const hartie = (ext: 'pdf' | 'jpg', iconita: string, titlu: string) => (m.foaie
    ? `<a class="btn mic" href="${p}${m.foaie}.${ext}" target="_blank" rel="noopener" title="${titlu}"`
      + ` aria-label="${titlu}">${iconita}<span class="fel">${ext.toUpperCase()}</span></a>`
    : `<span class="btn mic gol" title="Foaia se deschide de pe pagina unei săptămâni cu program validat"`
      + ` aria-label="${titlu} — se deschide de pe pagina unei săptămâni cu program validat">${iconita}<span class="fel">${ext.toUpperCase()}</span></span>`)
  return hartie('pdf', ICOANE.pdf, 'Foaia A4, de tipărit')
    + hartie('jpg', ICOANE.jpg, 'Foaia ca poză, de trimis pe WhatsApp')
}

/**
 * POZA PAGINII — butonul de descarcare de langa intrerupator. Da MEREU EXACT CE SE VEDE PE ECRAN
 * (cerere user, 11.09.2026: „butonul de download… să descarce varianta care se vede"):
 *
 *   - cu intrerupatorul APRINS, iconita e sageata DUBLA si butonul aduce poza pe doua coloane
 *     (`?coloane=2`) — „dacă este dublat, butonul de download își schimbă iconița în două săgeți în
 *     jos și descarcă acea imagine";
 *   - cu el STINS, iconita e sageata SIMPLA si butonul aduce poza pe o singura coloana (`?coloane=1`)
 *     — „dacă este varianta doar cu programul, o singură coloană, doar acea variantă de JPEG".
 *
 * ⚠️ Se scriu AMANDOUA infatisarile, iar CSS-ul o arata pe cea potrivita dupa clasa `cu-calendar` de pe
 * body (vezi `.poza-1`/`.poza-2` din STIL). Asa butonul se schimba in aceeasi clipa cu coloana, fara ca
 * JS-ul intrerupatorului sa stie de el si fara sa apuce sa se vada vreodata semnul care nu trebuie.
 * Unde intrerupatorul nu se scrie (saptamanile din arhiva), `m.calendar` e fals si ramane doar varianta
 * simpla — alta nici nu se poate vedea acolo.
 *
 * Deosebirea de JPG-ul de langa: acela e foaia A4 de pe usa, fotografiata; asta e PAGINA, cu grafica ei.
 * Amandoua pleaca pe WhatsApp, de aceea stau despartite si ca iconita.
 *
 * E tot o hartie a saptamanii, deci se vede dupa ACELEASI DOUA TREPTE ca celelalte (alegerea userului,
 * 11.09.2026): enoriasul si utilizatorul simplu n-o vad deloc.
 */
function pozaPaginii(ctx: Ctx, m: Meniu): string {
  if (!m.luni || !vedeHartiile(ctx, m)) return ''
  const adresa = (coloane: 1 | 2) => `${esc(ctx.prefix)}/v1/poza/saptamana/${esc(m.luni)}.jpg?coloane=${coloane}`
  const buton = (clasa: string, href: string, spune: string, iconita: string) =>
    `<a class="btn mic ${clasa}" href="${href}" target="_blank" rel="noopener"`
    + ` title="${spune}" aria-label="${spune}">${iconita}</a>`
  const simplu = buton('poza-1', adresa(1), 'Pagina ca poză (JPEG) — programul, într-o coloană', IC_DESCARCA)
  if (!m.calendar) return simplu
  return simplu
    + buton('poza-2', adresa(2), 'Pagina ca poză (JPEG) — programul și calendarul, în două coloane', IC_DESCARCA_DUBLU)
}

/**
 * Antetul intreg al paginilor de om: randul de unelte (cu amandoua grupurile) si JS-ul intrerupatorului.
 * Slotul `subantet` a ramas gol de la 11.09.2026 — hartiile au urcat in rand, iar casuta a disparut.
 */
function antetul(ctx: Ctx, m: Meniu) {
  return { unelte: unelte(ctx, m), scripturi: SCRIPT }
}

/** „Luni, 7 septembrie" — cu majuscula, ca in V1. */
function numeleZilei(data: string): string {
  const [, l, z] = data.split('-').map(Number) as [number, number, number]
  const zi = ZILE_SAPTAMANA[ziuaSaptamanii(data)] ?? ''
  return `${zi.charAt(0).toUpperCase()}${zi.slice(1)}, ${z} ${LUNI[l - 1] ?? ''}`
}

/**
 * Butonul de la duminica, aliniat la dreapta numelui zilei (cerere user, 9 sept. 2026): foaia cu sfintii
 * zilei, de tiparit — se citeste la sfarsitul Sfintei Liturghii. Scrie „[iconita PDF] Sfinții zilei":
 * ce fel de fisier e spune iconita, nu inca trei cuvinte langa numele zilei. Din 11.09.2026 poarta
 * ACEEASI iconita ca butonul PDF al saptamanii (`ICOANE.pdf`, cerere user) — inainte era foaia goala,
 * care nu spunea ce iese din ea.
 *
 * DOAR PENTRU ADMINI, de la 11.09.2026 (user: „nici butonul «Sfinții Zilei» să nu se vadă pentru un
 * utilizator simplu sau neautentificat"). E o hartie de tiparit, ca celelalte, si tine de treaba celui
 * care pregateste slujba. Ruta `/v1/sfintii-zilei/<data>.pdf` ramane deschisa — „totul la liber".
 *
 * A fost scos o jumatate de ora la 10.09.2026 („mă mai gândesc unde îi punem") si pus la loc in acelasi
 * loc, la cererea userului. Regula lui: se scrie doar pe duminicile din ANUL IN CURS — in alti ani
 * zilele sunt imprumutate din anul curent si foaia n-ar avea ce tipari.
 */
const butonSfintii = (ctx: Ctx, data: string) =>
  (!ctx.eAdmin ? '' : `<a class="btn sfintii" href="${esc(ctx.prefix)}/v1/sfintii-zilei/${data}.pdf" target="_blank" rel="noopener"`
    + ` title="Sfinții zilei, fișier PDF — de tipărit și citit la sfârșitul Sfintei Liturghii">`
    + `${ICOANE.pdf}<span>Sfinții zilei</span></a>`)

/**
 * Calendarul zilei de la A1, in coloana din dreapta: SFINTII, unul sub altul, cu sageata in fata —
 * ca randurile „→" ale slujbelor (cerere user, 10.09.2026). Deasupra lor, cand ziua are nume
 * (duminica, praznic), sta denumirea ei, rosie si ingrosata, ca in program.
 *
 * NU se scriu titlul intreg al calendarului (`titlu_html`), pericopele (Ap./Ev.), glasul si
 * voscreasna — „scoate-le, păstrând doar sfinții zilei" (user). De aceea lista se face din campurile
 * zilei (`denumire` + `sfinti`), nu din titlul gata asezat, care le tine pe toate la un loc.
 * Semnul din calendarul tiparit ((†), †), †) ramane in fata numelui, iar rosul si albastrul sunt ale
 * rangului, sfant cu sfant — ca in calendarul A1.
 *
 * Sub ele: notele calendarului (rare) si semnul ca ziua e imprumutata dintr-un an de reper — acela
 * nu se ascunde, ca sa nu treaca o zi aproximativa drept sigura.
 */
/** Ziua are ce arata in coloana calendarului: numele ei ori macar un sfant. */
const areCalendar = (z: ZiPeProgram | undefined): boolean => !!z && (!!z.denumire || z.sfinti.length > 0)

function calendarulZilei(z: ZiPeProgram | undefined, data: string): string {
  if (!z) return ''
  const randuri: string[] = []
  if (z.denumire) randuri.push(`<p class="det rosu">${esc(z.denumire)}</p>`)
  for (const s of z.sfinti) {
    const clasa = s.rang === 'cruce_albastra' ? ' c-albastru'
      : s.rang === 'praznic_imparatesc' || s.rang === 'cruce_rosie' ? ' c-rosu' : ''
    randuri.push(`<p class="det${clasa}">${esc(`${s.semn ? `${s.semn} ` : ''}${s.nume}`)}</p>`)
  }
  if (!randuri.length) return ''
  const rand = [
    ...(z.note ?? []).map(esc),
    z.aproximativ ? `<i>calendar împrumutat din anul curent — aproximativ</i>` : '',
  ].filter(Boolean).join(' · ')
  if (rand) randuri.push(`<p class="cal-rand">${rand}</p>`)
  // Capul coloanei: numele zilei, la fel ca in stanga si pe aceeasi linie cu el (cerere user,
  // 10.09.2026: „ca să fie și titlu deasupra fiecărei liste chiar dacă se repetă"). Repetitia e
  // pentru ochi, deci pentru cititoarele de ecran ramane ascunsa — titlul zilei e deja in stanga.
  return `<div class="cal">
  <p class="cal-zi" aria-hidden="true">${numeleZilei(data)}</p>
  ${randuri.join('\n  ')}
</div>`
}

/** O slujba: ora, numele (colorat dupa categorie), randurile „→" (rosii la duminica si la sarbatorile cu rosu). */
function slujbaHtml(s: Slujba, vocabular: Map<string, IntrareVocabular>, zi: ZiPeProgram | undefined, maine: ZiPeProgram | undefined, dinCalendar: boolean, granita: string): string {
  const categorie = vocabular.get(s.cod_nume)?.categorie
  const randuri = randurileSlujbei(s, categorie, zi, maine, dinCalendar, granita)
  const det = randuri.map((r) => `<p class="det${r.rosu ? ' rosu' : ''}">${esc(r.text)}</p>`).join('')
  const slujitor = s.slujitor ? `<p class="det">${esc(s.slujitor)}</p>` : ''
  return `<div class="slujba"><span class="ora">${esc(s.ora)}</span><span class="nume ${esc(categorie ?? 'alte')}">${esc(s.nume)}</span>${det}${slujitor}</div>`
}

/**
 * O zi: la stanga PROGRAMUL ei (capul zilei — numele, iar duminica butonul „Sfinții zilei" — si slujbele),
 * la dreapta coloana calendarului, ascunsa pana se aprinde intrerupatorul. Ziua e rosie duminica si la
 * praznice / sfinti cu cruce rosie, dupa rangul de la calendar. Ziua fara nicio slujba (`goala`) sta in
 * pagina doar ca sa-si arate calendarul; `ultima` = ultima zi CU slujbe, care incheie programul cand
 * calendarul e stins.
 *
 * In zilele fara slujbe coloana din stanga ramane GOALA de tot — fara numele zilei (user, 10.09.2026:
 * „nu mai pune titlu în spațiile goale unde nu sunt slujbe; lasă gol"). Numele zilei se vede oricum,
 * in capul listei de sfinti din dreapta.
 */
function ziuaHtml(o: {
  ctx: Ctx
  data: string
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  cal: CalendarSaptamana | null
  dinCalendar: boolean
  granita: string
  azi: string
  ultima: boolean
  /** se scrie si coloana calendarului — numai pe saptamana de acum si pe cea urmatoare */
  cuCalendar: boolean
}): string {
  const z = o.cal?.zile.get(o.data)
  const maine = o.cal?.zile.get(adaugaZile(o.data, 1))
  const zs = ziuaSaptamanii(o.data)
  const duminica = zs === 0
  const rosie = duminica || (!!z && ziRosie(z))
  // ⚠️ ZILELE ROSII CU SLUJBE NU SE MAI IMPART IN DOUA (user, 11.09.2026: „la vizualizarea dublată a
  // zilei de duminică să nu se mai afișeze text deloc în partea dreaptă… la fel și la sărbătorile cu
  // cruce roșie, care în mod sigur deja au slujba setată"). Programul lor spune deja sarbatoarea si
  // sfintii, pe randurile „→" ale slujbei de dimineata — coloana calendarului ar scrie a doua oara
  // acelasi lucru. Pana acum regula era doar pe telefon (ascunsa din CSS); acum coloana nici nu se mai
  // scrie, iar ziua ia toata latimea (clasa `fara-cal`). Se vede la fel in pagina si in POZA.
  // Zilele rosii FARA slujbe raman impartite: acolo calendarul e singurul care spune ce zi e.
  const cuCal = o.cuCalendar && !(rosie && o.slujbe.length > 0)
  const clase = ['zi', o.data === o.azi ? 'azi' : '', rosie ? 'rosie' : '',
    o.slujbe.length ? '' : 'goala', o.cuCalendar && !cuCal ? 'fara-cal' : '',
    o.ultima ? 'ultima' : ''].filter(Boolean).join(' ')
  const randuri = o.slujbe.map((s) => slujbaHtml(s, o.vocabular, z, maine, o.dinCalendar, o.granita)).join('\n')
  // „Sfinții zilei" numai duminica si numai in anul in curs (vezi butonSfintii); in zilele fara slujbe
  // nu se scrie nici capul zilei, deci nici butonul.
  const anulAcesta = o.data.slice(0, 4) === o.azi.slice(0, 4)
  const cap = o.slujbe.length
    ? `<div class="zi-cap"><h3>${numeleZilei(o.data)}</h3>${duminica && anulAcesta ? butonSfintii(o.ctx, o.data) : ''}</div>`
    : ''
  return `<section class="${clase}" id="z${o.data}">
  <div class="prog">
    ${cap}
    ${randuri}
  </div>
  ${cuCal ? calendarulZilei(z, o.data) : ''}
</section>`
}

// ---------------------------------------------------------------------------
// Pagina saptamanii — programul scris sau propunerea lui, aceeasi asezare
// ---------------------------------------------------------------------------

export interface OptiuniSaptamana {
  ctx: Ctx
  luni: string
  titlu: string
  stare: StareSaptamana | 'propunere'
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  cal: CalendarSaptamana | null
  dinCalendar: boolean
  azi: string
  meniu: Meniu
  nelamuriri?: string[]
}

/**
 * Cele sapte zile ale saptamanii, gata scrise. Sta deoparte fiindca o cer amandoua: si pagina, si
 * POZA ei (`pozaSaptamaniiHtml`) — poza trebuie sa arate exact ce arata pagina, deci zilele nu se
 * scriu a doua oara, altfel cele doua ar incepe sa se departeze una de alta.
 */
function zileleSaptamanii(o: {
  ctx: Ctx
  luni: string
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  cal: CalendarSaptamana | null
  dinCalendar: boolean
  azi: string
  cuCalendar: boolean
}): string[] {
  const duminica = adaugaZile(o.luni, 6)
  const ultima = [...new Set(o.slujbe.map((s) => s.data))].sort().pop() ?? null
  const zile: string[] = []
  for (let i = 0; i < 7; i++) {
    const data = adaugaZile(o.luni, i)
    const ale = o.slujbe.filter((s) => s.data === data)
    // o zi goala se scrie doar cat timp are calendar de aratat — altfel n-ar avea ce
    if (!ale.length && !(o.cuCalendar && areCalendar(o.cal?.zile.get(data)))) continue
    zile.push(ziuaHtml({ ctx: o.ctx, data, slujbe: ale, vocabular: o.vocabular, cal: o.cal, dinCalendar: o.dinCalendar, granita: duminica, azi: o.azi, ultima: data === ultima, cuCalendar: o.cuCalendar }))
  }
  return zile
}

export function paginaSaptamana(o: OptiuniSaptamana): string {
  // Calendarul se poate aprinde pe saptamana de azi si pe cea viitoare (alegerea userului, 11.09.2026,
  // 10:47, intrebat anume). Pe saptamanile din arhiva nu se scrie nici intrerupatorul, nici coloana lui;
  // zilele raman insa colorate dupa calendar (rosul sarbatorilor) si randurile „→" ale slujbelor sunt
  // tot de acolo. `cuCalendar` inseamna „coloana STA in pagina", nu „se vede": aprinsul e al omului.
  const aAzi = luneaSaptamanii(o.azi)
  const cuCalendar = o.luni === aAzi || o.luni === adaugaZile(aAzi, 7)
  const zile = zileleSaptamanii({ ...o, cuCalendar })
  // Eticheta de langa titlu spune doar ce NU e gata: „propunere" (si, daca s-ar ivi, „propus" ori
  // „modificat după validare"). Pe programul validat nu se mai scrie nimic — user, 10.09.2026:
  // „scoate eticheta Validat… lasă doar Propunere la săptămâna următoare. Este util."
  const clasaStare = o.stare === 'propunere' ? 'propus' : o.stare
  const eticheta = o.stare === 'validat' ? ''
    : `<span class="stare ${esc(clasaStare)}">${esc(STARE[o.stare] ?? o.stare)}</span>`
  // ⚠️ PROBA (11.09.2026) — MOMENTUL, scris in pagina deasupra datelor: „săptămâna trecută / aceasta /
  // viitoare". Paginile arata acelasi lucru in momente diferite, iar pana acum singurul semn al
  // momentului era in antet, pe butonul rosu. Se scrie doar pe cele trei saptamani de langa azi; pe
  // restul, venite din arhiva, ramane doar titlul. Rosu la „aceasta", ca sa se lege de rosul din pastila.
  // „Viitoare", nu „următoare": acelasi cuvant cu butonul din antet (user, 11.09.2026, ora 10).
  const moment = o.luni === aAzi ? 'Săptămâna aceasta'
    : o.luni === adaugaZile(aAzi, -7) ? 'Săptămâna trecută'
    : o.luni === adaugaZile(aAzi, 7) ? 'Săptămâna viitoare'
    : ''
  // ⚠️ ÎNAPOI LA ARHIVĂ (user, 11.09.2026, 16:24: „un buton de back în partea de sus care să fie
  // back-ul de la browser"). Se scrie doar pe saptamanile deschise din arhiva. E LINK adevarat catre
  // pagina arhivei, iar JS-ul il face sa dea pasul inapoi al browserului cand chiar de acolo s-a venit
  // — asa arhiva se redeschide unde a ramas omul, derulata la anul si luna pe care le rasfoia, nu de
  // sus. Fara JS, ori intrat de-a dreptul pe adresa, linkul duce cinstit la /arhiva.
  const inapoi = o.meniu.dinArhiva
    ? `<p class="rand-inapoi"><a class="inapoi" id="b-inapoi" href="${esc(o.ctx.prefix)}/arhiva">${IC_INAPOI}Înapoi la arhivă</a></p>`
    : ''
  const cap = `${inapoi}<div class="sapt-cap"><div>${moment ? `<span class="moment${o.luni === aAzi ? ' acum' : ''}">${moment}</span>` : ''}<h2>${esc(o.titlu)}</h2></div>${eticheta}</div>`
  const gol = o.slujbe.length ? '' : `<p class="gol">${o.stare === 'propunere' ? 'Nimic de propus — istoricul nu spune nimic despre această săptămână.' : 'Săptămână fără slujbe înregistrate.'}</p>`
  const nelamuriri = o.nelamuriri?.length
    ? `<div class="nelamuriri"><b>Nelămuriri</b><ul>${o.nelamuriri.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`
    : ''
  const meniu: Meniu = { ...o.meniu, luni: o.luni, calendar: cuCalendar }
  return pagina({
    ...comune(o.ctx),
    titluPagina: o.stare === 'propunere' ? `Propunere · ${o.titlu}` : o.titlu,
    indexabil: true,
    // Intrerupatorul porneste APRINS (user, 11.09.2026), deci coloana calendarului sta pe pagina de la
    // server, nu de la JS: altfel s-ar vedea o clipa pagina pe o coloana, apoi ar sari in doua. JS-ul
    // scoate clasa numai daca omul a stins intrerupatorul cu mana lui.
    clasaCorp: cuCalendar ? 'cu-calendar' : '',
    ...antetul(o.ctx, meniu),
    corp: `${cap}${gol}${zile.join('\n')}
${nelamuriri}`,
  })
}

// ---------------------------------------------------------------------------
// Poza saptamanii — pagina cu cele doua coloane, fotografiata
// ---------------------------------------------------------------------------

/**
 * Latimea pozei, in puncte CSS: exact masura paginii (`.w` din carcasa, 680 px), ca poza sa iasa leit
 * cu ce se vede pe ecran — aceleasi coloane, de aceeasi latime, nu o asezare facuta anume pentru
 * poza. Fotografia se face la doi pixeli pe punct, deci fisierul iese de 1360 px.
 *
 * Aceeasi masura la amandoua variantele, si la cea pe o coloana: poza trebuie sa fie pagina, iar
 * pagina are latimea asta oricum ar fi asezata inauntru. Ingustand-o la varianta simpla, randurile
 * s-ar rupe altfel decat pe ecran si cele doua poze n-ar mai arata a acelasi lucru.
 */
export const LATIME_POZA = 680

export interface OptiuniPoza {
  ctx: Ctx
  luni: string
  titlu: string
  stare: StareSaptamana | 'propunere'
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  cal: CalendarSaptamana | null
  dinCalendar: boolean
  azi: string
  /** tema pozei; implicit cea de ZI, ca la poza calendarului (user, 11.09.2026) */
  tema?: 'dark' | 'light'
  /**
   * Cu coloana calendarului langa program (implicit) sau doar programul, pe o coloana. Butonul din
   * antet cere varianta care se vede pe ecranul de sub el (user, 11.09.2026): pe prima pagina cea
   * dublata, pe celelalte saptamani cea simpla.
   */
  cuCalendar?: boolean
}

/**
 * POZA SAPTAMANII — pagina intreaga, gata de trimis (cerere user, 11.09.2026: „un JPEG și cu calendarul
 * împărțit, adică așa cum se vede când este întrerupătorul Calendar pe On").
 *
 * Are DOUA VARIANTE, si amandoua sunt PAGINA, nu o asezare facuta anume pentru poza: aceeasi
 * `zileleSaptamanii`, acelasi stil (`STIL_COMUN` + `STIL`), aceeasi latime. Se deosebesc doar prin
 * clasa `cu-calendar` de pe `body` — pusa din capul locului, ca in pagina (de la 11.09.2026 nici acolo
 * nu mai vine din JS). Ce cade sunt doar lucrurile care se apasa: antetul, subsolul, navigarea, butonul
 * „Sfinții zilei" (nici n-ajunge sa se scrie: poza cere pagina cu `eAdmin: false`).
 *
 * Varianta se CERE, nu se ghiceste din saptamana: poza trebuie sa iasa la fel ori de unde ar fi ceruta,
 * iar cine o cere (butonul din antet) stie deja ce are pe ecran. Cu `cuCalendar`, zilele fara slujbe
 * apar sau nu — exact ca in pagina. Daca A1 n-are zilele cerute, coloana ramane goala si poza dublata
 * se vede ca una simpla, cu o dunga pe dreapta.
 *
 * Capul e cel al pozei calendarului (numele aplicatiei, parohia, saptamana), ca cele doua poze ale
 * aceleiasi saptamani sa se recunoasca una pe alta pe WhatsApp. Tema e tot a ei: FUNDAL DESCHIS
 * (user, 11.09.2026: „toate generările de imagini să fie cu fundal deschis, deci nu dark. M-am
 * răzgândit" — pe 10.09 ceruse invers, ca albul sa nu bata la ochi pe telefon). Se scrie pe html, nu
 * se lasa la voia telefonului care o priveste; `?tema=dark` ramane, pentru cine vrea sa vada cum ar fi.
 *
 * Latimea nu se ia dupa telefon, ca la calendar (450 px): la 680 de puncte incap cele doua coloane —
 * sub 600 px stilul paginii le pune oricum una sub alta, si atunci s-ar pierde tocmai „impartirea"
 * ceruta.
 */
export function pozaSaptamaniiHtml(o: OptiuniPoza): string {
  const cuCalendar = o.cuCalendar !== false
  const zile = zileleSaptamanii({ ...o, cuCalendar })
  // ca in pagina: se scrie doar ce NU e gata („propunere"), programul validat nu poarta eticheta
  const clasaStare = o.stare === 'propunere' ? 'propus' : o.stare
  const eticheta = o.stare === 'validat' ? ''
    : `<p class="et"><span class="stare ${esc(clasaStare)}">${esc(STARE[o.stare] ?? o.stare)}</span></p>`
  return `<!doctype html><html lang="ro" data-tema="${o.tema === 'dark' ? 'dark' : 'light'}"><head><meta charset="utf-8">
<title>Programul liturgic · ${esc(o.titlu)}</title>
<style>${STIL_COMUN}${STIL}
body { margin:0; padding:0; background:var(--paper); color:var(--ink) }
.poza { width:${LATIME_POZA}px; box-sizing:border-box; padding:22px 20px 26px; background:var(--paper) }
.poza .cap { text-align:center; margin:0 0 4px }
/* numele aplicatiei, mare, ca in antetul paginilor; sub el parohia, apoi saptamana (ca la calendar) */
.poza .cap .nume { font:400 32px/1.05 "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
                   letter-spacing:.04em; margin:0 }
.poza .cap .parohia { font:600 10px/1.4 ui-sans-serif,system-ui; letter-spacing:.16em;
                      text-transform:uppercase; color:var(--faint); margin:5px 0 0 }
.poza .cap h1 { font-size:20px; font-weight:400; margin:12px 0 0; letter-spacing:-.01em }
.poza .cap .et { margin:10px 0 0 }
.poza .cap .rand { border-top:1px solid var(--rule); margin:12px 0 0 }
/* in poza nimic nu se apasa: butonul foii cu sfintii zilei n-are ce cauta (paza buna — pagina i se
   cere oricum fara drepturi de admin, deci nici nu se scrie) */
.poza .sfintii { display:none }
/* Ziua de azi NU se marcheaza, ca la poza calendarului (user, 10.09.2026): poza pleaca pe WhatsApp si
   e privita si peste trei zile — un semn „azi" ar minti. Pe pagina, unde se vede acum, ramane. */
.poza .zi.azi h3::after { content:none }
/* ultima zi n-are linie dedesubt: poza se termina cu scrisul, nu cu o dunga in aer */
.poza .zi:last-child { border-bottom:0; padding-bottom:0 }
</style></head><body${cuCalendar ? ' class="cu-calendar"' : ''}>
<div class="poza">
  <header class="cap">
    <p class="nume">PROGRAMUL</p>
    <p class="parohia">${esc(PAROHIA)}</p>
    <h1>${esc(o.titlu)}</h1>
    ${eticheta}
    <div class="rand"></div>
  </header>
  ${zile.join('\n  ')}
</div>
</body></html>`
}

// ---------------------------------------------------------------------------
// Arhiva: un singur an pe ecran, saptamanile grupate pe luni, luna = baton segmentat egal
// ---------------------------------------------------------------------------

export interface RezumatArhiva {
  luni: string
  duminica: string
  stare: StareSaptamana
  nr_slujbe: number
}

export function perioadaScurta(luni: string, duminica: string): string {
  const [, l1, z1] = luni.split('-').map(Number) as [number, number, number]
  const [, l2, z2] = duminica.split('-').map(Number) as [number, number, number]
  if (l1 === l2) return `${z1} – ${z2}`
  return intervalLizibil(luni, duminica).replace(/\s\d{4}$/, '')
}

export function paginaArhiva(o: { ctx: Ctx; an: number; ani: number[]; saptamani: RezumatArhiva[]; total: number; deLa: string | null; meniu: Meniu }): string {
  const p = esc(o.ctx.prefix)
  // anii DESCRESCATOR (cel de care e nevoie mereu, primul); anul ales ramane link (a.acum), se poate apasa
  const butoane = o.ani.length ? `<nav class="capitole">${o.ani.map((a) => `<a${a === o.an ? ' class="acum"' : ''} href="?an=${a}">${a}</a>`).join('')}</nav>` : ''
  const peLuni = new Map<number, RezumatArhiva[]>()
  for (const s of [...o.saptamani].sort((a, b) => a.luni.localeCompare(b.luni))) {
    const l = Number(s.luni.slice(5, 7))
    const lista = peLuni.get(l) ?? []
    lista.push(s)
    peLuni.set(l, lista)
  }
  // lunile de la cea mai noua; in baton saptamanile merg INAINTE (3–9, 10–16, …), ca o fasie de calendar
  const luni = [...peLuni.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([l, lista]) => {
      const nume = LUNI[l - 1] ?? ''
      const zone = lista
        // ⚠️ `?din=arhiva` spune paginii saptamanii de unde a fost deschisa: de acolo ies butonul
        // „Înapoi la arhivă" si marcajul ramas pe segmentul Arhivei (user, 11.09.2026, 16:24).
        .map((s) => `<a href="${p}/saptamana/${s.luni}?din=arhiva"><b>${esc(perioadaScurta(s.luni, s.duminica))}</b>`
          + `<span>${s.nr_slujbe} ${s.nr_slujbe === 1 ? 'slujbă' : 'slujbe'}</span>`
          + (s.stare === 'validat' ? '' : `<i>${esc(STARE[s.stare] ?? s.stare)}</i>`) + `</a>`)
        .join('')
      return `<h4>${nume.charAt(0).toUpperCase()}${nume.slice(1)}</h4><div class="baton">${zone}</div>`
    })
    .join('\n')
  const bloc = `<section class="an"><h3>${o.an} <small>· ${o.saptamani.length} săptămâni</small></h3>
${luni || '<p class="gol">Niciun program în anul acesta.</p>'}</section>`
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Arhiva',
    ...antetul(o.ctx, { ...o.meniu, arhiva: true }),
    corp: `<h2>Arhiva</h2>
<p class="marunt">${o.total} săptămâni, din ${o.deLa ? esc(o.deLa.slice(0, 4)) : '—'} până azi.</p>
${butoane}
${bloc}`,
  })
}

/**
 * Pagina de mesaj (adresa gresita, refuz, eroare). Cu `meniu`, poarta antetul intreg al paginilor de om,
 * ca in V1; fara `mesaj`, ramane doar titlul si cele doua linkuri (pagina „Nu există", ca in V1).
 */
export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string, fel: 'rea' | 'buna' | 'info' = 'info', meniu?: Meniu): string {
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    ...(meniu ? antetul(ctx, meniu) : {}),
    corp: `<h2>${esc(titlu)}</h2>${mesaj ? alerta(fel, esc(mesaj)) : ''}<p><a href="${esc(ctx.prefix)}/">Programul săptămânii</a> · <a href="${esc(ctx.prefix)}/arhiva">Arhiva</a></p>`,
  })
}
