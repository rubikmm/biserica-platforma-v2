/**
 * A3 · Buletinul parohial — pe platforma V2.
 *
 * Foaia periodica fata-verso, 50-60 de exemplare pe saptamana, plus arhiva: 619 numere aparute din
 * 2012 incoace. Cifrele si textul de cautat stau in D1 (`xc-buletin-staging`), fisierele in R2
 * (`xc-buletin-staging`) — amandoua NOI, copiate din V1 obiect cu obiect, rand cu rand.
 *
 * Rute:
 *   /health                     starea arhivei
 *   /v1/…                       API-ul contractului, deschis (jos, `api`)
 *   /fisier/<cheie>             PDF-ul sau poza unui numar, din R2 (deschis, cache lung)
 *   /                           numarul curent                            ┐ pagini de om, DESCHISE
 *   /buletin/<nr>-<data>        un numar din arhiva                       │ („totul la liber,
 *   /arhiva[?an=2019]           toate numerele, pe ani si luni            │  deocamdată")
 *   /cauta?q=…                  cautare in textul buletinelor             ┘
 *   /abonare · /dezabonare      POST: audienta `buletin-abonati` a comunicarii (cere cont)
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - **lista de abonati nu mai e a aplicatiei**: in V1 statea in tabelul `abonati` din baza lui A3,
 *    cu e-mail si nume in ea. In V2 abonarea e o AUDIENTA a comunicarii, iar aplicatia nu tine nicio
 *    adresa (structura mare, user 10.09.2026). Tabelul nu s-a copiat;
 *  - **modul de proba a iesit** cu totul (in V2 local = staging): fara `/proba`, fara persoane
 *    inventate, fara `PROBA=da`;
 *  - carcasa vine din `@xc/ui`, iar cine esti afla din sesiunea centrala (`IDENTITATE`).
 *
 * Redactarea unui numar nou — sablonul fata-verso, programul cerut de la A2, sfintii de la A1 — nu
 * exista nici in V1; ramane de facut, ca acolo.
 */
