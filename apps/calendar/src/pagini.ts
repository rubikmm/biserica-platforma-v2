/**
 * Paginile calendarului, pe carcasa comuna (grafica V1): lista lunii, ziua, sinaxarul,
 * Apostolul si Evanghelia, listele de sarbatori, administrarea.
 *
 * Aplicatia nu scrie antetul si subsolul — le da doar ce pune in sloturi.
 */
import type { ZiLiturgica } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, LUNI_SCURT, ZILE_SAPTAMANA, alerta, dataLunga, esc, momentLizibil, pagina } from '@xc/ui'
import type { PericopaCuText } from './biblia.js'
import type { Import, Versiune } from './depozit.js'
import { type RandDesfacut, type RandZi, clasaRang } from './traducere.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
}

export const STIL = `
.zi { display:grid; grid-template-columns:46px 1fr; gap:12px; padding:10px 0;
      border-bottom:1px solid var(--rule); scroll-margin-top:170px }
.zi:last-child { border-bottom:0 }
.zi.duminica { background:var(--tinta); margin:0 -10px; padding:10px; border-radius:8px }
.zi.azi { background:var(--azi-fund); box-shadow:inset 3px 0 0 var(--azi); margin:0 -10px; padding:10px; border-radius:8px }
.zi .cand { text-align:center; text-decoration:none; color:inherit; line-height:1 }
.zi .cand b { display:block; font:400 27px/1 "Palatino Linotype",Palatino,Georgia,serif }
.zi .cand small { font:600 10px/1.4 ui-sans-serif,system-ui; letter-spacing:.08em;
                  text-transform:uppercase; color:var(--faint) }
.zi.duminica .cand b { color:var(--rosu) }
.zi.azi .cand b { color:#0B9E4E }
.zi .ce { min-width:0 }
.zi .titlu-zi { text-decoration:none; color:inherit; display:block }
.zi .titlu-zi:hover { color:var(--rosu) }
.zi .denumire { color:var(--rosu); display:block }
.zi .sfinti span + span::before { content:"; "; color:var(--faint) }
.zi .sub { font:13px/1.5 ui-sans-serif,system-ui; color:var(--faint); margin:2px 0 0 }
.masa { float:right; margin:0 0 4px 10px; display:flex; flex-direction:column; gap:4px;
        align-items:flex-end; max-width:45% }
.chip { display:inline-block; font:11px/1.5 ui-sans-serif,system-ui; padding:1px 8px;
        border:1px solid var(--rule); border-radius:999px; color:var(--soft); white-space:nowrap }
.chip.post { border-color:#B8860B; color:#8A5A00 }
.chip.libera { border-color:var(--rosu); color:var(--rosu) }
.chip.slujba, .chip.morti { border-style:dashed }
.chip.perioada { background:var(--tinta) }
.etichete { display:flex; gap:5px; flex-wrap:wrap; margin:4px 0 0 }
.pericope { font:13px/1.5 ui-sans-serif,system-ui; color:var(--faint); margin:3px 0 0 }
.pericope a { color:var(--faint) }
.pericope a:hover { color:var(--rosu) }
.pericope .glas { margin-left:8px; white-space:nowrap }
.calculat { border:1px dashed var(--rule); border-radius:10px; padding:10px 14px;
            color:var(--soft); font:14px/1.5 ui-sans-serif,system-ui; margin:0 0 18px }
.zi-cap .cand { color:var(--faint); font:14px/1.5 ui-sans-serif,system-ui; margin:0 0 14px }
.zi-cap .titlu-mare { font-size:19px; line-height:1.45 }
.text h3 { margin-top:24px } .text h4 { margin:16px 0 4px; color:var(--faint); font-weight:600 }
.text blockquote { margin:14px 0; padding:4px 14px; border-left:3px solid var(--rule); color:var(--soft) }
.treapta { border-top:1px solid var(--rule); padding-top:16px; margin-top:24px }
.treapta:first-child { border-top:0; margin-top:0; padding-top:0 }
.treapta .ce { font:600 10.5px/1.3 ui-sans-serif,system-ui; letter-spacing:.1em;
               text-transform:uppercase; color:var(--rosu) }
.treapta h2 { margin:4px 0 10px; font-size:20px }
.versete p { margin:6px 0 }
.versete .nr { color:var(--faint); font:11px ui-sans-serif,system-ui; vertical-align:super; margin-right:3px }
.ref-lipsa { color:var(--faint); font-style:italic }
.nav-zile { display:flex; justify-content:space-between; gap:14px; margin-top:28px;
            font:14px ui-sans-serif,system-ui }
.contor { color:var(--faint); font:13px ui-sans-serif,system-ui; margin:0 0 10px }
.nesigur { color:#8A5A00; font:12px ui-sans-serif,system-ui }
.an-vecin { border-style:dashed !important }
.abonare { display:flex; gap:8px; align-items:center; margin:0 }
.abonare button { margin:0 }
`

