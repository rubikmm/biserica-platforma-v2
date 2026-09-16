/**
 * Aduce TEXTUL ÎNTREG al fiecărui text citit la chinonic, de la sursa lui, și-l scrie în baza
 * Website-ului (user, 16.09.2026: „se va încerca preluarea textelor complete — urmărirea linkurilor";
 * „aș vrea să transformăm fișierele PDF tot în articole scrise. Nu vreau să avem link către PDF").
 *
 *   node infrastructure/import/chinonic/adu-textul.mjs                arata ce ar face
 *   node infrastructure/import/chinonic/adu-textul.mjs --chiar        scrie in baza
 *   node infrastructure/import/chinonic/adu-textul.mjs --chiar --limita=40
 *   node infrastructure/import/chinonic/adu-textul.mjs --reia         si cele cazute la o rulare veche
 *
 * ⚠️ RELUABIL: se iau numai rândurile cu `stare_text = 'netras'` (ori, cu `--reia`, și „eroare").
 * Se poate opri oricând; a doua rulare continuă de unde a rămas.
 *
 * ⚠️⚠️ NU SE INSEREAZĂ HTML STRĂIN ÎN PAGINILE NOASTRE. Tot ce vine de pe alt site se trece prin
 * TEXT CURAT și se reîmbracă de noi în paragrafe. Așa nu poate intra niciun `<script>`, nicio urmă
 * de numărătoare și niciun stil care să strice pagina — oricât de prost ar fi site-ul sursă. E
 * singurul fel cinstit de a pune pe pagina parohiei ceva scris altundeva.
 *
 * Cum se scoate textul, în amândouă cazurile: unealta de conversie a Cloudflare (`ai/tomarkdown`),
 * care primește și PDF, și HTML. Peste ea vine curățarea de mai jos, fiindcă unealta aduce și
 * meniurile paginii („Skip to main content", butoane de distribuit, articole recomandate).
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
const CHIAR = process.argv.includes('--chiar')
const RELUA = process.argv.includes('--reia')
const LIMITA = Number(process.argv.find((a) => a.startsWith('--limita='))?.slice(9)) || 0
const BAZA = 'b970592e-85cd-4e07-b5dc-6abe9761098a' // xc-home-production

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

/*
 * ⚠️ REINCERCAREA PRINDE SI CADERILE DE RETEA, nu doar raspunsurile rele (indreptat 16.09.2026, dupa
 * ce o rulare peste toata arhiva a murit la 119 din 438 cu „fetch failed / other side closed").
 * `fetch` nu intoarce un raspuns cand se rupe firul: ARUNCA — iar bucla de mai jos, care se uita doar
 * la `r.ok`, nu apuca sa se mai invarta. O rulare de douazeci de minute nu are voie sa cada de la o
 * pana de o secunda.
 */
