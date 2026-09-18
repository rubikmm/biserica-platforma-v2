/**
 * FIȘIERELE URCATE ÎN CHAT — lista albă, cheile și scoaterea textului din .docx / .txt.
 *
 * Cererea utilizatorului (18.09.2026, 22:20): „chatul trebuie să accepte fișiere Word (.docx) sau
 * .txt, poze și text ca și acum". Referința e proiectul de chineză (`src/lib/media.js`), de unde s-au
 * luat piesele care există acolo: limita de 12 MB verificată întâi pe `content-length`, lista albă
 * MIME↔extensie și **cheia obiectului născută de server, niciodată primită de la om**. Docx-ul și
 * txt-ul nu există acolo — sunt scrise aici.
 *
 * ⚠️ MODUL PUR, DINADINS: nimic din el nu atinge R2, KV, rețeaua sau vreun binding. Așa scoaterea
 * textului se probează cu un docx construit chiar în probă, fără Workers și fără depozit — iar partea
 * care poate să greșească tăcut (un zip citit greșit dă text gol, nu o eroare) are probe ieftine.
 *
 * ⚠️ FĂRĂ BIBLIOTECI NOI. Un .docx e un zip cu XML înăuntru; zip-ul se citește cu `DataView`, iar
 * dezumflarea o face `DecompressionStream('deflate-raw')`, care e în platformă (Workers și Node).
 * O bibliotecă de zip ar fi adus sute de KB în worker pentru un singur fișier din arhivă.
 */

/** Cât primim, în octeți. Pozele vin micșorate din browser; un articol .docx are zeci de KB. */
export const LIMITA_OCTETI = 12 * 1024 * 1024

/**
 * Cât din mesajul omului intră în discuție — aceeași cifră ca tăierea din `chat-worker`.
 *
 * ⚠️ STĂ AICI, nu acolo, ca să fie UNA SINGURĂ: ruta de urcare taie textul extras ca să spună în card
 * „s-a tăiat", iar creierul taie mesajul la scriere. Două cifre scrise în două locuri s-ar fi depărtat
 * la prima schimbare, iar omul ar fi văzut „nu s-a tăiat nimic" peste un text ciuntit.
 */
export const TAIERE_MESAJ_OM = 12000

export type FelFisier = 'docx' | 'txt' | 'jpg' | 'png' | 'webp'

export interface FelStiut {
  fel: FelFisier
  /** Extensia cu care se scrie cheia — una singură pe fel (`jpeg` devine `jpg`). */
  ext: string
  /** Tipul cu care se pune în depozit; NU cel primit de la browser. */
  tip: string
  ePoza: boolean
}

/**
 * LISTA ALBĂ. Fără `gif` (cerere anume, 18.09.2026) și fără nimic din ce n-are rost pe o foaie de
 * buletin: ce nu e aici nu intră, oricât de bine s-ar numi fișierul.
 */
const FELURI: ReadonlyArray<{ fel: FelFisier; ext: string; alteExt: string[]; tipuri: string[]; tip: string; ePoza: boolean }> = [
  {
    fel: 'docx',
    ext: 'docx',
    alteExt: [],
    tipuri: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    tip: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ePoza: false,
  },
  { fel: 'txt', ext: 'txt', alteExt: ['text'], tipuri: ['text/plain'], tip: 'text/plain; charset=utf-8', ePoza: false },
  { fel: 'jpg', ext: 'jpg', alteExt: ['jpeg'], tipuri: ['image/jpeg', 'image/jpg'], tip: 'image/jpeg', ePoza: true },
  { fel: 'png', ext: 'png', alteExt: [], tipuri: ['image/png'], tip: 'image/png', ePoza: true },
  { fel: 'webp', ext: 'webp', alteExt: [], tipuri: ['image/webp'], tip: 'image/webp', ePoza: true },
]

/** Ce se pune în `accept` la câmpul de fișier al bulei — aceeași listă, scrisă pentru browser. */
export const ACCEPTA =
  '.docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*'

