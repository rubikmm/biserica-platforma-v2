/**
 * TITLURILE CARE LIPSESC DIN BULETIN, luate de la SURSĂ (user, 16.09.2026: „ia-le de acolo").
 *
 * La 62 de articole buletinul n-a scris titlu: în locul lui stă NUMELE AUTORULUI („Părintele
 * Petroniu", „Pr. Pantelimon Șușnea"). Titlul adevărat există însă la sursă — în adresa ei și în
 * capul paginii —, deci se poate lua fără să inventăm nimic.
 *
 *   node infrastructure/import/chinonic/titluri-din-sursa.mjs           propune, nu scrie
 *   node infrastructure/import/chinonic/titluri-din-sursa.mjs --in=indreptari.json   scrie propunerea
 *
 * ⚠️ NU SCRIE ÎN BAZĂ. Scrie o PROPUNERE în `indreptari.json`, care se citește la fiecare extragere
 * (vezi `extrage.mjs`). Așa hotărârea omului supraviețuiește oricărei reimportări — altfel următoarea
 * rulare a extragerii ar pune la loc numele drept titlu. (Aceeași regulă ca la bibliotecă: unealta
 * propune, omul hotărăște, iar hotărârea stă într-un fișier, nu în baza care se rescrie.)
 *
 * ⚠️ ADRESA SURSEI SPUNE CARE e titlul, PAGINA spune CUM SE SCRIE. Adresa poartă cuvintele
 * articolului, dar fără diacritice și fără punctuație; capul paginii le are pe amândouă, dar pe lângă
 * titlu mai are și meniuri și titluri de alte articole. De aceea se caută în capetele paginii acela
 * care seamănă cel mai bine cu adresa: e singurul ales pe care nu-l facem noi.
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { ent } from './titlu-autor.mjs'

const BAZA = 'b970592e-85cd-4e07-b5dc-6abe9761098a' // xc-home-production
const IN = process.argv.find((a) => a.startsWith('--in='))?.slice(5)
const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

async function sql(comanda, params = []) {
  for (let i = 1; i <= 5; i++) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${BAZA}/query`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        body: JSON.stringify({ sql: comanda, params }),
        signal: AbortSignal.timeout(60000),
      })
      const j = await r.json()
      if (r.ok && j.success) return j.result
    } catch { /* se reincearca */ }
    if (i === 5) throw new Error('D1 nu raspunde')
    await new Promise((s) => setTimeout(s, 1000 * i))
  }
}

