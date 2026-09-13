import { describe, expect, it } from 'vitest'
import {
  duminicaTrecuta, duminicileLunii, lunaCurenta, lunaEditabila, lunaViitoare, numeGeneric,
  numeleDuminicilor, notaParticipare, sorteazaParticiparea, ultimaDuminicaTrecuta,
} from '../apps/curatenie/src/calendar.js'
import { bazaSlugului, numeScurt, renumeroteaza } from '../apps/curatenie/src/depozit.js'
import { buildSlotMessage } from '../apps/curatenie/src/notificari.js'
import {
  newsletterBuildData, newsletterMonthlyTriggerToday, newsletterRenderHtml, nextSundayDate,
} from '../apps/curatenie/src/newsletter.js'
import type { Moment } from '../apps/curatenie/src/timp.js'

/**
 * CURĂȚENIA (A6) — probele care păzesc purtările ușor de stricat la o curățare de cod.
 *
 * Aplicația s-a portat din V1 purtare cu purtare, iar cele mai multe reguli de aici nu se văd din
 * citirea codului: ora 18 care mută duminica în trecut, „trenulețul" pozițiilor, lunea în care
 * pleacă raportul lunar, numele duminicii cerut de la calendar. Fiecare probă spune și DE CE e așa.
 */

/** Un „acum" de perete, ca `acum()`, dar hotărât de probă. */
function clipa(ymd: string, h = 12): Moment {
  const [y = 0, m = 0, d = 0] = ymd.split('-').map(Number)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { y, m, d, w, h, i: 0, s: 0, ymd }
}

