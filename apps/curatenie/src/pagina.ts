/**
 * Carcasa pusa pe curatenie: antetul cu numele aplicatiei si contul, adresa platformei, subsolul
 * cu tema si versiunea. In V1 toate astea erau copiate in aplicatie (`src/comun/`); aici vin din
 * `@xc/ui`, ca la toate aplicatiile V2.
 *
 * Cele trei „potriviri locale" pe care V1 le tinea ca sa poata fi sterse la legarea de platforma
 * (scria „Autentificare" in loc de „Cont", ascundea „Profil", trimitea „Administrare" la panoul
 * aplicatiei) AU FOST STERSE: contul e acum cel al platformei, cu meniul lui intreg si cu „vezi ca".
 *
 * ⚠️ Nici FANTOMA nu le aduce inapoi (19.09.2026). Cine si-a ales doar numele din lista vede in
 * antet acelasi „Cont" ca un necunoscut — acolo e usa spre platforma, iar numele ales n-a deschis-o.
 * Ca sa stie totusi cine e socotit, numele lui scrie pe randul personal al antetului (`.cine`,
 * slotul `personal`), impreuna cu „Nu ești tu?" — vezi `pagini/index.ts`.
 *
 * ⚠️ Paginile curateniei NU folosesc slotul `unelte` al carcasei (user, 19.09.2026: „meniul de cont
 * trebuie să se vadă ca la celelalte aplicații"). Randul cu „Intră · Contul meu · Administrare" a
 * iesit cu totul: contul se tine dintr-un singur loc, meniul din antet, iar panoul aplicatiei se
 * vede in `/setari`. Carcasa are slotul mai departe, pentru cand va fi nevoie de NAVIGATIE.
 */
import { type Navigatie, adresaPaginii } from '@xc/config'
import { type Cont, esc, pagina as carcasa } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }
import { LOCAL } from './stil.js'

/** Ce stie pagina despre cine se uita la ea si unde e montata aplicatia. */
export interface Ctx {
  prefix: string
  nav: Navigatie
  /** Numele din contul platformei, daca omul a intrat cu el. */
  utilizator: string | null
  userId: string | null
  /**
   * Numele scurt al FANTOMEI („Mihai P.") — omul care si-a ales numele din lista, fara cont.
   * Gol cand nimeni n-a ales, si INTOTDEAUNA gol cand `userId` exista: cine a intrat cu contul
   * n-are fantoma. Nu intra in meniul contului; se scrie pe randul personal al paginii.
   */
  fantoma: string | null
  /** `cleaning.manage` — hotarat de autorizarea centrala, nu de `is_admin` din tabel. */
  eAdmin: boolean
  /** Rolul global — DOAR randul „Administrare" din meniul contului atarna de el (18.09.2026). */
  eAdminPlatforma?: boolean
  /** Jetonul CSRF pereche cu cookie-ul, scris in fiecare formular al paginii. */
  csrf: string
  versiune: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/** Jetonul CSRF, scris in fiecare formular: perechea cookie-ului, verificata la fiecare POST. */
export const campCsrf = (ctx: Ctx): string => `<input type="hidden" name="csrf" value="${esc(ctx.csrf)}">`

function contDin(ctx: Ctx): Cont {
  /*
   * ⚠️ Antetul are UN SINGUR fel de „cine sunt": contul platformei. Fantoma nu apare aici deloc
   * (user, 19.09.2026: „dacă vrea acces în platformă trebuie să intre pe Cont normal") — capul
   * meniului ii scrie tot „Cont" si il duce tot la intrare, ca oricarui necunoscut. Numele ales
   * si „Nu ești tu?" stau pe randul personal al paginii, nu in meniul unui cont pe care nu-l are.
   */
  return {
    nume: ctx.utilizator ?? 'Cont',
    intrat: !!ctx.userId,
    // ⚠️ Panoul PLATFORMEI: rolul global, nu cheia Curateniei (18.09.2026) — altfel un admin al
    // curateniei ar vedea o legatura care il intampina cu 403.
    admin: ctx.eAdminPlatforma ?? false,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    // Setarile APLICATIEI, nu ale platformei (user, 15.09.2026) — de aceea adresa e a noastra.
    // Carcasa scrie randul numai cand `intrat` e adevarat, deci fantoma nu-l vede.
    urlSetari: `${ctx.prefix}/setari`,
    poateVedeaCa: ctx.poateVedeaCa,
    veziCa: ctx.veziCa,
    spre: ctx.spre,
  }
}

export interface OptiuniPaginaApp {
  titluPagina?: string
  corp: string
  personal?: string
  /** Stil in plus, peste cel al aplicatiei (panoul de admin isi are stilul lui). */
  local?: string
  scripturi?: string
  lat?: boolean
}

export function pagina(ctx: Ctx, o: OptiuniPaginaApp): string {
  return carcasa({
    nume: 'CURĂȚENIE',
    titlu: 'Curățenia bisericii',
    titluPagina: o.titluPagina,
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home,
    local: LOCAL + (o.local ?? ''),
    cont: contDin(ctx),
    personal: o.personal,
    corp: o.corp,
    versiune: pkg.version,
    modificata: ctx.modificata,
    scripturi: o.scripturi,
    lat: o.lat,
  })
}

/** Pagina scurta cu un singur mesaj (404, „numai pentru admini", verificari de securitate). */
export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string): string {
  return pagina(ctx, {
    titluPagina: titlu,
    corp: `<h2>${esc(titlu)}</h2><p>${esc(mesaj)}</p><p><a href="${esc(ctx.prefix)}/">← Înapoi la programare</a></p>`,
  })
}

/** Unde trimitem omul cand pagina cere contul platformei. */
export function spreCont(ctx: Ctx, origine: string, unde: string): string {
  return `${ctx.nav.cont}/intra?spre=${encodeURIComponent(`${origine}${ctx.prefix}${unde}`)}`
}

export { adresaPaginii }
