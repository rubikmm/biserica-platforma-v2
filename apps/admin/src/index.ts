import { ROLURI, Rol, SCOPE_GLOBAL, SESIUNE_ANONIMA, type SesiuneCurenta } from '@xc/contracts'
import { ClientAutorizare } from '@xc/authorization'
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { configChat, MODELE, normalizeaza, scrieConfigChat, type ConfigChat, type ModelDeAles } from '@xc/chat'
import { Logger, correlationId } from '@xc/observability'
import { alerta, dataVersiunii, esc, html, pagina } from '@xc/ui'
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
 * Ecranul de NUMIRI (user, 14.09.2026: „eu pot să fac pe cineva super-admin… adică doar eu (alt
 * super-admin)"). Pana acum rolurile se scriau numai de mana in D1: un cont nou nastea `user` si
 * atat, iar un al doilea super-admin nu se putea face din platforma.
 *
 * Poarta e `roles.manage` — cheie care, dupa `PERMISIUNI_IMPLICITE`, vine NUMAI cu `super-admin`.
 * Deci un administrator obisnuit nu ajunge aici, si asta e cerut anume.
 *
 * ⚠️ Adresa din `EMAIL_SUPERADMIN` nu se poate cobori de nicaieri: e super-admin permanent, iar
 * identitatea ii pune rolul la loc la prima citire de sesiune. Randul ei se deseneaza fara buton,
 * ca sa nu para ca gestul ar fi fost de folos.
 */
function paginaOameni(o: {
  comune: ReturnType<typeof comune>
  oameni: { userId: string; email: string; displayName: string | null; disabledAt: string | null }[]
  roluri: Record<string, { role: string; scope: string }[]>
  emailPermanent: string
  csrf: string
  prefix: string
  mesaj?: string
}): string {
  const randuri = o.oameni
    .map((u) => {
      const aleLui = o.roluri[u.userId] ?? []
      const acum = aleLui.find((r) => r.scope === SCOPE_GLOBAL)?.role ?? 'user'
      const permanent = o.emailPermanent !== '' && u.email === o.emailPermanent
      const etichete = aleLui.length
        ? aleLui.map((r) => `<span class="eticheta">${esc(r.role)}</span>`).join(' ')
        : '<span class="eticheta">user</span>'
      const alege = (v: string, scris: string) =>
        `<option value="${v}"${acum === v ? ' selected' : ''}>${scris}</option>`
      return `<tr>
        <td>${esc(u.displayName ?? '—')}<div class="ajutor">${esc(u.email)}</div></td>
        <td>${etichete}${u.disabledAt ? ' <span class="eticheta">închis</span>' : ''}</td>
        <td>${
          permanent
            ? '<span class="ajutor">super-admin permanent — nu se poate coborî</span>'
            : `<form method="post" action="${o.prefix}/oameni" class="numire">
                 <input type="hidden" name="csrf" value="${esc(o.csrf)}">
                 <input type="hidden" name="userId" value="${esc(u.userId)}">
                 <select name="rol">${alege('user', 'Utilizator')}${alege('admin', 'Administrator')}${alege('super-admin', 'Super-administrator')}</select>
                 <button type="submit">Salvează</button>
               </form>`
        }</td>
      </tr>`
    })
    .join('')

  return pagina({
    ...o.comune,
    titluPagina: 'Oameni',
    corp: `<h2>Oameni</h2>
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
<p class="ajutor">Rolul hotărăște ce poate fiecare pe toată platforma. <strong>Administratorul</strong>
ține calendarul, programul, buletinul, curățenia și biblioteca; <strong>super-administratorul</strong>
poate în plus să numească roluri și să pornească module. Apartenența la o echipă (curățenia, de
pildă) e altceva și se dă din panoul aplicației ei.</p>
<table><thead><tr><th>Cine</th><th>Acum</th><th>Numire</th></tr></thead><tbody>${randuri}</tbody></table>`,
  })
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

    // ------------------------------------------------------------- module
    // Aprinderea si stingerea modulelor cere `modules.manage` — la super-admin, nu la admin:
    // un modul pornit costa bani la fiecare apasare.
    if (cale === '/module') {
      const potModule = await authz.can(principal, 'modules.manage', SCOPE_GLOBAL)
      const comuneAici = comune(env, nav, principal.email, eAdmin, sesiune, adresaPaginii(cfg, url))
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
      const comuneAici = comune(env, nav, principal.email, eAdmin, sesiune, adresaPaginii(cfg, url))
      const potNumi = await authz.can(principal, 'roles.manage', SCOPE_GLOBAL)
      if (!potNumi.allowed) {
        return html(
          pagina({ ...comuneAici, corp: `<h2>Oameni</h2>${alerta('rea', 'Numirea rolurilor e numai a super-administratorilor (<code>roles.manage</code>).')}` }),
          403,
        )
      }

      const permanent = (env.EMAIL_SUPERADMIN ?? '').trim().toLowerCase()
      const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
      let mesaj: string | undefined

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

      const oameni = await listaOamenilor(env, cid)
      const roluri = await roluriPentru(env, oameni.map((u) => u.userId), cid)
      return html(
        paginaOameni({ comune: comuneAici, oameni, roluri, emailPermanent: permanent, csrf: csrf.jeton, prefix, ...(mesaj ? { mesaj } : {}) }),
        200,
        csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
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
      const comuneAici = comune(env, nav, principal.email, eAdmin, sesiune, adresaPaginii(cfg, url))
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

    const decizie = await authz.can(principal, 'audit.read', SCOPE_GLOBAL)

    if (!decizie.allowed) {
      return html(
        pagina({
          ...comune(env, nav, principal.email, eAdmin, sesiune, adresaPaginii(cfg, url)),
          corp: `<h2>Administrare</h2>
            ${alerta('rea', 'Nu ai permisiunea <code>audit.read</code>.')}
            <p class="ajutor">Ești autentificat ca ${esc(principal.email)}, dar fără drepturile necesare.
            Asta confirmă totuși că sesiunea funcționează și pe această aplicație.</p>`,
        }),
        403,
      )
    }

    try {
      const [raspunsAudit, raspunsLivrari, raspunsActiuni] = await Promise.all([
        env.AUDIT.fetch('https://audit.intern/citeste', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limita: 25 }),
        }),
        env.COMUNICARE.fetch('https://comunicare.intern/livrari', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limita: 25 }),
        }),
        env.AUTOMATIZARE.fetch('https://automation.intern/actiuni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ])

      const audit = raspunsAudit.ok
        ? ((await raspunsAudit.json()) as { intrari: IntrareAuditRand[] }).intrari
        : []
      const livrari = raspunsLivrari.ok
        ? ((await raspunsLivrari.json()) as { livrari: LivrareRand[] }).livrari
        : []
      const actiuni = raspunsActiuni.ok
        ? ((await raspunsActiuni.json()) as { actiuni: unknown[] }).actiuni
        : []

      return html(
        pagina({
          ...comune(env, nav, principal.email, eAdmin, sesiune, adresaPaginii(cfg, url)),
          corp: `
<h2>Administrare</h2>
  <p>Ești autentificat ca <strong>${esc(principal.email)}</strong> — fără să te fi
  autentificat din nou pe această aplicație. Rolurile tale: ${sesiune.roles
    .map((r) => `<span class="eticheta">${esc(r.role)}</span>`)
    .join(' ')}</p>
  ${alerta('info', `Automatizarea a produs <strong>${actiuni.length}</strong> acțiuni până acum. Nicio comunicare reală nu a plecat: toate adaptoarele sunt în sandbox.`)}

<p><a href="${prefix}/oameni">Oameni — rolurile pe platformă</a><br>
<a href="${prefix}/dispecerat">Dispecerat — e-mailul și WhatsApp-ul parohiei</a><br>
<a href="${prefix}/module">Module — pornirea și oprirea chatului</a></p>

<h3>Audit — ultimele acțiuni</h3>
  ${tabelAudit(audit)}

<h3>Comunicare — livrări înregistrate</h3>
  ${tabelLivrari(livrari)}`,
        }),
      )
    } catch (e) {
      log.error('eroare la citirea panoului', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        pagina({
          ...comune(env, nav, principal.email, eAdmin, sesiune, adresaPaginii(cfg, url)),
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
  email: string,
  eAdmin: boolean,
  sesiune: SesiuneCurenta,
  spre: string,
) {
  return {
    nume: 'ADMINISTRARE',
    titlu: 'Administrarea platformei',
    acasa: `${nav.admin}/`,
    urlPlatforma: nav.home || '/',
    local: STIL,
    versiune: pkg.version,
    modificata: dataVersiunii(env.VERSIUNE),
    cont: {
      intrat: true,
      nume: email,
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
/* Numirea: selectorul si butonul pe acelasi rand, ca tabelul sa nu se inalte la fiecare om. */
form.numire { display:flex; gap:8px; align-items:center; margin:0 }
form.numire select { padding:6px 8px; border:1px solid var(--rule); border-radius:8px;
                     background:var(--paper); color:var(--ink); font:14px/1.3 ui-sans-serif,system-ui }
form.numire button { padding:6px 12px; border-radius:8px; border:1px solid var(--rosu);
                     background:var(--rosu); color:#fff; font:600 13px ui-sans-serif,system-ui; cursor:pointer }
@media (max-width:560px) { form.numire { flex-direction:column; align-items:stretch } }
`