export const SCRIPT = `
(function(){
  var b=document.getElementById('bt-info'), p=document.getElementById('panou-info');
  if(!b||!p) return;
  b.addEventListener('click', function(){
    var deschis = p.hasAttribute('hidden');
    if(deschis) p.removeAttribute('hidden'); else p.setAttribute('hidden','');
    b.setAttribute('aria-expanded', deschis ? 'true' : 'false');
  });
})();`

// ---------------------------------------------------------------------------
// Bucati comune
// ---------------------------------------------------------------------------

function contDin(ctx: Ctx) {
  return { intrat: !!ctx.utilizator, nume: ctx.utilizator ?? 'Cont', admin: ctx.eAdmin, urlCont: ctx.nav.cont, urlAdmin: ctx.nav.admin }
}

function chip(text: string, fel: string): string {
  return `<span class="chip ${esc(fel)}">${esc(text)}</span>`
}

function etichete(d: RandDesfacut): { masa: string; rest: string } {
  const masa = d.etichete.filter((e) => e.fel === 'post' || e.fel === 'libera' || e.fel === 'aliturgica')
  const rest = d.etichete.filter((e) => !masa.includes(e))
  return {
    masa: masa.length ? `<div class="masa">${masa.map((e) => chip(e.text, e.fel)).join('')}</div>` : '',
    rest: rest.length ? `<div class="etichete">${rest.map((e) => chip(e.text, e.fel)).join('')}</div>` : '',
  }
}

function sfintiiHtml(zi: ZiLiturgica): string {
  if (!zi.sfinti.length) return ''
  return `<span class="sfinti">${zi.sfinti
    .map((s) => {
      const clasa = clasaRang(s.rang)
      const text = esc(`${s.semn ? `${s.semn} ` : ''}${s.nume}`)
      return clasa ? `<span class="${clasa}">${text}</span>` : `<span>${text}</span>`
    })
    .join('')}</span>`
}

export function titlulZilei(d: RandDesfacut, zi: ZiLiturgica): string {
  if (d.eDuminica || (d.denumire && !d.sfinti.length)) {
    const denumire = d.denumire ? `<span class="denumire">${esc(d.denumire)}</span>` : ''
    return `${denumire}${sfintiiHtml(zi)}`
  }
  return d.titluHtmlCurat
}

function pericopeHtml(ctx: Ctx, zi: ZiLiturgica, d: RandDesfacut): string {
  const parti: string[] = []
  if (zi.pericope.apostol) parti.push(`Ap. ${esc(zi.pericope.apostol)}`)
  if (zi.pericope.evanghelie) parti.push(`Ev. ${esc(zi.pericope.evanghelie)}`)
  const glas = zi.glas ? `<span class="glas">glas ${zi.glas}${zi.evanghelia_invierii ? `, voscr. ${zi.evanghelia_invierii}` : ''}</span>` : ''
  if (!parti.length && !glas) return ''
  const link = parti.length ? `<a href="${esc(ctx.prefix)}/zi/${zi.data}/apostolul-evanghelia">${parti.join(' · ')}</a>` : ''
  return `<div class="pericope">${link}${d.eDuminica || !parti.length ? glas : ''}</div>`
}