async function sql(comanda, params = []) {
  let pricina
  for (let i = 1; i <= 5; i++) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${BAZA}/query`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        body: JSON.stringify({ sql: comanda, params }),
        signal: AbortSignal.timeout(60000),
      })
      const j = await r.json()
      if (r.ok && j.success) return j.result
      pricina = `D1: ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 200)}`
    } catch (e) {
      pricina = `D1: ${String(e?.message ?? e).slice(0, 200)}`
    }
    if (i === 5) throw new Error(pricina)
    await new Promise((s) => setTimeout(s, 1000 * i))
  }
}

/** Unealta de conversie a Cloudflare: din PDF sau HTML face markdown. */
async function markdown(octeti, tip, nume) {
  const fd = new FormData()
  fd.append('files', new Blob([octeti], { type: tip }), nume)
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/ai/tomarkdown`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}` },
    body: fd,
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok) throw new Error(`tomarkdown ${r.status}`)
  const j = await r.json()
  return j.result?.[0]?.data ?? ''
}

/** Randuri care nu sunt text, ci podoaba paginii: se arunca oriunde ar fi. */
const GUNOI = [
  /^\s*$/, /^-{3,}$/, /^\\?\*\\?\*\\?\*\s*$/, /^<!DOCTYPE/i, /^!\[/, /^\[\s*\]\(/, /^\[Skip to/i,
  /^(description|title|image|author|date|lang|canonical|og:|twitter:)\s*:/i,
  /^\|/, /^\s*<[a-z!/]/i,
  /*
   * ⚠️ RANDUL DE LISTA CARE E O LEGATURA e „articol recomandat", nu text (user, 16.09.2026: „ce e sub
   * trebuie șters"). Tiparul vechi `^\*\s*\[` prindea numai `* [titlu](adresa)`; in WordPress
   * recomandarile sunt INGROSATE, deci randul incepe `* **[` ori `* [**` ori `* _[` — si asa treceau
   * toate: sunt randuri lungi, de proza nu se deosebesc prin lungime. La un singur articol urcau 18
   * randuri deasupra textului si coborau 24 sub el.
   */
  /^\s*[*+-]\s*[*_\\]*\s*\[/,
]
/** De aici in jos nu mai e articolul, ci subsolul site-ului. */
/*
 * ⚠️ Completate pe 16.09.2026, 02:55, dupa proba de calitate (user: „terminarea lui trebuie să fie
 * înainte să înceapă alt articol sau altă secțiune"): ramaneau in coada „Pentru a adauga un
 * comentariu…", listele de etichete si firimiturile. O LISTA DE ETICHETE se recunoaste dupa forma,
 * nu dupa cuvinte: multe virgule si bucati scurte, fara punct la sfarsit.
 */
const OPRESTE = [
  /^#{1,3}\s*(comentarii|articole (recomandate|similare|asem[aă]n[aă]toare)|cite[sș]te [sș]i|mai multe|recomand[aă]ri|etichete|tags?)\b/i,
  /^\s*(vizualiz[aă]ri|distribuie|share|abonea?z[aă]-te|urm[aă]re[sș]te-ne|etichete\s*:|tags?\s*:|categorii\s*:)/i,
  /^\s*pentru a (ad[aă]uga|posta|scrie) un comentariu/i,
  /^\s*(las[aă] un (comentariu|r[aă]spuns)|adaug[aă] (un )?comentariu|comentarii\s*\(?\d*\)?\s*$)/i,
  /^\s*(articole? (din aceea[sș]i categorie|recomandate?|similare?)|v[aă] mai recomand[aă]m|te-ar putea interesa)/i,
  /^\s*copyright\b/i, /^\s*©/,
  // capul listei de recomandari, oricum ar fi ingrosat: „**Legaturi:**", „Va mai recomandam:"
  /^\s*[*_]{0,2}\s*(leg[aă]turi|v[aă] mai recomand[aă]m|cite[sș]te (si|și) |vezi (si|și)\b)/i,
]
/**
 * ⚠️ RANDUL DE SFARSIT: mentiunea sursei, cu care se incheie chiar textul (user, 16.09.2026: „Aici
 * trebuia să se oprească: din: Preot Varnava Iankos, Biserica pacatosilor, Editura Egumenita, 2016.
 * Ce e sub trebuie șters"). Spre deosebire de `OPRESTE`, randul acesta SE PASTREAZA — el e cinstirea
 * sursei — si abia dupa el se taie.
 */
const ULTIMUL = /^\s*\(?\s*(din|surs[aă]|preluat din|text(ul)? preluat din)\s*:/i
/** O lista de etichete: cel putin 6 bucati despartite prin virgula, in medie scurte, fara punct. */
const eListaDeEtichete = (t) => {
  const bucati = t.split(',').map((x) => x.trim()).filter(Boolean)
  if (bucati.length < 6) return false
  const medie = bucati.reduce((s, x) => s + x.length, 0) / bucati.length
  return medie <= 22 && !/[.!?]\s*$/.test(t)
}

/**
 * ⚠️ PROBA DE LIZIBILITATE (16.09.2026, 02:55): un PDF scanat prost trece prin OCR si iese
 * „cotesc di nu au tinut vrajba… n~ se rii re so-..". Semnele: multe bucati care nu sunt cuvinte
 * (amestec de litere, cifre si semne) si multe semne straine de scris. Sub prag, textul nu e text —
 * se scrie „fara-text", nu „gata", oricat de bine ar fi purtat numele fisierului titlul.
 */
function eLizibil(par) {
  const t = par.join(' ')
  if (t.length < 400) return false
  const bucati = t.split(/\s+/).filter(Boolean)
  // cuvinte: litere, ori numere (ani, versete, pagini) — cu semnele de punctuatie din jur
  const cuvinte = bucati.filter((b) => /^[(„“«"']*(?:[\p{L}][\p{L}'’\-]*|\d+[.,:\-\d]*)[.,;:!?)»”"']*$/u.test(b)).length
  const straine = (t.match(/[~|^#*_\\<>{}=+]/g) ?? []).length
  return cuvinte / bucati.length >= 0.8 && straine / t.length < 0.004
}

/**
 * Din markdown → paragrafe de text curat. Se pastreaza randurile care sunt PROZA, nu navigare:
 * peste 60 de semne si fara sa fie in cea mai mare parte legaturi.
 *
 * ⚠️ Pragul de 60 taie si niste randuri scurte adevarate (o intrebare, un vers). E pretul platit ca
 * sa nu intre meniurile; masurat, alternativa (prag mic) aducea zeci de randuri de navigare in
 * fiecare articol. Ce se pierde e putin si se vede, ce s-ar castiga ar fi murdarie peste tot.
 */
const plat = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * ⚠️ TITLUL E CEL MAI BUN REPER DE UNDE INCEPE ARTICOLUL. Site-urile isi pun deasupra articolului
 * firimituri („Acasă / Articole preluate / …"), titluri de alte articole si indemnuri — randuri
 * destul de lungi ca sa treaca de pragul de proza, deci nu se pot taia dupa lungime (vazut: trei
 * randuri de meniu urcate in capul unui text). Dar titlul il STIM din arhiva: cautam randul care-l
 * cuprinde si incepem DUPA el. Daca nu-l gasim, ramane cum era — mai bine cu cateva randuri in plus
 * decat cu articolul taiat din greseala.
 */
function deUndeIncepe(randuri, titlu) {
  const t = plat(titlu ?? '').slice(0, 40)
  if (t.length < 15) return 0
  for (let i = 0; i < Math.min(randuri.length, 120); i++) {
    if (plat(randuri[i]).includes(t)) return i + 1
  }
  return 0
}

/**
 * ⚠️⚠️ CRITERIUL DE VERIFICARE, dat de user (16.09.2026): „să înceapă la fel cum începe textul de
 * preview din newsletter, iar terminarea lui trebuie să fie înainte să înceapă alt articol sau altă
 * secțiune. De multe ori, se termină chiar cu sursa."
 *
 * E mult mai bun decât reperul pe titlu, fiindcă fragmentul din buletin e CHIAR începutul textului
 * citit: dacă textul adus nu începe așa, ori am nimerit altă pagină, ori am luat meniul site-ului.
 * De aceea potrivirea nu e doar reper de tăiere, ci și PROBĂ: când nu se găsește, rândul rămâne
 * `nesigur` și pagina arată mai departe fragmentul — nu pretindem un text întreg pe care nu-l avem.
 */
/**
 * Semnele după care se caută începutul: câteva bucăți din fragment, nu una singură.
 *
 * ⚠️ Fragmentul din buletin nu e literă cu literă textul de pe site — parohia mai taie un rând de
 * început, mai pune o introducere, iar semnele de punctuație diferă. De aceea se încearcă începutul
 * fragmentului ȘI începuturile primelor propoziții: e destul ca UNA să se potrivească.
 */
/*
 * ⚠️ ENTITĂȚILE SE DECODEAZĂ ÎNAINTE DE NORMALIZARE. Fragmentul păstrat în bază e HTML de email, cu
 * `&icirc;` și `&acirc;` în el; normalizat de-a dreptul, „s-a născut în 1821" ajungea
 * „s a nascut icirc n 1821" — litere lipite în mijlocul cuvintelor, deci nicio potrivire cu textul
 * de pe site. Din 9 încercări se potrivea UNA, și aceea din întâmplare.
 */
/*
 * ⚠️ DUBLA CODARE (masurat 16.09.2026, 02:10): 45 de fragmente vechi au `&amp;atilde;`, `&amp;shy;` —
 * adica entitatea a fost codata de doua ori la trimitere. O singura trecere lasa „&atilde;" in
 * text, iar normalizarea o face „c amp atilde", deci nicio potrivire. Se decodeaza de DOUA ori.
 * `atilde` (ã) e felul in care site-urile vechi scriau ă; `shy` e cratima moale, care nu se vede.
 */
const ENT = {
  acirc: 'â', Acirc: 'Â', icirc: 'î', Icirc: 'Î', abreve: 'ă', Abreve: 'Ă', atilde: 'ă', Atilde: 'Ă',
  scedil: 'ș', Scedil: 'Ș', tcedil: 'ț', Tcedil: 'Ț', amp: '&', nbsp: ' ', shy: '', quot: '"',
  apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', ldquo: '„', rdquo: '”', ndash: '–', mdash: '—',
  hellip: '…', bdquo: '„',
}
const faraOData = (s) => s.replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? ' ')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
const fara = (s) => faraOData(faraOData(s))
/** Marcajele markdown scoase INAINTE de comparatie: intr-o legatura `[cuvant](adresa)` adresa intra
 *  in text si strica fereastra de 45 de semne. (56 din 130 de pagini „nesigure" aveau fragmentul in
 *  text, ascuns tocmai asa.) */
const faraMarcaje = (l) => l.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
/**
 * CURATAREA UNUI RAND — o singura functie, folosita si la ce se STOCHEAZA, si la ce se COMPARA.
 * ⚠️ user, 16.09.2026: „referințele păstrează-le, dar imaginile șterge-le și adresele și tot".
 * Etichetele HTML ramase in markdown (tomarkdown le lasa uneori) ies si ele: altfel „a href https…"
 * intra in text.
 */
const curataLinia = (linie) => faraMarcaje(linie)
  .replace(/<[^>]+>/g, ' ')                       // etichete HTML ramase
  .replace(/[*_`>#]+/g, ' ')
  .replace(/https?:\/\/[^\s)\]»"]+/gi, '')        // adresele scrise in text
  .replace(/\bwww\.[^\s)\]»"]+/gi, '')
  .replace(/\(\s*\)|\[\s*\]/g, '')
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * CRITERIUL DE REZERVA (16.09.2026, 02:30): cand fragmentul din buletin nu e de folos — la vreo 25 de
 * texte buletinul avea doar poza, linkul si NUMELE AUTORULUI, deci „fragmentul" e un nume de om —
 * se cauta TITLUL in ADRESA sursei: `…/ce-este-pacatul-in-intelesul-crestin-al-cuvantului` poarta
 * chiar titlul. Cand cel putin trei cinci din cuvintele lungi ale titlului stau in cale, pagina e a
 * articolului. E o proba cinstita: adresa a fost pusa de site odata cu articolul, nu ghicita de noi.
 */
function adresaPoartaTitlul(u, titlu) {
  const cuvinte = [...new Set(plat(fara(titlu ?? '')).split(' ').filter((w) => w.length >= 4))]
  if (cuvinte.length < 3) return false
  let cale = ''
  try { cale = plat(decodeURIComponent(new URL(u).pathname)) } catch { return false }
  const nimerite = cuvinte.filter((w) => cale.includes(w)).length
  return nimerite / cuvinte.length >= 0.6
}

/*
 * ⚠️ PROPOZITIILE SE TAIE INAINTE DE NORMALIZARE (indreptat 16.09.2026). `plat` scoate toata
 * punctuatia, deci taierea in propozitii facuta DUPA el nu gasea niciun punct: se intorcea mereu un
 * singur semn — inceputul fragmentului — iar rezerva gandita aici („e destul ca UNA sa se
 * potriveasca") n-a lucrat niciodata. Cand buletinul mai punea un rand inaintea textului (numele
 * autorului, o introducere), singurul semn cadea si articolul ramanea „nesigur" ori, mai rau, se lua
 * de la capul paginii, cu tot meniul deasupra.
 */
function semneleInceputului(fragment) {
  const brut = fara(fragment ?? '').replace(/<[^>]+>/g, ' ')
  const t = plat(brut)
  if (t.length < 40) return []
  const semne = [t.slice(0, 45)]
  for (const p of brut.split(/(?<=[.!?])\s+/).slice(0, 5)) {
    const s = plat(p)
    if (s.length >= 45) semne.push(s.slice(0, 45))
  }
  return [...new Set(semne)]
}

function paragrafe(md, titlu, semne) {
  /*
   * ⚠️ BLOCUL DE METADATE AL PDF-ULUI SE TAIE AICI, nu doar in scriptul de proba (uitat la prima
   * scriere — 69 din 70 de PDF-uri ieseau „nesigure" fiindca textul lor incepea cu
   * „xmpmm documentid uuid…"). Unealta il scrie ca `## Metadata` cu randuri `- cheie=valoare`.
   */
  md = md.replace(/^#{1,3}\s*Metadata\b[\s\S]*?(?=\n#{1,3}\s|\n\n(?![-\s])|$)/m, '')
  const toate = md.split(/\r?\n/).filter((l) => !/^\s*-\s*[\w:.]+=\S/.test(l))
  /*
   * ⚠️ CĂUTAREA SE FACE ÎN TEXTUL LIPIT, nu rând cu rând: în markdown un paragraf se poate rupe pe
   * mai multe rânduri, iar atunci nicio linie nu cuprinde semnul întreg. Prima încercare, rând cu
   * rând, a potrivit 1 din 9 — lipite, se potrivesc aproape toate.
   */
  /*
   * ⚠️ SE COMPARA CU ACEEASI CURATARE CARE SE STOCHEAZA (16.09.2026, 02:30): pana acum fereastra de
   * 45 de semne se cauta in randurile brute din markdown, unde raman etichete HTML („a href https…")
   * si adrese intregi — iar in textul stocat ele nu mai sunt. Diagnosticul: 35 din 60 „nesigure"
   * aveau fragmentul CHIAR in textul stocat. Deci ce se cauta = ce se pastreaza.
   */
  const platLinii = toate.map((l) => plat(fara(curataLinia(l))))
  const capete = []
  let lipit = ''
  for (let i = 0; i < platLinii.length; i++) {
    capete.push(lipit.length)
    lipit += (platLinii[i] ? platLinii[i] + ' ' : '')
  }
  let de = -1
  for (const s of semne) {
    const poz = lipit.indexOf(s)
    if (poz < 0) continue
    // rândul în care cade potrivirea
    let i = capete.findIndex((c) => c > poz)
    de = i <= 0 ? 0 : i - 1
    break
  }
  // găsit → chiar de acolo începe textul; negăsit → reperul slab, titlul
  const gasit = de >= 0
  const randuri = toate.slice(gasit ? de : deUndeIncepe(toate, titlu))
  randuri.potrivit = gasit
  const bune = []
  for (let linie of randuri) {
    // ⚠️ hotarele de SFARSIT lucreaza numai dupa ce s-a strans macar un rand de text: unele site-uri
    // scriu „Comentarii (0)" ori „Distribuie" DEASUPRA articolului, si taiau totul (0 semne)
    if (bune.length && OPRESTE.some((re) => re.test(linie))) break
    if (GUNOI.some((re) => re.test(linie))) continue
    // o lista de etichete e semnul ca articolul s-a terminat: de aici in jos e podoaba site-ului
    if (bune.length && eListaDeEtichete(fara(curataLinia(linie)))) break
    // scoate marcajele markdown, pastrand scrisul
    let t = fara(curataLinia(linie))
    // ⚠️ mentiunea sursei se cauta INAINTE de pragul de lungime: „(din: Doxologia)" are 16 semne, iar
    // sub pragul de proza ar fi fost sarita — si atunci recomandarile de sub ea ar fi intrat in text
    if (bune.length && ULTIMUL.test(t)) { bune.push(t); break }
    if (t.length < 60) continue
    // un rand care era aproape numai legaturi nu e proza
    const capLegaturi = (linie.match(/\]\(/g) ?? []).length
    if (capLegaturi >= 3 && t.length < 200) continue
    bune.push(t)
  }
  bune.potrivit = randuri.potrivit === true
  return bune
}

const escapa = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const inHtml = (par) => par.map((p) => `<p>${escapa(p)}</p>`).join('\n')

/**
 * ⚠️ CERTIFICATE STRICATE (masurat 16.09.2026, 02:20): `cuvantul-ortodox.ro` — cea mai mare sursa,
 * 103 articole — are lantul de certificat incomplet, deci `fetch` cade cu „unable to get local issuer
 * certificate". NU se opreste verificarea certificatelor (ar fi pentru toate site-urile); in schimb,
 * la o cadere de TLS se reincearca pe `http://`: textul e public si nu trece niciun secret pe fir.
 */
async function iaPagina(u) {
  const optiuni = {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; arhiva-parohie/1.0; +https://sfantul-ilie.ro)' },
    signal: AbortSignal.timeout(45000),
    redirect: 'follow',
  }
  try {
    return await fetch(u, optiuni)
  } catch (e) {
    const pricina = String(e?.cause?.message ?? e?.cause?.code ?? e?.message ?? '')
    const eTls = /certificate|CERT_|SSL|TLS|issuer/i.test(pricina)
    if (eTls && u.startsWith('https://')) return await fetch(u.replace(/^https:\/\//, 'http://'), optiuni)
    throw e
  }
}

async function adu(rand) {
  const u = rand.sursa_url
  const r = await iaPagina(u)
  if (!r.ok) return { stare: 'eroare', text: '', de_ce: `HTTP ${r.status}` }
  const octeti = Buffer.from(await r.arrayBuffer())
  if (!octeti.length) return { stare: 'eroare', text: '', de_ce: 'fișier gol' }
  const ePdf = rand.sursa_fel === 'pdf' || /application\/pdf/i.test(r.headers.get('content-type') ?? '')
  const md = await markdown(octeti, ePdf ? 'application/pdf' : 'text/html', ePdf ? 'a.pdf' : 'a.html')
  const par = paragrafe(md, rand.titlu, semneleInceputului(rand.fragment))
  const text = inHtml(par)
  const semne = par.join(' ').length
  // ⚠️ Sub 400 de semne nu e un articol: e un PDF scanat (fara text) ori o pagina care n-a dat nimic.
  // Se scrie „fara-text", nu „gata": altfel fisa ar arata un text intreg care nu e intreg.
  if (semne < 400) return { stare: 'fara-text', text: '', de_ce: `numai ${semne} semne` }
  // ⚠️ proba de lizibilitate e NUMAI pentru PDF: scanarile proaste vin doar de acolo, iar pe pagini
  // web ea dadea fals „ilizibil" la textele cu multe date si citate (masurat 16.09.2026, 03:10)
  if (ePdf && !eLizibil(par)) return { stare: 'fara-text', text: '', de_ce: `${semne} semne, dar ILIZIBIL (scanare proastă)` }
  // ⚠️ PROBA USERULUI: textul adus trebuie sa inceapa ca fragmentul din buletin. Daca nu se
  // potriveste, se pastreaza — dar ca „nesigur", iar pagina arata tot fragmentul.
  if (!par.potrivit) {
    if (adresaPoartaTitlul(u, rand.titlu)) return { stare: 'gata', text, de_ce: `${semne} semne, ${par.length} paragrafe (adresa poartă titlul)` }
    return { stare: 'nesigur', text, de_ce: `${semne} semne, DAR nu incepe ca fragmentul` }
  }
  return { stare: 'gata', text, de_ce: `${semne} semne, ${par.length} paragrafe` }
}

// ---------------------------------------------------------------------------

const REFA = process.argv.includes('--refa')
// `--reia` = tot ce nu e verificat („gata"): netrase, erori, nesigure, fara text — dupa o curatare
// mai buna merita reincercate toate; `--refa` le ia si pe cele bune
const unde = REFA ? `('netras','eroare','gata','fara-text','nesigur')` : RELUA ? `('netras','eroare','nesigur','fara-text')` : `('netras')`
const [{ results: randuri }] = await sql(
  `SELECT slug, titlu, fragment, sursa_url, sursa_fel FROM texte_chinonic
   WHERE stare_text IN ${unde} AND sursa_url <> '' ORDER BY citit_la DESC`,
)
// `--doar=<slug>` — o singura fisa, pentru cand se incearca o regula noua de curatare
const DOAR = process.argv.find((a) => a.startsWith('--doar='))?.slice(7)
const alese = DOAR ? randuri.filter((r) => r.slug === DOAR) : randuri
const deFacut = LIMITA ? alese.slice(0, LIMITA) : alese
console.log(`de adus: ${deFacut.length} (din ${randuri.length} netrase)`)
const feluri = {}
for (const r of deFacut) feluri[r.sursa_fel] = (feluri[r.sursa_fel] ?? 0) + 1
console.log('  pe feluri:', JSON.stringify(feluri))

if (!CHIAR) {
  console.log('\nprimele cinci:')
  for (const r of deFacut.slice(0, 5)) console.log(`  [${r.sursa_fel}] ${r.titlu.slice(0, 48)} → ${r.sursa_url.slice(0, 80)}`)
  console.log('\n(fara --chiar) — nu s-a adus si nu s-a scris nimic.')
  process.exit(0)
}

const socoteala = { gata: 0, nesigur: 0, 'fara-text': 0, eroare: 0 }
let n = 0
for (const rand of deFacut) {
  let rez
  try {
    rez = await adu(rand)
  } catch (e) {
    rez = { stare: 'eroare', text: '', de_ce: String(e.message).slice(0, 80) }
  }
  n++
  // ⚠️ nici scrierea nu are voie sa omoare rularea: randul ramane cum era si se prinde la o reluare
  try {
    await sql(
      `UPDATE texte_chinonic SET text_intreg = ?, stare_text = ?, schimbat_la = datetime('now') WHERE slug = ?`,
      [rez.text, rez.stare, rand.slug],
    )
  } catch (e) {
    console.log(`    ⚠️ nescris in baza (${String(e.message).slice(0, 60)}) — ${rand.slug}`)
    continue
  }
  socoteala[rez.stare]++
  const semn = rez.stare === 'gata' ? '✓' : rez.stare === 'nesigur' ? '?' : rez.stare === 'fara-text' ? '·' : '✗'
  console.log(`${String(n).padStart(3)}/${deFacut.length} ${semn} [${rand.sursa_fel}] ${(rand.titlu || rand.slug).slice(0, 46).padEnd(46)} ${rez.de_ce}`)
}
console.log(`\ngata: ${socoteala.gata} cu text · ${socoteala.nesigur} nesigure · ${socoteala['fara-text']} fără text · ${socoteala.eroare} erori`)
