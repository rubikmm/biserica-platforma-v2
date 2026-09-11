#!/usr/bin/env node
/**
 * EXPORTUL DISCUȚIILOR — toate, ca JSONL, pentru referință și antrenament.
 *
 *   node infrastructure/eval/discutii.mjs --remote --env staging > discutii.jsonl
 *   node infrastructure/eval/discutii.mjs --local                 > discutii.jsonl
 *
 * Un rând = o discuție: cine (doar `user_id`), unde a pornit, apoi mesajele în ordine, fiecare cu
 * rolul, textul, modelul și apelurile de unealtă (cu argumente și cum au ieșit), plus propunerile
 * și starea lor (făcută / refuzată / expirată). Din asta se scot probe noi pentru
 * `infrastructure/eval/chat.mjs`: fraza omului + unealta care a ieșit bine.
 *
 * Nu conține nume, e-mail sau telefon — chatul nu le ține (regula platformei).
 */
import { execFileSync } from 'node:child_process'

const arg = process.argv.slice(2)
const remote = arg.includes('--remote')
const env = arg.includes('--env') ? arg[arg.indexOf('--env') + 1] : null
const tinta = remote ? ['--remote', ...(env ? ['--env', env] : [])] : ['--local', '--persist-to', '.wrangler/state']

function sql(comanda) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'xc-chat-staging', '-c', 'services/chat-worker/wrangler.jsonc', '--json', '--command', comanda, ...tinta],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const inceput = out.indexOf('[')
  const rezultat = JSON.parse(out.slice(inceput))
  return rezultat.flatMap((bloc) => bloc.results ?? [])
}

const conversatii = sql('SELECT * FROM conversatii ORDER BY creata_la')
const mesaje = sql('SELECT * FROM mesaje ORDER BY creat_la, rowid')
const propuneri = sql('SELECT * FROM propuneri ORDER BY creata_la')

const mesajeDupaConv = new Map()
for (const m of mesaje) {
  const lista = mesajeDupaConv.get(m.conversatie_id) ?? []
  const date = JSON.parse(m.date_json || '{}')
  lista.push({ rol: m.rol, text: m.text, la: m.creat_la, model: date.model ?? null, apeluri: date.apeluri ?? [], propunere: date.propunere ?? null, obiecte: (date.obiecte ?? []).map((o) => o.titlu) })
  mesajeDupaConv.set(m.conversatie_id, lista)
}
const propuneriDupaConv = new Map()
for (const p of propuneri) {
  const lista = propuneriDupaConv.get(p.conversatie_id) ?? []
  lista.push({ actiune: p.actiune, argumente: JSON.parse(p.argumente_json || '{}'), rezumat: p.rezumat, stare: p.stare, la: p.creata_la })
  propuneriDupaConv.set(p.conversatie_id, lista)
}

for (const c of conversatii) {
  process.stdout.write(
    JSON.stringify({
      id: c.id,
      user_id: c.user_id,
      aplicatie: c.aplicatie,
      creata_la: c.creata_la,
      ascunsa: Boolean(c.stearsa_la),
      mesaje: mesajeDupaConv.get(c.id) ?? [],
      propuneri: propuneriDupaConv.get(c.id) ?? [],
    }) + '\n',
  )
}
process.stderr.write(`${conversatii.length} discuții, ${mesaje.length} mesaje, ${propuneri.length} propuneri\n`)
