/**
 * Carcasa pusa pe curatenie: antetul cu numele aplicatiei si contul, adresa platformei, subsolul
 * cu tema si versiunea. In V1 toate astea erau copiate in aplicatie (`src/comun/`); aici vin din
 * `@xc/ui`, ca la toate aplicatiile V2.
 *
 * Cele trei „potriviri locale" pe care V1 le tinea ca sa poata fi sterse la legarea de platforma
 * (scria „Autentificare" in loc de „Cont", ascundea „Profil", trimitea „Administrare" la panoul
 * aplicatiei) AU FOST STERSE: contul e acum cel al platformei, cu meniul lui intreg si cu „vezi
 * ca". A ramas din ele un singur lucru, fiindca utilizatorul a cerut sa ramana pickerul: cand
 * nimeni n-a intrat cu contul, dar omul si-a ales numele din lista, antetul scrie NUMELE LUI —
 * altfel pagina ar spune „Cont", iar el tocmai apasase pe numele lui.
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
  /** Numele scurt al voluntarului ales din lista („Mihai P."), cand exista. */
  voluntar: string | null
  /** `cleaning.manage` — hotarat de autorizarea centrala, nu de `is_admin` din tabel. */
  eAdmin: boolean
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
   * Antetul are DOUA feluri de „cine sunt", fiindca aplicatia are doua usi:
   *  - cine a intrat cu CONTUL platformei vede meniul obisnuit (Profil, Administrare, „vezi ca",
   *    Iesire) — la fel ca in orice alta aplicatie V2;
   *  - cine si-a ales numai NUMELE din lista („modul simplu", pastrat anume de utilizator) nu are
   *    cont, deci n-are ce sa caute in meniul contului: numele lui scrie in antet, iar apasarea
   *    deschide iar lista de nume (`?alege=1`), de unde poate lua alt nume. Iesirea din numele ales
   *    sta pe randul personal al paginii de programare, nu aici.
   */
  if (!ctx.userId && ctx.voluntar) {
    return { nume: ctx.voluntar, intrat: false, href: `${ctx.prefix}/?alege=1` }
  }
  return {
    nume: ctx.utilizator ?? 'Cont',
    intrat: !!ctx.userId,
    admin: ctx.eAdmin,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    poateVedeaCa: ctx.poateVedeaCa,
    veziCa: ctx.veziCa,
    spre: ctx.spre,
  }
}

export interface OptiuniPaginaApp {
  titluPagina?: string
  corp: string
  unelte?: string
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
    unelte: o.unelte,
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
