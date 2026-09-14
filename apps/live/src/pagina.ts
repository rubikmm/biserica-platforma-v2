import { STIL_EMISIE } from '@xc/comanda'
import { type Navigatie } from '@xc/config'
import { type Cont, esc, pagina as carcasa } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }

/**
 * Carcasa pusă pe LIVE: antetul cu numele aplicației și contul, adresa platformei, subsolul.
 *
 * Pagina publică NU are cont în antet (`cont: null`) — transmisiunea slujbei e pentru oricine, ca
 * pe site-ul vechi, iar utilizatorul a cerut anume „un player simplu, nu e nevoie de login".
 * Panoul îl are, ca orice pagină de administrare din V2.
 */

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  userId: string | null
  /** `broadcast.manage` — hotărât de autorizarea centrală, nu de rolul citit local. */
  eAdmin: boolean
  eSuperAdmin: boolean
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

function contDin(ctx: Ctx): Cont {
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
  /** Pagina publică: fără cont în antet. */
  faraCont?: boolean
  local?: string
  scripturi?: string
  clasaCorp?: string
}

export function pagina(ctx: Ctx, o: OptiuniPaginaApp): string {
  return carcasa({
    nume: 'LIVE',
    titlu: 'Transmisiunea în direct',
    titluPagina: o.titluPagina,
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home,
    local: STIL_EMISIE + (o.local ?? ''),
    cont: o.faraCont ? null : contDin(ctx),
    corp: o.corp,
    versiune: pkg.version,
    modificata: ctx.modificata,
    scripturi: o.scripturi,
    clasaCorp: o.clasaCorp,
  })
}

/** Pagină scurtă cu un singur mesaj (404, „numai pentru administratori", verificări de securitate). */
export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string): string {
  return pagina(ctx, {
    titluPagina: titlu,
    corp: `<h2>${esc(titlu)}</h2><p>${esc(mesaj)}</p><p><a href="${esc(ctx.prefix)}/">← Înapoi la transmisiune</a></p>`,
  })
}

/** Unde trimitem omul când pagina cere contul platformei. */
export function spreCont(ctx: Ctx, origine: string, unde: string): string {
  return `${ctx.nav.cont}/intra?spre=${encodeURIComponent(`${origine}${ctx.prefix}${unde}`)}`
}
