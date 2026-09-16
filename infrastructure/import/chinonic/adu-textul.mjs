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
/*
 * ⚠️ FORMATAREA E SCRISĂ O SINGURĂ DATĂ, în `formatare.mjs` — aceeași și pentru fragmentul scos din
 * buletin, și pentru textul adus de aici. Altfel fișa ar arăta în două feluri, după noroc.
 */
import { blocDinMarkdown, ent, faraSentinele, imbraca, inlineDinMarkdown, textulGol } from './formatare.mjs'

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
  /*
   * ⚠️ UN TITLU CARE E DOAR O LEGĂTURĂ e titlul ALTUI articol, nu al unei bucăți din acesta. Așa își
   * scriu site-urile „articolele recomandate" de sub text: `#### [Titlu](adresa)`. Nu se poate
   * deosebi după lungime — sunt titluri adevărate, doar că ale altor texte.
   */
  /^\s*#{1,6}\s*[*_\\]*\s*\[/,
  /*
   * ⚠️ UN RÂND CARE E NUMAI O LEGĂTURĂ e navigare, niciodată proză: `[Oastea Domnului](…/category/…)`,
   * `[imunify-bot-check](…)`. Se recunoaște după STRUCTURĂ, nu după cuvinte — de aceea prinde și ce
   * n-am văzut încă. Un rând de text care se întâmplă să aibă o legătură în el nu intră aici: aceasta
   * trebuie să fie singură pe rând, de la un cap la altul.
   */
  /^\s*[*_\\]*\s*\[[^\]]*\]\([^)]*\)\s*[*_\\]*\s*$/,
]

/**
 * ⚠️ MURDĂRIA CARE SE VEDE ABIA DUPĂ CURĂȚARE. Rândurile de mai sus se recunosc în markdown-ul brut;
 * astea se recunosc numai în textul curat, fiindcă în brut sunt îmbrăcate — „**Share**",
 * „[imunify-bot-check](/imunify-bot-check)". Toate sunt rânduri SCURTE, care pe vremea pragului de 60
 * de semne cădeau de la sine; de când rândurile scurte se păstrează (ca să nu se piardă replicile și
 * versurile), trebuie numite pe nume.
 */
const LUNILE = 'ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie'
const GUNOI_CURAT = [
  new RegExp('^(share|distribuie|tip[aă]re[sș]te|print|imprim[aă]|e-?mail|facebook|twitter|whatsapp'
    + '|telegram|pinterest|linkedin|instagram|abonare|abonea?z[aă]-te|reclam[aă]|publicitate'
    + '|advertisement|meniu|acas[aă]|c[aă]utare|search|autentificare|meta|comentarii)$', 'i'),
  /^\d{1,4}$/,                                     // un rând care e numai o cifră: numărătoare de pagini
  new RegExp(`^\\d{1,2} (${LUNILE}) \\d{4}$`, 'i'), // data unui articol recomandat, scrisă singură
  /*
   * ⚠️ UN NUME TEHNIC SINGUR PE RÂND nu e text: „imunify-bot-check" (paza de roboți a gazdei) ajungea
   * ultimul paragraf al fișei. Se recunoaște după formă — o singură bucată cu cratime, fără spații și
   * fără diacritice —, deci „Doamne-ajută" ori „nord-est" nu intră aici.
   */
  /^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i,
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
  /^\s*(navigare|naviga[tț]ie|articol(ul)? (anterior|precedent|urm[aă]tor)|postare (anterioar[aă]|urm[aă]toare))\b/i,
  // capul listei de recomandari, oricum ar fi ingrosat: „**Legaturi:**", „Va mai recomandam:"
  // ⚠️ marcajele de îngroșare pot fi și trei („_**Legături:**_"), nu doar două — măsurat pe acvila30.ro
  /^\s*[*_]{0,3}\s*(leg[aă]turi|v[aă] mai recomand[aă]m|cite[sș]te (si|și|despre)\b|vezi (si|și)\b)/i,
]
/**
 * ⚠️ SUBSOLUL SITE-ULUI, recunoscut ORIUNDE ÎN RÂND, nu doar la începutul lui (16.09.2026): platformele
 * de blog își scriu subsolul pe un singur rând, lipit de altceva — „Arhiepiscopia Iașilor | ©
 * doxologia.ro", „Creează un site ca acesta, cu WordPress.com". Anticul tipar ancorat la început nu le
 * prindea, și intrau în text ca ultim paragraf al articolului.
 *
 * ⚠️ Se caută în textul CURAT, nu în rândul brut de markdown: acolo nu mai sunt adrese. Altfel, la cele
 * opt articole găzduite chiar pe `…wordpress.com`, orice legătură dinăuntrul articolului ar fi tăiat
 * textul la mijloc.
 */
