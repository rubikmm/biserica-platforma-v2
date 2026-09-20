/**
 * Depozitul buletinului: cifrele arhivei si textul dupa care se cauta (D1 `xc-buletin-staging`).
 * Fisierele — PDF-ul si cele doua poze ale paginii intai — stau in R2 (`xc-buletin-staging`); aici
 * stau doar CHEILE lor.
 *
 * Codul e cel din V1 (`biserica-buletin/src/date.ts`, v0.5.0), mutat cuvant cu cuvant, fara partea
 * de abonati: in V2 lista de abonati nu e a aplicatiei, ci o AUDIENTA a comunicarii (structura mare,
 * 10.09.2026). Randurile s-au copiat in baza NOUA, nu s-a refolosit nimic din V1.
 *
 * Ce se intoarce spre pagini e mereu MIC: listele n-au niciodata coloana `text` in ele (4,6 MB cu
 * totul), ci doar cheile pozelor si, la cautare, fragmentul taiat in SQL.
 */

/** Randul din liste — fara text, ca sa incapa 619 de bucati fara sa se umfle raspunsul. */
export interface BuletinScurt {
  nr: number
  data: string
  an: string
  luna: string
  cheie_pdf: string | null
  cheie_poza_mica: string | null
  pagini: number | null
  /**
   * CE E RÂNDUL, SCRIS PE EL: `publicat` (îl vede toată lumea) ori `programat` (e în bază, dar
   * pentru parohie numărul încă n-a apărut). Îl trece de la unul la altul CEASUL workerului
   * (handlerul `scheduled` din `index.ts`), nu o socoteală făcută la fiecare citire.
   * ⚠️ Opțional în tip, nu în bază: coloana e NOT NULL cu `DEFAULT 'publicat'`, dar ciornele
   * întoarse în forma unui rând (`ciornaDinDepozit`) și fișele de probă n-au ce scrie în ea. Lipsa
   * se citește peste tot ca `publicat`.
   */
  stare?: StareaNumarului
  /**
   * CLIPA DE LA CARE E PUBLIC (ISO UTC) — duminica lui, ora 12:00 a Bucureștiului (vezi `ceas.ts`).
   * `null` = public dintotdeauna: așa stau cele 619 numere aduse din V1 și tot ce s-a publicat
   * înainte de 20.09.2026, când numerele se publicau pe loc.
   * ⚠️ Rămâne clipa ANUNȚATĂ și după ce ceasul trece numărul pe `publicat`: acolo scrie când s-a
   * spus parohiei că apare, nu când s-a nimerit să bată cronul.
   */
  publicat_la?: string | null
}

/** Cele două stări ale unui rând. Nu sunt mai multe, și nu se inventează una a treia. */
export type StareaNumarului = 'programat' | 'publicat'

/** Un rând e programat dacă scrie pe el. Lipsa coloanei (ciornă, fișă de probă) = publicat. */
export const eProgramat = (b: { stare?: StareaNumarului | null } | null | undefined): boolean =>
  b?.stare === 'programat'

/** Un numar intreg, pentru pagina lui. */
export interface Buletin extends BuletinScurt {
  cheie_poza: string | null
  marime_pdf: number
  sursa: string
}

/** Un rezultat de cautare: randul scurt plus bucata de text in care s-a nimerit cuvantul. */
export interface Gasit extends BuletinScurt {
  fragment: string
}

const CAMPURI_SCURT = 'nr, data, an, luna, cheie_pdf, cheie_poza_mica, pagini, stare, publicat_la'
const CAMPURI = `${CAMPURI_SCURT}, cheie_poza, marime_pdf, sursa`

// ---------------------------------------------------------------------------
// VIZIBILITATEA: cine vede un număr PROGRAMAT
// ---------------------------------------------------------------------------

