/**
 * Paginile calendarului. Markup-ul, clasele si textele sunt cele din V1 (cerere user,
 * 10.09.2026: „să respecți mesajele și grafica din V1"); ce s-a schimbat tine de structura
 * platformei, nu de infatisare: abonarea merge prin serviciul de comunicare, iar adresele
 * poarta prefixul aplicatiei (in preview toate stau pe acelasi host).
 */
import type { ZiLiturgica } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { LUNI, STIL_COMUN, ZILE_SAPTAMANA, esc, momentLizibil, pagina } from '@xc/ui'
import type { PericopaCuText } from './biblia.js'
import type { Import, Versiune } from './depozit.js'
import { LOCAL } from './stil.js'
import { type RandDesfacut, type RandZi } from './traducere.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
  /** Anul curent la Bucuresti: sirul lunilor nu iese din el (afara de ianuarie anul viitor). */
  anCurent: number
  /** „Vezi ca" — vin din sesiune, gata calculate de identitate; doar pentru meniu si banda. */
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

export const NOTA_GENERAT = 'Calendar generat automat'
const ZILE_SCURT = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ']

/** Iconita „Informații utile" — ca in V1; pe telefon ramane doar ea, fara cuvinte. */
const IC_INFO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11.2v4.6"/><path d="M12 8.2h.01"/></svg>`

// ---------------------------------------------------------------------------
// Bucatile antetului
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

/**
 * Randul de unelte din antet: ABONAREA si „Informații utile" (ca in V1, 9 sept. 2026).
 * Deosebirea fata de V1: adresa nu se mai scrie de mana, e a contului — aplicatia nu tine
 * adrese de e-mail (structura platformei V2).
 */
function unelte(ctx: Ctx, cale: string, abonat: boolean): string {
  const p = esc(ctx.prefix)
  const an = ctx.anCurent
  const abonarea = ctx.utilizator
    ? `<form class="abonare" method="post" action="${p}/${abonat ? 'dezabonare' : 'abonare'}">
      <input type="hidden" name="spre" value="${esc(cale)}">
      <button class="btn mic" type="submit">${abonat ? 'Dezabonează-te' : 'Abonează-te'}</button>
      <span class="fara-cont">${abonat ? 'Primești calendarul pe adresa contului.' : 'Îți trimitem calendarul pe adresa contului.'}</span>
    </form>`
    : `<span class="abonare">
      <a class="btn mic" href="${esc(ctx.nav.cont)}/auth/login">Abonează-te</a>
      <span class="fara-cont">Ca să te abonezi, îți trebuie cont.</span>
    </span>`
  return `${abonarea}
    <span class="desparte" aria-hidden="true"></span>
    <details class="meniu-util">
      <summary class="btn mic" title="Informații utile">${IC_INFO}<span class="cuv">Informații utile</span></summary>
      <nav class="meniu-lista">
        <a href="${p}/sarbatori/cruce-rosie/${an}">Sărbători cu cruce roșie</a>
        <a href="${p}/sarbatori/cruce-neagra/${an}">Sărbători cu cruce neagră</a>
      </nav>
    </details>`
}

const JS_MENIU = `
(function(){
  document.addEventListener("click", function(e){
    var deschise=document.querySelectorAll("details.meniu-util[open]");
    for (var i=0;i<deschise.length;i++){
      if(!deschise[i].contains(e.target)) deschise[i].removeAttribute("open");
    }
  });
})();
`

