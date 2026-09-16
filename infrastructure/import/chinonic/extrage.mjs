/**
 * TEXTELE CITITE LA CHINONIC — scoase din arhiva newsletterului (cerere user, 16.09.2026).
 *
 * Un număr de newsletter are trei părți: programul liturgic (din A2), buletinul parohiei (din A3) și
 * TEXTELE CITITE LA CHINONIC — articolele citite la strană în timpul împărtășirii. Primele două vin
 * din aplicațiile lor; al treilea n-a fost salvat nicăieri până azi. De aici se scoate.
 *
 *   node infrastructure/import/chinonic/extrage.mjs                 le scoate si le numara
 *   node infrastructure/import/chinonic/extrage.mjs --scrie         scrie /data/chinonic.json
 *   node infrastructure/import/chinonic/extrage.mjs --vezi=571      arata ce iese dintr-un numar
 *
 * ⚠️ CUM SE RECUNOASTE UN ARTICOL. Nu dupa un titlu de sectiune — asa ceva nu exista in HTML (in
 * preheader scrie „Ce s-a citit la strană", dar preheaderul se scoate la curatare). Semnul sigur e
 * randul de la SFARSITUL fiecarui articol: „Sursă: …". Masurat pe toata arhiva: 458 de astfel de
 * randuri in 319 numere (210 numere cu unul, 85 cu doua, 18 cu trei, 6 cu patru).
 *
 * De aceea se merge INAPOI de la fiecare „Sursă": articolul e ce sta inaintea ei, pana la unul din
 * hotarele de mai jos. Mersul inainte, dintr-o „zona de chinonic", ar fi fost mai simplu — dar zona
 * n-are hotar de sus la vreo suta de numere (poza buletinului lipseste), si atunci programul liturgic
 * ar fi fost inghitit in primul articol.
 *
 * HOTARELE (orice opreste mersul inapoi):
 *   - „Sursă" de dinainte  → articolul precedent;
 *   - poza buletinului (`buletin-nr…`) → mai sus e sectiunea A3;
 *   - titlul „Programul Liturgic" sau un bloc cu semnul „⁞" (ora slujbei) → mai sus e A2;
 *   - poza din subsol (parintele Arsenie) → acolo incepe zona fixa.
 *
 * ⚠️ POZA POATE STA SI INAINTE, SI DUPA TEXT (masurat: in nr. 511 inainte, in nr. 571 dupa), deci se
 * strang toate pozele din articol, nu „prima" sau „ultima".
 */
import { readFileSync, writeFileSync } from 'node:fs'
// regulile de titlu/autor stau singure, ca sa poata fi probate — vezi tests/chinonic-titlu-autor
import { autorulDinCap, autorulScris, desparte } from './titlu-autor.mjs'
// formatarea minima (bold, italic, liste, citate) e scrisa o data, pentru fragment si pentru textul adus
import { blocuriDinHtml, ent, faraSentinele, imbraca, textulGol } from './formatare.mjs'

const SCRIE = process.argv.includes('--scrie')
const VEZI = Number(process.argv.find((a) => a.startsWith('--vezi='))?.slice(7)) || 0
const BLOCURI = process.argv.includes('--blocuri')
const GALEATA = process.argv.find((a) => a.startsWith('--in='))?.slice(5) ?? 'xc-newsletter-production'

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}
const adresa = (cheie) =>
  `https://api.cloudflare.com/client/v4/accounts/${cont}/r2/buckets/${GALEATA}/objects/${cheie
    .split('/').map(encodeURIComponent).join('/')}`

async function ia(cheie) {
  for (let i = 1; i <= 4; i++) {
    const r = await fetch(adresa(cheie), { headers: { authorization: `Bearer ${jeton}` } })
    if (r.ok) return await r.text()
    if (r.status === 404) return null
    await new Promise((s) => setTimeout(s, 800 * i))
  }
  return null
}

