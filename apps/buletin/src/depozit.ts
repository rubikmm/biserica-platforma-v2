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
}

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

const CAMPURI_SCURT = 'nr, data, an, luna, cheie_pdf, cheie_poza_mica, pagini'
const CAMPURI = `${CAMPURI_SCURT}, cheie_poza, marime_pdf, sursa`

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

/** Numarul cel mai nou. `null` cand baza e goala (migratia nerulata) — atunci pagina spune asta. */
export async function ultimul(db: D1Database): Promise<Buletin | null> {
  return await db.prepare(`SELECT ${CAMPURI} FROM buletine ORDER BY data DESC, nr DESC LIMIT 1`).first<Buletin>()
}

/** Ultimele `n` numere, cel mai nou primul — fasia „numerele dinainte" de pe prima pagina. */
export async function ultimele(db: D1Database, n: number): Promise<BuletinScurt[]> {
  const r = await db
    .prepare(`SELECT ${CAMPURI_SCURT} FROM buletine ORDER BY data DESC, nr DESC LIMIT ?1`)
    .bind(n)
    .all<BuletinScurt>()
  return r.results
}

export async function unul(db: D1Database, nr: number, data: string): Promise<Buletin | null> {
  return await db.prepare(`SELECT ${CAMPURI} FROM buletine WHERE nr = ?1 AND data = ?2`).bind(nr, data).first<Buletin>()
}

/** Cel mai nou numar cu cifra asta pe hartie — pentru adresa la indemana `/buletin/615`. */
export async function celMaiNouCuNumarul(db: D1Database, nr: number): Promise<{ nr: number; data: string } | null> {
  return await db
    .prepare('SELECT nr, data FROM buletine WHERE nr = ?1 ORDER BY data DESC LIMIT 1')
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
): Promise<{ inainte: BuletinScurt | null; dupa: BuletinScurt | null }> {
  const [i, d] = await Promise.all([
    db
      .prepare(
        `SELECT ${CAMPURI_SCURT} FROM buletine WHERE data < ?2 OR (data = ?2 AND nr < ?1)
                ORDER BY data DESC, nr DESC LIMIT 1`,
      )
      .bind(nr, data)
      .first<BuletinScurt>(),
    db
      .prepare(
        `SELECT ${CAMPURI_SCURT} FROM buletine WHERE data > ?2 OR (data = ?2 AND nr > ?1)
                ORDER BY data ASC, nr ASC LIMIT 1`,
      )
      .bind(nr, data)
      .first<BuletinScurt>(),
  ])
  return { inainte: i, dupa: d }
}

/** Anii din arhiva, cu cate numere are fiecare — bara de sus a Arhivei. */
export async function anii(db: D1Database): Promise<{ an: string; cate: number }[]> {
  const r = await db
    .prepare('SELECT an, COUNT(*) AS cate FROM buletine GROUP BY an ORDER BY an DESC')
    .all<{ an: string; cate: number }>()
  return r.results
}

/** Numerele unui an, cel mai nou primul. Un an are ~50 de randuri — incape lejer intr-o pagina. */
export async function dintrUnAn(db: D1Database, an: string): Promise<BuletinScurt[]> {
  const r = await db
    .prepare(`SELECT ${CAMPURI_SCURT} FROM buletine WHERE an = ?1 ORDER BY data DESC, nr DESC`)
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
export async function cauta(db: D1Database, q: string, limita = 60): Promise<Gasit[]> {
  const cautat = plat(q.trim())
  if (cautat.length < 2) return []
  const tipar = `%${cautat.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const numar = /^\d{1,4}$/.test(cautat) ? Number(cautat) : -1
  const r = await db
    .prepare(
      `SELECT ${CAMPURI_SCURT},
            substr(text, max(1, instr(text_plat, ?1) - 80), 240) AS fragment
     FROM buletine
     WHERE text_plat LIKE ?2 ESCAPE '\\' OR nr = ?3
     ORDER BY data DESC, nr DESC
     LIMIT ?4`,
    )
    .bind(cautat, tipar, numar, limita)
    .all<Gasit>()
  return r.results
}

export async function numaratoare(db: D1Database): Promise<{ buletine: number; ani: number; ultimul: string | null }> {
  const r = await db
    .prepare('SELECT COUNT(*) AS buletine, COUNT(DISTINCT an) AS ani, MAX(data) AS ultimul FROM buletine')
    .first<{ buletine: number; ani: number; ultimul: string | null }>()
  return r ?? { buletine: 0, ani: 0, ultimul: null }
}
