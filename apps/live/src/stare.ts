import { ceSeAude, pieseDin, playlist } from '@xc/comanda'
import type {
  ActiunePanou,
  BibliotecaRadio,
  ComandaAparat,
  ModEmisie,
  SelectieRadio,
  StareEmisie,
  StarePanou,
  Telemetrie,
} from '@xc/contracts'
import { type EnvAparat, aparatViu, aparatul, treceAparatLin } from './aparat.js'
import { type EnvAscultatori, numarAscultatori } from './ascultatori.js'
import { type EnvDirect, stareDirect } from './direct.js'
import { type EnvProgram, urmatoareaSlujba } from './program.js'
import { type EnvRadioDeparte, ceasRadio, indiceRadio, puneCeas } from './radio-departe.js'

/**
 * CREIERUL emisiei. Aici se hotărăște ce e pus în spate și aici se dau comenzile — atât cele
 * apăsate de om în panou, cât și cele pe care aparatul le-a luat singur și ni le raportează.
 *
 * ⚠️ **LIVE și radioul se exclud**, ca pe aparatul din V1. Comutatorul are un singur loc aprins,
 * iar ordinea în care se scriu cele două stări contează: întâi se stinge ce trebuie stins, apoi se
 * aprinde ce trebuie aprins. Altfel, câteva secunde, s-ar auzi amândouă.
 */

export type EnvCreier = EnvDirect & EnvAparat & EnvAscultatori & EnvRadioDeparte & EnvProgram

/** După atâtea secunde de la comanda LIVE fără sunet în SFU, nu mai zicem „pornește". */
const PORNESTE_LIVE_MAX_S = 45

/**
 * `/api/stare` e cea mai cerută adresă: fiecare pagină deschisă o întreabă la câteva secunde, iar
 * fiecare răspuns citește mai multe obiecte durabile plus SFU-ul. Cu treizeci de ascultători asta
 * înseamnă zeci de citiri pe secundă, toate cu același răspuns — bani aruncați (7.09.2026: limita
 * zilnică de obiecte durabile depășită, `/v1/stare` a picat).
 *
 * De aceea ținem minte citirile BRUTE câteva secunde în izolat și le împărțim între toți cei care
 * întreabă în acest răstimp; răspunsul se SOCOTEȘTE de fiecare dată la zi (ceasul, secunda piesei),
 * deci nimeni nu primește o secundă veche. Cererile venite deodată primesc aceeași promisiune.
 */
const PROASPETE_MS = 3000
type Temelie = Awaited<ReturnType<typeof citesteTot>>
let tinutMinte: { la: number; p: Promise<Temelie> } | null = null

function citesteTot(env: EnvCreier) {
  const ap = aparatul(env)
  return Promise.all([stareDirect(env), ceasRadio(env), ap.comanda(), urmatoareaSlujba(env), ap.stare()] as const)
}

function temelia(env: EnvCreier): Promise<Temelie> {
  const acum = Date.now()
  if (tinutMinte && acum - tinutMinte.la < PROASPETE_MS) return tinutMinte.p
  const p = citesteTot(env)
  tinutMinte = { la: acum, p }
  // O citire căzută nu se ține minte: următorul care întreabă încearcă din nou.
  p.catch(() => {
    if (tinutMinte?.p === p) tinutMinte = null
  })
  return p
}

/**
 * Ce transmite parohia ACUM. Singurul adevăr pe care îl urmăresc paginile amândurora.
 *
 * Radioul are întâietate cât e pornit: în cele câteva secunde de suprapunere de după STOP directul
 * încă se aude, dar ascultătorul a ales deja radioul.
 */
export async function stareEmisie(env: EnvCreier): Promise<StareEmisie> {
  const [d, ceas, cmd, urmatoarea, t] = await temelia(env)
  const b = await asiguraIndicele(env, ceas.biblioteca.semnatura)
  // Socotit PROASPĂT, cu ceasul de acum: secunda piesei rămâne exactă chiar dacă citirea e de
  // acum câteva secunde. De aceea ținem minte selecția, nu rezultatul.
  const r = ceSeAude(b, ceas.selectie)
  let mod: ModEmisie = 'oprit'
  if (r.pornit && r.cale) mod = 'radio'
  else if (d.direct) mod = 'live'
  else if (cmd.stare === 'live' && Date.now() - Date.parse(cmd.la) < PORNESTE_LIVE_MAX_S * 1000) mod = 'porneste-live'

  const slujba = t && t.stare === 'live' && t.slujba?.nume ? { nume: t.slujba.nume, de: t.activ_de_la } : null
  return { live: d.direct, mod, direct: d, radio: r, slujba, urmatoarea, ora: new Date().toISOString() }
}

