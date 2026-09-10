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
`

function comune(ctx: Ctx, utilizator: string | null = null) {
  return {
    nume: 'CONTUL',
    titlu: 'Contul',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: STIL,
    versiune: ctx.versiune,
    modificata: ctx.modificata,
    cont: { intrat: !!utilizator, nume: utilizator ?? 'Cont', urlCont: ctx.nav.cont, urlAdmin: ctx.nav.admin },
  }
}

export function paginaIntrare(o: { ctx: Ctx; csrf: string; mesaj?: string; eroare?: string; email?: string }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Intrare',
    corp: `
<h2>Intră cu emailul</h2>
<p>Fără parolă: îți trimitem un link pe email, îl deschizi și ai intrat.</p>
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
${o.mesaj ? alerta('info', o.mesaj) : ''}
<form class="bloc" method="post" action="${p}/auth/login">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <label for="email">Adresă de email</label>
  <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" autofocus value="${esc(o.email ?? '')}">
  <button type="submit" style="margin-top:12px">Trimite-mi linkul</button>
</form>
<p><small>Prima dată aici? <a href="${p}/auth/inregistrare">Deschide un cont</a></small></p>`,
  })
}

export function paginaContNou(o: { ctx: Ctx; csrf: string; eroare?: string; email?: string; nume?: string }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Cont nou',
    corp: `
<h2>Cont nou</h2>
<p>Spune-ne cum te cheamă și pe ce adresă să-ți trimitem linkul. Contul se deschide când îl apeși —
nu e nevoie de parolă, nici acum, nici mai târziu.</p>
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
<form class="bloc" method="post" action="${p}/auth/inregistrare">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <label for="nume">Numele tău</label>
  <input id="nume" name="nume" type="text" required maxlength="120" autocomplete="name" autofocus value="${esc(o.nume ?? '')}">
  <label for="email">Adresă de email</label>
  <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" value="${esc(o.email ?? '')}">
  <button type="submit" style="margin-top:12px">Trimite-mi linkul</button>
</form>
<p><small>Ai deja cont? <a href="${p}/auth/login">Intră</a></small></p>`,
  })
}

/** Ecranul de dupa cererea linkului. In dev arata linkul, ca fluxul sa fie testabil fara email real. */
export function paginaAsteptareLink(o: { ctx: Ctx; email: string; linkDebug?: string | null }): string {
  const p = esc(o.ctx.prefix)
  const cutieDebug = o.linkDebug
    ? alerta('info', `<b>Mediu de dezvoltare</b> — niciun email nu pleacă în exterior. Linkul care ar fi fost trimis:<br><a href="${esc(o.linkDebug)}">${esc(o.linkDebug)}</a>`)
    : ''
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Verifică-ți emailul',
    corp: `
<h2>Verifică-ți emailul</h2>
<p>Am trimis un link către <b>${esc(o.email)}</b>. E valabil 15 minute și poate fi folosit o singură dată.
Dacă nu-l vezi, uită-te și la „Spam".</p>
${cutieDebug}
<p><small><a href="${p}/auth/login">Trimite alt link</a></small></p>`,
  })
}

export function paginaProfil(o: { ctx: Ctx; sesiune: SesiuneCurenta; csrf: string; mesaj?: string }): string {
  const u = o.sesiune.user
  if (!u) return paginaIntrare({ ctx: o.ctx, csrf: o.csrf })
  const p = esc(o.ctx.prefix)
  const roluri = o.sesiune.roles.length
    ? o.sesiune.roles.map((r) => `<span>${esc(r.role)} · ${esc(r.scope)}</span>`).join(' ')
    : '<span>fără rol</span>'
  return pagina({
    ...comune(o.ctx, u.displayName ?? u.email),
    titluPagina: 'Contul meu',
    corp: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
<h2>Contul meu</h2>
<table>
  <tr><th>Email</th><td>${esc(u.email)}</td></tr>
  <tr><th>Nume</th><td>${esc(u.displayName ?? '—')}</td></tr>
  <tr><th>Roluri</th><td class="roluri">${roluri}</td></tr>
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
<p>Închide toate sesiunile deschise, pe orice dispozitiv. Ca să intri din nou, ceri alt link.</p>
<form method="post" action="${p}/auth/revoca-tot">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <button type="submit">Închide toate sesiunile</button>
</form>`,
  })
}

export function paginaMesaj(o: { ctx: Ctx; titlu: string; fel: 'rea' | 'buna'; text: string }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx),
    titluPagina: o.titlu,
    corp: `<h2>${esc(o.titlu)}</h2>${alerta(o.fel, esc(o.text))}<p><a href="${p}/auth/login">Cere un link nou</a></p>`,
  })
}