/**
 * CU CE OCHI SE CITEȘTE ARHIVA (20.09.2026, odată cu programarea).
 *
 * Un număr validat înainte de duminica lui are `publicat_la` în viitor: rândul E în bază, dar pentru
 * lumea de afară el nu există NICĂIERI — nici ca număr curent, nici în arhivă, nici în căutare, nici
 * în `/v1`, iar pagina lui dă 404. Pentru adminul buletinului, dimpotrivă, el se vede ca număr
 * curent, cu eticheta „Programat" pe el: altfel n-ar avea de unde să-l retragă ori să-l privească.
 *
 * ⚠️ O SINGURĂ CLAUZĂ, într-un singur loc (`cerne`), pusă la TOATE citirile de mai jos. Împrăștiată
 * pe la apelanți, ar fi fost de ajuns o citire uitată ca numărul să iasă public cu o săptămână mai
 * devreme — și nimic nu s-ar fi văzut până atunci.
 */
export interface Vedere {
  /** `true` = adminul buletinului (după `ctx.eAdmin` EFECTIV, deci și sub masca „vezi ca"). */
  vedeTot: boolean
}

/** Ochii adminului: nimic nu se cerne. Îl folosesc `/nou`, acțiunile chatului și retragerea. */
export const VEDE_TOT: Vedere = { vedeTot: true }

/** Ochii lumii: numerele programate nu există. */
export const LUMEA: Vedere = { vedeTot: false }

/** Vederea unui om, după cum e ori nu adminul buletinului. */
export const vedereaLui = (eAdmin: boolean): Vedere => (eAdmin ? VEDE_TOT : LUMEA)

/**
 * Clauza care ascunde numerele programate — singurul loc în care se scrie.
 *
 * ⚠️ NICIO COMPARAȚIE DE CEAS AICI, de la 20.09.2026, ora 14:11 („să fie o programare reală — adică
 * din uneltele de cron din Cloudflare"). Interogarea întreabă ce SCRIE pe rând, nu ce s-ar deduce
 * dintr-o dată pusă lângă ceasul de acum. Cine schimbă starea e ceasul workerului (`scheduled`).
 * ⚠️ Și de aceea clauza n-are nicio legătură (`?N`): e o constantă. Toată socoteala de indici de
 * placeholder din varianta dintâi — locul cel mai lesne de încurcat în tăcere — a ieșit cu totul.
 */
const CERNERE = "stare = 'publicat'"
const cerne = (v: Vedere): string => (v.vedeTot ? '' : CERNERE)

/** `WHERE …` gata scris (ori nimic), ca interogările să rămână citibile. */
const unde = (...bucati: string[]): string => {
  const ale = bucati.filter(Boolean)
  return ale.length ? `WHERE ${ale.join(' AND ')} ` : ''
}


/**
 * ⚠️ Textul adus la forma dupa care se cauta: fara diacritice, cu litere mici — dar LITERA CU LITERA,
 * ca lungimea sa ramana aceeasi. Asa pozitia gasita in `text_plat` e buna si in `text`, deci
 * fragmentul din rezultate se poate taia direct din textul adevarat, cu diacriticele lui.
 *
 * De aceea NU se foloseste `faraDiacritice` din `@xc/ui`: aceea curata sirul si poate sa-i schimbe
 * lungimea. Coloana `text_plat` a fost scrisa in V1 cu functia asta, iar randurile s-au copiat ca
 * atare — daca se schimba potrivirea, fragmentele arata alt loc decat cel gasit.
 */
const DIACRITICE: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', ț: 't', ş: 's', ţ: 't',
  Ă: 'a', Â: 'a', Î: 'i', Ș: 's', Ț: 't', Ş: 's', Ţ: 't',
  '„': '"', '”': '"', '“': '"', '–': '-', '—': '-', '’': "'", '‘': "'",
}
export function plat(s: string): string {
  let r = ''
  for (const c of s) {
    const d = DIACRITICE[c]
    if (d) {
      r += d
      continue
    }
    const m = c.toLowerCase()
    r += m.length === c.length ? m : c
  }
  return r.length === s.length ? r : s.toLowerCase()
}

/**
 * Numarul cel mai nou. `null` cand baza e goala (migratia nerulata) — atunci pagina spune asta.
 * ⚠️ Cu `VEDE_TOT` intră în socoteală și numărul PROGRAMAT — și așa trebuie pe `/nou`: numărul
 * următor se numără din TOATE rândurile, altfel după programarea lui 617 ecranul ar cere iar 617.
 */
