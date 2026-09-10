#!/usr/bin/env node
/**
 * Copiaza cele trei carti ale tipicului din exportul V1 in baza `xc-tipic-*`.
 *
 *   node infrastructure/import/tipic-din-v1.mjs --din /data/import-tipic --scrie local
 *   node infrastructure/import/tipic-din-v1.mjs --din /data/import-tipic --scrie staging --db-id <id>
 *
 * Fisierele asteptate in directorul dat (asa cum le tine V1 in R2):
 *   2026.json          Randuiala Tipicului (ROEA), 97 de zile
 *   anuar-2026.json    Anuarul liturgic si tipiconal (IBMO), 365 de zile
 *   minei-01..12.json  Mineiul, o luna pe fisier; noiembrie e scanarea IBMO 2005 (are `pagini`),
 *                      restul sunt culese de la slujbe.teologie.net (au `credit`)
 *
 * Ce se schimba la copiere (V1 -> V2): nimic din text. Se muta doar forma — listele de referinte
 * si bucatile Mineiului se pastreaza ca JSON in coloana lor, iar antetul fiecarui fisier (sursa,
 * editura, nota, credit) se aseaza in `carti`, ca pagina sa poata scrie sursa fiecarei parti.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { bazaLocala, bazaStaging, insereazaLoturi } from './d1.mjs'

const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}
const DIN = opt('din', '/data/import-tipic')
const SCRIE = opt('scrie', 'local')
const DB_ID = opt('db-id')

const citeste = (fisier) => {
  const cale = join(DIN, fisier)
  if (!existsSync(cale)) return null
  const brut = readFileSync(cale, 'utf8')
  return { date: JSON.parse(brut), octeti: Buffer.byteLength(brut) }
}

const roea = citeste('2026.json')
const anuar = citeste('anuar-2026.json')
if (!roea) throw new Error(`lipseste ${join(DIN, '2026.json')}`)
if (!anuar) throw new Error(`lipseste ${join(DIN, 'anuar-2026.json')}`)

const anDin = (data) => Number(String(data).slice(0, 4))

const randuriRanduiala = roea.date.zile.map((z) => ({
  data: z.data,
  an: anDin(z.data),
  zi: z.zi ?? '',
  voscreasna: z.voscreasna ?? null,
  utrenie: JSON.stringify(z.utrenie ?? []),
  apostol: JSON.stringify(z.apostol ?? []),
  evanghelie: JSON.stringify(z.evanghelie ?? []),
  tipic: z.tipic ?? '',
}))

const randuriTipiconal = anuar.date.zile.map((z) => ({
  data: z.data,
  an: anDin(z.data),
  zi: z.zi ?? '',
  titlu: z.titlu ?? '',
  paragrafe: JSON.stringify(z.paragrafe ?? []),
  pagini: JSON.stringify(z.pagini ?? []),
}))

const carti = [
  { cod: 'roea', sursa: roea.date.sursa, editura: '', nota: '', credit: '', url: roea.date.url ?? '', luna: null },
  { cod: 'anuar', sursa: anuar.date.sursa, editura: anuar.date.editura ?? '', nota: anuar.date.nota ?? '', credit: '', url: '', luna: null },
]
const importuri = [
  { cod: 'roea', sursa: roea.date.sursa, zile: randuriRanduiala.length, octeti: roea.octeti },
  { cod: 'anuar', sursa: anuar.date.sursa, zile: randuriTipiconal.length, octeti: anuar.octeti },
]

const randuriMinei = []
for (let luna = 1; luna <= 12; luna++) {
  const f = citeste(`minei-${String(luna).padStart(2, '0')}.json`)
  if (!f) {
    console.error(`  minei-${String(luna).padStart(2, '0')}.json lipseste — luna se sare (cartile intra pe rand)`)
    continue
  }
  const m = f.date
  if (m.luna !== luna) throw new Error(`minei-${luna}: fisierul spune luna ${m.luna}`)
  for (const z of m.zile) {
    randuriMinei.push({
      luna,
      zi: z.zi,
      titlu: z.titlu ?? '',
      bucati: JSON.stringify(z.bucati ?? []),
      pagini: JSON.stringify(z.pagini ?? []),
    })
  }
  carti.push({
    cod: `minei-${String(luna).padStart(2, '0')}`,
    sursa: m.sursa ?? `Mineiul, luna ${luna}`,
    editura: m.editura ?? '',
    nota: m.nota ?? '',
    credit: m.credit ?? '',
    url: '',
    luna,
  })
  importuri.push({ cod: `minei-${String(luna).padStart(2, '0')}`, sursa: m.sursa ?? '', zile: m.zile.length, octeti: f.octeti })
}

// Verificari de forma, inainte de a scrie ceva.
const felBun = new Set(['sectiune', 'rubrica', 'text', 'sinaxar'])
for (const r of randuriMinei) {
  for (const b of JSON.parse(r.bucati)) {
    if (!felBun.has(b.fel)) throw new Error(`minei ${r.luna}-${r.zi}: fel necunoscut „${b.fel}"`)
  }
}
const zileFaraTipic = randuriRanduiala.filter((r) => !r.tipic.trim())
if (zileFaraTipic.length) throw new Error(`${zileFaraTipic.length} zile ROEA fara text de tipic`)

const baza = SCRIE === 'local' ? await bazaLocala('randuiala') : bazaStaging(DB_ID)
console.error(`scriu in ${baza.fel}: ${baza.cale}`)

const acum = new Date().toISOString()
await baza.tranzactie(async () => {
  const nr = await insereazaLoturi(baza, 'randuiala', Object.keys(randuriRanduiala[0]), randuriRanduiala)
  const nt = await insereazaLoturi(baza, 'tipiconal', Object.keys(randuriTipiconal[0]), randuriTipiconal)
  // Mineiul are zile de pana la 150 KB: se scriu cate una, ca lotul sa nu treaca de corpul cererii.
  const nm = await insereazaLoturi(baza, 'minei', Object.keys(randuriMinei[0]), randuriMinei, 4)
  const nc = await insereazaLoturi(baza, 'carti', Object.keys(carti[0]), carti)
  await insereazaLoturi(
    baza,
    'importuri',
    ['cod', 'sursa', 'zile', 'octeti', 'importat_la'],
    importuri.map((i) => ({ ...i, importat_la: acum })),
  )
  console.log(`randuiala (ROEA): ${nr} zile`)
  console.log(`tipiconal (Anuar): ${nt} zile`)
  console.log(`minei: ${nm} zile din ${carti.filter((c) => c.luna).length} luni`)
  console.log(`carti: ${nc}`)
})
baza.inchide()
