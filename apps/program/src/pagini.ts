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
 * Antetul, refacut la 10.09.2026 (cerere user — navigarea si abonarea si-au schimbat locul):
 *   - pe randul de unelte (`.btns` al carcasei) sta NAVIGAREA saptamanii — sageata dinainte, bulina,
 *     sageata urmatoarea — iar in capat, dupa o liniuta verticala, intrerupatorul „Calendar" (on/off),
 *     care a luat locul meniului „Informații utile" (avea oricum o singura functie);
 *   - ABONAREA a iesit cu totul, momentan („abonează-te iese de tot momentan", user 10.09, 17:01).
 *     Rutele `POST /abonare` · `/dezabonare` si audienta comunicarii raman intacte — se readuce
 *     doar bucata de interfata;
 *   - in casuta atarnata sub linia antetului (`navJos`, slotul `subantet`) raman doar hartiile
 *     saptamanii — Arhiva, PDF, JPG — si numai pentru ADMINI (user, 10.09, 17:01).
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
  /** pagina deschisa e Arhiva (butonul ei ramane aprins) */
  arhiva?: boolean
  /**
   * Calendarul se poate aprinde pe pagina asta — adica saptamana de pe ecran e una dintre cele trei
   * ale navigarii (trecuta, de azi, urmatoare). Cat tine navigarea, tine si calendarul (user,
   * 10.09.2026: „să fie permanent afișat dacă este on pe tot ce este afișat în pagină").
   * Fals => nici intrerupatorul, nici coloana calendarului nu se scriu.
   */
  calendar?: boolean
}

const STARE: Record<string, string> = {
  validat: 'validat',
  propus: 'propus',
  modificat_dupa_validare: 'modificat după validare',
  propunere: 'propunere',
}

/** Iconita descarcarii: sageata in jos peste o talpa — pentru poza calendarului (user, 10.09.2026). */
const IC_DESCARCA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></svg>`

/**
 * Aceeasi descarcare, dar cu DOUA sageti una langa alta, pe aceeasi talpa — pentru poza ecranului
 * impartit (user, 11.09.2026: „în felul ăsta diferă de iconița din stânga și seamănă mai mult cu ce
 * urmează să vadă omul"). Doua sageti = doua coloane: semnul spune si ce face butonul (descarca), si
 * ce iese din el. Talpa e aceeasi (`M4 20h16`), ca cele doua butoane vecine sa se vada din aceeasi
 * familie; sagetile sunt construite ca cea singura — tija pana la 14, varful la 15.
 *
 * Masurile sunt stranse dinadins: fiecare sageata e mai ingusta decat cea singura (±2,8 in loc de ±5),
 * iar cele doua stau la 4 unitati una de alta. La prima incercare erau mai late si varfurile lor se
 * atingeau: la 17 px, cu capete rotunde, cele doua sageti se citeau ca un singur „W".
 */
const IC_DESCARCA_DUBLU = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.2 4.5v9.5"/><path d="m4.4 12.2 2.8 2.8 2.8-2.8"/><path d="M16.8 4.5v9.5"/><path d="m14 12.2 2.8 2.8 2.8-2.8"/><path d="M4 20h16"/></svg>`

/**
 * Iconita ECRANULUI IMPARTIT: o rama despicata in doua, cu cate un rand scris in fiecare jumatate —
 * programul la stanga, calendarul la dreapta. E semnul INTRERUPATORULUI „Calendar", in locul cuvantului
 * (user, 11.09.2026): butonul chiar asta face, imparte ecranul in doua. A stat o jumatate de ora pe
 * butonul pozei, de unde userul a mutat-o aici.
 *
 * MAI MARE decat celelalte — 21 px fata de 17 (user, 11.09.2026: „un pic mai mare; nu se înțelege ce
 * este acolo"). Desenul are inauntru rama, despicatura si patru randuri scurte: la 17 px toate astea
 * se faceau o pata. Randurile sunt acum egale si mai lungi, ca sa se citeasca a doua coloane de scris,
 * si trasatura ceva mai groasa. Restul iconitelor raman cum erau — asta una singura trebuie inteleasa
 * dintr-o ochire, fiindca e singurul buton care schimba pagina sub ochii omului.
 */
