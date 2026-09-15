/**
 * ABONAREA PLATFORMEI — un singur loc, pentru toate aplicațiile care au ce trimite.
 *
 * ⚠️ Până la 15.09.2026 fereastra de abonare era COPIATĂ în patru aplicații (calendar, program,
 * buletin, tipic), identică literă cu literă, și nu trimitea nimic nicăieri: `<form method="dialog">`
 * o închidea și atât. Rutele `POST /abonare` · `/dezabonare` existau întregi dedesubt, dar nimeni
 * nu apăsa pe ele din pagină. Aici se leagă — și se leagă O DATĂ (user, 15.09.2026: „ar trebui să
 * fie la fel peste tot. Nu ar trebui să copiez logica în mai multe locuri").
 *
 * **CE E DEOSEBIT DE LA O APLICAȚIE LA ALTA**: numai AUDIENȚA în care se scrie omul, adică ce
 * primește pe e-mail. Atât. De aceea aplicația nu aduce cu ea nicio bucată de flux, ci doar rândul
 * ei din `ABONAMENTE` și carcasa în care să se scrie paginile (antetul și subsolul sunt ale ei).
 *
 * **CINE ARE BUTON**: numai aplicațiile din `ABONAMENTE` (user, 15.09.2026: „fiecare aplicație care
 * are această funcție, are un serviciu la care te poți abona. Dacă nu, acest buton de abonare nu
 * apare"). Registrul de mai jos e lista aceea — se adaugă un rând când apare un serviciu nou de
 * trimis, nu invers.
 *
 * DRUMUL ÎNTREG, așa cum l-a cerut userul (15.09.2026):
 *
 *   1. omul apasă „Abonare" → fereastra, cu adresa și cele două bife;
 *   2. „Vreau să fac cont" e bifată și ÎNCUIATĂ — abonarea platformei stă pe adresa contului, deci
 *      un abonat fără cont n-are cum să existe; bifa spune adevărul, nu întreabă;
 *   3. fără „Sunt de acord cu termenii și condițiile" butonul nu pleacă: rândul se face roșu, cu
 *      mesaj de validare sub el (nu bula browserului — de aceea bifa NU poartă `required`);
 *   4. cine e deja intrat se abonează pe loc, cu adresa contului lui;
 *   5. cine nu e intrat primește pe e-mail un cod de șase cifre și e dus, ÎN PAGINĂ, la ecranul
 *      celor șase casete — același ecran ca la Cont, ca omul să nu se trezească în altă aplicație;
 *   6. după cod: cont deschis (rol `user`), sesiune pusă, abonare scrisă, și înapoi exact în pagina
 *      din care a plecat.
 */
import {
  asiguraCsrf,
  cereCodDeIntrare,
  confirmaCodul,
  construiesteCookie,
  NUME_COOKIE_SESIUNE,
  principalDin,
  sesiuneDupaJeton,
  verificaTokenCsrf,
} from '@xc/auth'
import type { Principal } from '@xc/contracts'
import { alerta, esc, html } from '@xc/ui'

// ---------------------------------------------------------------------------
// Registrul: cine are abonare și la ce
// ---------------------------------------------------------------------------

export interface Abonament {
  /** codul aplicației, cum îl știe platforma (`calendar`, `program`, …) */
  cod: string
  /** audiența din `communication-worker` — acolo se scriu abonații; se naște la primul înscris */
  audienta: string
  /** numele audienței, scris o dată, la nașterea ei; se vede în Dispecerat */
  numeAudienta: string
  /** ce primește omul, în propoziții: „Primește **calendarul** pe email" */
  ce: string
  /** numele aplicației, cu majusculă: „ești abonat la **Calendar**" */
  la: string
  /** verbul auditului: `calendar.subscribe` / `calendar.unsubscribe` */
  prefixAudit: string
}

