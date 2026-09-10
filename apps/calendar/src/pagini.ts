/**
 * Paginile calendarului: lista lunii, ziua, sinaxarul, Apostolul si Evanghelia, listele de
 * sarbatori, administrarea. Toate pe carcasa comuna (@xc/ui).
 */
import type { ZiLiturgica } from '@xc/contracts'
import { LUNI, LUNI_SCURT, ZILE_SAPTAMANA, alerta, dataLunga, esc, momentLizibil, pagina, type Navigatie } from '@xc/ui'
import type { PericopaCuText } from './biblia.js'
import type { Import, Versiune } from './depozit.js'
import { type RandDesfacut, type RandZi, clasaRang } from './traducere.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
}

export const STIL = `
.luna-cap { display:flex; align-items:baseline; gap:.8rem; flex-wrap:wrap; margin: 0 0 .6rem; }
.luna-cap h1 { margin:0; }
.calculat { border:1px dashed var(--margine-tare); border-radius:10px; padding:.5rem .8rem; color:var(--sters); font-size:.9rem; margin-bottom:1rem; }
.zi { display:grid; grid-template-columns: 3.1rem 1fr; gap:.6rem; padding:.55rem 0; border-bottom:1px solid var(--margine); scroll-margin-top: 6rem; }
.zi:last-child { border-bottom:0; }
.zi.duminica { background: color-mix(in srgb, var(--accent) 7%, transparent); margin:0 -.6rem; padding:.7rem .6rem; border-radius:8px; }
.zi.azi { box-shadow: inset 3px 0 0 #3ea75d; background: color-mix(in srgb, #3ea75d 8%, transparent); margin:0 -.6rem; padding:.7rem .6rem; border-radius:8px; }
.zi .cand { text-align:center; text-decoration:none; color:inherit; line-height:1; }
.zi .cand b { display:block; font-size:1.45rem; font-weight:650; }
.zi .cand small { color:var(--sters); font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; }
.zi.duminica .cand b { color:var(--rosu); }
.zi.azi .cand b { color:#2e8a4a; }
.zi .ce { min-width:0; }
.zi .titlu-zi { text-decoration:none; color:inherit; }
.zi .titlu-zi:hover { text-decoration:underline; }
.zi .denumire { color:var(--rosu); font-weight:600; display:block; }
.zi .sfinti { display:block; font-size:.95rem; }
.zi .sfinti span + span::before { content:"; "; color:var(--sters); }
.zi .sub { color:var(--sters); font-size:.86rem; margin:.15rem 0 0; text-align:left; }
.masa { float:right; margin:0 0 .3rem .6rem; display:flex; flex-direction:column; gap:.25rem; align-items:flex-end; max-width:45%; }
.chip { display:inline-block; font-size:.74rem; padding:.08rem .5rem; border-radius:999px; border:1px solid var(--margine-tare); color:var(--sters); white-space:nowrap; }
.chip.post { border-color: #b8860b; color:#8a5a00; }
.chip.libera { border-color: var(--rosu); color: var(--rosu); }
.chip.slujba, .chip.morti { border-style:dashed; }
.chip.perioada { background: color-mix(in srgb, var(--accent) 10%, transparent); }
@media (prefers-color-scheme: dark) { .chip.post { color:#f1cf86; border-color:#a67c2e; } }
.etichete { display:flex; gap:.3rem; flex-wrap:wrap; margin-top:.25rem; }
.pericope { font-size:.84rem; color:var(--sters); margin-top:.2rem; }
.pericope a { color:var(--sters); }
.pericope a:hover { color:var(--text); }
.pericope .glas { margin-left:.5rem; white-space:nowrap; }
.zi-cap .supra { color:var(--sters); font-size:.88rem; }
.zi-cap .supra a { color:inherit; }
.zi-cap h1 { font-size:2rem; margin:.1rem 0 0; }
.zi-cap .cand { color:var(--sters); margin:0 0 .8rem; }
.zi-cap .titlu { font-size:1.15rem; line-height:1.45; }
.text h3 { margin-top:1.4rem; }
.text h4 { margin:1rem 0 .3rem; color:var(--sters); font-weight:600; }
.text p { margin:.6rem 0; }
.text blockquote { margin:.8rem 0; padding:.4rem .9rem; border-left:3px solid var(--margine-tare); color:var(--sters); }
.versete p { margin:.35rem 0; }
.versete .nr { color:var(--sters); font-size:.75rem; vertical-align:super; margin-right:.2rem; }
.treapta { border-top:1px solid var(--margine); padding-top:1rem; margin-top:1.4rem; }
.treapta:first-child { border-top:0; margin-top:0; padding-top:0; }
.treapta .ce { color:var(--rosu); font-size:.8rem; text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
.treapta h2 { margin:.2rem 0 .6rem; }
.ref-lipsa { color:var(--sters); font-style:italic; }
.nav-zile { display:flex; justify-content:space-between; gap:1rem; margin-top:1.6rem; font-size:.92rem; }
.luni-grila { display:grid; grid-template-columns: repeat(6, 1fr); gap:.35rem; margin:.6rem 0 1.2rem; }
.luni-grila a, .luni-grila span { text-align:center; padding:.35rem .2rem; border:1px solid var(--margine); border-radius:8px; text-decoration:none; color:var(--text); font-size:.86rem; background:var(--carte); }
.luni-grila a[aria-current="page"] { background:var(--accent); color:var(--accent-text); border-color:var(--accent); }
.luni-grila .gol { opacity:.35; }
.inapoi { display:inline-block; margin-bottom:.6rem; font-size:.9rem; }
.abonare { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
.abonare input { width:auto; flex:1; min-width:12rem; font-size:16px; }
.abonare button { width:auto; margin:0; padding:.55rem .9rem; }
.contor { color:var(--sters); font-size:.88rem; margin:0 0 .6rem; }
.nesigur { color:#8a5a00; font-size:.8rem; }
`

