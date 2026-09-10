/**
 * Titlul calendarului oficial, desfacut: segmente cu culoarea lor, etichete scoase din
 * paranteze (randuiala zilei nu e numele zilei), numele duminicii, sfintii cu semnul si rangul
 * lor, citirile, glasul si voscreasna.
 *
 * Regula de aur: din titlu se scoate DOAR ce e recunoscut; ce nu se potriveste cu niciun tipar
 * ramane neatins. Titlul intreg ramane in `titlu`; tot ce e aici e interpretare.
 */

export type Culoare = 'rosu' | 'albastru' | null

export interface Segment {
  text: string
  culoare: Culoare
}

export type FelEticheta = 'post' | 'aliturgica' | 'perioada' | 'morti' | 'slujba' | 'libera'
export interface Eticheta {
  text: string
  fel: FelEticheta
}
const ORDINE_FEL: Record<FelEticheta, number> = { post: 1, aliturgica: 2, perioada: 3, morti: 4, slujba: 5, libera: 6 }

export type Semn = '(†)' | '†)' | '†' | null

export interface Sfant {
  nume: string
  semn: Semn
  culoare: Culoare
}

export interface Desfacere {
  /** Segmentele ramase (fara etichete), cu culorile lor — din ele se face titlul curat. */
  segmente: Segment[]
  etichete: Eticheta[]
  /** Numele duminicii („Duminica a 14-a după Rusalii") sau al zilei mari („Sfânta și Marea Vineri"). */
  denumire: string | null
  denumireCuloare: Culoare
  sfinti: Sfant[]
  /** Citirile, asa cum le scrie sursa: „Ap. 2 Corinteni 1, 21-24; 2, 1-4", „al Ierarhului: Evrei 7, 26-28". */
  citiri: string[]
  glas: number | null
  voscr: number | null
  /** Ce n-a incaput nicaieri (nu se pierde). */
  note: string[]
}

// ---------------------------------------------------------------------------
// Din HTML in segmente colorate
// ---------------------------------------------------------------------------

/** Indreptari de punctuatie pe care sursa le greseste din cand in cand — la fel pe text si pe HTML. */
export function indreaptaPunctuatia(s: string): string {
  // Intre semnul gresit si „Duminica" pot sta taguri (sursa coloreaza separat numele duminicii).
  const T = '((?:\\s*<[^>]*>)*)'
  return s
    .replace(new RegExp(`:${T}\\s+(?=Duminica\\b)`, 'g'), ';$1 ')
    .replace(new RegExp(`([a-zăâîșț])((?:\\s*<[^>]*>)*\\s*)(?=Duminica (a |întâi|dinaintea|după|Înfricoș|Izgonirii))`, 'g'), '$1;$2 ')
    .replace(new RegExp(`\\.${T}\\s*(?=Toate ale praznicului:)`, 'g'), ';$1 ')
    .replace(/(\d)-\s+(\d)/g, '$1-$2')
}

/**
 * Sparge titlul HTML in segmente pe „;", tinand minte culoarea in care sta fiecare caracter.
 * Referintele taiate in doua de un „;" („Ap. 1 Corinteni 8, 8-13; 9, 1-2") se lipesc la loc.
 */
export function segmenteDinHtml(titluHtml: string): Segment[] {
  const s = indreaptaPunctuatia(titluHtml)
  const stiva: Culoare[] = []
  const litere: Array<{ c: string; culoare: Culoare }> = []
  const re = /<[^>]*>|[^<]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const t = m[0]
    if (t.startsWith('<')) {
      if (/^<span\b/i.test(t)) {
        stiva.push(/c-rosu/.test(t) ? 'rosu' : /c-albastru/.test(t) ? 'albastru' : null)
      } else if (/^<\/span/i.test(t)) {
        stiva.pop()
      }
      continue
    }
    const culoare = [...stiva].reverse().find((c) => c !== null) ?? null
    for (const c of t) litere.push({ c, culoare })
  }
  const segmente: Segment[] = []
  let curent: Array<{ c: string; culoare: Culoare }> = []
  const inchide = () => {
    const text = curent.map((l) => l.c).join('').replace(/\s+/g, ' ').trim()
    if (text) {
      const prima = curent.find((l) => l.c.trim() !== '')
      segmente.push({ text, culoare: prima?.culoare ?? null })
    }
    curent = []
  }
  for (const l of litere) {
    if (l.c === ';') inchide()
    else curent.push(l)
  }
  inchide()
  // referinte taiate de „;": un segment care incepe cu cifre continua referinta dinainte
  const lipite: Segment[] = []
  for (const seg of segmente) {
    const ultim = lipite[lipite.length - 1]
    if (ultim && /^\d+([,\s-]|$)/.test(seg.text) && /\d/.test(ultim.text)) {
      ultim.text = `${ultim.text}; ${seg.text}`
    } else {
      lipite.push({ ...seg })
    }
  }
  return lipite
}

export function segmenteDinText(titlu: string): Segment[] {
  return segmenteDinHtml(titlu.replace(/</g, '&lt;'))
}

