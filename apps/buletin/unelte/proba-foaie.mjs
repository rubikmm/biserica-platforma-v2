#!/usr/bin/env node
/**
 * LABORATORUL FOII — construiește foaia tipărită cu date de probă și o randează în PDF/PNG pe loc,
 * fără Cloudflare și fără să atingă nimic din ce e viu.
 *
 * De ce: `foaie.ts` trăiește într-un Worker (fonturile și chenarul intră ca octeți, prin regula
 * `Data` din wrangler), iar Browser Rendering nu merge pe local. Aici se leagă modulul cu esbuild,
 * cu resursele citite de pe disc, și se randează cu Chromium-ul containerului. Așa se poate
 * compara, pagină cu pagină, cu un număr adevărat din arhivă.
 *
 *   node apps/buletin/unelte/proba-foaie.mjs [--secundari 2] [--iesire /tmp/proba]
 *
 * ⚠️ Unealtă de laborator, nu parte din worker: cere `chromium` în container (apt-get install
 * chromium) și `pdftoppm` din poppler-utils pentru pozele de comparat.
 */
import { execFile } from 'node:child_process'
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const ruleaza = promisify(execFile)
const AICI = dirname(fileURLToPath(import.meta.url))
const APP = resolve(AICI, '..')
const RADACINA = resolve(APP, '../..')

/**
 * esbuild vine cu wrangler, dar pnpm nu-l ridică la rădăcină, iar unealta asta n-are ce căuta în
 * dependențele workerului — de aceea se caută în magazie, nu se cere în `package.json`.
 */
async function adunaEsbuild() {
  const gasite = globSync('node_modules/.pnpm/esbuild@*/node_modules/esbuild/lib/main.js', { cwd: RADACINA })
  if (!gasite.length) throw new Error('nu găsesc esbuild în node_modules/.pnpm — rulează `pnpm install` întâi')
  const cale = join(RADACINA, gasite.sort().reverse()[0])
  return (await import(`file://${cale}`)).default ?? (await import(`file://${cale}`))
}

