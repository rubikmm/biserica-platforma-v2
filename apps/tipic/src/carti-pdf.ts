/**
 * CĂRȚILE ÎNTREGI, în PDF — cele scanate, din care vine rânduiala.
 *
 * Stau în depozitul propriu `xc-tipic-staging` (R2), copiate din bucketul V1 `biserica-tipic` pe
 * 13.09.2026: Rânduiala ROEA (0,4 MB), Anuarul (41 MB) și Mineiul pe noiembrie (67 MB). Bucketul e
 * NOU — din V1 nu se leagă nimic.
 *
 * Adresele publice sunt cele din V1, neatinse (`/anuar-2026.pdf`, `/roea-2026.pdf`,
 * `/minei-noiembrie.pdf`): cine are un link vechi cade tot pe carte.
 *
 * ⚠️ Cheia hărții e CODUL CĂRȚII din depozit (`roea`, `anuar`, `minei-11`) — așa cardul se scrie
 * numai acolo unde cartea chiar există. Lunile Mineiului culese de pe sit n-au PDF și n-au nici card.
 */
export interface CartePdf {
  /** adresa publică, cea din V1 */
  adresa: string
  /**
   * Numele scurt scris PE CARD, când cel din depozit e prea lung. ROEA e scrisă în bara părții cu
   * numele întreg al editurii („Episcopia Ortodoxă Română din America"), care pe card se rupe în
   * două rânduri; V1 scria acolo „Rânduiala Tipicului · ROEA 2026". Lipsește = se scrie numele cărții.
   */
  nume?: string
  /** cheia din R2 */
  cheie: string
  /** numele fișierului la descărcare */
  fisier: string
}

export const CARTI_PDF: Record<string, CartePdf> = {
  roea: {
    adresa: '/roea-2026.pdf',
    cheie: 'surse/roea-tipic-2026-rom.pdf',
    fisier: 'randuiala-tipicului-roea-2026.pdf',
    nume: 'Rânduiala Tipicului · ROEA 2026',
  },
  anuar: {
    adresa: '/anuar-2026.pdf',
    cheie: 'surse/anuar-2026.pdf',
    fisier: 'anuar-liturgic-si-tipiconal-2026.pdf',
  },
  // Mineiele intră pe rând, o lună o dată; deocamdată e scanat noiembrie.
  'minei-11': {
    adresa: '/minei-noiembrie.pdf',
    cheie: 'surse/minei-noiembrie-2005.pdf',
    fisier: 'mineiul-pe-noiembrie-2005.pdf',
  },
}

/** Adresa publică -> cartea ei, pentru rutare. */
const DUPA_ADRESA: Record<string, CartePdf> = Object.fromEntries(
  Object.values(CARTI_PDF).map((c) => [c.adresa, c]),
)

export const eAdresaDeCarte = (cale: string): boolean => cale in DUPA_ADRESA

/**
 * Cartea întreagă, din R2. Anuarul are 41 MB și Mineiul 67, așa că răspundem și la cereri pe bucăți
 * (`Range`): fără ele, cititorul de PDF ar trage tot fișierul ca să deschidă o singură pagină, iar
 * legăturile noastre trimit chiar la pagina zilei (`#page=N`).
 */
export async function pdfDinR2(req: Request, depozit: R2Bucket, cale: string): Promise<Response> {
  const carte = DUPA_ADRESA[cale]
  if (!carte) return new Response('Nu există.', { status: 404 })
  const cerut = req.headers.get('range')
  const m = /^bytes=(\d+)-(\d*)$/.exec(cerut ?? '')
  const de = m ? Number(m[1]) : 0
  const o = await depozit.get(
    carte.cheie,
    m ? { range: { offset: de, length: m[2] ? Number(m[2]) - de + 1 : undefined } } : undefined,
  )
  if (!o || !('body' in o) || !o.body) return new Response('Cartea nu e încărcată.', { status: 404 })

  const antet = new Headers({
    'content-type': 'application/pdf',
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=86400',
    'content-disposition': `inline; filename="${carte.fisier}"`,
  })
  if (!m) return new Response(o.body, { headers: antet })
  const pana = m[2] ? Math.min(Number(m[2]), o.size - 1) : o.size - 1
  antet.set('content-range', `bytes ${de}-${pana}/${o.size}`)
  return new Response(o.body, { status: 206, headers: antet })
}