/** Scriptul paginii de lună: șirul lunilor, „AZI" și fereastra cu textele zilei (din V1). */
function script(prefix: string): string {
  return `
(function () {
  var PREFIX = ${JSON.stringify(prefix)};

  // ——— sirul lunilor: luna deschisa, la mijloc, si doua sageti pentru cine n-are deget
  var fasie = document.querySelector('.fasie');
  if (fasie) {
    var lunaDeschisa = fasie.querySelector('.luna-buton.activa');
    if (lunaDeschisa) {
      fasie.scrollLeft = lunaDeschisa.offsetLeft - (fasie.clientWidth - lunaDeschisa.offsetWidth) / 2;
    }
    var sageti = ['‹', '›'].map(function (semn, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sageata';
      b.textContent = semn;
      b.setAttribute('aria-label', i ? 'lunile următoare' : 'lunile dinainte');
      b.addEventListener('click', function () {
        fasie.scrollBy({ left: (i ? 1 : -1) * Math.max(150, fasie.clientWidth * 0.6), behavior: 'smooth' });
      });
      return b;
    });
    fasie.parentNode.insertBefore(sageti[0], fasie);
    fasie.parentNode.appendChild(sageti[1]);
    var capete = function () {
      sageti[0].disabled = fasie.scrollLeft < 2;
      sageti[1].disabled = fasie.scrollLeft > fasie.scrollWidth - fasie.clientWidth - 2;
    };
    fasie.addEventListener('scroll', capete, { passive: true });
    window.addEventListener('resize', capete);
    capete();
  }

  // ——— ziua de azi se aseaza la mijlocul ecranului, nu sub antet
  var randAzi = document.getElementById('azi');
  function laAzi() { if (randAzi) randAzi.scrollIntoView({ block: 'center' }); }
  if (randAzi && location.hash === '#azi') setTimeout(laAzi, 0);
  var butonAzi = document.querySelector('.azi-buton');
  if (butonAzi && randAzi) {
    butonAzi.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (location.hash !== '#azi') history.replaceState(history.state, '', '#azi');
      laAzi();
    });
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#azi') laAzi(); });

  // ——— fereastra cu textele zilei
  var fereastra = document.getElementById('fereastra');
  if (!fereastra || !fereastra.showModal) return;
  var cuprins = fereastra.querySelector('.cuprins-fereastra');
  var stiute = {};
  var curent = '';

  function scrie(t, parte) {
    var eSinaxar = parte === 'sinaxar';
    var titlu = (!eSinaxar && t.sinaxar)
      ? '<a href="' + PREFIX + '/zi/' + t.data + '/sinaxar" data-fereastra="sinaxar" data-zi="' + t.data + '">' + t.titlu + '</a>'
      : t.titlu;
    var corp = '<p class="fel-fereastra">' + (eSinaxar ? 'Sinaxar' : 'Lectura zilei') + '</p>'
      + '<h2 class="titlu-fereastra">' + titlu + '</h2>'
      + '<p class="cand-fereastra">' + t.cand + '</p>';
    if (eSinaxar) {
      corp += t.sinaxar || '<p class="gol">Ziua aceasta n-are sinaxar în calendarul oficial.</p>';
    } else {
      corp += t['apostolul-evanghelia'] ||
        '<p class="gol">Ziua aceasta n-are Apostol și Evanghelie în calendarul oficial.</p>';
    }
    cuprins.innerHTML = corp;
    cuprins.scrollTop = 0;
  }

  function deschide(zi, parte) {
    curent = zi + '/' + parte;
    document.body.classList.add('cu-fereastra');
    if (!fereastra.open) fereastra.showModal();
    if (stiute[zi]) { scrie(stiute[zi], parte); return; }
    cuprins.innerHTML = '<p class="gol">se încarcă…</p>';
    var cerut = curent;
    fetch(PREFIX + '/v1/texte/' + zi)
      .then(function (r) { return r.json(); })
      .then(function (t) {
        stiute[zi] = t;
        if (fereastra.open && curent === cerut) scrie(t, parte);
      })
      .catch(function () {
        if (curent === cerut) cuprins.innerHTML = '<p class="gol">Textele nu s-au putut încărca.</p>';
      });
  }

  function inchide() {
    curent = '';
    document.body.classList.remove('cu-fereastra');
    if (fereastra.open) fereastra.close();
  }

  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[data-fereastra]') : null;
    if (!a) return;
    ev.preventDefault();
    var zi = a.getAttribute('data-zi');
    var parte = a.getAttribute('data-fereastra');
    history.pushState({ fereastra: true, zi: zi, parte: parte }, '', a.getAttribute('href'));
    deschide(zi, parte);
  });

  fereastra.addEventListener('click', function (ev) { if (ev.target === fereastra) fereastra.close(); });
  fereastra.querySelector('.inchide').addEventListener('click', function () { fereastra.close(); });
  fereastra.addEventListener('close', function () {
    curent = '';
    document.body.classList.remove('cu-fereastra');
    if (history.state && history.state.fereastra) history.back();
  });
  window.addEventListener('popstate', function (ev) {
    var s = ev.state;
    if (s && s.fereastra) deschide(s.zi, s.parte);
    else inchide();
  });
})();
` + JS_MENIU
}

// ---------------------------------------------------------------------------
// Ziua, in lista
// ---------------------------------------------------------------------------