/**
 * ⚠️ UN RÂND AICI ÎNSEAMNĂ UN BUTON ÎN APLICAȚIE. Aplicația care nu e în listă n-are ce trimite,
 * deci n-are nici buton de abonare — nu se pune unul „ca să fie".
 *
 * ⚠️ Aplicația trebuie să aibă și legătura `COMUNICARE` în `wrangler.jsonc`; fără ea abonarea n-are
 * unde scrie. La adăugarea unui rând nou: rândul aici, legătura acolo, și atât.
 *
 * NU sunt în listă, și de ce:
 *   - `newsletter` — e ARHIVĂ, nu trimite nimic încă (vezi `apps/newsletter/src/index.ts`);
 *     când va trimite, e primul care intră aici;
 *   - `biblia`, `biblioteca`, `live`, `radio`, `curatenie` — n-au un serviciu periodic de trimis;
 *     curățenia își are scrisorile ei, dar pe echipa aplicației, nu pe o audiență deschisă oricui.
 */
export const ABONAMENTE: readonly Abonament[] = [
  { cod: 'calendar', audienta: 'calendar-abonati', numeAudienta: 'Abonații calendarului', ce: 'calendarul', la: 'Calendar', prefixAudit: 'calendar' },
  { cod: 'program', audienta: 'program-abonati', numeAudienta: 'Abonații programului', ce: 'programul', la: 'Program', prefixAudit: 'program' },
  { cod: 'buletin', audienta: 'buletin-abonati', numeAudienta: 'Abonații buletinului', ce: 'buletinul', la: 'Buletin', prefixAudit: 'buletin' },
  { cod: 'tipic', audienta: 'tipic-abonati', numeAudienta: 'Abonații tipicului', ce: 'tipicul', la: 'Tipic', prefixAudit: 'tipic' },
]

export function abonamentul(cod: string): Abonament {
  const a = ABONAMENTE.find((x) => x.cod === cod)
  if (!a) throw new Error(`aplicația „${cod}" nu are abonament în registrul @xc/abonare`)
  return a
}

// ---------------------------------------------------------------------------
// Înfățișarea: butonul, fereastra, ecranul codului
// ---------------------------------------------------------------------------

/** Plicul — același desen în toate aplicațiile, ca butonul să se recunoască de la una la alta. */
export const IC_PLIC = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>`

/**
 * Ce se adaugă la stilul local al aplicației. Restul (`.modal`, `.camp`, `.bifa`, `.btn-plin`) stă
 * deja în fiecare `stil.ts`, neschimbat — aici sunt numai bucățile NOI: rândul roșu al validării,
 * linkul din bifă și cele șase casete ale codului.
 *
 * ⚠️ `.bifa label` își ia scrisul înapoi: carcasa face din toate etichetele capete de câmp
 * (`label { font:600 12px … }`), potrivite deasupra unei casete, nu lângă o bifă. Până acum bifa
 * ERA eticheta; de când textul poartă un link, eticheta s-a mutat înăuntru și regula o prinde.
 */
export const STIL_ABONARE = `
/* BUTONUL DE ABONARE ARE MĂSURĂ FIXĂ, ACEEAȘI ÎN TOATE APLICAȚIILE (user, 15.09.2026: „păstrează o
   dimensiune fixă pentru butonul de abonare, ca să fie afișat la fel pe toate aplicațiile pe care le
   deschidem"). Până acum fiecare aplicație îl lăsa cât îi ținea scrisul, iar spațiul din laturi îl
   dădea stilul ei local — deci butonul ieșea cu câțiva pixeli altfel de la Calendar la Buletin, și
   se vedea mai ales când omul trecea de la una la alta.
   ⚠️ Măsura stă AICI, lângă butonul însuși, nu în cele patru stiluri locale: e singurul fel în care
   „la fel peste tot" rămâne adevărat și mâine.
   ⚠️ 118 px e cât cere plicul (17) + spațiul (6) + cuvântul „Abonare" + laturile; dacă schimbi
   scrisul butonului, schimbă și măsura, altfel cuvântul se taie. */
.btns .abon { flex:0 0 auto; width:118px; justify-content:center }
/* Pe telefon cade CUVÂNTUL, nu butonul: rămâne plicul, într-un pătrat de aceeași măsură peste tot.
   Numele întreg stă în title, deci nu se pierde. */
