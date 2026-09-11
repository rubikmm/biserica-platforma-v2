import type { Navigatie } from '@xc/config'
import { alerta, esc, pagina } from '@xc/ui'
import type { SesiuneCurenta } from '@xc/contracts'

export interface Ctx {
  prefix: string
  nav: Navigatie
  versiune: string
  modificata: string
}

const STIL = `
.roluri span { display:inline-block; border:1px solid var(--rule); border-radius:999px;
               padding:1px 8px; font:12px ui-sans-serif,system-ui; color:var(--soft); margin-right:6px }
form.bloc { display:block; max-width:420px }
form.bloc input { width:100% }
/* Cele sase casute, 3-3, ca sa se potriveasca la ochi cu „123 456" din scrisoare
   (cerere user, 10.09.2026). */
.cod-casute { display:flex; align-items:center; gap:8px; margin:16px 0 4px }
.cod-casute input { width:46px; height:56px; padding:0; text-align:center;
                    font:600 24px/1 ui-sans-serif,system-ui; color:var(--ink);
                    background:var(--paper); border:1px solid var(--rule); border-radius:10px }
.cod-casute input:focus { border-color:var(--rosu); outline:none }
.cod-casute .rupe { width:8px }
form.cod { max-width:420px }
form.cod input[type=hidden] { width:auto }
.din-nou { background:none; border:0; padding:0; width:auto; color:var(--rosu);
           font:inherit; text-decoration:underline; cursor:pointer }
@media (max-width:380px) {
  .cod-casute { gap:6px }
  .cod-casute input { width:40px; height:50px; font-size:21px }
}
`

/**
 * Ce trebuie sa stie carcasa despre omul de la tastatura. `veziCa`/`poateVedeaCa` vin din
 * sesiune, calculate de identitate — aplicatia nu citeste roluri ca sa deseneze meniul.
 */
export interface Cine {
  nume?: string | null
  veziCa?: string | null
  poateVedeaCa?: boolean
  /** Pagina de acum, ca „Vezi ca" sa se intoarca exact aici. */
  spre?: string
}

function comune(ctx: Ctx, cine: Cine = {}) {
  return {
    nume: 'CONTUL',
    titlu: 'Contul',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: STIL,
    versiune: ctx.versiune,
    modificata: ctx.modificata,
    cont: {
      intrat: !!cine.nume,
      nume: cine.nume ?? 'Cont',
      urlCont: ctx.nav.cont,
      urlAdmin: ctx.nav.admin,
      poateVedeaCa: cine.poateVedeaCa ?? false,
      veziCa: cine.veziCa ?? null,
      spre: cine.spre ?? '',
    },
  }
}

/**
 * Pagina de unde a plecat omul, purtata prin tot fluxul de intrare (user, 11.09.2026: „ideal ar fi
 * să mă întoarcă în pagina din care am plecat"). Trece din link in camp ascuns si inapoi in link,
 * la fiecare pas, fiindca intre „scrie adresa" si „scrie codul" sunt doua formulare.
 */
function campSpre(spre?: string): string {
  return spre ? `\n  <input type="hidden" name="spre" value="${esc(spre)}">` : ''
}

function intrebareSpre(spre?: string): string {
  return spre ? `?spre=${encodeURIComponent(spre)}` : ''
}

export function paginaIntrare(o: {
  ctx: Ctx
  csrf: string
  mesaj?: string
  eroare?: string
  email?: string
  /** Pagina de unde a plecat omul: se duce mai departe prin tot fluxul si il aduce inapoi acolo. */
  spre?: string
  cine?: Cine
}): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx, o.cine),
    titluPagina: 'Intrare',
    corp: `
<h2>Intră cu emailul</h2>
<p>Fără parolă: îți scriem un cod de șase cifre, îl treci aici și ai intrat.</p>
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
${o.mesaj ? alerta('info', o.mesaj) : ''}
<form class="bloc" method="post" action="${p}/auth/login">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">${campSpre(o.spre)}
  <label for="email">Adresă de email</label>
  <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" autofocus value="${esc(o.email ?? '')}">
  <button type="submit" style="margin-top:12px">Trimite-mi codul</button>
</form>
<p><small>Prima dată aici? <a href="${p}/auth/inregistrare${intrebareSpre(o.spre)}">Deschide un cont</a></small></p>`,
  })
}

export function paginaContNou(o: {
  ctx: Ctx
  csrf: string
  eroare?: string
  email?: string
  nume?: string
  spre?: string
  cine?: Cine
}): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx, o.cine),
    titluPagina: 'Cont nou',
    corp: `
<h2>Cont nou</h2>
<p>Spune-ne cum te cheamă și pe ce adresă să-ți trimitem codul. Contul se deschide când îl scrii —
nu e nevoie de parolă, nici acum, nici mai târziu.</p>
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
<form class="bloc" method="post" action="${p}/auth/inregistrare">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">${campSpre(o.spre)}
  <label for="nume">Numele tău</label>
  <input id="nume" name="nume" type="text" required maxlength="120" autocomplete="name" autofocus value="${esc(o.nume ?? '')}">
  <label for="email">Adresă de email</label>
  <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" value="${esc(o.email ?? '')}">
  <button type="submit" style="margin-top:12px">Trimite-mi codul</button>
</form>
<p><small>Ai deja cont? <a href="${p}/auth/login${intrebareSpre(o.spre)}">Intră</a></small></p>`,
  })
}

