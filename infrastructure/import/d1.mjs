/**
 * Scriere in D1 cu PARAMETRI LEGATI — singura cale pentru texte lungi: `wrangler d1 execute --file`
 * refuza orice instructiune peste 100 KB (SQLITE_TOOBIG), iar sinaxarele trec de ea.
 *
 * Doua tinte, aceeasi interfata:
 *   - `local`: SQLite-ul lui miniflare din `.wrangler/state` (acelasi pe care il citeste `wrangler dev`),
 *     deschis cu `node:sqlite` (Node >= 22.13 / 24). Baza se recunoaste dupa o tabela-martor.
 *   - `staging`: API-ul REST al D1 (`/accounts/<cont>/d1/database/<id>/query`, cu `params`), cu
 *     tokenul din mediu (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, din /backup/_setup/cloudflare.env).
 *
 * Limitele D1 tinute minte aici: cel mult 100 de parametri pe instructiune; corpul unei cereri
 * REST sub ~1 MB e sigur.
 */
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RADACINA = new URL('../../', import.meta.url).pathname

export function bazaLocala(tabelaMartor) {
  const dir = join(RADACINA, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
  if (!existsSync(dir)) throw new Error(`nu exista ${dir} — ruleaza intai migratiile locale`)
  return import('node:sqlite').then(({ DatabaseSync }) => {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.sqlite')) continue
      const db = new DatabaseSync(join(dir, f))
      const are = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tabelaMartor)
      if (are) {
        return {
          fel: 'local',
          cale: join(dir, f),
          async ruleaza(sql, params = []) {
            return db.prepare(sql).run(...params)
          },
          async tranzactie(fn) {
            db.exec('BEGIN')
            try {
              await fn()
              db.exec('COMMIT')
            } catch (e) {
              db.exec('ROLLBACK')
              throw e
            }
          },
          inchide() {
            db.close()
          },
        }
      }
      db.close()
    }
    throw new Error(`nicio baza locala cu tabela ${tabelaMartor}`)
  })
}

export function bazaStaging(databaseId) {
  const cont = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!cont || !token) throw new Error('lipsesc CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN in mediu')
  const url = `https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${databaseId}/query`
  return {
    fel: 'staging',
    cale: url,
    async ruleaza(sql, params = []) {
      for (let incercare = 1; incercare <= 4; incercare++) {
        const r = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ sql, params }),
        })
        const j = await r.json().catch(() => ({}))
        if (r.ok && j.success) return j.result
        const mesaj = JSON.stringify(j.errors ?? j).slice(0, 400)
        if (incercare === 4 || (r.status < 500 && r.status !== 429)) throw new Error(`D1 API ${r.status}: ${mesaj}`)
        await new Promise((res) => setTimeout(res, 1500 * incercare))
      }
    },
    async tranzactie(fn) {
      // API-ul nu are tranzactii; scrierile sunt idempotente (INSERT OR REPLACE), deci se pot relua.
      await fn()
    },
    inchide() {},
  }
}

/**
 * INSERT OR REPLACE pe loturi. Doua plafoane, amandoua ale D1: cel mult 100 de parametri legati pe
 * instructiune si un corp de cerere sub ~500 KB (sinaxarele trec de 90 KB bucata).
 */
const OCTETI_PE_LOT = 400_000

export async function insereazaLoturi(baza, tabela, coloane, randuri, randuriPeLot = null) {
  const maxRanduri = randuriPeLot ?? Math.max(1, Math.floor(100 / coloane.length))
  const sql = (n) => `INSERT OR REPLACE INTO ${tabela} (${coloane.join(', ')}) VALUES ${Array.from({ length: n }, () => `(${coloane.map(() => '?').join(', ')})`).join(', ')}`
  let scrise = 0
  let lot = []
  let octeti = 0
  const scrie = async () => {
    if (!lot.length) return
    await baza.ruleaza(sql(lot.length), lot.flatMap((r) => coloane.map((c) => (r[c] === undefined ? null : r[c]))))
    scrise += lot.length
    lot = []
    octeti = 0
  }
  for (const rand of randuri) {
    const marime = coloane.reduce((n, c) => n + (typeof rand[c] === 'string' ? rand[c].length : 8), 0)
    if (lot.length && (lot.length >= maxRanduri || octeti + marime > OCTETI_PE_LOT)) await scrie()
    lot.push(rand)
    octeti += marime
  }
  await scrie()
  return scrise
}
