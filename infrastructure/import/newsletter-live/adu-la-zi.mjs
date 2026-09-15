/**
 * A8 · Aduce la zi arhiva newsletterului, din ce a scos `nl-pull.py` de pe live.
 *
 * Partea de CURATARE e adusa literă cu literă din V1 (`biserica-newsletter/unelte/prelucreaza.mjs`):
 * din emailul randat de MailPoet se scoate chenarul de email — preheaderul (pastrat ca „rezumat"),
 * banda „nu se vede corect?", dezabonarea si sigla MailPoet — si se rescriu adresele pozelor spre
 * `/media/…`. Ce ramane e continutul, exact cum a plecat. Nu se re-randeaza nimic: HTML-ul vine chiar
 * de la MailPoet (`newsletter_rendered_body`), ca cele 459 dinainte.
 *
 *   node infrastructure/import/newsletter-live/adu-la-zi.mjs            arata ce ar face, nu scrie
 *   node infrastructure/import/newsletter-live/adu-la-zi.mjs --chiar    scrie in R2
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 *
 * ⚠️ SCRIE IN `xc-newsletter-production` — arhiva vie. Doua plase:
 *   - `lista.json` si `cauta.json` se salveaza intai sub `.bak-<data>` CHIAR IN DEPOZIT, deci
 *     intoarcerea e o copiere, nu o reconstructie;
 *   - un numar care e deja in lista se SARE (dupa id), deci a doua rulare nu strica nimic.
 * ⚠️ Newsletterul n-are cron, deci nu se trezeste nimic peste datele proaspete.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const CHIAR = process.argv.includes('--chiar')
const INTRARE = process.argv.find((a) => a.startsWith('--din='))?.slice(6) ?? '/data/nl-live.json'
const GALEATA = process.argv.find((a) => a.startsWith('--in='))?.slice(5) ?? 'xc-newsletter-production'
const LIVE = 'https://sfantul-ilie.ro'

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

const adresa = (cheie) =>
  `https://api.cloudflare.com/client/v4/accounts/${cont}/r2/buckets/${GALEATA}/objects/${cheie
    .split('/').map(encodeURIComponent).join('/')}`

const TIPURI = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.pdf': 'application/pdf', '.css': 'text/css; charset=utf-8',
}
const tipul = (f) => TIPURI[path.extname(f).toLowerCase()] ?? 'application/octet-stream'

/* R2 striga „throttling" (429) daca scriem prea des — la 429 se asteapta mult mai mult decat la o
   eroare oarecare, si se incearca de cinci ori. (Lectia A12, 7 sept. 2026, adusa din V1.) */
async function pune(cheie, corp, tip) {
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(adresa(cheie), {
      method: 'PUT',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': tip },
      body: corp,
      signal: AbortSignal.timeout(120000),
    })
    if (r.ok) return
    const asteapta = r.status === 429 ? 5000 * i : 800 * i
    if (i === 5) throw new Error(`PUT ${cheie}: ${r.status} ${(await r.text()).slice(0, 160)}`)
    await new Promise((s) => setTimeout(s, asteapta))
  }
}

