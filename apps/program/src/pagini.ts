import { alerta, esc, pagina, type Navigatie } from '@xc/ui'
import type { EvenimentProgram } from '@xc/contracts'

/**
 * Contextul de adresare al aplicatiei: `prefix` e `/program` cand cererea vine prin gateway-ul
 * de preview (un singur host) si gol pe subdomeniul propriu; `nav` sunt adresele celorlalte
 * aplicatii, pentru antet si pentru trimiterea la intrare.
 */
export interface Ctx {
  prefix: string
  nav: Navigatie
}

function dataLizibila(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  })
}

export function paginaPublica(o: {
  ctx: Ctx
  evenimente: EvenimentProgram[]
  utilizator?: string | null
}): string {
  const randuri = o.evenimente
    .map(
      (e) => `<tr>
        <td><strong>${esc(e.title)}</strong>${e.location ? `<br><span style="color:var(--sters);font-size:.88rem">${esc(e.location)}</span>` : ''}</td>
        <td>${esc(dataLizibila(e.startsAt))}</td>
      </tr>`,
    )
    .join('')

  return pagina({
    titlu: 'Program',
    activ: 'program',
    navigatie: o.ctx.nav,
    utilizator: o.utilizator ?? null,
    continut: `
<div class="carte">
  <h1>Program</h1>
  <p class="ajutor">Evenimentele publicate ale parohiei.</p>
  ${
    o.evenimente.length
      ? `<table><thead><tr><th>Eveniment</th><th>Când</th></tr></thead><tbody>${randuri}</tbody></table>`
      : '<p class="gol">Niciun eveniment publicat încă.</p>'
  }
  ${o.utilizator ? `<p class="sub"><a href="${esc(o.ctx.prefix)}/admin">Administrare</a></p>` : ''}
</div>`,
  })
}

export function paginaAdministrare(o: {
  ctx: Ctx
  evenimente: EvenimentProgram[]
  csrf: string
  utilizator: string
  mesaj?: string
  eroare?: string
}): string {
  const p = esc(o.ctx.prefix)
  const randuri = o.evenimente
    .map(
      (e) => `<tr>
        <td><strong>${esc(e.title)}</strong></td>
        <td>${esc(dataLizibila(e.startsAt))}</td>
        <td><span class="eticheta ${e.status === 'published' ? 'publicat' : ''}">${esc(e.status)}</span></td>
        <td>
          <div class="randuri">
          ${
            e.status === 'draft'
              ? `<form method="post" action="${p}/publica">
                   <input type="hidden" name="csrf" value="${esc(o.csrf)}">
                   <input type="hidden" name="id" value="${esc(e.id)}">
                   <button type="submit">Publică</button>
                 </form>`
              : ''
          }
          ${
            e.status !== 'archived'
              ? `<form method="post" action="${p}/arhiveaza">
                   <input type="hidden" name="csrf" value="${esc(o.csrf)}">
                   <input type="hidden" name="id" value="${esc(e.id)}">
                   <button type="submit" class="secundar">Arhivează</button>
                 </form>`
              : ''
          }
          </div>
        </td>
      </tr>`,
    )
    .join('')

  return pagina({
    titlu: 'Program — administrare',
    activ: 'program',
    navigatie: o.ctx.nav,
    utilizator: o.utilizator,
    continut: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
<div class="carte">
  <h1>Administrare program</h1>
  <p class="ajutor">Ciclul unui eveniment: ciornă → publicat → arhivat. Publicarea declanșează
  o cerere de notificare, înregistrată dar netrimisă în această fază.</p>
  ${
    o.evenimente.length
      ? `<table><thead><tr><th>Eveniment</th><th>Când</th><th>Stare</th><th></th></tr></thead><tbody>${randuri}</tbody></table>`
      : '<p class="gol">Niciun eveniment. Adaugă primul mai jos.</p>'
  }
</div>
<div class="carte">
  <h2>Eveniment nou</h2>
  <form method="post" action="${p}/creeaza">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="titlu">Titlu</label>
    <input id="titlu" name="titlu" type="text" required maxlength="200">
    <label for="loc">Loc</label>
    <input id="loc" name="loc" type="text" maxlength="200">
    <label for="inceput">Început</label>
    <input id="inceput" name="inceput" type="datetime-local" required>
    <label for="descriere">Descriere</label>
    <textarea id="descriere" name="descriere" rows="3" maxlength="5000"></textarea>
    <button type="submit">Salvează ca ciornă</button>
  </form>
</div>`,
  })
}

export function paginaRefuz(ctx: Ctx, motiv: string, utilizator?: string | null): string {
  return pagina({
    titlu: 'Acces refuzat',
    activ: 'program',
    navigatie: ctx.nav,
    utilizator: utilizator ?? null,
    continut: `
<div class="carte ingust">
  <h1>Acces refuzat</h1>
  ${alerta('rea', esc(motiv))}
  <p class="sub"><a href="${esc(ctx.prefix)}/">Înapoi la program</a></p>
</div>`,
  })
}
