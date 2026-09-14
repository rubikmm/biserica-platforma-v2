import { STIL_EMISIE } from '@xc/comanda'
import { type Navigatie } from '@xc/config'
import { type Cont, esc, pagina as carcasa } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }

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
  /** `broadcast.manage` — hotărât de autorizarea centrală, nu de rolul citit local. */
  eAdmin: boolean
  eSuperAdmin: boolean
  /**
   * Unde duce „Administrare" din meniul contului: **panoul emisiei de pe `radio`**, același din
   * amândouă aplicațiile (user, 14.09.2026). Vezi nota din `contDin`.
   */
  urlPanou: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/**
 * ⚠️ **„Administrare" din meniul contului duce la PANOUL EMISIEI, nu la administrarea platformei**
 * (user, 14.09.2026: „în meniul de la Cont să fie la ambele administrare și să ducă în același
 * admin de la Radio — care e și acum la transmisiuni").
 *
 * E o **potriveală locală readusă dinadins**: în V1 fiecare aplicație trimitea „Administrare" la
 * panoul ei, iar la trecerea pe V2 lucrul ăsta a fost șters peste tot, ca meniul contului să fie
 * cel al platformei. Aici se reface, cu un motiv: emisia are un singur panou, iar omul care intră
 * pe `live` sau pe `radio` îl caută pe ăla, nu auditul platformei. Amândouă duc la **aceeași
 * adresă** (panoul de pe `radio`), ca să nu existe două locuri care par două panouri.
 */
function contDin(ctx: Ctx): Cont {
  return {
    nume: ctx.utilizator ?? 'Cont',
    intrat: !!ctx.userId,
    admin: ctx.eAdmin,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.urlPanou,
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
    local: STIL_EMISIE + (o.local ?? ''),
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
