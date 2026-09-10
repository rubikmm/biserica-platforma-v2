/**
 * Paginile programului liturgic, pe carcasa comuna (grafica V1): saptamana (programul scris sau
 * propunerea ei, in aceeasi asezare), arhiva, scrierea si validarea.
 */
import type { IntrareVocabular, Slujba, StareSaptamana } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, ZILE_SAPTAMANA, adaugaZile, alerta, esc, intervalLizibil, momentLizibil, pagina, ziuaSaptamanii } from '@xc/ui'
import type { CalendarSaptamana, ZiPeProgram } from './calendar.js'
import { ziRosie } from './calendar.js'
import { randurileSlujbei } from './foaie.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  poateScrie: boolean
  versiune: string
  modificata: string
}

export const STIL = `
.cap-sapt { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin:0 0 6px }
.cap-sapt h2 { margin:0 }
.stare { font:600 10.5px/1.4 ui-sans-serif,system-ui; letter-spacing:.09em; text-transform:uppercase;
         padding:2px 8px; border:1px solid var(--rule); border-radius:999px; color:var(--faint) }
.stare.validat { border-color:#2E8A4A; color:#2E8A4A }
.stare.propus, .stare.propunere { border-color:#B8860B; color:#8A5A00 }
.zi { padding:12px 0; border-bottom:1px solid var(--rule) }
.zi:last-child, .zi.ultima { border-bottom:0 }
.zi h3 { margin:0 0 6px; display:flex; align-items:baseline; gap:10px; font-size:17px }
.zi h3 .dr { margin-left:auto; font:13px ui-sans-serif,system-ui; font-weight:400; white-space:nowrap }
.zi h3 .dr svg { vertical-align:-3px }
.zi.rosie h3 { color:var(--rosu) }
.zi.azi h3::after { content:"AZI"; font:600 9.5px/1.4 ui-sans-serif,system-ui; letter-spacing:.1em;
                    background:var(--azi); color:#06301A; padding:1px 6px; border-radius:999px }
body:not(.cu-calendar) .zi.goala { display:none }
.slujba { display:grid; grid-template-columns:56px 1fr; gap:10px; padding:4px 0 }
.slujba .ora { color:var(--faint); font:15px ui-sans-serif,system-ui; font-variant-numeric:tabular-nums }
.slujba .nume { font-weight:600 }
.slujba .nume.dimineata { color:var(--rosu) }
.slujba .det { font-size:15.5px; padding-left:1.1em; text-indent:-1.1em }
.slujba .det::before { content:"→ "; color:var(--faint) }
.slujba .det.per { padding-left:0; text-indent:0; color:var(--faint); font:13.5px/1.5 ui-sans-serif,system-ui }
.slujba .det.per::before { content:"" }
.slujba .det.rosu { color:var(--rosu); font-weight:600 }
.slujba .det.bold { font-weight:600 }
.slujba .slujitor { color:var(--faint); font:13px ui-sans-serif,system-ui }
.cal { display:none; margin:2px 0 8px; font-size:15.5px }
body.cu-calendar .cal { display:block }
.cal .note { color:var(--faint); font:13px ui-sans-serif,system-ui }
.cal .aprox { color:var(--faint); font:13px ui-sans-serif,system-ui; font-style:italic }
.an-baton { margin:0 0 18px }
.an-baton h3 { margin:0 0 6px; font:600 12px/1.4 ui-sans-serif,system-ui; letter-spacing:.08em;
               text-transform:uppercase; color:var(--faint) }
.baton { display:grid; grid-template-columns:repeat(auto-fit, minmax(128px, 1fr));
         border:1px solid var(--rule); border-radius:10px; overflow:hidden }
.baton a { padding:9px 10px; text-decoration:none; color:var(--ink); background:var(--paper);
           box-shadow:inset -1px -1px 0 var(--rule) }
.baton a:hover { background:var(--tinta) }
.baton .per { display:block; font:600 14px/1.3 ui-sans-serif,system-ui }
.baton .nr { font:12px ui-sans-serif,system-ui; color:var(--faint) }
.baton .st { font:11px ui-sans-serif,system-ui; color:#8A5A00 }
.rand-form { display:grid; grid-template-columns:9rem 7rem 1fr; gap:10px; align-items:start;
             padding:10px 0; border-bottom:1px solid var(--rule) }
.rand-form textarea { width:100%; min-height:3.4rem }
.rand-form input, .rand-form select { width:100% }
.rand-form .bife { font:12px ui-sans-serif,system-ui; color:var(--faint) }
.rand-form .bife input { width:auto; margin-right:4px }
@media (max-width:640px) { .rand-form { grid-template-columns:1fr } }
form.bloc { display:block }
`