const tipCurat = (tip: string): string => String(tip || '').split(';')[0]!.trim().toLowerCase()

/** Un tip pe care browserele îl trimit când nu știu ce trimit — atunci hotărăște extensia. */
const tipNeutru = (tip: string): boolean => !tip || tip === 'application/octet-stream' || tip === 'application/binary'

/**
 * CE FEL E FIȘIERUL, după nume ȘI după tip — `null` dacă nu e din listă, ori dacă cele două se ceartă.
 *
 * ⚠️ Nepotrivirea e refuz, nu alegere: un `raport.txt` trimis cu `image/png` e ori o greșeală, ori
 * cineva care încearcă ceva. Excepția e tipul neutru (telefoanele îl trimit des) — acolo numele
 * hotărăște, ca în proiectul de chineză.
 */
export function felulFisierului(nume: string, tip: string): FelStiut | null {
  const t = tipCurat(tip)
  const punct = String(nume || '').lastIndexOf('.')
  const ext = punct > 0 ? nume.slice(punct + 1).toLowerCase() : ''

  const dupaExt = FELURI.find((f) => f.ext === ext || f.alteExt.includes(ext))
  if (dupaExt) {
    if (!tipNeutru(t) && !dupaExt.tipuri.includes(t)) return null
    return { fel: dupaExt.fel, ext: dupaExt.ext, tip: dupaExt.tip, ePoza: dupaExt.ePoza }
  }
  // Fără extensie în nume (se întâmplă la lipirea din clipboard): rămâne tipul.
  const dupaTip = FELURI.find((f) => f.tipuri.includes(t))
  if (!dupaTip) return null
  return { fel: dupaTip.fel, ext: dupaTip.ext, tip: dupaTip.tip, ePoza: dupaTip.ePoza }
}

const hex = (cati: number): string =>
  [...crypto.getRandomValues(new Uint8Array(cati))].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * CHEIA DIN DEPOZIT — `chat/<aplicatie>/<om>/<timp36>-<hex6>.<ext>`.
 *
 * ⚠️ O SCRIE SERVERUL, MEREU. Nimic din ea nu vine de la om: altfel cine urcă ar putea scrie peste
 * fișierul altuia (ori peste o foaie a parohiei) alegându-și singur calea. Din om rămâne doar un ciot
 * de identificator, curățat, cât să se vadă a cui e grămada la o curățenie.
 */
export function cheiaFisierului(o: { aplicatie: string; userId: string; ext: string }): string {
  const app = o.aplicatie.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'chat'
  const om = o.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase() || 'anonim'
  return `chat/${app}/${om}/${Date.now().toString(36)}-${hex(3)}.${o.ext}`
}

// ---------------------------------------------------------------------------
// Textul: curățarea comună
// ---------------------------------------------------------------------------

/**
 * Textul, adus la o formă: sfârșiturile de rând una singură, spațiile strânse, rândurile goale cel
 * mult unul (acela desparte paragrafele pe hârtie).
 *
 * ⚠️ NU e o rescriere a textului omului: nu se schimbă niciun cuvânt, nicio literă și nicio
 * diacritică. Se scoate doar aerul pe care l-a adus formatul — tab-uri, spații nefrângătoare,
 * semne de control din documentele vechi.
 */