const platit = (h) => ent(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/**
 * Blocurile unui numar, in ordinea din pagina: fiecare celula de text sau de poza a MailPoet.
 * ⚠️ Se iau si `mailpoet_paragraph`, nu doar `mailpoet_text`: articolele vechi isi tin paragrafele
 * in celule de felul al doilea, iar fara ele textul ar fi iesit ciuntit.
 *
 * ⚠️⚠️ SI `mailpoet_blockquote` — DE AICI SE PIERDEA CORPUL ARTICOLULUI (masurat 16.09.2026, pe fisa
 * `examenul-credintei`, aratata de user ca „inutilizabila"). Cand redactorul a pus textul citit ca
 * CITAT, el sta intr-un tabel incuibat: celula de afara (`mailpoet_text`) se taie la primul `</td>`,
 * care e al dungii de 2px a citatului, deci iese GOALA si se sare; iar celula de dinauntru n-avea
 * clasa ceruta aici, deci nu era citita de nimeni. Rezultatul: articolul ramanea cu titlul si numele
 * autorului drept tot corpul lui — de unde si cele 33 de fise „fara autor, cu numele drept text" si
 * bucatile de sub 40 de semne, care nu mai aveau cu ce dovedi textul adus de la sursa.
 * User, 16.09.2026: „Toate au text scurt — chiar dacă structural nu pare că e, vizual se vede mereu,
 * 10-12 rânduri de text după autor." Chiar asa era: textul era in pagina, dar nu in citirea noastra.
 */
function blocuri(h) {
  const re = /<td class="(mailpoet_text|mailpoet_image|mailpoet_paragraph|mailpoet_blockquote)[^"]*"[^>]*>([\s\S]*?)<\/td>/g
  const out = []
  let m
  while ((m = re.exec(h))) {
    const fel = m[1] === 'mailpoet_image' ? 'poza' : 'text'
    // ⚠️ citatul se ține minte ca citat: la scrierea textului el se îmbracă în <blockquote>, nu în <p>
    const citat = m[1] === 'mailpoet_blockquote'
    const brut = m[2]
    const text = platit(brut)
    const poze = [...brut.matchAll(/<img[^>]*src="([^"]+)"/g)].map((x) => x[1])
    /* ⚠️ Si adresele RELATIVE, nu doar `http…`: PDF-urile cu textele citite stau la noi, iar in
       arhiva au fost rescrise ca `/media/uploads/…`. Cerandu-se `https?://`, ieseau ZERO PDF-uri
       dintr-o arhiva care are zeci — se vedea in socoteala, nu in cod. */
    const linkuri = [...brut.matchAll(/href="((?:https?:\/\/|\/)[^"#][^"]*)"/g)].map((x) => x[1])
    if (fel === 'poza' && !poze.length) continue
    if (fel === 'text' && !text) continue
    out.push({ fel, citat, brut, text, poze, linkuri })
  }
  return out
}

const eSursa = (b) => /^\s*surs[ăa]\s*:?/i.test(b.text)

/**
 * Randuri care sunt ETICHETE ori ALTE SECTIUNI, nu continut de articol — si care, tocmai de aceea,
 * sunt hotare bune: mersul inapoi se opreste la ele.
 *
 * ⚠️ „S-a citit la strană:" e chiar numele sectiunii, scris in numerele vechi (2017–2020). Pana nu
 * l-am facut hotar, el ajungea TITLU la vreo suta de articole — asa se vedea in socoteala.
 * ⚠️ „Descărcare PDF", „Slujbele se transmit", „2% din impozit" sunt alte bucati ale numarului, care
 * stau uneori intre articole.
 */
const ETICHETE = [
  /^s-a citit la stran[ăa]/i,
  /^desc[ăa]rcare pdf/i,
  /^slujbele se transmit/i,
  /^\d+%\s*din impozit/i,
  /^doamne ajut/i,
  /^v[ăa] mul[țt]umim pentru sprijin/i,
  /^grup (y!|whatsapp)/i,
]
const eEticheta = (b) => b.fel === 'text' && ETICHETE.some((re) => re.test(b.text))

/**
 * Hotar de sus: mai departe de el nu se merge inapoi — acolo incepe alta sectiune a numarului.
 * ⚠️ Poza din subsol se cheama si `Parintele-Arsenie-PapaIOC` in numerele vechi (greseala de tipar in
 * numele fisierului, 2017–2019) — de aceea tiparul se opreste la „Pap", nu la numele intreg. Fara
 * asta, subsolul intra in ultimul articol la toate numerele acelea.
 */
const eHotar = (b) =>
  b.poze.some((u) => /buletin-nr/i.test(u) || /Parintele-Arsenie-Pap/i.test(u)) ||
  /^programul liturgic$/i.test(b.text) ||
  b.text.includes('⁞') ||
  eEticheta(b)

/**
 * TITLUL dintr-o celula. In MailPoet titlul unui articol e scris ingrosat la INCEPUTUL celulei —
 * uneori singur in celula lui, alteori lipit de corp, in aceeasi celula.
 *
 * ⚠️ Editorul rupe ingrosarea in bucati fara noima („<strong>Viața celor</strong><strong> doi
 * episcopi…</strong>"), deci bucatile de la inceput se lipesc la loc. Ce vine dupa primul `<br>` din
 * acel sir ingrosat e de obicei AUTORUL („Până la moarte" / „Sfântul Ioan Gură de Aur").
 */
function titluDin(brut) {
  /*
   * ⚠️ DOUA CAPCANE, platite pe 16.09.2026 (49 de articole fara titlu, cu sluguri „text-571-1"):
   *   - `<h1><strong></strong>Despre ascultare…</h1>`: un `<strong>` GOL in capul titlului — regexul
   *     se oprea la primul `</strong>` si lua drept titlu nimicul dinauntru;
   *   - `<table><tr><td class="mailpoet_paragraph"><strong>Viața…</strong>`: la celulele incuibate,
   *     prima celula prinsa e cea de AFARA, iar continutul ei incepe cu etichete de asezare, nu cu
   *     titlul. Se sar etichetele goale si cele de asezare, apoi se cauta sirul ingrosat.
   */
  const h = brut
    .replace(/<(strong|b|em|i|span)\b[^>]*>\s*<\/\1>/gi, '')          // etichete goale
    .replace(/^(?:\s|<(?:table|tbody|tr|td|div|p)\b[^>]*>)+/i, '')     // asezarea dinaintea titlului
  const re = /^(?:<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>|<(?:strong|b)\b[^>]*>[\s\S]*?<\/(?:strong|b)>|<br\s*\/?>|&nbsp;|\s)+/i
  const m = re.exec(h)
  if (!m || !platit(m[0])) return { titlu: '', autor: '', rest: brut }
  const cap = m[0]
  const rest = h.slice(cap.length)
  // randurile capului: un titlu <h*> e un rand; sirul ingrosat se taie la <br> — acolo se desparte
  // titlul de autor („Până la moarte" / „Sfântul Ioan Gură de Aur")
  const randuri = cap
    .replace(/<\/h[1-6]>/gi, '$&\n')
    .split(/<br\s*\/?>|\n/i)
    .map((x) => platit(x))
    .filter(Boolean)
  if (!randuri.length) return { titlu: '', autor: '', rest: brut }
  if (randuri[0].length < 3 || randuri[0].length > 160) return { titlu: '', autor: '', rest: brut }
  const { titlu, autor } = desparte(randuri)
  return { titlu, autor, rest }
}

/*
 * TEXTUL CURAT din HTML-ul de email (user, 16.09.2026: „nu se afișează bine ca și cum copiezi
 * HTML-ul… să ai texte brute pe care le poți afișa atât pe tema dark, cât și pe tema light").
 * MailPoet scrie culori, fonturi si tabele inline — pe tema intunecata scrisul negru pe fond negru
 * nu se vede. Regula e in `formatare.mjs`, scrisa o data si pentru textul adus de la sursa: se
 * pastreaza CE SCRIE plus patru marcaje (ingrosat, inclinat, liste, citate), restul se taie.
 */

/** Gazda unui link, fara „www." — pentru fisa articolului si pentru socoteala. */
function gazda(u) {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return null }
}

/** Doar literele si cifrele, fara diacritice: forma in care se pot compara doua scrieri ale aceluiasi nume. */
const doarLitere = (s) => ent(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/**
 * ⚠️⚠️ MENTIUNEA CARE E DOAR NUMELE SITE-ULUI NU E O MENTIUNE (masurat 16.09.2026: la 290 din 317
 * `sursa_text` era chiar gazda, deci randul „Sursa" din fisa se scria de doua ori —
 * „oasteadomnului.ro · oasteadomnului.ro ↗"). Se pastreaza numai ce ADAUGA ceva peste legatura:
 * numele cartii, editura, „fisier PDF". Numele gazdei il scrie oricum legatura.
 *
 * Se recunoaste si scrisa frumos („Cuvântul Ortodox" fata de `cuvantul-ortodox.ro`): se compara numai
 * literele si cifrele, cu si fara terminatia adresei.
 */
function eNumeleGazdei(mentiune, url) {
  const g = gazda(url)
  const m = doarLitere(mentiune)
  if (!g || !m) return false
  return m === doarLitere(g) || m === doarLitere(g.replace(/\.[a-z.]+$/i, ''))
}
/**
 * Legaturile de sarit: unelte de lista si retele, niciodata sursa unui text citit la strana.
 * ⚠️ NU se sar adresele parohiei: acolo stau tocmai PDF-urile cu textele citite (user, 16.09.2026:
 * „sursa poate să fie linkul de pe poza articolului și, de multe ori, este un fișier PDF").
 * Masurat: zeci de articole au sursa numai ca `/media/uploads/…/<text>.pdf`.
 */
const deSarit = (u) => /groups\.yahoo\.com|mailpoet\.com|facebook\.com|list-manage|formular230|youtube\.com/i.test(u)
const ePdf = (u) => /\.pdf(\?|#|$)/i.test(u)
/** Adresele scrise scurt in email (`/media/…`) se intregesc, ca sa poata fi aduse. */
const intreaga = (u) => (u.startsWith('/') ? `https://newsletter.sfantul-ilie.ro${u}` : u)

/** Slug scurt si stabil din titlu — adresa fisei de pe Website. */
function slugul(titlu, nr, k) {
  const s = ent(titlu).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '')
  return s ? `${s}${k ? `-${k + 1}` : ''}` : `text-${nr ?? 'x'}-${k + 1}`
}

/**
 * Articolele dintr-un numar. Se merge inapoi de la fiecare „Sursă", pana la hotar.
 * ⚠️ Titlul e PRIMUL bloc de text al articolului, iar restul e corpul — asa arata toate numerele
 * masurate. Cand primul bloc e prea lung ca sa fie titlu (peste 160 de semne), se ia drept corp si
 * articolul ramane fara titlu: mai bine fara decat cu o propozitie rupta drept titlu.
 */
function articoleleDin(h, fisa) {
  const bl = blocuri(h)
  const iSurse = bl.map((b, i) => (eSursa(b) ? i : -1)).filter((i) => i >= 0)
  const out = []
  for (let k = 0; k < iSurse.length; k++) {
    const iS = iSurse[k]
    const opreste = k > 0 ? iSurse[k - 1] : -1
    let i = iS - 1
    const parti = []
    while (i > opreste && i >= 0 && !eHotar(bl[i])) { parti.unshift(bl[i]); i-- }
    if (!parti.length) continue
    const texte = parti.filter((b) => b.fel === 'text')
    const poze = parti.flatMap((b) => b.poze)
    const sursaBloc = bl[iS]
    if (!texte.length) continue
    /*
     * Titlul se cauta in PRIMA celula de text. Doua feluri, amandoua intalnite in arhiva:
     *   - celula e numai titlu (ingrosata toata) → corpul vine din celulele urmatoare;
     *   - titlul e lipit de corp in aceeasi celula → se taie de acolo, iar restul celulei ramane corp.
     */
    const { titlu, autor: autorDinTitlu, rest } = titluDin(texte[0].brut)
    const corpBlocuri = titlu
      ? [...(platit(rest) ? [{ brut: rest, text: platit(rest) }] : []), ...texte.slice(1)]
      : texte
    const corpHtml = corpBlocuri.map((b) => b.brut.trim()).join('\n')
    // fragmentul asa cum se ARATA: blocuri de text curat, cu formatare minima (vezi `formatare.mjs`)
    const blocuri = corpBlocuri.flatMap((b) => blocuriDinHtml(b.brut, b.citat === true))
    /*
     * ⚠️ AUTORUL SE CAUTA IN TEXTUL GOL, nu in blocuri: regulile lui (`titlu-autor.mjs`) sunt despre
     * cuvinte, nu despre formatare, si stau sub probe cu siruri simple. Cate rânduri a luat se vede
     * din cat s-a scurtat sirul — asa blocurile se taie la fel, cu tot cu marcajele lor.
     */
    const plate = blocuri.map((b) => faraSentinele(b.text))
    const { autor, paragrafe: ramase } = autorulDinCap(autorDinTitlu, plate)
    const corpFinal = blocuri.slice(plate.length - ramase.length)
    const corpCurat = imbraca(corpFinal)
    const corpText = textulGol(corpFinal)
    /*
     * ⚠️ ZONA SURSEI TINE DOUA LUCRURI, SI TREBUIE SA COEXISTE (user, 16.09.2026: „sursa poate să fie
     * mențiunea dintr-o carte, dar de obicei este completată și de un link"):
     *   `sursaText` — ce scrie omul („Fișier PDF", numele cărții, numele site-ului);
     *   `sursaUrl`  — legatura, care de multe ori NU e in randul „Sursă", ci pe POZA articolului.
     * De aceea linkurile se strang din TOATE bucatile articolului, poza inclusa, iar cel de pe randul
     * sursei are intaietate: el e spus anume drept sursa.
     */
    const dinSursa = sursaBloc.linkuri.filter((u) => !deSarit(u))
    const dinPoze = parti.filter((b) => b.fel === 'poza').flatMap((b) => b.linkuri).filter((u) => !deSarit(u))
    const dinText = parti.filter((b) => b.fel === 'text').flatMap((b) => b.linkuri).filter((u) => !deSarit(u))
    const linkuri = [...new Set([...dinSursa, ...dinPoze, ...dinText].map(intreaga))]
    const sursaUrl = linkuri[0] ?? ''
    const mentiune = ent(sursaBloc.text).replace(/^\s*surs[ăa]\s*:?\s*/i, '').trim()
    out.push({
      // de unde vine
      newsletterId: fisa.id,
      nr: fisa.nr,
      trimis: fisa.trimis,
      // ⚠️ LOCUL ARTICOLULUI IN NUMAR. Singura identitate a lui care NU atarna de titlu — deci
      // singura pe care se poate sprijini inghetarea adreselor (`sluguri.json`, vezi `slugul`).
      k,
      // ce e
      titlu,
      autor,
      slug: slugul(titlu, fisa.nr, k),
      corpHtml,
      corpText,
      corpCurat,
      poze,
      // ⚠️ mentiunea care e doar numele gazdei nu se scrie: ar ieși de doua ori (vezi `eNumeleGazdei`)
      sursaText: eNumeleGazdei(mentiune, sursaUrl) ? '' : mentiune,
      sursaUrl,
      sursaFel: !sursaUrl ? 'fara' : ePdf(sursaUrl) ? 'pdf' : 'pagina',
      linkuri,
      gazde: [...new Set(linkuri.map(gazda).filter(Boolean))],
    })
  }
  return out
}

// ---------------------------------------------------------------------------

const lista = JSON.parse((await ia('lista.json')) ?? '[]')
if (!lista.length) { console.error('lista.json e goala'); process.exit(1) }

if (VEZI) {
  const f = lista.find((x) => x.nr === VEZI) ?? lista.find((x) => x.id === VEZI)
  if (!f) { console.error(`numarul ${VEZI} nu e in lista`); process.exit(1) }
  const h = await ia(`stiri/${f.id}.html`)
  if (BLOCURI) {
    blocuri(h ?? '').forEach((b, i) => {
      console.log(String(i).padStart(2), b.fel === 'poza' ? 'POZA ' : 'TEXT ',
        b.fel === 'poza' ? b.poze.map((u) => u.split('/').pop()).join(', ') : b.text.slice(0, 96))
    })
    process.exit(0)
  }
  const art = articoleleDin(h ?? '', f)
  console.log(`${f.subiect}\n${art.length} articole\n`)
  for (const a of art) {
    console.log('─'.repeat(70))
    console.log('titlu :', a.titlu || '(fără)')
    console.log('autor :', a.autor || '(fără)')
    console.log('slug  :', a.slug)
    console.log('sursa :', `${a.sursaText || '(fără mențiune)'} [${a.sursaFel}]`)
    console.log('poze  :', a.poze.map((u) => u.split('/').pop()).join(', ') || '(fără)')
    console.log('linkuri:', a.linkuri.join(', ') || '(fără)')
    // ⚠️ se arata FRAGMENTUL asa cum ajunge in baza (cu formatarea minima), nu textul plat: aici se
    // vede daca s-au pastrat ingrosarile, listele si citatele
    console.log('fragment:\n' + a.corpCurat.slice(0, 900) + (a.corpCurat.length > 900 ? '\n…' : ''))
    console.log('       ', a.corpText.length, 'semne de text')
  }
  process.exit(0)
}

const toate = []
const cozi = lista.slice()
let citite = 0
await Promise.all([0, 1, 2, 3].map(async () => {
  while (cozi.length) {
    const f = cozi.shift()
    const h = await ia(`stiri/${f.id}.html`)
    citite++
    if (!h) continue
    toate.push(...articoleleDin(h, f))
  }
}))
toate.sort((a, b) => a.trimis.localeCompare(b.trimis) || a.slug.localeCompare(b.slug))

/*
 * ⚠️ SLUGUL E ADRESA FISEI, deci trebuie sa fie UNIC si STABIL. Titlurile se repeta des în arhivă
 * („Cuvânt de folos" e în patru numere, „Sfântul Sofronie Saharov" în trei), iar articolele fără
 * titlu n-au de unde-l lua. Deci: slugul din titlu cât timp e liber; altfel i se adaugă numărul
 * buletinului, iar dacă și acela e luat (două articole cu același titlu în același număr), rangul.
 * Se face DUPĂ sortare, ca ordinea să fie aceeași la fiecare rulare — altfel aceeași arhivă ar da
 * sluguri diferite de la o zi la alta, iar adresele de pe Website ar muri.
 */
/*
 * ⚠️⚠️ LACATUL ADRESELOR (`sluguri.json`, 16.09.2026). O adresa data mai departe nu se mai schimba —
 * iar slugul se naste din TITLU, deci orice indreptare de titlu ar muta fisa la alta adresa si ar
 * omori-o pe cea veche. De aceea articolele care erau in baza la prima publicare isi pastreaza
 * adresa de atunci, oricat s-ar indrepta titlul lor de aici inainte. Cheia lacatului e singurul
 * lucru din articol care NU atarna de titlu: numarul buletinului plus locul articolului in el.
 * Articolele noi (necunoscute lacatului) isi iau slugul din titlu, ca pana acum.
 */
const LACAT = JSON.parse(readFileSync(new URL('./sluguri.json', import.meta.url), 'utf8'))
const luate = new Set()
const deLacat = new Set()
for (const a of toate) {
  const inchis = LACAT[`${a.newsletterId}#${a.k}`]
  if (!inchis) continue
  a.slug = inchis
  luate.add(inchis)
  deLacat.add(a)
}
for (const a of toate) {
  if (deLacat.has(a)) continue
  let s = a.slug
  if (luate.has(s)) s = `${a.slug}-nr${a.nr ?? a.newsletterId}`
  let k = 2
  while (luate.has(s)) s = `${a.slug}-nr${a.nr ?? a.newsletterId}-${k++}`
  luate.add(s)
  a.slug = s
}
console.log(`adrese pastrate din lacat: ${deLacat.size} / ${toate.length}`)

/*
 * ⚠️⚠️ INDREPTARILE DE MANA (`indreptari.json`, 16.09.2026). Ce nu se poate scoate din buletin se
 * scrie aici, o data, si se pune peste ce a scos extragerea — LA FIECARE RULARE. Fara asta,
 * urmatoarea extragere ar sterge munca omului: ea citeste tot de la capat din arhiva, iar arhiva a
 * ramas cum e (la 64 de articole buletinul a scris NUMELE AUTORULUI in locul titlului, la altele a
 * dat aceluiasi titlu la doua texte din acelasi numar).
 *
 * Aceeasi regula ca la biblioteca: unealta propune, OMUL HOTARASTE, iar hotararea lui sta intr-un
 * fisier care calatoreste cu git — nu in baza, care se rescrie la fiecare import.
 *
 * Cheia e SLUGUL, care e inghetat de lacatul de mai sus, deci nu se poate rupe de la o rulare la alta.
 * Fiecare intrare poate da `titlu`, `autor` sau amandoua; `deUnde` si `sursa` sunt doar pentru om.
 */
const INDREPTARI = JSON.parse(readFileSync(new URL('./indreptari.json', import.meta.url), 'utf8'))
// cheile care incep cu „_" sunt lamuriri pentru om, nu articole
for (const c of Object.keys(INDREPTARI)) if (c.startsWith('_')) delete INDREPTARI[c]
let indreptate = 0
for (const a of toate) {
  const i = INDREPTARI[a.slug]
  if (!i) continue
  if (i.titlu) a.titlu = i.titlu
  if (i.autor) a.autor = i.autor
  indreptate++
}
/*
 * ⚠️ „SINAXAR" SE PUNE LA URMĂ, dupa indreptarile de mana (user, 16.09.2026). Vietile sfintilor n-au
 * un scriitor al lor; regula e in `titlu-autor.mjs`, sub probe. Ordinea conteaza: o indreptare de
 * mana care da `autor` o anuleaza, fiindca hotararea omului bate ghiceala dupa forma titlului.
 */
let sinaxare = 0
for (const a of toate) {
  const pus = autorulScris(a.autor, a.titlu)
  if (pus !== a.autor) { a.autor = pus; sinaxare++ }
}
console.log(`autor „Sinaxar" pus la: ${sinaxare} articole`)

const nestiute = Object.keys(INDREPTARI).filter((s) => !toate.some((a) => a.slug === s))
console.log(`indreptari de mana puse: ${indreptate} / ${Object.keys(INDREPTARI).length}`
  + (nestiute.length ? ` ⚠️ ${nestiute.length} pentru sluguri care nu mai exista: ${nestiute.slice(0, 4).join(', ')}` : ''))

const cuTitlu = toate.filter((a) => a.titlu).length
const cuPoza = toate.filter((a) => a.poze.length).length
const cuLink = toate.filter((a) => a.sursaUrl).length
const cuPdf = toate.filter((a) => a.sursaFel === 'pdf').length
const cuPagina = toate.filter((a) => a.sursaFel === 'pagina').length
const faraLink = toate.filter((a) => a.sursaFel === 'fara').length
const faraNimic = toate.filter((a) => a.sursaFel === 'fara' && !a.sursaText).length
const numere = new Set(toate.map((a) => a.newsletterId))
const lungimi = toate.map((a) => a.corpText.length).sort((a, b) => a - b)
const mediana = lungimi[Math.floor(lungimi.length / 2)] ?? 0
const gazde = {}
for (const a of toate) for (const g of a.gazde) gazde[g] = (gazde[g] ?? 0) + 1

console.log(`numere citite: ${citite} / ${lista.length}`)
console.log(`ARTICOLE: ${toate.length}, din ${numere.size} numere`)
console.log(`  cu titlu: ${cuTitlu} · cu poză: ${cuPoza}`)
// ⚠️ autorul si mentiunea sunt cele doua lucruri care se strica in tacere la o schimbare de reguli —
// de aceea se numara la fiecare rulare, nu doar cand cineva se uita anume
console.log(`  cu autor: ${toate.filter((a) => a.autor).length} (din care „Sinaxar": ${
  toate.filter((a) => a.autor === 'Sinaxar').length}) · fără autor: ${toate.filter((a) => !a.autor).length}`)
console.log(`  cu mențiune de sursă scrisă de om: ${toate.filter((a) => a.sursaText).length}`)
console.log(`  SURSA: ${cuPdf} PDF · ${cuPagina} pagină web · ${faraLink} fără link (din care ${faraNimic} fără nimic)`)
console.log(`  cu link, cu totul: ${cuLink}`)
console.log(`  corp: median ${mediana} semne, cel mai scurt ${lungimi[0]}, cel mai lung ${lungimi[lungimi.length - 1]}`)
console.log(`  gazde: ${Object.entries(gazde).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([g, n]) => `${g} (${n})`).join(', ')}`)

const scurte = toate.filter((a) => a.corpText.length < 200)
console.log(`\n⚠️ articole cu corp sub 200 de semne: ${scurte.length}`)
for (const a of scurte.slice(0, 6)) console.log(`   nr.${a.nr} · ${a.titlu.slice(0, 50) || '(fără titlu)'} · ${a.corpText.length} semne`)
const faraTitlu = toate.filter((a) => !a.titlu)
console.log(`⚠️ fără titlu: ${faraTitlu.length}`)
for (const a of faraTitlu.slice(0, 6)) console.log(`   nr.${a.nr} · ${a.corpText.slice(0, 60)}…`)

// slugurile trebuie sa fie unice: sunt adresa fisei
const peSlug = new Map()
for (const a of toate) { if (!peSlug.has(a.slug)) peSlug.set(a.slug, []); peSlug.get(a.slug).push(a) }
const ciocniri = [...peSlug.entries()].filter(([, v]) => v.length > 1)
console.log(`⚠️ sluguri care se ciocnesc: ${ciocniri.length}`)
for (const [s, v] of ciocniri.slice(0, 6)) console.log(`   ${s} → nr. ${v.map((a) => a.nr).join(', ')}`)

if (SCRIE) {
  writeFileSync('/data/chinonic.json', JSON.stringify(toate, null, 1))
  console.log(`\nscris: /data/chinonic.json (${toate.length} articole)`)
} else {
  console.log('\n(fara --scrie) — nu s-a scris nimic.')
}
