import { alerta, esc, pagina, type Navigatie } from '@xc/ui'
import type { SesiuneCurenta } from '@xc/contracts'

export function paginaIntrare(o: {
  nav: Navigatie
  csrf: string
  mesaj?: string
  eroare?: string
  email?: string
}): string {
  return pagina({
    titlu: 'Intrare',
    activ: 'cont',
    navigatie: o.nav,
    continut: `
<div class="carte ingust">
  <h1>Intră cu emailul</h1>
  <p class="ajutor">Fără parolă: îți trimitem un link pe email, îl deschizi și ai intrat.</p>
  ${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
  ${o.mesaj ? alerta('info', o.mesaj) : ''}
  <form method="post" action="/auth/login">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="email">Adresă de email</label>
    <input id="email" name="email" type="email" required autocomplete="email"
           inputmode="email" autofocus value="${esc(o.email ?? '')}">
    <button type="submit">Trimite-mi linkul</button>
  </form>
  <p class="sub">Prima dată aici? <a href="/auth/inregistrare">Deschide un cont</a></p>
</div>`,
  })
}

export function paginaContNou(o: {
  nav: Navigatie
  csrf: string
  eroare?: string
  email?: string
  nume?: string
}): string {
  return pagina({
    titlu: 'Cont nou',
    activ: 'cont',
    navigatie: o.nav,
    continut: `
<div class="carte ingust">
  <h1>Cont nou</h1>
  <p class="ajutor">Spune-ne cum te cheamă și pe ce adresă să-ți trimitem linkul. Contul se deschide
  când îl apeși — nu e nevoie de parolă, nici acum, nici mai târziu.</p>
  ${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
  <form method="post" action="/auth/inregistrare">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="nume">Numele tău</label>
    <input id="nume" name="nume" type="text" required maxlength="120" autocomplete="name"
           autofocus value="${esc(o.nume ?? '')}">
    <label for="email">Adresă de email</label>
    <input id="email" name="email" type="email" required autocomplete="email"
           inputmode="email" value="${esc(o.email ?? '')}">
    <button type="submit">Trimite-mi linkul</button>
  </form>
  <p class="sub">Ai deja cont? <a href="/auth/login">Intră</a></p>
</div>`,
  })
}

/** Ecranul de dupa cererea linkului. In dev arata linkul, ca fluxul sa fie testabil fara email real. */
export function paginaAsteptareLink(o: {
  nav: Navigatie
  email: string
  linkDebug?: string | null
}): string {
  const cutieDebug = o.linkDebug
    ? alerta(
        'info',
        `<strong>Mediu de dezvoltare</strong> — niciun email nu pleacă în exterior.
         Linkul care ar fi fost trimis:<br><a href="${esc(o.linkDebug)}">${esc(o.linkDebug)}</a>`,
      )
    : ''

  return pagina({
    titlu: 'Verifică-ți emailul',
    activ: 'cont',
    navigatie: o.nav,
    continut: `
<div class="carte ingust">
  <h1>Verifică-ți emailul</h1>
  <p class="ajutor">Am trimis un link către <strong>${esc(o.email)}</strong>. E valabil 15 minute și
  poate fi folosit o singură dată. Dacă nu-l vezi, uită-te și la „Spam".</p>
  ${cutieDebug}
  <p class="sub"><a href="/auth/login">Trimite alt link</a></p>
</div>`,
  })
}

export function paginaProfil(o: {
  nav: Navigatie
  sesiune: SesiuneCurenta
  csrf: string
  mesaj?: string
}): string {
  const u = o.sesiune.user
  if (!u) return paginaIntrare({ nav: o.nav, csrf: o.csrf })

  const roluri = o.sesiune.roles.length
    ? o.sesiune.roles.map((r) => `<span class="eticheta">${esc(r.role)} · ${esc(r.scope)}</span>`).join(' ')
    : '<span class="eticheta">fără rol</span>'

  return pagina({
    titlu: 'Contul meu',
    utilizator: u.email,
    activ: 'cont',
    navigatie: o.nav,
    continut: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
<div class="carte">
  <h1>Contul meu</h1>
  <table>
    <tr><th>Email</th><td>${esc(u.email)}</td></tr>
    <tr><th>Nume</th><td>${esc(u.displayName ?? '—')}</td></tr>
    <tr><th>Roluri</th><td>${roluri}</td></tr>
    <tr><th>Sesiunea expiră</th><td>${esc(o.sesiune.expiresAt ?? '—')}</td></tr>
  </table>
</div>
<div class="carte">
  <h2>Numele afișat</h2>
  <form method="post" action="/auth/nume">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="nume">Cum să-ți spunem</label>
    <input id="nume" name="nume" type="text" required maxlength="120" value="${esc(u.displayName ?? '')}">
    <button type="submit" class="secundar">Salvează</button>
  </form>
</div>
<div class="carte">
  <h2>Siguranță</h2>
  <p class="ajutor">Închide toate sesiunile deschise, pe orice dispozitiv. Ca să intri din nou, ceri alt link.</p>
  <div class="randuri">
    <form method="post" action="/auth/revoca-tot">
      <input type="hidden" name="csrf" value="${esc(o.csrf)}">
      <button type="submit" class="secundar">Închide toate sesiunile</button>
    </form>
  </div>
</div>`,
  })
}

export function paginaMesaj(o: {
  nav: Navigatie
  titlu: string
  fel: 'rea' | 'buna'
  text: string
}): string {
  return pagina({
    titlu: o.titlu,
    activ: 'cont',
    navigatie: o.nav,
    continut: `
<div class="carte ingust">
  <h1>${esc(o.titlu)}</h1>
  ${alerta(o.fel, esc(o.text))}
  <p class="sub"><a href="/auth/login">Cere un link nou</a></p>
</div>`,
  })
}