// ---------------------------------------------------------------------------
// Bucati comune
// ---------------------------------------------------------------------------

function chip(text: string, fel: string): string {
  return `<span class="chip ${esc(fel)}">${esc(text)}</span>`
}

/** Etichetele de masa (post + zi libera) la dreapta; restul (perioada, slujba, morti) sub titlu. */
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

/** Titlul unei zile, asa cum se vede in lista si in capul paginii de zi. */
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

/** Randul unei zile in lista — acelasi in lista lunii si in listele de sarbatori. */
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

function navLuni(ctx: Ctx, an: number, luna: number | null, aniDisponibili: number[], azi: string): string {
  const p = esc(ctx.prefix)
  const [anAzi, lunaAzi] = azi.split('-').map(Number) as [number, number]
  const anPrec = aniDisponibili.includes(an - 1) ? `<a href="${p}/${an - 1}-12" class="an-vecin">‹ ${an - 1}</a>` : ''
  const anUrm = aniDisponibili.includes(an + 1) ? `<a href="${p}/${an + 1}-01" class="an-vecin">${an + 1} ›</a>` : ''
  const luni = LUNI_SCURT.map((l, i) => {
    const m = i + 1
    const curent = m === luna ? ' aria-current="page"' : ''
    return `<a href="${p}/${an}-${String(m).padStart(2, '0')}"${curent}>${esc(l.replace('.', '').toUpperCase())}</a>`
  }).join('')
  const aziLink = `<a href="${p}/${anAzi}-${String(lunaAzi).padStart(2, '0')}#z${azi}" title="ziua de azi" style="border-color:var(--rosu);color:var(--rosu)">AZI</a>`
  return `<nav class="nav-bara">${aziLink}${anPrec}${luni}${anUrm}</nav>`
}