export async function ultimul(db: D1Database, v: Vedere): Promise<Buletin | null> {
  return await db
    .prepare(`SELECT ${CAMPURI} FROM buletine ${unde(cerne(v))}ORDER BY data DESC, nr DESC LIMIT 1`)
    .first<Buletin>()
}

/** Ultimele `n` numere, cel mai nou primul — fasia „numerele dinainte" de pe prima pagina. */
export async function ultimele(db: D1Database, n: number, v: Vedere): Promise<BuletinScurt[]> {
  const r = await db
    .prepare(`SELECT ${CAMPURI_SCURT} FROM buletine ${unde(cerne(v))}ORDER BY data DESC, nr DESC LIMIT ?1`)
    .bind(n)
    .all<BuletinScurt>()
  return r.results
}

export async function unul(db: D1Database, nr: number, data: string, v: Vedere): Promise<Buletin | null> {
  return await db
    .prepare(`SELECT ${CAMPURI} FROM buletine ${unde('nr = ?1 AND data = ?2', cerne(v))}`)
    .bind(nr, data)
    .first<Buletin>()
}

/** Cel mai nou numar cu cifra asta pe hartie — pentru adresa la indemana `/buletin/615`. */
export async function celMaiNouCuNumarul(
  db: D1Database,
  nr: number,
  v: Vedere,
): Promise<{ nr: number; data: string } | null> {
  return await db
    .prepare(`SELECT nr, data FROM buletine ${unde('nr = ?1', cerne(v))}ORDER BY data DESC LIMIT 1`)
    .bind(nr)
    .first<{ nr: number; data: string }>()
}

/**
 * Vecinii unui numar in sirul arhivei. Sirul e dupa DATA, nu dupa numar: numerotarea parohiei a mai
 * sarit peste ani (doua hartii in aceeasi zi, acelasi numar cu doua date), pe cand zilele merg mereu
 * inainte. `nr` desparte numerele din aceeasi zi, ca sagetile sa nu se invarta pe loc.
 */
export async function vecini(
  db: D1Database,
  nr: number,
  data: string,
  v: Vedere,
): Promise<{ inainte: BuletinScurt | null; dupa: BuletinScurt | null }> {
  const c = cerne(v)
  // ⚠️ SIRUL VECINILOR E O SINGURA CONDITIE, in paranteze: fara ele, `AND` al cernerii s-ar fi lipit
  // numai de a doua ramura a lui `OR`, iar numarul programat ar fi iesit vecinul oricui.
  const [i, d] = await Promise.all([
    db
      .prepare(
        `SELECT ${CAMPURI_SCURT} FROM buletine ${unde('(data < ?2 OR (data = ?2 AND nr < ?1))', c)}
                ORDER BY data DESC, nr DESC LIMIT 1`,
      )
      .bind(nr, data)
      .first<BuletinScurt>(),
    db
      .prepare(
        `SELECT ${CAMPURI_SCURT} FROM buletine ${unde('(data > ?2 OR (data = ?2 AND nr > ?1))', c)}
                ORDER BY data ASC, nr ASC LIMIT 1`,
      )
      .bind(nr, data)
      .first<BuletinScurt>(),
  ])
  return { inainte: i, dupa: d }
}

/** Anii din arhiva, cu cate numere are fiecare — bara de sus a Arhivei. */
export async function anii(db: D1Database, v: Vedere): Promise<{ an: string; cate: number }[]> {
  const r = await db
    .prepare(`SELECT an, COUNT(*) AS cate FROM buletine ${unde(cerne(v))}GROUP BY an ORDER BY an DESC`)
    .all<{ an: string; cate: number }>()
  return r.results
}

/** Numerele unui an, cel mai nou primul. Un an are ~50 de randuri — incape lejer intr-o pagina. */
export async function dintrUnAn(db: D1Database, an: string, v: Vedere): Promise<BuletinScurt[]> {
  const r = await db
    .prepare(`SELECT ${CAMPURI_SCURT} FROM buletine ${unde('an = ?1', cerne(v))}ORDER BY data DESC, nr DESC`)
    .bind(an)
    .all<BuletinScurt>()
  return r.results
}

