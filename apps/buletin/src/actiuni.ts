/**
 * CE ȘTIE SĂ FACĂ BULETINUL — lista lui de acțiuni, publicată la `/_actiuni`.
 *
 * Se citește de un model de limbaj, dar și de o altă aplicație sau de o automatizare: toți cer la
 * fel, nimeni n-are o cale privilegiată.
 *
 * ⚠️ Regula modulului: NICIO logică aici. Socoteala e în `masuri.ts`, compunerea în `compune.ts`,
 * forma hârtiei în `foaie.ts`. Aici doar se declară ce se poate cere și cu ce argumente.
 *
 * ⚠️ SCRISE PENTRU UN MODEL MIC (cerere user, 17.09.2026: „un sistem care poate lucra cu un AI la
 * final — nu foarte deștept, dar cu rezultate foarte bune, cum am făcut la Programul liturgic").
 * De aceea:
 *   - `buletin.masura` e cunoștință de FUNDAL: modelul știe câte semne încap ÎNAINTE să scrie,
 *     fără să ceară nimic. Un model mic nu întreabă „cât să scriu?" — scrie, și de-aia trebuie să
 *     afle dinainte;
 *   - `buletin.socoteala` răspunde în cifre, nu în vorbe: „mai ai loc pentru 812 semne" e o
 *     instrucțiune pe care o poate urma, „textul e cam lung" nu e;
 *   - `buletin.compune` REFUZĂ un text prea lung în loc să-l taie, și spune cu cât s-a depășit.
 *     Modelul primește înapoi exact cifra cu care trebuie să scurteze și încearcă din nou.
 */
import { z } from 'zod'
import { actiune, registru } from '@xc/actiuni'
import { dataLunga } from '@xc/ui'
import {
  type EnvCompunere,
  NUMELE_TREPTEI,
  calendarulNumarului,
  cheiaNumarului,
  compune,
  pastreazaCererea,
  plangeriDeForma,
  textCurat,
} from './compune.js'
import { SECUNDARI_MAXIM, type NumarCerut, semne, socoteste, variante } from './masuri.js'

export interface EnvActiuniBuletin extends EnvCompunere {
  DB: D1Database
}

// ---------------------------------------------------------------------------
// Forma unui articol, scrisă ca s-o poată umple și un model mic
// ---------------------------------------------------------------------------

// ⚠️ Autorul, titlul, textul și sursa sunt OPȚIONALE din 17.09.2026, seara: ce lipsește se umple cu
// text de probă, la vedere („NUME AUTOR", „TITLU ARTICOL", Lorem ipsum, „Sursa: -"), cât încape —
// vezi `umplere.ts`. Un număr se poate compune și gol, ca să se vadă cum arată.
const Articol = z.object({
  autor: z.string().optional().describe('numele autorului sau al sfântului, cu majuscule — scrisul alb din zona neagră; dacă nu se știe, „Fără autor"; lipsă = „NUME AUTOR", de probă'),
  ani: z.string().optional().describe('anii vieții, dacă se știu: „1661-1729"'),
  pomenire: z.string().optional().describe('ziua de pomenire, ultimul rând al zonei negre: „† 16 august"'),
  titlu: z.string().optional().describe('titlul articolului, cu majuscule, scurt — intră pe cel mult trei rânduri; lipsă = „TITLU ARTICOL", de probă'),
  text: z.string().optional().describe('textul articolului; paragrafele se despart cu rând gol; *între steluțe* = cursive (citatele din Scriptură); lipsă = Lorem ipsum, exact cât încape'),
  sursa: z.string().optional().describe('de unde e luat: „ziarullumina.ro"; lipsă = „-"'),
  nota: z.string().optional().describe('mențiunea de deasupra sursei, în cuvinte: „Mesajul Patriarhului Daniel la proclamarea locală a canonizării…"'),
  poza: z.boolean().optional().describe('are poză? la principal e poza mare de pe pagina întâi, la secundar una mică'),
})