import { SCOPE_GLOBAL, SESIUNE_ANONIMA } from '@xc/contracts'
import { eAdminulAplicatiei } from '@xc/authorization'
import { principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { modulActiuni } from '@xc/actiuni'
import { modulChat } from '@xc/chat'
import {
  actiuniBuletin,
  chestionarul,
  compuneNumarul,
  rezumatAuditCompunere,
  rezumatAuditEroare,
  schitaNumarului,
  schitaPastrata,
  vorbaRefuzului,
} from './actiuni.js'
import { HARTA_BULETIN } from './harta.js'
import { dataVersiunii, eroareApi, html, json, jsonCuEtag } from '@xc/ui'
import pkg from '../package.json'
import {
  type Buletin,
  type BuletinScurt,
  anii,
  cauta,
  celMaiNouCuNumarul,
  dintrUnAn,
  numaratoare,
  scrieBuletin,
  ultimele,
  ultimul,
  unul,
  vecini,
} from './depozit.js'
import { type Coala, brosura, cheiaBrosurii, numeBrosura } from './tipar.js'
import {
  amprentaFoii,
  calendarulNumarului,
  cheiaCererii,
  cheiaCopertei,
  cheiaNumarului,
  citesteCererea,
  mottoDinainte,
  programulSaSchimbat,
  textCurat,
} from './compune.js'
import { PAGINI, type NumarCerut, semne, socoteste } from './masuri.js'
import { eDeProba } from './umplere.js'
import {
  CHEIE_CHESTIONAR,
  INTREBARI_STANDARD,
  NUMELE_ZONEI,
  articolul,
  catreCerere,
  cautaPomenirile,
  citesteSchita,
  eSchitaNeatinsa,
  intrebarile,
  normalizeazaChestionar,
  scrieRaspuns,
  scrieSchita,
  stergeSchita,
  urmatoareaIntrebare,
} from './schita.js'
import { abonamentul, ruteazaAbonare } from '@xc/abonare'
import { ruteazaSetari } from '@xc/setari'
import {
  type Ctx,
  type Meniu,
  buletinulNou,
  paginaAcasa,
  paginaArhiva,
  paginaBuletin,
  paginaCarcasa,
  paginaCautare,
  paginaMesaj,
  paginaNou,
  rubricaChestionar,
  schitaPeEcran,
} from './pagini.js'

/**
 * Rândurile rubricii „Chestionarul buletinului nou": ce se editează și la ce se uită fiecare
 * întrebare. ⚠️ ORDINEA e cea din `schita.ts` — ea e a mașinii de stări, nu a ecranului; aici se
 * scriu doar etichetele, ca adminul să știe la ce răspunde fiecare câmp.
 */
const RANDURILE_CHESTIONARULUI = [
  { cheie: 'motto', eticheta: '1. Motto-ul', spune: 'Se arată motto-ul numărului trecut ({motto}) și cine l-a spus ({autor}).' },
  { cheie: 'text', eticheta: '2. Textul', spune: 'Aici omul lipește articolul. {articol} spune despre care articol e vorba.' },
  { cheie: 'autor', eticheta: '3. Autorul', spune: 'Autorul ({autor}) e propus de cod din text — primul sau ultimul rând scurt, „de …", „Sfântul …".' },
  { cheie: 'ani', eticheta: '4. Anii vieții', spune: 'Anii ({ani}) ies din text, dacă apar scriși acolo.' },
  { cheie: 'pomenire', eticheta: '5. Pomenirea', spune: 'Ziua ({pomenire}) se caută în calendarul parohiei, după numele autorului. Dacă nu e sfânt, întrebarea nu se pune.' },
  { cheie: 'titlu', eticheta: '6. Titlul', spune: 'Titlurile ({titluri}) sunt scoase din text și numerotate; omul alege unul sau scrie altul.' },
  { cheie: 'sursa', eticheta: '7. Sursa', spune: 'Sursa ({sursa}) se caută în text: „Sursa:", „din:" sau un domeniu scris acolo.' },
  { cheie: 'mai_adaugam', eticheta: '8. Mai adăugăm?', spune: 'La „da" se reiau întrebările 2–7 pentru un articol secundar; la „nu" se trece la compunere.' },
]

export interface Env {
  DB: D1Database
  FISIERE: R2Bucket
  IDENTITATE: Fetcher
  /** Autorizarea centrala: de la ea se afla daca omul e administratorul BULETINULUI (18.09.2026). */
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  COMUNICARE: Fetcher
  /** Programul: de la el se cere tabelul tiparit de pe pagina a patra (`/v1/tabel-tipar`). */
  PROGRAM: Fetcher
  /** Calendarul: de la el se afla ziua de pomenire a autorului, la chestionarul numarului nou. */
  CALENDAR?: Fetcher
  /** Browser Rendering: din HTML-ul foii iese PDF-ul de tipar. */
  BROWSER: Fetcher
  /** Creierul bulei de chat de pe `/nou` (18.09.2026); lipsa lui inseamna doar ca bula nu se aprinde. */
  CHAT?: Fetcher
  /** Hartiile pe care le intorc actiunile, cand le intorc — bula le da mai departe. */
  MEDIA?: Fetcher
  /** Comutatoarele modulelor, scrise din panoul de admin: de aici afla bula daca e pornita. */
  CONFIG?: KVNamespace
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Secretul dintre workerii nostri; fara el `/_actiuni` nu exista. */
  SECRET_INTERN?: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

/**
 * Verbele buletinului, publicate la `/_actiuni`: socoteala lungimii și compunerea unui număr.
 * Răspund DOAR prin Service Binding, cu secretul platformei — de pe internet calea nu există.
 */
const MODUL = modulActiuni<Env>({
  aplicatie: 'buletin',
  versiune: pkg.version,
  actiuni: actiuniBuletin,
  /*
   * ⚠️ CUPRINSUL, în manifest (19.09.2026). Cu el, bula buletinului capătă în chat fluxul cu două
   * nivele — subiect, apoi acțiune, apoi confirmare — iar promptul vechi (patru unelte, optsprezece
   * reguli) nu se mai trimite. Aplicațiile care nu scriu rândul ăsta (program, tipic) rămân neatinse.
   */
  harta: HARTA_BULETIN,
})

/**
 * BULA DE CHAT A BULETINULUI (user, 18.09.2026: „am făcut-o să fie transmisibilă… să facem Buletinul
 * să aibă această funcție și să fie afișată doar pe /nou — când fac un buletin nou, ca să pot trimite
 * instrucțiuni, texte etc. care să se lege la API-ul buletinului nou și să-l completeze").
 *
 * ⚠️ NUMAI PE `/nou`. În restul buletinului bula nu se scrie deloc: celelalte pagini sunt hârtie
 * publică, iar acolo un chat n-ar avea ce face. Poarta modulului (comutatorul din Module + drepturile
 * omului) rămâne a lui — asta e doar locul.
 *
 * ⚠️ Lanțul întreg e cel de la Program, neschimbat: omul scrie, modelul cheamă `buletin.compune`
 * (acțiune de SCRIERE, deci se întoarce ca **propunere cu Da/Nu**, nu se face pe furiș), iar după „Da"
 * pagina se reîncarcă — și atunci ecranul `/nou` se umple din cererea păstrată lângă PDF. De aceea
 * „să-l completeze" nu cere niciun drum nou: ciorna compusă E starea ecranului.
 */
const CHAT = modulChat({
  aplicatie: 'buletin',
  titlu: 'Scrie buletinul',
  /*
   * ⚠️ FIȘIERUL INTRĂ DIRECT ÎN SCHIȚĂ, nu în discuție (user, 18.09.2026, 22:20). Un articol de Word
   * are vreo 9000 de semne: dacă ar pleca spre model ca mesaj, ar trebui să-l trimită el înapoi,
   * literă cu literă, printr-un `buletin.raspunde` — adică exact lucrul pe care schița a fost scrisă
   * să-l ocolească („partea grea o duce codul, modelul doar potrivește fraza cu un subiect").
   * Aici CODUL scrie, prin aceeași funcție de domeniu (`scrieRaspuns`), iar modelul primește o frază.
   */
  laFisier: (f, c) => laFisierulBuletinului(f, c.env as unknown as Env),
  /*
   * ⚠️ ȘI TEXTUL LIPIT ÎN CÂMP, nu doar fișierul (19.09.2026). Pe 18.09, la 20:50, cineva a lipit
   * articolul paginii întâi — 9108 semne — la întrebarea „Care este textul principal din acest
   * buletin?". Textul a plecat întreg la model, care ar fi trebuit să-l scrie ÎNAPOI, literă cu
   * literă, ca argument al lui `buletin.raspunde`. N-a mai venit niciun răspuns: discuția s-a oprit
   * la „mă gândesc…". Drumul e același ca la docx — scrie CODUL, prin `scrieRaspuns`.
   */
  laText: (text, c) => laTextulBuletinului(text, c.env as unknown as Env),
})

/** Cifrele mari, cum se citesc: „8 912". */
const cuMii = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const hexScurt = (cati: number): string =>
  [...crypto.getRandomValues(new Uint8Array(cati))].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * SCHIȚA ȘI ÎNTREBAREA DE ACUM, plus scrierea unui răspuns în ea — partea comună a celor DOUĂ cârlige
 * ale bulei (`laFisier` și `laText`).
 *
 * ⚠️ Una singură, dinadins: un .docx urcat și un text lipit trebuie să ajungă în ACELAȘI loc, prin
 * aceeași funcție de domeniu (`scrieRaspuns`). Două drumuri ar fi însemnat două purtări pentru același
 * lucru — și una dintre ele s-ar fi stricat în tăcere.
 */
async function schitaDeAcum(env: Env) {
  const [{ schita }, intrebari] = await Promise.all([schitaNumarului(env), chestionarul(env)])
  const deAcum = urmatoareaIntrebare(schita, intrebari)
  const pastreaza = async (cerut: Parameters<typeof scrieRaspuns>[1]) => {
    const scris = scrieRaspuns(schita, cerut, intrebari)
    // autorul se propune din textul proaspăt scris, deci pomenirea lui se caută acum, nu la mesajul următor
    await cautaPomenirile(env, scris.schita)
    const urm = urmatoareaIntrebare(scris.schita, intrebari)
    await scrieSchita(env, scris.schita, { subiect: urm.subiect, articol: urm.articol })
  }
  return { schita, deAcum, pastreaza }
}

/**
 * TEXTUL UNUI ARTICOL, SCRIS DIRECT ÎN SCHIȚĂ. `null` = „nu e locul lui aici" — atunci textul merge pe
 * drumul obișnuit și omul spune el unde-l vrea.
 *
 * ⚠️ `strict` deosebește cele două cârlige, și deosebirea e cerută de viață:
 *  - un **.docx urcat** e limpede articolul, oricât de devreme ar fi chestionarul — deci intră și când
 *    întrebarea de acum e motto-ul (articolul n-are încă text);
 *  - un **text lipit în câmp** la întrebarea motto-ului e chiar MOTTO-UL dictat, nu articolul. Fără
 *    `strict`, un motto mai lung de un rând ar fi ajuns tăcut textul paginii întâi.
 */
async function textulInSchita(
  env: Env,
  text: string,
  o: { dinFisier?: string; strict?: boolean } = {},
): Promise<{ mesaj: string; catreChat: string; unelte: string[] } | null> {
  const { schita, deAcum, pastreaza } = await schitaDeAcum(env)
  const care = deAcum.articol
  /*
   * ⚠️ „N-ARE ÎNCĂ TEXT" ÎNSEAMNĂ ȘI „ARE DOAR LOCUL LUI" (19.09.2026). De când schița pornește
   * implicită, cu „text" în câmp, un `!articolul(…).text` ar fi fost fals la primul .docx urcat: fișierul
   * s-ar fi dus pe drumul generic, iar articolul ar fi rămas cu patru semne. Vezi `eDeProba`.
   */
  const asteaptaText =
    deAcum.subiect === 'text' ||
    (eDeProba(articolul(schita, care).text) && (!o.strict || (deAcum.subiect !== 'motto' && deAcum.subiect !== 'gata')))
  if (!asteaptaText) return null

  await pastreaza({ subiect: 'text', valoare: text, articol: care })
  return {
    // ⚠️ `unelte` e pentru ecranul de dedesubt: schița s-a schimbat ACUM, nu când răspunde modelul.
    unelte: ['buletin.raspunde'],
    mesaj:
      `Am pus textul${o.dinFisier ? ` din ${o.dinFisier}` : ''} (${cuMii(semne(text))} de semne) ` +
      `ca textul articolului ${NUMELE_ZONEI[care]}.`,
    /*
     * ⚠️ CE CERE CHATUL E ALTCEVA DECÂT CE SE SPUNE OMULUI (19.09.2026). Treaba e deja făcută, din
     * cod; chatului îi rămâne doar să pună întrebarea următoare — și „unde am rămas" e chiar comanda
     * hărții pentru asta, potrivită determinist, fără niciun apel de model. Trimisă nota de mai sus,
     * potrivitorul ar fi citit în ea „textul" și „articolul principal" și ar fi luat-o drept o
     * instrucțiune nouă, cerând textul a doua oară.
     */
    catreChat: 'unde am rămas',
  }
}

/**
 * Cât trebuie să aibă un text lipit în bulă ca să fie luat drept ARTICOL, nu drept răspuns.
 *
 * 400 e măsura pe care platforma o dă deja unui câmp scurt al schiței (`MAXIM_CAMP`): un titlu, o
 * sursă, un „rămâne așa" ori un nume de autor stau toate sub ea, iar un articol de buletin are vreo
 * nouă mii. Între cele două nu e nicio ambiguitate de care să ne temem.
 */
const PRAG_TEXT_ARTICOL = 400

/**
 * CE FACE BULETINUL CU UN TEXT LUNG LIPIT ÎN BULĂ (19.09.2026): îl scrie în schiță, din cod, și
 * întoarce modelului o frază. Textul nu mai ajunge niciodată în context — nici la dus, nici la întors.
 */
async function laTextulBuletinului(
  text: string,
  env: Env,
): Promise<{ mesaj: string; catreChat: string; unelte: string[] } | null> {
  if (text.trim().length <= PRAG_TEXT_ARTICOL) return null
  return await textulInSchita(env, text, { strict: true })
}

/**
 * CE FACE BULETINUL CU UN FIȘIER URCAT ÎN BULĂ.
 *
 *  - **.docx / .txt** → textul articolului la care e chestionarul acum, scris pe loc în schiță. Numai
 *    dacă acolo chiar se aștepta un text (întrebarea de acum e `text`, ori articolul n-are niciunul):
 *    altfel se întoarce `null` și fișierul merge pe drumul generic, ca mesaj — omul spune el unde-l vrea.
 *  - **poză** → în depozitul buletinului, sub `poze/<nr>-<data>/…`, iar în schiță se scrie ADRESA ei
 *    publică. ⚠️ Adresa, nu cheia: foaia se randează în Browser Rendering, un browser din afară care
 *    ia poza de pe internet; cu o cheie de depozit, locul pozei ar rămâne gol, fără nicio eroare.
 */
async function laFisierulBuletinului(
  f: { nume: string; fel: string; tip: string; text: string; continut: ArrayBuffer },
  env: Env,
): Promise<{ text?: string; mesaj?: string; catreChat?: string; poza?: string; unelte?: string[] } | null> {
  if (f.fel === 'docx' || f.fel === 'txt') {
    const pus = await textulInSchita(env, f.text, { dinFisier: f.nume })
    return pus ? { text: f.text, unelte: pus.unelte, mesaj: pus.mesaj, catreChat: pus.catreChat } : null
  }

  const { schita, deAcum, pastreaza } = await schitaDeAcum(env)
  const care = deAcum.articol
  const ext = f.fel === 'png' ? 'png' : f.fel === 'webp' ? 'webp' : 'jpg'
  const cheie = `poze/${schita.nr ?? 0}-${schita.data}/${Date.now().toString(36)}-${hexScurt(3)}.${ext}`
  await env.FISIERE.put(cheie, f.continut, { httpMetadata: { contentType: f.tip } })
  const adresa = `${env.ORIGINE_PUBLICA.replace(/\/+$/, '')}/fisier/${cheie}`
  await pastreaza({ subiect: 'poza', valoare: adresa, articol: care })
  return {
    poza: adresa,
    unelte: ['buletin.raspunde'],
    mesaj: `Am pus poza ${f.nume} la articolul ${NUMELE_ZONEI[care]}. Dacă o vrei la alt articol, spune-mi.`,
    // vezi lămurirea de la `textulInSchita`: poza e deja urcată, chatului îi rămâne întrebarea următoare
    catreChat: 'unde am rămas',
  }
}

const SERVICIU = 'app-buletin'
/** Audienta abonatilor — numele ei sta in registrul `ABONAMENTE` din `@xc/abonare`, nu aici. */
const ABONAMENT = abonamentul('buletin')
const CACHE_PAGINI = 'public, max-age=300'

const eAdresaDeMasina = (cale: string) => /^\/(v1|intern|\.well-known|health)(\/|$)/.test(cale)

/** Cheile din R2 sunt scrise de import, nu de om: `2026/buletin-615-2026-09-06.pdf`. Orice altceva
 *  nu se cauta in depozit — nici macar ca sa se afle ca nu exista. */
const CHEIE_BUNA = /^\d{4}\/buletin-\d{3,4}-\d{4}-\d{2}-\d{2}(-mic)?\.(pdf|jpg)$/

/**
 * POZELE URCATE ÎN BULĂ, pentru numărul care se face: `poze/<nr>-<data>/<timp36>-<hex6>.jpg`.
 *
 * ⚠️ TREBUIE SĂ FIE PUBLICE, și de aceea stau aici, lângă foi: pagina întâi se randează în Browser
 * Rendering, adică într-un browser din afară, fără sesiunea omului. El cere poza de pe internet, la
 * `/fisier/<cheie>`; ascunsă în spatele porții, ar lăsa locul pozei gol pe hârtie, fără nicio eroare.
 * Nu se deschide nimic în plus: cheia poartă ora și șase semne la întâmplare, deci nu se ghicește, iar
 * ce e în ea ajunge oricum pe o foaie împărțită în biserică.
 * ⚠️ Forma cheii e scrisă și în `laFisierulBuletinului` — se schimbă amândouă odată.
 */
const CHEIE_POZA = /^poze\/\d{1,4}-\d{4}-\d{2}-\d{2}\/[a-z0-9]{1,12}-[0-9a-f]{6}\.(jpg|png|webp)$/

/**
 * Asseturile modulului de rasfoit (Real3D FlipBook), tinute tot in depozit, sub `flipbook/`: 3,8 MB
 * n-au ce cauta in codul workerului, iar pagina parohiei nu atarna de un CDN strain. Se aduc doar
 * cand omul apasa „Răsfoiește". Se urca cu `node apps/buletin/unelte/urca-flipbook.mjs`.
 *
 * Numele se verifica INTAI: doar dosarele modulului si doar felurile lui de fisiere. Fara asta,
 * `/flipbook/<orice>` ar deveni o fereastra spre tot depozitul.
 */
const CHEIE_FLIPBOOK = /^(jquery\.min\.js|(js|css|images|mp3|webfonts)\/[\w.-]+(\/[\w.-]+)?)$/
const TIPURI_FLIPBOOK: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  bcmap: 'application/octet-stream',
}

function redirect(catre: string, status: 302 | 303 = 303): Response {
  return new Response(null, { status, headers: { location: catre } })
}

async function scrieAudit(
  env: Env,
  i: {
    action: string
    target: string
    outcome: 'success' | 'failure'
    correlationId: string
    actorId?: string
    /**
     * ⚠️ CE S-A ÎNTÂMPLAT, nu doar că s-a întâmplat. Cine nu-l scrie rămâne cu `{}`, ca până pe
     * 19.09.2026: intrarea unei compuneri căzute nu spunea de ce a căzut (nr. 616, 10:55:55).
     * Se ține MIC — coloana se citește cu ochiul, într-un tabel.
     */
    summary?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: i.action,
        target: i.target,
        scope: SCOPE_GLOBAL,
        actor: i.actorId ? { type: 'user', id: i.actorId } : { type: 'system' },
        outcome: i.outcome,
        correlationId: i.correlationId,
        summary: i.summary ?? {},
      }),
    })
  } catch {
    // auditul indisponibil nu blocheaza operatia
  }
}