/**
 * Cautarea din meniu. Se cauta in textul scos din PDF-uri (primele patru pagini), pe coloana fara
 * diacritice: cine scrie „craciun" gaseste si „Crăciun". Un sir numeric cauta SI numarul de pe hartie
 * („615" da numarul 615, nu doar paginile in care apare cifra).
 *
 * Fragmentul se taie in SQL, nu in Worker: altfel ar trebui adus tot textul (pana la 24.000 de semne
 * pe rand) doar ca sa se arate 240 de semne din el.
 */
export async function cauta(db: D1Database, q: string, v: Vedere, limita = 60): Promise<Gasit[]> {
  const cautat = plat(q.trim())
  if (cautat.length < 2) return []
  const tipar = `%${cautat.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const numar = /^\d{1,4}$/.test(cautat) ? Number(cautat) : -1
  const r = await db
    .prepare(
      `SELECT ${CAMPURI_SCURT},
            substr(text, max(1, instr(text_plat, ?1) - 80), 240) AS fragment
     FROM buletine
     ${unde("(text_plat LIKE ?2 ESCAPE '\\' OR nr = ?3)", cerne(v))}
     ORDER BY data DESC, nr DESC
     LIMIT ?4`,
    )
    .bind(cautat, tipar, numar, limita)
    .all<Gasit>()
  return r.results
}

/**
 * MOTTO-UL UNUI NUMAR DIN ARHIVA, citit din textul scos din PDF (user, 17.09.2026: „Motto — trebuie
 * sa fie precompletat motto-ul trecut, de la numarul trecut").
 *
 * Numerele vechi sunt fisiere, nu campuri: motto-ul nu e nicaieri ca atare, dar textul paginii intai
 * il poarta intre parohie si pastila numarului, in ghilimele romanesti, cu cel citat dupa linie:
 *   `… HANUL COLȚEI „Maica Domnului ne iubeşte mult. …” – Părintele Arsenie Papacioc Nr. 615 / …`
 * ⚠️ Textul din Word are diacriticele VECHI, cu sedila (ş, ţ) — se aduc la virgula (ș, ț), ca in
 * restul platformei; altfel motto-ul precompletat ar duce sedilele mai departe, in numarul nou.
 * Cand forma nu se potriveste (un numar fara motto, un PDF scanat), se intoarce `null` — nu se
 * ghiceste.
 */
export function mottoDinText(text: string | null | undefined): { motto: string; motoAutor?: string } | null {
  if (!text) return null
  const cap = text.slice(0, 1500).replace(/\s+/g, ' ')
  const m = /(„[^„”]{10,600}”)\s*(?:[–—-]\s*([^„”]{2,120}?))?\s*Nr\.\s*\d/u.exec(cap)
  if (!m) return null
  const virgula = (s: string): string => s.replace(/ş/g, 'ș').replace(/ţ/g, 'ț').replace(/Ş/g, 'Ș').replace(/Ţ/g, 'Ț')
  return { motto: virgula(m[1]!.trim()), motoAutor: m[2] ? virgula(m[2].trim()) : undefined }
}

/**
 * Textul paginii intai a unui numar — DOAR capul lui, pentru motto; nu se aduce tot textul.
 *
 * ⚠️ SINGURA CITIRE FĂRĂ CERNERE, și dinadins: nu se cheamă niciodată de pe o pagină publică, ci
 * numai din `mottoDinainte` — adică de pe `/nou` și din chestionarul bulei, amândouă ale adminului,
 * și amândouă pe numărul pe care ADMINUL îl vede oricum ca fiind cel curent. Cu cernerea pusă,
 * motto-ul precompletat ar fi sărit peste numărul tocmai programat și l-ar fi luat din cel de
 * dinaintea lui. Nu întoarce nimic ce s-ar putea citi ca „numărul există": un șir de text, cerut
 * după nr. și dată știute.
 */
export async function capulTextului(db: D1Database, nr: number, data: string): Promise<string | null> {
  const r = await db
    .prepare('SELECT substr(text, 1, 1500) AS cap FROM buletine WHERE nr = ?1 AND data = ?2')
    .bind(nr, data)
    .first<{ cap: string | null }>()
  return r?.cap ?? null
}

/**
 * NUMĂRUL INTRĂ ÎN ARHIVĂ — rândul scris la validarea unui număr compus aici (user, 18.09.2026:
 * „un buton de validare"). Până la el, numărul compus era doar un PDF în depozit, pe care nu-l vedea
 * nimeni din afara ecranului de compunere.
 *
 * ⚠️ `INSERT OR REPLACE`, nu `INSERT`: cheia e (nr, data), iar drumul obișnuit al omului e să
 * recompună același număr de câteva ori până iese cum vrea. A doua validare a aceleiași zile
 * ÎNLOCUIEȘTE rândul, nu se plânge — fișierele din depozit au oricum aceleași nume și s-au rescris
 * și ele.
 * ⚠️ `sursa: 'site'` — așa se deosebește, în arhivă, numărul făcut pe platformă de cele 619 aduse
 * din V1 (`arhiva`).
 * ⚠️ `stare` + `publicat_la` — CE E RÂNDUL și DE CÂND (20.09.2026). Validat duminică după 12:00:
 * `publicat`, cu clipa apăsării (publicare pe loc, ca până acum). Validat mai devreme: `programat`,
 * cu duminica lui la 12:00 — rândul e în bază, dar nu-l vede nimeni în afară de admin până ce
 * CEASUL îl trece. Socoteala nu se face aici: vine gata făcută de la `valideazaNumarul`.
 */
export async function scrieBuletin(
  db: D1Database,
  b: {
    nr: number
    data: string
    cheie_pdf: string
    cheie_poza: string | null
    cheie_poza_mica: string | null
    marime_pdf: number
    pagini: number
    text: string
    stare: StareaNumarului
    /** ISO UTC; `null` doar la rândurile vechi, care n-au avut niciodată prag */
    publicat_la: string | null
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO buletine
         (nr, data, an, luna, cheie_pdf, cheie_poza, cheie_poza_mica, marime_pdf, pagini, sursa, text, text_plat, stare, publicat_la)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'site', ?10, ?11, ?12, ?13)`,
    )
    .bind(
      b.nr,
      b.data,
      b.data.slice(0, 4),
      b.data.slice(5, 7),
      b.cheie_pdf,
      b.cheie_poza,
      b.cheie_poza_mica,
      b.marime_pdf,
      b.pagini,
      b.text,
      plat(b.text),
      b.stare,
      b.publicat_la,
    )
    .run()
}

