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

async function sql(comanda, params = []) {
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${BAZA}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: comanda, params }),
    })
    const j = await r.json()
    if (r.ok && j.success) return j.result
    if (i === 5) throw new Error(`D1: ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 200)}`)
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
  /^\s*$/, /^-{3,}$/, /^<!DOCTYPE/i, /^!\[/, /^\[\s*\]\(/, /^\[Skip to/i,
  /^(description|title|image|author|date|lang|canonical|og:|twitter:)\s*:/i,
  /^\*\s*\[/, /^\|/, /^\s*<[a-z!/]/i,
]
/** De aici in jos nu mai e articolul, ci subsolul site-ului. */
const OPRESTE = [
  /^#{1,3}\s*(comentarii|articole (recomandate|similare)|cite[sș]te [sș]i|mai multe|recomand[aă]ri)/i,
  /^\s*(vizualiz[aă]ri|distribuie|share|abonea?z[aă]-te|urm[aă]re[sș]te-ne)\b/i,
  /^\s*copyright\b/i, /^\s*©/,
]

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
const ENT = {
  acirc: 'â', Acirc: 'Â', icirc: 'î', Icirc: 'Î', abreve: 'ă', Abreve: 'Ă', scedil: 'ș', Scedil: 'Ș',
  tcedil: 'ț', Tcedil: 'Ț', amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  rsquo: '’', lsquo: '‘', ldquo: '„', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', bdquo: '„',
}
const fara = (s) => s.replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? ' ')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))

function semneleInceputului(fragment) {
  const t = plat(fara(fragment ?? '').replace(/<[^>]+>/g, ' '))
  if (t.length < 40) return []
  const semne = [t.slice(0, 45)]
  const propozitii = t.split(/(?<=[.!?]) /).filter((p) => p.length >= 45)
  for (const p of propozitii.slice(0, 4)) semne.push(p.slice(0, 45))
  return [...new Set(semne)]
}

function paragrafe(md, titlu, semne) {
  const toate = md.split(/\r?\n/)
  /*
   * ⚠️ CĂUTAREA SE FACE ÎN TEXTUL LIPIT, nu rând cu rând: în markdown un paragraf se poate rupe pe
   * mai multe rânduri, iar atunci nicio linie nu cuprinde semnul întreg. Prima încercare, rând cu
   * rând, a potrivit 1 din 9 — lipite, se potrivesc aproape toate.
   */
  const platLinii = toate.map(plat)
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
    if (OPRESTE.some((re) => re.test(linie))) break
    if (GUNOI.some((re) => re.test(linie))) continue
    // scoate marcajele markdown, pastrand scrisul
    let t = linie
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')          // poze
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // legaturi: ramane scrisul
      .replace(/[*_`>#]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
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

async function adu(rand) {
  const u = rand.sursa_url
  const r = await fetch(u, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; arhiva-parohie/1.0; +https://sfantul-ilie.ro)' },
    signal: AbortSignal.timeout(45000),
    redirect: 'follow',
  })
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
  // ⚠️ PROBA USERULUI: textul adus trebuie sa inceapa ca fragmentul din buletin. Daca nu se
  // potriveste, se pastreaza — dar ca „nesigur", iar pagina arata tot fragmentul.
  if (!par.potrivit) return { stare: 'nesigur', text, de_ce: `${semne} semne, DAR nu incepe ca fragmentul` }
  return { stare: 'gata', text, de_ce: `${semne} semne, ${par.length} paragrafe` }
}

// ---------------------------------------------------------------------------

const REFA = process.argv.includes('--refa')
const unde = REFA ? `('netras','eroare','gata','fara-text','nesigur')` : RELUA ? `('netras','eroare')` : `('netras')`
const [{ results: randuri }] = await sql(
  `SELECT slug, titlu, fragment, sursa_url, sursa_fel FROM texte_chinonic
   WHERE stare_text IN ${unde} AND sursa_url <> '' ORDER BY citit_la DESC`,
)
const deFacut = LIMITA ? randuri.slice(0, LIMITA) : randuri
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
  await sql(
    `UPDATE texte_chinonic SET text_intreg = ?, stare_text = ?, schimbat_la = datetime('now') WHERE slug = ?`,
    [rez.text, rez.stare, rand.slug],
  )
  socoteala[rez.stare]++
  n++
  const semn = rez.stare === 'gata' ? '✓' : rez.stare === 'nesigur' ? '?' : rez.stare === 'fara-text' ? '·' : '✗'
  console.log(`${String(n).padStart(3)}/${deFacut.length} ${semn} [${rand.sursa_fel}] ${(rand.titlu || rand.slug).slice(0, 46).padEnd(46)} ${rez.de_ce}`)
}
console.log(`\ngata: ${socoteala.gata} cu text · ${socoteala.nesigur} nesigure · ${socoteala['fara-text']} fără text · ${socoteala.eroare} erori`)