@media (max-width:600px) {
  .btns .abon { width:44px; padding-left:0; padding-right:0 }
  .btns .abon .cuv { display:none }
}

.bifa label { font:inherit; color:inherit; margin:0; display:inline; letter-spacing:normal;
              text-transform:none }
.bifa a { color:inherit; text-underline-offset:2px }
.bifa a:hover { color:var(--rosu) }
/* bifa încuiată („Vreau să fac cont"): se vede că e pusă și că nu se umblă la ea */
.bifa input:disabled { opacity:.75; cursor:not-allowed }
.bifa.incuiata { color:var(--faint) }
/* validarea: rândul întreg se face roșu, cu pricina scrisă sub el (user, 15.09.2026) */
.bifa.rea, .bifa.rea label, .bifa.rea a { color:var(--rosu) }
.bifa.rea input { outline:2px solid var(--rosu); outline-offset:1px }
.bifa-rau { margin:-6px 0 12px 27px; color:var(--rosu);
            font:400 13px/1.45 ui-sans-serif,system-ui }
/* Cele șase casete, 3-3, ca să se potrivească la ochi cu „123 456" din scrisoare — aceeași
   așezare ca la Cont, fiindcă e același gest. */
.cod-casute { display:flex; align-items:center; gap:8px; margin:16px 0 4px }
.cod-casute input { width:46px; height:56px; padding:0; text-align:center;
                    font:600 24px/1 ui-sans-serif,system-ui; color:var(--ink);
                    background:var(--paper); border:1px solid var(--rule); border-radius:10px }
.cod-casute input:focus { border-color:var(--rosu); outline:none }
.cod-casute .rupe { width:8px }
form.cod { display:block; max-width:420px; margin:14px 0 }
.din-nou { background:none; border:0; padding:0; width:auto; color:var(--rosu);
           font:inherit; text-decoration:underline; cursor:pointer }