// ---------------------------------------------------------------------------
// CEASUL: cine trece numerele programate pe „publicat"
// ---------------------------------------------------------------------------

/**
 * CE ARE DE TRECUT CEASUL ACUM — rândurile programate cărora le-a venit clipa.
 *
 * Se cere ÎNAINTE de trecere, ca handlerul `scheduled` să poată spune în jurnal și în audit CARE
 * numere au apărut. `UPDATE … RETURNING` ar fi făcut-o dintr-un drum, dar atunci o rulare fără
 * nimic de făcut (marea majoritate: ceasul bate la 5 minute) ar fi tot o SCRIERE în D1.
 */
export async function programateleScadente(db: D1Database, acum: Date): Promise<BuletinScurt[]> {
  const r = await db
    .prepare(
      `SELECT ${CAMPURI_SCURT} FROM buletine
       WHERE stare = 'programat' AND publicat_la IS NOT NULL AND publicat_la <= ?1
       ORDER BY data ASC, nr ASC`,
    )
    .bind(acum.toISOString())
    .all<BuletinScurt>()
  return r.results
}

/**
 * TRECEREA — singurul loc din cod care scoate un număr din `programat`.
 *
 * ⚠️ IDEMPOTENTĂ prin chiar forma ei: condiția cere `stare = 'programat'`, deci a doua rulare (și a
 * suta, ceasul bate din cinci în cinci minute) nu mai găsește nimic și nu schimbă nimic. De aceea
 * nu-i trebuie nici zăvor, nici tabel de rulări.
 * ⚠️ `publicat_la` NU SE REscrie: acolo stă clipa anunțată parohiei (duminică, 12:00), nu clipa în
 * care s-a nimerit să bată cronul. Altfel „apare la 12:00" ar fi devenit, în bază, 12:03.
 *
 * Întoarce câte rânduri s-au schimbat cu adevărat.
 */
