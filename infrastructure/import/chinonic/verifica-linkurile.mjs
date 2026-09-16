/**
 * Întreabă fiecare adresă de sursă dacă mai trăiește și scrie răspunsul în baza Website-ului.
 * De aici știe pagina dacă are voie să pună legătura: o adresă moartă nu se scrie (user, 16.09.2026
 * — „dacă e 404 acel url să nu se pună — așa știu că nu mai era valabil linkul").
 *
 *   node infrastructure/import/chinonic/verifica-linkurile.mjs            arata ce ar scrie
 *   node infrastructure/import/chinonic/verifica-linkurile.mjs --chiar    scrie in baza
 *   … --reia        numai cele neverificate inca (implicit se verifica toate)
 *   … --doar=<slug> o singura fisa
 *
 * ⚠️ NU se descarcă fișierul. Întâi HEAD; dacă gazda nu-l primește (405/403/501), GET cu
 * `Range: bytes=0-1023` și legătura se taie imediat ce au venit anteturile — altfel PDF-urile
 * parohiei (zeci de MB) s-ar trage degeaba.
 *
 * Stările scrise în `link_stare`:
 *   viu    — a răspuns 2xx (codul final, după redirectări)
 *   mort   — 404 sau 410: pagina nu mai există, legătura NU se mai scrie
 *   ocolit — 401/403/429 ori altă piedică: pagina poate fi vie, dar noi nu putem ști; legătura rămâne
 *   picat  — n-a răspuns deloc (DNS, TLS, timp expirat); legătura NU se scrie
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
const BAZA = 'b970592e-85cd-4e07-b5dc-6abe9761098a' // xc-home-production
const CHIAR = process.argv.includes('--chiar')
const RELUA = process.argv.includes('--reia')
const DOAR = process.argv.find((a) => a.startsWith('--doar='))?.slice(7)
const DEODATA = 6
const RABDARE_MS = 20000

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

async function sql(comanda, params = []) {
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${BAZA}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: comanda, params }),
    })
    const j = await r.json()
    if (r.ok && j.success) return j.result[0].results
    if (i === 5) throw new Error(`D1: ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 240)}`)
    await new Promise((s) => setTimeout(s, 1000 * i))
  }
}

/** Coloanele stării legăturii — se adaugă o singură dată, la prima rulare CU `--chiar`. */
if (CHIAR) {
  for (const [nume, fel] of [['link_stare', "TEXT NOT NULL DEFAULT ''"], ['link_cod', 'INTEGER NOT NULL DEFAULT 0'],
    ['link_verificat_la', "TEXT NOT NULL DEFAULT ''"]]) {
    try {
      await sql(`ALTER TABLE texte_chinonic ADD COLUMN ${nume} ${fel}`)
      console.log(`  + coloana ${nume}`)
    } catch (e) {
      if (!String(e.message).includes('duplicate column')) throw e
    }
  }
}

// browser obisnuit: cateva gazde (cloudflare, wordpress) dau 403 la cereri fara antetele astea
const ANTETE = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  'accept-language': 'ro-RO,ro;q=0.9,en;q=0.8',
}

function starea(cod) {
  if (cod >= 200 && cod < 300) return 'viu'
  if (cod === 404 || cod === 410) return 'mort'
  return 'ocolit'
}

/*
 * ⚠️ A DOUA ȘANSĂ — „n-a răspuns" NU înseamnă „nu mai există" (măsurat pe arhivă, 16.09.2026).
 * 18 adrese au picat la prima trecere, și aproape toate erau vii: `cuvantul-ortodox.ro` are lanțul de
 * certificate rupt (cod 20 la curl), `ortodoxism.ro` cade la strângerea de mână TLS, iar unele merg
 * numai pe `http`. Dacă am fi crezut prima încercare, am fi tăiat legături bune.
 * Aici se întreabă încă o dată, fără să se ceară certificat curat și, la nevoie, pe `http` — DOAR ca
 * să aflăm dacă pagina există. Nu se citește nimic din ea, deci certificatul prost nu ne poate păgubi.
 */
import { request as cerereHttps } from 'node:https'
import { request as cerereHttp } from 'node:http'

async function aDouaSansa(url, ramase = 4) {
  return await new Promise((gata) => {
    let adresa
    try { adresa = new URL(url) } catch { return gata({ cod: 0 }) }
    const cerere = (adresa.protocol === 'http:' ? cerereHttp : cerereHttps)(adresa, {
      method: 'GET', headers: ANTETE, rejectUnauthorized: false, timeout: RABDARE_MS,
    }, (r) => {
      const cod = r.statusCode ?? 0
      r.destroy() // nu ne trebuie corpul, doar codul
      if ([301, 302, 303, 307, 308].includes(cod) && r.headers.location && ramase > 0) {
        return gata(aDouaSansa(new URL(r.headers.location, adresa).href, ramase - 1))
      }
      gata({ cod })
    })
    cerere.on('timeout', () => { cerere.destroy(); gata({ cod: 0 }) })
    cerere.on('error', () => gata({ cod: 0 }))
    cerere.end()
  })
}