@media (max-width:380px) {
  .cod-casute { gap:6px }
  .cod-casute input { width:40px; height:50px; font-size:21px }
}
`

/**
 * Butonul din rândul de unelte.
 *
 * ⚠️ E AL TUTUROR, ȘI AL ADMINILOR (user, 12.09.2026: „să lăsăm totuși iconița de abonare și la
 * admini. Că și ei se comportă ca un utilizator care poate vor să fie anunțați"). Nu-l ascunde
 * după rol: dreptul de a administra nu-l scoate pe om din rândul celor care vor să primească
 * vestea. Singura condiție e să existe un serviciu — adică un rând în `ABONAMENTE`.
 */
export function butonAbonare(a: Abonament): string {
  return `<button type="button" class="btn mic abon" id="b-abonare"`
    + ` title="Primește ${esc(a.ce)} pe email">${IC_PLIC}<span class="cuv">Abonare</span></button>`
}

/**
 * Calea paginii din care s-a apăsat, din ce dă aplicația.
 *
 * ⚠️ Aplicațiile țin în `ctx.spre` o adresă ÎNTREAGĂ (`adresaPaginii` din `@xc/config`, făcută
 * pentru comutatorul „vezi ca"), nu o cale. Fără traducerea asta, `spreSigur` de mai jos ar fi
 * refuzat-o la fiecare abonare și omul s-ar fi trezit aruncat pe rădăcina aplicației în loc să se
 * întoarcă în pagina lui.
 *
 * ⚠️ Din orice i se dă scoate NUMAI calea, deci o adresă străină iese tot ca drum de la noi —
 * paza nu stă în mila celui care cheamă.
 */
function caleaDin(brut: string, prefix: string): string {
  if (!brut || brut.startsWith('//')) return `${prefix}/`
  if (brut.startsWith('/')) return brut
  try {
    const u = new URL(brut)
    return `${u.pathname}${u.search}` || `${prefix}/`
  } catch {
    return `${prefix}/`
  }
}

export interface FereastraAbonare {
  /** prefixul aplicației (`/calendar` în dev, `` în producție) — de aici iese `action` */
  prefix: string
  /** pagina din care s-a apăsat; călătorește prin tot fluxul și-l aduce pe om înapoi aici */
  spre: string
  /** pagina de termeni a PLATFORMEI (una singură, în `home`) */
  urlTermeni: string
  /** adresa contului, când omul e deja intrat: atunci câmpul e completat și încuiat */
  emailulContului?: string | null
}

/**
 * Fereastra. Deosebirile față de varianta veche, toate cerute de user (15.09.2026):
 *
 *   - textul e scurtat la „Pentru a vă abona, completați câmpul:" (partea cu adresa de mail a ieșit);
 *   - „Vreau să fac cont" e bifată și încuiată — vezi lămurirea de sus;
 *   - „termenii și condițiile" e LINK, în filă nouă;
 *   - formularul pleacă de-adevăratelea: `method="post"` spre `POST <prefix>/abonare`.
 *
 * ⚠️ X-ul poartă `formmethod="dialog"` și `formnovalidate`: altfel, într-un formular care acum chiar
 * trimite, butonul de închidere ar fi trimis și el — și s-ar fi izbit de câmpul obligatoriu, deci
 * fereastra n-ar mai fi putut fi închisă cu X. Așa închiderea rămâne fără nicio linie de JS.
 *
 * ⚠️ Bifa termenilor NU are `required`, dinadins: cu el, browserul își scoate bula lui și oprește
 * `submit`, deci rândul roșu cerut de user n-ar mai apuca să se scrie. Paza adevărată e la server
 * (`ruteazaAbonare`), unde ajunge și cine trimite formularul de mână.
 *
 * ⚠️ Când omul e intrat, câmpul e completat cu adresa contului și `readonly`: abonarea platformei
 * stă pe adresa contului (structura mare), deci o altă adresă scrisă acolo ar fi fost citită și
 * aruncată în tăcere.
 */
export function fereastraAbonare(o: FereastraAbonare): string {
  const intrat = !!o.emailulContului
  return `<dialog class="modal" id="d-abonare" aria-labelledby="t-abonare">
  <form class="modal-cutie" id="f-abonare" method="post" action="${esc(o.prefix)}/abonare">
    <div class="modal-cap">
      <h2 id="t-abonare">Abonare</h2>
      <button type="submit" formmethod="dialog" formnovalidate value="inchide" class="modal-x" aria-label="Închide fereastra">&times;</button>
    </div>
    <p class="modal-spune">Pentru a vă abona, completați câmpul:</p>
    <input type="hidden" name="spre" value="${esc(caleaDin(o.spre, o.prefix))}">
    <label class="camp"><span>Adresa de e-mail</span>
      <input type="email" name="email" required autocomplete="email" placeholder="nume@exemplu.ro"
             value="${esc(o.emailulContului ?? '')}"${intrat ? ' readonly title="Abonarea merge pe adresa contului tău."' : ''}></label>
    <div class="bifa incuiata">
      <input type="checkbox" id="b-cont" checked disabled>
      <label for="b-cont">Vreau să fac cont.</label>
    </div>
    <div class="bifa" id="l-termeni">
      <input type="checkbox" name="termeni" id="b-termeni" value="1">
      <label for="b-termeni">Sunt de acord cu <a href="${esc(o.urlTermeni)}" target="_blank" rel="noopener">termenii și condițiile</a>.</label>
    </div>
    <p class="bifa-rau" id="e-termeni" hidden>Trebuie să fii de acord cu termenii și condițiile.</p>
    <div class="modal-jos"><button type="submit" class="btn-plin">Abonare</button></div>
  </form>