export function curataTextul(brut: string): string {
  return String(brut ?? '')
    .replace(/\r\n?/g, '\n')
    // spațiul nefrângător și frații lui: pe hârtie arată la fel, în socoteala semnelor nu
    .replace(/[\u00a0\u202f\u2007]/g, ' ')
    // semnele de control aduse de documentele vechi (fără rândul nou, care desparte paragrafele)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------------------------------------------------------------------------
// .txt
// ---------------------------------------------------------------------------

/**
 * TEXTUL DINTR-UN .txt. UTF-8, cu BOM scos; dacă nu e UTF-8 valid, se încearcă `windows-1250` —
 * asta scrie Word-ul de pe Windows la „Salvează ca text", și acolo stau diacriticele parohiei.
 *
 * ⚠️ `fatal: true` la prima încercare e miezul: fără el, un fișier windows-1250 ar trece drept UTF-8
 * cu semne de întrebare în loc de ș și ț — adică ar merge, dar ar strica textul în tăcere.
 */
export function extrageTextTxt(buf: ArrayBuffer): string {
  let o = new Uint8Array(buf)
  // BOM-urile: UTF-8, apoi UTF-16 (Word-ul scrie și așa)
  if (o[0] === 0xef && o[1] === 0xbb && o[2] === 0xbf) o = o.subarray(3)
  else if (o[0] === 0xff && o[1] === 0xfe) return curataTextul(citesteCu('utf-16le', o.subarray(2)))
  else if (o[0] === 0xfe && o[1] === 0xff) return curataTextul(citesteCu('utf-16be', o.subarray(2)))

  try {
    return curataTextul(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(o))
  } catch {
    return curataTextul(citesteCu('windows-1250', o))
  }
}

/** Un decodor care poate lipsi din platformă nu trebuie să dea peste cap toată urcarea. */
function citesteCu(codare: string, o: Uint8Array): string {
  try {
    return new TextDecoder(codare).decode(o)
  } catch {
    return new TextDecoder('utf-8').decode(o)
  }
}

// ---------------------------------------------------------------------------
// .docx — zip, apoi XML
// ---------------------------------------------------------------------------

const SEM_EOCD = 0x06054b50
const SEM_CENTRAL = 0x02014b50
const SEM_LOCAL = 0x04034b50

const u16 = (o: Uint8Array, i: number): number => o[i]! | (o[i + 1]! << 8)
const u32 = (o: Uint8Array, i: number): number =>
  (o[i]! | (o[i + 1]! << 8) | (o[i + 2]! << 16) | (o[i + 3]! << 24)) >>> 0

/**
 * O INTRARE DIN ARHIVĂ, citită PORNIND DE LA DIRECTORUL CENTRAL — nu de la antetele locale.
 *
 * ⚠️ AICI E CAPCANA .docx-ului. Când antetul local are steagul „data descriptor" (bitul 3), mărimile
 * din el sunt ZERO: adevărul stă abia după datele comprimate, iar din față n-ai cum să știi unde se
 * termină. Word-ul scrie așa des. Directorul central, de la sfârșitul fișierului, are mereu mărimile
 * adevărate și offsetul antetului local — deci se pleacă de acolo, mereu, și pentru toate arhivele:
 * un singur drum, nu unul care merge „de obicei".
 */
async function intrareaDinZip(o: Uint8Array, cerut: string): Promise<Uint8Array | null> {
  if (o.length < 22) throw new Error('fișierul e prea scurt ca să fie un .docx')

  // EOCD: undeva în ultimii 22 + 65535 de octeți (comentariul arhivei poate fi lung)
  let e = -1
  const pana = Math.max(0, o.length - 22 - 65535)
  for (let i = o.length - 22; i >= pana; i--) {
    if (u32(o, i) === SEM_EOCD) {
      e = i
      break
    }
  }
  if (e < 0) throw new Error('nu găsesc sfârșitul arhivei — fișierul nu e un .docx întreg')

  const cate = u16(o, e + 10)
  const undeCentral = u32(o, e + 16)
  if (undeCentral === 0xffffffff) throw new Error('arhiva e în formă zip64 — prea mare pentru un articol')

  let p = undeCentral
  for (let i = 0; i < cate && p + 46 <= o.length; i++) {
    if (u32(o, p) !== SEM_CENTRAL) break
    const metoda = u16(o, p + 10)
    const comprimat = u32(o, p + 20)
    const lungimeNume = u16(o, p + 28)
    const lungimeExtra = u16(o, p + 30)
    const lungimeComentariu = u16(o, p + 32)
    const undeLocal = u32(o, p + 42)
    const nume = new TextDecoder('utf-8').decode(o.subarray(p + 46, p + 46 + lungimeNume))

    if (nume === cerut) {
      if (comprimat === 0xffffffff || undeLocal === 0xffffffff) {
        throw new Error('arhiva e în formă zip64 — prea mare pentru un articol')
      }
      if (u32(o, undeLocal) !== SEM_LOCAL) throw new Error('antetul intrării nu e la locul lui în arhivă')
      const de = undeLocal + 30 + u16(o, undeLocal + 26) + u16(o, undeLocal + 28)
      const brut = o.subarray(de, de + comprimat)
      if (metoda === 0) return brut
      if (metoda === 8) return await desumfla(brut)
      throw new Error(`metodă de compresie neștiută în .docx: ${metoda}`)
    }
    p += 46 + lungimeNume + lungimeExtra + lungimeComentariu
  }
  return null
}

/** Dezumflarea, cu ce are platforma. „deflate-raw" = fără antetul zlib, cum stă în zip. */
async function desumfla(brut: Uint8Array): Promise<Uint8Array> {
  const intrare = new Response(brut).body
  if (!intrare) throw new Error('nu pot citi intrarea din arhivă')
  const iesit = intrare.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(iesit).arrayBuffer())
}

