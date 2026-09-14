import { STIL_EMISIE } from '@xc/comanda'
import { type Navigatie } from '@xc/config'
import { type Cont, esc, pagina as carcasa } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }
import { STIL_BIBLIOTECA } from './biblioteca-pagina.js'
import { STIL_MIC } from './mic.js'

/**
 * Carcasa pusă pe RADIO. Pagina publică n-are cont în antet — radioul se ascultă fără cont, ca și
 * directul; restul paginilor (panoul, muzica, microfonul) îl au, ca orice pagină de lucru din V2.
 */

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  userId: string | null
  /** `broadcast.manage` — hotărât de autorizarea centrală. */
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
  faraCont?: boolean
  local?: string
  scripturi?: string
}

export function pagina(ctx: Ctx, o: OptiuniPaginaApp): string {
  return carcasa({
    nume: 'RADIO',
    titlu: 'Radioul parohiei',
    titluPagina: o.titluPagina,
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home,
    local: STIL_EMISIE + STIL_BIBLIOTECA + STIL_MIC + (o.local ?? ''),
    cont: o.faraCont ? null : contDin(ctx),
    corp: o.corp,
    versiune: pkg.version,
    modificata: ctx.modificata,
    scripturi: o.scripturi,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string): string {
  return pagina(ctx, {
    titluPagina: titlu,
    corp: `<h2>${esc(titlu)}</h2><p>${esc(mesaj)}</p><p><a href="${esc(ctx.prefix)}/">← Înapoi la radio</a></p>`,
  })
}

export function spreCont(ctx: Ctx, origine: string, unde: string): string {
  return `${ctx.nav.cont}/intra?spre=${encodeURIComponent(`${origine}${ctx.prefix}${unde}`)}`
}