export function randZi(ctx: Ctx, r: RandZi, d: RandDesfacut, zi: ZiLiturgica, azi: string): string {
  const clase = ['zi']
  if (d.eDuminica) clase.push('duminica')
  if (r.data === azi) clase.push('azi')
  const et = etichete(d)
  const zs = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'][r.zi_saptamana] ?? ''
  const sub = r.subtitlu ? `<p class="sub">${esc(r.subtitlu)}</p>` : ''
  const nesigur = r.nesigur?.length ? `<div class="nesigur">nesigur: ${esc(r.nesigur.join('; '))}</div>` : ''
  return `<article class="${clase.join(' ')}" id="z${r.data}">
  <a class="cand" href="${esc(ctx.prefix)}/zi/${r.data}"><b>${r.zi}</b><small>${zs}</small></a>
  <div class="ce">
    ${et.masa}
    <a class="titlu-zi" href="${esc(ctx.prefix)}/zi/${r.data}">${titlulZilei(d, zi)}</a>
    ${sub}
    ${et.rest}
    ${pericopeHtml(ctx, zi, d)}
    ${nesigur}
  </div>
</article>`
}

/** Randul de unelte al antetului: abonarea, „Informații utile", AZI. */
function unelte(ctx: Ctx, azi: string, abonat: boolean, cale: string): string {
  const p = esc(ctx.prefix)
  const [anAzi, lunaAzi] = azi.split('-').map(Number) as [number, number]
  const aziLink = `<a class="btn" href="${p}/${anAzi}-${String(lunaAzi).padStart(2, '0')}#z${azi}">AZI</a>`
  const info = `<button class="btn" type="button" id="bt-info" aria-expanded="false" aria-controls="panou-info">Informații utile</button>`
  const abonare = !ctx.utilizator
    ? `<a class="btn" href="${esc(ctx.nav.cont)}/auth/login">Abonează-te</a>`
    : `<form class="abonare" method="post" action="${p}/${abonat ? 'dezabonare' : 'abonare'}"><input type="hidden" name="spre" value="${esc(cale)}"><button class="btn" type="submit">${abonat ? 'Dezabonează-te' : 'Abonează-te'}</button></form>`
  return `${aziLink}${info}${abonare}`
}

function panouInfo(ctx: Ctx, an: number): string {
  const p = esc(ctx.prefix)
  return `<div id="panou-info" hidden>
    <nav class="capitole">
      <a href="${p}/sarbatori/cruce-rosie/${an}">Sărbătorile cu cruce roșie</a>
      <a href="${p}/sarbatori/cruce-neagra/${an}">Sărbătorile cu cruce neagră</a>
      <a href="${p}/v1/an/${an}/repere">Reperele anului</a>
    </nav>
  </div>`
}

function navLuni(ctx: Ctx, an: number, luna: number | null, aniDisponibili: number[]): string {
  const p = esc(ctx.prefix)
  const anPrec = aniDisponibili.includes(an - 1) ? `<a class="an-vecin" href="${p}/${an - 1}-12">‹ ${an - 1}</a>` : ''
  const anUrm = aniDisponibili.includes(an + 1) ? `<a class="an-vecin" href="${p}/${an + 1}-01">${an + 1} ›</a>` : ''
  const luni = LUNI_SCURT.map((l, i) => {
    const m = i + 1
    const eticheta = esc(l.replace('.', '').toUpperCase())
    return m === luna ? `<b class="acum">${eticheta}</b>` : `<a href="${p}/${an}-${String(m).padStart(2, '0')}">${eticheta}</a>`
  }).join('')
  return `<nav class="capitole">${anPrec}${luni}${anUrm}</nav>`
}

// ---------------------------------------------------------------------------
// Paginile
// ---------------------------------------------------------------------------

function comune(ctx: Ctx) {
  return {
    nume: 'CALENDAR',
    titlu: 'Calendarul ortodox',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: STIL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
  }
}