const OPRESTE_ORIUNDE = [
  /cre[ea]z[ăa] (un )?(site|blog)\b/i,
  /\bwordpress\.com\b/i,
  /toate drepturile rezervate/i,
  /\bpowered by\b/i,
  /©\s*\d{4}|\|\s*©/,
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
function eLizibil(t) {
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
/**
 * CURATAREA UNUI RAND — o singura functie, folosita si la ce se STOCHEAZA, si la ce se COMPARA
 * (`inlineDinMarkdown` din `formatare.mjs`: scoate legaturile, adresele si marcajele, pastrand
 * scrisul si cele patru feluri de formatare). Aici se cere varianta GOALA, fara marcaje: ce se
 * compara trebuie sa fie chiar ce se pastreaza, altfel fereastra de potrivire cade in gol.
 * ⚠️ Lecția din 16.09.2026, 02:30: fereastra de 45 de semne se căuta în rândurile BRUTE de markdown,
 * unde rămâneau etichete și adrese întregi, iar în textul stocat ele nu mai erau — 35 din 60 de
 * pagini „nesigure" aveau fragmentul CHIAR în textul stocat.
 */
const curat = (linie) => faraSentinele(inlineDinMarkdown(linie))

/**
 * CRITERIUL DE REZERVA (16.09.2026, 02:30): cand fragmentul din buletin nu e de folos — la vreo 25 de
 * texte buletinul avea doar poza, linkul si NUMELE AUTORULUI, deci „fragmentul" e un nume de om —
 * se cauta TITLUL in ADRESA sursei: `…/ce-este-pacatul-in-intelesul-crestin-al-cuvantului` poarta
 * chiar titlul. Cand cel putin trei cinci din cuvintele lungi ale titlului stau in cale, pagina e a
 * articolului. E o proba cinstita: adresa a fost pusa de site odata cu articolul, nu ghicita de noi.
 */
function adresaPoartaTitlul(u, titlu) {
  const cuvinte = [...new Set(plat(ent(titlu ?? '')).split(' ').filter((w) => w.length >= 4))]
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
  // ⚠️ etichetele se taie ÎNTÂI, apoi se decodează: fragmentul din bază e HTML-ul NOSTRU, iar în el
  // un „<" din text stă scris `&lt;` — decodat mai devreme, ar deveni etichetă și s-ar pierde
  const brut = ent((fragment ?? '').replace(/<[^>]+>/g, ' '))
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
  /*
   * ⚠️⚠️ FRUNTEA DE METADATE SE TAIE ÎNAINTE DE CĂUTARE (16.09.2026). Unealta de conversie scrie în
   * capul markdown-ului un bloc între două rânduri de „---", cu `title:`, `description:` și `image:`,
   * iar `description:` e CHIAR ÎNCEPUTUL articolului — adică tocmai semnul după care căutăm unde
   * începe textul. Potrivirea cădea acolo, la rândul 2, deci „începutul" nimerea deasupra paginii, iar
   * în text urcau sigla site-ului, firimiturile, titlul lui și rândul „de Editor · 1 februarie 2025".
   * Cât timp rândurile scurte se aruncau după lungime nu se vedea; de când se păstrează, se vede.
   */
  md = md.replace(/^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, '')
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
  const platLinii = toate.map((l) => plat(curat(l)))
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
  const bune = []
  /*
   * ⚠️⚠️ HOTARELE DE SFÂRȘIT SE DESCHID DUPĂ PRIMUL RÂND DE PROZĂ, nu după primul rând strâns
   * (îndreptat 16.09.2026, odată cu păstrarea rândurilor scurte). Unele site-uri scriu „Distribuie"
   * ori „Comentarii (0)" DEASUPRA articolului. Cât timp rândurile scurte se aruncau după lungime,
   * până la textul adevărat nu se strângea nimic, deci hotarul nu se deschidea și butoanele de sus nu
   * tăiau nimic. De când rândurile scurte se păstrează, un singur cuvânt de meniu deschidea hotarul,
   * iar „Distribuie" de sub el reteza articolul înainte să înceapă: fișa `examenul-credintei` a ieșit
   * cu 49 de semne în loc de 10.000. Semnul că articolul a început rămâne PROZA, nu orice rând.
   */
  let proza = false
  for (const linie of randuri) {
    const gol = curat(linie)
    if (proza && (OPRESTE.some((re) => re.test(linie)) || OPRESTE_ORIUNDE.some((re) => re.test(gol)))) break
    if (GUNOI.some((re) => re.test(linie)) || GUNOI_CURAT.some((re) => re.test(gol))) continue
    // o lista de etichete e semnul ca articolul s-a terminat: de aici in jos e podoaba site-ului
    if (proza && eListaDeEtichete(gol)) break
    // ⚠️ mentiunea sursei se cauta INAINTE de orice prag de lungime: „(din: Doxologia)" are 16 semne,
    // iar sub pragul de proza ar fi fost sarita — si atunci recomandarile de sub ea ar fi intrat in text
    if (proza && ULTIMUL.test(gol)) {
      // ⚠️ se PĂSTREAZĂ (hotărârea userului, 16.09.2026, întrebat anume: „păstrează") — e cinstirea
      // sursei, scrisă de cel care a publicat textul. Abia sub ea încep recomandările site-ului.
      bune.push({ fel: 'p', text: gol, sursa: true })
      break
    }
    // un rand care era aproape numai legaturi nu e proza
    const capLegaturi = (linie.match(/\]\(/g) ?? []).length
    if (capLegaturi >= 3 && gol.length < 200) continue
    const b = blocDinMarkdown(linie)
    if (!b) continue
    bune.push(b)
    if (gol.length >= PROZA) proza = true
  }
  const alese = coadaCurata(capulCurat(bune, gasit))
  alese.potrivit = gasit
  return alese
}

/** Cât are un rând de proză, la măsura site-urilor: sub atât poate fi și un buton de meniu. */
const PROZA = 60

/**
 * ⚠️⚠️ RÂNDURILE SCURTE SE PĂSTREAZĂ (user, 16.09.2026: text „raw cu formatare minimă"). Până azi
 * `paragrafe()` arunca ORICE rând sub 60 de semne — așa se pierdeau replicile unui dialog, versurile,
 * subtitlurile și rândurile de listă, adică tocmai ce dă forma unui text. Pragul era însă singura
 * apărare împotriva meniurilor site-ului, care sunt și ele rânduri scurte.
 *
 * Apărarea se mută de la LUNGIME la LOC: murdăria unui site stă la MARGINI — firimituri și butoane
 * deasupra articolului, „distribuie" și etichete dedesubt —, nu în mijlocul lui. Deci:
 *   - la CAP, când începutul e dovedit de fragmentul din buletin, nu se taie nimic (începe chiar
 *     acolo); când nu e dovedit, se coboară până la primul rând de proză, ca înainte;
 *   - la COADĂ se taie rândurile scurte care nu încheie o propoziție — un buton, nu un gând.
 * Înăuntru rămâne tot.
 */
function capulCurat(blocuri, potrivit) {
  if (potrivit) return blocuri
  const de = blocuri.findIndex((b) => faraSentinele(b.text).length >= PROZA)
  return de < 0 ? [] : blocuri.slice(de)
}

/**
 * ⚠️⚠️ UN SUBTITLU LA CAPĂTUL TEXTULUI NU E SUBTITLU (măsurat 16.09.2026, pe fișa cea mai lungă:
 * 71.000 de semne, din care sute de rânduri erau BARA LATERALĂ a site-ului). Site-urile mai vechi își
 * scriu rafturile de cărți ca titluri de secțiune, fiecare urmat de o copertă: `### Noul Theotokarion`
 * și o poză. Pozele pleacă singure (o legătură pe o poză nu lasă nimic în urmă), dar titlurile
 * rămâneau — rânduri lungi, deci pragul de proză nu le atingea, și îngroșate, deci arătau ca
 * subtitluri adevărate. Semnul care le dă de gol: **sub ele nu scrie nimic.** Un titlu fără text sub
 * el nu e titlu.
 *
 * ⚠️⚠️ ȘI NIMIC MAI MULT. Prima scriere tăia de la capăt orice rând scurt care nu încheia o propoziție —
 * și mânca tocmai sfârșitul dialogurilor („— Ce faci, băiete? îl întreabă curios"), adică exact ce s-a
 * cerut să fie păstrat. Măsurat: 155 din 344 de texte nu se sfârșeau curat, iar o parte din ele erau
 * ciuntite de regula asta, nu de site. Ce e murdărie se taie pe NUME (vezi `OPRESTE` și
 * `OPRESTE_ORIUNDE`), nu după formă: mai bine un rând de prisos decât o replică pierdută.
 */
/**
 * ⚠️⚠️ TREI SUBTITLURI UNUL SUB ALTUL SUNT UN RAFT, NU O STRUCTURĂ (măsurat 16.09.2026 pe acvila30.ro:
 * o bară laterală de TREIZECI de titluri de cărți, fiecare cu coperta ei, se scria în coada fișei —
 * „Cartea «Ne vorbeşte Părintele Augustin…» vol. XV", XVI, XVII…). Un subtitlu adevărat are text sub
 * el, deci nu stă niciodată lipit de alte două. De la primul asemenea raft în jos nu mai e articolul.
 */
const RAFT = 3

function coadaCurata(blocuri) {
  const b = blocuri.slice()
  for (let i = 0; i + RAFT <= b.length; i++) {
    if (b.slice(i, i + RAFT).every((x) => x.fel === 'sub')) return b.slice(0, i)
  }
  // …și, oricum, un subtitlu la capăt nu e subtitlu: un titlu fără text sub el e podoaba site-ului
  while (b.length && b[b.length - 1].fel === 'sub') b.pop()
  return b
}

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
  const text = imbraca(par)
  const gol = textulGol(par)
  const semne = gol.length
  // ⚠️ Sub 400 de semne nu e un articol: e un PDF scanat (fara text) ori o pagina care n-a dat nimic.
  // Se scrie „fara-text", nu „gata": altfel fisa ar arata un text intreg care nu e intreg.
  if (semne < 400) return { stare: 'fara-text', text: '', de_ce: `numai ${semne} semne` }
  // ⚠️ proba de lizibilitate e NUMAI pentru PDF: scanarile proaste vin doar de acolo, iar pe pagini
  // web ea dadea fals „ilizibil" la textele cu multe date si citate (masurat 16.09.2026, 03:10)
  if (ePdf && !eLizibil(gol)) return { stare: 'fara-text', text: '', de_ce: `${semne} semne, dar ILIZIBIL (scanare proastă)` }
  // ⚠️ PROBA USERULUI: textul adus trebuie sa inceapa ca fragmentul din buletin. Daca nu se
  // potriveste, se pastreaza — dar ca „nesigur", iar pagina arata tot fragmentul.
  if (!par.potrivit) {
    if (adresaPoartaTitlul(u, rand.titlu)) return { stare: 'gata', text, de_ce: `${semne} semne, ${par.length} paragrafe (adresa poartă titlul)` }
    /*
     * ⚠️⚠️ VIEȚILE DE SFINȚI SE VALIDEAZĂ (user, 16.09.2026: „viețile de sfinți — să le validezi").
     * O viață de sfânt e aceeași povestire în orice sinaxar, dar REPOVESTITĂ: buletinul o scurtează,
     * un site o scrie cu alte cuvinte decât altul. Proba „textul adus începe ca fragmentul" cade
     * atunci pe nedrept — nu fiindcă textul ar fi altul, ci fiindcă e altă punere în cuvinte a
     * aceleiași vieți. La un cuvânt sau la o predică proba rămâne: acolo textul CHIAR e al cuiva.
     */
    if (rand.autor === 'Sinaxar') return { stare: 'gata', text, de_ce: `${semne} semne (sinaxar — validat, vezi regula)` }
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
  // `autor` vine odată cu rândul fiindcă de el atârnă proba: la „Sinaxar" textul adus se validează
  `SELECT slug, titlu, autor, fragment, sursa_url, sursa_fel FROM texte_chinonic
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

/*
 * ⚠️ MARTORII — plasa de dinaintea unei rescrieri mari (`--refa` peste toată arhiva). Aduce cât i se
 * cere, ARATĂ ce ar scrie și nu scrie nimic: așa se vede pe câteva fișe dacă o regulă nouă de curățare
 * a câștigat ori a stricat, fără să se atingă baza. `--martori=20` doar socoteala, `--doar=<slug>`
 * scrie în terminal chiar textul întreg, gata de citit cu ochiul.
 */
const MARTORI = Number(process.argv.find((a) => a.startsWith('--martori='))?.slice(10)) || 0
if (!CHIAR) {
  const deProbat = MARTORI ? deFacut.slice(0, MARTORI) : DOAR ? deFacut : []
  if (!deProbat.length) {
    console.log('\nprimele cinci:')
    for (const r of deFacut.slice(0, 5)) console.log(`  [${r.sursa_fel}] ${r.titlu.slice(0, 48)} → ${r.sursa_url.slice(0, 80)}`)
    console.log('\n(fara --chiar) — nu s-a adus si nu s-a scris nimic.')
    process.exit(0)
  }
  const socoteala = {}
  for (const rand of deProbat) {
    let rez
    try {
      rez = await adu(rand)
    } catch (e) {
      rez = { stare: 'eroare', text: '', de_ce: String(e.message).slice(0, 80) }
    }
    socoteala[rez.stare] = (socoteala[rez.stare] ?? 0) + 1
    const semn = rez.stare === 'gata' ? '✓' : rez.stare === 'nesigur' ? '?' : rez.stare === 'fara-text' ? '·' : '✗'
    console.log(`${semn} [${rand.sursa_fel}] ${(rand.titlu || rand.slug).slice(0, 46).padEnd(46)} ${rez.de_ce}`)
    if (DOAR) console.log(`\n${rez.text}\n`)
  }
  console.log(`\nsocoteala martorilor: ${JSON.stringify(socoteala)}`)
  console.log('(fara --chiar) — nu s-a scris nimic in baza.')
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