export const SCRIPT = `
(function(){
  var cheie = 'program_calendar';
  function pune(pornit){
    document.body.classList.toggle('cu-calendar', pornit);
    try { localStorage.setItem(cheie, pornit ? '1' : '0'); } catch (e) {}
    var b = document.getElementById('bt-cal');
    if (b) { b.setAttribute('aria-pressed', pornit ? 'true' : 'false');
             b.textContent = pornit ? 'Ascunde calendarul' : 'Afișează calendarul'; }
  }
  var pornit = false; try { pornit = localStorage.getItem(cheie) === '1'; } catch (e) {}
  pune(pornit);
  var b = document.getElementById('bt-cal');
  if (b) b.addEventListener('click', function(){ pune(!document.body.classList.contains('cu-calendar')); });
})();`

// ---------------------------------------------------------------------------
// Bucati comune
// ---------------------------------------------------------------------------

function contDin(ctx: Ctx) {
  return { intrat: !!ctx.utilizator, nume: ctx.utilizator ?? 'Cont', admin: ctx.eAdmin, urlCont: ctx.nav.cont, urlAdmin: ctx.nav.admin }
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

function blocCalendar(z: ZiPeProgram | undefined): string {
  if (!z) return ''
  const note = z.note.length ? `<div class="note">${esc(z.note.join(' · '))}</div>` : ''
  const aprox = z.aproximativ ? '<div class="aprox">calendar împrumutat din anul curent — aproximativ</div>' : ''
  return `<div class="cal">${z.titlu_html || esc(z.titlu)}${note}${aprox}</div>`
}

function slujbaHtml(s: Slujba, vocabular: Map<string, IntrareVocabular>, zi: ZiPeProgram | undefined, maine: ZiPeProgram | undefined, dinCalendar: boolean, granita: string): string {
  const categorie = vocabular.get(s.cod_nume)?.categorie
  const randuri = randurileSlujbei(s, categorie, zi, maine, dinCalendar, granita)
  const det = randuri.map((r) => `<div class="det${r.pericopa ? ' per' : ''}${r.rosu ? ' rosu' : ''}${r.bold ? ' bold' : ''}">${esc(r.text)}</div>`).join('')
  const slujitor = s.slujitor ? `<div class="slujitor">${esc(s.slujitor)}</div>` : ''
  return `<div class="slujba"><div class="ora">${esc(s.ora)}</div><div><div class="nume${categorie === 'dimineata' ? ' dimineata' : ''}">${esc(s.nume)}</div>${det}${slujitor}</div></div>`
}

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
}): string {
  const z = o.cal?.zile.get(o.data)
  const maine = o.cal?.zile.get(adaugaZile(o.data, 1))
  const zs = ziuaSaptamanii(o.data)
  const clase = ['zi']
  if (zs === 0 || (z && ziRosie(z))) clase.push('rosie')
  if (o.data === o.azi) clase.push('azi')
  if (!o.slujbe.length) clase.push('goala')
  if (o.ultima) clase.push('ultima')
  const [, l, zi] = o.data.split('-').map(Number) as [number, number, number]
  const buton =
    zs === 0
      ? `<a class="dr" href="${esc(o.ctx.prefix)}/v1/sfintii-zilei/${o.data}.pdf" target="_blank" rel="noopener" title="Sfinții zilei, fișier PDF — de tipărit și citit la sfârșitul Sfintei Liturghii">${ICOANE.foaie} Sfinții zilei</a>`
      : ''
  const slujbe = o.slujbe.map((s) => slujbaHtml(s, o.vocabular, z, maine, o.dinCalendar, o.granita)).join('')
  return `<section class="${clase.join(' ')}">
  <h3>${esc(ZILE_SAPTAMANA[zs] ?? '')}, ${zi} ${esc(LUNI[l - 1] ?? '')}${buton}</h3>
  ${blocCalendar(z)}
  ${slujbe}
</section>`
}

