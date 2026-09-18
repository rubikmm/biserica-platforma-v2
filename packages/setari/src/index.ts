/**
 * SETĂRILE APLICAȚIEI — un singur loc, pentru toate aplicațiile platformei.
 *
 * Cerute de user pe 15.09.2026: „pe toate paginile celorlalte aplicații, acolo unde este meniul de
 * utilizator de cont, să afișăm un alt buton, în afară de Administrare, numit Setări… Fiecare nivel
 * va vedea mai multe lucruri."
 *
 * TREPTELE, așa cum le-a cerut:
 *   - **utilizatorul simplu** — abonarea LUI la aplicația în care se află, pe care o poate schimba;
 *   - **administratorul** — peste asta, toți abonații aplicației, din care poate SCOATE pe cineva;
 *   - **super-adminul** — peste tot ce văd ceilalți, jurnalul: ce au făcut adminii și utilizatorii.
 *
 * ⚠️ Scris O SINGURĂ DATĂ, aici, ca abonarea (`@xc/abonare`) — regula userului din 15.09.2026: „nu
 * ar trebui să copiez logica în mai multe locuri". Aplicația dă doar ce e al ei: codul, numele,
 * carcasa și legăturile pe care le are. Ce nu are (audiență, jurnal) se vede din pagină ca lipsă
 * anume, nu ca rubrică goală.
 *
 * ⚠️ CE E DEOSEBIT DE LA O APLICAȚIE LA ALTA e doar atât: dacă are sau nu un rând în `ABONAMENTE`
 * (deci abonați) și dacă are sau nu un rând în `APLICATII_CU_MEMBRI` (deci echipă). Restul e la fel
 * peste tot, ca omul să găsească același lucru în același loc.
 *
 * ⚠️ Rubrica „E-mailul de la platformă" NU e a aplicației, e a omului, peste toată platforma — și
 * scrie asta pe ea. E singurul lucru din pagină care nu e specific aplicației; stă aici fiindcă
 * userul a cerut ca pagina să aibă ce arăta și în aplicațiile fără abonare (15.09.2026).
 */
import { asiguraCsrf, verificaTokenCsrf } from '@xc/auth'
import { ClientAutorizare } from '@xc/authorization'
import { abonamentul, ABONAMENTE, type Abonament } from '@xc/abonare'
import {
  aplicatiaAdministrabila,
  aplicatieCuMembri,
  cheileAdminului,
  SCOPE_GLOBAL,
  type AplicatieAdministrabila,
  type AplicatieCuMembri,
  type Asociere,
  type Permisiune,
  type Principal,
} from '@xc/contracts'
import { alerta, esc, html, momentLizibil } from '@xc/ui'

// ---------------------------------------------------------------------------
// Ce-i trebuie paginii
// ---------------------------------------------------------------------------

/**
 * Legăturile de care se folosesc Setările. Numai `IDENTITATE` e obligatorie — restul lipsesc la
 * aplicațiile care nu le au, iar pagina o spune pe față în loc să tacă.
 */
export interface MediuSetari {
  IDENTITATE: Fetcher
  COMUNICARE?: Fetcher
  AUTORIZARE?: Fetcher
  AUDIT?: Fetcher
}

export interface UneltleSetarilor {
  /** codul aplicației, cum îl știe platforma: `calendar`, `program`, `radio`… */
  cod: string
  /** numele ei pentru ochi, cu majusculă: „Calendar", „Radio" */
  nume: string
  /** prefixul aplicației (`/tipic` în dev, `` în producție) */
  prefix: string
  cfg: { MEDIU: string; DOMENIU_COOKIE: string }
  cid: string
  /** cine e pe sesiune acum; `null` = neautentificat */
  principal: Principal | null
  /** adresa aplicației de cont — acolo e trimis cine nu e intrat */
  urlCont: string
  /** pagina de termeni a platformei (una singură, în `home`) */
  urlTermeni: string
  /** carcasa aplicației: primește corpul, dă pagina întreagă */
  carcasa: (o: { titluPagina: string; corp: string; scripturi?: string }) => string
  /**
   * RUBRICILE APLICAȚIEI — bucăți de pagină scrise de ea, așezate la sfârșit, după cele comune
   * (abonarea mea · abonații · jurnalul) și înainte de „Înapoi în …".
   *
   * ⚠️ Punct de prindere, nu ușă din dos: Setările rămân aceleași peste tot, iar aplicația adaugă
   * numai ce ține CHIAR de ea. Prima care l-a cerut: newsletterul, cu antetul și subsolul care se
   * lipesc la fiecare buletin nou (user, 16.09.2026).
   *
   * Primește treptele deja socotite, ca aplicația să nu întrebe a doua oară autorizarea. Cine nu-l
   * dă nu pierde nimic — pagina arată exact ca până acum.
   *
   * ⚠️ `eAdminApp` (administratorul ACESTEI aplicații, din 18.09.2026) e treapta pe care se pun
   * rubricile care țin de treaba aplicației — șablonul newsletterului, de pildă. `eAdmin` a rămas
   * ce era: cheia abonaților, care e a platformei și e comună tuturor aplicațiilor.
   */
  rubrici?: (t: {
    eAdmin: boolean
    eSuper: boolean
    eAdminApp: boolean
    /**
     * Jetonul CSRF AL PAGINII, pentru rubricile cu formular (prima: „Chat AI", 18.09.2026).
     * ⚠️ Rubrica să NU-și facă altul: `asiguraCsrf` ar scoate un jeton nou, iar cookie-ul care
     * pleacă odată cu pagina e al acestuia — prima salvare ar fi respinsă ca „token nepotrivit".
     */
    csrf: string
  }) => Promise<string> | string
}

/** Un abonat, așa cum îl întoarce comunicarea. */
interface Abonat {
  user_id: string
  channel: string
  adresa: string
  created_at: string
}

/** Un om cu cont pe platformă, așa cum îl întoarce identitatea. */
interface OmulPlatformei {
  userId: string
  email: string
  displayName: string | null
  disabledAt: string | null
}

/** Un rând de jurnal, așa cum îl întoarce auditul. */
interface RandJurnal {
  action: string
  target: string
  actor_id: string | null
  actor_type: string
  outcome: string
  summary_json: string | null
  occurred_at: string
}