const arg = (nume, implicit) => {
  const i = process.argv.indexOf(`--${nume}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : implicit
}

/** Resursele binare, ca module JS — ce face regula `Data` din wrangler, dar pentru node. */
const resurseCaOcteti = {
  name: 'resurse',
  setup(build) {
    build.onLoad({ filter: /\.(png|ttf|otf)$/ }, (args) => ({
      contents: `const b = Buffer.from(${JSON.stringify(readFileSync(args.path).toString('base64'))}, 'base64');
export default b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);`,
      loader: 'js',
    }))
  },
}

async function moduleFoaie() {
  const esbuild = await adunaEsbuild()
  const iesit = await esbuild.build({
    entryPoints: [join(APP, 'src/foaie.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [resurseCaOcteti],
    external: [],
  })
  const cale = join(arg('iesire', '/tmp/proba-buletin'), 'foaie.mjs')
  mkdirSync(dirname(cale), { recursive: true })
  writeFileSync(cale, iesit.outputFiles[0].text)
  return import(cale)
}

/** Text de probă: destul cât să umple foaia, ca la un număr adevărat. */
const TEXT = (n) =>
  Array.from({ length: n }, (_, i) =>
    `La Mănăstirea Văratec, într-un loc binecuvântat de Sfântul Cuvios Paisie de la Neamț ca sălaș ` +
    `de rugăciune pentru sufletele însetate de Dumnezeu, s-a plămădit de-a lungul veacurilor o ` +
    `obște monahală care a dat Bisericii trei chipuri de aleasă trăire duhovnicească, iar ` +
    `paragraful acesta este al ${i + 1}-lea din proba noastră, scris ca să umple coloana la fel ` +
    `de des ca textul adevărat al foii parohiei.`,
  ).join('\n\n')

/**
 * PROBA SOCOTELII: pentru fiecare variantă, scrie exact atâtea semne câte spune `masuri.ts` că
 * încap, randează și se uită dacă a rămas ceva pe dinafară. Socoteala are voie să greșească în
 * jos (să ceară mai puțin decât încape), niciodată în sus.
 */
async function verifica(iesire) {
  const { foaieHtml } = await moduleFoaie()
  const { variante } = await moduleMasuri()
  // ⚠️ Cu CALENDARUL pe pagina a patra, nu fără: fără el coloanele de acolo sunt întregi și proba
  // trece oricum, adică nu probează nimic. Tabelul e cel adevărat, cerut de la modulul programului.
  const calendarProba = await tabelulDeProba()
  const calendar = { slujbe: calendarProba.slujbe, detalii: calendarProba.detalii }
  console.log('varianta                          prezis   intrat  pe dinafară  verdict')
  let toateBune = true
  for (const v of variante(calendar)) {
    const cati = v.zone.length - 1
    const cerut = {
      motto: '„Un citat de două rânduri, cât cel din capul foii parohiei, ca măsura să fie cea adevărată."',
      motoAutor: 'Părintele Arsenie Papacioc',
      nr: 616,
      data: '2026-09-20',
      principal: {
        autor: 'SFÂNTA CUVIOASĂ PARASCHEVA', pomenire: '† 14 octombrie',
        titlu: 'UN TITLU DE DOUĂ RÂNDURI PENTRU PROBĂ',
        text: umplutura(v.zones?.[0]?.semne ?? v.zone[0].semne),
        sursa: 'ziarullumina.ro',
        poza: v.varianta.includes('cu poză'),
      },
      secundari: v.zone.slice(1).map((z, i) => ({
        autor: `AL DOILEA AUTOR ${i + 1}`, titlu: 'TITLUL ARTICOLULUI SECUNDAR',
        text: umplutura(z.semne), sursa: 'doxologia.ro', poza: false,
      })),
    }
    const html = foaieHtml({
      cerut, dataScrisa: '20 septembrie 2026', poze: { p: pozaDeProba() },
      calendar: { tabel: calendarProba.tabel, stil: calendarProba.stil }, floare: true,
    })
    const cale = join(iesire, `v-${cati}-${cerut.principal.poza ? 'poza' : 'fara'}.html`)
    writeFileSync(cale, html)
    const raport = await raportulCurgerii(cale)
    const bun = raport.peDinafara === 0
    toateBune = toateBune && bun
    console.log(
      `${v.varianta.padEnd(33)} ${String(v.semne).padStart(6)} ${String(raport.intrate).padStart(8)} ` +
      `${String(raport.peDinafara).padStart(12)}  ${bun ? 'BUN' : 'A DAT PE DINAFARĂ'}`,
    )
  }
  if (!toateBune) process.exitCode = 1
}

const umplutura = (semne) => {
  const p = 'Sfânta Cuvioasă Parascheva s-a născut într-un sat de lângă Constantinopol, din părinți binecredincioși, și a ales de tânără calea rugăciunii neîncetate, lepădându-se de averi și de slava lumii acesteia pentru dragostea lui Hristos. '
  let t = ''
  while (t.length < semne) t += t.length && t.length % (p.length * 4) < p.length ? `\n\n${p}` : p
  return t.slice(0, semne).trim()
}

/** Curgerea, citită din pagină — același `data-raport` pe care îl scoate Browser Rendering. */
async function raportulCurgerii(caleHtml) {
  const dom = await ruleaza('chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000',
    '--dump-dom', `file://${caleHtml}`,
  ], { maxBuffer: 1 << 26 })
  const m = /data-raport="([^"]*)"/.exec(dom.stdout)
  const brut = (m?.[1] ?? '{}').replace(/&quot;/g, '"')
  return { intrate: 0, peDinafara: 0, coloaneFolosite: 0, ...JSON.parse(brut) }
}

/**
 * Tabelul programului pentru o săptămână obișnuită — chiar modulul aplicației `program`, ca proba
 * să măsoare ce se tipărește, nu o închipuire a noastră despre el.
 */
