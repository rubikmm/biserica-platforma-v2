import { SCOPE_GLOBAL, SESIUNE_ANONIMA, type SesiuneCurenta } from '@xc/contracts'
import { ClientAutorizare } from '@xc/authorization'
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { configChat, normalizeaza, scrieConfigChat, type ConfigChat } from '@xc/chat'
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
  const creierul = (valoare: string, scris: string, lamurire: string) => `<label class="bifa">
      <input type="radio" name="creier" value="${valoare}" ${o.c.creier === valoare ? 'checked' : ''}>
      <span>${scris} <small>${lamurire}</small></span>
    </label>`

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

  <h4>De unde vine răspunsul</h4>
  <div class="trepte">
    ${creierul('workers-ai', 'Workers AI', 'modelul de la Cloudflare, de-a dreptul')}
    ${creierul('gateway', 'Workers AI prin AI Gateway', 'aceleași răspunsuri, dar cu loguri, cache și plafon de cost')}
    ${creierul('fara', 'Fără model', 'doar interfața: bula se deschide, dar nu răspunde nimeni — zero cost')}
  </div>

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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const nav = navigatieDin(cfg)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-admin', correlationId: cid })
    const url = new URL(req.url)

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
          creier: String(formular.get('creier') ?? 'workers-ai'),
        })
        await scrieConfigChat(env, nou)
        log.info('module: comutator schimbat', { activ: nou.activ, cineVede: nou.cineVede, creier: nou.creier, aplicatii: Object.keys(nou.aplicatii) })
        return html(paginaModule({ comune: comuneAici, c: nou, csrf: csrf.jeton, salvat: true, prefix }))
      }

      return html(
        paginaModule({ comune: comuneAici, c: await configChat(env), csrf: csrf.jeton, prefix }),
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

<p><a href="${prefix}/module">Module — pornirea și oprirea chatului</a></p>

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
`