function clasaEtichetei(e: { fel: string; text: string }): string {
  return e.fel === 'post' ? `post-${slug(e.text)}` : e.fel
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('ș', 's').replaceAll('ț', 't')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function semnele(d: RandDesfacut, alege?: (e: { fel: string }) => boolean): string {
  return d.etichete
    .filter((e) => !alege || alege(e))
    .map((e) => `<span class="semn ${clasaEtichetei(e)}">${esc(e.text)}</span>`)
    .join('')
}
const E_POST = (e: { fel: string }) => e.fel === 'post'
const E_LIBERA = (e: { fel: string }) => e.fel === 'libera'

/** Titlul zilei: la duminici, numele duminicii; altfel titlul intreg, cu marcajul sursei. */
function capulZilei(d: RandDesfacut): string {
  if (!d.eDuminica) return d.titluHtmlCurat
  return d.denumire ? esc(d.denumire) : d.titluHtmlCurat
}

/**
 * Sub titlu, la duminici: sfintii zilei. Rosul e al crucii rosii, sfant cu sfant, si numai
 * cand sursa o SPUNE (V1, 9 sept. 2026). Albastrul sfintilor locali bate rosul.
 */
function sfintiiZilei(zi: ZiLiturgica, d: RandDesfacut): string {
  if (!d.eDuminica || !d.denumire || !zi.sfinti.length) return ''
  return zi.sfinti
    .map((s) => {
      const clasa = s.rang === 'cruce_albastra' ? 'c-albastru' : s.rang === 'praznic_imparatesc' || s.rang === 'cruce_rosie' ? 'c-rosu' : ''
      const text = esc(`${s.semn ? `${s.semn} ` : ''}${s.nume}`)
      return clasa ? `<span class="${clasa}">${text}</span>` : text
    })
    .join('; ')
}

/** Randul marunt: pericopele intregi (si ale sfintilor), apoi glasul si voscreasna. */
function pericopele(zi: ZiLiturgica, d: RandDesfacut): string {
  const citiri = d.citiri.length ? d.citiri : [zi.pericope.apostol ? `Ap. ${zi.pericope.apostol}` : '', zi.pericope.evanghelie ? `Ev. ${zi.pericope.evanghelie}` : ''].filter(Boolean)
  return citiri.map((s) => esc(s)).join(' · ')
}

function glasulZilei(zi: ZiLiturgica, d: RandDesfacut): string {
  if (!d.eDuminica || !zi.glas) return ''
  return `<b class="glas">${esc(`glas ${zi.glas}${zi.evanghelia_invierii ? `, voscr. ${zi.evanghelia_invierii}` : ''}`)}</b>`
}

export function randZi(ctx: Ctx, r: RandZi, d: RandDesfacut, zi: ZiLiturgica, eAzi: boolean): string {
  const p = esc(ctx.prefix)
  const clase = ['zi']
  if (r.zi_saptamana === 0) clase.push('duminica')
  if (eAzi) clase.push('azi')
  if (r.cruce) clase.push(`cruce-${r.cruce}`)

  const pericope = pericopele(zi, d)
  const glas = glasulZilei(zi, d)
  const sfinti = sfintiiZilei(zi, d)
  const titlu = capulZilei(d)
  const semne = semnele(d, (e) => !E_POST(e) && !E_LIBERA(e))
  const randuialaMesei = semnele(d, E_POST) + semnele(d, E_LIBERA)

  const areSinaxar = !r.calculat
  const spreSinaxar = (continut: string) =>
    areSinaxar ? `<a href="${p}/zi/${r.data}/sinaxar" data-fereastra="sinaxar" data-zi="${r.data}">${continut}</a>` : continut
  const areTexte = Boolean(zi.pericope.apostol || zi.pericope.evanghelie || d.citiri.length)
  const spreTexte = areTexte
    ? `<a href="${p}/zi/${r.data}/apostolul-evanghelia" data-fereastra="apostolul-evanghelia" data-zi="${r.data}">${pericope}</a>`
    : pericope

  return `<article class="${clase.join(' ')}"${eAzi ? ' id="azi"' : ''}>
  <a class="cand" href="${p}/zi/${r.data}" title="${esc(ZILE_SAPTAMANA[r.zi_saptamana] ?? '')}, ${r.zi} ${esc(LUNI[r.luna - 1] ?? '')}">
    <span class="nr">${r.zi}</span>
    <span class="zs">${esc(ZILE_SCURT[r.zi_saptamana] ?? '')}</span>
  </a>
  <div class="ce">
    ${randuialaMesei ? `<div class="randuiala-mesei">${randuialaMesei}</div>` : ''}
    <p class="titlu-zi">${spreSinaxar(titlu)}</p>
    ${sfinti ? `<p class="sfinti">${spreSinaxar(sfinti)}</p>` : ''}
    ${r.subtitlu ? `<p class="subtitlu">${esc(r.subtitlu)}</p>` : ''}
    ${semne ? `<p class="semne">${semne}</p>` : ''}
    ${pericope || glas ? `<p class="pericope">${[pericope ? spreTexte : '', glas].filter(Boolean).join(' · ')}</p>` : ''}
  </div>
</article>
`
}

// ---------------------------------------------------------------------------
// Pagina unei luni
// ---------------------------------------------------------------------------

function adresaLunii(prefix: string, an: number, luna: number): string {
  return `${prefix}/${an}-${String(luna).padStart(2, '0')}`
}

/**
 * Sirul lunilor: NUMAI anul curent, plus ianuarie anul viitor (cerere user, 10.09.2026:
 * „nu mai afișa alți ani în afară de anul curent și luna ianuarie anul viitor").
 */
function sirulLunilor(ctx: Ctx, an: number, luna: number, azi: string): string {
  const p = esc(ctx.prefix)
  const anCurent = ctx.anCurent
  const butoane = LUNI.map((nume, i) => {
    const l = i + 1
    const activa = an === anCurent && l === luna ? ' activa' : ''
    return `<a class="luna-buton${activa}" href="${adresaLunii(p, anCurent, l)}" data-l="${l}">${esc(nume.slice(0, 3))}</a>`
  })
  const ianuarieViitor = an === anCurent + 1 && luna === 1 ? ' activa' : ''
  butoane.push(`<a class="luna-buton${ianuarieViitor}" href="${adresaLunii(p, anCurent + 1, 1)}" title="ianuarie ${anCurent + 1}">Ian ${anCurent + 1}</a>`)
  const [anAzi, lunaAzi] = azi.split('-').map(Number) as [number, number]
  const butonAzi = `<a class="azi-buton" href="${adresaLunii(p, anAzi, lunaAzi)}#azi">azi</a>`
  return `<div class="luni-rand">${butonAzi}<div class="fasie"><nav class="luni">${butoane.join('')}</nav></div></div>`
}

function comune(ctx: Ctx) {
  return {
    nume: 'CALENDAR',
    titlu: 'Calendar',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: LOCAL,
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
  calculat: boolean
  azi: string
  cale: string
  abonat: boolean
  mesajAbonare?: string
}): string {
  const corp = o.randuri.map(({ r, d, zi }) => randZi(o.ctx, r, d, zi, r.data === o.azi)).join('')
  return pagina({
    ...comune(o.ctx),
    titluPagina: `Calendar ${LUNI[o.luna - 1]} ${o.an}`,
    indexabil: true,
    metaExtra: `<meta name="description" content="Calendarul creștin ortodox — ${LUNI[o.luna - 1]} ${o.an}, zi de zi. Copie a calendarului oficial al Patriarhiei Române.">`,
    unelte: unelte(o.ctx, o.cale, o.abonat),
    scripturi: script(o.ctx.prefix),
    corp: `${sirulLunilor(o.ctx, o.an, o.luna, o.azi)}
${o.mesajAbonare ? `<p class="an-calculat">${esc(o.mesajAbonare)}</p>` : ''}
${o.calculat ? `<p class="an-calculat">${esc(NOTA_GENERAT)}</p>` : ''}
<h2 class="luna">${esc(LUNI[o.luna - 1] ?? '')} ${o.an}</h2>
<div class="zile">
${corp}</div>

<dialog class="fereastra" id="fereastra" aria-label="textele zilei">
  <div class="bara-fereastra"><button type="button" class="inchide" aria-label="Închide">×</button></div>
  <div class="cuprins-fereastra"></div>
</dialog>`,
  })
}

// ---------------------------------------------------------------------------
// Pagina unei zile (si partile ei)
// ---------------------------------------------------------------------------

export type Parte = 'sinaxar' | 'apostolul-evanghelia'

export interface TexteZilei {
  sinaxar: string | null
  apostol: PericopaCuText | null
  evanghelie: PericopaCuText | null
  voscreasna: { nr: number; text: PericopaCuText } | null
  inPlus: PericopaCuText[]
}

/** O pericopa adusa de noi: referinta mare, textul dedesubt — ca la cele din calendarul V1. */
function pericopaHtml(prefix: 'Ap.' | 'Ev.', p: PericopaCuText | null, refCadere?: string | null): string {
  if (!p) return refCadere ? `<h2>${esc(`${prefix} ${refCadere}`)}</h2><p class="gol">Textul acestei pericope nu a putut fi adus din Biblia platformei.</p>` : ''
  return p.bucati
    .map((b, i) => {
      const titlu = i === 0 ? `<h2>${esc(`${prefix} ${p.referinta}`)}</h2>` : ''
      const ref = p.bucati.length > 1 ? `<p class="ref"><a href="${esc(b.adresa)}" target="_blank" rel="noopener">${esc(b.referinta)}</a></p>` : ''
      if (!b.versete) return `${titlu}${ref}<p class="gol">Textul acestei pericope nu a putut fi adus din Biblia platformei.</p>`
      return `${titlu}${ref}<p>${esc(b.versete.map((v) => v.text).join(' '))}</p>`
    })
    .join('')
}

/** Sectiunile pericopelor, in ordinea ceruta de user (V1, 27 aug. 2026). */
function sectiunilePericopelor(zi: ZiLiturgica, t: TexteZilei): Array<[string, string]> {
  const sectiuni: Array<[string, string]> = []
  if (t.voscreasna) sectiuni.push([`Voscreasna Învierii · a ${t.voscreasna.nr}-a · Utrenie`, pericopaHtml('Ev.', t.voscreasna.text)])
  sectiuni.push(['Apostolul', pericopaHtml('Ap.', t.apostol, zi.pericope.apostol)])
  sectiuni.push(['Sfânta Evanghelie', pericopaHtml('Ev.', t.evanghelie, zi.pericope.evanghelie)])
  if (t.inPlus.length) sectiuni.push(['Din Evangheliar', t.inPlus.map((p) => pericopaHtml('Ev.', p)).join('')])
  return sectiuni
}

function sectiunile(zi: ZiLiturgica, t: TexteZilei, parte?: Parte): Array<[string, string]> {
  if (parte === 'sinaxar') return [['', t.sinaxar ?? '']]
  if (parte === 'apostolul-evanghelia') return sectiunilePericopelor(zi, t)
  return [...sectiunilePericopelor(zi, t), ['Sinaxar', t.sinaxar ?? '']]
}

export function cuprinsul(sectiuni: Array<[string, string]>): string {
  return sectiuni
    .filter(([, html]) => html)
    .map(([nume, html]) => `<section class="text">${nume ? `<h3>${esc(nume)}</h3>` : ''}${html}</section>`)
    .join('\n')
}

export function paginaZi(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei; parte?: Parte; ieri: string; maine: string; abonat: boolean; cale: string }): string {
  const p = esc(o.ctx.prefix)
  const luna = `${p}/${o.r.an}-${String(o.r.luna).padStart(2, '0')}`
  const numeParte = o.parte === 'sinaxar' ? 'Sinaxar' : o.parte ? 'Lectura zilei' : ''
  const cuprins = cuprinsul(sectiunile(o.zi, o.texte, o.parte))
  const semne = semnele(o.d)
  const pericope = pericopele(o.zi, o.d)
  const glas = glasulZilei(o.zi, o.d)
  const sfinti = sfintiiZilei(o.zi, o.d)
  const numeZi = (o.d.denumire || o.zi.titlu).slice(0, 70)

  return pagina({
    ...comune(o.ctx),
    titluPagina: `${numeParte ? `${numeParte} · ` : ''}${numeZi} · ${o.r.zi} ${LUNI[o.r.luna - 1]} ${o.r.an}`,
    indexabil: true,
    unelte: unelte(o.ctx, o.cale, o.abonat),
    scripturi: JS_MENIU,
    clasaCorp: `pagina-zi ${o.r.zi_saptamana === 0 ? 'duminica' : ''} ${o.r.cruce ? `cruce-${o.r.cruce}` : ''}`,
    corp: `<div class="cap">
  <p class="eyebrow"><a href="${luna}">${esc(LUNI[o.r.luna - 1] ?? '')} ${o.r.an}</a>${numeParte ? ` · ${esc(numeParte)}` : ''}</p>
  <h1 class="data-mare">${o.r.zi} ${esc(LUNI[o.r.luna - 1] ?? '')}</h1>
  <p class="zs-mare">${esc(ZILE_SAPTAMANA[o.r.zi_saptamana] ?? '')}${o.r.faza_lunii ? ` · ${esc(o.r.faza_lunii)}` : ''}</p>
  <p class="titlu-zi titlu-mare">${capulZilei(o.d)}</p>
  ${sfinti ? `<p class="sfinti">${sfinti}</p>` : ''}
  ${o.r.subtitlu ? `<p class="subtitlu">${esc(o.r.subtitlu)}</p>` : ''}
  ${o.parte ? '' : `${semne ? `<p class="semne">${semne}</p>` : ''}
  ${o.r.calculat ? '' : `<p class="randuiala">
    ${o.zi.canonic.nunti ? 'Se fac nunți' : 'Nu se fac nunți'} ·
    ${o.zi.canonic.parastase ? 'se fac parastase' : 'nu se fac parastase'}
  </p>`}`}
  ${(pericope || glas) && o.parte !== 'sinaxar' ? `<p class="pericope">${[pericope, glas].filter(Boolean).join(' · ')}</p>` : ''}
</div>

${cuprins || (o.r.calculat ? `<p class="gol">${esc(NOTA_GENERAT)} — textele vin odată cu calendarul oficial al anului.</p>` : '<p class="gol">Textele acestei zile nu se găsesc.</p>')}

<nav class="vecini">
${o.parte
  ? `<a href="${p}/zi/${o.r.data}">← toată ziua</a>
  <a href="${luna}">${esc(LUNI[o.r.luna - 1] ?? '')}</a>`
  : `<a href="${p}/zi/${o.ieri}">← ziua dinainte</a>
  <a href="${luna}">${esc(LUNI[o.r.luna - 1] ?? '')}</a>
  <a href="${p}/zi/${o.maine}">ziua următoare →</a>`}
</nav>`,
  })
}