describe('duminicile și lunile editabile', () => {
  it('găsește toate duminicile lunii', () => {
    // Septembrie 2026: 6, 13, 20, 27.
    expect(duminicileLunii(2026, 9)).toEqual(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
  })

  it('⚠️ duminica trece în trecut abia la ora 18, nu la miezul nopții', () => {
    // Regula din V1: slujba și curățenia se fac dimineața, dar ziua rămâne „de acum" până seara —
    // altfel omul programat azi ar vedea duminica lui blocată de la primele ore.
    const dimineata = clipa('2026-09-13', 9)
    const seara = clipa('2026-09-13', 18)
    expect(duminicaTrecuta('2026-09-13', dimineata)).toBe(false)
    expect(duminicaTrecuta('2026-09-13', seara)).toBe(true)
    expect(duminicaTrecuta('2026-09-06', dimineata)).toBe(true)
  })

  it('luna curentă sare la următoarea când și ultima duminică a trecut', () => {
    // 27 septembrie 2026 e ultima duminică a lunii; după ora 18 „luna curentă" devine octombrie,
    // ca oamenii să nu rămână cu un calendar în care nu se mai poate face nimic.
    expect(lunaCurenta(clipa('2026-09-27', 9))).toEqual([2026, 9])
    expect(lunaCurenta(clipa('2026-09-27', 19))).toEqual([2026, 10])
    expect(lunaViitoare(clipa('2026-09-27', 19))).toEqual([2026, 11])
  })

  it('editabile sunt numai luna curentă și cea viitoare', () => {
    const mo = clipa('2026-09-13', 9)
    expect(lunaEditabila(2026, 9, mo)).toBe(true)
    expect(lunaEditabila(2026, 10, mo)).toBe(true)
    expect(lunaEditabila(2026, 11, mo)).toBe(false)
    expect(lunaEditabila(2026, 8, mo)).toBe(false)
  })

  it('ultima duminică trecută, pentru rândul „Ultima actualizare"', () => {
    expect(ultimaDuminicaTrecuta(clipa('2026-09-16', 9))).toBe('2026-09-13')
    expect(ultimaDuminicaTrecuta(clipa('2026-09-13', 9))).toBe('2026-09-06')
    expect(ultimaDuminicaTrecuta(clipa('2026-09-13', 19))).toBe('2026-09-13')
  })
})

describe('numele duminicii — de la calendar (A1)', () => {
  /** Un calendar de probă: întoarce ce i se dă, și numără câte cereri a primit. */
  function calendarFals(zile: { data: string; denumire: string | null }[]) {
    let cereri = 0
    const fetcher = {
      async fetch(_adresa: string) {
        cereri++
        return new Response(JSON.stringify({ zile }), { headers: { 'content-type': 'application/json' } })
      },
    } as unknown as Fetcher
    return { fetcher, cereri: () => cereri }
  }

  it('ia denumirea zilei de la calendar, cu o singură cerere pe interval', async () => {
    // ⚠️ În V1 numele celor 52 de duminici erau scrise de mână în cod și acopereau NUMAI 2026.
    const c = calendarFals([{ data: '2026-09-20', denumire: 'Duminica după Înălțarea Sfintei Cruci' }])
    const nume = await numeleDuminicilor(c.fetcher, '2026-09-01', '2026-10-31')
    expect(nume('2026-09-20')).toBe('Duminica după Înălțarea Sfintei Cruci')
    expect(c.cereri()).toBe(1)
  })

  it('când calendarul tace, rămâne numele generic — pagina nu cade', async () => {
    const mut = { async fetch() { throw new Error('calendarul e oprit') } } as unknown as Fetcher
    const nume = await numeleDuminicilor(mut, '2026-09-01', '2026-09-30')
    expect(nume('2026-09-20')).toBe('Duminica - 20 septembrie')
    expect(numeGeneric('2027-01-03')).toBe('Duminica - 3 ianuarie')
  })

  it('o zi fără denumire (duminică de rând necalculată) ia tot numele generic', async () => {
    const c = calendarFals([{ data: '2026-09-20', denumire: null }])
    const nume = await numeleDuminicilor(c.fetcher, '2026-09-01', '2026-09-30')
    expect(nume('2026-09-20')).toBe('Duminica - 20 septembrie')
  })
})

describe('când pleacă rapoartele', () => {
  it('duminica raportului e cea care vine; după ora 18 sare la următoarea', () => {
    expect(nextSundayDate(clipa('2026-09-16', 9))).toBe('2026-09-20')
    expect(nextSundayDate(clipa('2026-09-20', 9))).toBe('2026-09-20')
    expect(nextSundayDate(clipa('2026-09-20', 19))).toBe('2026-09-27')
  })

  it('⚠️ raportul lunar pleacă LUNEA săptămânii care conține 1 ale lunii țintă', () => {
    // Regula din V1, aleasă anume ca lunarul să nu cadă în aceeași zi cu săptămânalul de sâmbătă.
    // 1 octombrie 2026 e joi → lunea săptămânii lui e 28 septembrie.
    expect(newsletterMonthlyTriggerToday(clipa('2026-09-28'))).toEqual([2026, 10])
    // O luni din mijlocul lunii nu declanșează nimic.
    expect(newsletterMonthlyTriggerToday(clipa('2026-09-14'))).toBeNull()
    // Marți, chiar în săptămâna cu 1, tot nu: ziua e a lunii, nu a săptămânii.
    expect(newsletterMonthlyTriggerToday(clipa('2026-09-29'))).toBeNull()
  })
})

describe('scrisoarea săptămânală', () => {
  /** Baza de probă: o duminică cu două poziții ocupate din patru. */
  const dbFals = {
    prepare: (_sql: string) => ({
      bind: (..._p: unknown[]) => ({
        async all() {
          return {
            results: [
              { slot_position: 1, volunteer_id: 3, first_name: 'Maria', last_name: 'Ionescu' },
              { slot_position: 2, volunteer_id: 7, first_name: 'Andrei', last_name: 'Pop' },
            ],
          }
        },
      }),
    }),
  } as unknown as D1Database

  it('numără locurile libere până la pragul de patru și scrie numele liturgic', async () => {
    const date = await newsletterBuildData(dbFals, '2026-09-20', () => 'Duminica după Înălțarea Sfintei Cruci')
    expect(date.occupied).toBe(2)
    expect(date.free_count).toBe(2)
    expect(date.slot_count).toBe(4)
    expect(date.liturgical).toBe('Duminica după Înălțarea Sfintei Cruci')

    const html = newsletterRenderHtml(date, 'https://curatenie.staging.sfantul-ilie.ro/')
    expect(html).toContain('Maria Ionescu')
    expect(html).toContain('Mai e nevoie de <strong style="color:#7a5a14;">2 voluntari</strong>')
    // Cele două poziții rămase se scriu „liber", nu lipsesc din tabel.
    expect(html.match(/liber/g)?.length).toBe(2)
    // Legătura „Deschideți calendarul" duce la adresa aplicației, nu la o adresă scrisă în cod.
    expect(html).toContain('href="https://curatenie.staging.sfantul-ilie.ro/"')
  })

  it('scrisoarea rămâne pe alb și în tema întunecată a cititorului', () => {
    // Potrivelile pentru Outlook (`data-ogsc`) și pentru `prefers-color-scheme` sunt din V1 și nu se
    // scot: fără ele, scrisoarea se inversează singură în unele programe de mail și devine ilizibilă.
    const html = newsletterRenderHtml(
      { sunday_date: '2026-09-20', date_label: '20 septembrie 2026', liturgical: 'x', slots: {}, slot_count: 4, occupied: 0, free_count: 4 },
      'https://exemplu.ro/',
    )
    expect(html).toContain('[data-ogsc] body')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('color-scheme" content="light only')
  })
})

describe('pozițiile unei duminici — „trenulețul"', () => {
  /** Adună comenzile SQL pe care le-ar rula re-numerotarea. */
  function comenzi(cate: number): string[] {
    const stmts: string[] = []
    const db = {
      prepare: (sql: string) => {
        stmts.push(sql.replace(/\s+/g, ' ').trim())
        return { bind: () => ({}) }
      },
    } as unknown as D1Database
    renumeroteaza(db, '2026-09-20', cate)
    return stmts
  }

  it('⚠️ mută întâi totul la +1000, apoi trage pozițiile una câte una', () => {
    // Fără pasul de +1000, re-numerotarea s-ar lovi de unicitatea (duminică, poziție) în mijlocul
    // mutării: poziția 2 n-ar putea deveni 1 cât timp 1 mai există. Așa era și în V1.
    const c = comenzi(3)
    expect(c[0]).toContain('slot_position = slot_position + 1000')
    expect(c.length).toBe(4)
    for (const s of c.slice(1)) expect(s).toContain('slot_position > 1000')
  })

  it('numărul de pași e mărginit, ca o cerere stricată să nu ceară 10.000 de comenzi', () => {
    expect(comenzi(0).length).toBe(2)
    expect(comenzi(500).length).toBe(121)
  })
})

describe('numele voluntarului', () => {
  it('numele scurt e „Prenume I." — cum scrie pe butoanele sloturilor', () => {
    expect(numeScurt({ first_name: 'Maria', last_name: 'Ionescu' })).toBe('Maria I.')
    // Purtarea din V1, păstrată ca atare: fără nume de familie rămâne punctul singur („Maria ."),
    // fiindcă se taie doar spațiile de la capete. Nu se lovește de nimeni — coloana e obligatorie,
    // și toți cei 29 de voluntari au nume întreg — dar dacă vreodată se schimbă, se schimbă anume.
    expect(numeScurt({ first_name: 'Maria', last_name: '' })).toBe('Maria .')
  })

  it('slugul se face fără diacritice, din prenume și inițială', () => {
    expect(bazaSlugului('Ștefan', 'Țăranu')).toBe('stefan.t')
    expect(bazaSlugului('Ana-Maria', 'Popescu')).toBe('anamaria.p')
  })
})

describe('mesajele din jurnal', () => {
  it('spun cine, ce a făcut și câte locuri au rămas', () => {
    const v = { first_name: 'Andrei', last_name: 'Pop' }
    expect(buildSlotMessage('occupy', v, 2, '2026-09-20', 1))
      .toBe('Andrei P. a ocupat poziția Voluntar 2. Mai este 1 loc liber în data 20.09.2026.')
    expect(buildSlotMessage('release', v, 2, '2026-09-20', 3))
      .toBe('Andrei P. a eliberat poziția de Voluntar 2. Mai sunt 3 locuri libere în data 20.09.2026.')
  })
})

describe('socoteala participării', () => {
  it('cine n-a venit niciodată se deosebește de cine doar n-a venit luna asta', () => {
    expect(notaParticipare(0, 0, '2026-05-02 10:00:00', null).label).toBe('adăugat 02.05.2026')
    expect(notaParticipare(0, 5, '2026-01-01 10:00:00', '2026-08-16').label).toBe('ultima participare 16.08.2026')
    expect(notaParticipare(2, 7, '2026-01-01 10:00:00', '2026-09-13').label).toBe('')
  })

  it('întâi cei care au venit luna asta, apoi după totalul de pe tot istoricul', () => {
    const stats = [
      { id: 1, first_name: 'Ana', last_name: 'A', attended: 0, created_at: null, joined_after: false },
      { id: 2, first_name: 'Bogdan', last_name: 'B', attended: 1, created_at: null, joined_after: false },
      { id: 3, first_name: 'Cristi', last_name: 'C', attended: 2, created_at: null, joined_after: false },
    ]
    const totaluri = { 1: 40, 2: 3, 3: 9 }
    expect(sorteazaParticiparea(stats, totaluri).map((s) => s.id)).toEqual([3, 2, 1])
  })
})