async function markdown(octeti, tip, nume) {
  const fd = new FormData()
  fd.append('files', new Blob([octeti], { type: tip }), nume)
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/ai/tomarkdown`, {
    method: 'POST', headers: { authorization: `Bearer ${jeton}` }, body: fd,
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok) throw new Error(`tomarkdown ${r.status}`)
  return (await r.json()).result?.[0]?.data ?? ''
}
/** ⚠️ `cuvantul-ortodox.ro` are lantul de certificat rupt — la cadere de TLS se cere pe http. */
async function iaPagina(u) {
  const o = {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; arhiva-parohie/1.0; +https://sfantul-ilie.ro)' },
    signal: AbortSignal.timeout(45000), redirect: 'follow',
  }
  try { return await fetch(u, o) } catch (e) {
    const p = String(e?.cause?.message ?? e?.cause?.code ?? e?.message ?? '')
    if (/certificate|CERT_|SSL|TLS|issuer/i.test(p) && u.startsWith('https://')) {
      return await fetch(u.replace(/^https:\/\//, 'http://'), o)
    }
    throw e
  }
}

const plat = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Titlul scris curat: fara marcaje markdown, fara adrese, fara coada de site. */
function curata(t) {
  let s = ent(t)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // coada pe care si-o pun site-urile: „… | Doxologia", „… - CrestinOrtodox.ro"
  s = s.replace(/\s*[|–—-]\s*(doxologia|cuv[âa]ntul ortodox|crestin ?ortodox(\.ro)?|basilica|pemptousia|acvila ?30|ortodoxinfo|pravila|aparatorul)\b.*$/i, '')
  return s.replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim()
}

/** Cate din cuvintele lungi ale adresei se regasesc in candidat (0…1). */
function seamanaCuAdresa(candidat, cale) {
  const aleCaii = [...new Set(plat(cale).split(' ').filter((w) => w.length >= 4))]
  if (!aleCaii.length) return 0
  const c = plat(candidat)
  return aleCaii.filter((w) => c.includes(w)).length / aleCaii.length
}

const NAVIGARE = /^(meniu|acasa|categorii|etichete|arhiva|comentarii|linkuri|contact|despre noi|donatii|abonare|sinaxar|cauta|search|actualitate|analize|anunturi)$/i

/**
 * Titlul articolului, din markdown-ul sursei. Se strang capetele (`#`…`###`) si randul `title:` din
 * fisa paginii, apoi se alege cel care seamana cel mai bine cu ADRESA — ea poarta titlul si nu poate
 * fi meniul site-ului. Numele autorului se scoate din cursa: el e tocmai ce vrem sa inlocuim.
 */
function titlulDin(md, cale, numeleAutorului) {
  const candidati = []
  const linii = md.split(/\r?\n/)
  for (const l of linii.slice(0, 160)) {
    const cap = /^#{1,3}\s+(.+)$/.exec(l)
    if (cap) candidati.push(curata(cap[1]))
    const fisa = /^title:\s*(.+)$/i.exec(l)
    if (fisa) candidati.push(curata(fisa[1]))
  }
  const bune = candidati.filter((t) =>
    t.length >= 10 && t.length <= 200 && !NAVIGARE.test(t) && plat(t) !== plat(numeleAutorului))
  if (!bune.length) return null
  const cuScor = bune.map((t) => ({ t, scor: seamanaCuAdresa(t, cale) }))
    .sort((a, b) => b.scor - a.scor || a.t.length - b.t.length)
  return cuScor[0].scor >= 0.35 ? cuScor[0] : null
}

/** Cand pagina nu da nimic: titlul se face din ADRESA ei. Fara diacritice — se vede si se indreapta. */
function titlulDinAdresa(cale) {
  const ultima = decodeURIComponent(cale).split('/').filter(Boolean).at(-1) ?? ''
  const fara = ultima.replace(/\.(pdf|html?|shtml|php)$/i, '')
  const cuvinte = fara.replace(/[._-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\d{4,}/g, ' ').replace(/\s+/g, ' ').trim()
  if (cuvinte.split(' ').length < 3) return null
  return cuvinte.charAt(0).toUpperCase() + cuvinte.slice(1)
}

// ---------------------------------------------------------------------------

/*
 * CINE INTRA LA INDREPTAT: rândurile fără autor al căror TITLU e de fapt un nume de om. Proba e
 * strânsă dinadins — un titlu adevărat („Cuvânt la Anul Nou", „Viața Sfântului…") nu se atinge.
 */
const CINSTE = /^(sf(â|a)nt(ul|a)|sf\.|cuvios(ul)?|p(ă|a)rintele|pr\.|preot(ul)?|protos\.|arhim\.|arhimandrit(ul)?|mitropolit(ul)?|episcop(ul)?|preasfin[țt]itul|stare[țt]ul|[ÎI]PS)(?!\p{L})/iu
const TITLU_ADEVARAT = /^(via[țt]a|vie[țt]ile|icoana|sinaxar|proloagele|pomenirea|acatistul|minunea|aducerea|soborul|mo[aă][sș]tele|cuv[âa]nt|predic[aă]|t[aă]lcuire|omilie|duminica|fericirile|despre)\b/i
const eNumeInLocDeTitlu = (t) => {
  const s = (t || '').trim()
  if (!s || TITLU_ADEVARAT.test(s)) return false
  const cuvinte = s.split(/\s+/)
  if (cuvinte.length > 5) return false
  return CINSTE.test(s) || (cuvinte.length <= 3 && cuvinte.every((c) => /^[\p{Lu}]/u.test(c)))
}

const [{ results: toate }] = await sql(
  "SELECT slug, titlu, autor, sursa_url, sursa_fel FROM texte_chinonic WHERE autor = '' AND titlu <> '' ORDER BY citit_la",
)
const deFacut = toate.filter((r) => eNumeInLocDeTitlu(r.titlu))
console.log(`de îndreptat: ${deFacut.length} (din ${toate.length} fără autor)`)
console.log(`  cu sursă: ${deFacut.filter((r) => r.sursa_url).length}\n`)

const propuneri = {}
let n = 0
for (const r of deFacut) {
  n++
  const cap = `${String(n).padStart(2)}/${deFacut.length} «${r.titlu}»`
  if (!r.sursa_url) { console.log(`${cap}\n     ✗ fără sursă — rămâne de mână`); continue }
  let cale = ''
  try { cale = new URL(r.sursa_url).pathname } catch { /* ramane gol */ }
  let ales = null
  let de_unde = ''
  try {
    const resp = await iaPagina(r.sursa_url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const octeti = Buffer.from(await resp.arrayBuffer())
    const ePdf = r.sursa_fel === 'pdf' || /application\/pdf/i.test(resp.headers.get('content-type') ?? '')
    const md = await markdown(octeti, ePdf ? 'application/pdf' : 'text/html', ePdf ? 'a.pdf' : 'a.html')
    const gasit = titlulDin(md, cale, r.titlu)
    if (gasit) { ales = gasit.t; de_unde = `pagină (${Math.round(gasit.scor * 100)}% cu adresa)` }
  } catch (e) {
    de_unde = `eroare: ${String(e.message).slice(0, 40)}`
  }
  if (!ales) {
    const dinAdresa = titlulDinAdresa(cale)
    if (dinAdresa) { ales = dinAdresa; de_unde = de_unde ? `${de_unde}; adresă` : 'adresă (fără diacritice)' }
  }
  if (!ales) { console.log(`${cap}\n     ✗ n-am găsit titlu (${de_unde || 'nimic în pagină'})`); continue }
  propuneri[r.slug] = { titlu: ales, autor: r.titlu, deUnde: de_unde, sursa: r.sursa_url }
  console.log(`${cap}\n     → «${ales}»\n       [${de_unde}]`)
}

console.log(`\ngăsite: ${Object.keys(propuneri).length} / ${deFacut.length}`)
if (!IN) { console.log('\n(fără --in=<fișier>) — nu s-a scris nimic.'); process.exit(0) }

const cale = new URL(IN, import.meta.url).pathname
const vechi = existsSync(cale) ? JSON.parse(readFileSync(cale, 'utf8')) : {}
// ⚠️ ce e deja scris de mana NU se rescrie: hotararea omului bate propunerea uneltei
for (const [slug, p] of Object.entries(propuneri)) if (!vechi[slug]) vechi[slug] = p
writeFileSync(cale, JSON.stringify(vechi, null, 1) + '\n')
console.log(`\nscris: ${cale} (${Object.keys(vechi).length} îndreptări)`)