// ---------------------------------------------------------------------------
// „Informații utile" · sărbătorile
// ---------------------------------------------------------------------------

export type FelCruce = 'rosie' | 'neagra'

export const CRUCILE: Record<FelCruce, { nume: string; scurt: string; lamurire: string }> = {
  rosie: {
    nume: 'Sărbători cu cruce roșie',
    scurt: 'roșie',
    lamurire: 'Praznicele împărătești și sfinții cu ținere — zilele pe care calendarul oficial le însemnează cu cruce roșie.',
  },
  neagra: {
    nume: 'Sărbători cu cruce neagră',
    scurt: 'neagră',
    lamurire: 'Sfinții însemnați cu cruce neagră: se prăznuiesc, dar ziua nu e cu ținere.',
  },
}

function lunileListei(ctx: Ctx, fel: FelCruce, an: number, luna: number | undefined, cuZile: Set<number>): string {
  const p = esc(ctx.prefix)
  const catre = (l?: number) => `${p}/sarbatori/cruce-${fel}/${an}${l ? `-${String(l).padStart(2, '0')}` : ''}`
  const toate = luna ? `<a class="toate" href="${catre()}">toate lunile</a>` : `<b class="toate acum">toate lunile</b>`
  const lunile = LUNI.map((numeLunii, i) => {
    const l = i + 1
    const scurt = esc(numeLunii.slice(0, 3))
    if (l === luna) return `<b class="acum" title="${esc(numeLunii)}">${scurt}</b>`
    if (!cuZile.has(l)) return `<span class="gol" title="${esc(numeLunii)} — nicio zi">${scurt}</span>`
    return `<a href="${catre(l)}" title="${esc(numeLunii)}">${scurt}</a>`
  }).join('')
  return `<nav class="luni-alege">${toate}${lunile}</nav>`
}