/**
 * Cele sase casute, grupate 3-3 (cerere user, 10.09.2026): asa se potrivesc la ochi cu
 * `123 456` din scrisoare. Sunt sase CAMPURI adevarate, nu unul deghizat — fara JS se pot
 * completa una cate una, iar serverul le lipeste. Cu JS: trecerea singura de la o casuta la
 * urmatoarea, Backspace inapoi, lipirea intregului cod dintr-o data si trimiterea la a sasea
 * cifra.
 */
const CASUTE = `
<div class="cod-casute" id="casute">${[1, 2, 3, 4, 5, 6]
  .map(
    (i) =>
      `${i === 4 ? '<span class="rupe"></span>' : ''}<input name="c${i}" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="one-time-code" aria-label="Cifra ${i}"${i === 1 ? ' autofocus' : ''} required>`,
  )
  .join('')}</div>`

const JS_CASUTE = `
(function(){
  var d=document.getElementById("casute"); if(!d) return;
  var c=[].slice.call(d.querySelectorAll("input"));
  var f=c[0].form;
  function pune(v,de){ // scrie cifrele din v incepand de la casuta 'de'
    var cif=v.replace(/\\D/g,"").split("");
    if(!cif.length){ c[de].value=""; return } // ce nu e cifra nu ramane pe ecran
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

/** Ecranul cu cele sase cifre. In dev arata codul, ca fluxul sa fie testabil fara email real. */
export function paginaCod(o: {
  ctx: Ctx
  csrf: string
  email: string
  nume?: string | null
  eroare?: string
  codDebug?: string | null
  spre?: string
  cine?: Cine
}): string {
  const p = esc(o.ctx.prefix)
  const cutieDebug = o.codDebug
    ? alerta(
        'info',
        `<b>Mediu de dezvoltare</b> — niciun email nu pleacă în exterior. Codul care ar fi fost trimis: <b>${esc(
          `${o.codDebug.slice(0, 3)} ${o.codDebug.slice(3)}`,
        )}</b>`,
      )
    : ''
  const ascunse = `<input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <input type="hidden" name="email" value="${esc(o.email)}">${campSpre(o.spre)}${
    o.nume ? `\n  <input type="hidden" name="nume" value="${esc(o.nume)}">` : ''
  }`
  return pagina({
    ...comune(o.ctx, o.cine),
    titluPagina: 'Codul din email',
    corp: `
<h2>Scrie codul din email</h2>
<p>Am trimis un cod de șase cifre la <b>${esc(o.email)}</b>. Este bun zece minute.
Dacă nu ajunge, uită-te și în „Spam".</p>
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
${cutieDebug}
<form class="cod" method="post" action="${p}/auth/cod">
  ${ascunse}
  ${CASUTE}
  <button type="submit" style="margin-top:12px">Intră</button>
</form>
<form class="cod" method="post" action="${p}/auth/cod-din-nou" style="margin-top:10px">
  ${ascunse}
  <p><small>Nu a ajuns? <button type="submit" class="din-nou">Trimite alt cod</button></small></p>
</form>
<p><small><a href="${p}/auth/login">Schimbă adresa</a></small></p>`,
    scripturi: JS_CASUTE,
  })
}

export function paginaProfil(o: {
  ctx: Ctx
  sesiune: SesiuneCurenta
  csrf: string
  mesaj?: string
  spre?: string
}): string {
  const u = o.sesiune.user
  if (!u) return paginaIntrare({ ctx: o.ctx, csrf: o.csrf })
  const p = esc(o.ctx.prefix)
  const roluri = o.sesiune.roles.length
    ? o.sesiune.roles.map((r) => `<span>${esc(r.role)} · ${esc(r.scope)}</span>`).join(' ')
    : '<span>fără rol</span>'
  return pagina({
    ...comune(o.ctx, {
      nume: u.displayName ?? u.email,
      veziCa: o.sesiune.veziCa,
      poateVedeaCa: o.sesiune.poateVedeaCa,
      ...(o.spre ? { spre: o.spre } : {}),
    }),
    titluPagina: 'Contul meu',
    corp: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
<h2>Contul meu</h2>
<table>
  <tr><th>Email</th><td>${esc(u.email)}</td></tr>
  <tr><th>Nume</th><td>${esc(u.displayName ?? '—')}</td></tr>
  <tr><th>Roluri</th><td class="roluri">${roluri}${
    o.sesiune.veziCa
      ? ` <small>(te uiți ca ${esc(o.sesiune.veziCa)}; rolul tău a rămas neatins)</small>`
      : ''
  }</td></tr>
  <tr><th>Sesiunea expiră</th><td>${esc(o.sesiune.expiresAt ?? '—')}</td></tr>
</table>

<h3>Numele afișat</h3>
<form class="bloc" method="post" action="${p}/auth/nume">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <label for="nume">Cum să-ți spunem</label>
  <input id="nume" name="nume" type="text" required maxlength="120" value="${esc(u.displayName ?? '')}">
  <button type="submit" style="margin-top:12px">Salvează</button>
</form>

<h3>Siguranță</h3>
<p>Închide toate sesiunile deschise, pe orice dispozitiv. Ca să intri din nou, ceri alt cod.</p>
<form method="post" action="${p}/auth/revoca-tot">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <button type="submit">Închide toate sesiunile</button>
</form>`,
  })
}

export function paginaMesaj(o: {
  ctx: Ctx
  titlu: string
  fel: 'rea' | 'buna'
  text: string
  cine?: Cine
}): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx, o.cine),
    titluPagina: o.titlu,
    corp: `<h2>${esc(o.titlu)}</h2>${alerta(o.fel, esc(o.text))}<p><a href="${p}/auth/login">Cere un cod nou</a></p>`,
  })
}