// ---------------------------------------------------------------------------
// Stilul — numai bucățile NOI. Restul (`.btn`, `.camp`, `.bifa`) e în carcasă.
// ---------------------------------------------------------------------------

/*
 * ⚠️ Fără accent grav în comentariile de stil: fișierul e un template literal, iar un accent grav
 * într-un comentariu CSS închide șirul si scoate erori fara legatura cu locul vinovat (regula
 * platformei, calcata de doua ori pana acum).
 */
export const STIL_SETARI = `
.set-grup { border:1px solid var(--rule); border-radius:12px; padding:16px 18px; margin:0 0 16px }
.set-grup > h2 { margin:0 0 4px; font:600 17px/1.3 ui-sans-serif,system-ui; color:var(--ink) }
.set-grup > .set-spune { margin:0 0 12px; color:var(--faint);
                         font:400 14px/1.5 ui-sans-serif,system-ui }
.set-grup:last-child { margin-bottom:0 }
/* treapta pe care o vede omul: un cuvant mic, langa titlul rubricii */
.set-treapta { float:right; font:600 11px/1 ui-sans-serif,system-ui; letter-spacing:.06em;
               text-transform:uppercase; color:var(--faint); border:1px solid var(--rule);
               border-radius:999px; padding:4px 8px }
.set-stare { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 12px }
.set-bulina { width:9px; height:9px; border-radius:50%; background:var(--faint); flex:0 0 auto }
.set-bulina.da { background:var(--rosu) }
.set-randuri { width:100%; border-collapse:collapse; font:400 14px/1.45 ui-sans-serif,system-ui }
.set-randuri th { text-align:left; font:600 11px/1 ui-sans-serif,system-ui; letter-spacing:.06em;
                  text-transform:uppercase; color:var(--faint); padding:0 10px 8px 0;
                  border-bottom:1px solid var(--rule) }
.set-randuri td { padding:9px 10px 9px 0; border-bottom:1px solid var(--rule);
                  vertical-align:middle }
.set-randuri tr:last-child td { border-bottom:0 }
.set-randuri td.la-dreapta, .set-randuri th.la-dreapta { text-align:right; padding-right:0 }
.set-gol { color:var(--faint); font:400 14px/1.5 ui-sans-serif,system-ui; margin:0 }
.set-mic { font:400 12px/1.4 ui-sans-serif,system-ui; color:var(--faint) }
.set-cod { font:400 12px/1.4 ui-mono,ui-monospace,monospace; color:var(--faint);
           word-break:break-all }
.set-iesit { color:var(--faint) }
.set-rau { color:var(--rosu) }
/* ⚠️ Carcasa are o regula GLOBALA pe form (display:flex; flex-wrap:wrap), facuta pentru randurile
   de cautare. Fara randul de mai jos, bifa termenilor, mesajul de validare si butonul s-ar insira
   unul langa altul ca niste jetoane — capcana e scrisa in NOTES si s-a platit deja o data. */
.set-grup form { display:block; margin:0 }
.set-grup form + form { margin-top:10px }
.set-grup form.set-rand { display:inline; margin:0 }
.set-jos { margin-top:14px }
/* Numirea unui administrator: eticheta deasupra, alegerea si butonul pe un rand, ca sa nu para doua
   fapte deosebite. Nu se sprijina pe clasele carcasei (.camp): nu toate aplicatiile le au. */
.set-numeste { margin-top:14px !important }
.set-numeste label { display:block; margin:0 0 6px;
                     font:600 13px/1.3 ui-sans-serif,system-ui; color:var(--ink) }
.set-numeste select { max-width:100%; margin:0 10px 0 0 }
@media (max-width:520px) {
  .set-grup { padding:14px }
  .set-randuri .set-cod { display:none }
  .set-numeste select { display:block; width:100%; margin:0 0 10px }
}
`

// ---------------------------------------------------------------------------
// Vorba cu serviciile
// ---------------------------------------------------------------------------