export function paginaSarbatori(o: {
  ctx: Ctx
  fel: FelCruce
  an: number
  luna?: number
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  cuZile: Set<number>
  calculat: boolean
  azi: string
  cale: string
  abonat: boolean
}): string {
  const p = esc(o.ctx.prefix)
  const unde = o.luna ? `${LUNI[o.luna - 1]} ${o.an}` : String(o.an)
  const celalalt: FelCruce = o.fel === 'rosie' ? 'neagra' : 'rosie'
  const peLuni = LUNI.map((numeLunii, i) => {
    const grup = o.randuri.filter((x) => x.r.luna === i + 1)
    if (!grup.length) return ''
    return `<h2 class="luna">${esc(numeLunii)}</h2>
<div class="zile">
${grup.map((x) => randZi(o.ctx, x.r, x.d, x.zi, x.r.data === o.azi)).join('')}</div>`
  })
    .filter(Boolean)
    .join('\n')

  return pagina({
    ...comune(o.ctx),
    titluPagina: `${CRUCILE[o.fel].nume} · ${unde}`,
    indexabil: true,
    metaExtra: `<meta name="description" content="${esc(CRUCILE[o.fel].nume)} în ${esc(unde)}, din calendarul creștin ortodox al Patriarhiei Române.">`,
    unelte: unelte(o.ctx, o.cale, o.abonat),
    scripturi: JS_MENIU,
    clasaCorp: 'sarbatori',
    corp: `<div class="cap">
  <p class="inainte-de-titlu"><a class="btn inapoi" href="${p}/${o.an}">← Înapoi</a></p>
  <h1 class="titlu-lista">${esc(CRUCILE[o.fel].nume)}</h1>
  <p class="cate">${o.randuri.length} ${o.randuri.length === 1 ? 'zi' : 'zile'} în ${esc(unde)}</p>
  <p class="sursa">${esc(CRUCILE[o.fel].lamurire)}</p>
</div>
${lunileListei(o.ctx, o.fel, o.an, o.luna, o.cuZile)}
${o.calculat ? `<p class="an-calculat">${esc(NOTA_GENERAT)}</p>` : ''}
${peLuni || `<p class="gol">${o.luna ? `${esc(LUNI[o.luna - 1] ?? '')} ${o.an} n-are` : `Anul ${o.an} n-are`} nicio zi însemnată cu cruce ${esc(CRUCILE[o.fel].scurt)}.</p>`}

<nav class="vecini">
  <a href="${p}/${o.an}">← Înapoi</a>
  <a href="${p}/sarbatori/cruce-${celalalt}/${o.an}${o.luna ? `-${String(o.luna).padStart(2, '0')}` : ''}">${esc(CRUCILE[celalalt].nume)} →</a>
</nav>`,
  })
}

