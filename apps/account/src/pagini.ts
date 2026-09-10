import { alerta, esc, pagina } from '@xc/ui'
import type { SesiuneCurenta } from '@xc/contracts'

export function paginaLogin(o: {
  csrf: string
  mesaj?: string
  eroare?: string
  email?: string
}): string {
  return pagina({
    titlu: 'Autentificare',
    activ: '/',
    continut: `
<div class="carte ingust">
  <h1>Autentificare</h1>
  <p class="ajutor">Introdu adresa și parola. Apoi îți trimitem un link de confirmare pe email — sesiunea se creează abia după ce îl deschizi.</p>
  ${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
  ${o.mesaj ? alerta('info', o.mesaj) : ''}
  <form method="post" action="/auth/login">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="email">Adresă de email</label>
    <input id="email" name="email" type="email" required autocomplete="username"
           inputmode="email" value="${esc(o.email ?? '')}">
    <label for="parola">Parolă</label>
    <input id="parola" name="parola" type="password" required autocomplete="current-password">
    <button type="submit">Trimite linkul de confirmare</button>
  </form>
  <p class="sub">Nu ai cont? <a href="/auth/inregistrare">Creează unul</a></p>
</div>`,
  })
}

export function paginaInregistrare(o: {
  csrf: string
  eroare?: string
  email?: string
}): string {
  return pagina({
    titlu: 'Cont nou',
    activ: '/',
    continut: `
<div class="carte ingust">
  <h1>Cont nou</h1>
  <p class="ajutor">Parola trebuie să aibă cel puțin 12 caractere.</p>
  ${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
  <form method="post" action="/auth/inregistrare">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="nume">Nume afișat</label>
    <input id="nume" name="nume" type="text" autocomplete="name">
    <label for="email">Adresă de email</label>
    <input id="email" name="email" type="email" required autocomplete="username"
           inputmode="email" value="${esc(o.email ?? '')}">
    <label for="parola">Parolă</label>
    <input id="parola" name="parola" type="password" required autocomplete="new-password"
           minlength="12">
    <button type="submit">Creează contul</button>
  </form>
  <p class="sub">Ai deja cont? <a href="/auth/login">Autentifică-te</a></p>
</div>`,
  })
}

/** Ecranul de după pasul 1. În dev arată linkul, ca fluxul să fie testabil fără email real. */
export function paginaAsteptareConfirmare(o: { email: string; linkDebug?: string | null }): string {
  const cutieDebug = o.linkDebug
    ? alerta(
        'info',
        `<strong>Mediu de dezvoltare</strong> — niciun email nu pleacă în exterior.
         Linkul care ar fi fost trimis:<br><a href="${esc(o.linkDebug)}">${esc(o.linkDebug)}</a>`,
      )
    : ''

  return pagina({
    titlu: 'Confirmă autentificarea',
    activ: '/',
    continut: `
<div class="carte ingust">
  <h1>Verifică-ți emailul</h1>
  <p class="ajutor">Dacă adresa <strong>${esc(o.email)}</strong> are cont la noi, a plecat spre ea
  un link de confirmare. E valabil 15 minute și poate fi folosit o singură dată.</p>
  ${cutieDebug}
  <p class="sub"><a href="/auth/login">Înapoi la autentificare</a></p>
</div>`,
  })
}

export function paginaProfil(o: {
  sesiune: SesiuneCurenta
  csrf: string
  mesaj?: string
}): string {
  const u = o.sesiune.user
  if (!u) return paginaLogin({ csrf: o.csrf })

  const roluri = o.sesiune.roles.length
    ? o.sesiune.roles.map((r) => `<span class="eticheta">${esc(r.role)} · ${esc(r.scope)}</span>`).join(' ')
    : '<span class="eticheta">fără rol</span>'

  return pagina({
    titlu: 'Contul meu',
    utilizator: u.email,
    activ: '/',
    continut: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
<div class="carte">
  <h1>Contul meu</h1>
  <p class="ajutor">Datele sesiunii curente.</p>
  <table>
    <tr><th>Email</th><td>${esc(u.email)}</td></tr>
    <tr><th>Nume</th><td>${esc(u.displayName ?? '—')}</td></tr>
    <tr><th>Email confirmat</th><td>${u.emailVerifiedAt ? 'da' : 'nu'}</td></tr>
    <tr><th>Roluri</th><td>${roluri}</td></tr>
    <tr><th>Sesiunea expiră</th><td>${esc(o.sesiune.expiresAt ?? '—')}</td></tr>
  </table>
</div>
<div class="carte">
  <h2>Siguranță</h2>
  <p class="ajutor">Închide toate sesiunile deschise, pe orice dispozitiv. Va trebui să te autentifici din nou.</p>
  <div class="randuri">
    <form method="post" action="/auth/revoca-tot">
      <input type="hidden" name="csrf" value="${esc(o.csrf)}">
      <button type="submit" class="secundar">Închide toate sesiunile</button>
    </form>
  </div>
</div>`,
  })
}

export function paginaMesaj(o: { titlu: string; fel: 'rea' | 'buna'; text: string }): string {
  return pagina({
    titlu: o.titlu,
    continut: `
<div class="carte ingust">
  <h1>${esc(o.titlu)}</h1>
  ${alerta(o.fel, esc(o.text))}
  <p class="sub"><a href="/auth/login">Mergi la autentificare</a></p>
</div>`,
  })
}
