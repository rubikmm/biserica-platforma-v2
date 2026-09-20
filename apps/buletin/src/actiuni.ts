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
  ciornaDinDepozit,
  citesteCererea,
  compune,
  mottoDinainte,
  pastreazaCererea,
  pastreazaNumarul,
  plangeriDeForma,
  programulFolosit,
  programulSaSchimbat,
  textCurat,
} from './compune.js'
import type { Buletin } from './depozit.js'
import { CUPRINS, type StareHarta, potriveste, traduFapta } from './harta.js'
import { PAGINI, SECUNDARI_MAXIM, type NumarCerut, semne, socoteste, variante } from './masuri.js'
import {
  CHEIE_CHESTIONAR,
  type CheieIntrebare,
  type Schita,
  SUBIECTE,
  catreCerere,
  cautaPomenirile,
  citesteSchita,
  dezarhiveazaSchita,
  eAtinsa,
  intrebarile,
  masuraArticolului,
  normalizeazaChestionar,
  pozeleSchitei,
  rezumatulSchitei,
  schitaDinCerere,
  schitaImplicita,
  scrieRaspuns,
  scrieSchita,
  stergeSchita,
  urmatoareaIntrebare,
} from './schita.js'

export interface EnvActiuniBuletin extends EnvCompunere {
  DB: D1Database
  /** Calendarul parohiei: de la el se cere ziua de pomenire a autorului (întrebarea 5). */
  CALENDAR?: Fetcher
  /** Comutatoarele și textele editabile — de aici vin întrebările chestionarului. */
  CONFIG?: KVNamespace
  /**
   * Adresa publică a buletinului. Din ea se face adresa întreagă a unei poze urcate: Browser
   * Rendering ia poza de pe internet, dintr-o sesiune care n-are nici cookie-ul, nici sesiunea
   * omului — deci o cheie de depozit nu i-ar folosi la nimic.
   */
  ORIGINE_PUBLICA?: string
}

/** Cele trei locuri de articol, cum le numește `buletin.raspunde` când se spune anume unde se scrie. */
const ARTICOLE = ['principal', 's1', 's2'] as const

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
  semnatura: z.string().optional().describe('rândul de sub titlu, aldin, cu corpul textului: „Text de: Părintele Mihail Stanciu, fost stareț al Mănăstirii Antim". Se scrie întreg, cum l-a spus omul — „Text de:" nu se adaugă din cod'),
  text: z.string().optional().describe('textul articolului; paragrafele se despart cu rând gol; marcajele foii merg și aici (_cursiv_, *aldin*); lipsă = Lorem ipsum, exact cât încape'),
  sursa: z.string().optional().describe('de unde e luat, literă cu literă cum a scris omul: un domeniu simplu („doxologia.ro") sau o trimitere de carte, cu titlul între marcaje („_*Cuvinte de folos*_, Editura Doxologia, Iași, 2020, p. 12"); lipsă = „-"'),
  nota: z.string().optional().describe('mențiunea de deasupra sursei, în cuvinte: „Mesajul Patriarhului Daniel la proclamarea locală a canonizării…"'),
  poza: z.boolean().optional().describe('are poză? la principal e poza mare de pe pagina întâi, la secundar una mică'),
})

/**
 * ⚠️ TOATE CÂMPURILE SUNT OPȚIONALE din 18.09.2026, seara, iar lipsa lor e drumul BUN: numărul se
 * compune ATUNCI DIN SCHIȚĂ — din ce a răspuns omul la chestionarul din bulă. Modelul cheamă
 * `buletin.compune` gol; el n-a cărat textul prin context, deci n-are ce scrie aici.
 * Câmpurile au rămas pentru cine cere compunerea din afara chatului (o altă aplicație, o unealtă).
 */