function unelte(ctx: Ctx, cale: string, abonat: boolean): string {
  const p = esc(ctx.prefix)
  const abonare = !ctx.utilizator
    ? `<a class="btn" href="${esc(ctx.nav.cont)}/auth/login">Abonează-te</a>`
    : `<form method="post" action="${p}/${abonat ? 'dezabonare' : 'abonare'}" style="margin:0"><input type="hidden" name="spre" value="${esc(cale)}"><button class="btn" type="submit">${abonat ? 'Dezabonează-te' : 'Abonează-te'}</button></form>`
  const calendar = `<button class="btn" type="button" id="bt-cal" aria-pressed="false">Afișează calendarul</button>`
  const scrie = ctx.poateScrie ? `<a class="btn" href="${p}/admin">Scrie programul</a>` : ''
  return `${abonare}${calendar}${scrie}`
}

function navSaptamana(ctx: Ctx, vecini: { inainte: string | null; dupa: string | null }, foaie: string | null, peArhiva = false): string {
  const p = esc(ctx.prefix)
  const inainte = vecini.inainte ? `<a href="${p}/saptamana/${vecini.inainte}">◀</a>` : `<b class="acum" style="opacity:.35">◀</b>`
  const bulina = `<a href="${p}/saptamana/azi" title="săptămâna de azi">●</a>`
  const dupa = vecini.dupa
    ? `<a href="${p}/saptamana/${vecini.dupa}">▶</a>`
    : `<b class="acum" style="opacity:.35" title="Înainte se vede o singură săptămână — cea viitoare, cu propunerea ei">▶</b>`
  const arhiva = peArhiva ? `<b class="acum">${ICOANE.arhiva} Arhiva</b>` : `<a href="${p}/arhiva" title="Arhiva programelor">${ICOANE.arhiva} Arhiva</a>`
  const hartii = foaie
    ? `<a href="${p}${foaie}.pdf" target="_blank" rel="noopener" title="Foaia A4, de tipărit">PDF</a><a href="${p}${foaie}.jpg" target="_blank" rel="noopener" title="Foaia ca poză, de trimis pe WhatsApp">JPG</a>`
    : `<b class="acum" style="opacity:.35" title="Foaia se deschide de pe pagina unei săptămâni cu program validat">PDF</b><b class="acum" style="opacity:.35">JPG</b>`
  return `<nav class="capitole fara-tipar">${inainte}${bulina}${dupa}${arhiva}${hartii}</nav>`
}

// ---------------------------------------------------------------------------
// Pagina saptamanii
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
  vecini: { inainte: string | null; dupa: string | null }
  foaie: string | null
  azi: string
  cale: string
  abonat: boolean
  mesaj?: string
  nelamuriri?: string[]
  validatLa?: string | null
}

export function paginaSaptamana(o: OptiuniSaptamana): string {
  const duminica = adaugaZile(o.luni, 6)
  const cuSlujbe = o.slujbe.map((s) => s.data)
  const ultimaCuSlujbe = cuSlujbe.length ? cuSlujbe[cuSlujbe.length - 1] : null
  const zile: string[] = []
  for (let i = 0; i < 7; i++) {
    const data = adaugaZile(o.luni, i)
    const ale = o.slujbe.filter((s) => s.data === data)
    if (!ale.length && !o.cal?.zile.get(data)) continue
    zile.push(ziuaHtml({ ctx: o.ctx, data, slujbe: ale, vocabular: o.vocabular, cal: o.cal, dinCalendar: o.dinCalendar, granita: duminica, azi: o.azi, ultima: data === ultimaCuSlujbe }))
  }
  const eticheta = o.stare === 'propunere' ? 'propunere' : o.stare === 'modificat_dupa_validare' ? 'modificat după validare' : o.stare
  const validare = o.stare === 'validat' && o.validatLa ? `<p><small>Validat · ${esc(momentLizibil(o.validatLa))}</small></p>` : ''
  const nelamuriri = o.nelamuriri?.length ? `<details><summary>Nelămuriri</summary><ul>${o.nelamuriri.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''
  const gol = o.stare === 'propunere' ? 'Nimic de propus — istoricul nu spune nimic despre această săptămână.' : 'Săptămână fără slujbe înregistrate.'
  return pagina({
    ...comune(o.ctx),
    titluPagina: o.titlu,
    indexabil: true,
    unelte: unelte(o.ctx, o.cale, o.abonat),
    subantet: navSaptamana(o.ctx, o.vecini, o.foaie),
    scripturi: SCRIPT,
    corp: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
<div class="cap-sapt"><h2>${esc(o.titlu)}</h2><span class="stare ${esc(String(o.stare))}">${esc(String(eticheta))}</span></div>
${validare}
${zile.join('') || `<p class="gol">${esc(gol)}</p>`}
${nelamuriri}`,
  })
}

