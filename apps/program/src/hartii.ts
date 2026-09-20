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
import { adaugaZile, amprenta, dataCuZi, dataLunga, luneaSaptamanii } from '@xc/ui'
import type { IntrareVocabular, Saptamana, Slujba } from '@xc/contracts'
import { calendarulIntervalului, texteleZilei, ziuaCalendarului } from './calendar.js'
import {
  eProgramata,
  istoriculSlujbelor,
  saptamana,
  slujbaDin,
  slujbeleSaptamanii,
  ultimaSchimbareaSaptamanii,
  VEDE_TOT,
  vecinele,
  vocabularul,
  type Vedere,
} from './depozit.js'
import { foaieHtml, sfintiiHtml, stilTabel, tabelProgram, titluSaptamanii, type OptiuniFoaie } from './foaie.js'
import { propune, slujbeDinPropunere } from './propunere.js'
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
  v: Vedere,
  vocabularDat?: Map<string, IntrareVocabular>,
): Promise<RezultatFoaie> {
  const harta = await vocabularulCerut(env, vocabularDat)
  const luni = luneaSaptamanii(data)
  const rand = await saptamana(env.DB, luni, v)
  let slujbe: Slujba[]
  let dinCalendar = true

  if (fel === 'foaie') {
    if (!rand) {
      return {
        ok: false,
        cod: 'saptamana_inexistenta',
        mesaj: 'Săptămâna nu e în bază.',
        detalii: { de_la: luni, pana_la: adaugaZile(luni, 6), vecine: await vecinele(env.DB, luni, v) },
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
    slujbe = (await slujbeleSaptamanii(env.DB, luni, v)).map(slujbaDin)
    dinCalendar = rand.sursa === 'manual' || rand.sursa === 'propunere'
  } else {
    const p = propune(
      luni,
      await istoriculSlujbelor(env.DB, luni, v),
      harta,
      await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7)),
    )
    // maparea propunere → slujbe stă într-un singur loc (`slujbeDinPropunere`), fiindcă aceeași
    // listă o cere și răspunsul din chat; acolo e scris și de ce `transmisie` e adevărat mereu
    slujbe = slujbeDinPropunere(p)
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
 * ⚠️ POARTA S-A SCHIMBAT la 17.09.2026, seara (user: „la compunerea buletinului trebuie să se
 * folosească fără probleme programul propus dacă nu este validat — deci ce e disponibil — doar
 * trebuie atrasă atenția la început PROPUS"). Până atunci tabelul trecea prin aceeași poartă ca
 * foaia de pe ușă și o săptămână nevalidată nu dădea nimic. Acum: săptămâna VALIDATĂ dacă e; altfel
 * CE E DISPONIBIL — rândurile ei din bază (stare „propus" / „modificat după validare") sau, dacă nu
 * e deloc în bază, propunerea făcută din istoric — aceeași sursă ca pagina și poza săptămânii
 * (`saptamanaOriPropunere`). Răspunsul spune LIMPEDE cu ce s-a lucrat, în `stare`: cine pune
 * tabelul în pagina lui trebuie să scrie „PROPUS" la vedere, nu să tacă.
 * ⚠️ Foaia de pe ușă (`/v1/foaie`) NU s-a schimbat: ea rămâne numai a săptămânilor validate.
 */
/**
 * CE SEMNE POARTĂ SĂPTĂMÂNA pe ușa internă — contractul pe care se sprijină buletinul (20.09.2026).
 *
 * ⚠️ `stare` ȘI `publica` NU SUNT ACELAȘI LUCRU, și tocmai de aceea sunt două:
 *   - `stare: 'validat'` = GESTUL OMULUI e făcut — a apăsat „validează", fie că săptămâna a și
 *     apărut, fie că-și așteaptă duminica. Din el hotărăște buletinul dacă scrie „PROPUS" pe pagina
 *     a patra: un program programat de paroh nu mai e o presupunere, e programul parohiei.
 *   - `publica` = e CHIAR afară, adică `stare = 'validat'` în bază. Din el se vede dacă enoriașul o
 *     poate citi deja pe site.
 * Validarea e a omului; publicarea e a ceasului. O singură coloană n-ar fi putut spune amândouă.
 */
export interface SemneleSaptamanii {
  /** `validat` = confirmată de om (publicată ORI programată); `propus` = neconfirmată. */
  stare: 'validat' | 'propus'
  /** chiar publicată: `stare = 'validat'` în bază, deci o vede și lumea */
  publica: boolean
  /** validată înainte de vreme, își așteaptă pragul (`eProgramata`) */
  programata: boolean
  /** ISO-ul clipei în care apare (ori a apărut): `programat_la`, altfel `validat_la`; `null` = niciuna */
  apare: string | null
}

/**
 * MATERIA unei săptămâni, fără nicio formă: săptămâna VALIDATĂ dacă e, altfel ce e disponibil.
 * De aici își iau materia toți cei care pun programul în pagina lor — tabelul de tipar (buletinul)
 * și bucata primei pagini a site-ului. Regula „validat / propus" se scrie o singură dată, aici.
 *
 * ⚠️ CE VEDE se hotărăște din `v`, nu de aici: cu ochii lumii o săptămână nepublicată nici nu ajunge
 * până aici (rutele o opresc cu 404 `nepublicat`); cu ușa internă se dă ce e, cu semnele pe ea.
 */
export async function materiaSaptamanii(
  env: EnvHartii,
  data: string,
  v: Vedere,
  vocabularDat?: Map<string, IntrareVocabular>,
  strans: 0 | 1 | 2 = 0,
): Promise<{ o: OptiuniFoaie } & SemneleSaptamanii> {
  const harta = await vocabularulCerut(env, vocabularDat)
  const luni = luneaSaptamanii(data)
  const rand = await saptamana(env.DB, luni, v)
  const publica = rand?.stare === 'validat'
  const programata = eProgramata(rand)
  const semne: SemneleSaptamanii = {
    stare: publica || programata ? 'validat' : 'propus',
    publica,
    programata,
    apare: rand?.programat_la ?? rand?.validat_la ?? null,
  }
  const f = await htmlFoaiaSaptamanii(env, data, 'foaie', v, harta)
  if (f.ok) return { o: { ...f.optiuni, strans }, ...semne }
  // nevalidată sau nescrisă: ce e disponibil — rândurile din bază ori propunerea din istoric
  const s = await saptamanaOriPropunere(env, luni, harta, v)
  return {
    o: {
      luni,
      duminica: adaugaZile(luni, 6),
      titlu: titluSaptamanii(luni),
      slujbe: s.slujbe,
      vocabular: harta,
      calendar: s.cal,
      dinCalendar: s.dinCalendar,
      ciorna: true,
      strans,
    },
    ...semne,
  }
}

export async function tabelulSaptamanii(
  env: EnvHartii,
  data: string,
  v: Vedere,
  vocabularDat?: Map<string, IntrareVocabular>,
  strans: 0 | 1 | 2 = 0,
): Promise<
  | ({
      ok: true
      tabel: string
      stil: string
      titlu: string
      de_la: string
      pana_la: string
      slujbe: number
      detalii: number
      strans: 0 | 1 | 2
      /**
       * AMPRENTA PROGRAMULUI SĂPTĂMÂNII — semnul după care cine l-a tipărit odată poate afla, ieftin,
       * dacă s-a schimbat de atunci (buletinul, pe ecranul `/nou`).
       *
       * ⚠️ Se ia pe tabelul ÎNTREG (treapta 0) + `stare`, NU pe cel strâns: altfel un buletin compus
       * cu programul micșorat (`strans=1`) ar părea veșnic „schimbat" față de tabelul întreg cerut de
       * ecran. Așa amprenta spune un singur lucru — ce are săptămâna de spus —, nu și cât loc a găsit
       * buletinul pentru ea. `stare` intră în ea fiindcă validarea unei săptămâni propuse SCHIMBĂ
       * foaia: dispare atenția „PROPUS".
       */
      amprenta: string
      /** ultima atingere a săptămânii (rând sau slujbă), ISO 8601; `null` la propunerea din istoric */
      modificat_la: string | null
    } & SemneleSaptamanii)
  | { ok: false; cod: string; mesaj: string; detalii?: unknown }
> {
  const { o, ...semne } = await materiaSaptamanii(env, data, v, vocabularDat, strans)
  const tabel = tabelProgram(o)
  const intreg = strans === 0 ? tabel : tabelProgram({ ...o, strans: 0 })
  const [amp, modificatLa] = await Promise.all([
    amprenta(`${semne.stare}\n${intreg}`),
    ultimaSchimbareaSaptamanii(env.DB, o.luni),
  ])
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
    ...semne,
    amprenta: amp,
    modificat_la: modificatLa,
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
  v: Vedere,
) {
  const rand = await saptamana(env.DB, luni, v)
  const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7))
  if (rand) {
    const slujbe = (await slujbeleSaptamanii(env.DB, luni, v)).map(slujbaDin)
    return {
      rand,
      slujbe,
      cal,
      propunere: null,
      dinCalendar: rand.sursa !== 'wp_program' && rand.sursa !== 'wp_articol' && rand.sursa !== 'wp_live',
    }
  }
  const p = propune(luni, await istoriculSlujbelor(env.DB, luni, v), vocabular, cal)
  // aceeași mapare ca la foaia săptămânii, din același loc (vezi `slujbeDinPropunere`)
  const slujbe: Slujba[] = slujbeDinPropunere(p)
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
    /** cu ce ochi se ia materia pozei; implicit `VEDE_TOT` — poza e o hârtie a adminului */
    vedere?: Vedere
  },
): Promise<Hartie> {
  const harta = await vocabularulCerut(env, o.vocabular)
  const luni = luneaSaptamanii(data)
  const s = await saptamanaOriPropunere(env, luni, harta, o.vedere ?? VEDE_TOT)
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