</dialog>`
}

/**
 * JS-ul ferestrei: o deschide și păzește bifa termenilor.
 *
 * Scris fără săgeți și fără `let`/`const`, ca JS-ul carcasei — telefoanele vechi ale enoriașilor
 * îl citesc și pe acela.
 *
 * ⚠️ Oprirea derulării din spate NU se scrie aici: o face carcasa, la orice `showModal()`
 * (regulă generală, 13.09.2026).
 */
export const JS_ABONARE = `
(function(){
  var b = document.getElementById("b-abonare");
  var d = document.getElementById("d-abonare");
  if (!b || !d || !d.showModal) return;
  b.addEventListener("click", function(){ d.showModal(); });

  var f = document.getElementById("f-abonare");
  var t = document.getElementById("b-termeni");
  var l = document.getElementById("l-termeni");
  var e = document.getElementById("e-termeni");
  if (!f || !t || !l || !e) return;
  function curat(){ l.classList.remove("rea"); e.hidden = true; }
  t.addEventListener("change", function(){ if (t.checked) curat(); });
  f.addEventListener("submit", function(ev){
    // X-ul poarta formmethod="dialog": el doar inchide fereastra, n-are ce valida
    var cine = ev.submitter;
    if (cine && cine.getAttribute("formmethod") === "dialog") return;
    if (t.checked) { curat(); return; }
    ev.preventDefault();
    l.classList.add("rea");
    e.hidden = false;
    t.focus();
  });
})();
`

/**
 * Cele șase casete. Sunt șase CÂMPURI adevărate, nu unul deghizat — fără JS se completează una câte
 * una, iar serverul le lipește. Cu JS: trecerea singură mai departe, Backspace înapoi, lipirea
 * întregului cod dintr-o dată și trimiterea la a șasea cifră. (Copiat din `apps/account`, unde s-a
 * născut; dacă se schimbă acolo, schimbă-l și aici — sau mută-l de tot aici.)
 */
const CASUTE = `
<div class="cod-casute" id="casute">${[1, 2, 3, 4, 5, 6]
  .map(
    (i) =>
      `${i === 4 ? '<span class="rupe"></span>' : ''}<input name="c${i}" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="one-time-code" aria-label="Cifra ${i}"${i === 1 ? ' autofocus' : ''} required>`,
  )
  .join('')}</div>`

export const JS_CASUTE = `
(function(){
  var d=document.getElementById("casute"); if(!d) return;
  var c=[].slice.call(d.querySelectorAll("input"));
  var f=c[0].form;
  function pune(v,de){
    var cif=v.replace(/\\D/g,"").split("");
    if(!cif.length){ c[de].value=""; return }
    var i=de;
    while(cif.length && i<c.length) c[i++].value=cif.shift();
    c[Math.min(i,c.length-1)].focus();
    var gata=c.every(function(x){return x.value});
    if(gata && f && f.requestSubmit) f.requestSubmit();
  }
  c.forEach(function(x,i){
    x.addEventListener("input",function(){ pune(x.value,i) });
    x.addEventListener("keydown",function(e){
      if(e.key==="Backspace" && !x.value && i>0){ e.preventDefault(); c[i-1].value=""; c[i-1].focus() }
      if(e.key==="ArrowLeft" && i>0) c[i-1].focus();
      if(e.key==="ArrowRight" && i<c.length-1) c[i+1].focus();
    });
    x.addEventListener("paste",function(e){
      e.preventDefault(); pune((e.clipboardData||window.clipboardData).getData("text"),i);
    });
    x.addEventListener("focus",function(){ x.select() });
  });
})();
`

/**
 * Ecranul celor șase cifre, ÎN APLICAȚIE (user, 15.09.2026: „în pagină să fie dus în zona de
 * autentificare"). E aceeași treabă ca la Cont, dar omul rămâne unde a pornit-o: același antet,
 * același subsol, aceeași aplicație — iar la capăt se întoarce în pagina din care a plecat.
 */
export function corpulCodului(o: {
  prefix: string
  abonament: Abonament
  csrf: string
  email: string
  spre: string
  eroare?: string
  /** în dev, codul care ar fi plecat pe e-mail — fluxul se poate proba fără poștă adevărată */
  codDebug?: string | null
}): string {
  const p = esc(o.prefix)
  const ascunse = `<input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <input type="hidden" name="email" value="${esc(o.email)}">
    <input type="hidden" name="spre" value="${esc(o.spre)}">`
  const cutieDebug = o.codDebug
    ? alerta('info', `<b>Mediu de dezvoltare</b> — niciun email nu pleacă în exterior. Codul care ar fi fost trimis: <b>${esc(`${o.codDebug.slice(0, 3)} ${o.codDebug.slice(3)}`)}</b>`)
    : ''
  return `<div class="cap">
  <h1 class="titlu-lista">Scrie codul din email</h1>
  <p class="sursa">Am trimis un cod de șase cifre la <b>${esc(o.email)}</b>. Este bun zece minute.
  Dacă nu ajunge, uită-te și în „Spam". După ce îl scrii, contul e deschis și ești abonat la
  ${esc(o.abonament.la)}.</p>