async function cere<T>(
  serviciu: Fetcher | undefined,
  gazda: string,
  cale: string,
  corp: unknown,
): Promise<T | null> {
  if (!serviciu) return null
  try {
    const r = await serviciu.fetch(`https://${gazda}.intern${cale}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corp),
    })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

/**
 * Scrie fapta în jurnalul platformei.
 *
 * ⚠️ Se scrie DE AICI, nu din aplicație (spre deosebire de `@xc/abonare`, care primește un
 * `audit()` de la ea). Motivul e chiar zona de loguri cerută de user: aplicații ca Tipicul AVEAU
 * legătura `AUDIT` dar nu scriau nimic în ea niciodată, deci super-adminul ar fi deschis Setările
 * și ar fi găsit un tabel gol. Așa, orice aplicație legată la jurnal își scrie singură faptele,
 * din prima zi, fără să mai adauge nimeni nimic în ea.
 *
 * Nu se așteaptă după el la niciun drum: o fapta nescrisă nu strică fapta însăși.
 */
async function scrie(
  env: MediuSetari,
  cid: string,
  intrare: {
    action: string
    target: string
    outcome: 'success' | 'failure'
    actorId: string
    summary?: Record<string, unknown>
  },
): Promise<void> {
  if (!env.AUDIT) return
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: intrare.action,
        target: intrare.target,
        scope: SCOPE_GLOBAL,
        actor: { type: 'user', id: intrare.actorId },
        outcome: intrare.outcome,
        correlationId: cid,
        summary: intrare.summary ?? {},
      }),
    })
  } catch {
    // jurnalul care nu răspunde nu oprește omul din treaba lui
  }
}

/**
 * Are omul cheia asta? Fără serviciul de autorizare răspunsul e NU — indisponibilitatea înseamnă
 * refuz, nu permisiune (aceeași regulă ca în `ClientAutorizare`).
 */
async function are(
  env: MediuSetari,
  cid: string,
  principal: Principal,
  cheie: Permisiune,
): Promise<boolean> {
  if (!env.AUTORIZARE) return false
  const decizie = await new ClientAutorizare(env.AUTORIZARE, cid).can(principal, cheie, SCOPE_GLOBAL)
  return decizie.allowed
}

/**
 * Oamenii platformei. ⚠️ Se cer de la IDENTITATE, ca în panoul Administrării: aplicația nu ține
 * nume și adrese (structura mare — „datele personale nu se copiază"). La scara parohiei lista e
 * mică (sub 50 de conturi), deci alegerea se face dintr-un `select`, fără căutare.
 */
async function oameniiPlatformei(env: MediuSetari): Promise<OmulPlatformei[]> {
  const r = await cere<{ utilizatori?: OmulPlatformei[] }>(
    env.IDENTITATE,
    'identitate',
    '/utilizatori/lista',
    {},
  )
  return r?.utilizatori ?? []
}

/**
 * Conturile din spatele unor `user_id`, în ordinea în care au venit. ⚠️ Cine nu se găsește în listă
 * NU se pierde din tabel: rămâne cu codul lui în loc de nume — un drept dat unui cont șters trebuie
 * să se VADĂ, ca să poată fi retras.
 */
function oameniiDupaId(oameni: OmulPlatformei[], ids: string[]): OmulPlatformei[] {
  const dupaId = new Map(oameni.map((u) => [u.userId, u]))
  return ids.map(
    (id) => dupaId.get(id) ?? { userId: id, email: id, displayName: '(cont necunoscut)', disabledAt: null },
  )
}

/**
 * Cine are cheia asta, și pe ce drum: numit la aplicație (`prinGrant`, se poate retrage de aici) ori
 * din rolul lui global (`prinRol`, nu se poate). `null` = autorizarea n-a răspuns.
 */
async function cineAreCheia(
  env: MediuSetari,
  cheie: Permisiune,
): Promise<{ prinGrant: string[]; prinRol: string[] } | null> {
  return cere<{ prinGrant: string[]; prinRol: string[] }>(env.AUTORIZARE, 'authz', '/cine-are', {
    permission: cheie,
    scope: SCOPE_GLOBAL,
  })
}

// ---------------------------------------------------------------------------
// Rubricile
// ---------------------------------------------------------------------------

function grup(o: { titlu: string; treapta: string; spune: string; corp: string }): string {
  return `<section class="set-grup">
  <span class="set-treapta">${esc(o.treapta)}</span>
  <h2>${esc(o.titlu)}</h2>
  <p class="set-spune">${o.spune}</p>
  ${o.corp}
</section>`
}

function ascunse(csrf: string): string {
  return `<input type="hidden" name="csrf" value="${esc(csrf)}">`
}

/** Abonarea omului la aplicația în care se află — prima treaptă, a oricui are cont. */
function rubricaAbonare(o: {
  a: Abonament | null
  nume: string
  abonat: Abonat | null
  prefix: string
  csrf: string
  urlTermeni: string
}): string {
  if (!o.a) {
    return grup({
      titlu: 'Abonare',
      treapta: 'Utilizator',
      spune: `${esc(o.nume)} nu trimite nimic pe e-mail, deci nu are la ce te abona.`,
      corp: `<p class="set-gol">Când va avea un serviciu de trimis, abonarea apare chiar aici.</p>`,
    })
  }
  const da = !!o.abonat
  const stare = da
    ? `<span class="set-bulina da"></span><span>Ești abonat cu <b>${esc(o.abonat?.adresa ?? '')}</b>,
       din ${esc(momentLizibil(o.abonat?.created_at ?? ''))}.</span>`
    : `<span class="set-bulina"></span><span>Nu ești abonat.</span>`
  const fapta = da
    ? `<form method="post" action="${esc(o.prefix)}/setari/dezabonare">
    ${ascunse(o.csrf)}
    <button type="submit" class="btn">Nu-mi mai trimiteți ${esc(o.a.ce)}</button>
  </form>`
    : `<form method="post" action="${esc(o.prefix)}/setari/abonare">
    ${ascunse(o.csrf)}
    <div class="bifa" id="l-termeni-set">
      <input type="checkbox" name="termeni" id="b-termeni-set" value="1">
      <label for="b-termeni-set">Sunt de acord cu <a href="${esc(o.urlTermeni)}" target="_blank" rel="noopener">termenii și condițiile</a>.</label>
    </div>
    <p class="bifa-rau" id="e-termeni-set" hidden>Trebuie să fii de acord cu termenii și condițiile.</p>
    <button type="submit" class="btn-plin">Primește ${esc(o.a.ce)} pe e-mail</button>
  </form>`
  return grup({
    titlu: 'Abonarea mea',
    treapta: 'Utilizator',
    spune: `Primești ${esc(o.a.ce)} pe adresa contului tău. Abonarea se poate opri oricând, de aici.`,
    corp: `<p class="set-stare">${stare}</p>${fapta}`,
  })
}

/**
 * Apartenența la aplicație — numai unde aplicația are echipă (azi: curățenia).
 *
 * ⚠️ Cele două stări sunt ale identității, nu ale noastre: omul CERE, un administrator îl PRIMEȘTE
 * (`asocieri`, 14.09.2026). Ieșirea nu cere voie, deci butonul ei nu întreabă pe nimeni.
 */
function rubricaApartenenta(o: {
  app: AplicatieCuMembri | null
  asociere: Asociere | null
  prefix: string
  csrf: string
}): string {
  if (!o.app) return ''
  const stare = o.asociere?.stare
  const text =
    stare === 'acceptata'
      ? `<span class="set-bulina da"></span><span>Ești în echipă${o.asociere?.etichete.length ? ` (${esc(o.asociere.etichete.join(', '))})` : ''}.</span>`
      : stare === 'ceruta'
        ? `<span class="set-bulina"></span><span>Ai cerut să intri. Un administrator trebuie să te primească.</span>`
        : `<span class="set-bulina"></span><span>Nu faci parte din echipă.</span>`
  const fapta = stare
    ? `<form method="post" action="${esc(o.prefix)}/setari/apartenenta">
    ${ascunse(o.csrf)}<input type="hidden" name="fapta" value="ies">
    <button type="submit" class="btn">${stare === 'ceruta' ? 'Retrage cererea' : 'Ies din echipă'}</button>
  </form>`
    : `<form method="post" action="${esc(o.prefix)}/setari/apartenenta">
    ${ascunse(o.csrf)}<input type="hidden" name="fapta" value="cer">
    <button type="submit" class="btn-plin">Cere să intri în echipă</button>
  </form>`
  return grup({
    titlu: 'Apartenența mea',
    treapta: 'Utilizator',
    spune: esc(o.app.descriere),
    corp: `<p class="set-stare">${text}</p>${fapta}`,
  })
}

/**
 * Comutatorul de e-mail. ⚠️ E AL PLATFORMEI, nu al aplicației — și scrie asta pe el, ca omul să nu
 * creadă că oprește numai calendarul când oprește tot.
 */
function rubricaEmail(o: { optedOut: boolean; prefix: string; csrf: string }): string {
  const stare = o.optedOut
    ? `<span class="set-bulina"></span><span>Nu primești niciun e-mail de la platformă.</span>`
    : `<span class="set-bulina da"></span><span>Primești e-mailurile la care ești abonat.</span>`
  return grup({
    titlu: 'E-mailul de la platformă',
    treapta: 'Utilizator',
    spune:
      'Această setare e a <b>întregii platforme</b>, nu doar a acestei aplicații: oprită, nu mai pleacă nimic spre tine, oricâte abonări ai avea.',
    corp: `<p class="set-stare">${stare}</p>
<form method="post" action="${esc(o.prefix)}/setari/email">
  ${ascunse(o.csrf)}
  <input type="hidden" name="optedOut" value="${o.optedOut ? '0' : '1'}">
  <button type="submit" class="btn">${o.optedOut ? 'Vreau iar e-mail de la platformă' : 'Oprește tot e-mailul'}</button>
</form>`,
  })
}

/**
 * Abonații aplicației — treapta administratorului.
 *
 * ⚠️ Lista NU e a aplicației: se CERE de la comunicare la fiecare afișare (`/audiente/membri`) și nu
 * se ține nicăieri la noi — structura mare, „fără liste de abonați în aplicații".
 * ⚠️ Adminul VEDE și SCOATE, atât (user, 15.09.2026). Adăugarea rămâne gestul omului, cu bifa
 * termenilor și cu contul lui; nu se pune aici un câmp de adăugat adrese.
 */
function rubricaAbonati(o: {
  a: Abonament | null
  abonati: Abonat[] | null
  prefix: string
  csrf: string
}): string {
  if (!o.a) {
    return grup({
      titlu: 'Abonații aplicației',
      treapta: 'Administrator',
      spune: 'Aplicația nu are un serviciu de trimis, deci nu are nici abonați.',
      corp: `<p class="set-gol">Nimic de arătat.</p>`,
    })
  }
  const lista = o.abonati ?? []
  const corp = !o.abonati
    ? alerta('rea', 'Comunicarea nu a răspuns — lista nu s-a putut aduce.')
    : lista.length === 0
      ? `<p class="set-gol">Nimeni nu e abonat încă.</p>`
      : `<table class="set-randuri">
  <thead><tr><th>Adresa</th><th>Din</th><th class="set-cod">Contul</th><th class="la-dreapta">&nbsp;</th></tr></thead>
  <tbody>${lista
    .map(
      (m) => `
    <tr>
      <td>${esc(m.adresa)}</td>
      <td>${esc(momentLizibil(m.created_at))}</td>
      <td class="set-cod">${esc(m.user_id)}</td>
      <td class="la-dreapta"><form class="set-rand" method="post" action="${esc(o.prefix)}/setari/abonat-scoate">
        ${ascunse(o.csrf)}<input type="hidden" name="userId" value="${esc(m.user_id)}">
        <button type="submit" class="btn mic">Scoate</button>
      </form></td>
    </tr>`,
    )
    .join('')}
  </tbody>
</table>
<p class="set-mic set-jos">${lista.length} ${lista.length === 1 ? 'abonat' : 'abonați'}. Cine e scos se poate abona singur la loc, oricând.</p>`
  return grup({
    titlu: 'Abonații aplicației',
    treapta: 'Administrator',
    spune: `Toți cei care primesc ${esc(o.a.ce)} pe e-mail. Lista stă la serviciul de comunicare — aici doar se vede.`,
    corp,
  })
}

/**
 * ADMINISTRATORII APLICAȚIEI — treapta administratorului, cerută de user pe 18.09.2026: „să aibă
 * toate capacitatea de a avea setat administratori — eu îi setez la fiecare aplicație în parte ca
 * administrator (deci nu doar super-admin)".
 *
 * ⚠️ Scrisă O SINGURĂ DATĂ, aici: de aceea **toate** aplicațiile o capătă deodată, fără să se atingă
 * niciuna. Ce e deosebit de la una la alta stă în registrul `APLICATII_ADMINISTRABILE` din contracte
 * (numele, cheia, faptele) — aplicația nu dă nimic în plus.
 *
 * ⚠️ Numirea e un GRANT PUNCTUAL, nu un rol: omul rămâne `user` pe platformă și nu capătă nimic în
 * celelalte aplicații. Tiparul e cel al Curățeniei din 14.09.2026 (eticheta „Admin" acordă
 * `cleaning.manage`), mutat aici ca să fie al tuturor.
 *
 * ⚠️ Cele două feluri de drept se scriu DEOSEBIT, fiindcă numai unul se poate lua de aici: cine e
 * numit pe aplicație are „Scoate", cine îl are din rolul global nu — acela se coboară din
 * Administrare → Oameni, și e altceva.
 */
function rubricaAdmini(o: {
  app: AplicatieAdministrabila
  prinGrant: OmulPlatformei[]
  prinRol: OmulPlatformei[]
  /** cine mai poate fi numit: oamenii platformei, fără cei care sunt deja admini aici */
  deNumit: OmulPlatformei[]
  /** `null` = autorizarea n-a răspuns; atunci nu se desenează o listă care ar minți */
  areRaspuns: boolean
  prefix: string
  csrf: string
}): string {
  const numele = (u: OmulPlatformei) => (u.displayName ?? '').trim() || u.email
  const chei = [o.app.cheieAdmin, ...o.app.cheiInsotitoare]
  const corp = !o.areRaspuns
    ? alerta('rea', 'Autorizarea nu a răspuns — lista administratorilor nu s-a putut aduce.')
    : `${
        o.prinGrant.length || o.prinRol.length
          ? `<table class="set-randuri">
  <thead><tr><th>Cine</th><th>De unde are dreptul</th><th class="la-dreapta">&nbsp;</th></tr></thead>
  <tbody>${o.prinGrant
    .map(
      (u) => `
    <tr>
      <td>${esc(numele(u))}${u.disabledAt ? ' <span class="set-iesit">(cont închis)</span>' : ''}<br><span class="set-mic">${esc(u.email)}</span></td>
      <td>Numit la această aplicație</td>
      <td class="la-dreapta"><form class="set-rand" method="post" action="${esc(o.prefix)}/setari/admin-scoate">
        ${ascunse(o.csrf)}<input type="hidden" name="userId" value="${esc(u.userId)}">
        <button type="submit" class="btn mic">Scoate</button>
      </form></td>
    </tr>`,
    )
    .join('')}${o.prinRol
    .map(
      (u) => `
    <tr>
      <td>${esc(numele(u))}<br><span class="set-mic">${esc(u.email)}</span></td>
      <td>Din rolul lui pe platformă</td>
      <td class="la-dreapta"><span class="set-mic">se schimbă din Administrare</span></td>
    </tr>`,
    )
    .join('')}
  </tbody>
</table>`
          : `<p class="set-gol">Nimeni nu e administrator aici — în afară de administratorii platformei.</p>`
      }
${
  o.deNumit.length
    ? `<form class="set-numeste" method="post" action="${esc(o.prefix)}/setari/admin-numeste">
  ${ascunse(o.csrf)}
  <label for="set-pe-cine">Numește un administrator</label>
  <select id="set-pe-cine" name="userId">
    <option value="">— alege un om —</option>
    ${o.deNumit
      .map((u) => `<option value="${esc(u.userId)}">${esc(numele(u))} — ${esc(u.email)}</option>`)
      .join('')}
  </select>
  <button type="submit" class="btn-plin">Numește administrator</button>
</form>`
    : `<p class="set-mic set-jos">Toți cei care au cont sunt deja administratori aici.</p>`
}
<p class="set-mic set-jos">Numirea dă exact ${chei.length === 1 ? 'cheia' : 'cheile'}
<span class="set-cod">${chei.map((c) => esc(c)).join(' · ')}</span> și nimic altceva: în celelalte
aplicații omul rămâne ce era.</p>`
  return grup({
    titlu: 'Administratorii aplicației',
    treapta: 'Administrator',
    spune: `Cine ține ${esc(o.app.nume)}. ${esc(o.app.faptele)} Dreptul e numai aici — nu se întinde peste platformă.`,
    corp,
  })
}

/**
 * Jurnalul aplicației — treapta super-adminului, cerută anume: „vor putea vizualiza toate acțiunile
 * făcute de admini și de utilizatorii simpli" (user, 15.09.2026).
 *
 * ⚠️ Se cere pe PREFIX (`calendar.`), nu pe o acțiune anume — de aceea auditul a căpătat filtrul
 * `prefixActiune` în aceeași rundă. Aplicația care n-are legătura `AUDIT` nu scrie nimic nicăieri,
 * iar rubrica o spune, în loc să arate un tabel gol care ar minți.
 */
function rubricaJurnal(o: { nume: string; areAudit: boolean; randuri: RandJurnal[] | null }): string {
  const corp = !o.areAudit
    ? alerta(
        'atentie',
        `${esc(o.nume)} nu e legată încă de jurnalul platformei, deci faptele din ea nu se scriu nicăieri. Până se leagă, nu e nimic de arătat aici.`,
      )
    : !o.randuri
      ? alerta('rea', 'Jurnalul nu a răspuns.')
      : o.randuri.length === 0
        ? `<p class="set-gol">Nicio faptă înregistrată încă.</p>`
        : `<table class="set-randuri">
  <thead><tr><th>Când</th><th>Ce</th><th>Cine</th><th>Cum a ieșit</th></tr></thead>
  <tbody>${o.randuri
    .map(
      (r) => `
    <tr>
      <td>${esc(momentLizibil(r.occurred_at))}</td>
      <td>${esc(r.action)}<br><span class="set-cod">${esc(r.target)}</span></td>
      <td class="set-cod">${esc(r.actor_id ?? r.actor_type)}</td>
      <td class="${r.outcome === 'success' ? '' : 'set-rau'}">${esc(r.outcome)}</td>
    </tr>`,
    )
    .join('')}
  </tbody>
</table>`
  return grup({
    titlu: 'Jurnalul aplicației',
    treapta: 'Super-admin',
    spune:
      'Ce au făcut administratorii și utilizatorii în această aplicație. Jurnalul e al platformei, se scrie o singură dată și nu se poate schimba.',
    corp,
  })
}

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------

/** JS-ul paginii: doar paza bifei de termeni, ca în fereastra de abonare. Fără săgeți, fără `let`. */
export const JS_SETARI = `
(function(){
  var f = document.getElementById("b-termeni-set");
  var l = document.getElementById("l-termeni-set");
  var e = document.getElementById("e-termeni-set");
  if (!f || !l || !e) return;
  var forma = f.form;
  f.addEventListener("change", function(){ if (f.checked) { l.classList.remove("rea"); e.hidden = true; } });
  forma.addEventListener("submit", function(ev){
    if (f.checked) return;
    ev.preventDefault();
    l.classList.add("rea");
    e.hidden = false;
    f.focus();
  });
})();
`

function corpulSetarilor(o: {
  nume: string
  prefix: string
  csrf: string
  urlTermeni: string
  urlCont: string
  a: Abonament | null
  abonat: Abonat | null
  app: AplicatieCuMembri | null
  asociere: Asociere | null
  optedOut: boolean
  areComunicare: boolean
  eAdmin: boolean
  abonati: Abonat[] | null
  /** rândul aplicației din registrul celor administrabile; `null` = n-are unul (Contul) */
  appAdmin: AplicatieAdministrabila | null
  /** e omul administratorul ACESTEI aplicații (cheia ei), fie numit, fie prin rolul global */
  eAdminApp: boolean
  /** cine ține aplicația acum, pe cele două drumuri; `null` = autorizarea n-a răspuns */
  adminii: { prinGrant: string[]; prinRol: string[] } | null
  /** oamenii platformei, din care se alege cine să fie numit */
  oameni: OmulPlatformei[]
  eSuper: boolean
  areAudit: boolean
  jurnal: RandJurnal[] | null
  /** rubricile aplicației (vezi `rubrici` din `UneltleSetarilor`); gol = n-are niciuna */
  rubriciApp: string
  mesaj?: string
  mesajRau?: string
}): string {
  const mele = o.areComunicare
    ? rubricaAbonare({ a: o.a, nume: o.nume, abonat: o.abonat, prefix: o.prefix, csrf: o.csrf, urlTermeni: o.urlTermeni }) +
      rubricaApartenenta({ app: o.app, asociere: o.asociere, prefix: o.prefix, csrf: o.csrf }) +
      rubricaEmail({ optedOut: o.optedOut, prefix: o.prefix, csrf: o.csrf })
    : rubricaApartenenta({ app: o.app, asociere: o.asociere, prefix: o.prefix, csrf: o.csrf }) +
      alerta(
        'atentie',
        `${esc(o.nume)} nu e legată de serviciul de comunicare, deci abonările nu se pot vedea de aici.`,
      )
  return `<div class="cap">
  <h1 class="titlu-lista">Setări — ${esc(o.nume)}</h1>
  <p class="sursa">Ce ține de tine în această aplicație. Datele tale (numele, adresa, ieșirea din
  cont) stau la <a href="${esc(o.urlCont)}/">Contul platformei</a>, într-un singur loc.</p>
</div>
${o.mesaj ? alerta('buna', esc(o.mesaj)) : ''}
${o.mesajRau ? alerta('rea', esc(o.mesajRau)) : ''}
${mele}
${o.eAdmin ? rubricaAbonati({ a: o.a, abonati: o.abonati, prefix: o.prefix, csrf: o.csrf }) : ''}
${
  o.eAdminApp && o.appAdmin
    ? rubricaAdmini({
        app: o.appAdmin,
        prinGrant: oameniiDupaId(o.oameni, o.adminii?.prinGrant ?? []),
        prinRol: oameniiDupaId(o.oameni, o.adminii?.prinRol ?? []),
        // cine mai poate fi numit: fără cei care au deja cheia (pe oricare drum) și fără conturile
        // închise — o numire pe un cont închis n-ar face nimic pentru nimeni
        deNumit: o.oameni.filter(
          (u) =>
            !u.disabledAt &&
            !(o.adminii?.prinGrant ?? []).includes(u.userId) &&
            !(o.adminii?.prinRol ?? []).includes(u.userId),
        ),
        areRaspuns: !!o.adminii,
        prefix: o.prefix,
        csrf: o.csrf,
      })
    : ''
}
${o.eSuper ? rubricaJurnal({ nume: o.nume, areAudit: o.areAudit, randuri: o.jurnal }) : ''}
${o.rubriciApp}
<nav class="vecini"><a href="${esc(o.prefix)}/">← Înapoi în ${esc(o.nume)}</a></nav>`
}

// ---------------------------------------------------------------------------
// Drumul
// ---------------------------------------------------------------------------

const CAI = new Set([
  '/setari',
  '/setari/abonare',
  '/setari/dezabonare',
  '/setari/email',
  '/setari/apartenenta',
  '/setari/abonat-scoate',
  // numirea și scoaterea unui administrator AL APLICAȚIEI (18.09.2026)
  '/setari/admin-numeste',
  '/setari/admin-scoate',
])

/** Rândul din registru, dacă aplicația are unul. Fără abonament, pagina rămâne întreagă. */
function abonamentulSau(cod: string): Abonament | null {
  return ABONAMENTE.some((x) => x.cod === cod) ? abonamentul(cod) : null
}

/**
 * RUTELE SETĂRILOR. Aplicația le cheamă o dată, înaintea rutelor ei, și primește `null` dacă adresa
 * nu e a Setărilor.
 *
 * ⚠️ Trebuie chemate ÎNAINTEA rutei ei de conținut: la Tipic, de pildă, orice cale care nu e `/` e
 * citită ca o DATĂ, deci `/setari` ar cădea pe „Nu există" (aceeași capcană ca la abonare).
 *
 * ⚠️ Bariera de origine (`verificaCsrf`) rămâne a aplicației, ca până acum. Aici se adaugă jetonul
 * CSRF pereche cu cookie-ul, pe fiecare formular: toate faptele de mai jos schimbă ceva pe contul
 * unui om intrat, deci merită aceeași grijă ca la Cont.
 */
export async function ruteazaSetari(
  req: Request,
  cale: string,
  env: MediuSetari,
  o: UneltleSetarilor,
): Promise<Response | null> {
  if (!CAI.has(cale)) return null
  const p = o.prefix

  // Setările sunt ale unui om anume: fără cont n-au ce arăta. Îl trimitem la intrare, cu
  // întoarcere exact aici.
  if (!o.principal) {
    const inapoi = encodeURIComponent(`${p}/setari`)
    return new Response(null, { status: 303, headers: { location: `${o.urlCont}/auth/login?spre=${inapoi}` } })
  }
  const principal = o.principal

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return new Response(null, { status: 303, headers: { location: `${p}/setari` } })
  }
  // Pe GET, adresele de faptă nu fac nimic: cine le nimerește cu mâna e adus la pagină.
  if (req.method !== 'POST' && cale !== '/setari') {
    return new Response(null, { status: 303, headers: { location: `${p}/setari` } })
  }

  const a = abonamentulSau(o.cod)
  const app = aplicatieCuMembri(o.cod) ?? null
  /** Rândul aplicației din registrul celor administrabile — de el atârnă rubrica adminilor. */
  const appAdmin = aplicatiaAdministrabila(o.cod) ?? null

  // ------------------------------------------------------------------ faptele
  if (req.method === 'POST') {
    const formular = await req.formData()
    const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
    if (problema) {
      return html(
        o.carcasa({
          titluPagina: 'Verificare de securitate',
          corp: `<div class="cap"><h1 class="titlu-lista">Verificare de securitate</h1>
  <p class="sursa">${esc(problema)}</p></div>
<nav class="vecini"><a href="${esc(p)}/setari">← Înapoi la Setări</a></nav>`,
        }),
        403,
      )
    }

    const spune = (cheie: string) => `${p}/setari?f=${cheie}`

    if (cale === '/setari/abonare' && a) {
      // Aceeași pază ca în fereastra de abonare: consimțământul nu e o podoabă a interfeței.
      if (!formular.get('termeni')) return new Response(null, { status: 303, headers: { location: spune('fara-termeni') } })
      const r = await cere<{ ok: boolean }>(env.COMUNICARE, 'comunicare', '/audiente/inscrie', {
        audienceId: a.audienta,
        nume: a.numeAudienta,
        userId: principal.userId,
        channel: 'email',
        adresa: principal.email,
      })
      await scrie(env, o.cid, { action: `${a.prefixAudit}.subscribe`, target: a.audienta, outcome: r ? 'success' : 'failure', actorId: principal.userId, summary: { din: 'setari' } })
      return new Response(null, { status: 303, headers: { location: spune(r ? 'abonat' : 'rau') } })
    }

    if (cale === '/setari/dezabonare' && a) {
      const r = await cere<{ ok: boolean }>(env.COMUNICARE, 'comunicare', '/audiente/scoate', {
        audienceId: a.audienta,
        userId: principal.userId,
        channel: 'email',
      })
      await scrie(env, o.cid, { action: `${a.prefixAudit}.unsubscribe`, target: a.audienta, outcome: r ? 'success' : 'failure', actorId: principal.userId, summary: { din: 'setari' } })
      return new Response(null, { status: 303, headers: { location: spune(r ? 'dezabonat' : 'rau') } })
    }

    if (cale === '/setari/email') {
      const optedOut = String(formular.get('optedOut') ?? '') === '1'
      const r = await cere<{ ok: boolean }>(env.COMUNICARE, 'comunicare', '/preferinte', {
        userId: principal.userId,
        channel: 'email',
        optedOut,
      })
      await scrie(env, o.cid, { action: `${o.cod}.email.preference`, target: principal.userId, outcome: r ? 'success' : 'failure', actorId: principal.userId, summary: { optedOut } })
      return new Response(null, { status: 303, headers: { location: spune(r ? (optedOut ? 'email-oprit' : 'email-pornit') : 'rau') } })
    }

    if (cale === '/setari/apartenenta' && app) {
      const cerere = String(formular.get('fapta') ?? '') === 'cer'
      const r = await cere<{ ok: boolean }>(
        env.IDENTITATE,
        'identitate',
        cerere ? '/asocieri/cere' : '/asocieri/scoate',
        cerere
          ? { userId: principal.userId, aplicatie: app.cod, cerutDe: principal.userId }
          : { userId: principal.userId, aplicatie: app.cod, deCatre: principal.userId },
      )
      return new Response(null, { status: 303, headers: { location: spune(r ? (cerere ? 'cerut' : 'iesit') : 'rau') } })
    }

    /*
     * Scoaterea unui abonat de către administrator. ⚠️ Cheia se cere AICI, nu se ia pe credit de la
     * pagina care a desenat butonul: cine trimite formularul de mână ajunge tot pe drumul ăsta.
     */
    if (cale === '/setari/abonat-scoate' && a) {
      if (!(await are(env, o.cid, principal, 'audience.manage'))) {
        await scrie(env, o.cid, { action: `${a.prefixAudit}.subscriber.remove`, target: a.audienta, outcome: 'failure', actorId: principal.userId, summary: { motiv: 'fara audience.manage' } })
        return new Response(null, { status: 303, headers: { location: spune('fara-drept') } })
      }
      const cine = String(formular.get('userId') ?? '')
      if (!cine) return new Response(null, { status: 303, headers: { location: spune('rau') } })
      const r = await cere<{ ok: boolean }>(env.COMUNICARE, 'comunicare', '/audiente/scoate', {
        audienceId: a.audienta,
        userId: cine,
        channel: 'email',
      })
      await scrie(env, o.cid, { action: `${a.prefixAudit}.subscriber.remove`, target: cine, outcome: r ? 'success' : 'failure', actorId: principal.userId, summary: { audienta: a.audienta } })
      return new Response(null, { status: 303, headers: { location: spune(r ? 'scos' : 'rau') } })
    }

    /*
     * NUMIREA și SCOATEREA unui administrator AL APLICAȚIEI (user, 18.09.2026).
     *
     * ⚠️ Poarta e cheia APLICAȚIEI, nu `roles.manage`: cine ține aplicația poate lua pe cineva
     * alături (tiparul Curățeniei — „se poate apăsa doar de cine o are deja, sau de un super-admin",
     * iar super-adminul o are pe toate). Cheia se cere AICI, nu pe credit de la pagina care a
     * desenat butonul: cine trimite formularul de mână ajunge tot pe drumul ăsta.
     *
     * ⚠️ Cheile se acordă TOATE, într-un singur gest: un administrator al Programului care ar putea
     * scrie dar nu valida n-ar putea duce nimic la capăt. Dacă una din ele nu trece, fapta se
     * socotește nereușită și se scrie așa în jurnal — nu spunem că am numit pe cineva pe jumătate.
     */
    if ((cale === '/setari/admin-numeste' || cale === '/setari/admin-scoate') && appAdmin) {
      const numeste = cale === '/setari/admin-numeste'
      const fapta = `${o.cod}.admin.${numeste ? 'grant' : 'revoke'}`
      if (!(await are(env, o.cid, principal, appAdmin.cheieAdmin))) {
        await scrie(env, o.cid, { action: fapta, target: String(formular.get('userId') ?? ''), outcome: 'failure', actorId: principal.userId, summary: { motiv: `fara ${appAdmin.cheieAdmin}` } })
        return new Response(null, { status: 303, headers: { location: spune('fara-drept-admin') } })
      }
      const cine = String(formular.get('userId') ?? '')
      if (!cine) return new Response(null, { status: 303, headers: { location: spune('rau') } })
      const chei = cheileAdminului(appAdmin.cod)
      let ok = true
      for (const cheie of chei) {
        const r = await cere<{ ok: boolean }>(env.AUTORIZARE, 'authz', numeste ? '/acorda' : '/retrage', {
          userId: cine,
          permission: cheie,
          scope: SCOPE_GLOBAL,
        })
        if (!r) ok = false
      }
      await scrie(env, o.cid, { action: fapta, target: cine, outcome: ok ? 'success' : 'failure', actorId: principal.userId, summary: { aplicatie: appAdmin.cod, chei: [...chei] } })
      return new Response(null, { status: 303, headers: { location: spune(ok ? (numeste ? 'admin-numit' : 'admin-scos') : 'rau') } })
    }

    return new Response(null, { status: 303, headers: { location: `${p}/setari` } })
  }

  // ------------------------------------------------------------------ pagina
  /*
   * ⚠️ TREI trepte, nu două, de pe 18.09.2026: `eAdmin` (abonații — cheia platformei
   * `audience.manage`) și `eAdminApp` (administratorul ACESTEI aplicații — cheia ei din registru)
   * NU sunt același lucru. Un om numit admin numai la Program are a doua, nu pe prima: el ține
   * programul, dar nu vede lista abonaților, care e a comunicării și e comună tuturor aplicațiilor.
   */
  const [eAdmin, eSuper, eAdminApp] = await Promise.all([
    are(env, o.cid, principal, 'audience.manage'),
    are(env, o.cid, principal, 'audit.read'),
    appAdmin ? are(env, o.cid, principal, appAdmin.cheieAdmin) : Promise.resolve(false),
  ])

  /*
   * Lista administratorilor și oamenii dintre care se alege: se cer NUMAI pentru cine are cheia
   * aplicației. Pentru un enoriaș pagina rămâne exact cât era, fără două întrebări în plus.
   */
  const [cineAre, oameni] = await Promise.all([
    eAdminApp && appAdmin ? cineAreCheia(env, appAdmin.cheieAdmin) : Promise.resolve(null),
    eAdminApp && appAdmin ? oameniiPlatformei(env) : Promise.resolve([] as OmulPlatformei[]),
  ])

  const [alMeu, preferinta, asocieri, abonati, jurnal] = await Promise.all([
    a ? cere<{ membri: Abonat[] }>(env.COMUNICARE, 'comunicare', '/audiente/membri', { audienceId: a.audienta, userId: principal.userId }) : Promise.resolve(null),
    cere<{ optedOut: boolean }>(env.COMUNICARE, 'comunicare', '/preferinte/citeste', { userId: principal.userId, channel: 'email' }),
    app ? cere<{ asocieri: Asociere[] }>(env.IDENTITATE, 'identitate', '/asocieri/ale-mele', { userId: principal.userId }) : Promise.resolve(null),
    eAdmin && a ? cere<{ membri: Abonat[] }>(env.COMUNICARE, 'comunicare', '/audiente/membri', { audienceId: a.audienta }) : Promise.resolve(null),
    eSuper && env.AUDIT ? cere<{ intrari: RandJurnal[] }>(env.AUDIT, 'audit', '/citeste', { prefixActiune: `${o.cod}.`, limita: 50 }) : Promise.resolve(null),
  ])

  const csrf = asiguraCsrf(req, o.cfg.DOMENIU_COOKIE)
  // rubricile aplicației: se cer DUPĂ ce se știu treptele, ca să nu întrebe și ele autorizarea
  const rubriciApp = o.rubrici ? await o.rubrici({ eAdmin, eSuper, eAdminApp, csrf: csrf.jeton }) : ''
  const felul = new URL(req.url).searchParams.get('f') ?? ''
  const vorbe: Record<string, [bun: boolean, text: string]> = {
    abonat: [true, 'Gata — ești abonat.'],
    dezabonat: [true, 'Nu-ți mai trimitem nimic de aici.'],
    'email-oprit': [true, 'Am oprit tot e-mailul de la platformă.'],
    'email-pornit': [true, 'Primești iar e-mailurile la care ești abonat.'],
    cerut: [true, 'Cererea a plecat. Un administrator trebuie să te primească.'],
    iesit: [true, 'Ai ieșit din echipă.'],
    scos: [true, 'Abonatul a fost scos din listă.'],
    'fara-termeni': [false, 'Abonarea se face numai după ce ești de acord cu termenii și condițiile.'],
    'fara-drept': [false, 'Îți trebuie permisiunea audience.manage ca să scoți pe cineva din listă.'],
    'admin-numit': [true, 'Gata — e administrator al acestei aplicații. Dreptul se vede la următoarea pagină pe care o deschide.'],
    'admin-scos': [true, 'I-am luat dreptul de administrator al acestei aplicații.'],
    'fara-drept-admin': [false, 'Numai un administrator al acestei aplicații poate numi altul.'],
    // rubrica „Chat AI" (18.09.2026): se scrie din `@xc/chat`, dar vestea o dă pagina asta
    'chat-salvat': [true, 'Am salvat îndrumările chatului. Se văd în bulă în cel mult un minut.'],
    'chat-rau': [false, 'Nu am putut salva îndrumările chatului. Reîncarcă pagina și încearcă din nou.'],
    rau: [false, 'Nu a mers. Încearcă din nou.'],
  }
  const vorba = vorbe[felul]

  return html(
    o.carcasa({
      titluPagina: 'Setări',
      corp: corpulSetarilor({
        nume: o.nume,
        prefix: p,
        csrf: csrf.jeton,
        urlTermeni: o.urlTermeni,
        urlCont: o.urlCont,
        a,
        abonat: alMeu?.membri?.[0] ?? null,
        app,
        asociere: asocieri?.asocieri.find((x) => x.aplicatie === app?.cod) ?? null,
        optedOut: preferinta?.optedOut ?? false,
        areComunicare: !!env.COMUNICARE,
        eAdmin,
        abonati: abonati ? abonati.membri : eAdmin && a ? null : [],
        appAdmin,
        eAdminApp,
        adminii: cineAre,
        oameni,
        eSuper,
        areAudit: !!env.AUDIT,
        jurnal: jurnal ? jurnal.intrari : null,
        rubriciApp,
        ...(vorba?.[0] ? { mesaj: vorba[1] } : {}),
        ...(vorba && !vorba[0] ? { mesajRau: vorba[1] } : {}),
      }),
      scripturi: JS_SETARI,
    }),
    200,
    {
      // Pagina e personală: nu se ține în niciun cache, nici sub mască.
      'cache-control': 'private, no-store',
      ...(csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {}),
    },
  )
}
