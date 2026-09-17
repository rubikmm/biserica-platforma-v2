/**
 * HARTIILE PROGRAMULUI, într-un singur loc.
 *
 * Aici stă ce era până acum scris în corpul rutelor `/v1`: cum se adună datele unei foi și ce
 * HTML iese. Rutele au rămas învelișuri (traduc rezultatul în răspuns HTTP, cu cache și coduri de
 * eroare), iar acțiunile din `actiuni.ts` sunt al doilea înveliș, peste ACELAȘI cod.
 *
 * Mutarea nu e cosmetică: regula modulului de acțiuni e că o acțiune nu conține logică proprie.
 * Fără fișierul ăsta, `program.foaia_sfintilor` ar fi trebuit să repete cum se cer sfinții de la
 * tipic și cum se așază pe foaie — adică exact duplicarea din V1, mutată cu un etaj mai sus.
 */
import { adaugaZile, dataCuZi, dataLunga, luneaSaptamanii } from '@xc/ui'
import type { IntrareVocabular, Saptamana, Slujba } from '@xc/contracts'
import { calendarulIntervalului, texteleZilei, ziuaCalendarului } from './calendar.js'
import {
  istoriculSlujbelor,
  saptamana,
  slujbaDin,
  slujbeleSaptamanii,
  vecinele,
  vocabularul,
} from './depozit.js'
import { foaieHtml, sfintiiHtml, stilTabel, tabelProgram, titluSaptamanii, type OptiuniFoaie } from './foaie.js'
import { propune } from './propunere.js'
import { sfintiiDinCarti } from './tipic.js'
import { LATIME_POZA, pozaSaptamaniiHtml, type Ctx } from './pagini.js'

/** Numai ce ating hârtiile din `env` — ca fișierul să nu atârne de forma întreagă a aplicației. */
export interface EnvHartii {
  DB: D1Database
  CALENDAR: Fetcher
  TIPIC: Fetcher
  BROWSER: Fetcher
}

export type Hartie = { corp: string; nume: string; titlu: string }

export type RezultatFoaie =
  /** `optiuni` e materia din care s-a făcut foaia: de acolo își ia buletinul tabelul, fără să
   *  mai întrebe încă o dată baza de date. */
  | ({ ok: true; optiuni: OptiuniFoaie } & Hartie)
  | {
      ok: false
      cod: 'saptamana_inexistenta' | 'saptamana_nevalidata'
      mesaj: string
      detalii: Record<string, unknown>
    }

async function vocabularulCerut(
  env: EnvHartii,
  dat?: Map<string, IntrareVocabular>,
): Promise<Map<string, IntrareVocabular>> {
  if (dat) return dat
  return new Map((await vocabularul(env.DB)).map((v) => [v.cod_nume, v]))
}

// ---------------------------------------------------------------------------
// „Sfinții zilei"
// ---------------------------------------------------------------------------

/**
 * Foaia sfinților unei zile: lista calendarului, apoi pomenirile cărților tipicului, fiecare fără
 * ce s-a spus mai sus (cerere user, 11.09.2026). Dacă tipicul tace, rămâne o singură listă.
 *
 * `null` înseamnă că nu se poate face foaia fiindcă ziua nu vine de nicăieri — calendarul tace.
 */
export async function htmlSfintiiZilei(
  env: EnvHartii,
  data: string,
  cuSinaxar = false,
): Promise<Hartie | null> {
  const zi = await ziuaCalendarului(env.CALENDAR, data)
  if (!zi) return null
  const [texte, surse] = await Promise.all([
    cuSinaxar ? texteleZilei(env.CALENDAR, data) : Promise.resolve(null),
    sfintiiDinCarti(env.TIPIC, data),
  ])
  return {
    corp: sfintiiHtml({ data, zi, sinaxar: texte?.sinaxar ?? null, cuSinaxar, surse }),
    nume: `sfintii-zilei-${data}${cuSinaxar ? '-cu-sinaxar' : ''}`,
    titlu: `Sfinții zilei — ${dataLunga(data)}`,
  }
}

// ---------------------------------------------------------------------------
// Foaia A4 de pe ușă (și propunerea ei)
// ---------------------------------------------------------------------------

