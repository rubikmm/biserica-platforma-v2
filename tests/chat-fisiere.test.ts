/**
 * FIȘIERELE URCATE ÎN CHAT (user, 18.09.2026, 22:20: „chatul trebuie să accepte fișiere Word (.docx)
 * sau .txt, poze și text ca și acum").
 *
 * Ce se poate strica TĂCUT — și de asta stă fiecare probă aici:
 *   1. **zip-ul citit greșit** — un .docx citit de la antetele locale, nu de la directorul central,
 *      dă text GOL la fișierele scrise cu „data descriptor" (Word scrie des așa). Nicio eroare
 *      nicăieri: omul urcă articolul și chatul spune că n-are text;
 *   2. **codarea unui .txt** — un fișier windows-1250 citit ca UTF-8 nu cade, doar strică toate
 *      diacriticele; articolul ajunge pe hârtie cu semne de întrebare în loc de ș și ț;
 *   3. **cheia obiectului** — dacă ar veni de la om, cine urcă ar putea scrie peste foaia parohiei;
 *   4. **cârligul buletinului** — dacă textul n-ar intra ÎN SCHIȚĂ, ar trebui să-l care modelul
 *      înapoi, literă cu literă, adică exact ce a fost scrisă schița să ocolească;
 *   5. **poza care nu ajunge pe foaie** — Browser Rendering ia poza de pe internet; cu o cheie de
 *      depozit în loc de adresă, locul ei rămâne gol pe pagina întâi, fără nicio plângere.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import buletin from '../apps/buletin/src/index.js'
import { actiuniBuletin } from '../apps/buletin/src/actiuni.js'
import { buletinulNou } from '../apps/buletin/src/pagini.js'
import { CHEIE_CHESTIONAR, cheiaSchitei, type Schita } from '../apps/buletin/src/schita.js'
import { JS_CHAT } from '../packages/chat/src/bula.js'
import {
  cheiaFisierului,
  curataTextul,
  extrageTextDocx,
  extrageTextTxt,
  felulFisierului,
  paragrafeleDocx,
} from '../packages/chat/src/fisiere.js'
import { modulChat, uitaConfigChat } from '../packages/chat/src/index.js'

// ---------------------------------------------------------------------------
// Un .docx făcut chiar aici: zip scris cu mâna, ca să se poată cere anume fiecare formă
// ---------------------------------------------------------------------------

const TIP_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const octetiDin = (s: string): Uint8Array => new TextEncoder().encode(s)

async function deflateaza(date: Uint8Array): Promise<Uint8Array> {
  const flux = new Response(date).body!.pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

/** CRC32, ca într-un zip adevărat. Cititorul nostru nu-l verifică, dar un zip de probă fals ar fi
 *  o probă care nu seamănă cu ce vine din Word. */
