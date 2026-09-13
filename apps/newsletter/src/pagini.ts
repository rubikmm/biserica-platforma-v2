/**
 * Paginile newsletterului: un numar intreg (si pe prima pagina), arhiva pe ani si luni, cautarea.
 *
 * Afisarea, markup-ul si textele sunt cele din V1 (`biserica-newsletter`, v0.6.5) — „să respecți
 * mesajele și grafica din V1" (user, 10.09.2026). Carcasa vine din `@xc/ui`.
 *
 * Meniul din antet e tiparul lui A2 Programul, cerut anume in V1 (user, 8 sept. 2026: „la fel ca la
 * programul liturgic să avem acea navigare sus, dar fără pdf și jpg" — A8 n-are foaie de tiparit):
 * sageata numarul dinainte · bulina (duce mereu la cel mai nou) · sageata numarul urmator, apoi o
 * bara despartitoare si butoanele mici, Arhiva si lupa.
 */
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, LUNI_SCURT, esc, pagina } from '@xc/ui'
import type { Fisa } from './depozit.js'
import { LOCAL } from './stil.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/** Ce-i trebuie meniului ca sa se aseze pe o pagina anume. */
export interface Meniu {
  /** numerele vecine; `null` stinge sageata (estompata, pe loc — randul nu trebuie sa joace) */
  vecini: { dinainte: Fisa | null; urmator: Fisa | null }
  /** numarul de pe ecran e chiar cel mai nou — bulina ramane apasata */
  acum?: boolean
  /** pagina deschisa e Arhiva (butonul ei ramane aprins) */
  arhiva?: boolean
  /** casuta de cautare e deschisa (butonul-lupa ramane aprins) */
  cauta?: boolean
}

const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`

export const anul = (f: Fisa) => +f.trimis.slice(0, 4)
export const luna = (f: Fisa) => +f.trimis.slice(5, 7) // 1..12
const ziua = (f: Fisa) => +f.trimis.slice(8, 10)
const zilaScurt = (f: Fisa) => `${ziua(f)} ${LUNI_SCURT[luna(f) - 1] ?? ''}`

/** Numele intreg al foii se repeta in 9 subiecte din 10; in liste, unde deasupra scrie
 *  oricum luna si anul, plicteste. Pe pagina numarului subiectul ramane intreg. */
export const scurtat = (subiect: string) => {
  const s = subiect.replace(/^Buletinul Parohiei\s*(?:\(online\)|online)?\s*/i, '')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : subiect
}

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
 * Randul de unelte din antet. Sagetile cresc cat le lasa randul, bulina ramane cat un punct. Toate
 * duc in acelasi sir de numere: inapoi e cel dinainte, inainte e cel mai nou. Bulina n-are text si
 * duce intotdeauna la ULTIMUL numar trimis — de oriunde ai fi; ramane APASATA cand chiar pe el esti.
 */
function unelte(ctx: Ctx, m: Meniu, ultimul: Fisa | null): string {
  const p = esc(ctx.prefix)
  const sageata = (f: Fisa | null, text: string) =>
    f ? `<a class="btn" href="${p}/n/${f.id}" title="${esc(f.subiect)}">${text}</a>` : `<span class="btn gol">${text}</span>`
  return (
    sageata(m.vecini.dinainte, `◀ <span class="cuv">numărul dinainte</span>`) +
    (ultimul
      ? `<a class="btn punct${m.acum ? ' activ' : ''}" href="${p}/n/${ultimul.id}"
         title="ultimul număr trimis" aria-label="ultimul număr trimis"></a>`
      : `<span class="btn punct gol"></span>`) +
    sageata(m.vecini.urmator, `<span class="cuv">numărul următor</span> ▶`) +
    `<span class="desparte" aria-hidden="true"></span>` +
    `<a class="btn mic${m.arhiva ? ' activ' : ''}" href="${p}/arhiva"
         title="Arhiva pe ani și luni" aria-label="Arhiva pe ani și luni">${IC_ARHIVA}</a>` +
    `<a class="btn mic${m.cauta ? ' activ' : ''}" href="${p}/cauta" id="cauta-buton"
         aria-expanded="${m.cauta ? 'true' : 'false'}"
         aria-label="Căutare" title="Căutare">${ICOANE.lupa}</a>`
  )
}

/** Meniul paginilor care nu sunt un numar anume (arhiva, cautarea): navigarea se ancoreaza in cel
 *  mai nou numar — inapoi e cel dinaintea lui, inainte nu mai e nimic. */
export const meniuLista = (lista: Fisa[], rest: Partial<Meniu> = {}): Meniu => ({
  vecini: { dinainte: lista[lista.length - 2] ?? null, urmator: null },
  ...rest,
})

/** Cel mai nou numar — tinta bulinei din mijlocul navigarii. */
export const ULTIMUL = (lista: Fisa[]): Fisa | null => lista[lista.length - 1] ?? null

/** `q` null = casuta de cautare sta inchisa; sir (chiar gol) = e deschisa. Asa pagina `/cauta` merge
 *  si fara JavaScript, butonul din antet fiind un link obisnuit spre ea. */
function sablon(o: {
  ctx: Ctx
  titlu: string
  corp: string
  meniu: Meniu
  ultimul: Fisa | null
  q?: string | null
}): string {
  const q = o.q ?? null
  return pagina({
    nume: 'NEWSLETTER',
    titlu: 'Newsletter',
    titluPagina: o.titlu,
    acasa: `${o.ctx.prefix}/`,
    urlPlatforma: o.ctx.nav.home || '/',
    local: LOCAL,
    cont: contDin(o.ctx),
    versiune: o.ctx.versiune,
    modificata: o.ctx.modificata,
    indexabil: true,
    unelte: unelte(o.ctx, o.meniu, o.ultimul),
    subantet: `<form action="${esc(o.ctx.prefix)}/cauta" method="get" id="cautare"${q === null ? ' hidden' : ''}>
      <input type="search" name="q" value="${esc(q ?? '')}" placeholder="cuvânt din newsletter">
      <button type="submit">Caută</button>
    </form>`,
    corp: o.corp,
    scripturi: `