export async function htmlFoaiaSaptamanii(
  env: EnvHartii,
  data: string,
  fel: 'foaie' | 'propunere',
  vocabularDat?: Map<string, IntrareVocabular>,
): Promise<RezultatFoaie> {
  const harta = await vocabularulCerut(env, vocabularDat)
  const luni = luneaSaptamanii(data)
  const rand = await saptamana(env.DB, luni)
  let slujbe: Slujba[]
  let dinCalendar = true

  if (fel === 'foaie') {
    if (!rand) {
      return {
        ok: false,
        cod: 'saptamana_inexistenta',
        mesaj: 'Săptămâna nu e în bază.',
        detalii: { de_la: luni, pana_la: adaugaZile(luni, 6), vecine: await vecinele(env.DB, luni) },
      }
    }
    if (rand.stare !== 'validat') {
      return {
        ok: false,
        cod: 'saptamana_nevalidata',
        mesaj: 'Foaia se tipărește numai din săptămâni validate.',
        detalii: { de_la: luni, pana_la: rand.duminica, stare: rand.stare },
      }
    }
    slujbe = (await slujbeleSaptamanii(env.DB, luni)).map(slujbaDin)
    dinCalendar = rand.sursa === 'manual' || rand.sursa === 'propunere'
  } else {
    const p = propune(
      luni,
      await istoriculSlujbelor(env.DB, luni),
      harta,
      await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7)),
    )
    slujbe = p.zile.flatMap((zi) =>
      zi.slujbe.map((s) => ({
        id: `${s.data}-${s.cod_nume}`,
        data: s.data,
        ora: s.ora,
        nume: s.nume,
        cod_nume: s.cod_nume,
        slujitor: null,
        loc: 'biserica',
        observatii: null,
        detalii: s.detalii,
        curatenie: false,
        transmisie: false,
      })),
    )
  }

  // Pe HARTIE intervalul se scrie mereu calculat („7 – 13 septembrie 2026"), ca in V1: titlurile
  // importate din V1 au cratima in loc de linie de dialog, si se vedea in caseta foii.
  const titlu = titluSaptamanii(luni)
  const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7))
  const optiuni: OptiuniFoaie = {
    luni,
    duminica: adaugaZile(luni, 6),
    titlu,
    slujbe,
    vocabular: harta,
    calendar: cal,
    dinCalendar,
    ciorna: fel === 'propunere',
  }
  return {
    ok: true,
    corp: foaieHtml(optiuni),
    optiuni,
    nume: fel === 'foaie' ? `program-${luni}` : `propunere-${luni}`,
    titlu: fel === 'foaie' ? `Programul săptămânii — ${titlu}` : `Propunere de program — ${titlu}`,
  }
}

/**
 * TABELUL săptămânii, pentru cine îl pune în pagina LUI — azi buletinul, pe pagina a patra.
 *
 * Întoarce tabelul, stilul lui și cifrele din care se socotește cât loc mănâncă (`slujbe`,
 * `detalii`): cel care compune trebuie să știe înainte de randare dacă mai are loc de text.
 *
 * ⚠️ Trece prin ACEEAȘI cale ca foaia de pe ușă (`htmlFoaiaSaptamanii`), deci moștenește și
 * poarta ei: o săptămână nevalidată nu dă tabel, cum nu dă nici foaie. Buletinul nu tipărește un
 * program pe care parohia nu l-a confirmat.
 */
export async function tabelulSaptamanii(
  env: EnvHartii,
  data: string,
  vocabularDat?: Map<string, IntrareVocabular>,
  strans: 0 | 1 | 2 = 0,
): Promise<
  | { ok: true; tabel: string; stil: string; titlu: string; de_la: string; pana_la: string; slujbe: number; detalii: number; strans: 0 | 1 | 2 }
  | { ok: false; cod: string; mesaj: string; detalii?: unknown }