// ---------------------------------------------------------------------------
// Arhiva
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

export function paginaArhiva(o: { ctx: Ctx; an: number; ani: number[]; saptamani: RezumatArhiva[]; total: number; deLa: string | null }): string {
  const p = esc(o.ctx.prefix)
  const ani = o.ani.map((a) => (a === o.an ? `<b class="acum">${a}</b>` : `<a href="${p}/arhiva?an=${a}">${a}</a>`)).join('')
  const peLuni = new Map<number, RezumatArhiva[]>()
  for (const s of [...o.saptamani].sort((a, b) => a.luni.localeCompare(b.luni))) {
    const l = Number(s.luni.slice(5, 7))
    const lista = peLuni.get(l) ?? []
    lista.push(s)
    peLuni.set(l, lista)
  }
  const luni = [...peLuni.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([l, lista]) => {
      const zone = lista
        .map((s) => {
          const stare = s.stare === 'validat' ? '' : `<span class="st">${esc(s.stare === 'modificat_dupa_validare' ? 'modificat' : s.stare)}</span>`
          const nr = `${s.nr_slujbe} ${s.nr_slujbe === 1 ? 'slujbă' : 'slujbe'}`
          return `<a href="${p}/saptamana/${s.luni}"><span class="per">${esc(perioadaScurta(s.luni, s.duminica))}</span><span class="nr">${esc(nr)}</span> ${stare}</a>`
        })
        .join('')
      return `<div class="an-baton"><h3>${esc(LUNI[l - 1] ?? '')}</h3><div class="baton">${zone}</div></div>`
    })
    .join('')
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Arhiva programelor',
    subantet: navSaptamana(o.ctx, { inainte: null, dupa: null }, null, true),
    corp: `
<h2>Arhiva programelor</h2>
<p>${o.total} săptămâni${o.deLa ? `, din ${esc(o.deLa.slice(0, 4))} până azi` : ''}. Importate din site-ul vechi; se completează de aici înainte.</p>
<nav class="capitole">${ani}</nav>
<h3>${o.an} · ${o.saptamani.length} săptămâni</h3>
${luni || '<p class="gol">Niciun program în anul acesta.</p>'}`,
  })
}

// ---------------------------------------------------------------------------
// Scrierea si validarea
// ---------------------------------------------------------------------------

export interface RandDeEditat {
  data: string
  ora: string
  cod_nume: string
  slujitor: string
  detalii: string
  curatenie: boolean
  transmisie: boolean
}