const IC_DOUA_COLOANE = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M12 4.5v15"/><path d="M5.6 9.2h3.6M5.6 13h3.6M14.8 9.2h3.6M14.8 13h3.6"/></svg>`

/** Iconita Arhivei: cutie cu capac — exact cea din V1 (18px, cu manerul desenat separat). */
const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`

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
.stare { font:600 10.5px/1 ui-sans-serif,system-ui; letter-spacing:.12em; text-transform:uppercase;
         padding:5px 9px; border-radius:999px; border:1px solid var(--rule); color:var(--soft); white-space:nowrap }
.stare.validat { border-color:var(--azi); color:var(--ink); background:var(--azi-fund) }
.stare.propus { border-color:var(--albastru); color:var(--albastru) }

/* ANTETUL, refacut la 10.09.2026 (cerere user): pe randul de unelte (.btns al carcasei) a URCAT la loc
   NAVIGAREA saptamanii, in locul abonarii — care a iesit momentan cu totul — iar in capat, dupa o liniuta
   verticala, sta intrerupatorul „Calendar". Sub linia antetului, in .nav-jos, au ramas doar hartiile
   saptamanii, si numai pentru admini. Regulile scrise pe .btns tin de amandoua: casuta de jos poarta
   aceeasi clasa dinadins, ca sa nu se scrie de doua ori acelasi lucru. */
/* V2: carcasa comuna lasa .btns sa se rupa (flex-wrap:wrap); in V1 randul nu se rupea pe desktop —
   sagetile se string, nu sar pe randul urmator. Pe telefon se rupe (mai jos). */
.btns { flex-wrap:nowrap }
.btns .gol { opacity:.35; pointer-events:none }
/* treapta pe care CHIAR esti (aria-disabled): nu duce nicaieri, dar se apasa — atunci ia focusul si
   ramane ea marcata, ca sa se vada unde ne aflam (cerere user, 10.09.2026). Marginea rosie o are din
   clasa .activ; la apasare se adauga si fundalul, ca apasarea sa se simta. */
.btns .btn[aria-disabled="true"] { cursor:default }
.btns .btn[aria-disabled="true"]:focus { outline:none; background:var(--azi-fund) }
/* INTRERUPATORUL „Calendar" (user, 10.09.2026: „informații utile să fie «Calendar» și să fie un
   întrerupător on-off") — a luat locul meniului „Informații utile", care avea oricum o singura functie.
   E un buton adevarat, cu bec care aluneca: aprins = calendarul se vede in coloana din dreapta.
   Cere JS (ca si meniul de dinainte); fara el ramane stins, iar programul se citeste ca si pana acum. */
.btns .com-cal { cursor:pointer; gap:8px }
.btns .com-cal .bec { flex:none; position:relative; width:30px; height:16px; border-radius:999px;
                      border:1px solid var(--rule); background:var(--tinta) }
.btns .com-cal .bec::after { content:""; position:absolute; top:1px; left:1px; width:12px; height:12px;
                             border-radius:50%; background:var(--soft) }
.btns .com-cal[aria-pressed="true"] { border-color:var(--rosu); color:var(--rosu) }
.btns .com-cal[aria-pressed="true"] .bec { border-color:var(--rosu); background:var(--azi-fund) }
.btns .com-cal[aria-pressed="true"] .bec::after { left:auto; right:1px; background:var(--rosu) }
/* HARTIILE saptamanii: casuta atarna de linia antetului (.sus e sticky, deci pozitionat — ii e si
   bloc de referinta), centrata, cu colturile de sus DREPTE si cele de jos rotunde (cerere user,
   9 sept. 2026). N-are chenar sus: linia antetului ii tine loc de capac. Din 10.09.2026 o vad
   doar adminii — pentru ceilalti nu se scrie deloc, si atunci nici pagina n-are de ce sa-i faca loc. */
.nav-jos { position:absolute; left:50%; top:calc(100% + 1px); transform:translateX(-50%); z-index:5 }
.nav-jos .cutie { margin:0; padding:7px 12px 8px; max-width:calc(100vw - 24px);
                  background:var(--paper); border:1px solid var(--rule); border-top:0;
                  border-radius:0 0 12px 12px; box-shadow:0 8px 18px rgba(0,0,0,.07) }
/* casuta e cat continutul ei, nu cat randul: butoanele nu mai cresc si nu-si mai rup cuvintele
   in doua (in antet crescusera, ca sa umple randul — aici randul e al casutei) */
.nav-jos .btn { flex:0 0 auto; white-space:nowrap; padding-left:14px; padding-right:14px }
/* casuta pluteste peste inceputul paginii — ii face loc, dar numai cand exista (adica la admini) */
body:has(.nav-jos) main { padding-top:34px }
.btns .btn { min-width:0 }
/* bulina din mijloc (user, 8 sept. 2026: „doar o bulină pe centru"): un punct, fara text, la fel de inalta
   ca sagetile; duce la saptamana de azi */
.btns .punct { flex:0 0 auto; display:flex; align-items:center; justify-content:center; padding-left:20px; padding-right:20px }
.btns .punct::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.btns .punct:hover { color:var(--rosu); border-color:var(--rosu) }
/* PASTILA navigarii (aleasa de user, 11.09.2026): cele trei trepte lipite intr-un singur corp, ca sa
   se citeasca drept UN obiect cu o pozitie, nu trei destinatii deosebite. Chenarul si rotunjirea stau
   pe pastila, nu pe butoane; intre segmente ramane o linie de 1 px, iar segmentul pe care esti e PLIN. */
.btns .pastila { display:flex; flex:0 0 auto; border:1px solid var(--rule); border-radius:10px;
                 background:var(--tinta); overflow:hidden }
.btns .pastila .btn { flex:0 0 auto; border:0; border-radius:0; background:transparent }
.btns .pastila .btn + .btn { border-left:1px solid var(--rule) }
.btns .pastila a.btn:hover { color:var(--rosu); background:var(--paper) }
.btns .pastila .btn.activ { color:var(--rosu); font-weight:600;
                            background:color-mix(in srgb, var(--rosu) 11%, transparent) }
.btns .pastila .btn[aria-disabled="true"]:focus { background:color-mix(in srgb, var(--rosu) 18%, transparent) }
/* bara verticala dintre navigare si butoanele saptamanii (cerere user, 8 sept. 2026) */
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }
/* butoanele mici: nu cresc, stau cat le tine continutul — iconita Arhivei, apoi PDF si JPG */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.06em }
.btns .mic svg { vertical-align:0 }
/* Pe telefon, din 11.09.2026, randul nu mai are ce sa ascunda: butoanele navigarii poarta DATELE, si
   alea scurte („14–20.09"), iar sagetile au iesit — ascunse, ar ramane doua butoane goale. Ca „31.08–6.09"
   sa nu se rupa in doua randuri, butoanele stau cat le tine textul: nu se mai intind si nu se mai string,
   iar daca nu incap toate, se rupe randul intreg, curat, sub ele. */
@media (max-width:600px) {
  .btns { gap:7px; flex-wrap:wrap }
  .btns .btn { flex:0 0 auto; white-space:nowrap }
  .btns .mic { padding-left:10px; padding-right:10px }
  .btns .punct { padding-left:14px; padding-right:14px }
  .btns .com-cal { gap:6px; padding-left:10px; padding-right:10px }
  /* casuta de jos NU se rupe pe doua randuri: ar creste cat un antet si ar acoperi titlul */
  .nav-jos .cutie { padding-left:8px; padding-right:8px }
  .nav-jos .btns { flex-wrap:nowrap; gap:6px }
  .nav-jos .btn { padding-left:10px; padding-right:10px }
  .nav-jos .mic { padding-left:8px; padding-right:8px }
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
   apare paralel și cu linii în plus pe dreapta"). Sta in pagina, dar ascuns; il aprinde intrerupatorul
   „Calendar" din antet (clasa cu-calendar pe body, tinuta minte in localStorage).
   Cand se aprinde, ziua se face doua coloane: la stanga programul (.prog), la dreapta ziua liturgica.
   Coloanele se aliniaza SUS, nu rand cu rand — calendarul are de obicei mai multe randuri decat
   programul, iar zilele fara slujbe ies si ele la iveala, ca linii numai pe dreapta. */
.cal { display:none }
body.cu-calendar .zi { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr);
                       column-gap:26px; align-items:start }
body.cu-calendar .zi .prog { min-width:0 }
body.cu-calendar .cal { display:block; min-width:0; padding:0 0 0 18px; border-left:1px solid var(--rule) }
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
  /* In zilele rosii CU slujbe — duminicile si sarbatorile — programul spune deja sarbatoarea si sfintii,
     pe randurile „→" ale slujbei de dimineata. Pe telefon, unde calendarul sta sub program, ar veni a
     doua oara imediat dedesubt: nu se mai scrie (user, 10.09.2026). Zilele rosii FARA slujbe raman —
     acolo calendarul e singurul care spune ce zi e. */
  body.cu-calendar .zi.rosie:not(.goala) .cal { display:none }
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
           box-shadow:1px 0 0 var(--rule), 0 1px 0 var(--rule) }
.baton a:hover { background:var(--tinta); color:var(--rosu) }
.baton b { display:block; font-size:15.5px; font-weight:600; white-space:nowrap }
.baton span { display:block; margin-top:2px; font:12.5px ui-sans-serif,system-ui; color:var(--faint) }
.baton i { display:block; margin-top:4px; font:600 9px/1 ui-sans-serif,system-ui; font-style:normal;
           letter-spacing:.12em; text-transform:uppercase; color:var(--albastru) }

/* propunerea */
.nelamuriri { border-left:3px solid var(--rosu); padding:2px 0 2px 16px; margin:22px 0; color:var(--soft) }

/* foaia A4 de pe usa: doar programul, fara antet, subsol si navigare */
@media print {
  header.sus, .subsol-linie, .versiune, footer.subsol, .btns, .nav-jos, .zi-cap .sfintii,
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
 * coloana calendarului (clasa `cu-calendar` pe body). Scris ca JS-ul comun al carcasei — fara sageti,
 * fara let/const — ca sa mearga si pe telefoanele vechi ale enoriasilor. Alegerea se tine in
 * localStorage, deci ramane de la o pagina la alta; pe paginile fara intrerupator (arhiva, saptamanile
 * vechi) nu se aprinde nimic, dar alegerea se pastreaza pentru cand omul se intoarce la saptamana lui.
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
  var pornit = false;
  try { pornit = localStorage.getItem(CHEIE) === "1"; } catch (e) {}
  pune(pornit);
  buton.addEventListener("click", function(){
    pornit = !pornit;
    pune(pornit);
    try { localStorage.setItem(CHEIE, pornit ? "1" : "0"); } catch (e) {}
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
 * NAVIGAREA saptamanii — randul de unelte din antet (`.btns` al carcasei). A urcat aici la 10.09.2026,
 * in locul abonarii (cerere user: „schimbă locul dintre «Abonează-te» și «Text» și navigarea săptămânilor…
 * să fie sus, înainte de informații utile").
 *
 * Trei TREPTE, nu pasi (user, 10.09.2026: „este o navigare, dar nu este un istoric"): saptamana trecuta,
 * bulina saptamanii de azi, saptamana urmatoare. Fiecare buton duce la locul LUI, socotit fata de ziua
 * de azi — de pe saptamana trecuta, „săptămâna următoare" sare drept la ea, nu inapoi la cea de azi
 * (cerere explicita a userului). Inapoi nu se merge mai departe de saptamana trecuta; istoricul intreg
 * a ramas la Arhiva. Bulina din mijloc n-are text (user, 8 sept. 2026).
 *
 * Butonul treptei pe care CHIAR esti nu mai duce nicaieri: e marcat rosu („bulina cu conturul roșu
 * semnifică mă aflu pe săptămâna curentă" — user) si ramane apasabil, ca la atingere sa primeasca
 * focusul si sa se vada unde esti; de aceea e `<button aria-disabled>`, nu link stins (`.gol` n-ar
 * primi nici click, nici focus).
 *
 * Pe butoane stau DOAR DATELE saptamanii (user, 11.09.2026: „în loc de săptămâna trecută și săptămâna
 * următoare, pune datele săptămânilor"; „textul să fie cât mai scurt"; „scoate săgețile de la aceste
 * două butoane"). Cuvintele au trecut in `title` si in `aria-label`, ca „14–20.09" sa nu ramana o cifra
 * fara noima nici la soarece, nici la cititorul de ecran. Fara sageti, datele se vad si pe telefon —
 * n-ar mai ramane nimic in buton daca s-ar ascunde (vezi media query-ul din STIL).
 *
 * ⚠️ PROBA (11.09.2026) — cele trei stau acum intr-o PASTILA: un singur chenar in jurul lor, fara
 * spatii intre segmente, iar treapta pe care esti e plina, nu doar conturata. Motivul: trei butoane
 * despartite se citesc ca trei destinatii deosebite, iar aici e acelasi lucru in trei momente.
 */
function navigarea(ctx: Ctx, m: Meniu): string {
  const p = esc(ctx.prefix)
  const aAzi = luneaSaptamanii(m.azi)
  const treapta = (luni: string, launtru: string, unde: string, clase = '', extra = '') => (m.luni === luni
    ? `<button type="button" class="btn ${clase}activ" aria-disabled="true" aria-current="page" title="Ești pe ${unde}"${extra}>${launtru}</button>`
    : `<a class="${`btn ${clase}`.trim()}" href="${p}/saptamana/${luni}" title="Treci la ${unde}"${extra}>${launtru}</a>`)
  const trecuta = adaugaZile(aAzi, -7)
  const urmatoarea = adaugaZile(aAzi, 7)
  const mijloc = treapta(aAzi, '', 'săptămâna de azi', 'punct ', ' aria-label="săptămâna de azi"')
  return `<span class="pastila">`
    + treapta(trecuta, intervalScurt(trecuta), 'săptămâna trecută', '', ` aria-label="săptămâna trecută, ${intervalScurt(trecuta)}"`)
    + mijloc
    + treapta(urmatoarea, intervalScurt(urmatoarea), 'săptămâna următoare', '', ` aria-label="săptămâna următoare, ${intervalScurt(urmatoarea)}"`)
    + `</span>`
}

/**
 * Intrerupatorul „Calendar" — in capatul randului de navigare, dupa o liniuta verticala; a luat locul
 * meniului „Informații utile" (user, 10.09.2026). Aprins, aduce langa program coloana zilei liturgice.
 * Se scrie DOAR pe saptamana de acum si pe cea urmatoare — „ON/OFF are sens doar pe ultima săptămână
 * și pe săptămâna următoare" (user) —, fiindca doar acolo calendarul are ce spune despre ziua de azi.
 *
 * Din 11.09.2026 n-are cuvant, ci ICONITA ecranului impartit (user: „în loc de cuvântul «calendar»,
 * pune iconița"). Becul care aluneca ramane — el spune daca e aprins sau stins; ce face butonul spun
 * `title` si `aria-label`, fiindca o rama despicata singura n-ar zice „calendar".
 */
function intrerupatorCalendar(): string {
  return `<button type="button" class="btn mic com-cal" id="b-calendar" aria-pressed="false"`
    + ` title="Arată calendarul zilei" aria-label="Calendarul zilei, lângă program">`
    + `${IC_DOUA_COLOANE}<span class="bec" aria-hidden="true"></span></button>`
}

/**
 * Randul din antet: navigarea saptamanii, o liniuta verticala si, dupa ea, butoanele saptamanii —
 * intrerupatorul „Calendar" cu poza calendarului si, numai la admini, poza paginii in doua coloane.
 * Liniuta se scrie doar daca are ce desparti: pe saptamanile vechi calendarul nu se aprinde, dar
 * super-adminul are acolo poza paginii.
 */
function unelte(ctx: Ctx, m: Meniu): string {
  const dupaLiniuta = (m.calendar ? intrerupatorCalendar() + pozaCalendarului(ctx, m) : '') + pozaProgramului(ctx, m)
  return navigarea(ctx, m) + (dupaLiniuta ? `<span class="desparte" aria-hidden="true"></span>${dupaLiniuta}` : '')
}

/**
 * Poza calendarului saptamanii — butonul de langa intrerupator, cu sageata in jos (user, 10.09.2026).
 * Deschide PNG-ul facut de CALENDAR (`/v1/poza/saptamana/<luni>`): poza e a lui, programul doar o
 * cere — ca la orice altceva care tine de ziua liturgica. In V1 pozele se faceau dinainte, cu un
 * script, pentru tot anul; in V2 se fac la cerere si stau in cache.
 *
 * Se scrie doar unde se aprinde si calendarul (cele trei saptamani ale navigarii), fiindca aceeasi
 * saptamana o arata si poza.
 *
 * DOAR PENTRU ADMINI de la 11.09.2026 (user: „utilizator neautentificat sau autentificat, utilizator
 * simplu — nu se vede butonul de descărcat imaginea cu săptămâna"). Aici e de ajuns `eAdmin`, nu cele
 * doua trepte ale hartiilor: userul a cerut doar sa iasa de sub ochii enoriasului, iar butonul se scrie
 * oricum numai pe cele trei saptamani ale navigarii. Ruta ramane deschisa, ca toate celelalte.
 */
function pozaCalendarului(ctx: Ctx, m: Meniu): string {
  if (!m.luni || !ctx.eAdmin) return ''
  const adresa = `${ctx.nav.calendar}/v1/poza/saptamana/${esc(m.luni)}`
  return `<a class="btn mic poza-cal" href="${adresa}" target="_blank" rel="noopener"`
    + ` title="Calendarul săptămânii ca poză — de trimis pe WhatsApp" aria-label="Calendarul săptămânii ca poză">`
    + `${IC_DESCARCA}</a>`
}

/**
 * CINE VEDE HARTIILE saptamanii, pe DOUA TREPTE (user, 10.09.2026, 19:39): **adminul** doar pe
 * saptamana de acum si pe cea urmatoare — atat cat ii trebuie ca sa scoata foaia de pe usa —, iar
 * **super-adminul** pe TOT istoricul, deci si pe saptamanile vechi si pe pagina Arhivei (unde nicio
 * saptamana nu e in context, deci `m.luni` e null).
 *
 * Regula e a TUTUROR hartiilor: casuta de sub antet (Arhiva, PDF, JPG) si poza cu doua coloane din
 * randul de unelte (user, 11.09.2026). Rutele raman deschise ca pana acum — „totul la liber".
 */
function vedeHartiile(ctx: Ctx, m: Meniu): boolean {
  if (!ctx.eAdmin) return false
  if (ctx.eSuperAdmin) return true
  const aAzi = luneaSaptamanii(m.azi)
  return m.luni === aAzi || m.luni === adaugaZile(aAzi, 7)
}

/**
 * HARTIILE saptamanii — sub linia antetului, intr-o casuta centrata, lipita de linie, cu colturile de sus
 * drepte si cele de jos rotunde (cerere user, 9 sept. 2026). Casuta atarna de antet (`position:absolute`
 * in `.sus`, care e sticky), deci merge cu el la derulare. Inauntru au ramas doar butoanele mici ale
 * saptamanii din context: Arhiva (doar iconita) si hartiile ei — PDF de tiparit, JPG de trimis pe WhatsApp.
 *
 * Fiecare hartie isi poarta ICONITA FELULUI ei (user, 11.09.2026): foaia cu randuri scrise la PDF, foaia
 * cu poza la JPG. Numele scurt ramane langa iconita — aici el ESTE felul fisierului, deci nu se repeta
 * degeaba, iar doua foi cu coltul indoit una langa alta s-ar deosebi greu la 17 px.
 *
 * Se scrie DOAR pentru admini (user, 10.09.2026: „care se văd doar pentru admini") — enoriasul are in
 * antet doar navigarea si calendarul. Rutele (`/arhiva`, `/v1/foaie/…`) raman deschise ca pana acum:
 * deocamdata nimic din ce se citeste nu cere cont.
 */
function hartiile(ctx: Ctx, m: Meniu): string {
  if (!vedeHartiile(ctx, m)) return ''
  const p = esc(ctx.prefix)
  const hartie = (ext: 'pdf' | 'jpg', iconita: string, titlu: string) => (m.foaie
    ? `<a class="btn mic" href="${p}${m.foaie}.${ext}" target="_blank" rel="noopener" title="${titlu}">${iconita}<span>${ext.toUpperCase()}</span></a>`
    : `<span class="btn mic gol" title="Foaia se deschide de pe pagina unei săptămâni cu program validat">${iconita}<span>${ext.toUpperCase()}</span></span>`)
  return `<nav class="nav-jos"><div class="btns cutie">`
    + `<a class="btn mic${m.arhiva ? ' activ' : ''}" href="${p}/arhiva" title="Arhiva programelor" aria-label="Arhiva programelor">${IC_ARHIVA}</a>`
    + hartie('pdf', ICOANE.pdf, 'Foaia A4, de tipărit')
    + hartie('jpg', ICOANE.jpg, 'Foaia ca poză, de trimis pe WhatsApp')
    + `</div></nav>`
}

/**
 * POZA PAGINII, cu cele doua coloane — programul la stanga, calendarul la dreapta, exact ce se vede
 * cand intrerupatorul „Calendar" e aprins (cerere user, 11.09.2026). Butonul sta in randul de unelte,
 * langa poza calendarului, si deschide `/v1/poza/saptamana/<luni>.jpg`.
 *
 * Deosebirea de JPG-ul din casuta de jos: acela e foaia A4 de pe usa, fotografiata; asta e PAGINA, cu
 * grafica ei si cu sfintii zilei alaturi. Amandoua pleaca pe WhatsApp, de aceea stau despartite si ca
 * iconita.
 *
 * E tot o hartie a saptamanii, deci se vede dupa ACELEASI DOUA TREPTE ca celelalte (alegerea userului,
 * 11.09.2026): enoriasul si utilizatorul simplu n-o vad deloc.
 *
 * Poarta tot o SAGEATA DE DESCARCARE, ca poza calendarului de langa ea (user, 11.09.2026: „pune tot
 * iconița de download") — semnul ecranului impartit s-a mutat pe intrerupator. Ca sa nu ramana doua
 * semne identice unul langa altul, sageata e DUBLA (a doua cerere a userului, la un sfert de ora):
 * doua sageti pe aceeasi talpa, adica doua coloane — „seamănă mai mult cu ce urmează să vadă omul".
 */
function pozaProgramului(ctx: Ctx, m: Meniu): string {
  if (!m.luni || !vedeHartiile(ctx, m)) return ''
  return `<a class="btn mic poza-prog" href="${esc(ctx.prefix)}/v1/poza/saptamana/${esc(m.luni)}.jpg" target="_blank" rel="noopener"`
    + ` title="Ecranul împărțit — programul și calendarul, în două coloane, ca poză (JPEG)"`
    + ` aria-label="Ecranul împărțit ca poză">${IC_DESCARCA_DUBLU}</a>`
}

/** Antetul intreg al paginilor de om: randul de unelte, casuta hartiilor (doar la admini), JS-ul lor. */
function antetul(ctx: Ctx, m: Meniu) {
  return { unelte: unelte(ctx, m), subantet: hartiile(ctx, m), scripturi: SCRIPT }
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
  const clase = ['zi', o.data === o.azi ? 'azi' : '', duminica || (z && ziRosie(z)) ? 'rosie' : '',
    o.slujbe.length ? '' : 'goala', o.ultima ? 'ultima' : ''].filter(Boolean).join(' ')
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
  ${o.cuCalendar ? calendarulZilei(z, o.data) : ''}
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
  // Calendarul tine exact cat navigarea: cele trei trepte — saptamana trecuta, cea de azi, cea
  // urmatoare (user, 10.09.2026). Pe saptamanile din arhiva nu se scrie nici intrerupatorul, nici
  // coloana lui; zilele raman insa colorate dupa calendar (rosul sarbatorilor) si randurile „→" ale
  // slujbelor sunt tot de acolo.
  const aAzi = luneaSaptamanii(o.azi)
  const cuCalendar = o.luni === adaugaZile(aAzi, -7) || o.luni === aAzi || o.luni === adaugaZile(aAzi, 7)
  const zile = zileleSaptamanii({ ...o, cuCalendar })
  // Eticheta de langa titlu spune doar ce NU e gata: „propunere" (si, daca s-ar ivi, „propus" ori
  // „modificat după validare"). Pe programul validat nu se mai scrie nimic — user, 10.09.2026:
  // „scoate eticheta Validat… lasă doar Propunere la săptămâna următoare. Este util."
  const clasaStare = o.stare === 'propunere' ? 'propus' : o.stare
  const eticheta = o.stare === 'validat' ? ''
    : `<span class="stare ${esc(clasaStare)}">${esc(STARE[o.stare] ?? o.stare)}</span>`
  // ⚠️ PROBA (11.09.2026) — MOMENTUL, scris in pagina deasupra datelor: „săptămâna trecută / aceasta /
  // următoare". Cele trei pagini arata acelasi lucru in trei momente, iar pana acum singurul semn al
  // momentului era in antet, pe butonul rosu. Se scrie doar pe cele trei trepte; pe saptamanile din
  // arhiva ramane doar titlul, ca pana acum. Rosu la „aceasta", ca sa se lege de rosul din pastila.
  const moment = o.luni === aAzi ? 'Săptămâna aceasta'
    : o.luni === adaugaZile(aAzi, -7) ? 'Săptămâna trecută'
    : o.luni === adaugaZile(aAzi, 7) ? 'Săptămâna următoare'
    : ''
  const cap = `<div class="sapt-cap"><div>${moment ? `<span class="moment${o.luni === aAzi ? ' acum' : ''}">${moment}</span>` : ''}<h2>${esc(o.titlu)}</h2></div>${eticheta}</div>`
  const gol = o.slujbe.length ? '' : `<p class="gol">${o.stare === 'propunere' ? 'Nimic de propus — istoricul nu spune nimic despre această săptămână.' : 'Săptămână fără slujbe înregistrate.'}</p>`
  const nelamuriri = o.nelamuriri?.length
    ? `<div class="nelamuriri"><b>Nelămuriri</b><ul>${o.nelamuriri.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`
    : ''
  const meniu: Meniu = { ...o.meniu, luni: o.luni, calendar: cuCalendar }
  return pagina({
    ...comune(o.ctx),
    titluPagina: o.stare === 'propunere' ? `Propunere · ${o.titlu}` : o.titlu,
    indexabil: true,
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
 * cu ce se vede pe ecran — aceleasi doua coloane, de aceeasi latime, nu o asezare facuta anume pentru
 * poza. Fotografia se face la doi pixeli pe punct, deci fisierul iese de 1360 px.
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
}

/**
 * POZA SAPTAMANII — pagina intreaga, cu calendarul deschis, gata de trimis (cerere user, 11.09.2026:
 * „un JPEG și cu calendarul împărțit, adică așa cum se vede când este întrerupătorul Calendar pe On").
 *
 * Nu e o asezare noua: e PAGINA, cu stilul ei (`STIL_COMUN` + `STIL`), cu `cu-calendar` pus din capul
 * locului pe `body` — adica intrerupatorul aprins, fara JS si fara localStorage — si cu zilele scrise
 * de aceeasi `zileleSaptamanii`. Ce cade sunt doar lucrurile care se apasa: antetul, subsolul,
 * navigarea, butonul „Sfinții zilei" (nici n-ajunge sa se scrie: poza cere pagina cu `eAdmin: false`).
 * Coloana calendarului se scrie MEREU, si pe saptamanile vechi — regula celor trei trepte tine de
 * navigare, nu de poza; daca A1 n-are zilele acelea, coloana ramane goala si poza e doar programul.
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
  const zile = zileleSaptamanii({ ...o, cuCalendar: true })
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
</style></head><body class="cu-calendar">
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
        .map((s) => `<a href="${p}/saptamana/${s.luni}"><b>${esc(perioadaScurta(s.luni, s.duminica))}</b>`
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
    corp: `<h2>Arhiva programelor</h2>
<p class="marunt">${o.total} săptămâni, din ${o.deLa ? esc(o.deLa.slice(0, 4)) : '—'} până azi. Importate din site-ul vechi; se completează de aici înainte.</p>
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