// ---------------------------------------------------------------------------
// Mesaje si administrare
// ---------------------------------------------------------------------------

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string): string {
  const p = esc(ctx.prefix)
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    scripturi: JS_MENIU,
    corp: `<div class="cap">
  <h1 class="titlu-lista">${esc(titlu)}</h1>
  <p class="sursa">${esc(mesaj)}</p>
</div>
<nav class="vecini"><a href="${p}/">← Calendarul</a></nav>`,
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
  const anUrmator = (o.importuri.length ? Math.max(...o.importuri.map((i) => i.an)) : o.ctx.anCurent) + 1
  const tabel = (cap: string[], randuri: string[][]) =>
    randuri.length
      ? `<table><thead><tr>${cap.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${randuri
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      : '<p class="gol">Nimic încă.</p>'

  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Administrare',
    scripturi: JS_MENIU,
    corp: `<div class="cap">
  <h1 class="titlu-lista">Administrare</h1>
  <p class="sursa">Versiunea calendarului: <b>${esc(o.versiuneCalendar)}</b>. Anii calculați din Pascalie: ${o.aniCalculati.join(', ') || '—'}.</p>
</div>
${o.mesaj ? `<p class="an-calculat">${esc(o.mesaj)}</p>` : ''}
${o.eroare ? `<p class="an-calculat" style="border-color:var(--rosu);color:var(--rosu)">${esc(o.eroare)}</p>` : ''}

<h2 class="luna">Anii preluați de la Patriarhie</h2>
${tabel(['An', 'Zile', 'Preluat de la sursă', 'Importat'], o.importuri.map((i) => [String(i.an), String(i.zile), esc(momentLizibil(i.preluat_la)), esc(momentLizibil(i.importat_la))]))}
<form method="post" action="${p}/admin/preia">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <input name="an" type="number" min="2024" max="2099" value="${anUrmator}" style="width:8rem" aria-label="anul de preluat">
  <button type="submit">Preia anul</button>
</form>
<p class="sursa">Preluarea e idempotentă: anul se rescrie complet. Anul următor apare la sursă abia în decembrie.</p>

<h2 class="luna">Corectură scrisă de mână</h2>
<p class="sursa">Peste sursă, cu valoarea veche păstrată. Se deschide o versiune nouă și se anunță consumatorii.</p>
<form method="post" action="${p}/admin/corecteaza" style="display:block">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <label for="data">Ziua</label><input id="data" name="data" type="date" required>
  <label for="camp">Câmpul</label>
  <select id="camp" name="camp">${['titlu', 'titlu_html', 'subtitlu', 'cruce', 'cruce_text', 'post', 'perioada', 'evanghelia', 'apostolul', 'zi_libera', 'nunti', 'parastase'].map((c) => `<option>${c}</option>`).join('')}</select>
  <label for="valoare">Valoarea nouă</label><input id="valoare" name="valoare" type="text" maxlength="2000" style="width:100%">
  <label for="motiv">Motivul</label><input id="motiv" name="motiv" type="text" required maxlength="300" style="width:100%">
  <button type="submit">Scrie corectura</button>
</form>
${tabel(['Zi', 'Câmp', 'Din', 'În', 'Motiv'], o.corecturi.map((c) => [c.data, esc(c.camp), esc(c.valoare_veche ?? ''), esc(c.valoare_noua ?? ''), esc(c.motiv)]))}

<h2 class="luna">Versiuni</h2>
${tabel(['Când', 'Interval', 'Motiv'], o.versiuni.slice(0, 30).map((v) => [esc(momentLizibil(v.moment)), `${v.de_la}${v.de_la !== v.pana_la ? ` – ${v.pana_la}` : ''}`, esc(v.motiv)]))}

<h2 class="luna">Abonați</h2>
<p class="sursa">Audiența „calendar-abonati" a serviciului de comunicare; adresele sunt cele ale conturilor.</p>
${tabel(['Adresa contului', 'De când'], o.abonati.map((a) => [esc(a.adresa), esc(momentLizibil(a.created_at))]))}`,
  })
}

/** Textele zilei pentru fereastra din lista — aceeasi forma ca in V1. */
export function texteFereastra(o: { r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei }): Record<string, string> {
  return {
    data: o.r.data,
    cand: `${ZILE_SAPTAMANA[o.r.zi_saptamana] ?? ''}, ${o.r.zi} ${LUNI[o.r.luna - 1] ?? ''} ${o.r.an}`,
    titlu: capulZilei(o.d),
    sfinti: sfintiiZilei(o.zi, o.d),
    sinaxar: cuprinsul(sectiunile(o.zi, o.texte, 'sinaxar')),
    'apostolul-evanghelia': cuprinsul(sectiunile(o.zi, o.texte, 'apostolul-evanghelia')),
  }
}

/**
 * POZA SĂPTĂMÂNII — pagina din care iese PNG-ul cerut de `/v1/poza/saptamana/<zi>`: antetul cu
 * intervalul și cele șapte zile, una sub alta, exact în forma din lista lunii (`randZi`).
 *
 * În V1 pozele se făceau dinainte, cu un script, pentru tot anul, și stăteau în R2 (limita de atunci:
 * un an întreg dura zece minute de Browser Rendering). Aici se fac la cerere și rămân în cache-ul de
 * muchie, cu cheia pe amprenta HTML-ului: prima cerere așteaptă câteva secunde, restul vin din cache,
 * iar când calendarul se corectează, poza se reface singură.
 *
 * Pagina e autonomă (stilul înăuntru) și n-are antet, unelte, șirul lunilor sau subsol — nimic din ce
 * e buton, fiindcă într-o poză nu se apasă nimic.
 */
export function pozaSaptamaniiHtml(o: {
  ctx: Ctx
  eticheta: string
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  azi: string
}): string {
  const zile = o.randuri.map(({ r, d, zi }) => randZi(o.ctx, r, d, zi, r.data === o.azi)).join('')
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Calendarul săptămânii ${esc(o.eticheta)}</title>
<style>${STIL_COMUN}${LOCAL}
body { margin: 0; background: #fff; }
/* Lata cat un telefon (user, 10.09.2026: „la 50% din cat e acum") — poza se trimite pe WhatsApp si se
   citeste tot pe telefon; la doi pixeli pe punct iese oricum de 900 px adevarati. */
.poza { width: 450px; box-sizing: border-box; padding: 20px 18px 22px; background: #fff; }
.poza .cap { text-align: center; margin: 0 0 14px; }
/* Numele aplicatiei, mare, ca in antetul paginilor; sub el parohia, apoi saptamana (user) */
.poza .cap .nume { font: 400 32px/1.05 "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
                   letter-spacing: .04em; margin: 0; }
.poza .cap .parohia { font: 600 10px/1.4 ui-sans-serif, system-ui; letter-spacing: .16em;
                      text-transform: uppercase; color: #7f7f7f; margin: 5px 0 0; }
.poza .cap h1 { font-size: 20px; font-weight: 400; margin: 12px 0 0; letter-spacing: -.01em; }
.poza .cap .rand { border-top: 1px solid #ddd; margin: 12px 0 0; }
/* in poza nimic nu se apasa: fereastra textelor si sagetile de deschidere n-au ce cauta */
.poza .zi .deschide, .poza .zi .fereastra, .poza .zi details summary::-webkit-details-marker { display: none; }
.poza .zi { break-inside: avoid; }
</style></head><body>
<div class="poza">
  <header class="cap">
    <p class="nume">CALENDAR</p>
    <p class="parohia">Biserica Sfântul Ilie – Hanul Colței</p>
    <h1>${esc(o.eticheta)}</h1>
    <div class="rand"></div>
  </header>
  <div class="zile">${zile}</div>
</div>
</body></html>`
}