/*
 * Socoteala radioului are nevoie de lista întreagă de piese, care stă în cealaltă aplicație. Ca să
 * n-o cerem la fiecare bătaie de pagină, ceasul vine cu AMPRENTA bibliotecii, iar lista se ține
 * aici, în izolat, cât timp amprenta nu se schimbă. Prima cerere după o schimbare o aduce din nou.
 */
let indiceTinut: { semnatura: string; b: BibliotecaRadio } | null = null

/** Aduce indicele dacă amprenta s-a schimbat; altfel îl dă pe cel ținut, fără nicio cerere. */
export async function asiguraIndicele(env: EnvCreier, semnatura: string): Promise<BibliotecaRadio> {
  if (indiceTinut && indiceTinut.semnatura === semnatura) return indiceTinut.b
  const b = await indiceRadio(env)
  indiceTinut = { semnatura: b.semnatura, b }
  return b
}

// --- Panoul --------------------------------------------------------------------

export async function starePanou(env: EnvCreier, potComanda: boolean, eSuperAdmin: boolean): Promise<StarePanou> {
  const ap = aparatul(env)
  const [ceas, telemetrie, comanda, direct, ascultatori] = await Promise.all([
    ceasRadio(env),
    ap.stare(),
    ap.comanda(),
    stareDirect(env),
    numarAscultatori(env).catch(() => null),
  ])
  const b = await asiguraIndicele(env, ceas.biblioteca.semnatura)
  return {
    radio: ceSeAude(b, ceas.selectie),
    selectie: ceas.selectie,
    director: ceas.selectie.director,
    biblioteca: ceas.biblioteca,
    aparat: telemetrie,
    viu: aparatViu(telemetrie),
    comanda_versiune: comanda.versiune,
    comanda_la: comanda.la,
    comanda_de: comanda.de,
    direct,
    ascultatori,
    pot_comanda: potComanda,
    super_admin: eSuperAdmin,
    acum: new Date().toISOString(),
  }
}

// --- Comenzile -----------------------------------------------------------------

/** Comanda „radio" pentru aparat (boxele bisericii): selecția cu ceasul ei. */
const radioPentruAparat = (sel: SelectieRadio) => ({
  stare: 'radio' as const,
  director: sel.director,
  fisier_start: sel.fisier_start,
  selectie: { versiune: sel.versiune, director: sel.director, fisier_start: sel.fisier_start, de: sel.de },
})

export interface Raspuns {
  ok: boolean
  motiv?: string
  status: number
  selectie?: SelectieRadio
  comanda?: ComandaAparat
}

/**
 * Ce a apăsat omul în panou. `cine` e numele afișat (pentru jurnal), `eSuperAdmin` hotărăște doar
 * dreptul la OPRIT — restul cere `broadcast.manage`, verificat de aplicația care primește cererea.
 */