function crc32(date: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < date.length; i++) {
    c ^= date[i]!
    for (let b = 0; b < 8; b++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

interface IntrareZip {
  nume: string
  text: string
  /** 0 = pus ca atare (stored), 8 = dezumflat (deflate) — amândouă apar în .docx-uri adevărate. */
  metoda: 0 | 8
  /**
   * Steagul 3: mărimile din antetul LOCAL sunt zero, adevărul stă în directorul central. Word scrie
   * așa când face fișierul în flux — forma care rupe orice cititor pornit de la antetele locale.
   */
  descriptor?: boolean
}

/** Un zip întreg: antete locale, directorul central și EOCD-ul. */
async function faZip(intrari: IntrareZip[]): Promise<Uint8Array> {
  const bucati: Uint8Array[] = []
  const central: Uint8Array[] = []
  let unde = 0

  for (const it of intrari) {
    const intins = octetiDin(it.text)
    const date = it.metoda === 8 ? await deflateaza(intins) : intins
    const nume = octetiDin(it.nume)
    const suma = crc32(intins)

    const local = new Uint8Array(30 + nume.length)
    const vl = new DataView(local.buffer)
    vl.setUint32(0, 0x04034b50, true)
    vl.setUint16(4, 20, true)
    vl.setUint16(6, it.descriptor ? 0x0008 : 0, true)
    vl.setUint16(8, it.metoda, true)
    vl.setUint32(14, it.descriptor ? 0 : suma, true)
    vl.setUint32(18, it.descriptor ? 0 : date.length, true)
    vl.setUint32(22, it.descriptor ? 0 : intins.length, true)
    vl.setUint16(26, nume.length, true)
    local.set(nume, 30)

    bucati.push(local, date)
    let lungime = local.length + date.length
    if (it.descriptor) {
      const d = new Uint8Array(16)
      const vd = new DataView(d.buffer)
      vd.setUint32(0, 0x08074b50, true)
      vd.setUint32(4, suma, true)
      vd.setUint32(8, date.length, true)
      vd.setUint32(12, intins.length, true)
      bucati.push(d)
      lungime += d.length
    }

    const cd = new Uint8Array(46 + nume.length)
    const vc = new DataView(cd.buffer)
    vc.setUint32(0, 0x02014b50, true)
    vc.setUint16(4, 20, true)
    vc.setUint16(6, 20, true)
    vc.setUint16(8, it.descriptor ? 0x0008 : 0, true)
    vc.setUint16(10, it.metoda, true)
    vc.setUint32(16, suma, true)
    vc.setUint32(20, date.length, true)
    vc.setUint32(24, intins.length, true)
    vc.setUint16(28, nume.length, true)
    vc.setUint32(42, unde, true)
    cd.set(nume, 46)
    central.push(cd)
    unde += lungime
  }

  const marimeCd = central.reduce((s, c) => s + c.length, 0)
  const capat = new Uint8Array(22)
  const ve = new DataView(capat.buffer)
  ve.setUint32(0, 0x06054b50, true)
  ve.setUint16(8, intrari.length, true)
  ve.setUint16(10, intrari.length, true)
  ve.setUint32(12, marimeCd, true)
  ve.setUint32(16, unde, true)

  const toate = [...bucati, ...central, capat]
  const tot = new Uint8Array(toate.reduce((s, b) => s + b.length, 0))
  let i = 0
  for (const b of toate) {
    tot.set(b, i)
    i += b.length
  }
  return tot
}

const paragraf = (text: string) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`

const documentXml = (corp: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corp}</w:body></w:document>`

const CORP_XML = [
  paragraf('DESPRE RUGĂCIUNE'),
  '<w:p/>',
  paragraf('Sf&#226;ntul Ioan Gur&#259; de Aur &amp; ucenicii lui'),
  '<w:p><w:r><w:t>Un rând,</w:t></w:r><w:r><w:tab/><w:t>după tab</w:t></w:r><w:r><w:br/><w:t>și după br</w:t></w:r></w:p>',
  paragraf('Sursa: ziarullumina.ro'),
].join('')

const docxCu = (metoda: 0 | 8, descriptor = false) =>
  faZip([
    // ⚠️ Un .docx are mereu `[Content_Types].xml` ÎNAINTEA documentului: proba merge pe arhiva
    // adevărată, cu mai multe intrări, nu pe una cu un singur fișier în ea.
    { nume: '[Content_Types].xml', text: '<Types/>', metoda: 8 },
    { nume: 'word/document.xml', text: documentXml(CORP_XML), metoda, descriptor },
  ])

describe('.docx — zip citit de la directorul central, apoi XML', () => {
  it('scoate paragrafele dintr-o intrare DEZUMFLATĂ (forma obișnuită)', async () => {
    const text = await extrageTextDocx((await docxCu(8)).buffer as ArrayBuffer)
    expect(text.split('\n\n')[0]).toBe('DESPRE RUGĂCIUNE')
    // entitățile XML, decodate: numite și scrise cu numărul
    expect(text).toContain('Sfântul Ioan Gură de Aur & ucenicii lui')
    // sursa rămâne, ca `sursaPropusa` să aibă ce găsi mai departe
    expect(text).toContain('Sursa: ziarullumina.ro')
  })

  it('scoate la fel dintr-o intrare PUSĂ CA ATARE (stored, metoda 0)', async () => {
    const text = await extrageTextDocx((await docxCu(0)).buffer as ArrayBuffer)
    expect(text).toContain('DESPRE RUGĂCIUNE')
    expect(text).toContain('Sursa: ziarullumina.ro')
  })

  /**
   * ⚠️ PROBA CARE PĂZEȘTE HOTĂRÂREA: cu „data descriptor", antetul local spune mărime ZERO. Un
   * cititor pornit de acolo ar lua zero octeți, ar dezumfla nimic și ar întoarce text gol — fără să
   * cadă. De aceea se pleacă MEREU de la directorul central.
   */
  it('scoate textul și când mărimile lipsesc din antetul local (data descriptor)', async () => {
    const text = await extrageTextDocx((await docxCu(8, true)).buffer as ArrayBuffer)
    expect(text).toContain('DESPRE RUGĂCIUNE')
    expect(text).toContain('Sfântul Ioan Gură de Aur')
  })

  it('tab-ul e un spațiu, `br` e rând nou, iar tab-ul din proprietăți nu se numără', async () => {
    const text = paragrafeleDocx(documentXml(CORP_XML))
    expect(text).toContain('Un rând, după tab\nși după br')
    // ⚠️ `<w:tabs>` din `<w:pPr>` e o așezare, nu un tab scris de om: paragraful nu începe cu spațiu
    expect(text.startsWith('DESPRE')).toBe(true)
  })

  it('paragrafele se despart cu rând gol, iar cele goale nu lasă găuri', async () => {
    const text = paragrafeleDocx(documentXml(CORP_XML))
    expect(text).not.toMatch(/\n{3,}/)
    expect(text.split('\n\n')).toHaveLength(4)
  })

  it('un fișier care nu e .docx se refuză cu motivul în vorbe, nu cu un cod', async () => {
    await expect(extrageTextDocx(octetiDin('nu sunt un zip').buffer as ArrayBuffer)).rejects.toThrow(/arhiv|docx|scurt/i)
    const faraDocument = await faZip([{ nume: 'altceva.xml', text: '<x/>', metoda: 8 }])
    await expect(extrageTextDocx(faraDocument.buffer as ArrayBuffer)).rejects.toThrow(/word\/document\.xml/)
  })
})

// ---------------------------------------------------------------------------
// .txt
// ---------------------------------------------------------------------------

describe('.txt — codarea nu se ghicește, se încearcă', () => {
  it('UTF-8 cu BOM: BOM-ul iese, textul rămâne', () => {
    const cu = new Uint8Array([0xef, 0xbb, 0xbf, ...octetiDin('Rugăciunea e respirația sufletului.')])
    expect(extrageTextTxt(cu.buffer as ArrayBuffer)).toBe('Rugăciunea e respirația sufletului.')
  })

  /**
   * ⚠️ „Salvează ca text" din Word-ul de pe Windows scrie windows-1250. Citit ca UTF-8, n-ar cădea —
   * ar înlocui fiecare diacritică cu un semn de întrebare, și abia pe hârtie s-ar vedea.
   */
  it('windows-1250: diacriticele se întorc întregi, nu ca semne de întrebare', () => {
    // „Rugăciunea" în windows-1250: ă = 0xE3, iar restul e ASCII
    const cw = new Uint8Array([0x52, 0x75, 0x67, 0xe3, 0x63, 0x69, 0x75, 0x6e, 0x65, 0x61])
    const text = extrageTextTxt(cw.buffer as ArrayBuffer)
    expect(text).toBe('Rugăciunea')
    expect(text).not.toContain('�')
  })

  it('CR/LF se aduc la o formă, iar rândurile goale rămân cel mult unul', () => {
    const brut = octetiDin('Un rând\r\n\r\n\r\n\r\nAl doilea\r\n')
    expect(extrageTextTxt(brut.buffer as ArrayBuffer)).toBe('Un rând\n\nAl doilea')
  })

  it('curățarea nu atinge cuvintele: doar aerul adus de format', () => {
    expect(curataTextul('  Sfântul Ioan   Gură \t de Aur \n\n\n Amin  ')).toBe('Sfântul Ioan Gură de Aur\n\nAmin')
  })
})

// ---------------------------------------------------------------------------
// Lista albă și cheia
// ---------------------------------------------------------------------------

describe('lista albă MIME↔extensie', () => {
  it('primește exact ce s-a cerut: docx, txt, jpg/jpeg, png, webp', () => {
    expect(felulFisierului('articol.docx', TIP_DOCX)?.fel).toBe('docx')
    expect(felulFisierului('articol.txt', 'text/plain; charset=utf-8')?.fel).toBe('txt')
    expect(felulFisierului('poza.jpeg', 'image/jpeg')?.fel).toBe('jpg')
    expect(felulFisierului('poza.JPG', 'image/jpeg')?.ext).toBe('jpg')
    expect(felulFisierului('poza.png', 'image/png')?.fel).toBe('png')
    expect(felulFisierului('poza.webp', 'image/webp')?.fel).toBe('webp')
  })

  it('refuză restul — inclusiv `gif`, cerut anume să nu intre', () => {
    expect(felulFisierului('poza.gif', 'image/gif')).toBeNull()
    expect(felulFisierului('foaia.pdf', 'application/pdf')).toBeNull()
    expect(felulFisierului('vechi.doc', 'application/msword')).toBeNull()
    expect(felulFisierului('script.js', 'text/javascript')).toBeNull()
  })

  it('numele și tipul care se ceartă = refuz; tipul neutru lasă numele să hotărască', () => {
    expect(felulFisierului('raport.txt', 'image/png')).toBeNull()
    // telefoanele trimit des `application/octet-stream`; atunci hotărăște extensia, ca la chineză
    expect(felulFisierului('poza.jpg', 'application/octet-stream')?.fel).toBe('jpg')
    expect(felulFisierului('', 'image/png')?.fel).toBe('png')
  })
})

describe('cheia obiectului', () => {
  /** ⚠️ Cheia o scrie SERVERUL. Dacă ar veni de la om, cine urcă ar putea scrie peste foaia parohiei. */
  it('se naște din aplicație, om și ceas — nimic din ce a trimis browserul', () => {
    const c = cheiaFisierului({ aplicatie: 'buletin', userId: 'u1-ABC/../..', ext: 'docx' })
    expect(c).toMatch(/^chat\/buletin\/u1abc\/[a-z0-9]+-[0-9a-f]{6}\.docx$/)
    expect(c).not.toContain('..')
  })

  it('două urcări în aceeași clipă nu se calcă una pe alta', () => {
    const a = cheiaFisierului({ aplicatie: 'buletin', userId: 'u1', ext: 'jpg' })
    const b = cheiaFisierului({ aplicatie: 'buletin', userId: 'u1', ext: 'jpg' })
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// `/chat/urca` prin modul, cu servicii de probă
// ---------------------------------------------------------------------------

const CONFIG_PORNIT = {
  activ: true,
  aplicatii: { program: true, buletin: true },
  cineVede: 'admini',
  model: '@cf/zai-org/glm-5.3-flash',
  creier: 'workers-ai',
  indrumari: '',
  unelte: [] as string[],
}

function kvFals(date: Record<string, unknown>) {
  return {
    async get(cheie: string, fel?: string) {
      if (!(cheie in date)) return null
      const v = date[cheie]
      return fel === 'json' ? v : JSON.stringify(v)
    },
    async put() {},
    async delete() {},
  } as unknown as KVNamespace
}

function mediaFals() {
  const puse: Array<{ cheie: string; tip: string; octeti: number }> = []
  const media = {
    fetch: async (adresa: string, init?: RequestInit) => {
      if (new URL(adresa).pathname !== '/incarca') return new Response('nimic', { status: 404 })
      const antete = (init?.headers ?? {}) as Record<string, string>
      const meta = JSON.parse(antete['x-meta'] ?? '{}') as { key: string; contentType: string }
      const corp = init?.body as ArrayBuffer
      puse.push({ cheie: meta.key, tip: meta.contentType, octeti: corp.byteLength })
      return new Response(JSON.stringify({ ok: true, key: meta.key }), { headers: { 'content-type': 'application/json' } })
    },
  } as unknown as Fetcher
  return { media, puse }
}

const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

const CTX_CHAT = {
  prefix: '',
  principal: { userId: 'u1', email: 'p@example.ro', roles: [] } as never,
  numeleOmului: 'Părintele',
  eAdmin: true,
}

beforeEach(() => uitaConfigChat())

describe('ruta `/chat/urca`', () => {
  const MODUL = modulChat({ aplicatie: 'program' })

  function mediu() {
    const { media, puse } = mediaFals()
    return {
      puse,
      env: {
        MEDIU: 'staging',
        SECRET_INTERN: 'secret',
        CONFIG: kvFals({ 'modul:chat': CONFIG_PORNIT }),
        CHAT: { fetch: async () => new Response('{}') } as unknown as Fetcher,
        MEDIA: media,
      } as never,
    }
  }

  const cuFisier = (f: File, text?: string) => {
    const fd = new FormData()
    fd.append('fisier', f)
    if (text !== undefined) fd.append('text', text)
    return new Request('https://program.test/chat/urca', { method: 'POST', body: fd })
  }

  const urca = (env: unknown, req: Request) => MODUL.ruteaza(req, env as never, ctxExec, '/chat/urca', CTX_CHAT)

  it('un .docx: octeții în media, textul înapoi ca mesaj gata de trimis', async () => {
    const { env, puse } = mediu()
    const docx = new File([await docxCu(8)], 'articol.docx', { type: TIP_DOCX })
    const r = await urca(env, cuFisier(docx, 'uite articolul'))
    const j = (await r!.json()) as { ok: boolean; obiect: { cheie: string; fel: string; octeti: number }; text: string; semne: number; taiat: boolean }

    expect(r!.status).toBe(200)
    expect(j.ok).toBe(true)
    expect(j.obiect.fel).toBe('docx')
    expect(j.obiect.cheie).toMatch(/^chat\/program\/u1\//)
    // ⚠️ octeții au plecat la media, NU în discuție
    expect(puse).toHaveLength(1)
    expect(puse[0]!.cheie).toBe(j.obiect.cheie)
    expect(puse[0]!.tip).toBe(TIP_DOCX)
    // mesajul poartă și ce a scris omul, și textul scos din fișier
    expect(j.text.startsWith('uite articolul')).toBe(true)
    expect(j.text).toContain('Textul din fișierul articol.docx:')
    expect(j.text).toContain('DESPRE RUGĂCIUNE')
    expect(j.semne).toBeGreaterThan(50)
    expect(j.taiat).toBe(false)
  })

  it('o poză: mesajul spune doar că s-a urcat, cu cheia — nu se cară niciun octet prin model', async () => {
    const { env, puse } = mediu()
    const poza = new File([new Uint8Array([1, 2, 3, 4])], 'foaie.jpg', { type: 'image/jpeg' })
    const j = (await (await urca(env, cuFisier(poza)))!.json()) as { obiect: { fel: string }; text: string; semne: number }
    expect(j.obiect.fel).toBe('jpg')
    expect(j.text).toContain('Am urcat poza foaie.jpg')
    expect(j.semne).toBe(0)
    expect(puse[0]!.tip).toBe('image/jpeg')
  })

  it('un text lung se taie la 12000 de semne, iar răspunsul o SPUNE (`taiat`)', async () => {
    const { env } = mediu()
    const lung = new File([octetiDin('a'.repeat(20000))], 'lung.txt', { type: 'text/plain' })
    const j = (await (await urca(env, cuFisier(lung)))!.json()) as { text: string; semne: number; taiat: boolean }
    expect(j.taiat).toBe(true)
    expect(j.text).toHaveLength(12000)
    expect(j.semne).toBe(20000)
  })

  it('peste 12 MB: 413, spus pe `content-length`, fără să se citească fișierul', async () => {
    const { env, puse } = mediu()
    const fd = new FormData()
    fd.append('fisier', new File([octetiDin('scurt')], 'a.txt', { type: 'text/plain' }))
    const req = new Request('https://program.test/chat/urca', {
      method: 'POST',
      body: fd,
      headers: { 'content-length': String(40 * 1024 * 1024) },
    })
    const r = await urca(env, req)
    expect(r!.status).toBe(413)
    expect(puse).toHaveLength(0)
  })

  it('un fel din afara listei: 415, și nimic nu ajunge în depozit', async () => {
    const { env, puse } = mediu()
    const gif = new File([new Uint8Array([1, 2, 3])], 'vesel.gif', { type: 'image/gif' })
    const r = await urca(env, cuFisier(gif))
    expect(r!.status).toBe(415)
    expect(puse).toHaveLength(0)
  })

  it('un .docx stricat se refuză cu 422 și cu motivul în vorbe', async () => {
    const { env, puse } = mediu()
    const stricat = new File([octetiDin('PK nu sunt un zip')], 'articol.docx', { type: TIP_DOCX })
    const r = await urca(env, cuFisier(stricat))
    expect(r!.status).toBe(422)
    expect(((await r!.json()) as { mesaj: string }).mesaj).toContain('articol.docx')
    expect(puse).toHaveLength(0)
  })

  /** ⚠️ Aceeași poartă ca la `/chat/mesaj`: pentru cine n-are voie, ruta nu există. */
  it('cui nu i se cuvine chatul, ruta nu există (404)', async () => {
    const { env, puse } = mediu()
    const r = await MODUL.ruteaza(
      cuFisier(new File([octetiDin('x')], 'a.txt', { type: 'text/plain' })),
      env as never,
      ctxExec,
      '/chat/urca',
      { ...CTX_CHAT, eAdmin: false },
    )
    expect(r!.status).toBe(404)
    expect(puse).toHaveLength(0)
  })

  it('cârligul aplicației ia fișierul în primire și hotărăște mesajul', async () => {
    const { media } = mediaFals()
    const vazute: string[] = []
    const cuCarlig = modulChat({
      aplicatie: 'program',
      async laFisier(f) {
        vazute.push(`${f.fel}:${f.nume}:${f.text.length}`)
        return { mesaj: 'Am pus textul unde trebuie.' }
      },
    })
    const env = {
      MEDIU: 'staging',
      SECRET_INTERN: 'secret',
      CONFIG: kvFals({ 'modul:chat': CONFIG_PORNIT }),
      CHAT: { fetch: async () => new Response('{}') } as unknown as Fetcher,
      MEDIA: media,
    } as never
    const j = (await (await cuCarlig.ruteaza(
      cuFisier(new File([octetiDin('Un articol scurt.')], 'a.txt', { type: 'text/plain' })),
      env,
      ctxExec,
      '/chat/urca',
      CTX_CHAT,
    ))!.json()) as { text: string }
    expect(vazute).toEqual(['txt:a.txt:17'])
    expect(j.text).toBe('Am pus textul unde trebuie.')
  })
})

// ---------------------------------------------------------------------------
// Cârligul buletinului, cap-coadă prin worker
// ---------------------------------------------------------------------------

const ULTIMUL = {
  nr: 615, data: '2026-09-06', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-615-2026-09-06.pdf', cheie_poza: null, cheie_poza_mica: null,
  marime_pdf: 700000, pagini: 4, text: '', titlu: null, sursa: 'v1',
}
const URMATOR = buletinulNou(ULTIMUL, new Date().toISOString().slice(0, 10)) as { nr: number; data: string }

const SESIUNE = {
  authenticated: true,
  user: {
    id: 'u1', email: 'parintele@example.com', displayName: 'Părintele',
    firstName: null, lastName: null, phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1', expiresAt: null, veziCa: null, poateVedeaCa: false,
}

function dbFals() {
  const raspunde = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ')
    if (s.includes('FROM buletine ORDER BY data DESC')) return { first: ULTIMUL, results: [ULTIMUL] }
    if (s.includes('GROUP BY')) return { first: null, results: [{ an: '2026', cate: 12 }] }
    return { first: null, results: [] }
  }
  return {
    prepare: (sql: string) => {
      const r = raspunde(sql)
      const legat = { bind: () => legat, async first() { return r.first }, async all() { return { results: r.results } } }
      return legat
    },
  } as unknown as D1Database
}

/** R2 care ține minte — și octeții, ca `/fisier/poze/…` să aibă ce servi. */
function r2Fals(initial: Record<string, unknown> = {}) {
  const tinut = new Map<string, { corp: string | ArrayBuffer; tip: string }>()
  for (const [k, v] of Object.entries(initial)) tinut.set(k, { corp: JSON.stringify(v), tip: 'application/json' })
  const obiect = (cheie: string) => {
    const scris = tinut.get(cheie)!
    return {
      key: cheie,
      size: typeof scris.corp === 'string' ? scris.corp.length : scris.corp.byteLength,
      httpEtag: '"abc123"',
      body: typeof scris.corp === 'string' ? scris.corp : new Uint8Array(scris.corp),
      httpMetadata: { contentType: scris.tip },
      writeHttpMetadata(h: Headers) { h.set('content-type', scris.tip) },
      async json() { return JSON.parse(String(scris.corp)) },
      async text() { return String(scris.corp) },
      async arrayBuffer() { return scris.corp as ArrayBuffer },
    }
  }
  return {
    tinut,
    bucket: {
      async head(c: string) { return tinut.has(c) ? obiect(c) : null },
      async get(c: string) { return tinut.has(c) ? obiect(c) : null },
      async put(c: string, corp: unknown, o?: { httpMetadata?: { contentType?: string } }) {
        tinut.set(c, {
          corp: typeof corp === 'string' ? corp : (corp as ArrayBuffer),
          tip: o?.httpMetadata?.contentType ?? 'application/octet-stream',
        })
        return { httpEtag: '"pus"' }
      },
      async delete(c: string | string[]) { for (const x of Array.isArray(c) ? c : [c]) tinut.delete(x) },
      async list({ prefix }: { prefix: string }) {
        return { objects: [...tinut.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }
      },
    } as unknown as R2Bucket,
  }
}

const ORIGINE = 'https://buletin.staging.sfantul-ilie.ro'

function mediuBuletin(o: { depozit?: Record<string, unknown>; chei?: string[] } = {}) {
  const chei = o.chei ?? ['bulletin.write', 'bulletin.publish']
  const r2 = r2Fals(o.depozit)
  const { media, puse } = mediaFals()
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: ORIGINE,
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: 'secret',
    DB: dbFals(),
    FISIERE: r2.bucket,
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(SESIUNE), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: {
      fetch: async (_a: string, init?: RequestInit) => {
        const c = JSON.parse(String(init?.body ?? '{}')) as { permission?: string }
        return new Response(JSON.stringify({ allowed: chei.includes(c.permission ?? ''), reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
    AUDIT: { fetch: async () => new Response('{}') },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ membri: [] }), { headers: { 'content-type': 'application/json' } }) },
    PROGRAM: {
      fetch: async () =>
        new Response(
          JSON.stringify({ titlu: '21 – 27 septembrie 2026', slujbe: 6, detalii: 5, stare: 'validat', tabel: '', stil: '', de_la: '', pana_la: '', strans: 0 }),
          { headers: { 'content-type': 'application/json' } },
        ),
    },
    CALENDAR: { fetch: async () => new Response(JSON.stringify({ zile: [] }), { headers: { 'content-type': 'application/json' } }) },
    BROWSER: { fetch: async () => new Response('{}') },
    CHAT: { fetch: async () => new Response(JSON.stringify({ conversatieId: 'c1', text: 'Am înțeles.', obiecte: [], propunere: null, unelte: [] }), { headers: { 'content-type': 'application/json' } }) },
    MEDIA: media,
    CONFIG: kvFals({ 'modul:chat': CONFIG_PORNIT }),
  }
  return { env, tinut: r2.tinut, puse }
}

const cere = (env: unknown, cale: string, init: RequestInit = {}) =>
  buletin.fetch(
    new Request(`${ORIGINE}${cale}`, { ...init, headers: { cookie: 'xc_sesiune=jeton', ...(init.headers ?? {}) } }),
    env as never,
    ctxExec,
  )

const urcaLaBuletin = (env: unknown, f: File, text?: string) => {
  const fd = new FormData()
  fd.append('fisier', f)
  if (text !== undefined) fd.append('text', text)
  // ⚠️ `origin` ca la browser: bariera de origine a aplicației e ÎNAINTEA rutelor chatului.
  return cere(env, '/chat/urca', { method: 'POST', body: fd, headers: { origin: ORIGINE } })
}

const schitaDin = (tinut: Map<string, { corp: string | ArrayBuffer; tip: string }>): Schita =>
  JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita

describe('cârligul buletinului: fișierul intră în SCHIȚĂ, nu în discuție', () => {
  it('un .docx urcat în timpul chestionarului devine TEXTUL articolului de acum', async () => {
    const { env, tinut } = mediuBuletin()
    const docx = new File([await docxCu(8)], 'articol.docx', { type: TIP_DOCX })
    const j = (await (await urcaLaBuletin(env, docx)).json()) as { ok: boolean; text: string; nota: string }

    expect(j.ok).toBe(true)
    /*
     * ⚠️ DOUĂ VORBE, de pe 19.09.2026: `nota` e ce i se arată OMULUI, `text` e ce pleacă spre creier.
     * S-au despărțit fiindcă fluxul pe hartă citea în propria noastră notă cuvintele „textul" și
     * „articolul principal" și o lua drept o instrucțiune nouă — cerând textul a doua oară.
     */
    expect(j.nota).toContain('Am pus textul din articol.docx')
    expect(j.nota).toContain('ca textul articolului principal')
    expect(j.text).toBe('unde am rămas')
    // articolul nu pleacă nicăieri, pe niciuna dintre cele două: el a rămas pe server
    expect(j.nota).not.toContain('DESPRE RUGĂCIUNE')
    expect(j.text).not.toContain('DESPRE RUGĂCIUNE')

    const schita = schitaDin(tinut)
    expect(schita.principal.text).toContain('DESPRE RUGĂCIUNE')
    expect(schita.principal.gata).toContain('text')
  })

  it('un .txt merge la fel, iar schița se scrie sub cheia numărului care urmează', async () => {
    const { env, tinut } = mediuBuletin()
    const txt = new File([octetiDin('Un articol scurt despre post.\n\nSursa: doxologia.ro')], 'post.txt', { type: 'text/plain' })
    await urcaLaBuletin(env, txt)
    expect(tinut.has(cheiaSchitei(URMATOR))).toBe(true)
    expect(schitaDin(tinut).principal.text).toContain('Un articol scurt despre post.')
  })

  /** Articolul are deja text: fișierul nu-l calcă, ci merge pe drumul generic — omul spune unde-l vrea. */
  it('când articolul are deja text, cârligul se dă la o parte', async () => {
    const schitaCuText: Schita = {
      nr: URMATOR.nr, data: URMATOR.data, motto: 'Un motto',
      principal: { text: 'Textul de dinainte.', gata: ['text', 'autor', 'ani', 'titlu', 'sursa'] },
      secundari: [], gata: ['motto'], actualizat: '2026-09-18T20:00:00.000Z',
    }
    const { env, tinut } = mediuBuletin({ depozit: { [cheiaSchitei(URMATOR)]: schitaCuText } })
    const txt = new File([octetiDin('Alt articol, pentru altundeva.')], 'alt.txt', { type: 'text/plain' })
    const j = (await (await urcaLaBuletin(env, txt)).json()) as { text: string }

    expect(j.text).toContain('Textul din fișierul alt.txt:')
    expect(j.text).toContain('Alt articol, pentru altundeva.')
    // schița NU s-a atins
    expect(schitaDin(tinut).principal.text).toBe('Textul de dinainte.')
  })

  it('o poză ajunge în depozitul buletinului, sub `poze/…`, iar în schiță se scrie ADRESA ei', async () => {
    const { env, tinut } = mediuBuletin()
    const poza = new File([new Uint8Array([137, 80, 78, 71])], 'sfantul.png', { type: 'image/png' })
    const j = (await (await urcaLaBuletin(env, poza)).json()) as { text: string; nota: string; poza: string }

    const cheiePoze = [...tinut.keys()].filter((k) => k.startsWith('poze/'))
    expect(cheiePoze).toHaveLength(1)
    expect(cheiePoze[0]).toMatch(new RegExp(`^poze/${URMATOR.nr}-${URMATOR.data}/[a-z0-9]+-[0-9a-f]{6}\\.png$`))

    // ⚠️ ADRESA ÎNTREAGĂ, nu cheia: Browser Rendering ia poza de pe internet
    expect(j.poza).toBe(`${ORIGINE}/fisier/${cheiePoze[0]}`)
    expect(schitaDin(tinut).principal.poza).toBe(j.poza)
    // nota e a omului (bula o desenează), iar spre creier pleacă doar comanda hărții
    expect(j.nota).toContain('Am pus poza sfantul.png la articolul principal')
    expect(j.text).toBe('unde am rămas')
  })

  it('poza urcată se poate chiar CERE de pe adresa publică (altfel foaia ar ieși cu locul gol)', async () => {
    const { env, tinut } = mediuBuletin()
    await urcaLaBuletin(env, new File([new Uint8Array([137, 80, 78, 71])], 'sfantul.png', { type: 'image/png' }))
    const cheie = [...tinut.keys()].find((k) => k.startsWith('poze/'))!
    const r = await cere(env, `/fisier/${cheie}`)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    // cache scurt: poza trăiește câteva ore, cât se face numărul
    expect(r.headers.get('cache-control')).toBe('public, max-age=300')
  })

  /**
   * ⚠️ Cârligul scrie ÎNAINTE ca modelul să răspundă. Dacă modelul nu mai cheamă nicio unealtă (n-are
   * de ce — treaba e făcută), ecranul n-ar afla niciodată că schița s-a schimbat. De aceea răspunsul
   * urcării poartă el `unelte`, iar bula dă vestea pe loc.
   */
  it('răspunsul urcării spune ce s-a atins, ca ecranul să se poată împrospăta pe loc', async () => {
    const { env } = mediuBuletin()
    const txt = new File([octetiDin('Un articol scurt.')], 'a.txt', { type: 'text/plain' })
    const j = (await (await urcaLaBuletin(env, txt)).json()) as { unelte: string[] }
    expect(j.unelte).toEqual(['buletin.raspunde'])
    expect(JS_CHAT).toContain('if (j.unelte && j.unelte.length) vesteste(j);')
  })

  it('o cheie de poză inventată nu deschide depozitul', async () => {
    const { env } = mediuBuletin()
    for (const cheie of ['poze/../2026/buletin-615-2026-09-06.pdf', 'poze/616-2026-09-20/oricine.jpg']) {
      expect((await cere(env, `/fisier/${cheie}`)).status).toBe(404)
    }
  })
})

// ---------------------------------------------------------------------------
// `buletin.raspunde`: instrucțiuni punctuale către un obiect al foii
// ---------------------------------------------------------------------------

const actiunea = (nume: string) => {
  const a = actiuniBuletin.find((x) => x.nume === nume)
  if (!a) throw new Error(`nu există acțiunea ${nume}`)
  return a
}

const ctxActiune = (env: unknown) => ({
  env,
  actor: { fel: 'utilizator' as const, principal: { userId: 'u1', email: 'p@example.com' } },
  correlationId: 'probă',
  ctxExec,
  prin: 'chat',
})

interface RaspunsRaspunde {
  scris: string
  masura: { semne: number; incap: number; ramase: number } | null
  articol: string
  subiect: string
  intrebare: string | null
  instructiune: string
  gata: boolean
}

function mediuActiuni(depozit: Record<string, unknown> = {}) {
  const r2 = r2Fals(depozit)
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: ORIGINE,
    DB: dbFals(),
    FISIERE: r2.bucket,
    PROGRAM: {
      fetch: async () =>
        new Response(
          JSON.stringify({ titlu: '21 – 27 septembrie 2026', slujbe: 6, detalii: 5, stare: 'validat', tabel: '', stil: '', de_la: '', pana_la: '', strans: 0 }),
          { headers: { 'content-type': 'application/json' } },
        ),
    },
    CALENDAR: { fetch: async () => new Response(JSON.stringify({ zile: [] }), { headers: { 'content-type': 'application/json' } }) },
    CONFIG: { get: async (cheie: string) => (cheie === CHEIE_CHESTIONAR ? null : null) },
    BROWSER: { fetch: async () => new Response('{}') },
  }
  return { env, tinut: r2.tinut }
}

const raspunde = (env: unknown, a: Record<string, unknown>) =>
  actiunea('buletin.raspunde').executa(a as never, ctxActiune(env) as never) as Promise<RaspunsRaspunde>

/** O schiță gata făcută: numărul e complet, chestionarul s-a terminat. */
const SCHITA_GATA: Schita = {
  nr: URMATOR.nr,
  data: URMATOR.data,
  motto: 'Un motto vechi',
  motoAutor: 'Cineva',
  principal: {
    autor: 'SFÂNTUL IOAN GURĂ DE AUR', ani: '347-407', titlu: 'DESPRE RUGĂCIUNE',
    text: 'Textul articolului principal.', sursa: 'ziarullumina.ro',
    gata: ['text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa'], pomenireCautata: '',
  },
  secundari: [
    { autor: 'AL DOILEA', titlu: 'AL DOILEA TITLU', text: 'Al doilea text.', gata: ['text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa'], pomenireCautata: '' },
    { autor: 'AL TREILEA', titlu: 'AL TREILEA TITLU', text: 'Al treilea text.', gata: ['text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa'], pomenireCautata: '' },
  ],
  gata: ['motto', 'mai_adaugam'],
  actualizat: '2026-09-18T20:00:00.000Z',
}

describe('`buletin.raspunde` — instrucțiuni punctuale, în afara chestionarului', () => {
  it('„schimbă motto-ul în X" după ce schița e gata: se schimbă și NU se reia nicio întrebare', async () => {
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: SCHITA_GATA })
    const r = await raspunde(env, { subiect: 'motto', valoare: 'Rugăciunea este respirația sufletului' })

    expect(r.scris).toContain('Rugăciunea este respirația sufletului')
    // ⚠️ MIEZUL: fără întrebare de pus și fără „pune omului EXACT întrebarea de mai jos"
    expect(r.intrebare).toBeNull()
    expect(r.gata).toBe(true)
    expect(r.instructiune).toContain('Spune-i omului ce ai schimbat')
    expect(JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)).motto).toBe('Rugăciunea este respirația sufletului')
  })

  it('`articol` spune UNDE se scrie: titlul secundarului 1, nu al principalului', async () => {
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: SCHITA_GATA })
    await raspunde(env, { subiect: 'titlu', valoare: 'DESPRE POST', articol: 's1' })
    const s = JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita
    expect(s.secundari[0]!.titlu).toBe('DESPRE POST')
    expect(s.principal.titlu).toBe('DESPRE RUGĂCIUNE')
  })

  it('„scoate secundarul 2" chiar îl scoate', async () => {
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: SCHITA_GATA })
    const r = await raspunde(env, { subiect: 'sterge_secundar' })
    expect(r.scris).toContain('au rămas 1')
    expect((JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita).secundari).toHaveLength(1)
  })

  it('o poză dată prin CHEIE devine adresa ei publică — altfel nu s-ar vedea pe foaie', async () => {
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: SCHITA_GATA })
    const cheie = `poze/${URMATOR.nr}-${URMATOR.data}/mfk3z2-a91b04.jpg`
    await raspunde(env, { subiect: 'poza', valoare: cheie, articol: 's2' })
    const s = JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita
    expect(s.secundari[1]!.poza).toBe(`${ORIGINE}/fisier/${cheie}`)
  })

  it('o adresă întreagă rămâne cum a venit', async () => {
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: SCHITA_GATA })
    await raspunde(env, { subiect: 'poza', valoare: 'https://exemplu.ro/poza.jpg', articol: 'principal' })
    expect((JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita).principal.poza).toBe('https://exemplu.ro/poza.jpg')
  })

  /**
   * ⚠️ Fără `articol`, se scrie la ARTICOLUL CURENT al schiței — cel al întrebării de acum, iar când
   * chestionarul s-a terminat, ultimul. Proba e aici ca hotărârea să nu se schimbe pe furiș: modelul
   * scrie `articol` numai când omul spune el despre care articol e vorba.
   */
  it('fără `articol`, scrisul merge la articolul curent al schiței', async () => {
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: SCHITA_GATA })
    await raspunde(env, { subiect: 'poza', valoare: 'https://exemplu.ro/poza.jpg' })
    const s = JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita
    expect(s.secundari[1]!.poza).toBe('https://exemplu.ro/poza.jpg')
    expect(s.principal.poza).toBeUndefined()
  })

  /**
   * ⚠️ PURTAREA DE DINAINTE NU S-A CLINTIT: un răspuns la întrebarea pusă întoarce mai departe
   * întrebarea următoare, gata scrisă, cu instrucțiunea „pune-o EXACT așa".
   */
  it('un răspuns la întrebarea de acum duce chestionarul mai departe, ca până acum', async () => {
    const { env } = mediuActiuni()
    const r = await raspunde(env, { subiect: 'motto', valoare: 'Un motto nou' })
    expect(r.intrebare).toBeTruthy()
    expect(r.intrebare).toContain('textul')
    expect(r.instructiune).toContain('EXACT')
    expect(r.gata).toBe(false)
  })

  it('un articol cerut anume se deschide dacă încă nu există', async () => {
    const schitaFaraSecundari: Schita = { ...SCHITA_GATA, secundari: [], gata: ['motto'] }
    const { env, tinut } = mediuActiuni({ [cheiaSchitei(URMATOR)]: schitaFaraSecundari })
    await raspunde(env, { subiect: 'autor', valoare: 'SFÂNTUL VASILE CEL MARE', articol: 's1' })
    const s = JSON.parse(String(tinut.get(cheiaSchitei(URMATOR))!.corp)) as Schita
    expect(s.secundari).toHaveLength(1)
    expect(s.secundari[0]!.autor).toBe('SFÂNTUL VASILE CEL MARE')
  })

  it('exemplele poartă argumente gata scrise, ca un model mic să aibă de unde copia', () => {
    const exemple = (actiunea('buletin.raspunde').exemple ?? []) as Array<{ fraza?: string; argumente?: Record<string, unknown> }>
    expect(exemple.length).toBeGreaterThanOrEqual(8)
    const cuArticol = exemple.filter((e) => e.argumente && 'articol' in e.argumente)
    expect(cuArticol.length).toBeGreaterThanOrEqual(3)
    const subiecte = exemple.map((e) => e.argumente?.subiect)
    for (const cerut of ['motto', 'moto_autor', 'titlu', 'autor', 'ani', 'pomenire', 'sursa', 'sterge_secundar', 'poza', 'de_la_capat']) {
      expect(subiecte, cerut).toContain(cerut)
    }
  })
})

