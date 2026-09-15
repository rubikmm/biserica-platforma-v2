#!/usr/bin/env node
/**
 * CURATENIA DE LA FINAL: sterge de la Cloudflare ce nu mai are ce cauta acolo.
 *
 *   node infrastructure/cutover/curatenie-cloudflare.mjs --v1        # ce e V1 (fara prefixul `xc-`)
 *   node infrastructure/cutover/curatenie-cloudflare.mjs --staging   # mediul de staging, cu totul
 *   … adauga `--chiar` ca sa se si stearga. Fara el doar arata lista.
 *
 * ⚠️ POARTA: nu se sterge NIMIC care nu se gaseste in arhiva de pe NAS (`backup-syno.mjs`). Pentru
 * fiecare baza D1 se cere `d1/<nume>.sql`, pentru fiecare depozit R2 un dosar `r2/<nume>`. Daca
 * lipseste ceva, unealta se opreste si spune ce. Regula utilizatorului, 14.09.2026: intai backup pe
 * Synology la tot ce nu se gaseste pe git, abia apoi curatenie.
 *
 * ⚠️ CE NU SE ATINGE, NICIODATA:
 *   - depozitul `biserica-transmisiuni` (11 GB): refolosit dinadins de V2, abatere stiuta de la `xc-`;
 *   - spatiul KV `CONFIG-production`: e configuratia VIE a productiei, doar ca a ramas fara prefix
 *     (de redenumit in `xc-config-production`; pana atunci, lista alba de mai jos il apara).
 *
 * Ordinea contează: intai se dezleaga adresele (ca sa nu ramana un hostname aratand spre gol), apoi
 * workerii, apoi datele. Un depozit R2 nu se poate sterge plin, deci obiectele se sterg intai —
 * cel mult 4 deodata, cu rabdare la 429, ca la copiere.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CHIAR = process.argv.includes('--chiar')
const CE = process.argv.includes('--staging') ? 'staging' : process.argv.includes('--v1') ? 'v1' : null
const arg = (n, implicit = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : implicit
}
const ARHIVA = arg('arhiva', `/backup/_arhiva-cloudflare/${new Date().toISOString().slice(0, 10)}`)

if (!CE) {
  console.error('spune ce curat: --v1 sau --staging (si --chiar ca sa se stearga cu adevarat)')
  process.exit(2)
}

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste tokenul: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

/*
 * Ce nu se sterge niciodata, oricat de mult ar semana cu V1 — pe FELURI, nu pe nume: `biserica-
 * transmisiuni` e si worker (pleaca), si depozit R2 (ramane). Un singur set le-ar confunda.
 */
const NEATINSE_R2 = new Set(['biserica-transmisiuni'])
const NEATINSE_KV = new Set(['CONFIG-production'])

const api = async (cale, init) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}${cale}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, ...(init?.headers ?? {}) },
  })
  if (r.status === 429) {
    const asteapta = Number(r.headers.get('retry-after') ?? 5)
    await new Promise((g) => setTimeout(g, asteapta * 1000))
    return api(cale, init)
  }
  const d = await r.json().catch(() => ({ success: r.ok }))
  if (!d.success) throw new Error(`${cale}: ${JSON.stringify(d.errors ?? d).slice(0, 180)}`)
  return d.result
}

const eV1 = (n) => !n.startsWith('xc-')
const eStaging = (n) => n.endsWith('-staging')
const alege = CE === 'v1' ? eV1 : eStaging

// ---------------------------------------------------------------- ce avem si ce pleaca
const [workeri, domenii, baze, galeti, spatii, gateways] = await Promise.all([
  api('/workers/scripts'),
  api('/workers/domains?per_page=200'),
  api('/d1/database?per_page=100'),
  api('/r2/buckets?per_page=100').then((r) => r.buckets ?? r),
  api('/storage/kv/namespaces?per_page=100'),
  api('/ai-gateway/gateways').catch(() => []),
])

const deSters = {
  domenii: domenii.filter((d) => alege(d.service)),
  workeri: workeri.map((w) => w.id).filter(alege),
  baze: baze.filter((b) => alege(b.name)),
  galeti: galeti.map((b) => b.name).filter((n) => alege(n) && !NEATINSE_R2.has(n)),
  spatii: spatii.filter((k) => alege(k.title) && !NEATINSE_KV.has(k.title)),
  // Poarta AI Gateway ramane UNA singura, `xc-chat`; cea a V1 (`biserica`) pleaca, cu loguri cu tot.
  gateways: CE === 'v1' ? gateways.map((g) => g.id).filter((g) => !g.startsWith('xc-')) : [],
}

