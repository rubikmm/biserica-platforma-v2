import { APLICATII_ADMINISTRABILE, ROLURI, Rol, SCOPE_GLOBAL, SESIUNE_ANONIMA, type SesiuneCurenta } from '@xc/contracts'
import { ClientAutorizare } from '@xc/authorization'
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { configChat, MODELE, normalizeaza, scrieConfigChat, type ConfigChat, type ModelDeAles } from '@xc/chat'
import { Logger, correlationId } from '@xc/observability'
import { alerta, dataVersiunii, esc, faraDiacritice, html, pagina } from '@xc/ui'
import { SCHEMA_CITITA_LA, SCHEMA_CORP, SCHEMA_STIL } from './schema-generata.js'
import pkg from '../package.json'

export interface Env {
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  AUTOMATIZARE: Fetcher
  COMUNICARE: Fetcher
  /** Comutatoarele modulelor. Panoul asta e SINGURUL loc din care se scriu. */
  CONFIG?: KVNamespace
  /** Cu el se legitimeaza pullerul de WhatsApp de pe NAS. Fara el, coada nu se deschide deloc. */
  SECRET_INTERN?: string
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  VERSIUNE?: { timestamp?: string }
}

interface IntrareAuditRand {
  action: string
  target: string
  outcome: string
  actor_id: string | null
  occurred_at: string
}

interface LivrareRand {
  channel: string
  recipient: string
  status: string
  provider: string
  template_id: string
  created_at: string
}