// ---------------------------------------------------------------------------
// Ecranul `/nou` se împrospătează fără reîncărcare
// ---------------------------------------------------------------------------

describe('`GET /nou?bucata=schita` — numai blocul schiței', () => {
  it('întoarce fragmentul, nu pagina, și nu se ține în cache', async () => {
    const { env } = mediuBuletin({ depozit: { [cheiaSchitei(URMATOR)]: SCHITA_GATA } })
    const r = await cere(env, '/nou?bucata=schita')
    const text = await r.text()

    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(text.startsWith('<section class="schita" id="schita">')).toBe(true)
    expect(text).not.toContain('<!doctype')
    // ⚠️ aceeași funcție ca în pagină: ce se vede acolo se vede și aici
    expect(text).toContain('DESPRE RUGĂCIUNE')
    expect(text).toContain('Articolul secundar 2')
  })

  it('poarta e aceeași: cine nu ține buletinul nu capătă nici fragmentul', async () => {
    const { env } = mediuBuletin({ chei: [] })
    const r = await cere(env, '/nou?bucata=schita')
    expect(r.status).toBe(403)
    expect(await r.text()).toContain('Nu ai voie')
  })

  it('pagina întreagă poartă ascultătorul care cere fragmentul', async () => {
    const { env } = mediuBuletin({ depozit: { [cheiaSchitei(URMATOR)]: SCHITA_GATA } })
    const text = await (await cere(env, '/nou')).text()
    expect(text).toContain("window.addEventListener('xc-chat:raspuns'")
    expect(text).toContain("?bucata=schita")
    // și bula dă vestea la fiecare răspuns
    expect(text).toContain("dispatchEvent(new CustomEvent('xc-chat:raspuns'")
  })
})