async function comunicare<T = unknown>(env: Env, cale: string, corp: unknown): Promise<T | null> {
  try {
    const r = await env.COMUNICARE.fetch(`https://comunicare.intern${cale}`, {
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
 * Un fisier din depozit: PDF-ul unui numar sau poza paginii lui intai.
 *
 * ⚠️ NU MAI E „IMMUTABLE" DIN OFICIU (18.09.2026, user: „să faci ceva cu cache-ul"). Presupunerea
 * veche — numele poarta numarul si data, deci continutul nu se schimba niciodata — s-a rupt in ziua
 * in care numarul se compune CHIAR AICI: omul recompune 616 de cinci ori pana iese cum vrea, iar
 * cheia ramane aceeasi. Cu `immutable` pe un an, browserul lui arata a doua oara tot foaia dintai si
 * pare ca indreptarea nu s-a facut.
 *   - cu `?v=<amprenta>` (asa isi scrie ecranul compunerii toate legaturile) adresa e ALTA la fiecare
 *     randare, deci se poate tine un an — cine o are, o are pe cea buna;
 *   - fara `v`, o ora, cu `etag`: numerele vechi din arhiva se tin oricum in cache, iar o foaie
 *     rescrisa se indreapta singura la prima revalidare, care costa un 304.
 */
async function fisierul(req: Request, url: URL, env: Env, cheie: string): Promise<Response> {
  const ePoza = CHEIE_POZA.test(cheie)
  if (!CHEIE_BUNA.test(cheie) && !ePoza) return new Response('Nu există fișierul.', { status: 404 })
  const obiect = await env.FISIERE.get(cheie, { onlyIf: req.headers })
  if (!obiect) return new Response('Nu există fișierul.', { status: 404 })
  const h = new Headers()
  obiect.writeHttpMetadata(h)
  h.set('etag', obiect.httpEtag)
  // Poza urcată în bulă: cache SCURT. Cheia ei e unică, deci n-ar strica un an — dar ea trăiește
  // câteva ore, cât se face numărul, iar Browser Rendering o cere la fiecare recompunere.
  h.set(
    'cache-control',
    ePoza
      ? 'public, max-age=300'
      : url.searchParams.has('v')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
  )
  if (cheie.endsWith('.pdf')) {
    const nume = cheie.slice(cheie.lastIndexOf('/') + 1)
    h.set(
      'content-disposition',
      `${url.searchParams.has('descarca') ? 'attachment' : 'inline'}; filename="${nume}"`,
    )
  }
  // `onlyIf` a raspuns cu obiectul FARA continut: browserul are deja versiunea buna
  if (!('body' in obiect) || !obiect.body) return new Response(null, { status: 304, headers: h })
  return new Response(obiect.body, { headers: h })
}

/**
 * BROȘURA unui numar — PDF-ul lui, asezat doua pagini pe o coala A4, in ordinea indoirii (user,
 * 17.09.2026). Socoteala e in `tipar.ts`; aici e doar drumul: numarul → PDF-ul din depozit →
 * brosura → depozit, ca a doua apasare sa n-o mai faca.
 *
 * ⚠️ SE TINE IN DEPOZIT, sub `tipar/…`: asezarea e o socoteala pe tot PDF-ul (700 KB la un numar
 * obisnuit), iar buletinul e tiparit de acelasi om de mai multe ori, saptamana de saptamana. Prima
 * apasare o face, restul o iau gata facuta. Cheia poarta si felul colii si reversul, deci `a3`, `a4`
 * si `a4-revers` nu se calca una pe alta.
 * ⚠️ Cine n-are PDF (doua numere vechi, ramase doar ca poza) primeste 404, nu o brosura goala.
 */
async function tiparul(req: Request, url: URL, env: Env, nr: number, data: string): Promise<Response> {
  /*
   * ⚠️ Și numărul NEVALIDAT se poate tipări (18.09.2026): ecranul compunerii arată foaia proaspăt
   * făcută cu toate butoanele ei, iar „Tipărește" e chiar butonul după care omul se uită pe hârtie
   * înainte să valideze. Rândul din arhivă nu există încă, dar PDF-ul stă în depozit sub cheia lui
   * știută — de acolo se ia. Nu se deschide nimic în plus: cheia se putea ghici oricum, iar foaia
   * e publică din clipa în care e pusă (`/fisier/…`).
   */
  const b = (await unul(env.DB, nr, data)) ?? (await ciornaDinDepozit(env, nr, data))
  if (!b?.cheie_pdf) return new Response('Numărul acesta n-are foaie de tipărit.', { status: 404 })
  const coala: Coala = url.searchParams.get('coala') === 'a3' ? 'a3' : 'a4'
  // `?revers=1` — versoul intors cu 180°, pentru imprimantele care intorc coala pe latura scurta
  const revers = url.searchParams.get('revers') === '1'
  const cheie = cheiaBrosurii(b.cheie_pdf, coala, revers)
  const nume = numeBrosura(b.cheie_pdf, coala, revers)

  // Cache-ul, ca la `/fisier/`: un an numai cu `?v=<amprenta>` pe adresă, altfel o oră cu etag —
  // altfel broșura unui număr recompus ar rămâne cea dinainte în browserul celui care tocmai a tipărit.
  const antete = (etag: string) =>
    new Headers({
      'content-type': 'application/pdf',
      etag,
      'cache-control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      'content-disposition': `${url.searchParams.has('descarca') ? 'attachment' : 'inline'}; filename="${nume}"`,
    })

  const gata = await env.FISIERE.get(cheie, { onlyIf: req.headers })
  if (gata) {
    const h = antete(gata.httpEtag)
    if (!('body' in gata) || !gata.body) return new Response(null, { status: 304, headers: h })
    return new Response(gata.body, { headers: h })
  }

  const foaia = await env.FISIERE.get(b.cheie_pdf)
  if (!foaia) return new Response('Nu există fișierul.', { status: 404 })
  const facuta = await brosura(await foaia.arrayBuffer(), coala, revers)
  // ⚠️ `slice` pe buffer: `save()` intoarce o vedere peste un buffer mai mare, iar R2 ar urca tot
  // bufferul, cu coada lui cu tot.
  const octeti = facuta.slice().buffer as ArrayBuffer
  const pus = await env.FISIERE.put(cheie, octeti, {
    httpMetadata: { contentType: 'application/pdf' },
  })
  return new Response(octeti, { headers: antete(pus?.httpEtag ?? `"${cheie}"`) })
}

/**
 * CIORNA din depozit — numărul compus, dar încă nevalidat: în bază nu e niciun rând, iar fișierele
 * stau deja sub cheile lui știute. Se întoarce în forma unui rând de arhivă, ca paginile și broșura
 * să nu aibă nevoie de două drumuri. `null` dacă n-a fost compus.
 */
async function ciornaDinDepozit(env: Env, nr: number, data: string): Promise<Buletin | null> {
  const cheie = cheiaNumarului({ nr, data })
  const foaia = await env.FISIERE.head(cheie)
  if (!foaia) return null
  const coperta = await env.FISIERE.head(cheiaCopertei({ nr, data }))
  return {
    nr,
    data,
    an: data.slice(0, 4),
    luna: data.slice(5, 7),
    cheie_pdf: cheie,
    cheie_poza: coperta ? coperta.key : null,
    cheie_poza_mica: coperta ? coperta.key : null,
    marime_pdf: foaia.size,
    pagini: PAGINI,
    sursa: 'ciorna',
  }
}

/**
 * Un fisier al modulului de rasfoit, din depozit. Modulul isi afla singur adresele fratilor lui
 * (`three.`, `pdf.`, `flipbook.webgl.`…) din propria adresa, deci dosarul trebuie servit intreg,
 * cu numele neschimbate. Se tine in cache un an — asseturile unui modul cumparat nu se schimba
 * decat la o actualizare, cand se reia unealta de urcare.
 */
async function fisierFlipbook(req: Request, env: Env, cheie: string): Promise<Response> {
  if (!CHEIE_FLIPBOOK.test(cheie)) return new Response('Nu există fișierul.', { status: 404 })
  const obiect = await env.FISIERE.get(`flipbook/${cheie}`, { onlyIf: req.headers })
  if (!obiect) return new Response('Nu există fișierul.', { status: 404 })
  const ext = cheie.slice(cheie.lastIndexOf('.') + 1).toLowerCase()
  const h = new Headers()
  h.set('content-type', TIPURI_FLIPBOOK[ext] ?? 'application/octet-stream')
  h.set('etag', obiect.httpEtag)
  h.set('cache-control', 'public, max-age=31536000, immutable')
  if (!('body' in obiect) || !obiect.body) return new Response(null, { status: 304, headers: h })
  return new Response(obiect.body, { headers: h })
}

// ---------------------------------------------------------------------------
// API-ul `/v1` — ce dau masinile celorlalte aplicatii. GET, public, fara jeton.
// Adresele sunt cele din V1, cu aceeasi precizare adusa de arhiva adevarata: numarul singur nu e
// cheie, asa ca fiecare buletin poarta si `data`.
// ---------------------------------------------------------------------------

/** Un buletin, cum il vede o alta aplicatie: cifrele lui si adresele intregi ale fisierelor. */
const dupaContract = (b: BuletinScurt, radacina: string) => ({
  nr: b.nr,
  data: b.data,
  an: b.an,
  luna: b.luna,
  pagini: b.pagini,
  pagina: `${radacina}/buletin/${b.nr}-${b.data}`,
  pdf: b.cheie_pdf ? `${radacina}/fisier/${b.cheie_pdf}` : null,
  poza: b.cheie_poza_mica ? `${radacina}/fisier/${b.cheie_poza_mica}` : null,
})

async function api(req: Request, env: Env, cale: string, url: URL, radacina: string): Promise<Response> {
  if (cale === '/health') {
    const n = await numaratoare(env.DB).catch(() => null)
    return json(
      {
        ok: true,
        app: 'buletin',
        cod: 'A3',
        stare: n && n.buletine > 0 ? 'cu date' : 'fara date',
        date: n,
        mediu: env.MEDIU,
        versiune: pkg.version,
        publicat: env.VERSIUNE?.timestamp ?? null,
        ora: new Date().toISOString(),
      },
      200,
      { 'cache-control': 'no-store' },
    )
  }

  if (cale === '/v1' || cale === '/v1/') {
    return jsonCuEtag(
      req,
      {
        app: 'buletin',
        cod: 'A3',
        adrese: [
          { adresa: '/v1/curent', ce_da: 'numărul curent' },
          { adresa: '/v1/arhiva?an=2026', ce_da: 'numerele unui an (fără `an`: anul curent)' },
          { adresa: '/v1/numar/2026/615', ce_da: 'un număr anume' },
          { adresa: '/v1/numar/2026/615.pdf', ce_da: 'PDF-ul lui' },
        ],
      },
      { 'cache-control': 'public, max-age=3600' },
    )
  }

  if (cale === '/v1/curent') {
    const b = await ultimul(env.DB)
    if (!b) return eroareApi(404, 'arhiva_goala', 'Arhiva e goală.')
    return jsonCuEtag(req, { buletin: dupaContract(b, radacina) }, { 'cache-control': 'public, max-age=300' })
  }

  if (cale === '/v1/arhiva') {
    const an = url.searchParams.get('an') ?? String(new Date().getFullYear())
    if (!/^\d{4}$/.test(an)) return eroareApi(400, 'an_invalid', 'Anul se scrie cu patru cifre.')
    const lista = await dintrUnAn(env.DB, an)
    return jsonCuEtag(
      req,
      { an, cate: lista.length, buletine: lista.map((b) => dupaContract(b, radacina)) },
      { 'cache-control': 'public, max-age=900' },
    )
  }

  const m = /^\/v1\/numar\/(\d{4})\/(\d{1,4})(\.pdf)?$/.exec(cale)
  if (m) {
    const an = m[1]!
    const nr = Number(m[2])
    const lista = await dintrUnAn(env.DB, an)
    const b = lista.filter((x) => x.nr === nr).sort((a, c) => (a.data < c.data ? -1 : 1))[0]
    if (!b) return eroareApi(404, 'numar_inexistent', `Numărul ${nr} nu e în ${an}.`)
    if (m[3]) {
      if (!b.cheie_pdf) return eroareApi(404, 'fara_pdf', `Numărul ${nr} a rămas în arhivă doar ca poză.`)
      return redirect(`${radacina}/fisier/${b.cheie_pdf}`, 302)
    }
    return jsonCuEtag(req, { buletin: dupaContract(b, radacina) }, { 'cache-control': 'public, max-age=900' })
  }

  return eroareApi(404, 'adresa_inexistenta', `Adresa ${cale} nu există sub /v1.`)
}

export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    /**
     * ⚠️ MONTAJUL SE IA DIN MEDIU, nu din cale — buletinul e singura aplicatie care are o ruta
     * proprie cu chiar numele ei: `/buletin/<nr>-<data>`, adresa unui numar, mostenita din V1.
     * Pe subdomeniu (`buletin.staging.sfantul-ilie.ro/buletin/615-2026-09-06`) `prefixSiCale` lua
     * acel `/buletin` drept prefixul gateway-ului, taia calea la `/615-2026-09-06` si pagina
     * numarului dadea 404 — reclamat de user, 13.09.2026. Prin gateway (numai in dev) aplicatia
     * chiar sta sub `/buletin`; in staging si productie sta la radacina, deci montajul e gol.
     */
    const { prefix, cale } = prefixSiCale(url, env.MEDIU === 'dev' ? '/buletin' : '')
    const nav = navigatieDin(cfg)
    const radacina = new URL(prefix || '/', cfg.ORIGINE_PUBLICA).toString().replace(/\/$/, '')

    // Acțiunile interne (socoteala și compunerea numărului): numai prin Service Binding.
    const raspunsActiuni = await MODUL.ruteaza(req, env, ctxExec, cale)
    if (raspunsActiuni) return raspunsActiuni

    if (eAdresaDeMasina(cale)) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return eroareApi(405, 'metoda_nepermisa', 'Sub /v1 merg doar GET și HEAD.')
      }
      try {
        return await api(req, env, cale, url, radacina)
      } catch (e) {
        log.error('eroare api', { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, 'eroare_interna', 'A apărut o eroare neașteptată.')
      }
    }

    // Fisierele: deschise, fara sesiune — buletinul parohiei e hartie publica, se imparte in biserica.
    if (cale.startsWith('/fisier/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Metoda nu e permisă.', { status: 405 })
      return await fisierul(req, url, env, decodeURIComponent(cale.slice(8)))
    }

    // Broșura de tipar. Deschisă ca și foaia: buletinul se împarte în biserică, tipărirea lui la fel.
    if (cale.startsWith('/tipar/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Metoda nu e permisă.', { status: 405 })
      const m = /^\/tipar\/(\d{1,4})-(\d{4}-\d{2}-\d{2})\.pdf$/.exec(cale)
      if (!m) return new Response('Adresa broșurii e /tipar/615-2026-09-06.pdf', { status: 404 })
      try {
        return await tiparul(req, url, env, Number(m[1]), m[2]!)
      } catch (e) {
        log.error('brosura n-a iesit', { eroare: e instanceof Error ? e.message : String(e) })
        return new Response('Foaia asta nu s-a putut așeza pentru tipar.', { status: 500 })
      }
    }

    // Asseturile rasfoitului. Tot fara sesiune: sunt fisiere de modul, nu date.
    if (cale.startsWith('/flipbook/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Metoda nu e permisă.', { status: 405 })
      return await fisierFlipbook(req, env, decodeURIComponent(cale.slice(10)))
    }

    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
      if (problema) {
        const ctxMinim: Ctx = {
          prefix,
          nav,
          utilizator: null,
          eAdmin: false,
          versiune: pkg.version,
          modificata: dataVersiunii(env.VERSIUNE),
        }
        return html(paginaMesaj(ctxMinim, {}, 'Verificare de securitate', `<p>${problema}</p>`), 403)
      }
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Metoda nu e permisă.', { status: 405 })
    }

    // PAGINILE SUNT DESCHISE, ca in V1: buletinul parohiei e hartie publica. Scrierea — abonarea —
    // cere in continuare cont.
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      // adresa contului, pentru fereastra de abonare: acolo se scrie in camp si se incuie, fiindca
      // abonarea platformei sta pe adresa contului, nu pe una scrisa de mana
      emailulContului: sesiune.user?.email ?? null,
      // ⚠️ Adminul BULETINULUI vine din cheia aplicatiei (`bulletin.write`), nu din rolul global
      // (18.09.2026): asa poate fi cineva admin numai aici. De el atarna `/nou`, compunerea si
      // validarea — care la buletin E publicarea. Rolul global rămâne pentru randul „Administrare".
      eAdmin: await eAdminulAplicatiei(env.AUTORIZARE, cid, principal, 'buletin'),
      eAdminPlatforma: sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin'),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }
    /*
     * CHATUL. Rutele (`/chat…`) merg ÎNAINTEA paginilor, ca la Program, iar bula se pune mai jos,
     * numai pe `/nou`. ⚠️ Poarta e una singură, în modul: dacă chatul e stins din Module ori omul
     * n-are dreptul, rutele răspund 404 — nu „stins", nu „n-ai voie". `eAdmin` de aici e adminul
     * BULETINULUI (cheia lui), deci cine ține buletinul are și bula, fără să fie admin pe platformă.
     */
    const ctxChat = { prefix, principal, numeleOmului: ctx.utilizator, eAdmin: ctx.eAdmin }
    const raspunsChat = await CHAT.ruteaza(req, env, ctxExec, cale, ctxChat)
    if (raspunsChat) return raspunsChat

    // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea; in dev nu se tine
    // cache deloc (cei cinci minute faceau schimbarile sa para nefacute).
    const cachePagina = {
      'cache-control':
        ctx.utilizator || ctx.veziCa ? 'private, no-store' : env.MEDIU === 'dev' ? 'no-store' : CACHE_PAGINI,
    }
    const raspuns = url.searchParams.get('abonat')
    /**
     * ⚠️ ANII SE CER O DATA, LA FIECARE PAGINA: din ei se naste fasia care coboara din cheia Arhivei
     * (`Meniu.ani`), iar fasia trebuie sa fie aceeasi peste tot, nu doar in arhiva. E o singura
     * numaratoare pe an (`GROUP BY`), pe o tabela de 619 randuri.
     * ⚠️ O pagina care nu-i poate da (eroarea depozitului) ramane cu segmentul-LINK catre /arhiva:
     * `ani` gol inseamna „fara bara", nu „cheie moarta" — vezi `pastilaNumarului`.
     */
    const meniu = (rest: Partial<Meniu> = {}): Meniu => ({
      veste: raspuns === '1' ? 'inscris' : raspuns === '2' ? 'scos' : raspuns === '0' ? 'eroare' : null,
      ...rest,
    })
    let ceruti: Promise<{ an: string; cate: number }[]> | null = null
    const listaAnilor = () => (ceruti ??= anii(env.DB).catch(() => []))
    const cuAni = async (rest: Partial<Meniu> = {}): Promise<Meniu> =>
      meniu({ ani: (await listaAnilor()).map((a) => a.an), ...rest })

    try {
      /*
       * ABONAREA — drumul intreg sta in `@xc/abonare`, acelasi pentru toata platforma (user,
       * 15.09.2026). Buletinul da doar ce e al lui: randul din registru (audienta), carcasa in care
       * se scriu paginile si jurnalul. Intoarce `null` cand adresa nu e a abonarii.
       */
      const raspunsAbonare = await ruteazaAbonare(req, cale, env, {
        abonament: ABONAMENT,
        prefix,
        cfg,
        cid,
        principal,
        carcasa: (p) => paginaCarcasa(ctx, p),
        audit: (i) => scrieAudit(env, { ...i, correlationId: cid }),
      })
      if (raspunsAbonare) return raspunsAbonare

      /*
       * CHESTIONARUL BULETINULUI NOU — cele opt întrebări ale bulei, scrise de adminul buletinului
       * (user, 18.09.2026, seara). Ruta stă ÎNAINTEA Setărilor fiindcă `ruteazaSetari` nu cunoaște
       * calea asta (ar da `null`), iar paza e a noastră: adminul aplicației + jetonul CSRF pereche
       * cu al paginii. Se scrie în KV `CONFIG`, la cheia aplicației — nicio publicare pentru o
       * virgulă schimbată într-o întrebare.
       */
      if (cale === '/setari/chestionar') {
        const inapoi = (coada: string) =>
          new Response(null, { status: 303, headers: { location: `${prefix}/setari${coada}#chestionar`, 'cache-control': 'no-store' } })
        if (req.method !== 'POST' || !ctx.eAdmin) return redirect(`${prefix}/setari`)
        const f = await req.formData()
        if (verificaTokenCsrf(req, String(f.get('csrf') ?? ''))) return inapoi('?chestionar=rau')
        if (!env.CONFIG) return inapoi('?chestionar=rau')
        try {
          if (f.get('fapta') === 'standard') {
            // „Înapoi la textele standard" doar GOLEȘTE cheia: standardul stă în cod, nu se copiază
            // în KV — altfel o îndreptare de acolo n-ar mai ajunge la parohie.
            await env.CONFIG.delete(CHEIE_CHESTIONAR)
          } else {
            const scrise: Record<string, string> = {}
            for (const [k, v] of f.entries()) if (typeof v === 'string') scrise[k] = v
            await env.CONFIG.put(CHEIE_CHESTIONAR, JSON.stringify(normalizeazaChestionar(scrise)))
          }
        } catch {
          return inapoi('?chestionar=rau')
        }
        return inapoi('?chestionar=salvat')
      }

      // SETARILE — tot un singur loc, `@xc/setari` (user, 15.09.2026).
      const raspunsSetari = await ruteazaSetari(req, cale, env, {
        cod: 'buletin',
        nume: 'Buletinul',
        prefix,
        cfg,
        cid,
        principal,
        veziCa: ctx.veziCa,
        urlCont: nav.cont,
        urlTermeni: `${nav.home || ''}/termeni`,
        carcasa: (p) => paginaCarcasa(ctx, p),
        /*
         * Două rubrici, în ordinea asta:
         *  - „Chat AI" — îndrumările și uneltele BULETINULUI (user, 18.09.2026). Bucata vine din
         *    modul, la fel pentru toate aplicațiile;
         *  - „Chestionarul buletinului nou" — cele opt întrebări ale bulei, care sunt numai ale
         *    buletinului. ⚠️ Nu se dublează una pe alta: prima spune CE ȘTIE bula, a doua CE ÎNTREABĂ.
         */
        rubrici: async ({ csrf }) => {
          const chat = await CHAT.rubricaSetari(env, ctxChat, { csrf })
          if (!ctx.eAdmin) return chat
          const scrise = env.CONFIG
            ? await env.CONFIG.get(CHEIE_CHESTIONAR, 'json').catch(() => null)
            : null
          return chat + rubricaChestionar({
            prefix,
            csrf,
            intrebari: intrebarile(normalizeazaChestionar(scrise)),
            standard: INTREBARI_STANDARD,
            randuri: RANDURILE_CHESTIONARULUI,
            salvat: url.searchParams.get('chestionar') === 'salvat',
          })
        },
      })
      if (raspunsSetari) return raspunsSetari

      // ------------------------------------------------------- numarul curent
      if (cale === '/') {
        const [b] = await Promise.all([ultimul(env.DB), listaAnilor()])
        const dinainte = b ? (await ultimele(env.DB, 7)).filter((x) => !(x.nr === b.nr && x.data === b.data)) : []
        // prima pagina E numarul curent: bulina ramane apasata, iar scrisul spune chiar numarul lui
        const m = await cuAni({ peEcran: b, acum: !!b, gol: !b })
        return html(paginaAcasa(ctx, m, b, dinainte), 200, cachePagina)
      }

      /*
       * BULETIN NOU — ecranul numarului care urmeaza, tinta sagetii din pastila (user, 17.09.2026).
       *
       * ⚠️ NUMAI ADMINII, si poarta e ROLUL, nu o cheie noua de permisiune: una noua ar fi cerut si
       * republicarea lui `xc-authz` (aceeasi socoteala ca la `/nou` din newsletter). Cand ecranul va
       * compune chiar un numar, aici se pune cheia potrivita — atunci rolul nu mai e destul.
       * ⚠️ Pagina e personala (se vede altfel dupa rol si sub masca „vezi ca"), deci NU se tine in
       * cache-ul de muchie, oricat ar fi mediul.
       */
      /*
       * COMPUNEREA CERUTĂ DE PAGINĂ (user, 19.09.2026: „ar fi și un buton manual în pagină / acum nu
       * merg să-i zici să-l compună … tot aștept și nu răspunde").
       *
       * Drumul scurt al butonului „Compune numărul": aceeași funcție pe care o cheamă și acțiunea
       * `buletin.compune` din chat (`compuneNumarul`), dar fără model, fără propunere cu Da/Nu și
       * fără bugetul de timp al chatului. De aceea nu e un al doilea adevăr despre același număr: e
       * același, cerut pe o ușă mai scurtă.
       *
       * ⚠️ POARTA E CEA DE LA `/nou`: adminul BULETINULUI. Nu o cheie nouă de permisiune — una nouă ar
       * fi cerut și republicarea lui `xc-authz` (aceeași socoteală ca la `/nou`).
       * ⚠️ Originea o cerne paza de mai sus (`verificaCsrf`, la orice POST), deci aici nu se mai cere
       * încă un jeton: cererea vine din pagina noastră ori nu vine deloc.
       * ⚠️ Răspunsul e JSON, nu o pagină: butonul îl citește și, la izbândă, reîncarcă singur ecranul.
       */
      if (cale === '/nou/compune') {
        const fara = { 'cache-control': 'private, no-store' }
        // ⚠️ POARTA ÎNTÂI, metoda pe urmă: cine n-are voie nu află de la noi nici măcar ce metode
        // primește ușa asta. Aceeași rânduială ca la restul aplicației.
        if (!ctx.eAdmin) {
          return json({ facut: false, plangeri: ['Buletinul nou e al administratorilor.'] }, 403, fara)
        }
        if (req.method !== 'POST') return json({ facut: false, plangeri: ['doar POST'] }, 405, fara)
        try {
          const r = await compuneNumarul(env, {}, ctxExec)
          ctxExec.waitUntil(
            scrieAudit(env, {
              action: 'buletin.compune', target: `${r.nr}-${r.data}`,
              outcome: r.facut ? 'success' : 'failure',
              correlationId: cid, actorId: principal?.userId,
              // ⚠️ Motivul refuzului merge în audit, nu doar spre buton: altfel „n-a compus" de azi
              // nu se mai poate citi mâine.
              summary: rezumatAuditCompunere(r),
            }),
          )
          // ⚠️ Vorba refuzului o scrie ACELAȘI loc ca pentru bulă (`vorbaRefuzului`): butonul și chatul
          // n-au voie să spună altfel despre același număr nefăcut.
          return json(r.facut ? r : { ...r, spune: vorbaRefuzului(r) }, 200, fara)
        } catch (e) {
          const mesaj = e instanceof Error ? e.message : String(e)
          log.error('compunerea din pagina n-a iesit', { eroare: mesaj })
          // Eșecul tehnic n-are `nr`/`data` (compunerea a căzut înainte să le spună): ținta rămâne
          // numărul care urma să se facă, iar mesajul erorii intră tăiat în rezumat.
          ctxExec.waitUntil(
            scrieAudit(env, {
              action: 'buletin.compune', target: 'necunoscut',
              outcome: 'failure',
              correlationId: cid, actorId: principal?.userId,
              summary: rezumatAuditEroare(mesaj),
            }),
          )
          return json({ facut: false, plangeri: ['compunerea n-a mers până la capăt; încearcă din nou'] }, 500, fara)
        }
      }

      if (cale === '/nou') {
        const alLui = { 'cache-control': 'private, no-store' }
        if (!ctx.eAdmin) {
          return html(
            paginaMesaj(ctx, await cuAni(), 'Nu ai voie', '<p>Buletinul nou e al administratorilor.</p>'),
            403,
            alLui,
          )
        }
        const b = await ultimul(env.DB)
        const azi = new Date().toISOString().slice(0, 10)
        const m = await cuAni({ nou: true, gol: !b })
        const nou = buletinulNou(b, azi)
        /*
         * Socoteala se face cu calendarul săptămânii tipărite: el hotărăște cât loc rămâne pe
         * pagina a patra. ⚠️ Din 17.09.2026, seara, programul NEVALIDAT nu mai oprește nimic: se ia
         * ce e disponibil (propunerea), iar pagina scrie PROPUS la început (`stare`). Doar dacă
         * programul nu răspunde deloc pagina o spune și socotește fără el.
         * Motto-ul numărului trecut se aduce odată cu calendarul: câmpul vine precompletat cu el.
         */
        const [cal, motto] = await Promise.all([calendarulNumarului(env, nou.data), mottoDinainte(env, b)])
        const calendar = 'eroare' in cal ? null : { titlu: cal.titlu, slujbe: cal.slujbe, stare: cal.stare }
        const masuraCalendarului = 'eroare' in cal ? undefined : { slujbe: cal.slujbe, detalii: cal.detalii }

        /** Măsura fiecărui articol, cum o socotește serverul — ecranul nu mai are ce număra singur. */
        const masuraSchitei = (s: Awaited<ReturnType<typeof citesteSchita>>) =>
          s
            ? socoteste({ ...catreCerere(s), calendar: masuraCalendarului }).zone.map((z) => ({
                cine: z.cine, semne: z.semne, scrise: z.scrise, ramase: z.ramase,
              }))
            : undefined

        /*
         * DOAR BLOCUL SCHIȚEI, ca fragment (18.09.2026, 22:20). Îl cere pagina singură, după ce bula
         * a chemat o unealtă care atinge schița — așa ecranul se împrospătează fără reîncărcare, în
         * timp ce omul scrie mai departe în chat.
         *
         * ⚠️ Aceeași funcție ca în pagină (`schitaPeEcran`), nu una scrisă a doua oară: două feluri de
         * a desena aceeași schiță ar fi însemnat două adevăruri despre același număr.
         * ⚠️ Poarta e cea de sus (adminul buletinului) — fragmentul nu e o ușă nouă, e aceeași ușă.
         */
        if (req.method !== 'POST' && url.searchParams.get('bucata') === 'schita') {
          const s = await citesteSchita(env, nou)
          return new Response(schitaPeEcran(s, masuraSchitei(s)), {
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
          })
        }

        if (req.method !== 'POST') {
          /*
           * BULA DE CHAT — NUMAI AICI (user, 18.09.2026). Din 18.09.2026, seara, ea e SINGURUL drum
           * prin care se completează numărul: formularul a ieșit, iar omul scrie „buletin nou" și
           * răspunde la întrebări. Poarta e a modulului: stins din Module, ori om fără drept, ori
           * fără creier legat — `bula` întoarce `undefined` și ecranul rămâne doar de citit.
           */
          ctx.chat = await CHAT.bula(env, ctxChat)
          /*
           * ⚠️ STAREA ECRANULUI STĂ ÎN DEPOZIT, nu în pagină (18.09.2026): FOAIA compusă (dacă s-a
           * compus una) și SCHIȚA — răspunsurile din chat. Așa ce s-a scris din bulă se vede la
           * prima reîncărcare, iar discuția se poate relua a doua zi, de pe alt telefon.
           */
          /*
           * ⚠️ SCHIȚA SE CREEAZĂ AICI, LA PRIMA INTRARE (user, 19.09.2026: „la prima accesare a /nou
           * să se genereze varianta cu «text» la conținut… toate câmpurile să aibă ceva implicit ca
           * să poți genera varianta 0 de buletin"). `schitaPastrata` o și SCRIE în depozit dacă n-a
           * fost: așa ecranul, butonul „Compune numărul" și bula văd aceeași variantă zero.
           */
          /*
           * ⚠️ ȘI CEREREA PĂSTRATĂ (19.09.2026): în ea stă amprenta PROGRAMULUI cu care s-a tipărit
           * foaia de pe ecran. Din ea se află, fără nicio randare, dacă între timp s-a schimbat
           * programul săptămânii — vezi `programulSaSchimbat`.
           */
          const [foaia, schita, cerereaVeche] = await Promise.all([
            nou.nr ? env.FISIERE.head(cheiaNumarului({ nr: nou.nr, data: nou.data })) : Promise.resolve(null),
            schitaPastrata(env),
            nou.nr ? citesteCererea(env, { nr: nou.nr, data: nou.data }) : Promise.resolve(null),
          ])
          const coperta = foaia ? await env.FISIERE.head(cheiaCopertei({ nr: nou.nr!, data: nou.data })) : null
          // măsura fiecărui articol, socotită aici: ecranul n-o mai socotește singur, fiindcă n-are
          // ce număra — textul nu se mai scrie în pagină
          const masura = masuraSchitei(schita)
          /*
           * VARIANTA ZERO SE COMPUNE SINGURĂ (închide NEXT 00d: „PDF gol la prima intrare pe /nou").
           *
           * ⚠️ NU ÎN CEREREA ASTA, ci îndată după ce s-a încărcat pagina, printr-o a doua cerere
           * (`POST /nou/compune`) pe care o dă butonul singur. Randarea trece prin Browser Rendering
           * și poate ține un minut: făcută aici, ecranul ar fi rămas alb atâta vreme, iar o randare
           * căzută ar fi însemnat un `/nou` care nu se mai deschide deloc. Așa pagina vine îndată,
           * spune „se compune…" și se reîncarcă singură când foaia e gata.
           * ⚠️ NUMAI CÂND SCHIȚA E NEATINSĂ: de îndată ce omul a răspuns ceva, compunerea e a lui
           * (butonul ori chatul). Altfel un text prea lung ar porni, la fiecare reîncărcare, o
           * randare despre care se știe dinainte că va fi refuzată de socoteală.
           */
          const compuneAcum = !foaia && nou.nr !== null && eSchitaNeatinsa(schita)
          /*
           * ⚠️ SEMNUL, NU RECOMPUNEREA (user, 19.09.2026: „nu neapărat să îl regenereze automat de la
           * zero"). Foaia de pe ecran e cea din depozit; dacă programul s-a schimbat după ce s-a
           * tipărit ea, ecranul o SPUNE, lângă butonul „Compune numărul", și atât. Apăsarea rămâne a
           * omului — mai ales că o recompunere poate fi refuzată de socoteală, iar o recompunere
           * pornită singură la fiecare intrare ar face din asta o buclă fără sfârșit.
           */
          const programSchimbat = foaia
            ? programulSaSchimbat(cerereaVeche?.program, 'eroare' in cal ? null : cal)
            : null
          return html(
            paginaNou(ctx, m, nou, {
              calendar,
              motto,
              schita,
              compuneAcum,
              ...(masura ? { masura } : {}),
              ...(programSchimbat ? { programSchimbat } : {}),
              ...(foaia
                ? {
                    raspuns: {
                      facut: true,
                      cheie: foaia.key,
                      cheiePoza: coperta ? coperta.key : null,
                      versiune: amprentaFoii(foaia.httpEtag, cerereaVeche?.program?.amprenta),
                      marime: foaia.size,
                      plangeri: [],
                    },
                  }
                : {}),
            }),
            200,
            alLui,
          )
        }

        const f = await req.formData()
        const scris: Record<string, string> = {}
        for (const [k, v] of f.entries()) if (typeof v === 'string') scris[k] = v

        /*
         * ⚠️ `POST /nou` FACE DE ACUM UN SINGUR LUCRU: validează (18.09.2026, seara). Ramura de
         * compunere din formular a ieșit odată cu formularul — numărul se compune prin
         * `buletin.compune`, chemat de bulă din schiță, și tot acolo e confirmarea cu Da/Nu. Un al
         * doilea drum de compunere ar fi fost al doilea adevăr despre același număr.
         */
        if (scris.fapta !== 'valideaza') return redirect(`${prefix}/nou`)

        /*
         * VALIDAREA = PUBLICAREA (user, 18.09.2026, limpede: „validarea = publicarea"). Până aici
         * numărul compus era doar un PDF în depozit, pe care nu-l vedea nimeni din afara ecranului
         * ăstuia; apăsarea îl scrie în arhivă, și din clipa aceea el e numărul curent al parohiei —
         * pe prima pagină, în arhivă, în căutare și în API-ul celorlalte aplicații.
         *
         * ⚠️ Se validează NUMĂRUL DE PE ECRAN, nu „ultimul compus": nr. și data vin din formular și
         * se cântăresc față de ce ar urma acum (`nou`). Dacă între timp s-a validat altceva (două
         * ferestre deschise), apăsarea NU scrie peste — spune ce s-a schimbat și arată ecranul din nou.
         * ⚠️ Poarta e tot rolul de admin, ca la compunere: o cheie nouă de permisiune ar fi cerut
         * republicarea lui `xc-authz` (aceeași socoteală ca la `/nou`).
         */
        const cerNr = Number(scris.nr ?? '0') || 0
        const cerData = scris.data ?? ''
        const nuMerge = (motiv: string, status: 409) =>
          html(paginaNou(ctx, m, nou, { calendar, motto, raspuns: { facut: false, plangeri: [motiv] } }), status, alLui)

        if (!nou.nr || cerNr !== nou.nr || cerData !== nou.data) {
          return nuMerge(
            `numărul de pe ecran (${cerNr} / ${cerData}) nu mai e cel care urmează (${nou.nr} / ${nou.data}) — ` +
            'între timp s-a validat altceva; recompune-l pe cel de acum',
            409,
          )
        }
        const ciorna = await ciornaDinDepozit(env, nou.nr, nou.data)
        if (!ciorna?.cheie_pdf) {
          return nuMerge('numărul nu e compus — compune-l întâi din chat, apoi validează-l', 409)
        }
        // textul pentru căutare iese din cererea păstrată lângă PDF; dacă lipsește, rândul intră
        // fără text (se caută după el, nu se tipărește din el)
        const cerereaPastrata = await env.FISIERE.get(cheiaCererii({ nr: nou.nr, data: nou.data }))
        const dateleNumarului = cerereaPastrata ? ((await cerereaPastrata.json()) as NumarCerut) : null
        await scrieBuletin(env.DB, {
          nr: nou.nr,
          data: nou.data,
          cheie_pdf: ciorna.cheie_pdf,
          cheie_poza: ciorna.cheie_poza,
          cheie_poza_mica: ciorna.cheie_poza_mica,
          marime_pdf: ciorna.marime_pdf,
          pagini: ciorna.pagini ?? PAGINI,
          text: dateleNumarului ? textCurat(dateleNumarului) : '',
        })
        /*
         * ⚠️ SCHIȚA SE ȘTERGE ABIA AICI, nu la compunere: până la validare omul mai recompune de
         * câteva ori, iar a doua compunere pornește tot din ce a răspuns. După publicare însă ea
         * n-are ce căuta: numărul următor are cheia lui, și trebuie să înceapă de la o foaie albă.
         */
        ctxExec.waitUntil(stergeSchita(env, { nr: nou.nr, data: nou.data }))
        ctxExec.waitUntil(
          scrieAudit(env, {
            action: 'buletin.valideaza', target: `${nou.nr}-${nou.data}`, outcome: 'success',
            correlationId: cid, actorId: principal?.userId,
          }),
        )
        // Numărul are de acum pagina lui: acolo se duce omul, nu înapoi pe ecranul de lucru.
        return redirect(`${prefix}/buletin/${nou.nr}-${nou.data}`)
      }

      // --------------------------------------------------- un numar din arhiva
      if (cale.startsWith('/buletin/')) {
        const cerut = cale.slice(9)
        const m = /^(\d{1,4})-(\d{4}-\d{2}-\d{2})$/.exec(cerut)
        if (m) {
          const b = await unul(env.DB, Number(m[1]), m[2]!)
          if (b) {
            const v = await vecini(env.DB, b.nr, b.data)
            // ⚠️ „esti pe numarul curent" se citeste din VECINI, nu dintr-o a doua cerere catre
            // depozit: numarul care n-are niciun urmator ESTE cel curent.
            const meniul = await cuAni({ peEcran: b, acum: !v.dupa })
            return html(paginaBuletin(ctx, meniul, b), 200, cachePagina)
          }
        }
        // numarul singur (`/buletin/615`) e o adresa la indemana, dar nu e cheie: duce la numarul
        // acela — cel mai nou, daca parohia l-a filat de doua ori
        if (/^\d{1,4}$/.test(cerut)) {
          const r = await celMaiNouCuNumarul(env.DB, Number(cerut))
          if (r) return redirect(`${prefix}/buletin/${r.nr}-${r.data}`, 302)
        }
        return html(
          paginaMesaj(
            ctx,
            await cuAni(),
            'Nu există numărul',
            `<p>Adresa unui buletin e <code>/buletin/615-2026-09-06</code> — numărul și ziua în care a apărut.</p>
<p><a href="${prefix}/arhiva">Arhiva</a> le are pe toate.</p>`,
          ),
          404,
          cachePagina,
        )
      }

      // ------------------------------------------------------ arhiva, pe ani
      if (cale === '/arhiva') {
        const lista = await listaAnilor()
        const cerut = url.searchParams.get('an')
        // un an cerut care nu exista cade pe cel mai NOU, nu pe cel mai vechi
        const ales = lista.find((a) => a.an === cerut)?.an ?? lista[0]?.an ?? ''
        const [buletine, n] = await Promise.all([
          ales ? dintrUnAn(env.DB, ales) : Promise.resolve([]),
          numaratoare(env.DB),
        ])
        const m = await cuAni({ arhiva: true, anDeschis: ales })
        return html(paginaArhiva(ctx, m, ales, buletine, n.buletine), 200, cachePagina)
      }

      // ---------------------------------------------------------- cautarea
      if (cale === '/cauta') {
        const q = url.searchParams.get('q') ?? ''
        const gasite = q.trim() ? await cauta(env.DB, q) : []
        // un numar scris singur, care da fix un buletin: nu are rost o listă de unul — se deschide
        if (gasite.length === 1 && /^\d{1,4}$/.test(q.trim()) && gasite[0]!.nr === Number(q.trim())) {
          return redirect(`${prefix}/buletin/${gasite[0]!.nr}-${gasite[0]!.data}`, 302)
        }
        return html(paginaCautare(ctx, await cuAni({ q }), q, gasite), 200, cachePagina)
      }

      return html(
        paginaMesaj(
          ctx,
          await cuAni(),
          'Nu există pagina',
          `<p><a href="${prefix}/">Numărul curent</a> · <a href="${prefix}/arhiva">Arhiva</a> · <a href="${prefix}/cauta">Căutare</a></p>`,
        ),
        404,
        cachePagina,
      )
    } catch (e) {
      log.error('eroare pagina', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        paginaMesaj(ctx, meniu(), 'Eroare', '<p>A apărut o eroare neașteptată. Încearcă din nou.</p>'),
        500,
      )
    }
  },
}
