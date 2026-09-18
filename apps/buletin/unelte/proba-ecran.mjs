#!/usr/bin/env node
/**
 * LABORATORUL ECRANELOR — leagă `pagini.ts` cu esbuild și scrie o pagină HTML de probă pe disc, ca
 * să se poată privi (și fotografia) fără Cloudflare și fără `pnpm dev`.
 *
 * De ce: ecranele aplicației trăiesc într-un Worker, iar Browser Rendering nu merge în container.
 * Probele din `tests/` păzesc bucățile de HTML, dar nu spun cum ARATĂ ecranul — la o piesă nouă
 * (ciorna numărului, cu coperta și butoanele ei) asta se vede doar cu ochiul.
 *
 *   node apps/buletin/unelte/proba-ecran.mjs [--iesire /tmp/ecran]
 *
 * ⚠️ Unealtă de laborator, nu parte din worker. Pozele și fișierele din R2 nu există local: coperta
 * se pune din `--coperta <cale>`, dacă se dă una.
 */
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AICI = dirname(fileURLToPath(import.meta.url))
const APP = resolve(AICI, '..')
const RADACINA = resolve(APP, '../..')

const arg = (nume, implicit) => {
  const i = process.argv.indexOf(`--${nume}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : implicit
}

async function adunaEsbuild() {
  const gasite = globSync('node_modules/.pnpm/esbuild@*/node_modules/esbuild/lib/main.js', { cwd: RADACINA })
  if (!gasite.length) throw new Error('nu găsesc esbuild în node_modules/.pnpm — rulează `pnpm install` întâi')
  const cale = join(RADACINA, gasite.sort().reverse()[0])
  return (await import(`file://${cale}`)).default ?? (await import(`file://${cale}`))
}

const resurseCaOcteti = {
  name: 'resurse',
  setup(build) {
    build.onLoad({ filter: /\.(png|ttf|otf|jpg)$/ }, (args) => ({
      contents: `const b = Buffer.from(${JSON.stringify(readFileSync(args.path).toString('base64'))}, 'base64');
export default b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);`,
      loader: 'js',
    }))
  },
}

/**
 * Puppeteer nu are ce căuta aici: `pagini.ts` îl trage fără să-l folosească, prin `@xc/ui` (de acolo
 * ies hârtiile). Legat, ar cere jumătate din biblioteca standard a lui node. Se pune un modul gol
 * în locul lui — ecranele nu cheamă browserul.
 */
const faraPuppeteer = {
  name: 'fara-puppeteer',
  setup(build) {
    build.onResolve({ filter: /^@cloudflare\/puppeteer$/ }, () => ({ path: 'puppeteer-gol', namespace: 'gol' }))
    build.onLoad({ filter: /.*/, namespace: 'gol' }, () => ({ contents: 'export default {}', loader: 'js' }))
  },
}

async function modulPagini() {
  const esbuild = await adunaEsbuild()
  const iesit = await esbuild.build({
    entryPoints: [join(APP, 'src/pagini.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    plugins: [resurseCaOcteti, faraPuppeteer],
    external: ['node:*'],
  })
  // bucata legată stă în dosarul de fișiere trecătoare, nu în aplicație: e o unealtă, nu cod de-al ei
  const cale = join(tmpdir(), `pagini-proba-${process.pid}.mjs`)
  writeFileSync(cale, iesit.outputFiles[0].text)
  return await import(`file://${cale}?t=${Date.now()}`)
}

const CTX = {
  prefix: '',
  nav: { home: 'https://website.sfantul-ilie.ro', cont: '/cont', admin: '/admin' },
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.7.0',
  modificata: '18.09.2026',
}

const ULTIMUL = { nr: 615, data: '2026-09-06', an: '2026', luna: '09', cheie_pdf: null, cheie_poza_mica: null, pagini: 4 }

async function main() {
  const iesire = arg('iesire', '/tmp/ecran')
  mkdirSync(iesire, { recursive: true })
  const { buletinulNou, paginaNou } = await modulPagini()
  const nou = buletinulNou(ULTIMUL, '2026-09-17')
  let html = paginaNou(CTX, { nou: true, ani: ['2026', '2025'] }, nou, {
    variante: [{ varianta: 'un singur autor, cu poză mare', semne: 9028, zone: [{ cine: 'principal', semne: 9028 }] }],
    calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 6 },
    raspuns: {
      facut: true,
      cheie: `2026/buletin-${nou.nr}-${nou.data}.pdf`,
      cheiePoza: `2026/buletin-${nou.nr}-${nou.data}.jpg`,
      versiune: 'a1b2c3',
      marime: 731717,
      plangeri: [],
    },
  })
  // coperta nu se poate cere din R2: dacă s-a dat o poză, se pune în locul ei, ca data-URI
  const cop = arg('coperta', '')
  if (cop) {
    const tip = cop.endsWith('.png') ? 'image/png' : 'image/jpeg'
    html = html.replace(
      /src="\/fisier\/[^"]+\.jpg[^"]*"/,
      `src="data:${tip};base64,${readFileSync(cop).toString('base64')}"`,
    )
  }
  const cale = join(iesire, 'nou-ciorna.html')
  writeFileSync(cale, html)
  console.log(`ecranul: ${cale}`)
}

await main()