> {
  const f = await htmlFoaiaSaptamanii(env, data, 'foaie', vocabularDat)
  if (!f.ok) return f
  const o: OptiuniFoaie = { ...f.optiuni, strans }
  const tabel = tabelProgram(o)
  return {
    ok: true,
    tabel,
    stil: stilTabel(true),
    titlu: o.titlu,
    de_la: o.luni,
    pana_la: o.duminica,
    slujbe: o.slujbe.length,
    // detaliile se numără pe tabelul GATA FĂCUT, nu pe date: la treapta strânsă o parte au căzut,
    // iar cel care socotește locul de pe pagina a patra trebuie să știe câte rânduri se văd
    detalii: (tabel.match(/class="det/g) ?? []).length,
    strans,
  }
}

// ---------------------------------------------------------------------------
// Poza paginii
// ---------------------------------------------------------------------------

/** Săptămâna scrisă, iar dacă nu e — propunerea ei. Aceeași sursă ca pagina. */
export async function saptamanaOriPropunere(
  env: EnvHartii,
  luni: string,
  vocabular: Map<string, IntrareVocabular>,
) {
  const rand = await saptamana(env.DB, luni)
  const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7))
  if (rand) {
    const slujbe = (await slujbeleSaptamanii(env.DB, luni)).map(slujbaDin)
    return {
      rand,
      slujbe,
      cal,
      propunere: null,
      dinCalendar: rand.sursa !== 'wp_program' && rand.sursa !== 'wp_articol' && rand.sursa !== 'wp_live',
    }
  }
  const p = propune(luni, await istoriculSlujbelor(env.DB, luni), vocabular, cal)
  const slujbe: Slujba[] = p.zile.flatMap((zi) =>
    zi.slujbe.map((s) => ({
      id: `${s.data}-${s.cod_nume}`,
      data: s.data,
      ora: s.ora,
      nume: s.nume,
      cod_nume: s.cod_nume,
      slujitor: null,
      loc: 'biserica',
      observatii: null,
      detalii: s.detalii,
      curatenie: false,
      transmisie: false,
    })),
  )
  return { rand: null, slujbe, cal, propunere: p, dinCalendar: true }
}

export async function htmlPozaSaptamanii(
  env: EnvHartii,
  data: string,
  o: {
    ctx: Ctx
    azi: string
    cuCalendar: boolean
    tema?: 'light' | 'dark'
    vocabular?: Map<string, IntrareVocabular>
  },
): Promise<Hartie> {
  const harta = await vocabularulCerut(env, o.vocabular)
  const luni = luneaSaptamanii(data)
  const s = await saptamanaOriPropunere(env, luni, harta)
  const corp = pozaSaptamaniiHtml({
    ctx: o.ctx,
    luni,
    titlu: titluSaptamanii(luni),
    stare: s.rand?.stare ?? 'propunere',
    slujbe: s.slujbe,
    vocabular: harta,
    cal: s.cal,
    dinCalendar: s.dinCalendar,
    azi: o.azi,
    tema: o.tema ?? 'light',
    cuCalendar: o.cuCalendar,
  })
  return {
    corp,
    nume: o.cuCalendar ? `program-calendar-${luni}` : `program-${luni}`,
    titlu: `Programul săptămânii — ${titluSaptamanii(luni)}`,
  }
}

export { LATIME_POZA }

// ---------------------------------------------------------------------------
// Săptămâna ca TEXT
// ---------------------------------------------------------------------------

/**
 * Programul săptămânii în text simplu: de citit la radio, de lipit într-un mesaj, de dat unui
 * model. Aceeași ordine ca pe foaie — zilele, apoi orele —, cu rândurile „→" ale slujbei dedesubt.
 */
export function textSaptamanii(s: Saptamana): string {
  const randuri: string[] = [
    `Programul săptămânii ${titluSaptamanii(s.de_la)}${s.stare === 'validat' ? '' : ' (propunere)'}`,
  ]
  let ziCurenta = ''
  for (const sl of s.slujbe) {
    if (sl.data !== ziCurenta) {
      ziCurenta = sl.data
      const zi = dataCuZi(sl.data)
      randuri.push('', zi.charAt(0).toUpperCase() + zi.slice(1))
    }
    randuri.push(`  ${sl.ora}  ${sl.nume}${sl.loc && sl.loc !== 'biserica' ? ` (${sl.loc})` : ''}`)
    for (const d of sl.detalii) randuri.push(`         → ${d}`)
  }
  if (!s.slujbe.length) randuri.push('', 'Săptămână fără slujbe înregistrate.')
  return randuri.join('\n')
}