</div>
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
${cutieDebug}
<form class="cod" method="post" action="${p}/abonare/cod">
  ${ascunse}
  ${CASUTE}
  <button type="submit" style="margin-top:12px">Intră și abonează-mă</button>
</form>
<form class="cod" method="post" action="${p}/abonare/cod-din-nou">
  ${ascunse}
  <p><small>Nu a ajuns? <button type="submit" class="din-nou">Trimite alt cod</button></small></p>
</form>
<nav class="vecini"><a href="${esc(o.spre)}">← Înapoi, fără abonare</a></nav>`
}

// ---------------------------------------------------------------------------
// Drumul: rutele abonării, aceleași în toate aplicațiile
// ---------------------------------------------------------------------------

/** Legăturile de care are nevoie abonarea. `AUDIT` lipsește la aplicațiile care n-au jurnal. */
export interface MediuAbonare {
  IDENTITATE: Fetcher
  COMUNICARE: Fetcher
  AUDIT?: Fetcher
}

export interface UneltelAbonarii {
  abonament: Abonament
  prefix: string
  /** `ORIGINE_PUBLICA`, `MEDIU`, `DOMENIU_COOKIE` — din `citesteConfig(env)` */
  cfg: { MEDIU: string; DOMENIU_COOKIE: string }
  cid: string
  /** cine e pe sesiune acum; `null` = neautentificat */
  principal: Principal | null
  /** carcasa aplicației: primește corpul, dă pagina întreagă (antet, subsol, stil, tot) */
  carcasa: (o: { titluPagina: string; corp: string; scripturi?: string }) => string
  /** jurnalul aplicației; dacă lipsește, abonarea nu scrie în audit */
  audit?: (intrare: { action: string; target: string; outcome: 'success' | 'failure'; actorId?: string }) => Promise<void>
}

async function comunicare(env: MediuAbonare, cale: string, corp: unknown): Promise<boolean> {
  try {
    const r = await env.COMUNICARE.fetch(`https://comunicare.intern${cale}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corp),
    })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Înscrierea propriu-zisă — SINGURUL lucru deosebit de la o aplicație la alta, și el ține doar de
 * numele audienței (user, 15.09.2026: „singura diferență este ce acțiune se face în momentul în
 * care se confirmă abonarea").
 */
async function inscrie(env: MediuAbonare, a: Abonament, p: Principal): Promise<boolean> {
  return comunicare(env, '/audiente/inscrie', {
    audienceId: a.audienta,
    nume: a.numeAudienta,
    userId: p.userId,
    channel: 'email',
    adresa: p.email,
  })
}

/**
 * ⚠️ Adresa de întoarcere vine din formular, deci nu e crezută pe nemestecat: o cale de pe gazda
 * noastră trece, iar `//alt-site` (cale doar la prima vedere) e refuzată. Orice altceva cade pe
 * rădăcina aplicației.
 */
function spreSigur(brut: string, prefix: string): string {
  return brut.startsWith('/') && !brut.startsWith('//') ? brut : `${prefix}/`
}

const E_ADRESA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function paginaCod(o: UneltelAbonarii, date: { csrf: string; email: string; spre: string; eroare?: string; codDebug?: string | null }, status = 200, antete: Record<string, string> = {}): Response {
  return html(
    o.carcasa({
      titluPagina: 'Codul din email',
      corp: corpulCodului({ prefix: o.prefix, abonament: o.abonament, ...date }),
      scripturi: JS_CASUTE,
    }),
    status,
    antete,
  )
}

function paginaOprire(o: UneltelAbonarii, titlu: string, text: string, status: number): Response {
  return html(
    o.carcasa({
      titluPagina: titlu,
      corp: `<div class="cap">
  <h1 class="titlu-lista">${esc(titlu)}</h1>
  <p class="sursa">${esc(text)}</p>
</div>
<nav class="vecini"><a href="${esc(o.prefix)}/">← Înapoi</a></nav>`,
    }),
    status,
  )
}

/**
 * RUTELE ABONĂRII. Aplicația le cheamă o dată, înaintea rutelor ei, și primește `null` dacă adresa
 * nu e a abonării.
 *
 * ⚠️ Bariera de origine (`verificaCsrf`) rămâne a aplicației, la intrarea în worker, ca până acum —
 * nu se repetă aici. Ce se adaugă e jetonul CSRF pe pasul codului: acolo se NAȘTE o sesiune, deci
 * merită aceeași grijă ca la Cont.
 */
export async function ruteazaAbonare(
  req: Request,
  cale: string,
  env: MediuAbonare,
  o: UneltelAbonarii,
): Promise<Response | null> {
  if (cale !== '/abonare' && cale !== '/dezabonare' && cale !== '/abonare/cod' && cale !== '/abonare/cod-din-nou') {
    return null
  }
  const p = o.prefix
  // pe GET nu se schimbă nimic: cine nimerește adresa cu mâna e trimis înapoi în aplicație
  if (req.method !== 'POST') return new Response(null, { status: 303, headers: { location: `${p}/` } })

  const formular = await req.formData()
  const spre = spreSigur(String(formular.get('spre') ?? ''), p)
  const ip = req.headers.get('cf-connecting-ip') ?? 'necunoscut'
  const a = o.abonament

  // ------------------------------------------------------------------ dezabonare
  if (cale === '/dezabonare') {
    if (!o.principal) return new Response(null, { status: 303, headers: { location: spre } })
    const ok = await comunicare(env, '/audiente/scoate', { audienceId: a.audienta, userId: o.principal.userId, channel: 'email' })
    await o.audit?.({ action: `${a.prefixAudit}.unsubscribe`, target: a.audienta, outcome: ok ? 'success' : 'failure', actorId: o.principal.userId })
    return new Response(null, { status: 303, headers: { location: `${spre}?abonat=${ok ? 2 : 0}` } })
  }

  // ------------------------------------------------------------- pasul întâi
  if (cale === '/abonare') {
    // ⚠️ Paza termenilor, la SERVER. În pagină o face JS-ul (rândul roșu), dar aici ajunge și cine
    // trimite formularul de mână — iar consimțământul nu e o podoabă a interfeței.
    if (!formular.get('termeni')) {
      return paginaOprire(o, 'Abonare', 'Abonarea se face numai după ce ești de acord cu termenii și condițiile.', 400)
    }

    // omul e deja intrat: se abonează pe loc, cu adresa contului lui
    if (o.principal) {
      const ok = await inscrie(env, a, o.principal)
      await o.audit?.({ action: `${a.prefixAudit}.subscribe`, target: a.audienta, outcome: ok ? 'success' : 'failure', actorId: o.principal.userId })
      return new Response(null, { status: 303, headers: { location: `${spre}?abonat=${ok ? 1 : 0}` } })
    }

    const email = String(formular.get('email') ?? '').trim().toLowerCase()
    if (!E_ADRESA.test(email)) {
      return paginaOprire(o, 'Abonare', 'Scrie o adresă de e-mail validă și încearcă din nou.', 400)
    }

    const r = await cereCodDeIntrare(env.IDENTITATE, { email, ip, correlationId: o.cid })
    if (r.status === 429) {
      return paginaOprire(o, 'Prea multe cereri', 'S-au cerut prea multe coduri pentru adresa asta. Așteaptă câteva minute și reia.', 429)
    }
    if (r.status >= 400) {
      return paginaOprire(o, 'Abonare', 'Adresa nu pare validă. Încearcă din nou.', 400)
    }
    const csrf = asiguraCsrf(req, o.cfg.DOMENIU_COOKIE)
    return paginaCod(o, { csrf: csrf.jeton, email, spre, codDebug: r.debugCod }, 200, csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {})
  }

  // --------------------------------------------------------- alt cod, pe aceeași adresă
  const csrfDinFormular = String(formular.get('csrf') ?? '')
  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  const problema = verificaTokenCsrf(req, csrfDinFormular)
  if (problema) return paginaOprire(o, 'Verificare de securitate', problema, 403)
  if (!E_ADRESA.test(email)) return new Response(null, { status: 303, headers: { location: spre } })

  if (cale === '/abonare/cod-din-nou') {
    const r = await cereCodDeIntrare(env.IDENTITATE, { email, ip, correlationId: o.cid })
    if (r.status === 429) {
      return paginaCod(o, { csrf: csrfDinFormular, email, spre, eroare: 'S-au cerut prea multe coduri. Așteaptă câteva minute și reia.' }, 429)
    }
    return paginaCod(o, { csrf: csrfDinFormular, email, spre, codDebug: r.debugCod })
  }

  // ------------------------------------------------------------ cele șase cifre
  // Se acceptă și codul întreg lipit în prima casetă: cine îl copiază din scrisoare nimerește acolo.
  const cod = [1, 2, 3, 4, 5, 6]
    .map((i) => String(formular.get(`c${i}`) ?? ''))
    .join('')
    .replace(/\D/g, '')
    .slice(0, 6)
  if (cod.length < 6) {
    return paginaCod(o, { csrf: csrfDinFormular, email, spre, eroare: 'Codul are șase cifre.' }, 400)
  }

  const raspuns = await confirmaCodul(env.IDENTITATE, {
    email,
    cod,
    ip,
    userAgent: req.headers.get('user-agent') ?? '',
    correlationId: o.cid,
  })
  if (!raspuns.ok) {
    const text =
      raspuns.motiv === 'cod gresit'
        ? typeof raspuns.ramase === 'number' && raspuns.ramase > 0
          ? `Codul nu e bun. Mai ai ${raspuns.ramase} ${raspuns.ramase === 1 ? 'încercare' : 'încercări'}.`
          : 'Codul nu e bun.'
        : raspuns.motiv === 'cod expirat'
          ? 'Codul a expirat sau s-a greșit de prea multe ori. Cere altul.'
          : 'Codul nu mai e valabil. Cere altul.'
    return paginaCod(o, { csrf: csrfDinFormular, email, spre, eroare: text }, 400)
  }

  const cookieSesiune = construiesteCookie(NUME_COOKIE_SESIUNE, raspuns.sessionToken, {
    maxAge: raspuns.maxAge,
    domeniu: o.cfg.DOMENIU_COOKIE,
  })

  // ⚠️ Cookie-ul abia pleacă spre browser, deci `sesiuneCurenta` n-ar avea ce citi din cererea de
  // acum: cine e omul se află cu JETONUL în mână. Fără asta n-am ști `userId`-ul, iar abonarea —
  // adică tocmai pricina pentru care a scris codul — n-ar avea pe cine scrie.
  const sesiune = await sesiuneDupaJeton(env.IDENTITATE, raspuns.sessionToken)
  const proaspat = principalDin(sesiune)
  if (!proaspat) {
    // sesiunea s-a făcut, dar identitatea n-a recunoscut-o: omul e intrat, abonarea nu s-a scris
    return new Response(null, { status: 303, headers: { location: `${spre}?abonat=0`, 'set-cookie': cookieSesiune } })
  }

  const ok = await inscrie(env, a, proaspat)
  await o.audit?.({ action: `${a.prefixAudit}.subscribe`, target: a.audienta, outcome: ok ? 'success' : 'failure', actorId: proaspat.userId })
  return new Response(null, {
    status: 303,
    headers: { location: `${spre}?abonat=${ok ? 1 : 0}`, 'set-cookie': cookieSesiune },
  })
}