export function paginaLuna(o: {
  ctx: Ctx
  an: number
  luna: number
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  aniDisponibili: number[]
  calculat: boolean
  azi: string
  cale: string
  mesajAbonare?: string
  abonat: boolean
}): string {
  const titlu = `${LUNI[o.luna - 1]} ${o.an}`
  const lista = o.randuri.map(({ r, d, zi }) => randZi(o.ctx, r, d, zi, o.azi)).join('\n')
  return pagina({
    ...comune(o.ctx),
    titluPagina: titlu,
    indexabil: true,
    unelte: unelte(o.ctx, o.azi, o.abonat, o.cale),
    subantet: `${panouInfo(o.ctx, o.an)}${navLuni(o.ctx, o.an, o.luna, o.aniDisponibili)}`,
    scripturi: SCRIPT,
    corp: `
${o.mesajAbonare ? alerta('buna', esc(o.mesajAbonare)) : ''}
<h2>${esc(titlu)}</h2>
${o.calculat ? '<div class="calculat">Calendar generat automat — calendarul oficial al acestui an nu a apărut încă; sfinții sunt cei de pe dată, iar sărbătorile mobile vin din Pascalie.</div>' : ''}
${lista || '<p class="gol">Luna asta nu e preluată.</p>'}`,
  })
}

function capulZilei(ctx: Ctx, r: RandZi, d: RandDesfacut, zi: ZiLiturgica): string {
  const p = esc(ctx.prefix)
  const et = etichete(d)
  const canonic = r.calculat
    ? ''
    : `<p class="sub">${zi.canonic.nunti ? 'Se fac nunți' : 'Nu se fac nunți'} · ${zi.canonic.parastase ? 'se fac parastase' : 'nu se fac parastase'}</p>`
  return `<div class="zi-cap">
  <h2>${r.zi} ${esc(LUNI[r.luna - 1] ?? '')} ${r.an}</h2>
  <p class="cand">${esc(ZILE_SAPTAMANA[r.zi_saptamana] ?? '')}${r.faza_lunii ? ` · ${esc(r.faza_lunii.toLowerCase())}` : ''} · <a href="${p}/${r.an}-${String(r.luna).padStart(2, '0')}">${esc(LUNI[r.luna - 1] ?? '')} ${r.an}</a></p>
  ${et.masa}
  <div class="titlu-mare">${titlulZilei(d, zi)}</div>
  ${r.subtitlu ? `<p class="sub">${esc(r.subtitlu)}</p>` : ''}
  ${et.rest}
  ${canonic}
  ${pericopeHtml(ctx, zi, d)}
  ${r.nesigur?.length ? `<div class="nesigur">nesigur: ${esc(r.nesigur.join('; '))}</div>` : ''}
</div>`
}

function verseteHtml(pericopa: PericopaCuText | null, lipsa: string): string {
  if (!pericopa) return `<p class="ref-lipsa">${esc(lipsa)}</p>`
  return pericopa.bucati
    .map((b) => {
      const cap = `<p class="mic-text sters"><a href="${esc(b.adresa)}" target="_blank" rel="noopener">${esc(b.referinta)}</a></p>`
      if (!b.versete) return `${cap}<p class="ref-lipsa">Textul acestei pericope nu a putut fi adus din Biblia platformei${b.nota ? ` (${esc(b.nota)})` : ''}.</p>`
      return `${cap}<div class="versete">${b.versete.map((v) => `<p><span class="nr">${v.numar}</span>${esc(v.text)}</p>`).join('')}</div>`
    })
    .join('')
}

export interface TexteZilei {
  sinaxar: string | null
  apostol: PericopaCuText | null
  evanghelie: PericopaCuText | null
  voscreasna: { nr: number; text: PericopaCuText } | null
  inPlus: PericopaCuText[]
}

function treapta(ce: string, titlu: string, corp: string): string {
  return `<section class="treapta"><div class="ce">${esc(ce)}</div><h2>${esc(titlu)}</h2>${corp}</section>`
}

