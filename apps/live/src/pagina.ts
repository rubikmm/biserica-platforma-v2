import { STIL_SETARI } from '@xc/setari'
import { STIL_EMISIE } from '@xc/comanda'
import { type Navigatie } from '@xc/config'
import { type Cont, esc, pagina as carcasa } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }
import { STIL_MIC } from './mic.js'

/**
 * Carcasa pusă pe LIVE: antetul cu numele aplicației și contul, adresa platformei, subsolul.
 *
 * ⚠️ **Contul e în antet pe TOATE paginile, inclusiv pe cea publică** (user, 14.09.2026: „trebuia
 * să fie Cont pe ambele… nu e nevoie, dar Cont acolo sus e o invitație"). În V1 pagina de ascultare
 * era singura fără el — „un player simplu, nu e nevoie de login". Motivul schimbării nu e tehnic:
 * ascultatul rămâne la liber, dar omul care ascultă e chemat să-și facă un cont. Nu-l scoate.
 */

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  userId: string | null
  /**
   * SUPER-ADMINUL PLATFORMEI, citit din rolul global — de el atârnă rândul „Administrare" din
   * meniul contului. NU e același lucru cu cheia emisiei (`broadcast.manage`): vezi `contDin`.
   */
  eAdminPlatforma: boolean
  eSuperAdmin: boolean
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/**
 * ⚠️ **„Administrare" duce la ADMINISTRAREA PLATFORMEI și o vede numai super-adminul** (user,
 * 20.09.2026: „Acel panou de administrare să fie văzut doar de admini și să se numească Setări").
 *
 * Până pe 20.09.2026 rândul ăsta pleca la panoul emisiei de pe `radio` și se aprindea pentru
 * oricine avea `broadcast.manage` (potriveală locală cerută pe 14.09.2026, când panoul era o pagină
 * a lui). Regula s-a schimbat: panoul e acum o rubrică în Setările radioului, iar „Administrare" a
 * rămas ce e în toată platforma — rândul super-adminului spre Administrarea platformei.
 */
function contDin(ctx: Ctx): Cont {
  return {
    nume: ctx.utilizator ?? 'Cont',
    intrat: !!ctx.userId,
    admin: ctx.eAdminPlatforma,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    /*
     * Setarile APLICATIEI (user, 15.09.2026): raman ACASA, ale OMULUI din aplicatia in care se
     * afla. De pe 20.09.2026 tot aici se vede si rubrica „Emisia" — o singura fraza, care trimite
     * la Setarile radioului, fiindca panoul emisiei e unul singur si sta dincolo.
     */
    urlSetari: `${ctx.prefix}/setari`,
    // Codul aplicației din registru — de el atârnă rândul „→ Administrator" din „Vezi ca".
    // ⚠️ `live` și `radio` au aceeași cheie, dar coduri DEOSEBITE: masca poartă codul aplicației în
    // care stai, iar cheia pe care o împrumută e tot `broadcast.manage` la amândouă.
    cod: 'live',
    poateVedeaCa: ctx.poateVedeaCa,
    veziCa: ctx.veziCa,
    spre: ctx.spre,
  }
}

export interface OptiuniPaginaApp {
  titluPagina?: string
  corp: string
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
    local: STIL_EMISIE + STIL_MIC + STIL_SETARI + (o.local ?? ''),
    cont: contDin(ctx),
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