async function tabelulDeProba(program) {
  const esbuild = await adunaEsbuild()
  const r = await esbuild.build({
    entryPoints: [resolve(APP, '../program/src/foaie.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, plugins: [resurseCaOcteti],
  })
  const cale = join(arg('iesire', '/tmp/proba-buletin'), 'foaie-program.mjs')
  mkdirSync(dirname(cale), { recursive: true })
  writeFileSync(cale, r.outputFiles[0].text)
  const { tabelProgram, stilTabel } = await import(`file://${cale}?t=${Date.now()}`)
  const sl = (data, ora, nume, cod, detalii = []) => ({ data, ora, nume, cod_nume: cod, detalii })
  // pericopa duminicii e UN rând („Ap. …; Ev. …; glas …, voscr. …"), cum o dă programul adevărat
  const slujbe = program?.slujbe?.map((s) => sl(s.data, s.ora, s.nume, s.cod, s.detalii ?? [])) ?? [
    sl('2026-09-21', '18:00', 'Vecernia și Litia', 'vecernia'),
    sl('2026-09-22', '07:00', 'Utrenia și Sfânta Liturghie', 'utrenia', ['Nașterea Maicii Domnului']),
    sl('2026-09-24', '18:00', 'Paraclisul Maicii Domnului', 'vecernia'),
    sl('2026-09-26', '18:00', 'Vecernia și Litia', 'vecernia'),
    sl('2026-09-27', '08:00', 'Utrenia și Sfânta Liturghie', 'utrenia', ['Ap. Galateni 2, 16-20; Ev. Luca 8, 5-15; glas 4, voscr. 2', 'Duminica a 21-a după Rusalii']),
    sl('2026-09-27', '18:00', 'Vecernia și Litia', 'vecernia', ['Sfântul Ierarh Inochentie']),
  ]
  const luni = program?.luni ?? '2026-09-21'
  const optiuni = {
    luni, duminica: program?.duminica ?? '2026-09-27', titlu: program?.titlu ?? '21 – 27 septembrie 2026', slujbe,
    strans: program?.strans ?? 0,
    vocabular: new Map([
      ['utrenia', { cod: 'utrenia', nume: 'Utrenia', categorie: 'dimineata' }],
      ['vecernia', { cod: 'vecernia', nume: 'Vecernia', categorie: 'seara' }],
    ]),
    calendar: null, dinCalendar: false,
  }
  return {
    tabel: tabelProgram(optiuni),
    stil: stilTabel(true),
    slujbe: slujbe.length,
    detalii: slujbe.reduce((n, s) => n + s.detalii.length, 0),
  }
}

async function moduleMasuri() {
  const esbuild = await adunaEsbuild()
  const r = await esbuild.build({
    entryPoints: [join(APP, 'src/masuri.ts')], bundle: true, format: 'esm', platform: 'node', write: false,
  })
  const cale = join(arg('iesire', '/tmp/proba-buletin'), 'masuri.mjs')
  mkdirSync(dirname(cale), { recursive: true })
  writeFileSync(cale, r.outputFiles[0].text)
  return import(`file://${cale}?t=${Date.now()}`)
}

async function moduleUmplere() {
  const esbuild = await adunaEsbuild()
  const r = await esbuild.build({
    entryPoints: [join(APP, 'src/umplere.ts')], bundle: true, format: 'esm', platform: 'node', write: false,
  })
  const cale = join(arg('iesire', '/tmp/proba-buletin'), 'umplere.mjs')
  mkdirSync(dirname(cale), { recursive: true })
  writeFileSync(cale, r.outputFiles[0].text)
  return import(`file://${cale}?t=${Date.now()}`)
}

/**
 * NUMĂRUL GOL (user, 17.09.2026, seara): nimic scris — autorul, titlul, textul, sursa se umplu de
 * probă („NUME AUTOR", „TITLU ARTICOL", Lorem ipsum, „Sursa: -"), exact cât încape la programul
 * întreg; cu `--secundari 1|2`, și secundarii, câte o pătrime fiecare. Proba e a curgerii: textul de
 * probă trebuie să intre FIX — nimic pe dinafară, și nici loc gol de un rând.
 *
 *   node apps/buletin/unelte/proba-foaie.mjs --gol [--secundari 2] [--iesire /tmp/proba]
 */
async function numarGol(iesire) {
  const { foaieHtml } = await moduleFoaie()
  const { umpleCuProba } = await moduleUmplere()
  const cati = Number(arg('secundari', '0'))
  const t = await tabelulDeProba()
  const cerutGol = {
    motto: '„Maica Domnului ne iubește mult. Ea vede în noi prețul morții lui Iisus Hristos. ' +
      'Maica Domnului ne dorește lucruri mai mari decât ne dorim noi înșine.”',
    motoAutor: 'Părintele Arsenie Papacioc',
    nr: 616,
    data: '2026-09-20',
    principal: { autor: '', titlu: '', text: '', poza: false },
    secundari: Array.from({ length: cati }, () => ({ autor: '', titlu: '', text: '', poza: false })),
    floare: true,
  }
  const { cerut, deProba, socoteala } = umpleCuProba(cerutGol, { slujbe: t.slujbe, detalii: t.detalii })
  const html = foaieHtml({
    cerut, dataScrisa: '20 septembrie 2026', poze: {},
    calendar: { tabel: t.tabel, stil: t.stil }, floare: socoteala.floare,
  })
  const caleHtml = join(iesire, `gol-${cati}.html`)
  writeFileSync(caleHtml, html)
  const raport = await raportulCurgerii(caleHtml)
  const calePdf = join(iesire, `buletin-gol-${cati}-secundari.pdf`)
  await ruleaza('chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=9000',
    '--no-pdf-header-footer', `--print-to-pdf=${calePdf}`, `file://${caleHtml}`,
  ], { maxBuffer: 1 << 26 })
  await ruleaza('pdftoppm', ['-r', '70', '-png', calePdf, join(iesire, `gol-${cati}-pag`)])
  console.log(`de probă: ${deProba.join('; ')}`)
  console.log(`socoteala: ${JSON.stringify(socoteala.zone.map((z) => [z.cine, z.semne, z.scrise]))}`)
  console.log(`PDF: ${calePdf}\ncurgerea: ${JSON.stringify(raport)}`)
  if (raport.peDinafara > 0) process.exitCode = 1
}

async function main() {
  const iesire = arg('iesire', '/tmp/proba-buletin')
  mkdirSync(iesire, { recursive: true })
  if (process.argv.includes('--verifica')) return verifica(iesire)
  if (process.argv.includes('--gol')) return numarGol(iesire)
  if (arg('cerere', '')) return dinCerere(iesire, arg('cerere', ''))
  const { foaieHtml } = await moduleFoaie()
  const cati = Number(arg('secundari', '0'))

  const cerut = {
    motto: '„Maica Domnului ne iubește mult. Ea vede în noi prețul morții lui Iisus Hristos. ' +
      'Maica Domnului ne dorește lucruri mai mari decât ne dorim noi înșine."',
    motoAutor: 'Părintele Arsenie Papacioc',
    nr: 616,
    data: '2026-09-20',
    principal: {
      autor: 'SFINTELE NAZARIA, OLIMPIADA ȘI ELISABETA',
      pomenire: '† 17 august',
      titlu: 'RUGĂTOARE ISIHASTE',
      text: TEXT(cati ? 9 : 14),
      sursa: 'ziarullumina.ro',
      poza: true,
    },
    secundari: Array.from({ length: cati }, (_, i) => ({
      autor: i === 0 ? 'PĂRINTELE ARSENIE PAPACIOC' : 'PĂRINTELE TEOFIL PĂRĂIAN',
      titlu: i === 0 ? 'CUVINTE DESPRE MAICA DOMNULUI' : 'DESPRE BUCURIA CREDINȚEI',
      text: TEXT(3),
      sursa: i === 0 ? 'manastireasuruceni.md' : 'doxologia.ro',
      poza: false,
    })),
  }

  const html = foaieHtml({
    cerut,
    dataScrisa: '20 septembrie 2026',
    poze: { p: pozaDeProba() },
    calendar: null,
    floare: true,
  })
  const caleHtml = join(iesire, 'foaie.html')
  writeFileSync(caleHtml, html)

  const calePdf = join(iesire, 'foaie.pdf')
  await ruleaza('chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000',
    '--run-all-compositor-stages-before-draw', '--no-pdf-header-footer',
    `--print-to-pdf=${calePdf}`, `file://${caleHtml}`,
  ], { maxBuffer: 1 << 26 })
  await ruleaza('pdftoppm', ['-r', '90', '-png', calePdf, join(iesire, 'pag')])
  console.log(`foaia: ${caleHtml}\nPDF:   ${calePdf}\npoze:  ${iesire}/pag-*.png`)
}