export async function treciLaPublicat(db: D1Database, acum: Date): Promise<number> {
  const r = await db
    .prepare(
      `UPDATE buletine SET stare = 'publicat'
       WHERE stare = 'programat' AND publicat_la IS NOT NULL AND publicat_la <= ?1`,
    )
    .bind(acum.toISOString())
    .run()
  return r.meta?.changes ?? 0
}

/**
 * STAREA UNUI RÂND, fără să se aducă tot numărul — o căutare pe cheia primară (nr, data).
 *
 * O cere poarta fișierelor (`/fisier/`, `/tipar/`): acolo trebuie știut dacă rândul e încă
 * `programat`, ca foaia să nu se dea pe o ușă pe care pagina o ține închisă. `null` = nu e niciun
 * rând, adică numărul e doar o CIORNĂ.
 */
export async function stareaNumarului(
  db: D1Database,
  nr: number,
  data: string,
): Promise<StareaNumarului | null> {
  const r = await db
    .prepare('SELECT stare FROM buletine WHERE nr = ?1 AND data = ?2')
    .bind(nr, data)
    .first<{ stare: StareaNumarului }>()
  return r?.stare ?? null
}

/**
 * NUMĂRUL IESE DIN ARHIVĂ — retragerea unui număr publicat greșit (user, 20.09.2026: „trebuie să
 * avem și buton de ne-publicare — dacă s-a publicat greșit"). E inversul EXACT al lui
 * `scrieBuletin`: rândul dispare din arhivă, iar numărul se întoarce ca schiță pe `/nou`, cu
 * același număr și aceeași zi, ca omul să-l îndrepte și să-l publice iar.
 *
 * ⚠️ `AND sursa = 'site'` e o ÎNCUIETOARE, nu o îngustare: cele 619 numere aduse din V1 (`arhiva`)
 * nu se retrag de nicăieri — nu îndreptăm noi arhiva parohiei. Ruta și acțiunea cern asta mai
 * devreme, cu vorbe omenești; rândul de aici e plasa de dedesubt, ca o chemare greșită să nu poată
 * șterge o hârtie apărută acum zece ani.
 * ⚠️ FIȘIERELE RĂMÂN — foaia, coperta, broșurile, cererea păstrată de sub `compus/` și pozele. Ele
 * sunt de acum ale CIORNEI, iar `ciornaDinDepozit` le servește mai departe pe `/nou`: ștergerea lor
 * ar face din retragere o pierdere, nu o îndreptare.
 */
export async function stergeBuletin(db: D1Database, nr: number, data: string): Promise<void> {
  await db.prepare("DELETE FROM buletine WHERE nr = ?1 AND data = ?2 AND sursa = 'site'").bind(nr, data).run()
}

/**
 * Cifrele arhivei: câte numere, câți ani, care e ziua ultimului.
 * ⚠️ Se cerne și ea: `MAX(data)` al unui rând programat ar fi spus, pe `/health` și în capul
 * Arhivei, chiar ziua numărului pe care nimeni n-are voie să-l vadă încă.
 */
export async function numaratoare(
  db: D1Database,
  v: Vedere,
): Promise<{ buletine: number; ani: number; ultimul: string | null }> {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS buletine, COUNT(DISTINCT an) AS ani, MAX(data) AS ultimul FROM buletine ${unde(cerne(v))}`,
    )
    .first<{ buletine: number; ani: number; ultimul: string | null }>()
  return r ?? { buletine: 0, ani: 0, ultimul: null }
}
