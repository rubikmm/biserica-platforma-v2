/**
 * Extragerea unei zile din forma bruta a calendarului oficial (campurile ACF ale WordPress-ului
 * de la calendar.patriarhia.ro) in randul structurat al tabelei `zile` + sinaxarul curatat.
 *
 * Folosit si de worker (`/admin/preia/<an>`), si de scriptul de import de pe masina
 * (`infrastructure/import/calendar-patriarhia.mjs`, prin type stripping-ul lui Node).
 * Doar sintaxa TypeScript stergibila: fara enum, fara namespace, fara parametri de proprietate.
 *
 * Regula de aur: TITLUL INTREG SE PASTREAZA ca la sursa (doar diacriticele aduse la virgula).
 */

export interface IntrareSursa {
  data?: string | null
  id?: number
  link?: string
  titlu?: string
  acf?: Record<string, unknown>
}

export interface RandZiExtras {
  data: string
  an: number
  luna: number
  zi: number
  zi_saptamana: number
  titlu: string
  titlu_html: string
  subtitlu: string
  cruce: string
  cruce_text: string
  zi_libera: number
  post: string
  perioada: string
  sambata_mortilor: string
  nunti: number
  parastase: number
  faza_lunii: string
  evanghelia: string
  apostolul: string
  sursa_id: number | null
  sursa_link: string
  preluat_la: string
}

const ENTITATI: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
}

export function dezHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m: string, n: string) => ENTITATI[n.toLowerCase()] ?? m)
}

/** Diacriticele cu sedila (ş ţ) devin cu virgula (ș ț) — cerinta contractului. */
export function virgula(s: string): string {
  return s.replaceAll('ş', 'ș').replaceAll('Ş', 'Ș').replaceAll('ţ', 'ț').replaceAll('Ţ', 'Ț')
}

export function curat(s: unknown): string {
  return virgula(dezHtml(s)).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

/** Text fara taguri. Tagurile inline nu lasa spatiu in urma („Domnului</span>;" ramane „Domnului;"). */
export function faraTaguri(html: unknown): string {
  return curat(String(html ?? '').replace(/<\/?(p|div|br|h\d|li|blockquote)\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+([;,.)])/g, '$1')
    .replace(/\(\s+/g, '(')
}

/**
 * Titlul cu marcajul sursei adus pe clasele temei. Raman doar <span> (culoarea), <strong> si <em>.
 * Culorile sursei: #e52b34 -> c-rosu, #1c58bb -> c-albastru.
 */
export function titluHtml(html: unknown): string {
  let s = String(html ?? '').replace(/\r?\n/g, ' ')
  s = s.replace(/<\/?h\d[^>]*>/gi, '')
  s = s.replace(/<span[^>]*color:\s*#?([0-9a-f]{6})[^>]*>/gi, (_, culoare: string) => {
    const c = culoare.toLowerCase()
    if (c === 'e52b34') return '<span class="c-rosu">'
    if (c === '1c58bb') return '<span class="c-albastru">'
    return '<span>'
  })
  s = s.replace(/<span(?![^>]*class=)[^>]*>/gi, '<span>')
  s = s.replace(/<(?!\/?(span|strong|em|b|i)\b)[^>]*>/gi, '')
  s = s.replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>').replace(/<i>/g, '<em>').replace(/<\/i>/g, '</em>')
  s = virgula(dezHtml(s)).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
  s = s.replace(/<span[^>]*>\s*<\/span>/g, '')
  s = s.replace(/\s+([;,.)])/g, '$1').replace(/\(\s+/g, '(')
  return s
}

/** Crucea zilei, din textul sursei: '' | 'duminica' | 'rosie' | 'albastra' | 'neagra'. */
export function cruceDin(text: unknown): { cruce: string; cruce_text: string } {
  const t = faraTaguri(text)
  if (!t || /nu se aplic/i.test(t)) return { cruce: '', cruce_text: '' }
  if (/duminic/i.test(t)) return { cruce: 'duminica', cruce_text: t }
  if (/ro[sș]ie/i.test(t)) return { cruce: 'rosie', cruce_text: t }
  if (/albastr/i.test(t)) return { cruce: 'albastra', cruce_text: t }
  if (/neagr/i.test(t)) return { cruce: 'neagra', cruce_text: t }
  return { cruce: '', cruce_text: t }
}

function optiuneAcf(v: unknown): string {
  const t = faraTaguri(v)
  return /^nicio op/i.test(t) || /^nu se aplic/i.test(t) ? '' : t
}

/** Referinta pericopei din blocul de titlu al sursei: 'Ev. Marcu 9, 33-41'. */
export function referintaDin(html: unknown): string {
  // Sursa are doua forme: <h1><span class="field-wrapper">Ev. …</span></h1> (2025) si
  // <h2><span style="color:#000">Ev. … (<em>…</em>)</span></h2> (2026). Luam primul cap nevid.
  const s = String(html ?? '')
  const re = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const t = faraTaguri(m[1])
    if (t) return t
  }
  return ''
}