var fc=document.getElementById("cautare"),bc=document.getElementById("cauta-buton");
if(fc&&bc) bc.addEventListener("click",function(e){e.preventDefault();var era=fc.hidden;fc.hidden=!era;
bc.setAttribute("aria-expanded",era?"true":"false");if(era)fc.querySelector("input").focus()});`,
  })
}

export function paginaGoala(ctx: Ctx): string {
  return sablon({
    ctx,
    titlu: 'Newsletter',
    ultimul: null,
    meniu: { vecini: { dinainte: null, urmator: null } },
    corp: `<p class="gol">Arhiva e goală — nu s-a urcat încă niciun număr.</p>`,
  })
}

/**
 * Un numar, intreg. Asta e si prima pagina: acolo se deschide cel mai nou (user, 8 sept. 2026:
 * „pe home să fie doar randarea preview complet a unui News cu navigarea din antet"). Sub newsletter
 * nu mai sta nimic — mersul inainte si inapoi e in antet, care ramane sus oricat ai derula.
 */
export function paginaNumar(ctx: Ctx, lista: Fisa[], i: number, corp: string | null): string {
  const f = lista[i]!
  return sablon({
    ctx,
    titlu: f.subiect,
    ultimul: lista[lista.length - 1] ?? null,
    meniu: {
      vecini: { dinainte: lista[i - 1] ?? null, urmator: lista[i + 1] ?? null },
      acum: i === lista.length - 1,
    },
    corp: `<h2>${esc(f.subiect)}</h2>