async function ia(cheie) {
  const r = await fetch(adresa(cheie), { headers: { authorization: `Bearer ${jeton}` } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`GET ${cheie}: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

// ---------------------------------------------------------------------------
// Curatarea, adusa din V1
// ---------------------------------------------------------------------------

const ENT = {
  acirc: 'â', Acirc: 'Â', icirc: 'î', Icirc: 'Î', abreve: 'ă', Abreve: 'Ă', scedil: 'ș', Scedil: 'Ș',
  tcedil: 'ț', Tcedil: 'Ț', amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  rsquo: '’', lsquo: '‘', ldquo: '„', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', bdquo: '„',
}
const entitati = (s) => s.replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))

/**
 * Scoate BANDA in care sta un semn — tot randul de continut, nu doar textul. Regexul nu poate:
 * tabelele de email sunt cuiburi de <tr> in <tr>, iar un `[\s\S]*?</tr>` s-ar opri la primul rand
 * dinauntru. Asa ca numaram deschiderile si inchiderile, luam toate randurile care cuprind semnul,
 * si il alegem pe cel mai strans care incepe cu o celula `mailpoet_content`.
 */
function scoateBanda(h, semn) {
  const i = h.indexOf(semn)
  if (i < 0) return h
  const re = /<tr\b[^>]*>|<\/tr\s*>/gi
  const stiva = [], cuprind = []
  let m
  while ((m = re.exec(h))) {
    if (m[0][1] === '/') {
      const s = stiva.pop()
      if (s === undefined) continue
      const sfarsit = m.index + m[0].length
      if (s < i && sfarsit > i) cuprind.push([s, sfarsit])
    } else stiva.push(m.index)
  }
  cuprind.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]))
  for (const [s, e] of cuprind) {
    if (/^<tr\b[^>]*>\s*<td[^>]*class="[^"]*mailpoet_content\b/i.test(h.slice(s, s + 400)))
      return h.slice(0, s) + h.slice(e)
  }
  return h
}

/**
 * ⚠️ SCOATE NUMARATOAREA MAILPOET (15.09.2026). HTML-ul pastrat in coada de trimitere nu e acelasi
 * cu cel re-randat: adresele sunt inlocuite cu urme de click, `[mailpoet_click_data]-<hash>`, iar la
 * sfarsit sta un punct de urmarire a deschiderii, `<img src="[mailpoet_open_data]">`. Amandoua
 * lucreaza numai intr-un email; intr-o arhiva de web sunt legaturi moarte si o poza lipsa.
 *
 * Adresele adevarate vin din `wp_mailpoet_newsletter_links` (`linkuri`, hash -> url), iar pentru
 * legaturile de abonare tabelul da inapoi CHIAR shortcode-urile V1 (`[link:subscription_…]`) — deci
 * dupa inlocuire HTML-ul arata exact ca in V1 si curatarea de mai jos merge neschimbata.
 *
 * ⚠️ `utm_source=mailpoet&…` se taie: cele 459 de numere din arhiva n-au asa ceva (verificat pe
 * `stiri/536.html`), fiindca ele s-au re-randat fara numaratoare. Fara taiere, numerele noi ar avea
 * alte adrese decat toate celelalte.
 */
function dezurmareste(html, linkuri) {
  let fara = 0
  let h = html.replace(/\[mailpoet_click_data\]-([a-f0-9]+)/gi, (m, hash) => {
    const u = linkuri[hash]
    if (!u) { fara++; return '#' }
    return u.replace(/[?&]utm_(?:source|medium|campaign|term|content|source_platform)=[^&"']*/gi, '')
      .replace(/\?$/, '')
  })
  // punctul de urmarire a deschiderii — o poza de 1 px care in arhiva n-ar da decat un 404
  h = h.replace(/<img[^>]*\[mailpoet_open_data\][^>]*>/gi, '')
  return { h, fara }
}

/** Adresele de poza/fisier din email, in ordinea in care apar. */
function adreseleMedia(h) {
  const gasite = new Set()
  for (const m of h.matchAll(/(?:src|href)="(https?:\/\/[^"]+\/wp-content\/[^"]+)"/gi)) gasite.add(m[1])
  return [...gasite]
}

/** Din adresa de pe live scoatem calea sub `wp-content/` — aceeasi cheie ca in V1. */
function cheiaMedia(u) {
  try {
    const p = new URL(u)
    const i = p.pathname.indexOf('/wp-content/')
    if (i < 0) return null
    return decodeURIComponent(p.pathname.slice(i + '/wp-content/'.length))
  } catch { return null }
}

/** Curata un numar si da fragmentul, rezumatul si textul de cautare. */
function curata(htmlIntreg, harta) {
  let h = htmlIntreg
  h = h.slice(h.indexOf('<body'))
  h = h.slice(h.indexOf('>') + 1, h.lastIndexOf('</body>'))
  h = h.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '')   // pomenile pentru Outlook
  h = h.replace(/<!--[\s\S]*?-->/g, '')

  // preheader: textul lui e cel mai bun rezumat al numarului — il luam si il scoatem
  let rezumat = ''
  h = h.replace(/<tr>\s*<td class="mailpoet_preheader"[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/i, (_, t) => {
    rezumat = entitati(t.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    return ''
  })

  // „Nu este afisat corect? Deschideti newsletterul intr-o fereastra browser." — intr-o arhiva de
  // web nu inseamna nimic: fereastra browser E pagina asta.
  const inainte = h.length
  h = scoateBanda(h, '[link:newsletter_view_in_browser_url]')
  const bandaScoasa = h.length !== inainte

  h = h.replace(/<a href="\[link:subscription_[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
  h = h.replace(/&nbsp;\|\s*(<br\s*\/?>)?/i, '')          // despartitorul ramas gol
  h = h.replace(/<a href="https:\/\/www\.mailpoet\.com[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
  h = h.replace(/\[link:[a-z_]+\]/gi, '#')                // orice shortcode scapat

  // cheile lungi intai: /2019/04/x.jpg n-are voie sa strice /2019/04/x.jpg?ver=2
  for (const u of Object.keys(harta).sort((a, b) => b.length - a.length)) {
    if (h.includes(u)) h = h.split(u).join(harta[u])
  }
  h = h.replace(/https?:\/\/192\.168\.1\.123:8453/g, LIVE) // legaturile spre site

  /* Randurile ramase goale se strang — DAR nu si distantierele: acelea sunt goale dinadins, tin
     aerul dintre bucatile newsletterului. */
  const gol = /<tr>\s*<td(?![^>]*mailpoet_spacer)[^>]*>\s*(<table[^>]*>\s*(<tbody>)?\s*<tr>\s*<td(?![^>]*mailpoet_spacer)[^>]*>\s*<\/td>\s*<\/tr>\s*(<\/tbody>)?\s*<\/table>)?\s*<\/td>\s*<\/tr>/g
  for (let i = 0; i < 3; i++) h = h.replace(gol, '')

  h = h.trim()
  const text = entitati(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  return { h, rezumat, text, bandaScoasa }
}

/** Numarul buletinului, cand subiectul il spune („nr. 571"); anunturile n-au. */
const numarulDin = (subiect) => {
  const m = /nr\.\s*(\d+)/i.exec(subiect)
  return m ? +m[1] : null
}

// ---------------------------------------------------------------------------
// Drumul
// ---------------------------------------------------------------------------

const adus = JSON.parse(readFileSync(INTRARE, 'utf8'))

/* ⚠️ `LEFT JOIN` peste `wp_mailpoet_sending_queues` da CATE UN RAND PE COADA, deci un numar cu doua
   cozi vine de doua ori (patit la prima tragere, 15.09.2026: nr. 571 a venit dublat). Se tine cel cu
   HTML-ul cel mai lung — o coada reluata poate avea randarea goala. */
const peId = new Map()
for (const n of adus.numere) {
  if (n.status !== 'sent' || !n.sent_at) continue
  const vechi = peId.get(n.id)
  if (!vechi || (n.html?.length ?? 0) > (vechi.html?.length ?? 0)) peId.set(n.id, n)
}
const venite = [...peId.values()].sort((a, b) => a.sent_at.localeCompare(b.sent_at))

const lista = JSON.parse((await ia('lista.json'))?.toString('utf8') ?? '[]')
const cauta = JSON.parse((await ia('cauta.json'))?.toString('utf8') ?? '[]')
const stiute = new Set(lista.map((f) => f.id))
const noi = venite.filter((n) => !stiute.has(n.id))

console.log(`in depozit: ${lista.length} numere (cel mai nou ${lista.at(-1)?.trimis ?? '—'})`)
console.log(`aduse de pe live: ${venite.length}, din care NOI: ${noi.length}`)
for (const n of venite) {
  console.log(`  ${stiute.has(n.id) ? 'stiut ' : 'NOU   '} ${n.id}  ${n.sent_at}  ${n.subject}`)
}
if (!noi.length) {
  console.log('\nnimic de adaugat — arhiva e la zi.')
  process.exit(0)
}
const faraHtml = noi.filter((n) => !n.html)
if (faraHtml.length) {
  console.error(`\n⚠️ ${faraHtml.length} numere NOI n-au HTML randat (${faraHtml.map((n) => n.id).join(', ')}).`)
  console.error('MailPoet il pastreaza doar pentru cele recente. Nu le pot adauga fara el — se opreste aici.')
  process.exit(2)
}

/* ⚠️ Intai se scoate numaratoarea, abia apoi se cauta media: cat timp adresele sunt urme de click,
   in HTML nu se vede niciun `/wp-content/`, deci pozele si PDF-urile ar fi trecut neobservate. */
const linkuri = adus.linkuri ?? {}
for (const n of noi) {
  const { h, fara } = dezurmareste(n.html, linkuri)
  n.html = h
  if (fara) console.error(`  ⚠️ ${n.id}: ${fara} urme de click fara adresa in tabel — scrise ca #`)
}

// ——— media: ce adrese cheama numerele noi, si care lipsesc din depozit
const harta = {}
const deAdus = []
for (const n of noi) {
  for (const u of adreseleMedia(n.html)) {
    const rel = cheiaMedia(u)
    if (!rel) continue
    harta[u] = `/media/${rel}`
    if (!deAdus.some((x) => x.rel === rel)) deAdus.push({ u, rel })
  }
}
const lipsa = []
for (const m of deAdus) {
  if (await ia(`media/${m.rel}`)) continue
  lipsa.push(m)
}
console.log(`\nmedia chemata: ${deAdus.length} fisiere, din care lipsesc din depozit: ${lipsa.length}`)
for (const m of lipsa) console.log(`  lipsa  ${m.rel}`)

// ——— fragmentele
const gata = []
for (const n of noi) {
  const { h, rezumat, text, bandaScoasa } = curata(n.html, harta)
  gata.push({
    fisa: {
      id: n.id,
      nr: numarulDin(n.subject),
      subiect: entitati(n.subject).replace(/^\s+/, ''),
      trimis: n.sent_at,
      rezumat,
      octeti: Buffer.byteLength(h),
    },
    h,
    text: text.slice(0, 6000),
  })
  console.log(`\nnr. ${numarulDin(n.subject)} · id ${n.id} · ${n.sent_at}`)
  console.log(`  fragment: ${Buffer.byteLength(h)} octeti (din ${Buffer.byteLength(n.html)} randati)`)
  console.log(`  rezumat : ${rezumat || '(gol)'}`)
  console.log(`  banda „nu se vede corect?": ${bandaScoasa ? 'scoasa' : '⚠️ NEGASITA'}`)
  console.log(`  text de cautare: ${text.length} semne`)
}

if (!CHIAR) {
  // fragmentele se scriu in /data ca sa se poata citi cu ochii inainte de a intra in arhiva
  for (const g of gata) writeFileSync(`/data/proba-${g.fisa.id}.html`, g.h)
  console.log(`\nfragmentele de probă: ${gata.map((g) => `/data/proba-${g.fisa.id}.html`).join(', ')}`)
  console.log('(fara --chiar) — nu s-a scris nimic in depozit.')
  process.exit(0)
}

// ——— plasa: copie de siguranta CHIAR IN DEPOZIT, langa original
const ziua = new Date().toISOString().slice(0, 10).replace(/-/g, '')
await pune(`lista.json.bak-${ziua}`, JSON.stringify(lista), TIPURI['.json'])
await pune(`cauta.json.bak-${ziua}`, JSON.stringify(cauta), TIPURI['.json'])
console.log(`\ncopii de siguranta: lista.json.bak-${ziua}, cauta.json.bak-${ziua}`)

// ——— media lipsa, luata de pe live
for (const m of lipsa) {
  const r = await fetch(m.u, { headers: { 'user-agent': 'arhiva-newsletter/2.0' } })
  if (!r.ok) { console.error(`  ⚠️ ${m.rel}: HTTP ${r.status} — sarit`); continue }
  const b = Buffer.from(await r.arrayBuffer())
  if (b.length < 300 && b.toString('latin1').toLowerCase().includes('<html')) {
    console.error(`  ⚠️ ${m.rel}: pagina de 404 in loc de fisier — sarit`)
    continue
  }
  await pune(`media/${m.rel}`, b, tipul(m.rel))
  console.log(`  urcat  media/${m.rel} (${b.length} octeti)`)
}

// ——— fragmentele si cele doua liste
for (const g of gata) {
  await pune(`stiri/${g.fisa.id}.html`, g.h, TIPURI['.html'])
  console.log(`  urcat  stiri/${g.fisa.id}.html`)
}
// lista se tine in ordinea trimiterii — cel mai vechi primul, cel mai nou ultimul (asa o citeste A8)
const listaNoua = [...lista, ...gata.map((g) => g.fisa)].sort((a, b) => a.trimis.localeCompare(b.trimis))
const cautaNoua = [...cauta, ...gata.map((g) => ({ id: g.fisa.id, t: g.text }))]
await pune('lista.json', JSON.stringify(listaNoua), TIPURI['.json'])
await pune('cauta.json', JSON.stringify(cautaNoua), TIPURI['.json'])
console.log(`\ngata: ${listaNoua.length} numere in arhiva (erau ${lista.length}).`)
writeFileSync('/data/nl-adaugate.json', JSON.stringify(gata.map((g) => g.fisa), null, 1))