function pericopeleHtml(zi: ZiLiturgica, t: TexteZilei): string {
  const parti: string[] = []
  if (t.voscreasna) parti.push(treapta('Utrenie', `Evanghelia Învierii · a ${t.voscreasna.nr}-a`, verseteHtml(t.voscreasna.text, '')))
  parti.push(treapta('Apostolul', zi.pericope.apostol ?? 'fără citire', zi.pericope.apostol ? verseteHtml(t.apostol, '') : '<p class="ref-lipsa">Calendarul nu dă Apostol în această zi.</p>'))
  parti.push(treapta('Sfânta Evanghelie', zi.pericope.evanghelie ?? 'fără citire', zi.pericope.evanghelie ? verseteHtml(t.evanghelie, '') : '<p class="ref-lipsa">Calendarul nu dă Evanghelie în această zi.</p>'))
  for (const extra of t.inPlus) parti.push(treapta('Tot din calendar', extra.referinta, verseteHtml(extra, '')))
  return parti.join('')
}

export function paginaZi(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei; ieri: string; maine: string }): string {
  const p = esc(o.ctx.prefix)
  const sinaxar = o.texte.sinaxar
    ? `<section class="treapta text"><div class="ce">Sinaxar</div>${o.texte.sinaxar}</section>`
    : `<section class="treapta"><div class="ce">Sinaxar</div><p class="ref-lipsa">${o.r.calculat ? 'Sinaxarul vine odată cu calendarul oficial al anului.' : 'Sinaxarul acestei zile nu e disponibil.'}</p></section>`
  return pagina({
    ...comune(o.ctx),
    titluPagina: `${o.r.zi} ${LUNI[o.r.luna - 1]} ${o.r.an}`,
    indexabil: true,
    corp: `
${capulZilei(o.ctx, o.r, o.d, o.zi)}
${o.r.calculat ? '<div class="calculat">Zi generată automat din Pascalie și din sfinții de pe dată — calendarul oficial nu a apărut încă.</div>' : ''}
${pericopeleHtml(o.zi, o.texte)}
${sinaxar}
<nav class="nav-zile fara-tipar">
  <a href="${p}/zi/${o.ieri}">← ziua dinainte</a>
  <a href="${p}/${o.r.an}-${String(o.r.luna).padStart(2, '0')}">${esc(LUNI[o.r.luna - 1] ?? '')} ${o.r.an}</a>
  <a href="${p}/zi/${o.maine}">ziua următoare →</a>
</nav>`,
  })
}

function capFereastra(ctx: Ctx, ce: string, r: RandZi, d: RandDesfacut, zi: ZiLiturgica, linkTitlu: boolean): string {
  const p = esc(ctx.prefix)
  const titlu = linkTitlu ? `<a href="${p}/zi/${r.data}/sinaxar" style="color:inherit">${titlulZilei(d, zi)}</a>` : titlulZilei(d, zi)
  return `<div class="zi-cap">
  <div class="ce" style="font:600 10.5px/1.3 ui-sans-serif,system-ui;letter-spacing:.1em;text-transform:uppercase;color:var(--rosu)">${esc(ce)}</div>
  <div class="titlu-mare">${titlu}</div>
  <p class="cand"><a href="${p}/zi/${r.data}">${esc(ZILE_SAPTAMANA[r.zi_saptamana] ?? '')}, ${esc(dataLunga(r.data))}</a></p>
</div>`
}

export function paginaSinaxar(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; sinaxar: string | null }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx),
    titluPagina: `Sinaxar · ${dataLunga(o.r.data)}`,
    indexabil: true,
    corp: `
<p><a href="${p}/zi/${o.r.data}">← ziua</a></p>
${capFereastra(o.ctx, 'Sinaxar', o.r, o.d, o.zi, false)}
<hr>
${o.sinaxar ? `<div class="text">${o.sinaxar}</div>` : '<p class="ref-lipsa">Sinaxarul acestei zile nu e disponibil în Calendar.</p>'}`,
  })
}