${corp ? `<div class="email">${corp}</div>` : `<p class="gol">Numărul acesta nu se găsește în depozit.</p>`}`,
  })
}

/** Un rand din lista unei luni: ziua la stanga, subiectul dupa ea. */
const rand = (ctx: Ctx, f: Fisa): string =>
  `<li><span class="cand">${esc(zilaScurt(f))}</span><a href="${esc(ctx.prefix)}/n/${f.id}">${esc(scurtat(f.subiect))}</a></li>`

/** Arhiva: patratele cu anii, iar dedesubt anul ales, spart pe luni. */
export function paginaArhiva(ctx: Ctx, lista: Fisa[], an: number | null): string {
  const ani = [...new Set(lista.map(anul))].sort((a, b) => a - b)
  if (!ani.length) return paginaGoala(ctx)
  const ales = an && ani.includes(an) ? an : ani[ani.length - 1]!

  // Anii, ca lunile si ca zilele: cel mai nou primul (user, 8 sept. 2026 — crescatori, anul de fata
  // ajungea ultimul, tocmai pe randul al doilea, unde nu-l cauta nimeni).
  const patratele = `<nav class="capitole">${ani
    .slice()
    .reverse()
    .map((a) => (a === ales ? `<b class="acum">${a}</b>` : `<a href="${esc(ctx.prefix)}/arhiva/${a}">${a}</a>`))
    .join('')}</nav>`

  // Anul, de la luna cea mai noua spre cea mai veche: cine intra in arhiva cauta mai degraba ce a
  // fost duminica trecuta decat ce a fost in ianuarie.
  const aleAnului = lista.filter((f) => anul(f) === ales)
  const peLuni = new Map<number, Fisa[]>()
  for (const f of aleAnului) {
    const l = luna(f)
    if (!peLuni.has(l)) peLuni.set(l, [])
    peLuni.get(l)!.push(f)
  }

  const corp = [...peLuni.keys()]
    .sort((a, b) => b - a)
    .map(
      (l) =>
        `<h2 class="luna">${LUNI[l - 1] ?? ''}</h2>
<ul class="numere">${peLuni
          .get(l)!
          .slice()
          .reverse()
          .map((f) => rand(ctx, f))
          .join('')}</ul>`,
    )
    .join('')

  return sablon({
    ctx,
    titlu: `Arhiva ${ales}`,
    ultimul: lista[lista.length - 1] ?? null,
    meniu: meniuLista(lista, { arhiva: true }),
    corp: `${patratele}
<p class="cate">${aleAnului.length} ${aleAnului.length === 1 ? 'număr trimis' : 'numere trimise'} în ${ales} · ${lista.length} cu totul, din ${ani[0]} încoace</p>
${corp}`,
  })
}

/** Pagina cautarii: cate un rand pe numar, cu ziua si anul in fata. */
export function paginaCautare(
  ctx: Ctx,
  lista: Fisa[],
  intrebare: string,
  gasite: Fisa[] | null,
  necaz: 'gol' | 'scurt' | null,
): string {
  const cuMeniu = (titlu: string, corp: string, q: string) =>
    sablon({ ctx, titlu, corp, q, ultimul: ULTIMUL(lista), meniu: meniuLista(lista, { cauta: true }) })

  if (necaz === 'gol') {
    return cuMeniu(
      'Căutare',
      `<p class="gol">Scrie un cuvânt și îl caut în toate cele ${lista.length} de numere — în subiect și în text.</p>`,
      '',
    )
  }
  if (necaz === 'scurt') {
    return cuMeniu('Căutare', `<p class="gol">Un cuvânt de o literă nu spune destul. Încearcă unul mai lung.</p>`, intrebare)
  }

  const lista_ = gasite ?? []
  const corp = lista_.length
    ? `<p class="cate">${lista_.length} ${lista_.length === 1 ? 'număr' : 'numere'} pentru „${esc(intrebare)}"</p>
<ul class="numere cu-an">${lista_
        .slice(0, 200)
        .map(
          (f) =>
            `<li><span class="cand">${esc(zilaScurt(f))} ${anul(f)}</span><a href="${esc(ctx.prefix)}/n/${f.id}">${esc(scurtat(f.subiect))}</a></li>`,
        )
        .join('')}</ul>${
        lista_.length > 200 ? `<p class="cate">Se arată primele 200. Caută mai strâmt ca să le vezi pe toate.</p>` : ''
      }`
    : `<p class="gol">Nimic pentru „${esc(intrebare)}". Încearcă un singur cuvânt, sau altul.</p>`

  return cuMeniu(`„${intrebare}"`, corp, intrebare)
}

/** Pagina scurta de mesaj (nu există, eroare) — cu antetul intreg. */
export function paginaMesaj(ctx: Ctx, lista: Fisa[], titlu: string, corp: string): string {
  return sablon({
    ctx,
    titlu,
    corp: `<h2>${esc(titlu)}</h2>\n${corp}`,
    ultimul: ULTIMUL(lista),
    meniu: meniuLista(lista),
  })
}