/** Abonarea se face cu adresa contului — un singur buton; aplicatia nu cere si nu tine adrese. */
function abonareHtml(ctx: Ctx, cale: string, mesaj?: string, abonat = false, email: string | null = null): string {
  const p = esc(ctx.prefix)
  const veste = mesaj ? `<span class="mic-text sters">${esc(mesaj)}</span>` : ''
  if (!ctx.utilizator) {
    return `<div class="abonare fara-tipar"><a class="buton mic secundar" href="${esc(ctx.nav.cont)}/auth/login">Abonează-te</a><span class="mic-text sters">Ca să primești calendarul pe e-mail îți trebuie cont.</span>${veste}</div>`
  }
  if (abonat) {
    return `<form class="abonare fara-tipar" method="post" action="${p}/dezabonare">
      <span class="mic-text sters">Primești calendarul pe ${esc(email ?? 'adresa contului')}.</span>
      <input type="hidden" name="spre" value="${esc(cale)}">
      <button type="submit" class="mic secundar">Dezabonează-te</button>${veste}
    </form>`
  }
  return `<form class="abonare fara-tipar" method="post" action="${p}/abonare">
    <input type="hidden" name="spre" value="${esc(cale)}">
    <button type="submit" class="mic">Abonează-te${email ? ` (${esc(email)})` : ''}</button>${veste}
  </form>`
}

function informatiiUtile(ctx: Ctx, an: number): string {
  const p = esc(ctx.prefix)
  return `<details class="fara-tipar" style="margin:.4rem 0 1rem"><summary class="mic-text sters" style="cursor:pointer">Informații utile</summary>
  <div class="randuri" style="margin-top:.4rem">
    <a class="buton mic secundar" href="${p}/sarbatori/cruce-rosie/${an}">Sărbătorile cu cruce roșie</a>
    <a class="buton mic secundar" href="${p}/sarbatori/cruce-neagra/${an}">Sărbătorile cu cruce neagră</a>
    <a class="buton mic secundar" href="${p}/v1/an/${an}/repere">Reperele anului (Pascalia)</a>
  </div></details>`
}

// ---------------------------------------------------------------------------
// Paginile
// ---------------------------------------------------------------------------

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
  abonat?: boolean
  email?: string | null
}): string {
  const titlu = `${LUNI[o.luna - 1]} ${o.an}`
  const lista = o.randuri.map(({ r, d, zi }) => randZi(o.ctx, r, d, zi, o.azi)).join('\n')
  return pagina({
    titlu: `Calendar · ${titlu}`,
    activ: 'calendar',
    navigatie: o.ctx.nav,
    utilizator: o.ctx.utilizator,
    stil: STIL,
    indexabil: true,
    continut: `
${abonareHtml(o.ctx, o.cale, o.mesajAbonare, o.abonat ?? false, o.email ?? null)}
${informatiiUtile(o.ctx, o.an)}
${navLuni(o.ctx, o.an, o.luna, o.aniDisponibili, o.azi)}
<div class="carte">
  <div class="luna-cap"><h1>${esc(titlu)}</h1><span class="sters mic-text">calendar ortodox</span></div>
  ${o.calculat ? '<div class="calculat">Calendar generat automat — calendarul oficial al acestui an nu a apărut încă; sfinții sunt cei de pe dată, iar sărbătorile mobile vin din Pascalie.</div>' : ''}
  ${lista || '<p class="gol">Luna asta nu e preluată.</p>'}
</div>`,
  })
}