/**
 * REFACEREA UNUI NUMĂR APĂRUT, numai prin API (user, 17.09.2026: „să vedem cât de aproape îl scoatem
 * față de cel original — doar cu metodele API pe care le-am făcut"). Cererea e un JSON cu aceeași
 * formă ca la `buletin.compune`, plus `poze` (căi de fișiere) și `program` (slujbele săptămânii,
 * pentru tabel — pe local programul nu e la îndemână). Scoate PDF-ul și, dacă i se dă `--original`,
 * pozele paginilor una lângă alta, ca să se compare cu ochiul.
 */
async function dinCerere(iesire, caleJson) {
  const { foaieHtml } = await moduleFoaie()
  const cerere = JSON.parse(readFileSync(caleJson, 'utf8'))
  const poze = {}
  for (const [k, cale] of Object.entries(cerere.poze ?? {})) {
    const abs = resolve(dirname(caleJson), cale)
    const tip = /\.png$/i.test(abs) ? 'image/png' : 'image/jpeg'
    poze[k] = `data:${tip};base64,${readFileSync(abs).toString('base64')}`
  }
  let calendar = null
  if (cerere.program) {
    const t = await tabelulDeProba(cerere.program)
    calendar = { tabel: t.tabel, stil: t.stil }
  }
  const cerut = { ...cerere, poze: undefined, program: undefined }
  const html = foaieHtml({ cerut, dataScrisa: cerere.data_scrisa, poze, calendar, floare: true })
  const caleHtml = join(iesire, 'numar.html')
  writeFileSync(caleHtml, html)
  const raport = await raportulCurgerii(caleHtml)
  const calePdf = join(iesire, `buletin-${cerere.nr}-refacut.pdf`)
  await ruleaza('chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=9000',
    '--no-pdf-header-footer', `--print-to-pdf=${calePdf}`, `file://${caleHtml}`,
  ], { maxBuffer: 1 << 26 })
  console.log(`PDF: ${calePdf}\ncurgerea: ${JSON.stringify(raport)}`)
  const original = arg('original', '')
  if (original) {
    await ruleaza('pdftoppm', ['-r', '70', '-png', calePdf, join(iesire, 'nou')])
    await ruleaza('pdftoppm', ['-r', '70', '-png', original, join(iesire, 'orig')])
    for (let p = 1; p <= 4; p++) {
      await ruleaza('convert', [join(iesire, `orig-${p}.png`), join(iesire, `nou-${p}.png`), '+append', join(iesire, `comparatie-${p}.png`)])
    }
    console.log(`comparații: ${iesire}/comparatie-{1..4}.png (stânga originalul, dreapta al nostru)`)
  }
}

/** O poză dreptunghiulară, cât cea din foaie, ca să se vadă cum cade coloana. */
function pozaDeProba() {
  const cale = process.env.POZA_PROBA
  if (cale) return `data:image/jpeg;base64,${readFileSync(cale).toString('base64')}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="679" height="1244"><rect width="679" height="1244" fill="#d8d8d8" stroke="#333" stroke-width="6"/><text x="339" y="622" font-size="52" text-anchor="middle" fill="#666">poza</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