/**
 * Sinaxarul, curatat: raman <h3>/<h4>/<p>/<strong>/<em>/<br>/<blockquote>/liste; randurile de text
 * simplu devin paragrafe. Fara atribute, fara scripturi, fara imagini.
 */
export function sinaxarCurat(html: unknown): string | null {
  if (!html) return null
  let s = String(html).replace(/\r\n?/g, '\n')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<figure[\s\S]*?<\/figure>/gi, '').replace(/<img[^>]*>/gi, '')
  s = s.replace(/<(h[1-6]|p|strong|em|b|i|br|ul|ol|li|blockquote)\b[^>]*>/gi, (_m, tag: string) => `<${tag.toLowerCase()}>`)
  s = s.replace(/<\/(h[1-6]|p|strong|em|b|i|ul|ol|li|blockquote)>/gi, (_m, tag: string) => `</${tag.toLowerCase()}>`)
  s = s.replace(/<(?!\/?(h[1-6]|p|strong|em|b|i|br|ul|ol|li|blockquote)\b)[^>]*>/gi, '')
  s = s.replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>').replace(/<i>/g, '<em>').replace(/<\/i>/g, '</em>')
  s = s.replace(/<h[12]>/g, '<h3>').replace(/<\/h[12]>/g, '</h3>')
  s = virgula(dezHtml(s)).replace(/ /g, ' ')
  const bucati = s
    .split(/\n+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (/^<(h[1-6]|p|ul|ol|li|blockquote)\b/i.test(r) ? r : `<p>${r}</p>`))
    .filter((r) => r !== '<p></p>')
  return bucati.join('\n') || null
}

export function dataDinAcf(acf: Record<string, unknown> | undefined, cadere: string | null): string | null {
  const d = String(acf?.['data-zilei'] ?? '')
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
  return cadere
}

/** O intrare a sursei -> randul de `zile` + sinaxarul. Arunca daca intrarea n-are data. */
export function extrageZi(z: IntrareSursa, preluat_la: string): { rand: RandZiExtras; sinaxar: string | null } {
  const acf = z.acf ?? {}
  const data = dataDinAcf(acf, z.data ?? null)
  if (!data) throw new Error(`intrare fara data (id ${z.id})`)
  const [an, luna, zi] = data.split('-').map(Number) as [number, number, number]
  const ziSapt = new Date(`${data}T00:00:00Z`).getUTCDay()
  const { cruce, cruce_text } = cruceDin(acf['crucea-zilei-acf'])
  const titluBrut = (acf['titlu-acf'] as string | undefined) || z.titlu || ''
  const zl = acf['zi-libera-acf']
  const rand: RandZiExtras = {
    data,
    an,
    luna,
    zi,
    zi_saptamana: ziSapt,
    titlu: faraTaguri(titluBrut),
    titlu_html: titluHtml(titluBrut),
    subtitlu: faraTaguri(acf['subtitlu-acf']),
    cruce,
    cruce_text,
    zi_libera: zl === true || zl === 'true' || zl === 1 ? 1 : 0,
    post: optiuneAcf(acf['informatii-post-acf']),
    perioada: optiuneAcf(acf['posturile-mari-perioade-speciale-acf']),
    sambata_mortilor: optiuneAcf(acf['sambatele-mortilor-acf']),
    nunti: acf['nunti-acf'] === true ? 1 : 0,
    parastase: acf['parastase-acf'] === true ? 1 : 0,
    faza_lunii: faraTaguri(acf['faza-lunii-titlu-acf']),
    evanghelia: referintaDin(acf['evanghelia-zilei-acf']),
    apostolul: referintaDin(acf['apostolul-zilei-acf']),
    sursa_id: typeof z.id === 'number' ? z.id : null,
    sursa_link: z.link ?? '',
    preluat_la,
  }
  return { rand, sinaxar: sinaxarCurat(acf['sinaxar-text-acf']) }
}

export function sqlValoare(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return `'${String(v).replaceAll("'", "''")}'`
}

/** Cele doua INSERT-uri (zile + texte) pentru o zi. */
export function sqlPentruZi(rand: RandZiExtras, sinaxar: string | null): string[] {
  const coloane = Object.keys(rand) as Array<keyof RandZiExtras>
  return [
    `INSERT OR REPLACE INTO zile (${coloane.join(', ')}) VALUES (${coloane.map((c) => sqlValoare(rand[c])).join(', ')});`,
    `INSERT OR REPLACE INTO texte (data, sinaxar, preluat_la) VALUES (${sqlValoare(rand.data)}, ${sqlValoare(sinaxar)}, ${sqlValoare(rand.preluat_la)});`,
  ]
}