// ---------------------------------------------------------------------------
// Etichete: ce sta in paranteza si nu e numele zilei
// ---------------------------------------------------------------------------

const PRESCURTARI = /(?:^|\s)(Sf|Ap|Ier|Cuv|Mc|Ev|Arh|Ep|Pr|Mart|Prot|Mari|Sfinț)\.$/

/** Sparge continutul unei paranteze la „. ", dar nu dupa prescurtari. */
export function bucatileParantezei(continut: string): string[] {
  const brute = continut.split(/\.\s+/)
  const iesire: string[] = []
  for (const b of brute) {
    const ultim = iesire[iesire.length - 1]
    if (ultim !== undefined && PRESCURTARI.test(`${ultim}.`)) iesire[iesire.length - 1] = `${ultim}. ${b}`
    else iesire.push(b)
  }
  return iesire.map((b) => b.trim()).filter(Boolean)
}

function felul(text: string): FelEticheta | null {
  const t = text.replace(/\.$/, '')
  if (/^(Dezlegare la .+|Harți|Post)$/i.test(t)) return 'post'
  if (/^Zi aliturgică$/i.test(t)) return 'aliturgica'
  if (/^(Sâmbăta celor adormiți.*|Pomenirea celor adormiți)$/i.test(t)) return 'morti'
  if (/^(Începutul (Postului|Triodului).*|Lăsatul secului pentru .+)$/i.test(t)) return 'perioada'
  if (/^(Denie|Denia .+|Canonul Mare|Tedeum|Priveghere|Acatistul .+|Rugăciunea lui Iisus|Slujb[aă] la cumpăna dintre ani)$/i.test(t)) return 'slujba'
  return null
}

/** Radacina unui text, ca „Postul" si „Postului" sa fie una. */
export function radacina(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zăâîșț0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => c.replace(/(ului|lui|ul|le|a)$/, ''))
    .join(' ')
}

function adaugaEticheta(lista: Eticheta[], e: Eticheta): void {
  const r = radacina(e.text)
  const geaman = lista.findIndex((x) => x.fel === e.fel && (radacina(x.text) === r || radacina(x.text).includes(r) || r.includes(radacina(x.text))))
  if (geaman >= 0) {
    // ramane cea mai precisa (mai lunga)
    if (e.text.length > lista[geaman]!.text.length) lista[geaman] = e
    return
  }
  lista.push(e)
}

/**
 * Scoate din segmente ce e randuiala zilei, nu numele ei. Intoarce segmentele curatate si etichetele.
 */
export function scoateEtichetele(segmente: Segment[]): { segmente: Segment[]; etichete: Eticheta[] } {
  const etichete: Eticheta[] = []
  const iesire: Segment[] = []
  segmente.forEach((seg, i) => {
    let text = seg.text
    // primul segment: Odovania / Inainte-praznuirea devin eticheta
    if (i === 0 && /^(Odovania praznicului .+|Odovania .+|Înainte-prăznuirea .+)$/.test(text.replace(/\s*\([^)]*\)\s*$/, ''))) {
      const m = /^(.*?)(\s*\(([^)]*)\))?$/.exec(text)
      const nume = (m?.[1] ?? text).trim()
      adaugaEticheta(etichete, { text: nume, fel: 'perioada' })
      const paranteza = m?.[3]
      text = paranteza ? `(${paranteza})` : ''
      if (!text) return
    }
    // parantezele: fiecare bucata recunoscuta devine eticheta
    text = text.replace(/\(([^()]*)\)/g, (tot, continut: string) => {
      const bucati = bucatileParantezei(continut)
      const ramase: string[] = []
      for (const b of bucati) {
        const fel = felul(b)
        if (fel) adaugaEticheta(etichete, { text: b.replace(/\.$/, ''), fel })
        else ramase.push(b)
      }
      if (ramase.length === bucati.length) return tot
      return ramase.length ? `(${ramase.join('. ')})` : ''
    })
    text = text.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim()
    if (text) iesire.push({ text, culoare: seg.culoare })
  })
  return { segmente: iesire, etichete }
}

/** Etichetele din campurile scurte ale randului, puse langa cele din titlu (fara dubluri). */
export function etichetelePeCampuri(
  etichete: Eticheta[],
  campuri: { post: string; perioada: string; sambata_mortilor: string; zi_libera: number | boolean },
): Eticheta[] {
  const lista = [...etichete]
  if (campuri.post) adaugaEticheta(lista, { text: campuri.post, fel: 'post' })
  if (campuri.perioada) adaugaEticheta(lista, { text: campuri.perioada, fel: 'perioada' })
  if (campuri.sambata_mortilor) adaugaEticheta(lista, { text: campuri.sambata_mortilor, fel: 'morti' })
  if (campuri.zi_libera) adaugaEticheta(lista, { text: 'Zi liberă', fel: 'libera' })
  return lista.sort((a, b) => ORDINE_FEL[a.fel] - ORDINE_FEL[b.fel])
}

// ---------------------------------------------------------------------------
// Desfacerea: duminica, sfinti, citiri, glas
// ---------------------------------------------------------------------------

