#!/usr/bin/env node
/**
 * Copiaza programul liturgic din exportul V1 (JSON-urile tabelelor `saptamani`, `slujbe`,
 * `vocabular`, `istoric`) in baza `xc-program-*`. O singura data, cu verificare de numar de
 * randuri; fara sincronizare continua.
 *
 *   node infrastructure/import/program-din-v1.mjs --din /tmp/v1 --scrie local
 *   node infrastructure/import/program-din-v1.mjs --din /tmp/v1 --scrie staging --db-id <id>
 *
 * Ce se schimba la copiere (V1 -> V2): `validat_de` „sfantul-ilie.ro (import)" -> 'import';
 * `persoana_id` din istoric -> user_id NULL (identitatea V1 nu e a V2). `abonati` NU se copiaza
 * (abonarile sunt audiente ale comunicarii). Vocabularul e deja in migratie; se verifica doar.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bazaLocala, bazaStaging, insereazaLoturi } from './d1.mjs'

const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}
const DIN = opt('din', '/tmp/v1')
const SCRIE = opt('scrie', 'local')
const DB_ID = opt('db-id')

const citeste = (t) => JSON.parse(readFileSync(join(DIN, `biserica-program-${t}.json`), 'utf8'))
const saptamani = citeste('saptamani')
const slujbe = citeste('slujbe')
const vocabular = citeste('vocabular')
const istoric = citeste('istoric')

// Verificari de forma, inainte de a scrie ceva.
const coduri = new Set(vocabular.map((v) => v.cod_nume))
const faraCod = slujbe.filter((s) => !s.cod_nume || !coduri.has(s.cod_nume))
if (faraCod.length) throw new Error(`${faraCod.length} slujbe fara cod_nume din vocabular: ${faraCod.slice(0, 3).map((s) => s.id).join(', ')}`)
const luniS = new Set(saptamani.map((s) => s.luni))
const orfane = slujbe.filter((s) => !luniS.has(s.luni))
if (orfane.length) throw new Error(`${orfane.length} slujbe fara saptamana`)

const baza = SCRIE === 'local' ? await bazaLocala('saptamani') : bazaStaging(DB_ID)
console.error(`scriu in ${baza.fel}: ${baza.cale}`)

const randuriSapt = saptamani.map((s) => ({
  luni: s.luni,
  duminica: s.duminica,
  stare: s.stare,
  titlu: s.titlu ?? '',
  sursa: s.sursa,
  sursa_id: s.sursa_id ?? null,
  sursa_link: s.sursa_link ?? null,
  versiune_calendar: s.versiune_calendar ?? null,
  validat_de: s.validat_de ? 'import' : null,
  validat_la: s.validat_la ?? null,
  creat: s.creat,
  modificat: s.modificat,
}))
const randuriSlujbe = slujbe.map((s) => ({
  id: s.id,
  luni: s.luni,
  data: s.data,
  ora: s.ora,
  nume: s.nume,
  cod_nume: s.cod_nume,
  slujitor: s.slujitor ?? null,
  loc: s.loc ?? 'biserica',
  detalii: s.detalii ?? '[]',
  observatii: s.observatii ?? null,
  curatenie: s.curatenie ?? 1,
  transmisie: s.transmisie ?? 1,
  ordine: s.ordine ?? 0,
  creat: s.creat,
  modificat: s.modificat,
}))

await baza.tranzactie(async () => {
  const ns = await insereazaLoturi(baza, 'saptamani', Object.keys(randuriSapt[0]), randuriSapt)
  const nl = await insereazaLoturi(baza, 'slujbe', Object.keys(randuriSlujbe[0]), randuriSlujbe)
  for (const i of istoric) {
    await baza.ruleaza(`INSERT INTO istoric (moment, user_id, ce, luni, slujba_id, detalii) VALUES (?, NULL, ?, ?, ?, ?)`, [i.moment, i.ce, i.luni ?? null, i.slujba_id ?? null, i.detalii ?? null])
  }
  await baza.ruleaza(`INSERT INTO istoric (moment, user_id, ce, luni, slujba_id, detalii) VALUES (?, NULL, 'import', NULL, NULL, ?)`, [
    new Date().toISOString(),
    `copiat din V1 (biserica-program): ${ns} saptamani, ${nl} slujbe, ${istoric.length} randuri de istoric`,
  ])
  console.error(`scrise: ${ns} saptamani, ${nl} slujbe, ${istoric.length + 1} istoric`)
})
baza.inchide()