console.log(`Curatenie ${CE.toUpperCase()} — ${CHIAR ? 'SE STERGE' : 'doar arat (fara --chiar)'}`)
console.log(`  adrese:    ${deSters.domenii.map((d) => d.hostname).join(', ') || '—'}`)
console.log(`  workeri:   ${deSters.workeri.join(', ') || '—'}`)
console.log(`  baze D1:   ${deSters.baze.map((b) => b.name).join(', ') || '—'}`)
console.log(`  depozite:  ${deSters.galeti.join(', ') || '—'}`)
console.log(`  spatii KV: ${deSters.spatii.map((k) => k.title).join(', ') || '—'}`)
console.log(`  gateway:   ${deSters.gateways.join(', ') || '—'}`)

// ---------------------------------------------------------------- poarta: arhiva de pe NAS
const lipsesc = []
for (const b of deSters.baze) {
  const f = join(ARHIVA, 'd1', `${b.name}.sql`)
  if (!existsSync(f)) lipsesc.push(f)
}
for (const g of deSters.galeti) {
  const d = join(ARHIVA, 'r2', g)
  if (!existsSync(d) || readdirSync(d).length === 0) lipsesc.push(`${d}/ (gol sau lipsa)`)
}
if (lipsesc.length > 0) {
  console.log(`\n⚠️ POARTA INCHISA — lipsesc din arhiva ${ARHIVA}:`)
  for (const l of lipsesc) console.log(`  ${l}`)
  console.log('Ruleaza intai backup-syno.mjs. Nu s-a sters nimic.')
  process.exit(1)
}
console.log(`\nPoarta: arhiva ${ARHIVA} acopera tot ce pleaca. ✓`)

if (!CHIAR) {
  console.log('Fara --chiar nu se sterge nimic.')
  process.exit(0)
}

// ---------------------------------------------------------------- stergerea, in ordine
let esecuri = 0
const incearca = async (ce, f) => {
  process.stdout.write(`  ${ce} … `)
  try {
    await f()
    console.log('sters')
  } catch (e) {
    esecuri++
    console.log(`ESUAT (${String(e.message).slice(0, 140)})`)
  }
}

console.log('\n1. adresele')
for (const d of deSters.domenii) {
  await incearca(d.hostname, () => api(`/workers/domains/${d.id}`, { method: 'DELETE' }))
}

console.log('2. workerii')
for (const w of deSters.workeri) {
  await incearca(w, () => api(`/workers/scripts/${w}?force=true`, { method: 'DELETE' }))
}

console.log('3. bazele D1')
for (const b of deSters.baze) {
  await incearca(b.name, () => api(`/d1/database/${b.uuid}`, { method: 'DELETE' }))
}

console.log('4. depozitele R2 (intai obiectele)')
for (const g of deSters.galeti) {
  process.stdout.write(`  ${g} … `)
  try {
    let n = 0
    for (;;) {
      const lista = await api(`/r2/buckets/${g}/objects?per_page=1000`)
      const obiecte = lista.objects ?? lista
      if (obiecte.length === 0) break
      // Cel mult 4 deodata: acelasi prag ca la copiere, din aceeasi pricina (429 / cod 971).
      for (let i = 0; i < obiecte.length; i += 4) {
        await Promise.all(
          obiecte.slice(i, i + 4).map((o) =>
            api(`/r2/buckets/${g}/objects/${encodeURIComponent(o.key)}`, { method: 'DELETE' }),
          ),
        )
        n += Math.min(4, obiecte.length - i)
      }
    }
    await api(`/r2/buckets/${g}`, { method: 'DELETE' })
    console.log(`sters (${n} obiecte)`)
  } catch (e) {
    esecuri++
    console.log(`ESUAT (${String(e.message).slice(0, 140)})`)
  }
}

console.log('5. spatiile KV')
for (const k of deSters.spatii) {
  await incearca(k.title, () => api(`/storage/kv/namespaces/${k.id}`, { method: 'DELETE' }))
}

console.log('6. AI Gateway')
for (const g of deSters.gateways) {
  await incearca(g, () => api(`/ai-gateway/gateways/${g}`, { method: 'DELETE' }))
}

if (esecuri > 0) {
  console.log(`\n⚠️ ${esecuri} n-au iesit. Reia — ce s-a sters deja nu mai apare in lista.`)
  process.exit(1)
}
console.log('\nGata.')