const Numar = z.object({
  motto: z.string().optional().describe('LASĂ GOL: se ia din schiță (răspunsurile din chat)'),
  moto_autor: z.string().optional().describe('cine a spus citatul: „Părintele Arsenie Papacioc"'),
  /*
   * ⚠️ NR. ȘI DATA SUNT OPȚIONALE din 18.09.2026, iar lipsa lor e drumul BUN: le ia serverul din
   * arhivă (ultimul + 1, duminica următoare), exact ca ecranul `/nou`, unde userul a cerut anume să
   * nu fie editabile. Un model care le-ar ghici ar putea scrie peste alt număr ori ar compune unul
   * deja apărut — iar cifra o știe arhiva, nu el.
   */
  nr: z.number().int().positive().optional().describe('LASĂ GOL: îl ia serverul din arhivă (ultimul + 1). Se scrie numai când omul cere anume alt număr'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('LASĂ GOL: e duminica următoare, socotită de server. Programul tipărit e al săptămânii care începe a doua zi'),
  principal: Articol.optional().describe('LASĂ GOL: articolul principal vine din schiță (poza mare, zona neagră, titlul, textul, sursa)'),
  secundari: z.array(Articol).max(SECUNDARI_MAXIM).optional()
    .describe(`LASĂ GOL: vin din schiță. Cel mult ${SECUNDARI_MAXIM} articole secundare`),
})

/** Un articol din acțiune în forma domeniului: câmpurile lipsă devin goale (le umple `umplere.ts`). */
const articolCerut = (a: z.infer<typeof Articol>): NumarCerut['principal'] => ({
  ...a,
  autor: a.autor ?? '',
  titlu: a.titlu ?? '',
  text: a.text ?? '',
})

/**
 * Din forma acțiunii în forma domeniului (numele câmpurilor diferă doar la moto_autor).
 *
 * ⚠️ `urmator` e numărul care urmează, citit din arhivă: el umple `nr` și `data` când modelul nu le-a
 * scris — și asta e drumul obișnuit (vezi lămurirea de la `Numar`).
 */
const caCerut = (n: z.infer<typeof Numar>, urmator: { nr: number | null; data: string }): NumarCerut => ({
  motto: n.motto ?? '',
  motoAutor: n.moto_autor,
  nr: n.nr ?? urmator.nr ?? 1,
  data: n.data ?? urmator.data,
  principal: articolCerut(n.principal ?? {}),
  secundari: n.secundari?.map(articolCerut),
  floare: true,
})

/**
 * Numărul și duminica ce urmează — ACEEAȘI socoteală ca pe ecranul `/nou` (`urmatorulCuSchita`):
 * dacă numărul are deja o schiță începută, ziua e a ei, nu duminica socotită din ziua de azi.
 * ⚠️ Fără asta, ecranul și chatul ar lucra la două numere deosebite îndată ce o schiță rămâne peste
 * duminică — ori după o RETRAGERE, unde numărul se întoarce cu ziua lui de dinainte.
 */
async function urmatorul(env: EnvActiuniBuletin): Promise<{ nr: number | null; data: string }> {
  const { VEDE_TOT, ultimul } = await import('./depozit.js')
  const { urmatorulCuSchita } = await import('./pagini.js')
  // ⚠️ `VEDE_TOT`: numărul următor se numără din TOATE rândurile, și cele PROGRAMATE (20.09.2026).
  // Cernut ca pentru lume, ecranul ar fi cerut iar 617 după ce 617 tocmai s-a programat, iar a doua
  // validare ar fi scris peste primul — fără nicio eroare nicăieri.
  return await urmatorulCuSchita(env, await ultimul(env.DB, VEDE_TOT), new Date().toISOString().slice(0, 10))
}

// ---------------------------------------------------------------------------
// CHESTIONARUL: schița numărului care urmează
// ---------------------------------------------------------------------------

/**
 * Întrebările de acum: cele standard, cu ce a schimbat adminul din Setări (KV `CONFIG`).
 *
 * ⚠️ Exportată fiindcă o cheamă și cârligul de fișiere din `index.ts`: mașina de stări trebuie să
 * vadă ACELEAȘI întrebări din amândouă locurile, altfel un docx urcat ar răspunde la altă întrebare
 * decât cea de pe ecran.
 */
export async function chestionarul(env: EnvActiuniBuletin): Promise<Record<CheieIntrebare, string>> {
  if (!env.CONFIG) return intrebarile()
  try {
    return intrebarile(normalizeazaChestionar(await env.CONFIG.get(CHEIE_CHESTIONAR, 'json')))
  } catch {
    // KV care tace nu oprește chestionarul: se merge pe textele standard.
    return intrebarile()
  }
}

/**
 * SCHIȚA NUMĂRULUI CARE URMEAZĂ — cea din depozit, ori una nouă, cu motto-ul numărului trecut pus
 * deja în ea (așa întrebarea 1 are ce arăta: „Motto-ul: «…». Rămâne așa?").
 *
 * ⚠️ Una singură pe număr, cheia fiind chiar numărul: două ferestre deschise scriu în aceeași
 * schiță, nu în două. Ultima scriere câștigă — ca la formularul dinainte.
 * ⚠️ Cea nouă e IMPLICITĂ, nu goală (user, 19.09.2026): pornește cu toate locurile ocupate, ca
 * numărul să se poată compune din prima clipă. Vezi `schitaImplicita`.
 */
export async function schitaNumarului(
  env: EnvActiuniBuletin,
): Promise<{ schita: Schita; noua: boolean }> {
  const { VEDE_TOT, ultimul } = await import('./depozit.js')
  const { urmatorulCuSchita } = await import('./pagini.js')
  const b = await ultimul(env.DB, VEDE_TOT)
  const urm = await urmatorulCuSchita(env, b, new Date().toISOString().slice(0, 10))
  const gasita = await citesteSchita(env, urm)
  if (gasita) return { schita: gasita, noua: false }
  const motto = await mottoDinainte(env, b).catch(() => null)
  return {
    schita: schitaImplicita({ nr: urm.nr, data: urm.data, motto: motto?.motto, motoAutor: motto?.motoAutor }),
    noua: true,
  }
}

/**
 * SCHIȚA, ȘI SCRISĂ ÎN DEPOZIT DACĂ N-A FOST — asta se cheamă de pe ecranul `/nou`.
 *
 * ⚠️ De ce se scrie la o simplă privire a paginii: schița implicită trebuie să fie ACEEAȘI pentru
 * ecran, pentru buton și pentru chat. Ținută doar în memoria cererii, ecranul ar arăta o variantă
 * zero pe care bula n-a văzut-o niciodată, iar primul răspuns din chat ar porni de la o a doua.
 */
export async function schitaPastrata(env: EnvActiuniBuletin): Promise<Schita> {
  const [{ schita, noua }, intrebari] = await Promise.all([schitaNumarului(env), chestionarul(env)])
  if (noua) {
    // ⚠️ `sistem`: varianta zero se naste dintr-o PRIVIRE pe /nou, nu dintr-o fapta a omului.
    // Aprins aici, semnul ar fi incuiat retragerea numarului dinainte inca de la prima incarcare
    // a ecranului — adica fix cand omul intra sa vada ce a gresit.
    const i = urmatoareaIntrebare(schita, intrebari)
    await scrieSchita(env, schita, { subiect: i.subiect, articol: i.articol }, 'sistem')
  }
  return schita
}

/**
 * COMPUNEREA, ÎNTR-UN SINGUR LOC — o cheamă și acțiunea `buletin.compune` (din chat), și butonul
 * „Compune numărul" de pe `/nou` (`POST /nou/compune`).
 *
 * ⚠️ Scrisă deosebit de acțiune fiindcă are DOI chemători (19.09.2026). Butonul din pagină nu trece
 * prin model, prin propunere și prin bugetul de timp al chatului — dar trebuie să facă exact același
 * lucru, altfel ecranul ar avea două feluri de a compune același număr, adică două adevăruri.
 */
export async function compuneNumarul(
  env: EnvActiuniBuletin,
  a: z.infer<typeof Numar> = {},
  ctxExec?: Pick<ExecutionContext, 'waitUntil'>,
): Promise<{
  facut: boolean
  nr: number
  data: string
  cheie: string | null
  semne_intrate: number | null
  semne_pe_dinafara: number | null
  calendar: string | null
  program: 'validat' | 'propus' | null
  /** ce s-a cedat ca să încapă textul: „fără floare", calendarul strâns; `null` = foaia întreagă */
  cedat: string | null
  atentie: string[]
  plangeri: string[]
}> {
  const { cerut, poze } = await deCompus(a, env)
  // ⚠️ Plângerile de formă (nr., data, prea mulți secundari) le întoarce `compune` ÎNAINTE de randare,
  // deci nu se mai cer aici a doua oară: un singur loc care hotărăște ce nu se poate compune.
  const r = await compune(env, { cerut, poze })
  const calendar = r.calendar ? NUMELE_TREPTEI[r.calendar.strans] : null
  const program = r.calendar?.stare ?? null
  const cedat = r.cedat ?? null
  if (!r.ok || !r.pdf) {
    /*
     * ⚠️ CIFRELE RANDĂRII SE ȚIN ȘI PE DRUMUL REFUZULUI (19.09.2026). Până aici se întorcea `null`,
     * tocmai acolo unde numărul e singurul lucru de care are nevoie omul: „cu cât e peste". Când
     * hârtia a lăsat text pe dinafară, randarea CHIAR a avut loc și a numărat — `r.raport` știe 64,
     * iar rândul de audit al zilei de ieri scria `semne_pe_dinafara: null`.
     * Rămâne `null` doar când randarea n-a apucat să se facă (socoteala a refuzat înainte) — atunci
     * cifra stă în plângerea socotelii, cu vorbele ei.
     */
    return { facut: false, nr: cerut.nr, data: cerut.data, cheie: null, semne_intrate: r.raport?.intrate ?? null, semne_pe_dinafara: r.raport?.peDinafara ?? null, calendar, program, cedat, atentie: r.atentie, plangeri: r.plangeri }
  }
  /*
   * ⚠️ TOT ce urmează unei randări reușite stă în `pastreazaNumarul`: PDF-ul, COPERTA, cererea
   * păstrată și aruncarea broșurilor vechi. Până pe 18.09.2026 aici se punea numai PDF-ul, iar
   * un număr compus din bulă rămânea pe ecran cu coperta dinainte (ori fără niciuna), cu
   * „Tipărește" dând broșura foii vechi — fără nicio eroare nicăieri (user: „a zis că Compune
   * buletinul după o modificare și nu se vede nimic").
   */
  const { cheie } = await pastreazaNumarul(
    env,
    { cerut, peHartie: r.cerut, pdf: r.pdf, coperta: r.coperta, program: programulFolosit(r.calendar) },
    ctxExec,
  )
  return {
    facut: true,
    nr: cerut.nr,
    data: cerut.data,
    cheie,
    semne_intrate: r.raport?.intrate ?? null,
    semne_pe_dinafara: r.raport?.peDinafara ?? null,
    calendar,
    program,
    cedat,
    atentie: r.atentie,
    plangeri: [],
  }
}

// ---------------------------------------------------------------------------
// RETRAGEREA (ne-publicarea) unui număr publicat greșit
// ---------------------------------------------------------------------------

/**
 * CE SE POATE RETRAGE ACUM — cernerea, într-un singur loc.
 *
 * O cheamă și previzualizarea acțiunii (`rezuma`, adică propunerea cu Da/Nu din bulă), și fapta
 * însăși (`retrageNumarul`, chemată de buton și de acțiune). Scrisă o dată fiindcă altfel butonul ar
 * putea refuza cu alte vorbe decât chatul, despre același număr.
 *
 * Două încuietori, amândouă hotărâte pe 20.09.2026:
 *   - numai numărul CURENT (`ultimul`) — cel care n-are urmaș. Unul din mijlocul arhivei a fost
 *     deja împărțit pe hârtie, iar după el au apărut altele;
 *   - numai `sursa = 'site'` — publicat de aici. Numerele aduse din arhiva parohiei nu se ating.
 * ⚠️ `nr`/`data` cerute sunt o VERIFICARE, nu o țintă: cine vrea alt număr decât cel curent primește
 * refuz, nu o ștergere. Așa două ferestre deschise nu se calcă una pe alta.
 */
export async function deRetras(
  env: EnvActiuniBuletin,
  cerut: { nr?: number; data?: string } = {},
): Promise<
  | { numarul: Buletin; urmatoarea: { nr: number; data: string; schita: Schita | null } }
  | { piedica: string }
> {
  // ⚠️ `VEDE_TOT`: se retrage și numărul PROGRAMAT (20.09.2026). El e `sursa = 'site'` și e curentul
  // adminului — iar tocmai el are cea mai mare nevoie de retragere: e singurul care se poate încă
  // îndrepta înainte să-l vadă parohia.
  const { VEDE_TOT, ultimul } = await import('./depozit.js')
  const b = await ultimul(env.DB, VEDE_TOT)
  if (!b) return { piedica: 'arhiva e goală: nu e niciun număr de retras' }
  if (b.sursa !== 'site') {
    return {
      piedica:
        `numărul curent (${b.nr} din ${dataLunga(b.data)}) vine din arhiva parohiei, nu s-a publicat ` +
        'de aici — numerele acelea nu se retrag',
    }
  }
  if ((cerut.nr !== undefined && cerut.nr !== b.nr) || (cerut.data !== undefined && cerut.data !== b.data)) {
    return {
      piedica:
        `se retrage doar numărul CURENT (${b.nr} din ${dataLunga(b.data)}); ` +
        `${cerut.nr ?? b.nr} / ${cerut.data ?? b.data} nu mai e el — un număr care are urmaș rămâne în arhivă`,
    }
  }
  /*
   * A TREIA ÎNCUIETOARE (user, 20.09.2026: „dacă s-a validat și publicat și a început lucrul la
   * ciornă să nu se mai poată anula publicarea acelui număr").
   *
   * ⚠️ DE CE E O ÎNCUIETOARE, nu o politețe: retragerea ADUCE ÎNAPOI schița numărului retras, sub
   * cheia lui. Dacă între timp s-a început ciorna numărului următor, cele două s-ar bate pe aceeași
   * masă de lucru — iar `urmatorulCuSchita` ar deschide `/nou` pe cea mai veche zi, adică pe numărul
   * retras, lăsând ciorna începută uitată în depozit. Tot ce s-a strâns pentru ea ar fi părut
   * pierdut, fără nicio eroare nicăieri. De aceea: ori ciorna nu s-a început, ori se șterge întâi.
   * ⚠️ NAȘTEREA IMPLICITĂ NU ÎNCUIE NIMIC: `atinsa` se aprinde doar la scrierile omului (vezi
   * `FelulScrierii` din `schita.ts`). Altfel o singură privire aruncată pe `/nou` — care scrie
   * varianta zero — ar fi încuiat retragerea exact în clipa în care omul vede că a greșit.
   */
  const urmatoarea = await ciornaDeDupa(env, b)
  if (eAtinsa(urmatoarea.schita)) {
    return {
      piedica:
        `ciorna nr. ${urmatoarea.nr} e începută — șterge-o întâi din „buletin nou" ` +
        '(„Șterge ciorna", resetare completă la zero), apoi se poate retrage ' +
        `nr. ${b.nr}. Altfel s-ar pierde tot ce s-a strâns pentru ${urmatoarea.nr}`,
    }
  }
  return { numarul: b, urmatoarea }
}

/**
 * CIORNA NUMĂRULUI DE DUPĂ CEL CURENT — cea care hotărăște dacă se mai poate retrage.
 *
 * ⚠️ SE CAUTĂ CA PE `/nou`, prin `urmatorulCuSchita`: după NUMĂR, nu după duminica socotită din
 * ziua de azi. O ciornă rămasă peste duminică poartă ziua ei veche, iar căutată după calendar n-ar
 * fi găsită — și încuietoarea ar fi rămas deschisă tocmai peste ciorna cea mai în primejdie.
 */
/**
 * A PATRA CONDIȚIE, PENTRU ECRAN: s-a început ciorna numărului de după?
 *
 * ⚠️ Aceeași socoteală ca în `deRetras`, chemată din același loc — nu una scrisă a doua oară pentru
 * pagini. Altfel butonul ar fi putut să se arate acolo unde ușa refuză, ori invers: omul ar fi
 * apăsat și ar fi primit un 409 de neînțeles.
 * ⚠️ O cere ECRANUL doar când chiar are ce face cu răspunsul (admin, numărul curent, `sursa='site'`),
 * ca o pagină publică să nu ajungă niciodată să caute prin depozit.
 */
export async function ciornaDeDupaEInceputa(
  env: EnvActiuniBuletin,
  curent: { nr: number; data: string },
): Promise<boolean> {
  return eAtinsa((await ciornaDeDupa(env, curent)).schita)
}

async function ciornaDeDupa(
  env: EnvActiuniBuletin,
  curent: { nr: number; data: string },
): Promise<{ nr: number; data: string; schita: Schita | null }> {
  const { urmatorulCuSchita } = await import('./pagini.js')
  const urm = await urmatorulCuSchita(env, curent, new Date().toISOString().slice(0, 10))
  const nr = urm.nr ?? curent.nr + 1
  return { nr, data: urm.data, schita: await citesteSchita(env, { nr, data: urm.data }).catch(() => null) }
}

/**
 * RETRAGEREA, ÎNTR-UN SINGUR LOC — o cheamă și butonul „Retrage" din pagina numărului
 * (`POST /nou`, `fapta=retrage`), și acțiunea `buletin.retrage` din chat.
 *
 * Cererea userului, 20.09.2026: „trebuie să avem și buton de ne-publicare — dacă s-a publicat greșit
 * — și să poată face asta și chat-ul." E inversul exact al validării, în doi pași:
 *   1. rândul IESE din arhivă (`stergeBuletin`) — din clipa aceea numărul nu mai e pe prima pagină,
 *      nici în arhivă, nici în căutare, nici în `/v1`;
 *   2. numărul se ÎNTOARCE ca schiță pe `/nou`, cu același nr., aceeași zi și tot ce avea în el.
 *
 * ⚠️ TREI IZVOARE PENTRU SCHIȚĂ, în ordinea asta — și omul află pe care din ele s-a mers:
 *   - `arhiva`: schița pusă deoparte la validare (`schita/arhiva/…`, vezi `arhiveazaSchita`). E
 *     drumul CEL BUN: numărul se întoarce cum l-a lăsat omul, cu ADRESELE POZELOR cu tot;
 *   - `cerere`: cererea păstrată sub `compus/` (`schitaDinCerere`), pentru numerele publicate
 *     înainte de 20.09.2026, care n-au schiță pusă deoparte. ⚠️ Pe drumul ăsta POZA SE PIERDE:
 *     cererea ține doar `poza: true/false`, deci adresa trebuie dată din nou;
 *   - `implicita`: nici una, nici alta (număr vechi, compus din argumente) — schița pornește de la
 *     varianta de probă. Retragerea TOT se face: rândul a ieșit oricum din arhivă.
 *
 * ⚠️ FIȘIERELE NU SE ȘTERG (foaia, coperta, broșurile, pozele, cererea): ele sunt de acum ale
 * ciornei, iar `/nou` le arată mai departe — omul vede pe ecran FOAIA publicată, cea pe care are
 * de îndreptat ceva, nu o variantă zero recompusă.
 */
/** De unde s-a luat schița unui număr retras. Ordinea e și cea a încercărilor. */
export type IzvorulSchitei = 'arhiva' | 'cerere' | 'implicita'

/**
 * CE I SE SPUNE OMULUI, pentru fiecare izvor — sfârșitul frazei de la `retrageNumarul`.
 *
 * ⚠️ Deosebirea nu e una de amănunt, ci singurul lucru pe care omul TREBUIE să-l afle înainte să
 * recompună: pe drumul cererii POZA nu s-a întors (cererea ține doar `poza: true/false`), deci
 * locul ei ar ieși gol pe hârtie dacă nu i se dă iar adresa.
 */
const VORBA_IZVORULUI: Record<IzvorulSchitei, string> = {
  arhiva:
    ', întreg, cu tot ce avea — pozele cu tot. Fișierele nu s-au pierdut: foaia de pe ecran e ' +
    'chiar cea publicată.',
  cerere:
    ', cu tot ce avea. ⚠️ Schița de la publicare nu s-a găsit, deci numărul s-a refăcut din cererea ' +
    'păstrată: ADRESELE POZELOR trebuie date din nou. Fișierele nu s-au pierdut: foaia de pe ecran ' +
    'e chiar cea publicată.',
  implicita:
    '. ⚠️ Nici schița de la publicare, nici cererea păstrată nu s-au găsit, deci schița pornește de ' +
    'la varianta de probă; foaia din depozit a rămas cea publicată.',
}

/*
 * ⚠️ FĂRĂ `ctxExec`, spre deosebire de `compuneNumarul`: aici nu se amână NIMIC. Schița trebuie
 * scrisă până la capăt înainte ca omul să fie dus la `/nou` — amânată într-un `waitUntil`, pagina
 * s-ar putea deschide înaintea ei și ar arăta numărul următor, gol, în locul celui retras.
 */
export async function retrageNumarul(
  env: EnvActiuniBuletin,
  cerut: { nr?: number; data?: string } = {},
): Promise<{
  facut: boolean
  nr: number | null
  data: string | null
  /** ce i se citește omului — aceleași vorbe în bulă și sub butonul din pagină */
  text: string
  /** de unde s-a luat schița întoarsă pe `/nou` — vezi cele trei izvoare de mai sus */
  izvor: IzvorulSchitei
}> {
  const { stergeBuletin } = await import('./depozit.js')
  const cernut = await deRetras(env, cerut)
  if ('piedica' in cernut) {
    return { facut: false, nr: cerut.nr ?? null, data: cerut.data ?? null, text: cernut.piedica, izvor: 'implicita' }
  }
  const b = cernut.numarul

  // 1. rândul iese din arhivă
  await stergeBuletin(env.DB, b.nr, b.data)

  /*
   * 2. MASA SE ELIBEREAZĂ. Ciorna numărului următor s-a NĂSCUT IMPLICIT (o privire pe `/nou` o
   * scrie) și n-a atins-o nimeni — altfel `deRetras` ne-ar fi oprit mai sus. Se șterge, ca să nu se
   * bată cu schița care se întoarce: cu amândouă în depozit, `urmatorulCuSchita` ar alege ziua cea
   * mai VECHE, deci numărul retras, iar varianta zero a celui următor ar rămâne agățată acolo,
   * arătându-se a doua oară după ce numărul se republică.
   * ⚠️ Doar dacă e chiar a numărului de după, și doar neatinsă: atâta a cernut `deRetras`.
   */
  if (cernut.urmatoarea.schita && cernut.urmatoarea.nr !== b.nr) {
    await stergeSchita(env, { nr: cernut.urmatoarea.nr, data: cernut.urmatoarea.data }).catch(() => undefined)
  }

  /*
   * 3. numărul se întoarce ca schiță, sub cheia lui de dinainte (`schita/<nr>-<data>.json`). De
   * aceea `urmatorulCuSchita` o caută după NUMĂR, nu după duminica socotită din ziua de azi: retras
   * luni, numărul ar fi rămas altfel orfan.
   *
   * ⚠️ ÎNTÂI ARHIVA. Schița pusă deoparte la validare se mută înapoi pe masa de lucru AȘA CUM E —
   * nu se reface, nu se rescrie nimic peste ea: acolo stau și adresele pozelor, singurul lucru pe
   * care refacerea din cerere nu-l poate aduce înapoi.
   */
  let izvor: IzvorulSchitei = 'arhiva'
  if (!(await dezarhiveazaSchita(env, { nr: b.nr, data: b.data }))) {
    const cerere = await citesteCererea(env, { nr: b.nr, data: b.data }).catch(() => null)
    izvor = cerere ? 'cerere' : 'implicita'
    const schita = cerere
      ? schitaDinCerere(cerere, { nr: b.nr, data: b.data })
      : schitaImplicita({ nr: b.nr, data: b.data })
    const intrebari = await chestionarul(env)
    const i = urmatoareaIntrebare(schita, intrebari)
    await scrieSchita(env, schita, { subiect: i.subiect, articol: i.articol })
  }

  /*
   * 4. SCHIȚA ÎNTOARSĂ E „ATINSĂ", pe toate cele trei drumuri — și asta nu e un amănunt de
   * contabilitate, ci încuietoarea următoare.
   *
   * Numărul retras devine ciorna lui `nr-1`, care e de acum cel curent. Dacă schița lui ar rămâne
   * neatinsă, `deRetras` ar da voie să se retragă ȘI `nr-1` — iar retragerea aceea ar ȘTERGE, la
   * pasul 2 de mai sus, tocmai schița pe care tocmai am adus-o înapoi întreagă. Două apăsări una
   * după alta, și munca de pe numărul retras ar fi dispărut fără o vorbă.
   *
   * ⚠️ Pe drumul `arhiva` schița se mută LITERĂ CU LITERĂ, deci poate veni cu `atinsa` stins (număr
   * compus și validat fără să se fi răspuns nimic în chat). De aceea semnul se pune AICI, o dată,
   * pentru toate trei — nu pe fiecare ramură.
   */
  const intoarsa = await citesteSchita(env, { nr: b.nr, data: b.data }).catch(() => null)
  if (intoarsa && !intoarsa.atinsa) await scrieSchita(env, intoarsa, intoarsa.pas, 'om')

  return {
    facut: true,
    nr: b.nr,
    data: b.data,
    text:
      `Numărul ${b.nr} din ${dataLunga(b.data)} a ieșit din arhivă și e înapoi ca schiță pe ` +
      '„Numărul următor"' + VORBA_IZVORULUI[izvor],
    izvor,
  }
}

// ---------------------------------------------------------------------------
// VALIDAREA — publicare pe loc ori PROGRAMARE pentru duminică, ora 12:00
// ---------------------------------------------------------------------------

/**
 * VALIDAREA, ÎNTR-UN SINGUR LOC — perechea exactă a lui `retrageNumarul`.
 *
 * Până pe 20.09.2026 „validarea = publicarea", pe loc (user, 18.09.2026). Tot userul a adăugat
 * pragul: „dacă este înainte de ziua pentru care este programat buletinul — adică înainte de ora
 * 12.00, duminica aceea — se poate doar «Validează și programează»; dacă este duminică după ora
 * 12.00 — «Validează și publică»." Deci apăsarea face ACELAȘI lucru — scrie rândul în arhivă —, iar
 * ce se schimbă e o singură coloană: `publicat_la`.
 *
 *   acum ≥ duminică 12:00  →  `publicat_la = acum`  → numărul e public din clipa asta (ca până acum)
 *   acum <  duminică 12:00  →  `publicat_la = prag`  → rândul e scris, dar îl vede numai adminul
 *
 * ⚠️ HOTĂRÂREA E A CEASULUI, NU A OMULUI: nu există buton „publică oricum". Numărul poartă ziua lui
 * pe hârtie; apărut miercuri, ar fi vestit o săptămână care încă n-a început.
 * ⚠️ NU SE ȘTERGE NIMIC ȘI NU SE AMÂNĂ NIMIC AICI. Arhivarea schiței și auditul rămân la chemător
 * (ele merg în `waitUntil`), fiindcă ele țin de CEREREA care a pornit validarea, nu de faptă.
 * ⚠️ `nr`/`data` sunt o VERIFICARE, nu o țintă — ca la retragere: două ferestre deschise nu publică
 * una peste alta, ci a doua află ce s-a schimbat.
 *
 * ⚠️ DIN 21.09.2026, VALIDAREA CERE PROGRAMUL VALIDAT (user, 20.09.2026, 23:33: „Buletinul preia la
 * momentul validării ce program era validat"; la întrebarea „refuz sau propunere?", 23:55: „aș pune
 * refuz, dar întârzierea lucrului la buletin ar fi nejustificată"). Deci cele două apăsări s-au
 * despărțit:
 *   - COMPUNEREA merge pe orice program, și pe o propunere — altfel nu se poate socoti spațiul
 *     paginii a patra cu o săptămână înainte. Atenția „PROPUS" rămâne cum era;
 *   - VALIDAREA nu: ea scoate numărul pe hârtia parohiei, iar hârtia nu se mai poate îndrepta. De
 *     aceea programul se cere DIN NOU aici, pe ușa internă, ÎNAINTE de orice scriere.
 * Trei răspunsuri, și fiecare cu statutul lui: propus → refuz; program mut → refuz; schimbat de la
 * compunere → se RECOMPUNE numărul, ca pagina a patra să poarte programul de acum, nu pe cel de ieri.
 */
export async function valideazaNumarul(
  env: EnvActiuniBuletin,
  cerut: { nr: number; data: string },
  acum: Date = new Date(),
): Promise<
  | { facut: true; nr: number; data: string; publicat_la: string; programat: boolean; text: string }
  /** `status` = ce se răspunde pe HTTP: 409 „nu se poate așa", 503 „programul n-a răspuns". */
  | { facut: false; text: string; status?: 409 | 503 }
> {
  const { scrieBuletin } = await import('./depozit.js')
  const { candApare, pragScris, seProgrameaza } = await import('./ceas.js')

  const urm = await urmatorul(env)
  if (!urm.nr || cerut.nr !== urm.nr || cerut.data !== urm.data) {
    return {
      facut: false,
      text:
        `numărul de pe ecran (${cerut.nr} / ${cerut.data}) nu mai e cel care urmează (${urm.nr} / ${urm.data}) — ` +
        'între timp s-a validat altceva; recompune-l pe cel de acum',
    }
  }
  let ciorna = await ciornaDinDepozit(env, urm.nr, urm.data, PAGINI)
  if (!ciorna?.cheie_pdf) {
    return { facut: false, text: 'numărul nu e compus — compune-l întâi din chat, apoi validează-l' }
  }

  /*
   * PROGRAMUL SĂPTĂMÂNII, CERUT DIN NOU — înainte de orice scriere în bază sau în depozit.
   *
   * ⚠️ Nu se citește cel păstrat lângă foaie: acela spune ce ERA la compunere, iar între compunere și
   * apăsarea asta pot trece zile. Întrebarea de aici e a clipei: e programul validat ACUM?
   * ⚠️ Cererea trece pe ușa internă (antetul din `calendarulNumarului`), deci vede și o săptămână
   * validată dar încă programată pentru duminică — pentru buletin aceea ESTE validată: validarea e
   * gestul omului, publicarea e a ceasului.
   */
  const programulAcum = await calendarulNumarului(env, urm.data).catch(() => ({
    cod: 'program_mut',
    eroare: 'programul n-a răspuns deloc',
  }))
  if ('eroare' in programulAcum) {
    /*
     * ⚠️ 503, NU 409: n-am aflat că programul e nevalidat, am aflat că nu putem afla. Un 409 ar fi
     * trimis omul să valideze un program care poate e de mult validat, iar vina e a legăturii.
     */
    return {
      facut: false,
      status: 503,
      text:
        `numărul NU s-a validat: nu se poate afla dacă programul săptămânii e validat — ${programulAcum.eroare}. ` +
        'Nu s-a scris nimic; încearcă din nou.',
    }
  }
  if (programulAcum.stare !== 'validat') {
    return {
      facut: false,
      status: 409,
      text:
        `Programul săptămânii ${programulAcum.titlu} nu e validat — validează-l întâi, în Program. ` +
        'Buletinul preia la validare programul validat.',
    }
  }

  /*
   * S-A SCHIMBAT PROGRAMUL DE LA COMPUNERE? Atunci foaia de pe ecran poartă programul de ieri, iar
   * validarea ar fi tipărit-o așa. Se RECOMPUNE, pe același drum ca butonul „Compune numărul"
   * (`compuneNumarul`, din schiță, cu pozele ei) — nu unul scris a doua oară aici.
   *
   * ⚠️ Cea mai deasă schimbare e chiar VALIDAREA programului: amprenta îl poartă pe `stare` în ea,
   * deci un număr compus pe o propunere are ÎNTOTDEAUNA altă amprentă decât săptămâna validată de
   * atunci. Adică drumul obișnuit al zilei, nu un caz rar.
   * ⚠️ Amprenta necunoscută (număr compus înainte de 19.09.2026) NU e o schimbare: `programulSaSchimbat`
   * tace, iar numărul se validează cu ce e compus. Vezi lămurirea de lângă funcție.
   */
  let cerere = await citesteCererea(env, { nr: urm.nr, data: urm.data }).catch(() => null)
  if (programulSaSchimbat(cerere?.program, programulAcum)) {
    const refacut = await compuneNumarul(env, {})
    if (!refacut.facut) {
      return {
        facut: false,
        status: 409,
        text:
          'numărul NU s-a validat: programul s-a schimbat de la compunere, iar recompunerea nu a ieșit — ' +
          `${refacut.plangeri.join('; ') || 'nu încape pe hârtie'}. Îndreaptă textul și compune din nou.`,
      }
    }
    // foaia, coperta și cererea sunt altele de acum: se citesc din nou, ca rândul din arhivă să
    // poarte cheile și măsura foii PROASPETE, nu pe ale celei tocmai înlocuite
    ciorna = await ciornaDinDepozit(env, urm.nr, urm.data, PAGINI)
    cerere = await citesteCererea(env, { nr: urm.nr, data: urm.data }).catch(() => null)
    if (!ciorna?.cheie_pdf) {
      return { facut: false, status: 409, text: 'numărul s-a recompus, dar foaia nu s-a găsit în depozit — compune din nou' }
    }
  } else if (cerere) {
    /*
     * AMPRENTĂ EGALĂ: foaia e la zi, nu se recompune nimic. Se împrospătează totuși SEMNELE de lângă
     * cerere (`publica`, `programata`, `apare`), fiindcă ele NU intră în amprentă: o săptămână
     * validată marți și apărută duminică are același tabel, dar altă poveste. Lângă numărul validat
     * trebuie să rămână ce era programul CHIAR ATUNCI.
     */
    await pastreazaCererea(env, cerere, programulFolosit(programulAcum))
  }

  // textul pentru căutare iese din cererea păstrată lângă PDF; dacă lipsește, rândul intră fără text
  // (se caută după el, nu se tipărește din el)
  const programat = seProgrameaza(urm.data, acum)
  const publicatLa = programat ? pragScris(urm.data) : acum.toISOString()

  await scrieBuletin(env.DB, {
    nr: urm.nr,
    data: urm.data,
    cheie_pdf: ciorna.cheie_pdf,
    cheie_poza: ciorna.cheie_poza,
    cheie_poza_mica: ciorna.cheie_poza_mica,
    marime_pdf: ciorna.marime_pdf,
    pagini: ciorna.pagini ?? PAGINI,
    text: cerere ? textCurat(cerere) : '',
    // ⚠️ STAREA SE SCRIE, nu se deduce (20.09.2026, 14:11): de aici înainte cine trece numărul pe
    // `publicat` e CEASUL workerului, nu o comparație făcută la citire.
    stare: programat ? 'programat' : 'publicat',
    publicat_la: publicatLa,
  })

  return {
    facut: true,
    nr: urm.nr,
    data: urm.data,
    publicat_la: publicatLa,
    programat,
    text: programat
      ? `Numărul ${urm.nr} e programat pentru ${candApare(urm.data)}. Până atunci îl vezi doar tu.`
      : `Numărul ${urm.nr} din ${dataLunga(urm.data)} e publicat: e numărul curent al parohiei.`,
  }
}

/**
 * CÂT ÎNCAPE DINTR-UN MESAJ ÎN AUDIT. Motivul, nu stiva: intrarea de audit se citește cu ochiul,
 * într-un tabel, iar un mesaj de o mie de semne ar îneca rândurile din jur.
 */
const SEMNE_IN_AUDIT = 300

/** Un rând de audit nu poartă romane: ce trece de măsură se taie și se spune cu „…". */
function taiatPentruAudit(s: string): string {
  const v = s.trim()
  return v.length > SEMNE_IN_AUDIT ? `${v.slice(0, SEMNE_IN_AUDIT)}…` : v
}

/**
 * DE CE A CĂZUT O COMPUNERE — rezumatul care se scrie în audit (`summary_json`).
 *
 * ⚠️ Scris fiindcă până pe 19.09.2026 rândul de audit al unei compuneri rămase nefăcute era `{}`:
 * se știa CĂ n-a mers (nr. 616, 10:55:55), nu și DE CE. Or tocmai plângerile sunt motivul —
 * „textul e cu 412 semne peste măsură" e ce trebuie citit a doua zi, fără să se caute prin loguri.
 *
 * ⚠️ Îl folosesc AMÂNDOI chemătorii compunerii (butonul din `/nou` și acțiunea `buletin.compune`),
 * ca rândul de audit să arate la fel, indiferent pe ce ușă a intrat cererea.
 */
export function rezumatAuditCompunere(
  r: { facut: boolean; plangeri: string[]; atentie: string[]; semne_pe_dinafara: number | null },
  eroare?: string,
): Record<string, unknown> {
  return {
    facut: r.facut,
    plangeri: r.plangeri.map(taiatPentruAudit),
    atentie: r.atentie.map(taiatPentruAudit),
    semne_pe_dinafara: r.semne_pe_dinafara,
    ...(eroare ? { eroare: taiatPentruAudit(eroare) } : {}),
  }
}

/**
 * DE CE N-A IEȘIT NUMĂRUL, ÎN VORBELE OMULUI — aceeași frază pe amândouă ușile (user, 19.09.2026,
 * 12:35: „am dat compune … am scris în chat să compună … nicio modificare").
 *
 * ⚠️ Rândul începe cu FAPTA, nu cu motivul: „NU s-a compus, foaia rămâne cea de dinainte". Omul se
 * uită la un ecran pe care foaia veche stă neschimbată — întâi trebuie să afle că așa și rămâne,
 * abia pe urmă de ce. Plângerile își poartă singure cifrele („au rămas 64 de semne pe dinafară",
 * „412 de semne peste măsură"), deci nu se mai spune „cu cât" încă o dată.
 */
export function vorbaRefuzului(r: { nr: number; plangeri: string[] }): string {
  const de = r.plangeri.length ? r.plangeri.join('; ') : 'nu încape pe hârtie'
  return `Numărul ${r.nr} NU s-a compus, foaia rămâne cea de dinainte: ${de}.`
}

/**
 * CE S-A CEDAT CA SĂ ÎNCAPĂ NUMĂRUL — spus omului tot pe amândouă ușile (user, 19.09.2026, 16:31:
 * „Ar trebui să dispară floricica și dacă nici așa nu intră să dispară sfinții din calendar").
 *
 * ⚠️ Un număr ieșit prin cedare E o izbândă, dar nu una tăcută: floarea lipsă de pe pagina a patra
 * și sfinții lipsă din calendar se văd pe hârtie, iar cine nu știe de ce lipsesc crede că s-a
 * stricat ceva. Foaia întreagă nu spune nimic — acolo n-a fost nimic de cedat.
 */
export function vorbaIzbanzii(r: { nr: number; cedat: string | null }): string {
  return r.cedat ? `Numărul ${r.nr} s-a compus, dar foaia s-a strâns ca să încapă textul: ${r.cedat}.` : ''
}

/** Compunerea care n-a apucat să răspundă (a aruncat): în audit rămâne măcar mesajul erorii. */
export function rezumatAuditEroare(eroare: string): Record<string, unknown> {
  return rezumatAuditCompunere({ facut: false, plangeri: [], atentie: [], semne_pe_dinafara: null }, eroare)
}

/**
 * CE SE COMPUNE: schița, ori ce a scris cel care cere.
 *
 * ⚠️ Hotărârea e după `principal`: fără el, numărul iese DIN SCHIȚĂ (drumul obișnuit, din chat) —
 * cu tot cu adresele pozelor, care nu se pot scrie în argumente. Cu el, se compune ce s-a cerut,
 * ca până acum, pentru cine cheamă acțiunea din afara chatului.
 * ⚠️ Nr. și data scrise ANUME rămân cu putere și pe drumul schiței: „compune 620" nu trebuie să
 * devină tăcut numărul care urmează.
 */
async function deCompus(
  a: z.infer<typeof Numar>,
  env: EnvActiuniBuletin,
): Promise<{ cerut: NumarCerut; poze: Record<string, string>; dinSchita: boolean }> {
  if (a.principal) {
    return { cerut: caCerut(a, await urmatorul(env)), poze: {}, dinSchita: false }
  }
  const { schita } = await schitaNumarului(env)
  const cerut = catreCerere(schita)
  if (a.nr) cerut.nr = a.nr
  if (a.data) cerut.data = a.data
  if (a.motto !== undefined) cerut.motto = a.motto
  if (a.moto_autor !== undefined) cerut.motoAutor = a.moto_autor
  if (a.secundari) cerut.secundari = a.secundari.map(articolCerut)
  return { cerut, poze: pozeleSchitei(schita), dinSchita: true }
}

/**
 * ADRESA UNEI POZE, întreagă și publică — asta se scrie în schiță, nu cheia.
 *
 * ⚠️ De ce nu cheia: foaia se randează în Browser Rendering, adică într-un browser din afară, fără
 * sesiunea omului și fără cookie-urile lui. El cere poza de pe internet, la `/fisier/<cheie>`; o cheie
 * de depozit nu i-ar spune nimic, iar locul pozei ar rămâne gol pe pagina întâi, fără nicio eroare.
 * Ce vine deja ca adresă (ori ca `data:`) se lasă neatins.
 */
function adresaPozei(env: EnvActiuniBuletin, valoare: string): string {
  const v = valoare.trim()
  if (/^(https?:|data:)/i.test(v)) return v
  const cheie = v.replace(/^\/+/, '').replace(/^fisier\//, '')
  const radacina = (env.ORIGINE_PUBLICA ?? '').replace(/\/+$/, '')
  return radacina ? `${radacina}/fisier/${cheie}` : v
}

/** Calendarul săptămânii tipărite, în forma cerută de socoteală; `undefined` dacă programul tace. */
async function calendarulPentru(
  env: EnvActiuniBuletin,
  data: string,
): Promise<{ masura?: NumarCerut['calendar']; stare: 'validat' | 'propus' | null }> {
  const cal = await calendarulNumarului(env, data).catch(() => ({ eroare: 'programul n-a răspuns', cod: 'indisponibil' }))
  if ('eroare' in cal) return { stare: null }
  return { masura: { slujbe: cal.slujbe, detalii: cal.detalii }, stare: cal.stare }
}

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
  'Articolul principal: autor (majuscule; un rând mai mic deasupra numelui se desparte cu ` / ` — „SFÂNTUL CUVIOS MĂRTURISITOR / SOFIAN de la ANTIM"), titlu (majuscule, scurt), opțional o semnătură pe rândul de sub titlu (`semnatura`), text pe paragrafe (rând gol între ele), sursa și, opțional, o mențiune deasupra sursei (`nota`). Un secundar are aceleași părți, cu poză mică opțională.',
  /*
   * ⚠️ MARCAJELE, O SINGURĂ REGULĂ PESTE TOT (user, 19.09.2026, 18:01: „aș vrea atât în texte cât și
   * în titluri să am italic și bold… și la sursa și la textul mare conținut articol"). Până atunci
   * steluța însemna una în `text` (cursiv) și alta în `sursa` (titlu de carte, aldin cursiv) — două
   * reguli pe care un model mic le încurca. Acum e una singură, scrisă global, și de asta a ieșit de
   * pe câmpuri.
   */
  'MARCAJELE TEXTULUI, la toate câmpurile de text ale foii (text, titlu, semnatura, sursa, nota, motto): `_între liniuțe de jos_` = cursiv, `*între steluțe*` = aldin, amândouă (`_*așa*_`) = aldin cursiv. Se trimit literă cu literă, cu semnele omului: nu adăuga marcaje de la tine și nu scoate marcajele lui. În titlu și în semnătură, `/` = trecere la rândul următor (ex. «CHIPUL BLÂND / AL DUHOVNICULUI»); se trimite literă cu literă.',
  'Câte semne încap e scris în `buletin.masura` — cere-o înainte să scrii. Textul care nu încape NU se taie de API: `buletin.compune` refuză și spune cu cât e peste. Scurtează cu atât și încearcă iar.',
  'Calendarul de pe pagina 4 e programul săptămânii care începe a doua zi după data numărului; dacă textul nu încape, API-ul îl strânge singur (întâi fără sfinții duminicii, apoi fără pericopă) și spune ce treaptă a folosit.',
  'Dacă programul săptămânii nu e validat, se folosește ce e disponibil (propunerea) și răspunsul spune la început „PROPUS", în `atentie`. Nu e o greșeală, dar trebuie spus omului.',
  'Data numărului e duminica; numărul e ultimul din arhivă + 1. Autorul care nu se știe se scrie „Fără autor".',
  'NU scrie tu numărul și data: lasă-le goale și le pune serverul (ultimul din arhivă + 1, duminica următoare). Răspunsul îți spune apoi ce număr s-a compus.',
  /*
   * ⚠️ CELE PATRU RÂNDURI ALE CHESTIONARULUI (user, 18.09.2026, seara). Formularul de pe ecran a
   * ieșit cu totul: tot ce se completează trece prin bulă, ca întrebări puse în ordine. Modelul nu
   * are de gândit nimic — are de pus întrebarea pe care i-o dă serverul și de trimis înapoi ce a
   * spus omul, sub subiectul cerut.
   */
  'Numărul nou se face dintr-un CHESTIONAR, nu dintr-un formular: comanda „buletin nou" (ori „unde am rămas?") → cheamă `buletin.chestionar`. El îți dă întrebarea următoare, gata scrisă.',
  /*
   * ⚠️ VARIANTA ZERO (user, 19.09.2026). Schița pornește cu toate locurile ocupate, deci numărul se
   * poate compune ORICÂND, din prima clipă. Modelul trebuie să știe asta: altfel, la „compune
   * buletinul" spus înainte să se fi răspuns la ceva, ar spune că n-are încă ce compune — și tocmai
   * asta a cerut omul să se poată, ca să vadă cum arată foaia.
   */
  'Numărul se poate compune ORICÂND, chiar înainte de orice răspuns: schița pornește cu locurile ocupate, iar `buletin.compune` scoate „varianta zero" — foaia întreagă, cu text de probă la vedere. Răspunsurile de mai târziu scriu peste locuri, unul câte unul.',
  'Fiecare răspuns al omului → `buletin.raspunde`, cu subiectul cerut de întrebarea de atunci. Răspunsul acțiunii îți dă întrebarea următoare: pune-o și mergi mai departe, până se spune că schița e completă.',
  'Nu inventa câmpuri și nu scrie subiecte din afara listei. Nu rescrie textul omului: trimite-l literă cu literă în `valoare` — el se păstrează pe server, nu în discuția noastră.',
  /*
   * ⚠️ REGULA CARE ȚINE MODELUL MIC ÎN VIAȚĂ (19.09.2026). Un articol lipit în bulă intră în schiță
   * DIN COD, înainte ca modelul să vadă ceva; lui îi ajunge o frază („Am pus textul…"). Fără rândul
   * ăsta, modelul tot ar încerca să „confirme" scriind textul înapoi ca `valoare` — mii de tokeni de
   * ieșire la un model gratuit, adică minutele de așteptare din 18.09.2026, 20:50.
   */
  'UN TEXT LUNG LIPIT DE OM INTRĂ SINGUR ÎN SCHIȚĂ, prin cod — vei primi o frază care spune câte semne s-au pus și unde. NU-l retrimite niciodată prin `buletin.raspunde` și nu-l repeta în răspunsul tău: e deja scris. Cheamă `buletin.chestionar` și pune întrebarea următoare.',
  'Când schița e completă, cheamă `buletin.compune` FĂRĂ argumente: ia totul din schiță. Abia acolo omul confirmă cu Da/Nu. Apoi el apasă „Validează" pe ecranul „buletin nou" — validarea e publicarea, și e a lui, nu a ta.',
  /*
   * ⚠️ INSTRUCȚIUNILE PUNCTUALE (user, 18.09.2026, 22:20: „instrucțiunile sunt precise, către un
   * obiect din lista de obiecte ce formează buletinul"). Partea grea o duce codul; modelului îi
   * rămâne de potrivit fraza cu un subiect și un articol — și atât. De aceea rândurile astea sunt
   * scrise ca o poruncă scurtă, nu ca o explicație.
   */
  'OBIECTELE FOII, pe care le poți schimba oricând, și numele lor: motto, moto_autor, iar la fiecare articol text, autor, ani, pomenire, titlu, semnatura, sursa, nota, poza. Articolele sunt trei: `principal`, `s1` (secundar 1), `s2` (secundar 2).',
  'semnatura (rândul de sub titlu, aldin, de ex. «Text de: Părintele Mihail Stanciu, fost stareț al Mănăstirii Antim») se dă oricând, ca `nota`. Trimite-o literă cu literă, cum a spus-o omul: nu adăuga tu „Text de:" și nu o confunda cu `autor`, care e scrisul alb din zona neagră.',
  /*
   * ⚠️ CE A RĂMAS PROPRIU SURSEI (user, 19.09.2026, 17:30): domeniul. Marcajele au ieșit de aici pe
   * 19.09.2026, 18:01 — sunt aceleași peste tot, scrise o dată, mai sus. Rândul ăsta ține doar ce nu
   * se poate ghici din regula generală: adresa se dă goală, foaia o îngroașă singură.
   */
  'sursa se scrie CUM A SPUS-O OMUL, literă cu literă: un domeniu se dă SIMPLU, fără marcaje — «doxologia.ro» (foaia îl scrie aldin singură, ca dintotdeauna); la o carte, titlul poartă marcajele obișnuite — «_*Cuvinte de folos*_, Editura Doxologia, Iași, 2020, p. 12»; merg și amândouă în același rând. Nu rescrie sursa și nu pune „Sursa:" în valoare — cuvântul îl scrie foaia.',
  'O instrucțiune care numește un obiect al foii și (dacă spune) un articol se traduce DIRECT în `buletin.raspunde`, fără să întrebi nimic: „schimbă motto-ul în X" → {subiect:"motto", valoare:"X"}; „titlul articolului secundar 1: Y" → {subiect:"titlu", valoare:"Y", articol:"s1"}; „scoate secundarul 2" → {subiect:"sterge_secundar"}. Valoarea e literă cu literă ce a scris omul.',
  'Lasă `articol` GOL când omul răspunde la întrebarea pe care tocmai i-ai pus-o. Scrie-l numai când omul spune el despre care articol e vorba. Dacă `intrebare` vine `null`, nu mai întreba nimic — spune doar ce s-a schimbat.',
]

// ---------------------------------------------------------------------------
// HARTA — cuprinsul foii și potrivitorul ei, pentru fluxul cu două nivele
// ---------------------------------------------------------------------------

const OptiuneHarta = z.object({ id: z.string(), nume: z.string() })

/** Ce a înțeles potrivitorul determinist (vezi `Potrivire` din `harta.ts`). */
const PotrivireIesire = z.object({
  nivel: z.enum(['sigur', 'valoare', 'nesigur', 'meniu', 'necunoscut']),
  subiect: z.string().optional(),
  actiune: z.string().optional(),
  valoare: z.string().optional(),
  articol: z.string().optional(),
  confirma: z.boolean().optional(),
  /** Omul a RĂSPUNS la întrebarea pusă (nu a dat o instrucțiune liberă). */
  raspuns: z.boolean().optional(),
  /** Omul a NUMIT câmpul („titlu: …"), deci valoarea e a lui chiar dacă sună a refuz. */
  numit: z.boolean().optional(),
  ce: z.enum(['subiect', 'actiune']).optional(),
  intre: z.array(OptiuneHarta).optional(),
  /** Omul a apăsat un buton al meniului (doar numele subiectului) — treapta a 2-a e tot meniu. */
  dinMeniu: z.boolean().optional(),
})

/** Ce are de făcut chatul: un apel al unei acțiuni EXISTENTE, cu interpretarea scrisă. */
const FaptaIesire = z.object({
  subiect: z.string(),
  actiune: z.string(),
  apel: z.object({ actiune: z.string(), argumente: z.record(z.string(), z.unknown()) }).nullable(),
  rezumat: z.string(),
  confirma: z.boolean(),
  raspuns: z.string().optional(),
})

export const actiuniBuletin = registru<EnvActiuniBuletin>([
  /**
   * POTRIVITORUL HĂRȚII — ușa prin care chatul lucrează pe cuprinsul buletinului.
   *
   * ⚠️ `ascunsa`: NU e o unealtă pe care s-o aleagă modelul. E chemată de chat-worker ca serviciu,
   * la fiecare mesaj, exact ca pe cârligul `laText`. Lăsată în lista de unelte, ar fi fost un verb în
   * plus pe care un model mic l-ar fi încercat la întâmplare — adică exact boala pe care harta o
   * drege.
   *
   * Trei întrebuințări, într-o singură acțiune fiindcă toate trei au nevoie de ACEEAȘI stare
   * (schița și întrebarea pendinte), iar două chemări ar fi putut prinde două stări deosebite:
   *   - fără argumente → cuprinsul viu + întrebarea de acum (pentru prompturi și pentru meniu);
   *   - cu `mesaj`    → ce a înțeles potrivitorul DETERMINIST din el;
   *   - cu `alegere`  → traducerea unei hotărâri (a codului sau a modelului) în apelul adevărat.
   */
  actiune({
    nume: 'buletin.harta',
    descriere:
      'Cuprinsul buletinului (subiectele și acțiunile lor), întrebarea la care a rămas chestionarul ' +
      'și potrivirea deterministă a unui mesaj pe hartă. Nu schimbă nimic.',
    efect: 'citeste',
    ascunsa: true,
    permisiune: 'bulletin.write',
    intrare: z.object({
      mesaj: z.string().optional().describe('ce a scris omul, literă cu literă'),
      alegere: z.object({
        subiect: z.string(),
        actiune: z.string(),
        valoare: z.string().optional(),
        articol: z.enum(ARTICOLE).optional(),
        raspuns: z.boolean().optional(),
        numit: z.boolean().optional(),
      }).optional().describe('subiectul și acțiunea hotărâte — se traduc în apelul de făcut'),
      asteapta: z.object({
        subiect: z.string(),
        actiune: z.string(),
        articol: z.enum(ARTICOLE).optional(),
      }).optional().describe('ce valoare s-a cerut omului la mesajul dinainte'),
    }),
    iesire: z.object({
      cuprins: z.array(z.object({
        id: z.string(),
        nume: z.string(),
        cuvinte: z.array(z.string()),
        actiuni: z.array(z.object({
          id: z.string(),
          nume: z.string(),
          cere: z.enum(['nimic', 'text', 'fisier']),
          confirma: z.boolean(),
          ascunsa: z.boolean(),
        })),
      })),
      intrebare: z.object({
        subiect: z.string(),
        articol: z.string(),
        text: z.string(),
        candidati: z.array(z.string()),
      }).nullable(),
      secundari: z.number(),
      potrivire: PotrivireIesire.nullable(),
      fapta: FaptaIesire.nullable(),
    }),
    exemple: [],
    async executa(a, c) {
      const [{ schita }, intrebari] = await Promise.all([schitaNumarului(c.env), chestionarul(c.env)])
      const i = urmatoareaIntrebare(schita, intrebari)
      const pendinte = i.subiect === 'gata' ? null : i
      const stare: StareHarta = {
        intrebare: pendinte ? { subiect: pendinte.subiect, articol: pendinte.articol, candidati: pendinte.candidati } : null,
        secundari: schita.secundari.length,
        asteapta: a.asteapta ?? null,
      }

      const potrivire = a.mesaj !== undefined ? potriveste(a.mesaj, stare) : null
      /*
       * ⚠️ Traducerea se face pentru ALEGEREA dată anume (venită de la model) SAU pentru potrivirea
       * sigură de aici. Într-o singură chemare: altfel chat-worker ar întreba de două ori, iar între
       * cele două chemări schița se poate schimba (două ferestre deschise).
       */
      const alegere =
        a.alegere ??
        (potrivire?.nivel === 'sigur'
          ? {
              subiect: potrivire.subiect,
              actiune: potrivire.actiune,
              valoare: potrivire.valoare,
              articol: potrivire.articol,
              raspuns: potrivire.raspuns,
              numit: potrivire.numit,
            }
          : null)

      return {
        cuprins: CUPRINS.map((s) => ({
          id: s.id,
          nume: s.nume,
          cuvinte: s.cuvinte,
          actiuni: s.actiuni.map((x) => ({
            id: x.id,
            nume: x.nume,
            cere: x.cere,
            confirma: x.confirma,
            ascunsa: Boolean(x.ascunsa),
          })),
        })),
        intrebare: pendinte
          ? { subiect: pendinte.subiect, articol: pendinte.articol, text: pendinte.text, candidati: pendinte.candidati ?? [] }
          : null,
        secundari: schita.secundari.length,
        potrivire,
        fapta: alegere ? traduFapta(alegere) : null,
      }
    },
  }),

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
      'cât loc rămâne pe pagina a patra. Fără niciun argument socotește SCHIȚA numărului care urmează.',
    efect: 'citeste',
    intrare: z.object({
      // la fel ca la `buletin.compune`: lipsa lor înseamnă „numărul care urmează", din arhivă
      nr: z.number().int().positive().optional().describe('LASĂ GOL: îl ia serverul din arhivă (ultimul + 1)'),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('LASĂ GOL: duminica următoare, socotită de server'),
      motto: z.string().optional(),
      principal: Articol.optional().describe('LASĂ GOL: se socotește ce e în schiță (răspunsurile din chat)'),
      secundari: z.array(Articol).max(SECUNDARI_MAXIM).optional(),
    }),
    iesire: z.object({
      /**
       * SOCOTEALA ÎN VORBE, într-o frază. ⚠️ Pusă aici (19.09.2026) fiindcă fluxul pe hartă citește
       * omului câmpul `text` al unui rezultat, dacă el există — aceeași convenție ca la acțiunile de
       * fundal: cine își scrie singur textul știe mai bine decât chatul cum se citește. Fără el,
       * „socoteală" ar fi cerut încă un apel de model doar ca să spună o cifră în românește.
       */
      text: z.string(),
      /** pentru care număr s-a socotit — el nu vine de la model, ci din arhivă */
      nr: z.number(),
      data: z.string(),
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
      'cât mai am loc în numărul următor?',
      'mai am loc pentru un articol secundar?',
    ],
    async executa(a, c) {
      // fără articol scris în cerere, se socotește SCHIȚA: acolo stă textul strâns din chat
      const cerut = a.principal
        ? caCerut({ ...a, principal: a.principal }, await urmatorul(c.env))
        : catreCerere((await schitaNumarului(c.env)).schita)
      const nr = a.nr ?? cerut.nr
      const data = a.data ?? cerut.data
      const cal = await calendarulNumarului(c.env, data)
      const cuCalendar = 'eroare' in cal ? null : cal
      const s = socoteste({
        ...cerut,
        nr,
        data,
        calendar: cuCalendar ? { slujbe: cuCalendar.slujbe, detalii: cuCalendar.detalii } : undefined,
      })
      const ramase = s.semneCuTot - s.scriseCuTot
      const despreProgram = cuCalendar
        ? ` Programul săptămânii e ${cuCalendar.stare === 'validat' ? 'validat' : 'PROPUS (nevalidat)'}.`
        : ' Programul n-a răspuns, deci pagina 4 e socotită fără el.'
      return {
        text:
          (s.incape
            ? `Încape. S-au scris ${s.scriseCuTot} din ${s.semneCuTot} de semne — mai ai loc pentru ${ramase}.`
            : `NU încape: s-au scris ${s.scriseCuTot} din ${s.semneCuTot} de semne, adică ${-ramase} peste.`) +
          despreProgram,
        nr,
        data,
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
      'PDF-ul în depozit. CHEAM-O FĂRĂ NICIUN ARGUMENT: ia totul din schiță — motto, articole, ' +
      'poze — adică din ce a răspuns omul la chestionar. REFUZĂ, cu cifre, dacă textul nu încape: ' +
      'nu taie niciodată singur. Ce lipsește (autor, titlu, text, sursă) se umple cu text de probă, ' +
      'la vedere. Programul nevalidat se folosește ca PROPUS — răspunsul o spune în `atentie`.',
    efect: 'scrie',
    permisiune: 'bulletin.write',
    intrare: Numar,
    iesire: z.object({
      facut: z.boolean(),
      /** ce număr s-a compus, ca modelul să-l poată spune omului — nu-l știa, l-a luat arhiva */
      nr: z.number(),
      data: z.string(),
      cheie: z.string().nullable(),
      semne_intrate: z.number().nullable(),
      semne_pe_dinafara: z.number().nullable(),
      /** cum a ieșit calendarul: întreg, fără sfinți, sau și fără pericopă */
      calendar: z.string().nullable(),
      /** validat sau propus (nevalidat — s-a folosit ce era disponibil) */
      program: z.enum(['validat', 'propus']).nullable(),
      /** ce s-a cedat ca să încapă textul: „fără floare", calendarul strâns; `null` = foaia întreagă */
      cedat: z.string().nullable(),
      /** de spus la ÎNCEPUT, chiar dacă s-a făcut: programul PROPUS, textul de probă */
      atentie: z.array(z.string()),
      plangeri: z.array(z.string()),
    }),
    exemple: [
      'compune buletinul',
      'gata, fă numărul',
    ],
    async rezuma(a, c) {
      // ⚠️ Rezumatul spune numărul ADEVĂRAT, luat din arhivă — el e ce citește omul în propunerea cu
      // Da/Nu, deci n-are voie să scrie altceva decât ce se va compune.
      const { cerut } = await deCompus(a, c.env)
      const p = plangeriDeForma(cerut)
      if (p.length) throw new Error(`nu pot compune: ${p.join('; ')}`)
      const cati = (cerut.secundari ?? []).length
      const despre = cerut.principal.titlu
        ? `„${cerut.principal.titlu}" de ${cerut.principal.autor || 'NUME AUTOR (de probă)'}`
        : 'un articol principal de probă (ce lipsește se umple la vedere)'
      return `Compun buletinul nr. ${cerut.nr} din ${dataLunga(cerut.data)}: ${despre}` +
        `${cati ? ` și încă ${cati} ${cati === 1 ? 'articol' : 'articole'}` : ''}. ` +
        `PDF-ul se va pune în depozit la ${cheiaNumarului(cerut)}.`
    },
    /*
     * ⚠️ AUDITUL SPUNE DE CE N-A IEȘIT, nu doar că s-a cerut. Acțiunea se cheamă FĂRĂ argumente
     * (totul vine din schiță), deci rândul scris din oficiu — `{ argumente: {} }` — nu spune nimic
     * despre un refuz. Aici intră plângerile cu cifrele lor, ca la butonul din `/nou`.
     */
    auditDetalii: ({ date, eroare }) =>
      date ? rezumatAuditCompunere(date, eroare) : rezumatAuditEroare(eroare ?? 'compunerea n-a răspuns'),
    /*
     * ⚠️ REFUZUL AJUNGE LA OM, nu doar în audit (19.09.2026). Compunerea care nu încape răspunde
     * CUMINTE (`facut:false`, cod 200), deci chatul o citea drept izbândă și spunea „Gata. Compun
     * buletinul nr. 616 …" peste o foaie rămasă neatinsă — chiar pățania de la 12:35. De aici
     * înainte, `facut:false` scrie în bulă ce scrie și sub butonul din `/nou`, cu aceleași cuvinte.
     */
    /*
     * ⚠️ IZBÂNDA CU CEDARE NU TACE (19.09.2026). Când foaia a ieșit numai fiindcă i-am scos floarea
     * ori sfinții duminicii din calendar, omul trebuie să afle — altfel se uită la pagina a patra
     * și crede că s-a stricat ceva. Fără cedare, raportul rămâne gol, ca până acum.
     */
    raportul: ({ date }) => ({
      facut: date.facut,
      text: date.facut ? vorbaIzbanzii(date) : vorbaRefuzului(date),
    }),
    // ⚠️ Un singur loc care compune, pentru amândoi chemătorii (chatul și butonul din `/nou`).
    async executa(a, c) {
      return await compuneNumarul(c.env, a, c.ctxExec)
    },
  }),

  /**
   * RETRAGEREA — ne-publicarea unui număr publicat greșit (user, 20.09.2026: „trebuie să avem și
   * buton de ne-publicare … și să poată face asta și chat-ul").
   *
   * ⚠️ ȚINTA O AFLĂ SINGURĂ, nu o cere de la model. Bula buletinului stă NUMAI pe `/nou`, iar după
   * publicare omul e pe pagina numărului — deci, când se întoarce în bulă, numărul tocmai publicat
   * NU mai e „următorul", ci CURENTUL din arhivă. Un model care ar fi ghicit nr./data ar fi cerut
   * retragerea altui număr. `nr`/`data` rămân doar ca verificare.
   * ⚠️ NICIO LOGICĂ AICI: tot ce se întâmplă stă în `retrageNumarul`, chemată la fel de butonul din
   * pagină. Două drumuri, un singur adevăr despre același număr.
   */
  actiune({
    nume: 'buletin.retrage',
    descriere:
      'RETRAGE din arhivă numărul publicat greșit — inversul validării. Rândul lui iese din arhivă ' +
      '(nu mai e pe prima pagină, nici în arhivă, nici în căutare), iar numărul se întoarce ca ' +
      'SCHIȚĂ pe ecranul „Numărul următor", cu același număr, aceeași zi și tot ce avea în el, ca ' +
      'omul să-l îndrepte și să-l publice iar. Fișierele — foaia, coperta, broșurile, pozele — NU ' +
      'se pierd. Se retrage NUMAI numărul curent și numai dacă s-a publicat de aici: numerele aduse ' +
      'din arhiva parohiei nu se ating. CHEAM-O FĂRĂ ARGUMENTE: ținta o află serverul singur.',
    efect: 'scrie',
    permisiune: 'bulletin.write',
    intrare: z.object({
      nr: z.number().int().positive().optional()
        .describe('LASĂ GOL: se retrage numărul curent. Scris, e doar o verificare — dacă nu e chiar el, cererea se refuză'),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
        .describe('LASĂ GOL: ziua numărului curent. Scrisă, e tot o verificare'),
    }),
    iesire: z.object({
      facut: z.boolean(),
      /** ce număr s-a retras — nu-l știa modelul, l-a aflat arhiva */
      nr: z.number().nullable(),
      data: z.string().nullable(),
      /** ce s-a făcut, ori de ce nu s-a putut, în vorbele omului */
      text: z.string(),
      /**
       * De unde s-a întors schița: `arhiva` = cea pusă deoparte la publicare (întreagă, cu pozele),
       * `cerere` = refăcută din cererea păstrată (FĂRĂ adresele pozelor), `implicita` = varianta de
       * probă. Spune-i omului când e `cerere`: are de dat pozele din nou.
       */
      izvor: z.enum(['arhiva', 'cerere', 'implicita']),
    }),
    exemple: [
      'retrage numărul',
      'l-am publicat greșit, dă-l înapoi la schiță',
      'anulează publicarea',
    ],
    /*
     * ⚠️ PROPUNEREA SPUNE NUMĂRUL ADEVĂRAT, luat din arhivă — el e ce citește omul înainte să apese
     * „Da". Iar când retragerea nu se poate (număr din arhiva veche, ori altul decât cel curent) se
     * ARUNCĂ aici: atunci nu se mai propune nimic, iar omul află de ce, înainte de orice ștergere.
     */
    async rezuma(a, c) {
      const cernut = await deRetras(c.env, a)
      if ('piedica' in cernut) throw new Error(`nu pot retrage: ${cernut.piedica}`)
      const b = cernut.numarul
      return `Retrag numărul ${b.nr} din ${dataLunga(b.data)} din arhivă; se întoarce ca schiță pe ` +
        '„Numărul următor", cu tot ce are. Fișierele nu se pierd.'
    },
    // Acțiunea se cheamă fără argumente, deci un rând de audit cu `{ argumente: {} }` n-ar spune ce
    // număr a ieșit din arhivă — tocmai singurul lucru care contează a doua zi.
    auditDetalii: ({ date, eroare }) =>
      date
        ? { facut: date.facut, nr: date.nr, data: date.data, izvor: date.izvor, text: taiatPentruAudit(date.text) }
        : { facut: false, eroare: taiatPentruAudit(eroare ?? 'retragerea n-a răspuns') },
    // Refuzul cuminte (număr din arhiva veche) ajunge la OM, nu doar în audit — ca la compunere.
    raportul: ({ date }) => ({ facut: date.facut, text: date.text }),
    async executa(a, c) {
      const r = await retrageNumarul(c.env, a)
      return { facut: r.facut, nr: r.nr, data: r.data, text: r.text, izvor: r.izvor }
    },
  }),

  // -------------------------------------------------------------------------
  // CHESTIONARUL — cele două verbe prin care se scrie un număr din bulă
  // -------------------------------------------------------------------------

  actiune({
    nume: 'buletin.chestionar',
    descriere:
      'Începe sau reia CHESTIONARUL numărului nou: întrebările care se pun omului, în ordine, ca ' +
      'să se strângă motto-ul, textele, autorii, anii, pomenirile, titlurile și sursele. Întoarce ' +
      'ce număr se face, ce e deja completat și ÎNTREBAREA URMĂTOARE, gata scrisă — pune-o omului ' +
      'cuvânt cu cuvânt. Nu schimbă nimic din numerele apărute.',
    efect: 'citeste',
    permisiune: 'bulletin.write',
    intrare: z.object({}),
    iesire: z.object({
      nr: z.number().nullable(),
      data: z.string(),
      /** validat sau propus (nevalidat); `null` = programul n-a răspuns */
      program: z.enum(['validat', 'propus']).nullable(),
      /** ce e deja în schiță, pe scurt — fără textele lungi */
      completat: z.array(z.string()),
      /** despre ce articol e întrebarea: principal, secundar 1, secundar 2 */
      articol: z.string(),
      /** subiectul cu care se cheamă `buletin.raspunde`; `gata` = nu mai e nimic de întrebat */
      subiect: z.string(),
      intrebare: z.string(),
      instructiune: z.string(),
      gata: z.boolean(),
    }),
    exemple: ['buletin nou', 'unde am rămas?', 'hai să facem numărul următor'],
    async executa(_a, c) {
      const [{ schita, noua }, intrebari] = await Promise.all([schitaNumarului(c.env), chestionarul(c.env)])
      /*
       * ⚠️ Pomenirea se caută AICI, înaintea întrebării, nu în mașina de stări: aceea trebuie să
       * rămână deterministă și fără rețea. Dacă autorul nu e sfânt (ori calendarul tace), se scrie
       * „căutat, nimic" și întrebarea 5 se sare, fără să afle nimeni.
       */
      const cautat = await cautaPomenirile(c.env, schita)
      const intrebare = urmatoareaIntrebare(schita, intrebari)
      /*
       * ⚠️ O acțiune de CITIRE care totuși scrie — și e în regulă: ce scrie e SCHIȚA, foaia de
       * lucru a omului din chat, nu o dată a parohiei (vezi efectul `ciorna` din `@xc/actiuni`).
       * Fără asta, „buletin nou" n-ar lăsa nicio urmă și a doua întrebare ar porni de la zero.
       */
      // ⚠️ `sistem`: „unde am ramas?" nu scrie nimic AL OMULUI — ori naste varianta zero, ori
      // adauga pomenirea gasita in calendar. Niciuna nu e „am inceput lucrul".
      if (noua || cautat) await scrieSchita(c.env, schita, { subiect: intrebare.subiect, articol: intrebare.articol }, 'sistem')
      const { stare } = await calendarulPentru(c.env, schita.data)
      return {
        nr: schita.nr,
        data: schita.data,
        program: stare,
        completat: rezumatulSchitei(schita),
        articol: intrebare.articol,
        subiect: intrebare.subiect,
        intrebare: intrebare.text,
        instructiune: intrebare.instructiune,
        gata: intrebare.subiect === 'gata',
      }
    },
  }),

  actiune({
    nume: 'buletin.raspunde',
    descriere:
      'Scrie în schița numărului nou UN LUCRU: fie răspunsul omului la întrebarea de acum, fie o ' +
      'instrucțiune punctuală către un obiect al foii („schimbă motto-ul în …", „titlul articolului ' +
      'secundar 1: …", „autorul e …", „scoate secundarul 2", „pune poza asta la principal"). ' +
      'Subiectul spune CE se scrie, `articol` spune UNDE (lipsă = articolul la care e chestionarul). ' +
      'Textul omului se trimite LITERĂ CU LITERĂ în `valoare` — nu-l rescrie și nu-l scurta. ' +
      'UN TEXT LUNG LIPIT ÎN CHAT a intrat DEJA în schiță, din cod: nu-l retrimite pe aici. ' +
      'Răspunsul îți dă ce s-a schimbat și, dacă mai e vreuna, întrebarea următoare.',
    efect: 'ciorna',
    permisiune: 'bulletin.write',
    intrare: z.object({
      subiect: z.enum(SUBIECTE).describe(
        'ce se scrie: `pastreaza` = „da, rămâne așa"; `sari` = „nu, treci mai departe"; ' +
        '`text`/`autor`/`ani`/`pomenire`/`titlu`/`sursa`/`motto`/`moto_autor` = chiar câmpul; ' +
        '`semnatura` (rândul aldin de sub titlu), `nota` și `poza` se dau oricând; ' +
        '`sterge_secundar` și `de_la_capat` sunt îndreptări',
      ),
      valoare: z.string().optional().describe(
        'ce a spus omul, cuvânt cu cuvânt. Lipsește la `pastreaza` și `sari`. La `titlu` merge și ' +
        'numărul titlului ales din listă („2"); la `poza`, adresa ei sau cheia pozei urcate',
      ),
      articol: z.enum(ARTICOLE).optional().describe(
        'la ce articol se scrie: `principal`, `s1` (secundarul 1), `s2` (secundarul 2). LASĂ GOL ' +
        'când omul răspunde la întrebarea pusă; scrie-l când omul spune anume despre care articol e vorba',
      ),
    }),
    iesire: z.object({
      /** ce s-a scris în schiță, în vorbe — de spus omului pe scurt, ca să știe că s-a prins */
      scris: z.string(),
      /** cât text are articolul atins, cât încape și cât a mai rămas (negativ = peste măsură) */
      masura: z.object({ semne: z.number(), incap: z.number(), ramase: z.number() }).nullable(),
      articol: z.string(),
      subiect: z.string(),
      /** întrebarea rămasă; `null` = nu mai e nimic de întrebat (ori a fost o instrucțiune punctuală) */
      intrebare: z.string().nullable(),
      instructiune: z.string(),
      gata: z.boolean(),
    }),
    exemple: [
      { fraza: 'rămâne așa', argumente: { subiect: 'pastreaza' } },
      { fraza: 'da, îl folosim', argumente: { subiect: 'pastreaza' } },
      { fraza: 'nu', argumente: { subiect: 'sari' } },
      { fraza: '2', argumente: { subiect: 'titlu', valoare: '2' } },
      { fraza: 'autorul e Sfântul Ioan Gură de Aur', argumente: { subiect: 'autor', valoare: 'SFÂNTUL IOAN GURĂ DE AUR' } },
      { fraza: 'a trăit între 347 și 407', argumente: { subiect: 'ani', valoare: '347-407' } },
      { fraza: 'mai adăugăm un text', argumente: { subiect: 'mai_adaugam', valoare: 'da' } },
      /*
       * ⚠️ DE AICI ÎN JOS: INSTRUCȚIUNI PUNCTUALE, cu argumentele gata scrise (user, 18.09.2026,
       * 22:20). Pentru un model mic ele sunt antrenamentul care hotărăște: fără ele cere lămuriri
       * („la ce articol?") în loc să cheme unealta, deși omul a spus limpede și ce, și unde.
       */
      { fraza: 'schimbă motto-ul în „Rugăciunea este respirația sufletului"', argumente: { subiect: 'motto', valoare: 'Rugăciunea este respirația sufletului' } },
      { fraza: 'motto-ul e al Părintelui Arsenie Papacioc', argumente: { subiect: 'moto_autor', valoare: 'Părintele Arsenie Papacioc' } },
      { fraza: 'titlul articolului secundar 1: DESPRE POST', argumente: { subiect: 'titlu', valoare: 'DESPRE POST', articol: 's1' } },
      { fraza: 'autorul secundarului 2 e Sfântul Vasile cel Mare', argumente: { subiect: 'autor', valoare: 'SFÂNTUL VASILE CEL MARE', articol: 's2' } },
      { fraza: 'la principal, anii sunt 330-379', argumente: { subiect: 'ani', valoare: '330-379', articol: 'principal' } },
      { fraza: 'pomenirea e pe 1 ianuarie', argumente: { subiect: 'pomenire', valoare: '1 ianuarie' } },
      { fraza: 'sursa articolului secundar 1 e ziarullumina.ro', argumente: { subiect: 'sursa', valoare: 'ziarullumina.ro', articol: 's1' } },
      { fraza: 'scoate secundarul 2', argumente: { subiect: 'sterge_secundar' } },
      { fraza: 'pune poza asta la principal', argumente: { subiect: 'poza', valoare: 'poze/616-2026-09-20/mfk3z2-a91b04.jpg', articol: 'principal' } },
      { fraza: 'ia-o de la capăt', argumente: { subiect: 'de_la_capat' } },
    ],
    async executa(a, c) {
      const [{ schita }, intrebari] = await Promise.all([schitaNumarului(c.env), chestionarul(c.env)])
      /*
       * ⚠️ ÎNTREBAREA DE ACUM SE SOCOTEȘTE ÎNAINTE DE SCRIERE: din ea se vede dacă omul a RĂSPUNS la
       * ea, ori a dat o instrucțiune punctuală. Socotită după, ar fi mereu următoarea, și n-am mai
       * ști de unde am plecat.
       */
      const deAcum = urmatoareaIntrebare(schita, intrebari)
      const eRaspunsLaIntrebare =
        deAcum.subiect !== 'gata' &&
        a.articol === undefined &&
        (a.subiect === 'pastreaza' || a.subiect === 'sari' || a.subiect === deAcum.subiect)

      // O poză dată prin CHEIE (așa o întoarce urcarea din bulă) devine adresa ei publică: foaia se
      // randează într-un browser din afară, care n-are cum să ceară nimic din depozitul nostru.
      const cerut =
        a.subiect === 'poza' && a.valoare ? { ...a, valoare: adresaPozei(c.env, a.valoare) } : a

      const scris = scrieRaspuns(schita, cerut, intrebari)
      // autorul tocmai scris poate fi sfânt: se întreabă calendarul ÎNAINTE de întrebarea următoare
      await cautaPomenirile(c.env, scris.schita)
      const intrebare = urmatoareaIntrebare(scris.schita, intrebari)
      await scrieSchita(c.env, scris.schita, { subiect: intrebare.subiect, articol: intrebare.articol })

      /*
       * ⚠️ MĂSURA SE SPUNE, DAR NU OPREȘTE NIMIC (18.09.2026). Un text prea lung nu se refuză la
       * schiță: omul tocmai l-a lipit, iar refuzul l-ar pune să-l lipească din nou. Refuzul cu
       * cifre rămâne unde era și până acum — la compunere, unde chiar se face hârtia.
       */
      const { masura: calendar } = await calendarulPentru(c.env, scris.schita.data)
      const masura = masuraArticolului(scris.schita, scris.articol, calendar)
      const maiE = intrebare.subiect !== 'gata'

      return {
        scris: scris.scris,
        masura,
        articol: intrebare.articol,
        subiect: intrebare.subiect,
        intrebare: maiE ? intrebare.text : null,
        /*
         * ⚠️ O INSTRUCȚIUNE PUNCTUALĂ NU REIA CHESTIONARUL DE LA CAPĂT (user, 18.09.2026, 22:20).
         * Până aici, orice chemare întorcea întrebarea următoare cu „pune-o omului EXACT așa" — deci
         * după „schimbă motto-ul în X", spus la două zile după ce numărul era gata, modelul relua
         * cuminte „Care este textul articolului principal?". Acum: la un răspuns din chestionar,
         * purtarea de dinainte; la o instrucțiune, se spune ce s-a schimbat, iar întrebarea rămasă e
         * o ofertă, nu o poruncă.
         */
        instructiune: eRaspunsLaIntrebare
          ? intrebare.instructiune
          : 'Spune-i omului ce ai schimbat într-o frază; dacă `intrebare` nu e null, pune-o.',
        gata: !maiE,
      }
    },
  }),
])