const Numar = z.object({
  motto: z.string().min(1).describe('citatul de sub antet, pe cel mult două rânduri'),
  moto_autor: z.string().optional().describe('cine a spus citatul: „Părintele Arsenie Papacioc"'),
  nr: z.number().int().positive().describe('numărul buletinului — următorul din arhivă'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('duminica numărului, AAAA-LL-ZZ; programul tipărit e al săptămânii care începe a doua zi'),
  principal: Articol.describe('articolul principal: poza mare, zona neagră cu autorul, titlul, textul și sursa'),
  secundari: z.array(Articol).max(SECUNDARI_MAXIM).optional()
    .describe(`cel mult ${SECUNDARI_MAXIM} articole secundare, fiecare cu zona neagră, titlu, text și sursă`),
})

/** Un articol din acțiune în forma domeniului: câmpurile lipsă devin goale (le umple `umplere.ts`). */
const articolCerut = (a: z.infer<typeof Articol>): NumarCerut['principal'] => ({
  ...a,
  autor: a.autor ?? '',
  titlu: a.titlu ?? '',
  text: a.text ?? '',
})

/** Din forma acțiunii în forma domeniului (numele câmpurilor diferă doar la moto_autor). */
const caCerut = (n: z.infer<typeof Numar>): NumarCerut => ({
  motto: n.motto,
  motoAutor: n.moto_autor,
  nr: n.nr,
  data: n.data,
  principal: articolCerut(n.principal),
  secundari: n.secundari?.map(articolCerut),
  floare: true,
})

// ---------------------------------------------------------------------------
// Acțiunile
// ---------------------------------------------------------------------------

/**
 * REGULILE FOII, în cuvinte — ce citește modelul înainte să compună (user, 17.09.2026: „buletinul
 * descompus pe componente pe care un AI simplu le poate gestiona: să înlocuiască un text, să
 * utilizeze un API, să citească niște reguli"). Scurt, fiindcă intră la fiecare mesaj.
 */
export const REGULI = [
  'Buletinul are PATRU pagini A4, două coloane pe fiecare. Componentele lui sunt: motto (+ cine l-a spus), nr, data, articolul principal, cel mult DOI secundari, calendarul (vine singur de la program), subsolul (fix).',
  'Pagina 1, coloana din stânga: NUMAI poza mare și zona neagră a principalului (autor, ani, pomenire). Nu se pune text acolo.',
  'Articolul principal: autor (majuscule), titlu (majuscule, scurt), text pe paragrafe (rând gol între ele; *între steluțe* = cursive), sursa și, opțional, o mențiune deasupra sursei (`nota`). Un secundar are aceleași părți, cu poză mică opțională.',
  'Câte semne încap e scris în `buletin.masura` — cere-o înainte să scrii. Textul care nu încape NU se taie de API: `buletin.compune` refuză și spune cu cât e peste. Scurtează cu atât și încearcă iar.',
  'Calendarul de pe pagina 4 e programul săptămânii care începe a doua zi după data numărului; dacă textul nu încape, API-ul îl strânge singur (întâi fără sfinții duminicii, apoi fără pericopă) și spune ce treaptă a folosit.',
  'Dacă programul săptămânii nu e validat, se folosește ce e disponibil (propunerea) și răspunsul spune la început „PROPUS", în `atentie`. Nu e o greșeală, dar trebuie spus omului.',
  'Un articol gol nu e greșeală: autorul, titlul, textul și sursa lipsă se umplu cu text de probă la vedere („NUME AUTOR", „TITLU ARTICOL", Lorem ipsum, „Sursa: -"), exact cât încape la programul întreg — un secundar ia o pătrime din text, doi secundari jumătate. Răspunsul spune în `atentie` ce a fost de probă.',
  'Data numărului e duminica; numărul e ultimul din arhivă + 1. Autorul care nu se știe se scrie „Fără autor".',
]

export const actiuniBuletin = registru<EnvActiuniBuletin>([
  actiune({
    nume: 'buletin.reguli',
    descriere: 'Regulile după care se compune foaia tipărită a buletinului: componentele ei, ce are voie și ce nu, cum se răspunde când textul nu încape.',
    efect: 'citeste',
    fundal: true,
    intrare: z.object({}),
    iesire: z.object({ reguli: z.array(z.string()) }),
    exemple: ['cum se compune buletinul?', 'ce părți are un număr?'],
    async executa() {
      return { reguli: REGULI }
    },
  }),

  actiune({
    nume: 'buletin.masura',
    descriere:
      'Câte semne încap în foaia tipărită a buletinului, pe fiecare variantă (un singur autor; ' +
      'autor principal plus unul sau doi secundari — un secundar ia o pătrime din text). Cifrele ' +
      'sunt măsurate pe numerele apărute, nu ghicite. Se cere înainte de a scrie textul unui număr.',
    efect: 'citeste',
    fundal: true,
    intrare: z.object({}),
    iesire: z.object({
      randuri_pe_coloana: z.number(),
      semne_pe_rand: z.number(),
      variante: z.array(z.object({
        varianta: z.string(),
        semne: z.number(),
        zone: z.array(z.object({ cine: z.string(), semne: z.number() })),
      })),
    }),
    exemple: [
      'cât text încape într-un buletin?',
      'câte semne pot scrie dacă pun doi autori secundari?',
    ],
    async executa() {
      const { RANDURI_PE_COLOANA, SEMNE_PE_RAND } = await import('./masuri.js')
      // O săptămână obișnuită, ca socoteala să fie cea de toate zilele, nu una fără calendar.
      return {
        randuri_pe_coloana: RANDURI_PE_COLOANA,
        semne_pe_rand: SEMNE_PE_RAND,
        variante: variante({ slujbe: 6, detalii: 5 }),
      }
    },
  }),

  actiune({
    nume: 'buletin.socoteala',
    descriere:
      'Verifică dacă textul scris încape în numărul cerut și spune, pe fiecare articol, câte ' +
      'semne încap, câte s-au scris și câte au rămas (negativ = s-a trecut peste). Nu compune ' +
      'nimic și nu schimbă nimic. Calendarul săptămânii se ia de la program, fiindcă el hotărăște ' +
      'cât loc rămâne pe pagina a patra.',
    efect: 'citeste',
    intrare: z.object({
      nr: z.number().int().positive(),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      motto: z.string().default(''),
      principal: Articol.describe('articolul principal; pentru socoteală e destul textul'),
      secundari: z.array(Articol).max(SECUNDARI_MAXIM).optional(),
    }),
    iesire: z.object({
      incape: z.boolean(),
      semne_cu_tot: z.number(),
      scrise_cu_tot: z.number(),
      zone: z.array(z.object({
        cine: z.string(), semne: z.number(), scrise: z.number(), ramase: z.number(),
      })),
      calendar: z.object({
        titlu: z.string(), slujbe: z.number(),
        stare: z.enum(['validat', 'propus']).describe('propus = nevalidat, s-a folosit ce era disponibil'),
      }).nullable(),
      plangeri: z.array(z.string()),
    }),
    exemple: [
      { fraza: 'încape textul ăsta în buletinul 616?', argumente: { nr: 616, data: '2026-09-20' } },
      'mai am loc pentru un articol secundar?',
    ],
    async executa(a, c) {
      const cal = await calendarulNumarului(c.env, a.data)
      const cuCalendar = 'eroare' in cal ? null : cal
      const s = socoteste({
        motto: a.motto,
        nr: a.nr,
        data: a.data,
        principal: articolCerut(a.principal),
        secundari: (a.secundari ?? []).map(articolCerut),
        floare: true,
        calendar: cuCalendar ? { slujbe: cuCalendar.slujbe, detalii: cuCalendar.detalii } : undefined,
      })
      return {
        incape: s.incape,
        semne_cu_tot: s.semneCuTot,
        scrise_cu_tot: s.scriseCuTot,
        zone: s.zone.map((z) => ({ cine: z.cine, semne: z.semne, scrise: z.scrise, ramase: z.ramase })),
        calendar: cuCalendar ? { titlu: cuCalendar.titlu, slujbe: cuCalendar.slujbe, stare: cuCalendar.stare } : null,
        plangeri: 'eroare' in cal ? [`calendarul: ${cal.eroare}`, ...s.plangeri] : s.plangeri,
      }
    },
  }),

  actiune({
    nume: 'buletin.compune',
    descriere:
      'Compune foaia tipărită a unui număr — antetul fix, motto-ul, numărul și data, articolele pe ' +
      'două coloane și, pe pagina a patra, programul liturgic al săptămânii care urmează — și pune ' +
      'PDF-ul în depozit. REFUZĂ, cu cifre, dacă textul nu încape: nu taie niciodată singur. ' +
      'Ce lipsește (autor, titlu, text, sursă) se umple cu text de probă, la vedere. Programul ' +
      'nevalidat se folosește ca PROPUS — răspunsul o spune în `atentie`.',
    efect: 'scrie',
    permisiune: 'bulletin.write',
    intrare: Numar,
    iesire: z.object({
      facut: z.boolean(),
      cheie: z.string().nullable(),
      semne_intrate: z.number().nullable(),
      semne_pe_dinafara: z.number().nullable(),
      /** cum a ieșit calendarul: întreg, fără sfinți, sau și fără pericopă */
      calendar: z.string().nullable(),
      /** validat sau propus (nevalidat — s-a folosit ce era disponibil) */
      program: z.enum(['validat', 'propus']).nullable(),
      /** de spus la ÎNCEPUT, chiar dacă s-a făcut: programul PROPUS, textul de probă */
      atentie: z.array(z.string()),
      plangeri: z.array(z.string()),
    }),
    exemple: [
      { fraza: 'compune buletinul 616 de duminica viitoare', argumente: { nr: 616, data: '2026-09-20' } },
    ],
    async rezuma(a) {
      const p = plangeriDeForma(caCerut(a))
      if (p.length) throw new Error(`nu pot compune: ${p.join('; ')}`)
      const cati = (a.secundari ?? []).length
      const despre = a.principal.titlu
        ? `„${a.principal.titlu}" de ${a.principal.autor ?? 'NUME AUTOR (de probă)'}`
        : 'un articol principal de probă (ce lipsește se umple la vedere)'
      return `Compun buletinul nr. ${a.nr} din ${dataLunga(a.data)}: ${despre}` +
        `${cati ? ` și încă ${cati} ${cati === 1 ? 'articol' : 'articole'}` : ''}. ` +
        `PDF-ul se va pune în depozit la ${cheiaNumarului(caCerut(a))}.`
    },
    async executa(a, c) {
      const cerut = caCerut(a)
      const r = await compune(c.env, { cerut })
      const calendar = r.calendar ? NUMELE_TREPTEI[r.calendar.strans] : null
      const program = r.calendar?.stare ?? null
      if (!r.ok || !r.pdf) {
        return { facut: false, cheie: null, semne_intrate: null, semne_pe_dinafara: null, calendar, program, atentie: r.atentie, plangeri: r.plangeri }
      }
      const cheie = cheiaNumarului(cerut)
      await c.env.FISIERE.put(cheie, r.pdf, {
        httpMetadata: { contentType: 'application/pdf' },
        customMetadata: { nr: String(cerut.nr), data: cerut.data, semne: String(semne(textCurat(r.cerut))) },
      })
      // cererea, ca date, lângă PDF: de aici pornește numărul următor (motto-ul) — ce a scris omul, nu proba
      await pastreazaCererea(c.env, cerut)
      return {
        facut: true,
        cheie,
        semne_intrate: r.raport?.intrate ?? null,
        semne_pe_dinafara: r.raport?.peDinafara ?? null,
        calendar,
        program,
        atentie: r.atentie,
        plangeri: [],
      }
    },
  }),
])
