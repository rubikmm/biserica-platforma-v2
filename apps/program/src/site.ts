/**
 * BUCATA PENTRU PRIMA PAGINĂ A SITE-ULUI PAROHIEI (`sfantul-ilie.ro`, WordPress-ul de pe apex).
 *
 * Până acum programul stătea în DOUĂ locuri: aici, în aplicație, și încă o dată tastat de mână în
 * WordPress (tipul de articol `program` cu câmpuri ACF, randat de `content-single-program.php` din
 * tema `sfantulilie`). Cererea userului, 18.09.2026: „să nu ținem în două locuri programul" —
 * formatul de acolo se face de acum din datele noastre, iar WordPress-ul îl CERE, nu-l copiază.
 *
 * ⚠️ FORMA E A SITE-ULUI, NU A NOASTRĂ. HTML-ul de mai jos imită rând cu rând ce scotea tema
 * (`<ul>` → `<li>` cu „⁞ 07:00 – ", detaliile în `<em>→ …</em>` într-un `div.program-detalii`),
 * ca pe prima pagină să nu se schimbe NIMIC vizual — se schimbă doar de unde vin datele. De aceea
 * nu iese cu clasele tabelului nostru și nu-și aduce stil: CSS-ul e al temei, `.program-detalii`
 * există deja acolo. `class="rosu"` a rămas pe slujba de dimineață fiindcă așa o scria tema (azi
 * clasa n-are nicio regulă în `style.css` — dacă parohia o vopsește vreodată, merge singură).
 *
 * ⚠️ Zilele fără slujbe NU se scriu — ca în WordPress, unde preotul trecea doar zilele cu program.
 * Săptămâna se dă ÎNTREAGĂ, cu zilele trecute cu tot: așa arată și azi pagina.
 *
 * ⚠️ FIȘIERUL ĂSTA E TEMPORAR, SPUS ANUME DE USER (18.09.2026): „legătura cu site-ul actual este o
 * legătură temporară; când vom schimba site-ul, va dispărea și această necesitate". De aceea forma
 * site-ului stă SINGURĂ aici, nu amestecată în `foaie.ts`, și atârnă de o singură rută
 * (`/v1/bucata-site`): la trecerea apexului pe V2 se șterg fișierul, ruta, rândul din indexul `/v1`
 * și proba lui — atât, fără să rămână urme prin hârtiile care trăiesc mai departe.
 */
import type { IntrareVocabular, Slujba } from '@xc/contracts'
import { LUNI, ZILE_SAPTAMANA, adaugaZile, esc, ziuaSaptamanii } from '@xc/ui'
import { randurileSlujbei, type OptiuniFoaie } from './foaie.js'

/** „luni" → „Luni": vocabularul comun ține zilele cu literă mică, pagina le vrea cu majusculă. */
const cuMajuscula = (t: string): string => (t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}` : t)

function slujbaHtml(
  s: Slujba,
  categorie: IntrareVocabular['categorie'] | undefined,
  o: OptiuniFoaie,
  data: string,
): string {
  const dimineata = categorie === 'dimineata'
  const det = randurileSlujbei(
    s,
    dimineata ? 'dimineata' : 'seara',
    o.calendar?.zile.get(data),
    o.calendar?.zile.get(adaugaZile(data, 1)),
    o.dinCalendar,
    o.duminica,
  )
    .map((r) => `<em>→ ${esc(r.text)}</em><br/>`)
    .join('\n')
  return `⁞ ${esc(s.ora)} – <strong${dimineata ? ' class="rosu"' : ''}>${esc(s.nume)}</strong><br/>
<div class="program-detalii">${det}</div>`
}

/** Lista săptămânii, în HTML-ul primei pagini. Fără antet, fără stil — se lipește în `entry-content`. */
export function listaPrimeiPagini(o: OptiuniFoaie): string {
  const zile: string[] = []
  for (let i = 0; i < 7; i++) {
    const data = adaugaZile(o.luni, i)
    const ale = o.slujbe.filter((s) => s.data === data).sort((a, b) => a.ora.localeCompare(b.ora))
    if (!ale.length) continue
    const [, luna, zi] = data.split('-').map(Number) as [number, number, number]
    const eticheta = cuMajuscula(ZILE_SAPTAMANA[ziuaSaptamanii(data)] ?? '')
    const slujbe = ale.map((s) => slujbaHtml(s, o.vocabular.get(s.cod_nume)?.categorie, o, data)).join('\n')
    zile.push(`<li>
<strong>${esc(eticheta)}</strong>: ${zi} ${esc(LUNI[luna - 1] ?? '')}<br>
${slujbe}
</li>`)
  }
  return zile.length
    ? `<ul>\n${zile.join('\n')}\n</ul>`
    : `<p class="gol">Săptămână fără slujbe înregistrate.</p>`
}