function capulZilei(ctx: Ctx, r: RandZi, d: RandDesfacut, zi: ZiLiturgica): string {
  const p = esc(ctx.prefix)
  const et = etichete(d)
  const canonic = r.calculat
    ? ''
    : `<p class="sub" style="text-align:left">${zi.canonic.nunti ? 'Se fac nunți' : 'Nu se fac nunți'} · ${zi.canonic.parastase ? 'se fac parastase' : 'nu se fac parastase'}</p>`
  return `<div class="zi-cap">
  <div class="supra"><a href="${p}/${r.an}-${String(r.luna).padStart(2, '0')}">${esc(LUNI[r.luna - 1] ?? '')} ${r.an}</a></div>
  <h1>${r.zi} ${esc(LUNI[r.luna - 1] ?? '')}</h1>
  <p class="cand">${esc(ZILE_SAPTAMANA[r.zi_saptamana] ?? '')}${r.faza_lunii ? ` · ${esc(r.faza_lunii.toLowerCase())}` : ''}</p>
  ${et.masa}
  <div class="titlu">${titlulZilei(d, zi)}</div>
  ${r.subtitlu ? `<p class="sub" style="text-align:left">${esc(r.subtitlu)}</p>` : ''}
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
      const cap = `<p class="sters mic-text"><a href="${esc(b.adresa)}" target="_blank" rel="noopener">${esc(b.referinta)}</a></p>`
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
    titlu: `${o.r.zi} ${LUNI[o.r.luna - 1]} ${o.r.an} · Calendar`,
    activ: 'calendar',
    navigatie: o.ctx.nav,
    utilizator: o.ctx.utilizator,
    stil: STIL,
    indexabil: true,
    continut: `
<div class="carte">
  ${capulZilei(o.ctx, o.r, o.d, o.zi)}
  ${o.r.calculat ? '<div class="calculat">Zi generată automat din Pascalie și din sfinții de pe dată — calendarul oficial nu a apărut încă.</div>' : ''}
</div>
<div class="carte">${pericopeleHtml(o.zi, o.texte)}</div>
<div class="carte">${sinaxar}</div>
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
  <div class="ce" style="color:var(--rosu);font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;font-weight:600">${esc(ce)}</div>
  <div class="titlu">${titlu}</div>
  <p class="cand"><a href="${p}/zi/${r.data}" style="color:inherit">${esc(ZILE_SAPTAMANA[r.zi_saptamana] ?? '')}, ${esc(dataLunga(r.data))}</a></p>
</div>`
}

export function paginaSinaxar(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; sinaxar: string | null }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    titlu: `Sinaxar · ${dataLunga(o.r.data)}`,
    activ: 'calendar',
    navigatie: o.ctx.nav,
    utilizator: o.ctx.utilizator,
    stil: STIL,
    indexabil: true,
    continut: `
<a class="inapoi fara-tipar" href="${p}/zi/${o.r.data}">← ziua</a>
<div class="carte">
  ${capFereastra(o.ctx, 'Sinaxar', o.r, o.d, o.zi, false)}
  <hr style="border:0;border-top:1px solid var(--margine);margin:1rem 0">
  ${o.sinaxar ? `<div class="text">${o.sinaxar}</div>` : '<p class="ref-lipsa">Sinaxarul acestei zile nu e disponibil în Calendar.</p>'}
</div>`,
  })
}

export function paginaPericope(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei }): string {
  const p = esc(o.ctx.prefix)
  return pagina({
    titlu: `Apostolul și Evanghelia · ${dataLunga(o.r.data)}`,
    activ: 'calendar',
    navigatie: o.ctx.nav,
    utilizator: o.ctx.utilizator,
    stil: STIL,
    indexabil: true,
    continut: `
<a class="inapoi fara-tipar" href="${p}/zi/${o.r.data}">← ziua</a>
<div class="carte">
  ${capFereastra(o.ctx, 'Lectura zilei', o.r, o.d, o.zi, true)}
  <hr style="border:0;border-top:1px solid var(--margine);margin:1rem 0">
  ${pericopeleHtml(o.zi, o.texte)}
</div>`,
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
    const n = o.peLuni[i] ?? 0
    if (!n) return `<span class="gol">${esc(l.replace('.', '').toUpperCase())}</span>`
    return `<a href="${baza}-${String(m).padStart(2, '0')}"${o.luna === m ? ' aria-current="page"' : ''}>${esc(l.replace('.', '').toUpperCase())}</a>`
  }).join('')
  const grupate = new Map<number, string[]>()
  for (const x of o.randuri) {
    const lista = grupate.get(x.r.luna) ?? []
    lista.push(randZi(o.ctx, x.r, x.d, x.zi, o.azi))
    grupate.set(x.r.luna, lista)
  }
  const corp = [...grupate.entries()].map(([l, lista]) => `<h3>${esc(LUNI[l - 1] ?? '')}</h3>${lista.join('')}`).join('')
  const inapoi = `<a class="inapoi fara-tipar" href="${p}/${o.an}">← Înapoi</a>`
  return pagina({
    titlu: `${titlu} · ${o.an}`,
    activ: 'calendar',
    navigatie: o.ctx.nav,
    utilizator: o.ctx.utilizator,
    stil: STIL,
    indexabil: true,
    continut: `
${inapoi}
<div class="carte">
  <h1>${esc(titlu)}</h1>
  <p class="contor">${esc(cate)}</p>
  <p class="ajutor">${esc(lamurire)}</p>
  <nav class="nav-bara" style="justify-content:flex-start"><a href="${baza}"${o.luna ? '' : ' aria-current="page"'}>toate lunile</a></nav>
  <nav class="luni-grila">${luni}</nav>
  ${corp || '<p class="gol">Nicio zi.</p>'}
</div>
${inapoi} · <a class="mic-text" href="${p}/sarbatori/cruce-${rosie ? 'neagra' : 'rosie'}/${o.an}">${rosie ? 'crucea neagră' : 'crucea roșie'}</a>`,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string, fel: 'rea' | 'buna' | 'info' = 'info'): string {
  return pagina({
    titlu,
    activ: 'calendar',
    navigatie: ctx.nav,
    utilizator: ctx.utilizator,
    stil: STIL,
    continut: `<div class="carte ingust"><h1>${esc(titlu)}</h1>${alerta(fel, esc(mesaj))}<p class="sub"><a href="${esc(ctx.prefix)}/">Înapoi la calendar</a></p></div>`,
  })
}

export function paginaAdmin(o: {
  ctx: Ctx
  importuri: Import[]
  versiuni: Versiune[]
  corecturi: Array<{ data: string; camp: string; valoare_veche: string | null; valoare_noua: string | null; motiv: string; autor: string | null; moment: string }>
  abonati: Array<{ user_id: string; adresa: string; created_at: string }>
  versiune: string
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
    titlu: 'Calendar — administrare',
    activ: 'calendar',
    navigatie: o.ctx.nav,
    utilizator: o.ctx.utilizator,
    stil: STIL,
    continut: `
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${o.eroare ? alerta('rea', esc(o.eroare)) : ''}
<div class="carte">
  <h1>Administrare calendar</h1>
  <p class="ajutor">Versiunea calendarului: <strong>${esc(o.versiune)}</strong>. Anii calculați din Pascalie: ${o.aniCalculati.join(', ') || '—'}.</p>
  <h2>Anii preluați de la Patriarhie</h2>
  ${importuri}
  <form method="post" action="${p}/admin/preia" style="margin-top:1rem">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="an">Preia un an de la calendar.patriarhia.ro</label>
    <div class="randuri"><input id="an" name="an" type="number" min="2024" max="2099" value="${anUrmator}" style="width:8rem"><button type="submit" class="mic">Preia anul</button></div>
    <p class="mic-text sters">Preluarea e idempotentă: anul se rescrie complet. Anul următor apare la sursă abia în decembrie.</p>
  </form>
</div>
<div class="carte">
  <h2>Corectură scrisă de mână</h2>
  <p class="ajutor">Peste sursă, cu valoarea veche păstrată. Se deschide o versiune nouă și se anunță consumatorii (calendar.corrected).</p>
  <form method="post" action="${p}/admin/corecteaza">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">
    <label for="data">Ziua</label><input id="data" name="data" type="date" required>
    <label for="camp">Câmpul</label>
    <select id="camp" name="camp">${['titlu', 'titlu_html', 'subtitlu', 'cruce', 'cruce_text', 'post', 'perioada', 'evanghelia', 'apostolul', 'zi_libera', 'nunti', 'parastase'].map((c) => `<option>${c}</option>`).join('')}</select>
    <label for="valoare">Valoarea nouă</label><input id="valoare" name="valoare" type="text" maxlength="2000">
    <label for="motiv">Motivul</label><input id="motiv" name="motiv" type="text" required maxlength="300">
    <button type="submit">Scrie corectura</button>
  </form>
  <h3>Corecturile de până acum</h3>
  ${corecturi}
</div>
<div class="carte"><h2>Versiuni</h2>${versiuni}</div>
<div class="carte"><h2>Abonați</h2><p class="ajutor">Audiența „calendar-abonati" a serviciului de comunicare; adresele sunt cele ale conturilor.</p>${abonati}</div>`,
  })
}