export function paginaPericope(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    ...comune(o.ctx),
    titluPagina: `Apostolul și Evanghelia · ${dataLunga(o.r.data)}`,
    indexabil: true,
    corp: `
<p><a href="${p}/zi/${o.r.data}">← ziua</a></p>
${capFereastra(o.ctx, 'Lectura zilei', o.r, o.d, o.zi, true)}
<hr>
${pericopeleHtml(o.zi, o.texte)}`,
  })
}

export function paginaSarbatori(o: {
  ctx: Ctx
  cruce: 'rosie' | 'neagra'
  an: number
  luna: number | null
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  peLuni: number[]
  azi: string
}): string {
  const p = esc(o.ctx.prefix)
  const rosie = o.cruce === 'rosie'
  const titlu = rosie ? 'Sărbătorile cu cruce roșie' : 'Sărbătorile cu cruce neagră'
  const lamurire = rosie
    ? 'Praznicele împărătești și sfinții cu ținere — zilele pe care calendarul oficial le însemnează cu cruce roșie.'
    : 'Sfinții însemnați cu cruce neagră: se prăznuiesc, dar ziua nu e cu ținere.'
  const cate = o.luna ? `${o.randuri.length} zile în ${LUNI[o.luna - 1]} ${o.an}` : `${o.randuri.length} zile în ${o.an}`
  const baza = `${p}/sarbatori/cruce-${o.cruce}/${o.an}`
  const luni = LUNI_SCURT.map((l, i) => {
    const m = i + 1
    const eticheta = esc(l.replace('.', '').toUpperCase())
    if (!(o.peLuni[i] ?? 0)) return `<b class="acum" style="opacity:.35;border-color:var(--rule);color:var(--faint)">${eticheta}</b>`
    return o.luna === m ? `<b class="acum">${eticheta}</b>` : `<a href="${baza}-${String(m).padStart(2, '0')}">${eticheta}</a>`
  }).join('')
  const grupate = new Map<number, string[]>()
  for (const x of o.randuri) {
    const lista = grupate.get(x.r.luna) ?? []
    lista.push(randZi(o.ctx, x.r, x.d, x.zi, o.azi))
    grupate.set(x.r.luna, lista)
  }
  const corp = [...grupate.entries()].map(([l, lista]) => `<h3>${esc(LUNI[l - 1] ?? '')}</h3>${lista.join('')}`).join('')
  return pagina({
    ...comune(o.ctx),
    titluPagina: `${titlu} · ${o.an}`,
    indexabil: true,
    corp: `
<p><a href="${p}/${o.an}">← Înapoi</a></p>
<h2>${esc(titlu)}</h2>
<p class="contor">${esc(cate)}</p>
<p>${esc(lamurire)}</p>
<nav class="capitole"><a href="${baza}"${o.luna ? '' : ' style="border-color:var(--rosu);color:var(--rosu)"'}>toate lunile</a></nav>
<nav class="capitole">${luni}</nav>
${corp || '<p class="gol">Nicio zi.</p>'}
<hr>
<p><a href="${p}/${o.an}">← Înapoi</a> · <a href="${p}/sarbatori/cruce-${rosie ? 'neagra' : 'rosie'}/${o.an}">${rosie ? 'crucea neagră' : 'crucea roșie'}</a></p>`,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string, fel: 'rea' | 'buna' | 'info' = 'info'): string {
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    corp: `<h2>${esc(titlu)}</h2>${alerta(fel, esc(mesaj))}<p><a href="${esc(ctx.prefix)}/">Înapoi la calendar</a></p>`,
  })
}