/** Entitățile XML, cele cinci numite și cele scrise cu numărul (`&#8222;`, `&#x201E;`). */
export function decodeazaXml(s: string): string {
  const numite: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (tot: string, cod: string) => {
    if (cod[0] === '#') {
      const n = cod[1] === 'x' || cod[1] === 'X' ? Number.parseInt(cod.slice(2), 16) : Number(cod.slice(1))
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return tot
      try {
        return String.fromCodePoint(n)
      } catch {
        return tot
      }
    }
    return numite[cod] ?? tot
  })
}

/**
 * TEXTUL UNUI PARAGRAF: bucățile din `<w:t>`, cu tab-ul ca spațiu și `<w:br/>` ca rând nou.
 *
 * ⚠️ Se scot întâi `<w:pPr>` și `<w:rPr>` (proprietățile): acolo stă `<w:tabs><w:tab …/></w:tabs>`,
 * adică o AȘEZARE, nu un tab scris de om — fără scoaterea asta, fiecare paragraf ar căpăta spații
 * din senin la început.
 */
function textulParagrafului(p: string): string {
  const curat = p.replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/g, '').replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/g, '')
  let text = ''
  const rx = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>|<w:(tab|br|cr)(?:\s[^>]*)?\/?>/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(curat)) !== null) {
    if (m[1] !== undefined) text += decodeazaXml(m[1])
    else if (m[2] === 'tab') text += ' '
    else if (m[2] === 'br' || m[2] === 'cr') text += '\n'
  }
  return text
}

/**
 * PARAGRAFELE DIN `word/document.xml`, despărțite cu rând gol (așa le cere foaia). Exportată ca să
 * se poată proba XML-ul singur, fără să mai fie nevoie de un zip.
 */
export function paragrafeleDocx(xml: string): string {
  const corp = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml
  const bucati: string[] = []
  const rx = /<w:p\b[^>]*?\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(corp)) !== null) bucati.push(textulParagrafului(m[1] ?? ''))
  return bucati.map((b) => b.trim()).filter(Boolean).join('\n\n')
}

/**
 * TEXTUL DINTR-UN .docx. Aruncă, cu motivul în vorbe, dacă fișierul nu e ce spune că e — motivul
 * ajunge la om, deci se scrie omenește, nu cu coduri.
 */
export async function extrageTextDocx(buf: ArrayBuffer): Promise<string> {
  const octeti = await intrareaDinZip(new Uint8Array(buf), 'word/document.xml')
  if (!octeti) throw new Error('fișierul nu are word/document.xml — nu pare un document Word')
  return curataTextul(paragrafeleDocx(new TextDecoder('utf-8').decode(octeti)))
}