export async function executaComanda(
  env: EnvCreier,
  c: { actiune: ActiunePanou; director?: string; fisier?: string },
  cine: string | null,
  eSuperAdmin: boolean,
): Promise<Raspuns> {
  const ap = aparatul(env)
  const ceas = await ceasRadio(env)
  const b = await asiguraIndicele(env, ceas.biblioteca.semnatura)
  const sel = ceas.selectie

  switch (c.actiune) {
    case 'oprit': {
      /*
       * Liniște de tot. Rămâne la super-admin, ca în V1: „RADIO vreau să meargă permanent… opritul
       * manual nu are sens decât pentru mine ca super-admin" — Părintele dă mute, nu oprește.
       */
      if (!eSuperAdmin) {
        return { ok: false, status: 403, motiv: 'OPRIT e doar pentru super-administrator — radioul merge permanent' }
      }
      const [selectie, comanda] = await Promise.all([
        puneCeas(env, { pornit: false }, cine),
        ap.puneComanda({ stare: 'oprit' }, cine),
      ])
      return { ok: true, status: 200, selectie, comanda }
    }

    case 'live': {
      if (!aparatViu(await ap.stare())) {
        return { ok: false, status: 409, motiv: 'aparatul de la biserică nu răspunde — nu pot porni LIVE' }
      }
      // Întâi se stinge ceasul radioului, apoi se cere directul: altfel, o clipă, ar fi amândouă.
      const selectie = await puneCeas(env, { pornit: false }, cine)
      const comanda = await ap.puneComanda({ stare: 'live' }, cine)
      return { ok: true, status: 200, selectie, comanda }
    }

    case 'stop': {
      // STOP nu e liniște: oprește directul, iar radioul reia. Fără director ales încă, luăm
      // primul cu muzică în el, ca pe aparatul din V1.
      let director = sel.director
      if (!director || pieseDin(b, director).length === 0) {
        director = b.fisiere[0]?.cale.split('/')[0] ?? null
      }
      if (!director) return { ok: false, status: 409, motiv: 'biblioteca e goală — nu am ce porni la radio' }
      const selectie = await puneCeas(env, { pornit: true, director }, cine)
      await treceAparatLin(ap, radioPentruAparat(selectie), cine)
      return { ok: true, status: 200, selectie }
    }

    case 'director': {
      const piese = c.director ? pieseDin(b, c.director) : []
      const prima = piese[0]
      if (!c.director || !prima) return { ok: false, status: 400, motiv: 'director necunoscut sau fără audio' }
      // Ca pe aparat: directorul ales pornește de la prima lui piesă, și stinge directul.
      const selectie = await puneCeas(env, { pornit: true, director: c.director, fisier_start: prima.cale }, cine)
      await treceAparatLin(ap, radioPentruAparat(selectie), cine)
      return { ok: true, status: 200, selectie }
    }

    case 'piesa': {
      const director = c.director ?? sel.director
      const piese = pieseDin(b, director)
      if (!c.fisier || !piese.some((x) => x.cale === c.fisier)) {
        return { ok: false, status: 400, motiv: 'piesa nu e în directorul ales' }
      }
      const selectie = await puneCeas(env, { pornit: true, director, fisier_start: c.fisier }, cine)
      await treceAparatLin(ap, radioPentruAparat(selectie), cine)
      return { ok: true, status: 200, selectie }
    }

    case 'urmatoarea':
    case 'anterioara': {
      const lista = playlist(b, sel)
      if (lista.length === 0) return { ok: false, status: 409, motiv: 'nu e nicio selecție' }
      const a = ceSeAude(b, sel)
      const pas = c.actiune === 'urmatoarea' ? 1 : -1
      const i = (((a.index + pas) % lista.length) + lista.length) % lista.length
      const tinta = lista[i]
      if (!tinta) return { ok: false, status: 409, motiv: 'nu e nicio selecție' }
      const selectie = await puneCeas(env, { pornit: true, fisier_start: tinta.cale }, cine)
      await treceAparatLin(ap, radioPentruAparat(selectie), cine)
      return { ok: true, status: 200, selectie }
    }
  }
}

/**
 * O decizie luată PE APARAT (LIVE peste limita de ore → radio; la ora slujbei din program → LIVE;
 * radio implicit) ajunge aici prin telemetrie. Dacă e mai nouă decât ultima comandă și n-am
 * preluat-o deja, o facem comandă: radioul paginilor pornește pe selecția aparatului, cu ceasul
 * LUI, iar aparatul primește înapoi o versiune nouă cu același conținut (nu repornește nimic).
 *
 * O comandă dată de om DUPĂ decizie rămâne mai nouă și o bate — ultima hotărâre câștigă.
 */
export async function preiaDecizia(env: EnvCreier, t: Telemetrie): Promise<void> {
  const d = t.decizie
  if (!d?.la || !d.stare) return
  const ap = aparatul(env)
  const [comanda, preluata] = await Promise.all([ap.comanda(), ap.deciziePreluata()])
  if (preluata === d.la) return
  const laD = Date.parse(d.la)
  const laC = Date.parse(comanda.la || '')
  if (!Number.isFinite(laD) || (Number.isFinite(laC) && laD <= laC)) return

  const cine =
    d.motiv === 'program' && d.slujba?.nume ? `aparatul (program: ${d.slujba.nume})` : `aparatul (${d.motiv || 'singur'})`
  await ap.puneDeciziePreluata(d.la)

  if (d.stare === 'radio' && d.selectie?.director) {
    const sel = await puneCeas(
      env,
      {
        pornit: true,
        director: d.selectie.director,
        fisier_start: d.selectie.fisier_start ?? null,
        de: d.selectie.de || d.la,
      },
      cine,
    )
    await ap.puneComanda(radioPentruAparat(sel), cine)
  } else if (d.stare === 'live') {
    await puneCeas(env, { pornit: false }, cine)
    await ap.puneComanda({ stare: 'live' }, cine)
  } else if (d.stare === 'oprit') {
    await puneCeas(env, { pornit: false }, cine)
    await ap.puneComanda({ stare: 'oprit' }, cine)
  }
}