export function paginaAdmin(o: {
  ctx: Ctx
  importuri: Import[]
  versiuni: Versiune[]
  corecturi: Array<{ data: string; camp: string; valoare_veche: string | null; valoare_noua: string | null; motiv: string; autor: string | null; moment: string }>
  abonati: Array<{ user_id: string; adresa: string; created_at: string }>
  versiuneCalendar: string
  aniCalculati: number[]
  csrf: string
  mesaj?: string
  eroare?: string
}): string {
  const p = esc(o.ctx.prefix)
  const anUrmator = (o.importuri.length ? Math.max(...o.importuri.map((i) => i.an)) : new Date().getUTCFullYear()) + 1
  const importuri = o.importuri.length
    ? `<table><thead><tr><th>An</th><th>Zile</th><th>Preluat de la sursă</th><th>Importat</th></tr></thead><tbody>${o.importuri
        .map((i) => `<tr><td>${i.an}</td><td>${i.zile}</td><td>${esc(momentLizibil(i.preluat_la))}</td><td>${esc(momentLizibil(i.importat_la))}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="gol">Niciun an preluat.</p>'
  const versiuni = o.versiuni.length
    ? `<table><thead><tr><th>Când</th><th>Interval</th><th>Motiv</th></tr></thead><tbody>${o.versiuni
        .slice(0, 30)
        .map((v) => `<tr><td>${esc(momentLizibil(v.moment))}</td><td>${v.de_la}${v.de_la !== v.pana_la ? ` – ${v.pana_la}` : ''}</td><td>${esc(v.motiv)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="gol">Nicio versiune.</p>'
  const corecturi = o.corecturi.length
    ? `<table><thead><tr><th>Zi</th><th>Câmp</th><th>Din</th><th>În</th><th>Motiv</th></tr></thead><tbody>${o.corecturi
        .map((c) => `<tr><td>${c.data}</td><td>${esc(c.camp)}</td><td>${esc(c.valoare_veche ?? '')}</td><td>${esc(c.valoare_noua ?? '')}</td><td>${esc(c.motiv)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="gol">Nicio corectură scrisă de mână.</p>'
  const abonati = o.abonati.length
    ? `<table><thead><tr><th>Adresa contului</th><th>De când</th></tr></thead><tbody>${o.abonati
        .map((a) => `<tr><td>${esc(a.adresa)}</td><td>${esc(momentLizibil(a.created_at))}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="gol">Niciun abonat.</p>'
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Administrare',
    corp: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
<h2>Administrare calendar</h2>
<p>Versiunea calendarului: <b>${esc(o.versiuneCalendar)}</b>. Anii calculați din Pascalie: ${o.aniCalculati.join(', ') || '—'}.</p>

<h3>Anii preluați de la Patriarhie</h3>
${importuri}
<form method="post" action="${p}/admin/preia">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <input name="an" type="number" min="2024" max="2099" value="${anUrmator}" style="width:8rem" aria-label="anul de preluat">
  <button type="submit">Preia anul</button>
</form>
<p><small>Preluarea e idempotentă: anul se rescrie complet. Anul următor apare la sursă abia în decembrie.</small></p>

<h3>Corectură scrisă de mână</h3>
<p><small>Peste sursă, cu valoarea veche păstrată. Se deschide o versiune nouă și se anunță consumatorii.</small></p>
<form method="post" action="${p}/admin/corecteaza" style="display:block">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <label for="data">Ziua</label><input id="data" name="data" type="date" required>
  <label for="camp">Câmpul</label>
  <select id="camp" name="camp">${['titlu', 'titlu_html', 'subtitlu', 'cruce', 'cruce_text', 'post', 'perioada', 'evanghelia', 'apostolul', 'zi_libera', 'nunti', 'parastase'].map((c) => `<option>${c}</option>`).join('')}</select>
  <label for="valoare">Valoarea nouă</label><input id="valoare" name="valoare" type="text" maxlength="2000" style="width:100%">
  <label for="motiv">Motivul</label><input id="motiv" name="motiv" type="text" required maxlength="300" style="width:100%">
  <button type="submit">Scrie corectura</button>
</form>
${corecturi}

<h3>Versiuni</h3>
${versiuni}

<h3>Abonați</h3>
<p><small>Audiența „calendar-abonati" a serviciului de comunicare; adresele sunt cele ale conturilor.</small></p>
${abonati}`,
  })
}

export { ICOANE }
