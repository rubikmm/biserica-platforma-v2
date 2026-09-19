/**
 * Home-ul platformei: usa de intrare, la radacina domeniului. Listeaza aplicatiile, ca omul sa
 * poata intra in ele. Nu cere cont si nu tine date proprii.
 *
 * Afisarea e cea de la `website.sfantul-ilie.ro` din V1 (cerere user, 10.09.2026), cu doua
 * schimbari cerute tot atunci: fara textul de jos si **toate butoanele la fel** — nimic sters,
 * nimic punctat.
 */
import { SESIUNE_ANONIMA } from '@xc/contracts'
import { principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { ruteazaSetari, STIL_SETARI } from '@xc/setari'
import { adresaPaginii, citesteConfig, navigatieDin, type Navigatie } from '@xc/config'
import { correlationId, Logger } from '@xc/observability'
import { dataVersiunii, esc, html, json, pagina } from '@xc/ui'
import pkg from '../package.json'
import {
  CALE as CALE_CHINONIC,
  CALE_BULETIN,
  CALE_STARE as CALE_CHINONIC_STARE,
  CALE_STARE_BULETIN,
  STIL_CHINONIC,
  bucataDeAcasa,
  caleaLui,
  felulCaii,
  numereleDupaSlug,
  paginaBuletin,
  paginaStare,
  paginaText,
  paginaToate,
  rezumate,
  unul as unText,
} from './chinonic.js'

export interface Env {
  IDENTITATE: Fetcher
  /** Baza Website-ului, noua la 16.09.2026: „Texte citite la chinonic". Pana atunci `home` n-avea
   *  niciun depozit. */
  DB: D1Database
  /** Venite pe 15.09.2026, odata cu pagina de Setari: cheile, abonarile si jurnalul. */
  AUTORIZARE: Fetcher
  /** ⚠️ Newsletterul, din 16.09.2026: de la el se cere „ce text s-a citit la ce numar" — asocierea e
   *  a lui, nu a noastra. Pagina de stare merge si fara el, doar fara numere. */
  NEWSLETTER?: Fetcher
  COMUNICARE: Fetcher
  AUDIT: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

/**
 * Aplicatiile platformei. Se adauga aici pe masura ce se poarta — dar NUMAI dupa ce adresa
 * lor raspunde: un buton care n-ar duce nicaieri n-are cum sa se deosebeasca de unul bun.
 *
 * ⚠️ TOATE BUTOANELE ARATA LA FEL (user, 10.09.2026, intarit pe 18.09.2026: „scoate bordurile si
 * pentru admini — nu mai sunt relevante"). Semnele de stare — chenar verde/rosu, tinute o zi doar
 * pentru admini — au fost scoase cu totul: butoanele se deosebesc numai prin nume.
 */
const APLICATII: Array<{ cheie: keyof Navigatie; nume: string }> = [
  { cheie: 'calendar', nume: 'Calendarul' },
  { cheie: 'program', nume: 'Programul liturgic' },
  // Tipicul a luat locul transmisiunii in direct (user, 17.09.2026); directul a coborat in locul lui.
  { cheie: 'tipic', nume: 'Tipicul' },
  // Emisia parohiei, doua butoane fiindca sunt doua aplicatii (user, 14.09.2026): radioul si
  // directul slujbei. Radioul a ramas langa program, de unde vin slujbele care se transmit.
  { cheie: 'radio', nume: 'Radioul parohiei' },
  { cheie: 'curatenie', nume: 'Curățenia bisericii' },
  { cheie: 'live', nume: 'Transmisiunea în direct' },
  { cheie: 'biblia', nume: 'Biblia' },
  { cheie: 'biblioteca', nume: 'Biblioteca' },
  { cheie: 'buletin', nume: 'Buletinul parohial' },
  { cheie: 'newsletter', nume: 'Newsletter' },
  { cheie: 'cont', nume: 'Contul' },
  { cheie: 'admin', nume: 'Admin' },
]

/** Stilul butoanelor e cel de la website (V1), fara starile stinse. */
const LOCAL_APP = `
.apps { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
        gap:10px; margin:22px 0 8px }
.apps a { display:block; text-align:center; padding:12px 10px;
          border:1px solid var(--rule); border-radius:10px; color:var(--ink);
          text-decoration:none; font:15px/1.2 ui-sans-serif,system-ui }
.apps a:hover { border-color:var(--rosu); color:var(--rosu) }
.apps b { display:block; font-weight:400 }
.apps .adr { display:block; margin-top:4px; font:11.5px/1.2 ui-sans-serif,system-ui;
             color:var(--faint); letter-spacing:.01em }
.apps a:hover .adr { color:var(--rosu) }
/* Pagina de termeni: un text lung, de citit — coloana ingusta, randuri rare. */
.text-lung { max-width:44em }
.text-lung h2 { font-size:19px; font-weight:400; margin:26px 0 8px }
.text-lung p, .text-lung li { line-height:1.6; color:var(--soft) }
.text-lung ul { padding-left:20px }
.text-lung .cand { color:var(--faint); font-size:.9rem }
`

/**
 * Stilul aplicatiei plus bucatile paginii de Setari, care traiesc in `@xc/setari` (15.09.2026).
 *
 * ⚠️ FUNCTIE, nu constanta. Scrisa ca `const LOCAL = LOCAL_APP + STIL_SETARI`, workerul cadea la
 * PORNIRE cu „STIL_SETARI is not defined": la impachetare, corpul modulului de intrare se
 * evalueaza inaintea pachetului, deci legatura importata inca nu exista. `tsc` trece curat peste
 * asta — s-a vazut abia in `wrangler dev`. Chemata la cerere, legatura e gata de mult.
 */
const LOCAL = () => LOCAL_APP + STIL_SETARI + STIL_CHINONIC

/**
 * TERMENII ȘI CONDIȚIILE — una singură, a PLATFORMEI, nu a fiecărei aplicații (hotărât cu userul,
 * 15.09.2026). La ea trimite bifa „Sunt de acord cu termenii și condițiile" din fereastra de abonare
 * a tuturor aplicațiilor (`@xc/abonare`), în filă nouă. Aici stă fiindcă textul vorbește despre CONT,
 * adresă de e-mail și date — adică despre platformă —, iar aceeași fereastră e la patru aplicații.
 *
 * ⚠️ Cuprinsul e cel cerut de user (15.09.2026): „informații generale despre stocarea datelor, că nu
 * facem reclamă, nu vindem informații și că se pot șterge la cerere". Atât — fără clauze împrumutate
 * de pe alte site-uri, care ar promite lucruri pe care parohia nu le face.
 *
 * ⚠️ NU e un text juridic verificat de un avocat, și nu se poartă ca și cum ar fi. Dacă parohia
 * ajunge să aibă nevoie de unul, acesta e punctul de plecare, nu forma finală.
 */
const TERMENI = `<div class="cap">
  <h1>Termeni și condiții</h1>
  <p class="cand">Ultima schimbare: 15 septembrie 2026.</p>
</div>
<div class="text-lung">
<p>Platforma aceasta este a Parohiei „Sfântul Ilie – Hanul Colței" și ține locul unei foi de la
ușa bisericii: calendarul, programul slujbelor, buletinul parohial și celelalte. O puteți citi
fără cont și fără să ne spuneți cine sunteți.</p>

<h2>Ce date ținem</h2>
<p>Cont vă faceți doar dacă vreți ceva ce cere unul — de pildă să primiți pe e-mail calendarul sau
programul. Atunci ținem:</p>
<ul>
  <li><b>adresa de e-mail</b>, ca să vă putem trimite ce ați cerut și ca să vă putem recunoaște la
  intrare;</li>
  <li><b>numele</b>, dacă ni-l spuneți, ca să știm cum să vă scriem;</li>
  <li><b>la ce sunteți abonat</b> și de când;</li>
  <li>o urmă tehnică scurtă a intrărilor (data, adresa IP), ca să ne putem apăra de abuzuri.</li>
</ul>
<p>Nu cerem parolă și nu ținem niciuna: la intrare vă trimitem pe e-mail un cod de șase cifre,
bun zece minute.</p>

<h2>La ce le folosim</h2>
<p>Numai ca să vă trimitem ce ați cerut și ca să meargă contul. <b>Nu facem reclamă</b> — nici a
noastră, nici a altcuiva. <b>Nu vindem și nu dăm mai departe datele nimănui</b>, nici pe bani, nici
pe gratis. Nu le folosim ca să vă urmărim prin alte părți ale internetului.</p>

<h2>Cine le mai vede</h2>
<p>Scrisorile pleacă prin furnizorul tehnic care ne ține site-ul și poșta. El le trimite în numele
nostru și nu are voie să le folosească în alt scop.</p>

<h2>Cât le ținem și cum le ștergeți</h2>
<p>Le ținem atât timp cât aveți cont. <b>Vă puteți dezabona oricând</b>, dintr-un singur gest, din
aplicația la care sunteți abonat. <b>Și puteți cere oricând să vă ștergem cu totul datele</b> —
scrieți-ne și le ștergem, fără să vă cerem o pricină.</p>

<h2>Ce mai puteți cere</h2>
<p>Să vedeți ce date avem despre dumneavoastră, să le îndreptăm dacă sunt greșite, sau să le
ștergem. Toate, la o simplă cerere.</p>

<h2>Cum ne scrieți</h2>
<p>Pe adresa parohiei, ori răspunzând la orice scrisoare primită de la noi.</p>

<h2>Dacă se schimbă ceva</h2>
<p>Dacă schimbăm ceva aici, scriem data de mai sus. Nu schimbăm în tăcere la ce folosim datele.</p>
</div>`

function buton(nume: string, url: string): string {
  const adresa = url.replace(/^https:\/\/|\/$/g, '') || 'aici'
  return `    <a href="${esc(url)}${url.startsWith('/') ? '/' : ''}"><b>${esc(nume)}</b><span class="adr">${esc(adresa)}</span></a>`
}

/**
 * Butoanele aplicatiilor. Usa e ACEEASI pentru toata lumea — butoanele, numele si adresele nu se
 * schimba dupa cine intra (user, 18.09.2026, dupa scoaterea semnelor de stare).
 *
 * ⚠️ Exportata ca s-o poata proba `tests/usa-website.test.ts` fara sa ridice tot workerul.
 */
export function corp(nav: Navigatie): string {
  return `<nav class="apps" aria-label="Aplicațiile platformei">
${APLICATII.map((a) => buton(a.nume, nav[a.cheie] || '/')).join('\n')}
  </nav>`
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-home', correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)

    if (url.pathname === '/health') {
      return json({ ok: true, app: 'home', mediu: env.MEDIU, versiune: pkg.version, publicat: env.VERSIUNE?.timestamp ?? null, ora: new Date().toISOString() }, 200, { 'cache-control': 'no-store' })
    }

    /*
     * ADRESELE VECHI ALE EMISIEI. `transmisiuni.` si `audio.` sunt tiparite prin parohie si stiute
     * de oameni, dar aplicatia lor V1 s-a stins la cutover. Le tinem in viata aici, ca redirectari,
     * ca sa nu mai fie nevoie de un worker doar pentru atat: un hostname tine de un singur worker,
     * iar astea doua stau acum pe `home`. Ce era `/radio` pleaca la radio, restul la direct.
     */
    const gazdaVeche = url.hostname.split('.')[0]
    if (gazdaVeche === 'transmisiuni' || gazdaVeche === 'audio') {
      const spreRadio = gazdaVeche === 'transmisiuni' && url.pathname.startsWith('/radio')
      const tinta = spreRadio ? nav.radio : nav.live
      return Response.redirect(`${tinta}${spreRadio ? url.pathname.slice('/radio'.length) : ''}${url.search}`, 301)
    }

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const utilizator = sesiune.user?.displayName ?? sesiune.user?.email ?? null
    /*
     * `eAdminPlatforma` — din el iese DOAR randul „Administrare" din meniul contului, si e NUMAI al
     * super-adminului (user, 19.09.2026: „un admin nu vede altceva decat Setari"). Masca doar
     * coboara, deci sub orice masca randul dispare.
     * ⚠️ Usa nu mai intreaba autorizarea de nimic (18.09.2026): cheia Website-ului (`website.manage`)
     * se cerea numai pentru chenarele de stare, iar ele s-au scos cu totul.
     */
    const eAdminPlatforma = sesiune.roles.some((r) => r.role === 'super-admin')
    const comune = {
      // Titlul din antet: WEBSITE, nu PLATFORMA (user, 17.09.2026) — `home` E website-ul parohiei.
      nume: 'WEBSITE',
      titlu: 'Platforma parohiei',
      acasa: '/',
      urlPlatforma: nav.home || '/',
      local: LOCAL(),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      cont: {
        intrat: !!utilizator,
        nume: utilizator ?? 'Cont',
        // ⚠️ Randul „Administrare" e al PLATFORMEI: rolul global, nu adminul Website-ului.
        admin: eAdminPlatforma,
        urlCont: nav.cont,
        urlAdmin: nav.admin,
        // Setarile APLICATIEI (user, 15.09.2026). Home-ul n-are abonare si n-are echipa, deci aici
        // omul gaseste preferinta lui de e-mail, iar super-adminul jurnalul `home.`.
        urlSetari: '/setari',
        poateVedeaCa: sesiune.poateVedeaCa,
        veziCa: sesiune.veziCa,
        spre: adresaPaginii(cfg, url),
      },
    }

    // SETARILE — un singur loc, `@xc/setari` (user, 15.09.2026).
    if (url.pathname === '/setari' || url.pathname.startsWith('/setari/')) {
      if (req.method === 'POST') {
        const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
        if (problema) {
          return html(pagina({ ...comune, titluPagina: 'Verificare de securitate', corp: `<h2>Verificare de securitate</h2><p>${problema}</p>` }), 403)
        }
      }
      const raspunsSetari = await ruteazaSetari(req, url.pathname, env, {
        cod: 'home',
        nume: 'Platforma',
        prefix: '',
        cfg,
        cid,
        principal: principalDin(sesiune),
        veziCa: sesiune.veziCa,
        urlCont: nav.cont,
        urlTermeni: `${nav.home || ''}/termeni`,
        carcasa: (p) => pagina({ ...comune, titluPagina: p.titluPagina, corp: p.corp, ...(p.scripturi ? { scripturi: p.scripturi } : {}) }),
      })
      if (raspunsSetari) return raspunsSetari
    }

    // Termenii platformei — una singură, la ea trimit ferestrele de abonare ale tuturor aplicațiilor.
    if (url.pathname === '/termeni') {
      return html(
        pagina({ ...comune, titluPagina: 'Termeni și condiții', indexabil: true, corp: TERMENI }),
        200,
        // ⚠️ aceeași grijă ca la ușa platformei: pagina poartă numele omului în antet, deci sub
        // cont (ori sub masca „vezi ca") nu se dă la cache-ul browserului
        { 'cache-control': utilizator || sesiune.veziCa ? 'private, no-store' : 'public, max-age=3600' },
      )
    }

    /*
     * TEXTE CITITE LA CHINONIC (16.09.2026) — secțiunea cerută de user. Adresele sunt PERMANENTE:
     * slugul e adresa fișei și nu se schimbă cât timp rândul e același text.
     *   /texte-citite-la-chinonic          cele bune, pe ani
     *   /texte-citite-la-chinonic/stare    ce e de lămurit, pe feluri de lipsă
     *   /texte-citite-la-chinonic/<slug>   un text
     * …și la fel, cu aceleași trei, `/texte-din-buletin`.
     */
    /*
     * ⚠️ PAGINA DE PROBLEME — locul de lucru, cerut de user (16.09.2026): categoriile cu probleme,
     * fiecare rând scurt, cu numărul de buletin din care vine. ⚠️ Se încearcă ÎNAINTEA fișei, altfel
     * „stare" ar fi căutat ca slug. Nu se indexează: e unealtă, nu pagină de citit.
     * ⚠️ FIECARE GRĂMADĂ ARE PROBLEMELE EI, la adresa ei: de când lista arată numai ce e bun, restul
     * trebuie să aibă unde fi văzut — și la chinonic, și la textele din buletinul parohiei.
     */
    const caleaStarii = [CALE_CHINONIC_STARE, CALE_STARE_BULETIN]
      .find((c) => url.pathname === c || url.pathname === `${c}/`)
    if (caleaStarii) {
      const fel = felulCaii(caleaStarii.replace(/\/stare$/, ''))
      const [rez, numere] = await Promise.all([rezumate(env.DB, fel), numereleDupaSlug(env.NEWSLETTER)])
      // ⚠️ Filtrele sunt o NAVIGARE, nu o ascundere din JS: categoria (`?ce=`) și anul (`?an=`) vin
      // din adresă, iar serverul trimite numai rândurile alese (user, 16.09.2026).
      return html(
        pagina({ ...comune, titluPagina: 'Ce e de lămurit',
          corp: paginaStare(rez, numere, nav.newsletter || '',
            url.searchParams.get('ce'), url.searchParams.get('an'), fel) }),
        200,
        { 'cache-control': 'private, no-store' },
      )
    }
    if (url.pathname === CALE_CHINONIC || url.pathname === `${CALE_CHINONIC}/`) {
      const rez = await rezumate(env.DB)
      return html(
        pagina({ ...comune, titluPagina: 'Texte citite la chinonic', indexabil: true,
          corp: paginaToate(rez, url.searchParams.get('an')) }),
        200,
        { 'cache-control': utilizator || sesiune.veziCa ? 'private, no-store' : 'public, max-age=600' },
      )
    }
    /*
     * ⚠️ TEXTELE DIN BULETINUL PAROHIEI, a doua secțiune (user, 16.09.2026): ce s-a scos din
     * fișierele PDF ale parohiei nu mai stă în lista chinonicului, ci aici. Nu se indexează: e
     * grămada de materiale de unde începe adunarea pentru website, nu o pagină de citit.
     */
    if (url.pathname === CALE_BULETIN || url.pathname === `${CALE_BULETIN}/`) {
      const rez = await rezumate(env.DB, 'buletin')
      return html(
        pagina({ ...comune, titluPagina: 'Texte din buletinul parohiei',
          corp: paginaBuletin(rez, url.searchParams.get('an')) }),
        200,
        { 'cache-control': utilizator || sesiune.veziCa ? 'private, no-store' : 'public, max-age=600' },
      )
    }
    /* Fișa unui text — aceeași, în oricare din cele două secțiuni ar sta textul. */
    const sectiunea = [CALE_CHINONIC, CALE_BULETIN].find((c) => url.pathname.startsWith(`${c}/`))
    if (sectiunea) {
      const slug = decodeURIComponent(url.pathname.slice(sectiunea.length + 1).replace(/\/$/, ''))
      const t = slug ? await unText(env.DB, slug) : null
      if (!t) {
        return html(
          pagina({ ...comune, titluPagina: 'Textul nu există', corp: `<h2>Textul nu există</h2>
<nav class="vecini"><a href="${CALE_CHINONIC}">← Toate textele citite la chinonic</a></nav>` }),
          404,
        )
      }
      /*
       * ⚠️ O FIȘĂ ARE O SINGURĂ CASĂ, iar vechea adresă duce la ea. Textele mutate în secțiunea
       * buletinului își păstrează slugul (el e adresa, nu se schimbă), deci legăturile date mai
       * demult — în Slack, în vreun buletin — se mută o dată, permanent (301), în loc să moară.
       */
      if (caleaLui(t) !== sectiunea) {
        return Response.redirect(`${url.origin}${caleaLui(t)}/${encodeURIComponent(t.slug)}${url.search}`, 301)
      }
      // ⚠️ se indexează numai fișele chinonicului; materialele din buletinul parohiei nu se dau la
      // căutare cât timp sunt grămada de lucru a userului
      return html(
        pagina({ ...comune, titluPagina: t.titlu || 'Text citit la chinonic',
          indexabil: sectiunea === CALE_CHINONIC, corp: paginaText(t, nav.newsletter || '') }),
        200,
        { 'cache-control': utilizator || sesiune.veziCa ? 'private, no-store' : 'public, max-age=600' },
      )
    }

    if (url.pathname !== '/' && url.pathname !== '') {
      return html(pagina({ ...comune, titluPagina: 'Pagina nu există', corp: `<h2>Pagina nu există</h2>${corp(nav)}` }), 404)
    }

    log.info('home')
    // Usa platformei purta `public, max-age=300` chiar si cand era cineva intrat sau sub masca
    // „vezi ca": browserul servea pagina veche (cu banda) si dupa ce masca fusese scoasa, deci
    // butonul „Revino la super admin" parea ca nu face nimic (user, 11.09.2026).
    const cachePagina = utilizator || sesiune.veziCa ? 'private, no-store' : 'public, max-age=300'
    /*
     * ⚠️ CELE DOUĂ CATEGORII, sub butoanele aplicațiilor: zece rânduri fiecare, doar titlul și
     * autorul, plus „Vezi toate" (user, 16.09.2026: „sub lista de aplicații să afișezi cele două
     * categorii articole-chinonic și articole-buletin doar titlul și autorul cu link — 10 elemente +
     * vezi toate"). Dacă baza tace, ușa rămâne exact cum era.
     * ⚠️ Se cer REZUMATELE, nu textele: judecata „e bun" are nevoie de lungimi și de starea adresei,
     * iar ea e aceeași pe toate cele trei pagini — nu se scrie a doua dată în SQL.
     */
    const [aleChinonicului, aleBuletinului] = await Promise.all([
      rezumate(env.DB).catch(() => []),
      rezumate(env.DB, 'buletin').catch(() => []),
    ])
    return html(
      pagina({ ...comune, corp: corp(nav) + bucataDeAcasa(aleChinonicului, aleBuletinului) }),
      200,
      { 'cache-control': cachePagina },
    )
  },
}