export function paginaAdmin(o: {
  ctx: Ctx
  luni: string
  titlu: string
  stare: StareSaptamana | 'propunere'
  randuri: RandDeEditat[]
  vocabular: IntrareVocabular[]
  csrf: string
  existaSaptamana: boolean
  dinPropunere: boolean
  versiuneCalendar: string | null
  istoric: Array<{ moment: string; ce: string; detalii: string | null }>
  mesaj?: string
  eroare?: string
}): string {
  const p = esc(o.ctx.prefix)
  const zile = Array.from({ length: 7 }, (_, i) => adaugaZile(o.luni, i))
  const optiuniZi = (aleasa: string) =>
    zile
      .map((d) => {
        const zs = ziuaSaptamanii(d)
        const [, l, z] = d.split('-').map(Number) as [number, number, number]
        return `<option value="${d}"${d === aleasa ? ' selected' : ''}>${esc(ZILE_SAPTAMANA[zs] ?? '')} ${z} ${esc(LUNI[l - 1] ?? '')}</option>`
      })
      .join('')
  const optiuniCod = (ales: string) =>
    ['<option value="">— fără —</option>', ...o.vocabular.map((v) => `<option value="${esc(v.cod_nume)}"${v.cod_nume === ales ? ' selected' : ''}>${esc(v.nume)}</option>`)].join('')

  const randuri = [...o.randuri, ...Array.from({ length: 3 }, () => ({ data: zile[0]!, ora: '', cod_nume: '', slujitor: '', detalii: '', curatenie: true, transmisie: true }))]
  const corp = randuri
    .map(
      (r, i) => `<div class="rand-form">
      <div><label for="d${i}">Ziua</label><select id="d${i}" name="data">${optiuniZi(r.data)}</select>
        <label for="o${i}">Ora</label><input id="o${i}" name="ora" type="time" value="${esc(r.ora)}"></div>
      <div><label for="c${i}">Slujba</label><select id="c${i}" name="cod_nume">${optiuniCod(r.cod_nume)}</select>
        <label for="s${i}">Slujitor</label><input id="s${i}" name="slujitor" type="text" value="${esc(r.slujitor)}"></div>
      <div><label for="t${i}">Rândurile „→" (unul pe linie)</label><textarea id="t${i}" name="detalii" rows="2">${esc(r.detalii)}</textarea>
        <span class="bife"><label style="display:inline-block;margin:6px 14px 0 0"><input type="checkbox" name="curatenie" value="${i}"${r.curatenie ? ' checked' : ''}>curățenie</label><label style="display:inline-block;margin-top:6px"><input type="checkbox" name="transmisie" value="${i}"${r.transmisie ? ' checked' : ''}>transmisie</label></span></div>
    </div>`,
    )
    .join('')

  const istoric = o.istoric.length
    ? `<table><thead><tr><th>Când</th><th>Ce</th><th>Detalii</th></tr></thead><tbody>${o.istoric
        .map((h) => `<tr><td>${esc(momentLizibil(h.moment))}</td><td>${esc(h.ce)}</td><td>${esc(h.detalii ?? '')}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="gol">Nimic încă.</p>'

  return pagina({
    ...comune(o.ctx),
    titluPagina: `Scriere · ${o.titlu}`,
    lat: true,
    unelte: `<a class="btn" href="${p}/saptamana/${o.luni}">Vezi pagina</a><a class="btn" href="${p}/admin?luni=${o.luni}&din=propunere">Din propunere</a><a class="btn" href="${p}/admin?luni=${esc(adaugaZile(o.luni, -7))}">◀</a><a class="btn" href="${p}/admin?luni=${esc(adaugaZile(o.luni, 7))}">▶</a>`,
    corp: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
<div class="cap-sapt"><h2>${esc(o.titlu)}</h2><span class="stare ${esc(String(o.stare))}">${esc(String(o.stare))}</span></div>
<p>Rândurile goale se sar. O slujbă căreia îi scoți numele se șterge din săptămână.
${o.dinPropunere ? '<b>Formularul e completat din propunerea săptămânii</b> — schimbă ce nu se potrivește și salvează.' : ''}</p>
<form class="bloc" method="post" action="${p}/admin/scrie">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <input type="hidden" name="luni" value="${esc(o.luni)}">
  ${corp}
  <button type="submit" style="margin-top:14px">Salvează săptămâna</button>
</form>

<h3>Validare</h3>
<p>Nimeni nu tipărește și nu trimite ce nu e validat. Validarea leagă săptămâna de versiunea calendarului
(${esc(o.versiuneCalendar ?? 'calendarul nu răspunde acum')}) și anunță platforma.</p>
<form method="post" action="${p}/admin/valideaza">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <input type="hidden" name="luni" value="${esc(o.luni)}">
  <button type="submit"${o.existaSaptamana ? '' : ' disabled'}>Validează săptămâna</button>
</form>

<h3>Istoric</h3>
${istoric}`,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string, fel: 'rea' | 'buna' | 'info' = 'info'): string {
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    corp: `<h2>${esc(titlu)}</h2>${alerta(fel, esc(mesaj))}<p><a href="${esc(ctx.prefix)}/">Programul săptămânii</a> · <a href="${esc(ctx.prefix)}/arhiva">Arhiva</a></p>`,
  })
}
