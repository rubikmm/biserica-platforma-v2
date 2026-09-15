/**
 * A8 · Scoate ANTETUL si SUBSOLUL — „zona fixa" a newsletterului — dintr-un numar deja trimis, si le
 * pune in depozit ca sablon (user, 16.09.2026: „preia formele folosite in ultimul newsletter").
 *
 * De ce dintr-un numar, si nu scrise de mana: bucatile astea se repeta la fiecare trimitere de ani de
 * zile, cu grafica facuta in MailPoet. Rescrise, ar arata altfel — iar regula casei e ca grafica se
 * ia din ce exista, nu se reface (user, 10.09.2026).
 *
 *   node infrastructure/import/newsletter-live/sablon-din-numar.mjs [--id=537]         arata, nu scrie
 *   node infrastructure/import/newsletter-live/sablon-din-numar.mjs [--id=537] --chiar scrie in R2
 *
 * Ce iese, in depozit (`xc-newsletter-production`):
 *   sablon/antet.html    cele doua poze: crucea si titlul „Buletinul Online"
 *   sablon/subsol.html   poza parintelui Arsenie Papacioc, titlul, citatul, grupul de WhatsApp, adresa
 *
 * ⚠️ ASTEA SUNT DOAR BUCATILE CARE SE INSEREAZA la facerea unui buletin nou. Fiecare newsletter
 * trimis isi pastreaza forma LUI, intreaga, in `stiri/<id>.html` — deci o schimbare aici nu atinge
 * niciun numar din arhiva. Asa a cerut-o userul: sablonul se schimba de azi inainte, arhiva ramane
 * marturia a ce a plecat atunci.
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
import { writeFileSync } from 'node:fs'

const CHIAR = process.argv.includes('--chiar')
const ID = Number(process.argv.find((a) => a.startsWith('--id='))?.slice(5) ?? 0)
const GALEATA = process.argv.find((a) => a.startsWith('--in='))?.slice(5) ?? 'xc-newsletter-production'

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}
const adresa = (cheie) =>
  `https://api.cloudflare.com/client/v4/accounts/${cont}/r2/buckets/${GALEATA}/objects/${cheie
    .split('/').map(encodeURIComponent).join('/')}`

async function ia(cheie) {
  const r = await fetch(adresa(cheie), { headers: { authorization: `Bearer ${jeton}` } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`GET ${cheie}: ${r.status}`)
  return await r.text()
}
async function pune(cheie, corp) {
  const r = await fetch(adresa(cheie), {
    method: 'PUT',
    headers: { authorization: `Bearer ${jeton}`, 'content-type': 'text/html; charset=utf-8' },
    body: corp,
  })
  if (!r.ok) throw new Error(`PUT ${cheie}: ${r.status} ${(await r.text()).slice(0, 160)}`)
}

/**
 * Marginile randului CEL MAI STRANS care cuprinde un semn.
 *
 * ⚠️ Regexul singur nu poate: tabelele de email sunt cuiburi de <tr> in <tr>, iar un `[\s\S]*?</tr>`
 * s-ar opri la primul rand dinauntru. Se numara deschiderile si inchiderile, se tin toate randurile
 * care cuprind semnul si se alege cel mai scurt. (Aceeasi socoteala ca `scoateBanda` din V1.)
 */
function randul(h, semn) {
  const i = h.indexOf(semn)
  if (i < 0) return null
  const re = /<tr\b[^>]*>|<\/tr\s*>/gi
  const stiva = []
  const cuprind = []
  let m
  while ((m = re.exec(h))) {
    if (m[0][1] === '/') {
      const s = stiva.pop()
      if (s === undefined) continue
      const sfarsit = m.index + m[0].length
      if (s < i && sfarsit > i) cuprind.push([s, sfarsit])
    } else stiva.push(m.index)
  }
  if (!cuprind.length) return null
  cuprind.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]))
  return cuprind[0]
}

/** De la inceputul randului lui `dela` pana la sfarsitul randului lui `panaLa`, cu tot ce e intre. */
function bucata(h, dela, panaLa) {
  const a = randul(h, dela)
  const b = randul(h, panaLa)
  if (!a || !b) return null
  if (b[1] < a[0]) return null
  return h.slice(a[0], b[1]).trim()
}

// ---------------------------------------------------------------------------

const lista = JSON.parse((await ia('lista.json')) ?? '[]')
if (!lista.length) { console.error('lista.json e goala'); process.exit(1) }
// implicit: ultimul numar trimis — „preia formele folosite in ultimul newsletter"
const fisa = ID ? lista.find((f) => f.id === ID) : lista[lista.length - 1]
if (!fisa) { console.error(`numarul ${ID} nu e in lista`); process.exit(1) }
console.log(`iau formele din: id ${fisa.id} · ${fisa.trimis} · ${fisa.subiect}`)

const h = await ia(`stiri/${fisa.id}.html`)
if (!h) { console.error(`stiri/${fisa.id}.html nu e in depozit`); process.exit(1) }

/*
 * ANTETUL: cele doua poze, si atat (user: „in antet trebuie sa fie cele doua poze si atat: crucea si
 * acel titlu «Buletinul online»"). Titlul „Programul Liturgic" de sub ele e CONTINUT, nu antet, deci
 * ramane afara — de-aia se opreste la poza a doua, nu la randul urmator.
 */
const antet = bucata(h, 'cruce.png', 'header6')
/*
 * SUBSOLUL: de la poza parintelui Arsenie Papacioc pana la randul cu adresa, cu tot ce e intre —
 * titlul, citatul, grupul de WhatsApp (user: „poza cu parintele Arsenie Papacioc, textul mai mare si
 * apoi acel citat si apoi detaliile despre grupul de WhatsApp si textele cu locatia").
 */
const subsol = bucata(h, 'Parintele-Arsenie-Papacioc', 'mailpoet_footer')

const bucati = [['sablon/antet.html', antet, 'antetul'], ['sablon/subsol.html', subsol, 'subsolul']]
let lipsa = false
for (const [cheie, corp, nume] of bucati) {
  if (!corp) { console.error(`⚠️ nu gasesc ${nume} in numarul asta`); lipsa = true; continue }
  const poze = [...corp.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
  console.log(`\n${nume} → ${cheie}`)
  console.log(`  ${Buffer.byteLength(corp)} octeti, ${(corp.match(/<tr\b/gi) ?? []).length} randuri`)
  console.log(`  poze: ${poze.length ? poze.join(', ') : '(niciuna)'}`)
  const text = corp.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  console.log(`  text: ${text.slice(0, 160)}${text.length > 160 ? '…' : ''}`)
}
if (lipsa) process.exit(2)

if (!CHIAR) {
  for (const [cheie, corp] of bucati) writeFileSync(`/data/proba-${cheie.replace(/\//g, '-')}`, corp)
  console.log('\nprobele: /data/proba-sablon-antet.html, /data/proba-sablon-subsol.html')
  console.log('(fara --chiar) — nu s-a scris nimic in depozit.')
  process.exit(0)
}

for (const [cheie, corp] of bucati) {
  const vechi = await ia(cheie)
  if (vechi !== null) {
    const ziua = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    await pune(`${cheie}.bak-${ziua}`, vechi)
    console.log(`copie de siguranta: ${cheie}.bak-${ziua}`)
  }
  await pune(cheie, corp)
  console.log(`urcat ${cheie}`)
}
console.log(`\ngata — sablonul e luat din numarul ${fisa.nr ?? fisa.id}.`)