// ---------------------------------------------------------------------------
// Bula
// ---------------------------------------------------------------------------

describe('bula: clema, trasul și lipirea', () => {
  /** ⚠️ Scriptul pleacă în pagină ca text: o greșeală de sintaxă s-ar vedea abia în browserul omului. */
  it('scriptul se compilează', () => {
    expect(() => new Function(JS_CHAT)).not.toThrow()
  })

  it('are cele trei feluri de a da un fișier', () => {
    expect(JS_CHAT).toContain("alege.addEventListener('change'")
    expect(JS_CHAT).toContain("panou.addEventListener('drop'")
    expect(JS_CHAT).toContain("camp.addEventListener('paste'")
  })

  it('micșorează poza în browser înainte s-o urce (telefoanele dau 8 MB pe poză)', () => {
    expect(JS_CHAT).toContain('LAT_POZA / Math.max(img.width, img.height)')
    expect(JS_CHAT).toContain("'image/jpeg', 0.82")
  })

  it('trimite multipart cu câmpul `fisier`, pe ruta de urcare', () => {
    expect(JS_CHAT).toContain("fd.append('fisier'")
    expect(JS_CHAT).toContain("prefix + '/chat/urca'")
  })

  it('după urcare mesajul pleacă singur, fără încă o apăsare', () => {
    expect(JS_CHAT).toContain('duMesajul(j.text)')
  })

  it('mesajele lungi se strâng în fir, cu „vezi tot"', () => {
    expect(JS_CHAT).toContain('STRANS_PESTE = 600, STRANS_CAT = 500')
    expect(JS_CHAT).toContain("cheie.textContent = intins ? 'vezi tot' : 'vezi mai puțin'")
  })

  /** ES5 dinadins, ca tot ce trimitem în pagină: fără `let`, fără săgeți. */
  it('rămâne ES5: fără `let`, fără `const`, fără săgeți', () => {
    expect(JS_CHAT).not.toMatch(/\blet\s/)
    expect(JS_CHAT).not.toMatch(/\bconst\s/)
    expect(JS_CHAT).not.toMatch(/=>/)
  })
})