export function semnul(text: string): { semn: Semn; nume: string } {
  const t = text.trim()
  if (t.startsWith('(†)')) return { semn: '(†)', nume: t.slice(3).trim() }
  if (t.startsWith('†)')) return { semn: '†)', nume: t.slice(2).trim() }
  if (t.startsWith('†')) return { semn: '†', nume: t.slice(1).trim() }
  return { semn: null, nume: t }
}

const CITIRE = /^(Ap\.|Ev\.|Apostolul|Evanghelia|Toate ale praznicului:|(al|a|ale) [A-ZȘȚĂÂÎ][^:]{0,60}:\s)/

export function desfaSegmentele(segmente: Segment[]): Desfacere {
  const d: Desfacere = {
    segmente,
    etichete: [],
    denumire: null,
    denumireCuloare: null,
    sfinti: [],
    citiri: [],
    glas: null,
    voscr: null,
    note: [],
  }
  for (const seg of segmente) {
    const text = seg.text
    if (/^Duminica\b/.test(text) && !d.denumire) {
      d.denumire = text.replace(/\.$/, '')
      d.denumireCuloare = seg.culoare
      continue
    }
    if (CITIRE.test(text)) {
      d.citiri.push(text.replace(/^Toate ale praznicului:\s*/, ''))
      continue
    }
    const g = /^glas\s*(\d)(?:\s*,\s*voscr\D*(\d+))?\.?$/i.exec(text)
    if (g) {
      d.glas = Number(g[1])
      d.voscr = g[2] ? Number(g[2]) : null
      continue
    }
    if (/^Sfânta și Marea (Luni|Marți|Miercuri|Joi|Vineri|Sâmbătă)/.test(text) && !d.denumire) {
      d.denumire = text
      d.denumireCuloare = seg.culoare
      continue
    }
    const { semn, nume } = semnul(text)
    if (nume) d.sfinti.push({ nume, semn, culoare: seg.culoare })
  }
  return d
}

/** Desfacerea completa a unui titlu HTML (sau text), cu etichetele scoase. */
export function desfaTitlul(titluHtml: string): Desfacere {
  const { segmente, etichete } = scoateEtichetele(segmenteDinHtml(titluHtml))
  const d = desfaSegmentele(segmente)
  d.etichete = etichete
  return d
}

// ---------------------------------------------------------------------------
// Inapoi la text si HTML
// ---------------------------------------------------------------------------

export function esc(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export function textDinSegmente(segmente: Segment[]): string {
  return segmente.map((s) => s.text).join('; ')
}

/**
 * HTML-ul titlului din segmente. In zilele de rand, rosul ramane doar pe segmentele cu cruce si pe
 * continuarile lor („roșul-crucii"); duminica nu se atinge — acolo rosul intreg e al sursei. Albastrul
 * nu se atinge niciodata.
 */
export function htmlDinSegmente(segmente: Segment[], eDuminica: boolean): string {
  return segmente
    .map((s, i) => {
      let culoare = s.culoare
      if (!eDuminica && culoare === 'rosu') {
        const areCruce = /†/.test(s.text)
        const continuare = /^(\(|și\b)/.test(s.text) || (i > 0 && /\([^)]*$/.test(segmente[i - 1]!.text))
        if (!areCruce && !continuare) culoare = null
      }
      const text = esc(s.text)
      if (culoare === 'rosu') return `<span class="c-rosu">${text}</span>`
      if (culoare === 'albastru') return `<span class="c-albastru">${text}</span>`
      return text
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// Pericope: forma canonica
// ---------------------------------------------------------------------------

const ROMANE: Record<string, string> = { I: '1', II: '2', III: '3' }

/** „Ap. II Corinteni 1, 21-24 (…)" -> „2 Corinteni 1, 21-24". Fara prefix, fara cifre romane, fara paranteza. */
export function canonizeazaReferinta(ref: string): string {
  let s = ref
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(Toate ale praznicului:\s*)?/, '')
    .replace(/^\s*(Ap\.|Ev\.|Apostolul|Evanghelia)\s*/i, '')
    .replace(/^[^:]{0,60}:\s*/, '')
    .replace(/\b(I{1,3})\s+(?=[A-ZȘȚĂÂÎ])/g, (_, r: string) => `${ROMANE[r] ?? r} `)
    .replace(/(\d)-\s+(\d)/g, '$1-$2')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  s = s.replace(/[;.,]\s*$/, '')
  return s
}

/** Prima citire de un fel („Ap." sau „Ev.") dintr-o lista de citiri, canonizata. */
export function pericopaDin(citiri: string[], fel: 'Ap' | 'Ev'): string | null {
  const re = fel === 'Ap' ? /^(Ap\.|Apostolul)/ : /^(Ev\.|Evanghelia)/
  for (const c of citiri) {
    const bucati = c.split(/;\s*(?=(?:Ap\.|Ev\.)\s)/)
    for (const b of bucati) {
      if (re.test(b)) {
        const can = canonizeazaReferinta(b)
        if (can) return can
      }
    }
  }
  return null
}