/** Ce se face când `fetch` a picat: încă o dată fără certificat curat, apoi pe `http`. */
async function inca(url, deCe) {
  let r = await aDouaSansa(url)
  if (!r.cod && url.startsWith('https://')) r = await aDouaSansa('http://' + url.slice(8))
  if (!r.cod) return { cod: 0, stare: 'picat', de_ce: deCe }
  return { cod: r.cod, stare: starea(r.cod), de_ce: `${deCe} → a doua șansă ${r.cod}` }
}

async function intreaba(url) {
  for (const fel of ['HEAD', 'GET']) {
    const taie = AbortSignal.timeout(RABDARE_MS)
    try {
      const r = await fetch(url, {
        method: fel,
        redirect: 'follow',
        signal: taie,
        headers: fel === 'GET' ? { ...ANTETE, range: 'bytes=0-1023' } : ANTETE,
      })
      // ⚠️ corpul se inchide fara sa fie citit: nu ne trebuie continutul, doar codul
      if (fel === 'GET') await r.body?.cancel().catch(() => {})
      // gazda care nu primeste HEAD: se reincearca cu GET, nu se scrie „ocolit" degeaba
      if (fel === 'HEAD' && [403, 405, 501, 400, 429].includes(r.status)) continue
      return { cod: r.status, stare: starea(r.status), unde: r.url !== url ? r.url : '' }
    } catch (e) {
      if (fel === 'HEAD') continue
      return await inca(url, String(e.message).slice(0, 40))
    }
  }
  return await inca(url, 'fara raspuns')
}

// la o rulare fara `--chiar`, inainte de prima scriere, coloanele pot sa nu existe inca
const coloane = (await sql('PRAGMA table_info(texte_chinonic)')).map((c) => c.name)
const unde = [`sursa_url <> ''`]
if (RELUA && coloane.includes('link_stare')) unde.push(`link_stare = ''`)
// `--picate`: numai cele care n-au raspuns ori au fost ocolite, pentru a doua trecere
if (process.argv.includes('--picate') && coloane.includes('link_stare')) unde.push(`link_stare IN ('picat','ocolit')`)
if (DOAR) unde.push(`slug = '${DOAR.replace(/'/g, "''")}'`)
const randuri = await sql(`SELECT slug, titlu, sursa_url, sursa_fel, stare_text
  FROM texte_chinonic WHERE ${unde.join(' AND ')} ORDER BY citit_la DESC`)

console.log(`de întrebat: ${randuri.length} adrese${CHIAR ? '' : '  (fara --chiar: nu se scrie nimic)'}\n`)

const socoteala = { viu: 0, mort: 0, ocolit: 0, picat: 0 }
const morti = []
let gata = 0

async function unaSingura(t) {
  const rez = await intreaba(t.sursa_url)
  socoteala[rez.stare]++
  if (rez.stare === 'mort' || rez.stare === 'picat') morti.push({ ...t, ...rez })
  if (CHIAR) {
    await sql(`UPDATE texte_chinonic SET link_stare = ?, link_cod = ?, link_verificat_la = datetime('now')
               WHERE slug = ?`, [rez.stare, rez.cod, t.slug])
  }
  const semn = { viu: '✓', mort: '✗', ocolit: '?', picat: '!' }[rez.stare]
  console.log(`${semn} ${String(++gata).padStart(3)}/${randuri.length} ${String(rez.cod).padStart(3)} ` +
    `${t.slug.slice(0, 44).padEnd(44)} ${rez.de_ce ?? ''}`)
}

for (let i = 0; i < randuri.length; i += DEODATA) {
  await Promise.all(randuri.slice(i, i + DEODATA).map(unaSingura))
}

console.log(`\ngata: ${socoteala.viu} vii · ${socoteala.mort} moarte · ${socoteala.ocolit} ocolite · ${socoteala.picat} picate`)
if (morti.length) {
  console.log(`\nadrese care NU se mai scriu în pagină (${morti.length}):`)
  for (const m of morti) console.log(`  ${String(m.cod).padStart(3)} · ${m.titlu?.slice(0, 60) ?? m.slug}\n        ${m.sursa_url}`)
}
if (!CHIAR) console.log('\n(fara --chiar) — nu s-a scris nimic in baza.')