async function apelAutorizare(env: Env, cale: string, corp: unknown, cid: string): Promise<Response> {
  return env.AUTORIZARE.fetch(`https://authz.intern${cale}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-correlation-id': cid },
    body: JSON.stringify(corp),
  })
}

interface OmDinLista {
  userId: string
  email: string
  displayName: string | null
  disabledAt: string | null
}

async function listaOamenilor(env: Env, cid: string): Promise<OmDinLista[]> {
  const raspuns = await env.IDENTITATE.fetch('https://identity.intern/utilizatori/lista', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-correlation-id': cid },
    body: '{}',
  })
  if (!raspuns.ok) return []
  const date = (await raspuns.json()) as { utilizatori?: OmDinLista[] }
  return date.utilizatori ?? []
}

async function roluriPentru(env: Env, ids: string[], cid: string): Promise<Record<string, { role: string; scope: string }[]>> {
  if (!ids.length) return {}
  const raspuns = await apelAutorizare(env, '/roluri-multi', { ids }, cid)
  if (!raspuns.ok) return {}
  const date = (await raspuns.json()) as { roluri?: Record<string, { role: string; scope: string }[]> }
  return date.roluri ?? {}
}

function tabelAudit(intrari: IntrareAuditRand[]): string {
  if (!intrari.length) return '<p class="gol">Nicio intrare de audit încă.</p>'
  const randuri = intrari
    .map(
      (i) => `<tr>
        <td>${esc(i.action)}</td>
        <td><span class="eticheta ${i.outcome === 'success' ? 'publicat' : ''}">${esc(i.outcome)}</span></td>
        <td>${esc(i.occurred_at)}</td>
      </tr>`,
    )
    .join('')
  return `<table><thead><tr><th>Acțiune</th><th>Rezultat</th><th>Când</th></tr></thead><tbody>${randuri}</tbody></table>`
}

function tabelLivrari(livrari: LivrareRand[]): string {
  if (!livrari.length) return '<p class="gol">Nicio livrare înregistrată încă.</p>'
  const randuri = livrari
    .map(
      (l) => `<tr>
        <td>${esc(l.channel)}</td>
        <td>${esc(l.recipient)}</td>
        <td><span class="eticheta">${esc(l.status)}</span></td>
        <td>${esc(l.provider)}</td>
      </tr>`,
    )
    .join('')
  return `<table><thead><tr><th>Canal</th><th>Destinatar</th><th>Stare</th><th>Adaptor</th></tr></thead><tbody>${randuri}</tbody></table>`
}

/** Aplicatiile in care poate sta bula. Bifa nu face nimic acolo unde modulul nu e montat in cod
 *  (trei linii in `src/index.ts` al aplicatiei) — de aceea scrie sub tabel. */
const APLICATII_CU_CHAT = ['program', 'calendar', 'tipic', 'home', 'cont'] as const

function paginaModule(o: {
  comune: ReturnType<typeof comune>
  c: ConfigChat
  csrf: string
  salvat?: boolean
  prefix: string
}): string {
  const rand = (nume: string) => `<tr>
      <td><label class="bifa"><input type="checkbox" name="app-${nume}" ${o.c.aplicatii[nume] ? 'checked' : ''}> ${esc(nume)}</label></td>
    </tr>`
  const treapta = (valoare: string, scris: string, lamurire: string) => `<label class="bifa">
      <input type="radio" name="cineVede" value="${valoare}" ${o.c.cineVede === valoare ? 'checked' : ''}>
      <span>${scris} <small>${lamurire}</small></span>
    </label>`
  const optiune = (m: ModelDeAles) =>
    `<option value="${esc(m.id)}" ${o.c.model === m.id ? 'selected' : ''}>${esc(m.nume)} — ${esc(m.nota)}</option>`

  return pagina({
    ...o.comune,
    titluPagina: 'Module',
    corp: `<h2>Module</h2>
${o.salvat ? alerta('buna', 'Am salvat. Schimbarea se vede în cel mult un minut pe toate aplicațiile.') : ''}

<form method="post" action="${o.prefix}/module" class="module">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">

  <h3>Chat (AI)</h3>
  <p class="ajutor">Bula rotundă din colțul de jos, cu care se poate întreba și cere ceva aplicației.
  Răspunsurile vin de la un model de limbaj: <strong>fiecare mesaj costă bani</strong>, la fiecare apăsare.</p>

  <label class="bifa mare"><input type="checkbox" name="activ" ${o.c.activ ? 'checked' : ''}> <b>Pornit</b></label>

  <h4>În care aplicații</h4>
  <table><tbody>${APLICATII_CU_CHAT.map(rand).join('')}</tbody></table>
  <p class="ajutor">Bifa are efect numai acolo unde modulul e montat în cod. Azi: <code>program</code>.</p>

  <h4>Modelul</h4>
  <p class="ajutor">Oricare ar fi, cererile trec prin <strong>AI Gateway</strong> (poarta <code>xc-chat</code>), pe factura Cloudflare.
  Cele <strong>gratuite</strong> au 10.000 de neuroni pe zi fără plată; cele <strong>cu plată</strong> se plătesc din creditele AI Gateway (prețul e cel de listă al furnizorului, orientativ).</p>
  <select name="model" class="model">
    <option value="" ${o.c.model === '' ? 'selected' : ''}>Fără model — doar interfața, zero cost</option>
    <optgroup label="Cu plată — Anthropic (Claude), din credite">
      ${MODELE.filter((m) => m.grup === 'platit').map(optiune).join('')}
    </optgroup>
    <optgroup label="Gratuite — Workers AI (Cloudflare)">
      ${MODELE.filter((m) => m.grup === 'gratuit').map(optiune).join('')}
    </optgroup>
  </select>

  <h4>Îndrumări pentru model</h4>
  <p class="ajutor">Text liber, încărcat în instrucțiunile modelului la fiecare mesaj, sub regulile fixe: obiceiurile parohiei,
  cum să vorbească, ce să nu facă. Scurt și concret merge cel mai bine („Sfântul Maslu se face marți la 18:00; nu propune altă zi").</p>
  <textarea name="indrumari" class="indrumari" rows="8" maxlength="8000" placeholder="Ex.: Vorbește la persoana a doua, scurt. Programul se validează doar joi. Liturghia de duminică e mereu la 08:00.">${esc(o.c.indrumari)}</textarea>

  <h4>Uneltele permise</h4>
  <p class="ajutor">Ce poate face modelul în chat, un nume pe rând (<code>aplicatie.actiune</code>). Gol = toate acțiunile
  publicate. Cu cât lista e mai scurtă, cu atât un model mic nimerește mai bine: pentru „adaug și modific slujbe" ajung două rânduri.</p>
  <textarea name="unelte" class="indrumari" rows="4" spellcheck="false" placeholder="program.modifica_slujba
program.adauga_slujba">${esc(o.c.unelte.join('\n'))}</textarea>

  <h4>Cine îl vede</h4>
  <div class="trepte">
    ${treapta('admini', 'Doar adminii', 'costul rămâne mărginit; se probează întâi')}
    ${treapta('conturi', 'Cine are cont', 'enoriașii intrați; abuzul se leagă de un cont')}
    ${treapta('toti', 'Toată lumea', '⚠️ are nevoie întâi de o limitare pe IP — și de identitate de vizitator')}
  </div>

  <p><button type="submit">Salvează</button></p>
</form>`,
  })
}

/**
 * Ecranul OAMENILOR platformei.
 *
 * ⚠️ DIN 15.09.2026 E DOAR O LISTĂ (user: „elimină coloana cu «acum», adică ce rol are fiecare, și
 * la fel și coloana cu «de transformare a unui utilizator în administrator»… să fie doar o listă și
 * editarea o vedem mai târziu"). Au ieșit AMÂNDOUĂ coloanele: rolurile de acum și formularul de
 * numire. Rămâne numele, adresa și — dacă e cazul — semnul că un cont e închis; ăla nu e rol, e
 * starea contului, și fără el lista ar arăta un om viu acolo unde nu mai e nimeni.
 *
 * ⚠️ CE A RĂMAS ÎNTREG DEDESUBT: ruta `POST /oameni`, poarta ei `roles.manage` și auditul. Nu se
 * mai apasă de nicăieri, dar nu s-a șters nimic — „editarea o vedem mai târziu", deci întoarcerea
 * e o coloană de scris la loc, nu o rescriere. Pricina de la 14.09.2026 stă în picioare: „eu pot
 * să fac pe cineva super-admin… adică doar eu (alt super-admin)".
 *
 * ⚠️ Adresa din `EMAIL_SUPERADMIN` rămâne super-admin permanent, oricât s-ar umbla în altă parte:
 * identitatea îi pune rolul la loc la prima citire de sesiune.
 */
type Om = { userId: string; email: string; displayName: string | null; disabledAt: string | null }

/**
 * ORDINEA LISTEI (user, 15.09.2026: „pune mai întâi super adminii, apoi trage o linie. Pune apoi
 * administratorii și, în final, restul în ordine alfabetică").
 *
 * Trei cete, în ordinea puterii, fiecare alfabetică înăuntru. ⚠️ Alfabetul e ROMÂNESC
 * (`localeCompare(…, 'ro')`), nu cel al octeților: altfel „Ștefan" ar fi căzut după „Zoe", iar
 * lista ar fi părut amestecată taman la numele noastre. Cine n-are nume se așază după adresă.
 *
 * ⚠️ Rolurile nu se mai SCRIU în listă (coloana „Acum" a ieșit azi), dar se CITESC mai departe —
 * de aici. Dacă cineva scoate vreodată `roluriPentru` fiindcă „nu se mai vede nicăieri", cade
 * gruparea asta, nu doar o coloană.
 */
const CETE = ['super-admin', 'admin', 'restul'] as const
type Ceata = (typeof CETE)[number]

function ceataOmului(roluri: { role: string; scope: string }[] | undefined): Ceata {
  const ale = roluri ?? []
  if (ale.some((r) => r.role === 'super-admin')) return 'super-admin'
  if (ale.some((r) => r.role === 'admin')) return 'admin'
  return 'restul'
}

function paginaOameni(o: {
  comune: ReturnType<typeof comune>
  oameni: Om[]
  roluri: Record<string, { role: string; scope: string }[]>
  prefix: string
  /** ce s-a scris în căutare; lista de mai sus vine deja cernută prin el */
  q?: string
  mesaj?: string
}): string {
  const numeleDe = (u: Om) => (u.displayName ?? '').trim() || u.email
  const cete = new Map<Ceata, Om[]>(CETE.map((c) => [c, []]))
  for (const u of o.oameni) cete.get(ceataOmului(o.roluri[u.userId]))!.push(u)
  for (const lista of cete.values()) lista.sort((a, b) => numeleDe(a).localeCompare(numeleDe(b), 'ro'))

  const randOm = (u: Om) => `<tr>
        <td>${esc(u.displayName ?? '—')}${u.disabledAt ? ' <span class="eticheta">închis</span>' : ''}<div class="ajutor">${esc(u.email)}</div></td>
      </tr>`

  // ⚠️ Linia dintre cete e un RÂND al tabelului, nu un chenar pe primul om al cetei următoare: cu
  // chenarul, o ceată goală (niciun admin, de pildă) ar fi lăsat două linii lipite una de alta.
  const randuri = CETE.map((c) => cete.get(c)!)
    .filter((lista) => lista.length)
    .map((lista) => lista.map(randOm).join(''))
    .join('<tr class="rupe"><td></td></tr>')

  return pagina({
    ...o.comune,
    titluPagina: 'Oameni',
    corp: `<h2>Oameni</h2>
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${cautarea(o.prefix, o.q)}
<p class="ajutor">${
      o.q
        ? `${o.oameni.length} ${o.oameni.length === 1 ? 'om găsit' : 'oameni găsiți'} pentru „${esc(o.q)}".`
        : `Cine are cont pe platformă — ${o.oameni.length} ${o.oameni.length === 1 ? 'om' : 'oameni'}. Întâi super-administratorii, apoi administratorii, apoi restul.`
    }</p>
${o.oameni.length ? `<table class="oameni"><tbody>${randuri}</tbody></table>` : '<p class="ajutor">Nimeni.</p>'}`,
  })
}

/**
 * TABELUL ADMINILOR PE APLICAȚII (user, 18.09.2026: „vreau la zona mea generală de administrare un
 * tabel cu oamenii și aplicațiile și bulina la intersecție — unde sunt ei admini").
 *
 * Oamenii pe rânduri, aplicațiile pe coloane, bulina la intersecție. ⚠️ Tabelul e de VEDERE: numirea
 * se face în fiecare aplicație, în Setările ei („eu îi setez la fiecare aplicație în parte"). De aceea
 * fiecare nume de aplicație din cap e o legătură spre Setările ei — de acolo se umblă.
 *
 * ⚠️ BULINA ARE DOUĂ FELURI, fiindcă dreptul vine pe două drumuri și numai unul se poate lua din
 * aplicație: plină = numit anume la aplicația aceea (grant punctual, se poate scoate); conturată =
 * îi vine din rolul lui pe platformă (se schimbă doar coborând rolul, din Oameni). Un tabel cu o
 * singură bulină ar fi arătat un drept care pare al aplicației, dar nu e.
 *
 * ⚠️ În tabel intră numai oamenii care au măcar o bulină. Restul conturilor n-au ce căuta aici — la
 * 29 de conturi ar fi fost 29 de rânduri goale, iar la 300 ar fi fost o pagină de nimic.
 */
function paginaAdmini(o: {
  comune: ReturnType<typeof comune>
  oameni: Om[]
  /** cheia aplicației → cine o are, pe cele două drumuri */
  harta: Record<string, { prinGrant: string[]; prinRol: string[] }>
  roluri: Record<string, { role: string; scope: string }[]>
  nav: ReturnType<typeof navigatieDin>
  prefix: string
}): string {
  const numele = (u: Om) => (u.displayName ?? '').trim() || u.email
  const are = (cheie: string, userId: string, fel: 'prinGrant' | 'prinRol') =>
    (o.harta[cheie]?.[fel] ?? []).includes(userId)
  const areCeva = (u: Om) =>
    APLICATII_ADMINISTRABILE.some(
      (a) => are(a.cheieAdmin, u.userId, 'prinGrant') || are(a.cheieAdmin, u.userId, 'prinRol'),
    )
  const rolulLui = (u: Om) => {
    const ale = o.roluri[u.userId] ?? []
    if (ale.some((r) => r.role === 'super-admin')) return 'super-admin'
    if (ale.some((r) => r.role === 'admin')) return 'admin'
    return 'utilizator'
  }

  const randuri = o.oameni
    .filter(areCeva)
    .sort((x, y) => numele(x).localeCompare(numele(y), 'ro'))
    .map((u) => {
      const celule = APLICATII_ADMINISTRABILE.map((a) => {
        const numit = are(a.cheieAdmin, u.userId, 'prinGrant')
        const dinRol = are(a.cheieAdmin, u.userId, 'prinRol')
        const spune = numit
          ? `${numele(u)} e numit administrator la ${a.nume}`
          : dinRol
            ? `${numele(u)} are ${a.nume} din rolul lui pe platformă`
            : `${numele(u)} nu e administrator la ${a.nume}`
        const semn = numit
          ? '<span class="bul plina"></span>'
          : dinRol
            ? '<span class="bul din-rol"></span>'
            : '<span class="bul nimic"></span>'
        return `<td class="mij" title="${esc(spune)}"><span class="ascuns-vizual">${esc(spune)}</span>${semn}</td>`
      }).join('')
      return `<tr>
        <th scope="row">${esc(numele(u))}<div class="ajutor">${esc(u.email)}</div></th>
        <td class="mij"><span class="eticheta">${esc(rolulLui(u))}</span></td>
        ${celule}
      </tr>`
    })
    .join('')

  const cap = APLICATII_ADMINISTRABILE.map((a) => {
    const adresa = o.nav[codNavigatie(a.cod)] ?? ''
    const nume = esc(a.nume)
    return `<th scope="col">${
      adresa ? `<a href="${esc(adresa)}/setari" title="Setările ${nume} — de acolo se numesc adminii ei">${nume}</a>` : nume
    }</th>`
  }).join('')

  return pagina({
    ...o.comune,
    titluPagina: 'Administratori pe aplicații',
    corp: `<h2>Administratori pe aplicații</h2>
<p class="ajutor">Cine ține fiecare aplicație. Un administrator de aplicație are drepturile <em>acolo</em>
și nimic în plus pe restul platformei. Numirea se face în <strong>Setările fiecărei aplicații</strong> —
numele din cap sunt legături spre ele.</p>
${
  randuri
    ? `<div class="matrice-cadru"><table class="matrice">
  <thead><tr><th scope="col">Cine</th><th scope="col">Rolul pe platformă</th>${cap}</tr></thead>
  <tbody>${randuri}</tbody>
</table></div>`
    : '<p class="ajutor">Nimeni nu e administrator nicăieri încă.</p>'
}
<p class="ajutor legenda">
  <span class="bul plina"></span> numit la aplicația aceea — se poate scoate din Setările ei &nbsp;·&nbsp;
  <span class="bul din-rol"></span> îi vine din rolul lui pe platformă — se schimbă din
  <a href="${o.prefix}/oameni">Oameni</a>
</p>
<p class="ajutor">⚠️ <strong>LIVE și Radio au o singură cheie</strong> (<code>broadcast.manage</code>):
panoul e unul și comandă un singur aparat, deci cele două buline se aprind și se sting împreună.</p>`,
  })
}

/** Cheia din navigație pentru codul aplicației (`home` → `home`, `buletin` → `buletin`…). */
function codNavigatie(cod: string): keyof ReturnType<typeof navigatieDin> {
  return cod as keyof ReturnType<typeof navigatieDin>
}

/**
 * CĂUTAREA, sus (user, 15.09.2026: „să existe și o căutare în zona de sus").
 *
 * ⚠️ E un formular GET, cernut la SERVER, nu o ascundere de rânduri din JS: așa adresa căutării se
 * poate trimite mai departe, merge fără JavaScript, iar lista rămâne grupată pe cete (o cernere din
 * JS ar fi lăsat în urmă liniile dintre cete golite de oameni).
 */
function cautarea(prefix: string, q?: string): string {
  return `<form class="cauta-oameni" method="get" action="${prefix}/oameni" role="search">
  <input type="search" name="q" value="${esc(q ?? '')}" placeholder="caută după nume sau adresă" aria-label="Caută un om">
  <button type="submit">Caută</button>
  ${q ? `<a class="ajutor" href="${prefix}/oameni">arată-i pe toți</a>` : ''}
</form>`
}

interface AudientaRand {
  id: string
  nume: string
  email: number
  whatsapp: number
}

interface StareDispecerat {
  livrareReala: boolean
  audiente: AudientaRand[]
  coadaWhatsapp: number
  ultimaLuareDePuller: string | null
}

interface CerereTrimisa {
  id: string
  subject: string | null
  created_at: string
  destinatari: number
  esuate: number
}

/**
 * Dispeceratul: cele doua drumuri pe care iese un cuvant din parohie, intr-un singur ecran.
 *
 * ⚠️ Nu se poarta la fel: e-mailul pleaca DIN Cloudflare, pe loc; WhatsApp-ul intra in coada si
 * pleaca DE ACASA, prin pullerul care intreaba din minut in minut. De aceea starile sunt scrise
 * separat — un mesaj „in coada" nu inseamna „trimis", si pagina n-are voie sa para ca inseamna.
 */
function paginaDispecerat(o: {
  comune: ReturnType<typeof comune>
  stare: StareDispecerat | null
  cereri: CerereTrimisa[]
  potTrimite: boolean
  csrf: string
  prefix: string
  mesaj?: string
  mesajRau?: string
}): string {
  const s = o.stare
  const audiente = s?.audiente ?? []

  const cartonas = (titlu: string, stare: string, bine: boolean, lamurire: string) => `<div class="canal">
      <h4>${titlu}</h4>
      <p class="stare ${bine ? 'merge' : 'tace'}">${esc(stare)}</p>
      <p class="ajutor">${lamurire}</p>
    </div>`

  const randAudienta = (a: AudientaRand) => `<tr>
      <td>${esc(a.nume)}<div class="ajutor">${esc(a.id)}</div></td>
      <td>${a.email}</td>
      <td>${a.whatsapp}</td>
    </tr>`

  const randCerere = (c: CerereTrimisa) => `<tr>
      <td>${esc(c.subject ?? '—')}</td>
      <td>${c.destinatari}</td>
      <td>${c.esuate ? `<span class="eticheta rau">${c.esuate} eșuate</span>` : '<span class="eticheta publicat">toate</span>'}</td>
      <td>${esc(c.created_at)}</td>
    </tr>`

  const optiuniAudiente = audiente.length
    ? audiente.map((a) => `<option value="${esc(a.id)}">${esc(a.nume)} (${a.email} e-mail · ${a.whatsapp} WhatsApp)</option>`).join('')
    : '<option value="">— nicio audiență —</option>'

  return pagina({
    ...o.comune,
    titluPagina: 'Dispecerat',
    corp: `<h2>Dispecerat</h2>
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${o.mesajRau ? alerta('rea', esc(o.mesajRau)) : ''}
<p class="ajutor">Cele două drumuri pe care iese un cuvânt din parohie. Aplicațiile nu trimit singure
nimic: ele cer, iar de aici pleacă — într-un singur loc, cu o singură arhivă.</p>

<div class="canale">
  ${cartonas(
    'E-mail',
    s?.livrareReala ? 'trimite' : 'sandbox — nu pleacă nimic',
    !!s?.livrareReala,
    'Prin Cloudflare Email Service. Cât timp scrie „sandbox", scrisorile se înregistrează, dar nu ies din casă.',
  )}
  ${cartonas(
    'WhatsApp',
    s ? `${s.coadaWhatsapp} în coadă` : 'necunoscut',
    !!s && s.coadaWhatsapp === 0,
    `Nu pleacă din Cloudflare: mesajele așteaptă aici, iar aparatul din casă (WAHA, pe NAS) le ia prin puller.
     Ultima dată când a întrebat: ${esc(s?.ultimaLuareDePuller ?? 'niciodată')}.`,
  )}
</div>

<h3>Audiențe</h3>
${
  audiente.length
    ? `<table><thead><tr><th>Audiență</th><th>E-mail</th><th>WhatsApp</th></tr></thead><tbody>${audiente.map(randAudienta).join('')}</tbody></table>`
    : '<p class="gol">Nicio audiență încă. Abonările aplicațiilor se strâng aici.</p>'
}

<h3>Trimite</h3>
${
  o.potTrimite
    ? `<form method="post" action="${o.prefix}/dispecerat" class="module">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <h4>Către</h4>
  <select name="audienta" class="model">${optiuniAudiente}</select>
  <h4>Pe ce drum</h4>
  <div class="trepte">
    <label class="bifa"><input type="radio" name="canal" value="email" checked> <span>E-mail <small>pleacă acum, din Cloudflare</small></span></label>
    <label class="bifa"><input type="radio" name="canal" value="whatsapp"> <span>WhatsApp <small>intră în coadă; pleacă de acasă</small></span></label>
  </div>
  <h4>Subiect <small>(numai la e-mail)</small></h4>
  <input type="text" name="subiect" maxlength="300" class="subiect">
  <h4>Textul</h4>
  <textarea name="text" class="indrumari" rows="8" maxlength="8000" required></textarea>
  <p><button type="submit">Trimite</button></p>
</form>`
    : alerta('info', 'Poți vedea dispeceratul, dar trimiterea cere <code>communication.send</code>.')
}

<h3>Ce a plecat de aici</h3>
${
  o.cereri.length
    ? `<table><thead><tr><th>Subiect</th><th>Destinatari</th><th>Livrare</th><th>Când</th></tr></thead><tbody>${o.cereri.map(randCerere).join('')}</tbody></table>`
    : '<p class="gol">Nimic încă.</p>'
}`,
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const nav = navigatieDin(cfg)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-admin', correlationId: cid })
    const url = new URL(req.url)

    /**
     * ⚠️ Singura usa a Dispeceratului deschisa spre internet FARA sesiune: pullerul de WhatsApp de
     * pe NAS (`biserica-whatsapp-puller`) nu e om, n-are cont si nu poate avea unul. Se legitimeaza
     * cu `x-xc-intern`; fara antet raspundem 404, nu 403 — ca sa nu se afle ca usa exista.
     *
     * Trece prin `admin` fiindca `communication-worker` n-are adresa publica si nici nu capata una:
     * serviciile raman interne, aplicatia e BFF-ul lor. Aici nu se decide nimic, doar se duce mai
     * departe cererea.
     */
    if (url.pathname.endsWith('/dispecerat/coada') || url.pathname.endsWith('/dispecerat/livrat')) {
      const secret = (env.SECRET_INTERN ?? '').trim()
      if (req.method !== 'POST' || !secret || req.headers.get('x-xc-intern') !== secret) {
        return new Response('not found', { status: 404 })
      }
      const catre = url.pathname.endsWith('/coada') ? '/coada' : '/livrat'
      return env.COMUNICARE.fetch(`https://comunicare.intern${catre}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-correlation-id': cid },
        body: await req.text(),
      })
    }

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)

    if (!principal) {
      return new Response(null, { status: 303, headers: { location: `${nav.cont}/auth/login` } })
    }

    const eAdmin = sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin')
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)
    const { prefix, cale } = prefixSiCale(url, '/admin')

    /*
     * ------------------------------------------------------------- schema
     * Cum e legata platforma pe Cloudflare: desenul, configuratia generala si o fisa pentru fiecare
     * aplicatie. Cere `audit.read`, ca panoul — aratam adrese interne, nume de resurse si numele
     * secretelor, deci nu e pagina oricui. ⚠️ VALORILE secretelor NU apar: Cloudflare nu le da
     * inapoi nimanui, iar unealta nici nu le cere.
     *
     * ⚠️ Continutul e GENERAT si adus in cod (`schema-generata.ts`), nu citit acum de la Cloudflare:
     * un worker n-are ce cauta cu tokenul contului in el. Deci e o FOTOGRAFIE de la ultima rulare a
     * uneltei, si asta scrie pe pagina. Se improspateaza cu:
     *   node infrastructure/harta/schema-cloudflare.mjs --ts > apps/admin/src/schema-generata.ts
     */
    if (cale === '/schema') {
      const comuneAici = comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url))
      const potVedea = await authz.can(principal, 'audit.read', SCOPE_GLOBAL)
      if (!potVedea.allowed) {
        return html(
          pagina({ ...comuneAici, corp: `<h2>Schema platformei</h2>${alerta('rea', 'Îți trebuie permisiunea <code>audit.read</code>.')}` }),
          403,
        )
      }
      return html(
        pagina({
          ...comuneAici,
          local: `${comuneAici.local}\n${SCHEMA_STIL}`,
          corp: `<h2>Schema platformei</h2>
${alerta('info', `Fotografie a contului Cloudflare de la <strong>${esc(SCHEMA_CITITA_LA)}</strong>. Nu se împrospătează singură.`)}
${SCHEMA_CORP}`,
        }),
      )
    }

    // ------------------------------------------------------------- module
    // Aprinderea si stingerea modulelor cere `modules.manage` — la super-admin, nu la admin:
    // un modul pornit costa bani la fiecare apasare.
    if (cale === '/module') {
      const potModule = await authz.can(principal, 'modules.manage', SCOPE_GLOBAL)
      const comuneAici = comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url))
      if (!potModule.allowed) {
        return html(
          pagina({ ...comuneAici, corp: `<h2>Module</h2>${alerta('rea', 'Îți trebuie permisiunea <code>modules.manage</code>.')}` }),
          403,
        )
      }

      const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
      if (req.method === 'POST') {
        const problemaOrigine = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
        const formular = await req.formData()
        const problemaJeton = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaOrigine || problemaJeton) {
          return html(
            pagina({ ...comuneAici, corp: `<h2>Module</h2>${alerta('rea', problemaOrigine ?? problemaJeton ?? 'Cerere respinsă.')}` }),
            403,
          )
        }
        const aplicatii: Record<string, boolean> = {}
        for (const [cheie, valoare] of formular.entries()) {
          if (cheie.startsWith('app-') && valoare) aplicatii[cheie.slice(4)] = true
        }
        const nou = normalizeaza({
          activ: formular.get('activ') === 'on',
          aplicatii,
          cineVede: String(formular.get('cineVede') ?? 'admini'),
          model: String(formular.get('model') ?? ''),
          indrumari: String(formular.get('indrumari') ?? ''),
          unelte: String(formular.get('unelte') ?? ''),
        })
        await scrieConfigChat(env, nou)
        log.info('module: comutator schimbat', { activ: nou.activ, cineVede: nou.cineVede, model: nou.model, aplicatii: Object.keys(nou.aplicatii) })
        return html(paginaModule({ comune: comuneAici, c: nou, csrf: csrf.jeton, salvat: true, prefix }))
      }

      return html(
        paginaModule({ comune: comuneAici, c: await configChat(env), csrf: csrf.jeton, prefix }),
        200,
        csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
      )
    }

    // ------------------------------------------------------------- oameni
    if (cale === '/oameni') {
      const comuneAici = comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url))
      const potNumi = await authz.can(principal, 'roles.manage', SCOPE_GLOBAL)
      if (!potNumi.allowed) {
        return html(
          pagina({ ...comuneAici, corp: `<h2>Oameni</h2>${alerta('rea', 'Numirea rolurilor e numai a super-administratorilor (<code>roles.manage</code>).')}` }),
          403,
        )
      }

      // Cookie-ul CSRF se dă mai departe, deși pagina n-are acum niciun formular care scrie: ruta
      // de numire e întreagă dedesubt, iar fără cookie ea ar fi nu doar nelegată, ci moartă.
      const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
      let mesaj: string | undefined

      /*
       * ⚠️ NUMIREA N-ARE FORMULAR ÎN PAGINĂ din 15.09.2026 (user: „să fie doar o listă și editarea
       * o vedem mai târziu"), dar ruta a rămas ÎNTREAGĂ, cu poarta și auditul ei. Nu se cheamă de
       * nicăieri; când editarea se întoarce, se scrie coloana la loc și atât.
       */
      if (req.method === 'POST') {
        const problemaOrigine = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
        const formular = await req.formData()
        const problemaJeton = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaOrigine || problemaJeton) {
          return html(
            pagina({ ...comuneAici, corp: `<h2>Oameni</h2>${alerta('rea', problemaOrigine ?? problemaJeton ?? 'Cerere respinsă.')}` }),
            403,
          )
        }
        const userId = String(formular.get('userId') ?? '')
        const rolCerut = Rol.safeParse(String(formular.get('rol') ?? ''))
        if (!userId || !rolCerut.success) {
          return html(pagina({ ...comuneAici, corp: `<h2>Oameni</h2>${alerta('rea', 'Cerere incompletă.')}` }), 400)
        }
        // Un singur rol global pe om: cel nou se pune, celelalte se sting. Altfel „coborât la
        // utilizator" ar lasa in urma un `admin` vechi care ar continua sa lucreze.
        for (const r of ROLURI) {
          if (r === rolCerut.data) continue
          await apelAutorizare(env, '/revoca', { userId, role: r, scope: SCOPE_GLOBAL }, cid)
        }
        await apelAutorizare(env, '/atribuie', { userId, role: rolCerut.data, scope: SCOPE_GLOBAL, correlationId: cid }, cid)
        log.info('rol numit', { userId, rol: rolCerut.data, deCatre: principal.userId })
        mesaj = 'Rolul a fost schimbat. Se vede la următoarea pagină pe care o deschide omul.'
      }

      const toti = await listaOamenilor(env, cid)
      // ⚠️ Rolurile se cer pentru TOȚI, nu doar pentru cei găsiți: gruparea pe cete e a listei
      // întregi, iar o căutare nu schimbă cui i se cuvine ce loc.
      const roluri = await roluriPentru(env, toti.map((u) => u.userId), cid)
      const q = (url.searchParams.get('q') ?? '').trim()
      // Căutarea se face fără diacritice și fără majuscule: „stefan" îl găsește pe „Ștefan".
      const cheie = faraDiacritice(q)
      const oameni = cheie
        ? toti.filter((u) => faraDiacritice(`${u.displayName ?? ''} ${u.email}`).includes(cheie))
        : toti
      return html(
        paginaOameni({ comune: comuneAici, oameni, roluri, prefix, ...(q ? { q } : {}), ...(mesaj ? { mesaj } : {}) }),
        200,
        csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
      )
    }

    // ------------------------------------------------------------- admini pe aplicații
    /*
     * TABELUL ADMINILOR PE APLICAȚII (user, 18.09.2026). Poarta e `roles.manage` — cheia care vine
     * numai cu super-adminul, ca la Oameni: „la zona mea generală de administrare".
     *
     * ⚠️ Se citește DOAR, nu se scrie nimic de aici: numirea stă în Setările fiecărei aplicații.
     * O întrebare la autorizare pentru toate cheile deodată (`/harta-admini`), nu una pe aplicație.
     */
    if (cale === '/admini') {
      const comuneAici = comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url))
      const potVedea = await authz.can(principal, 'roles.manage', SCOPE_GLOBAL)
      if (!potVedea.allowed) {
        return html(
          pagina({ ...comuneAici, corp: `<h2>Administratori pe aplicații</h2>${alerta('rea', 'Tabelul e al super-administratorilor (<code>roles.manage</code>).')}` }),
          403,
        )
      }
      const chei = APLICATII_ADMINISTRABILE.map((a) => a.cheieAdmin)
      const [oameni, raspunsHarta] = await Promise.all([
        listaOamenilor(env, cid),
        apelAutorizare(env, '/harta-admini', { chei }, cid),
      ])
      const harta = raspunsHarta.ok
        ? ((await raspunsHarta.json()) as { harta: Record<string, { prinGrant: string[]; prinRol: string[] }> }).harta
        : {}
      if (!raspunsHarta.ok) {
        log.error('harta adminilor nu a venit', { stare: raspunsHarta.status })
      }
      const roluri = await roluriPentru(env, oameni.map((u) => u.userId), cid)
      return html(
        raspunsHarta.ok
          ? paginaAdmini({ comune: comuneAici, oameni, harta, roluri, nav, prefix })
          : pagina({ ...comuneAici, corp: `<h2>Administratori pe aplicații</h2>${alerta('rea', 'Autorizarea nu a răspuns — tabelul nu s-a putut aduce.')}` }),
        raspunsHarta.ok ? 200 : 502,
      )
    }

    // ------------------------------------------------------------- dispecerat
    /**
     * DISPECERATUL (user, 14.09.2026). Din A7 „comunicari" al V1 nu se porteaza aplicatia, ci
     * doua functii: e-mailul (Cloudflare) si WhatsApp-ul (WAHA de pe NAS, prin puller). Sta AICI,
     * in Administrare — „fara subdomeniu nou", cerut anume.
     *
     * Ecranul e BFF: nu tine nimic. Audientele, sabloanele, coada si arhiva stau la
     * `communication-worker`, ca pana acum.
     */
    if (cale === '/dispecerat') {
      const comuneAici = comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url))
      const potVedea = await authz.can(principal, 'communication.create', SCOPE_GLOBAL)
      if (!potVedea.allowed) {
        return html(
          pagina({ ...comuneAici, corp: `<h2>Dispecerat</h2>${alerta('rea', 'Îți trebuie permisiunea <code>communication.create</code>.')}` }),
          403,
        )
      }
      const potTrimite = (await authz.can(principal, 'communication.send', SCOPE_GLOBAL)).allowed

      const cereComunicare = async <T>(ruta: string, corp: unknown): Promise<T | null> => {
        const raspuns = await env.COMUNICARE.fetch(`https://comunicare.intern${ruta}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-correlation-id': cid },
          body: JSON.stringify(corp),
        })
        return raspuns.ok ? ((await raspuns.json()) as T) : null
      }

      const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
      let mesaj: string | undefined
      let mesajRau: string | undefined

      if (req.method === 'POST') {
        const problemaOrigine = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
        const formular = await req.formData()
        const problemaJeton = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaOrigine || problemaJeton) {
          return html(pagina({ ...comuneAici, corp: `<h2>Dispecerat</h2>${alerta('rea', problemaOrigine ?? problemaJeton ?? 'Cerere respinsă.')}` }), 403)
        }
        if (!potTrimite) {
          mesajRau = 'Trimiterea cere permisiunea communication.send.'
        } else {
          const audienceId = String(formular.get('audienta') ?? '')
          const channel = String(formular.get('canal') ?? 'email') === 'whatsapp' ? 'whatsapp' : 'email'
          const subiect = String(formular.get('subiect') ?? '').trim()
          const text = String(formular.get('text') ?? '').trim()
          if (!audienceId || !text) {
            mesajRau = 'Alege audiența și scrie textul.'
          } else {
            const raspuns = await cereComunicare<{ plecate: number; asteapta: number; suprimate: number }>('/trimite-audienta', {
              audienceId,
              channel,
              subiect,
              text,
              sursa: 'dispecerat',
              idempotencyKey: `dispecerat:${principal.userId}:${Date.now()}`,
              correlationId: cid,
            })
            if (!raspuns) mesajRau = 'Comunicarea n-a primit cererea.'
            else {
              log.info('dispecerat: trimitere', { audienceId, channel, ...raspuns, deCatre: principal.userId })
              mesaj =
                channel === 'whatsapp'
                  ? `${raspuns.asteapta} mesaje au intrat în coadă. Pleacă de acasă, prin puller, în cel mult un minut.`
                  : `${raspuns.plecate} scrisori înregistrate${raspuns.suprimate ? `, ${raspuns.suprimate} oprite de preferințe` : ''}.`
            }
          }
        }
      }

      const stare = await cereComunicare<StareDispecerat>('/stare', {})
      const istoric = await cereComunicare<{ cereri: CerereTrimisa[] }>('/istoric', { sursa: 'dispecerat', limita: 15 })

      return html(
        paginaDispecerat({
          comune: comuneAici,
          stare,
          cereri: istoric?.cereri ?? [],
          potTrimite,
          csrf: csrf.jeton,
          prefix,
          ...(mesaj ? { mesaj } : {}),
          ...(mesajRau ? { mesajRau } : {}),
        }),
        200,
        csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
      )
    }

    /*
     * ⚠️ POARTA PANOULUI NU MAI E `audit.read` (15.09.2026). Cheia aceea a ieșit din rolul de
     * administrator, odată cu zona de loguri din Setări (user: „scot audit.read de la
     * administrator") — iar pagina asta se sprijinea tocmai pe ea, deci părintele ar fi luat 403 pe
     * TOT panoul: fără Oameni, fără Dispecerat, fără Module. Nu asta a cerut.
     *
     * De aceea poarta s-a mutat pe cheile FIECĂREI secțiuni: intri dacă ai măcar una, și vezi
     * exact secțiunile pe care le poți folosi. Regula platformei: drepturile hotărăsc folosirea,
     * nu se verifică niciodată `rol === 'admin'`.
     */
    const [potJurnal, potOameni, potComunica, potModule] = await Promise.all([
      authz.can(principal, 'audit.read', SCOPE_GLOBAL),
      authz.can(principal, 'roles.manage', SCOPE_GLOBAL),
      authz.can(principal, 'communication.create', SCOPE_GLOBAL),
      authz.can(principal, 'modules.manage', SCOPE_GLOBAL),
    ])
    const chei = {
      jurnal: potJurnal.allowed,
      oameni: potOameni.allowed,
      comunica: potComunica.allowed,
      module: potModule.allowed,
    }

    if (!chei.jurnal && !chei.oameni && !chei.comunica && !chei.module) {
      return html(
        pagina({
          ...comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url)),
          corp: `<h2>Administrare</h2>
            ${alerta('rea', 'Nu ai nicio permisiune de administrare.')}
            <p class="ajutor">Ești autentificat ca ${esc(principal.email)}, dar fără drepturile necesare.
            Asta confirmă totuși că sesiunea funcționează și pe această aplicație.</p>`,
        }),
        403,
      )
    }

    try {
      // ⚠️ Nu se cere ce n-are omul voie să vadă: fără cheie nu se face nici drumul la serviciu.
      const [raspunsAudit, raspunsLivrari, raspunsActiuni] = await Promise.all([
        chei.jurnal
          ? env.AUDIT.fetch('https://audit.intern/citeste', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ limita: 25 }),
            })
          : Promise.resolve(null),
        chei.comunica
          ? env.COMUNICARE.fetch('https://comunicare.intern/livrari', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ limita: 25 }),
            })
          : Promise.resolve(null),
        env.AUTOMATIZARE.fetch('https://automation.intern/actiuni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ])

      const audit = raspunsAudit?.ok
        ? ((await raspunsAudit.json()) as { intrari: IntrareAuditRand[] }).intrari
        : []
      const livrari = raspunsLivrari?.ok
        ? ((await raspunsLivrari.json()) as { livrari: LivrareRand[] }).livrari
        : []
      const actiuni = raspunsActiuni.ok
        ? ((await raspunsActiuni.json()) as { actiuni: unknown[] }).actiuni
        : []

      return html(
        pagina({
          ...comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url)),
          corp: `
<h2>Administrare</h2>
  <p>Ești autentificat ca <strong>${esc(principal.email)}</strong> — fără să te fi
  autentificat din nou pe această aplicație. Rolurile tale: ${sesiune.roles
    .map((r) => `<span class="eticheta">${esc(r.role)}</span>`)
    .join(' ')}</p>
  ${alerta('info', `Automatizarea a produs <strong>${actiuni.length}</strong> acțiuni până acum. Nicio comunicare reală nu a plecat: toate adaptoarele sunt în sandbox.`)}

<p>${[
    chei.oameni ? `<a href="${prefix}/oameni">Oameni — rolurile pe platformă</a>` : '',
    chei.oameni ? `<a href="${prefix}/admini">Administratori pe aplicații — cine ține ce</a>` : '',
    chei.comunica ? `<a href="${prefix}/dispecerat">Dispecerat — e-mailul și WhatsApp-ul parohiei</a>` : '',
    chei.module ? `<a href="${prefix}/module">Module — pornirea și oprirea chatului</a>` : '',
    chei.jurnal ? `<a href="${prefix}/schema">Schema platformei — cum sunt legate toate pe Cloudflare</a>` : '',
  ]
    .filter(Boolean)
    .join('<br>')}</p>

${chei.jurnal ? `<h3>Audit — ultimele acțiuni</h3>
  ${tabelAudit(audit)}` : ''}

${chei.comunica ? `<h3>Comunicare — livrări înregistrate</h3>
  ${tabelLivrari(livrari)}` : ''}`,
        }),
      )
    } catch (e) {
      log.error('eroare la citirea panoului', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        pagina({
          ...comune(env, nav, eAdmin, sesiune, adresaPaginii(cfg, url)),
          corp: `${alerta("rea", "Nu am putut citi datele panoului.")}`,
        }),
        500,
      )
    }
  },
}

/** Carcasa comuna a paginilor de administrare. */
function comune(
  env: Env,
  nav: ReturnType<typeof navigatieDin>,
  eAdmin: boolean,
  sesiune: SesiuneCurenta,
  spre: string,
) {
  return {
    // ⚠️ In antet scrie ADMIN, nu ADMINISTRARE (user, 15.09.2026: „e prea lung acum") — numele
    // intreg a ramas doar in `titlu`, adica in <title>.
    nume: 'ADMIN',
    titlu: 'Administrarea platformei',
    acasa: `${nav.admin}/`,
    urlPlatforma: nav.home || '/',
    local: STIL,
    versiune: pkg.version,
    modificata: dataVersiunii(env.VERSIUNE),
    cont: {
      intrat: true,
      // Numele din meniul contului se scrie la fel ca in restul aplicatiilor: numele omului, si
      // abia daca lipseste adresa lui (user, 15.09.2026). Pana acum aici era doar e-mailul.
      nume: sesiune.user?.displayName ?? sesiune.user?.email ?? 'Cont',
      admin: eAdmin,
      urlCont: nav.cont,
      urlAdmin: nav.admin,
      poateVedeaCa: sesiune.poateVedeaCa,
      veziCa: sesiune.veziCa,
      spre,
    },
  }
}

const STIL = `
.module h3 { margin-top:26px }
.module h4 { margin:20px 0 8px; font:600 13px/1 ui-sans-serif,system-ui; letter-spacing:.04em;
             text-transform:uppercase; color:var(--faint) }
/* ⚠️ Carcasa are stiluri GLOBALE pe form si label (rand de cautare): formularul si le scoate aici. */
form.module { display:block }
.module textarea.indrumari { width:100%; padding:9px 11px; border:1px solid var(--rule); border-radius:8px;
                             background:var(--paper); color:var(--ink); font:15px/1.45 ui-sans-serif,system-ui; resize:vertical }
.module select.model { max-width:100%; padding:8px 10px; border:1px solid var(--rule); border-radius:8px;
                       background:var(--paper); color:var(--ink); font:15px/1.3 ui-sans-serif,system-ui }
.module label.bifa { display:flex; align-items:baseline; gap:8px; font:15px/1.5 inherit;
                     color:var(--ink); text-transform:none; letter-spacing:normal; padding:4px 0 }
.module label.bifa.mare { font-size:17px }
.module label.bifa small { color:var(--faint); font-size:13px; display:block }
.module .trepte { display:flex; flex-direction:column; gap:4px }
.module table { width:auto; margin:0 }
.module button { padding:8px 16px; border-radius:8px; border:1px solid var(--rosu);
                 background:var(--rosu); color:#fff; font:600 14px ui-sans-serif,system-ui; cursor:pointer }
.ajutor { color:var(--soft); font-size:14px }
.eticheta { display:inline-block; border:1px solid var(--rule); border-radius:999px;
            padding:1px 8px; font:12px ui-sans-serif,system-ui; color:var(--soft) }
.eticheta.publicat { border-color:#2E8A4A; color:#2E8A4A }
.eticheta.rau { border-color:var(--rosu); color:var(--rosu) }
/* Dispecerat: cele doua canale, unul langa altul; pe telefon se aseaza unul sub altul. */
.canale { display:flex; gap:14px; flex-wrap:wrap; margin:14px 0 4px }
.canal { flex:1 1 0; min-width:240px; border:1px solid var(--rule); border-radius:10px; padding:12px 14px }
.canal h4 { margin:0 0 6px; font:600 13px/1 ui-sans-serif,system-ui; letter-spacing:.04em;
            text-transform:uppercase; color:var(--faint) }
.canal .stare { margin:0 0 6px; font:600 17px/1.3 ui-sans-serif,system-ui }
.canal .stare.merge { color:#2E8A4A }
.canal .stare.tace { color:var(--rosu) }
.module input.subiect { width:100%; padding:9px 11px; border:1px solid var(--rule); border-radius:8px;
                        background:var(--paper); color:var(--ink); font:15px/1.45 ui-sans-serif,system-ui }
.module h4 small { text-transform:none; letter-spacing:normal; color:var(--faint); font-weight:400 }
/* Numirea: selectorul si butonul pe acelasi rand, ca tabelul sa nu se inalte la fiecare om.
   ⚠️ Formularul nu se mai scrie in pagina din 15.09.2026 („editarea o vedem mai tarziu"), dar ruta
   si stilul lui raman — intoarcerea e o coloana de scris la loc. */
form.numire { display:flex; gap:8px; align-items:center; margin:0 }
form.numire select { padding:6px 8px; border:1px solid var(--rule); border-radius:8px;
                     background:var(--paper); color:var(--ink); font:14px/1.3 ui-sans-serif,system-ui }
form.numire button { padding:6px 12px; border-radius:8px; border:1px solid var(--rosu);
                     background:var(--rosu); color:#fff; font:600 13px ui-sans-serif,system-ui; cursor:pointer }
@media (max-width:560px) { form.numire { flex-direction:column; align-items:stretch } }

/* OAMENII: cautarea sus, apoi lista pe cete (super-admini · admini · restul), despartite de o linie
   (user, 15.09.2026). Tabelul n-are cap: e o singura coloana, iar un „Cine" deasupra n-ar spune
   nimic in plus. */
form.cauta-oameni { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:14px 0 6px }
form.cauta-oameni input { flex:1 1 240px; min-width:0; padding:9px 11px; border:1px solid var(--rule);
                          border-radius:8px; background:var(--paper); color:var(--ink);
                          font:15px/1.3 ui-sans-serif,system-ui }
form.cauta-oameni button { flex:0 0 auto; padding:9px 16px; border-radius:8px;
                           border:1px solid var(--rosu); background:var(--rosu); color:#fff;
                           font:600 14px ui-sans-serif,system-ui; cursor:pointer }
form.cauta-oameni a { flex:0 0 auto }
/* ⚠️ Linia dintre cete e un RAND al tabelului, gol, cu chenar sus — nu un chenar pus pe primul om
   al cetei urmatoare: asa o ceata goala nu lasa doua linii lipite. Randul n-are inaltime proprie. */
table.oameni tr.rupe td { padding:0; height:0; border-top:2px solid var(--rule) }

/* ADMINII PE APLICATII: oamenii pe randuri, aplicatiile pe coloane, bulina la intersectie
   (user, 18.09.2026). Unsprezece coloane nu incap pe un telefon, deci tabelul se deruleaza in cadrul
   lui — nu se strange scrisul si nu se ascund coloane, fiindca fiecare e o aplicatie intreaga. */
.matrice-cadru { overflow-x:auto; margin:14px 0 6px; -webkit-overflow-scrolling:touch }
table.matrice { border-collapse:collapse; width:auto; min-width:100% }
table.matrice th, table.matrice td { padding:8px 10px; border-bottom:1px solid var(--rule);
                                     text-align:left; vertical-align:middle; white-space:nowrap }
table.matrice thead th { font:600 12px/1.3 ui-sans-serif,system-ui; letter-spacing:.03em;
                         color:var(--faint); border-bottom:2px solid var(--rule); vertical-align:bottom }
table.matrice tbody th { font:600 14px/1.3 ui-sans-serif,system-ui; color:var(--ink) }
table.matrice td.mij { text-align:center }
/* ⚠️ Prima coloana (numele omului) rămâne la vedere cat se deruleaza in lateral: fara ea, la a saptea
   aplicatie nu se mai stie al cui e randul. */
table.matrice thead th:first-child, table.matrice tbody th { position:sticky; left:0;
                                                             background:var(--paper) }
.bul { display:inline-block; width:12px; height:12px; border-radius:50% }
.bul.plina { background:var(--rosu); border:1px solid var(--rosu) }
.bul.din-rol { background:transparent; border:2px solid var(--soft) }
.bul.nimic { background:transparent; border:1px dashed var(--rule) }
.legenda .bul { vertical-align:-1px; margin-right:2px }
/* Spusul pentru cititorul de ecran: bulina singura n-ar spune nimic la voce. */
.ascuns-vizual { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0);
                 white-space:nowrap; border:0; padding:0; margin:-1px }
`
