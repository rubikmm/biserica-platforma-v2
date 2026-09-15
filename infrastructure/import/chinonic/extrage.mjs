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
import { writeFileSync } from 'node:fs'

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

const ENT = {
  acirc: 'â', Acirc: 'Â', icirc: 'î', Icirc: 'Î', abreve: 'ă', Abreve: 'Ă', scedil: 'ș', Scedil: 'Ș',
  tcedil: 'ț', Tcedil: 'Ț', amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  rsquo: '’', lsquo: '‘', ldquo: '„', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', bdquo: '„',
}
const ent = (s) => s.replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
const platit = (h) => ent(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/**
 * Blocurile unui numar, in ordinea din pagina: fiecare celula de text sau de poza a MailPoet.
 * ⚠️ Se iau si `mailpoet_paragraph`, nu doar `mailpoet_text`: articolele vechi isi tin paragrafele
 * in celule de felul al doilea, iar fara ele textul ar fi iesit ciuntit.
 */
function blocuri(h) {
  const re = /<td class="(mailpoet_text|mailpoet_image|mailpoet_paragraph)[^"]*"[^>]*>([\s\S]*?)<\/td>/g
  const out = []
  let m
  while ((m = re.exec(h))) {
    const fel = m[1] === 'mailpoet_image' ? 'poza' : 'text'
    const brut = m[2]
    const text = platit(brut)
    const poze = [...brut.matchAll(/<img[^>]*src="([^"]+)"/g)].map((x) => x[1])
    /* ⚠️ Si adresele RELATIVE, nu doar `http…`: PDF-urile cu textele citite stau la noi, iar in
       arhiva au fost rescrise ca `/media/uploads/…`. Cerandu-se `https?://`, ieseau ZERO PDF-uri
       dintr-o arhiva care are zeci — se vedea in socoteala, nu in cod. */
    const linkuri = [...brut.matchAll(/href="((?:https?:\/\/|\/)[^"#][^"]*)"/g)].map((x) => x[1])
    if (fel === 'poza' && !poze.length) continue
    if (fel === 'text' && !text) continue
    out.push({ fel, brut, text, poze, linkuri })
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
  const titlu = randuri[0]
  if (titlu.length < 3 || titlu.length > 160) return { titlu: '', autor: '', rest: brut }
  // autorul e scurt (un nume); un rand lung dupa titlu e deja text, nu autor
  const autor = randuri.slice(1).filter((r) => r.length <= 90).join(' · ')
  return { titlu, autor, rest }
}

/**
 * PARAGRAFE DE TEXT CURAT din HTML-ul de email (user, 16.09.2026: „nu se afișează bine ca și cum
 * copiezi HTML-ul… să ai texte brute pe care le poți afișa atât pe tema dark, cât și pe tema light").
 * MailPoet scrie culori, fonturi si tabele inline — pe tema intunecata scrisul negru pe fond negru
 * nu se vede. Aici se pastreaza doar CE SCRIE, in paragrafe: se taie la marginile blocurilor, se
 * decodeaza entitatile, se scot etichetele. Ce iese e text, imbracat de noi in <p>, deci arata bine
 * pe orice tema si nu poate strica pagina.
 */
function paragrafeCurate(html) {
  return ent(html)
    .replace(/<br\s*\/?>|<\/(p|div|td|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')            // pozele pleaca odata cu etichetele (user: „imaginile șterge-le")
    .split('\n')
    .map((x) => normalizeaza(x))
    .filter((x) => x.length > 1)
}
/**
 * ⚠️ NORMALIZAREA TEXTULUI (user, 16.09.2026: „referințele păstrează-le, dar imaginile șterge-le și
 * adresele și tot"). Referintele — „(Psalmul 18)", numele unei carti — sunt cuvinte si raman.
 * Adresele („http://…", „www.…") nu sunt text de citit si ies; la fel resturile de markdown.
 */
export function normalizeaza(x) {
  return x
    .replace(/https?:\/\/[^\s)\]»"]+/gi, '')
    .replace(/\bwww\.[^\s)\]»"]+/gi, '')
    .replace(/\(\s*\)|\[\s*\]/g, '')      // parantezele ramase goale dupa scoaterea adresei
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
const escapa = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const inParagrafe = (bucati) => bucati.map((p) => `<p>${escapa(p)}</p>`).join('\n')

/** Gazda unui link, fara „www." — pentru fisa articolului si pentru socoteala. */
function gazda(u) {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return null }
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
    const { titlu, autor, rest } = titluDin(texte[0].brut)
    const corpBlocuri = titlu
      ? [...(platit(rest) ? [{ brut: rest, text: platit(rest) }] : []), ...texte.slice(1)]
      : texte
    const corpHtml = corpBlocuri.map((b) => b.brut.trim()).join('\n')
    const corpText = corpBlocuri.map((b) => b.text).join('\n\n')
    // fragmentul asa cum se ARATA: paragrafe de text curat, fara stilurile de email (vezi mai sus)
    const corpCurat = inParagrafe(corpBlocuri.flatMap((b) => paragrafeCurate(b.brut)))
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
    out.push({
      // de unde vine
      newsletterId: fisa.id,
      nr: fisa.nr,
      trimis: fisa.trimis,
      // ce e
      titlu,
      autor,
      slug: slugul(titlu, fisa.nr, k),
      corpHtml,
      corpText,
      corpCurat,
      poze,
      sursaText: ent(sursaBloc.text).replace(/^\s*surs[ăa]\s*:?\s*/i, '').trim(),
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
    console.log('slug  :', a.slug)
    console.log('sursa :', a.sursa || '(fără)')
    console.log('poze  :', a.poze.map((u) => u.split('/').pop()).join(', ') || '(fără)')
    console.log('linkuri:', a.linkuri.join(', ') || '(fără)')
    console.log('corp  :', a.corpText.slice(0, 300).replace(/\n+/g, ' ⏎ '), a.corpText.length > 300 ? '…' : '')
    console.log('       ', a.corpText.length, 'semne')
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
const luate = new Set()
for (const a of toate) {
  let s = a.slug
  if (luate.has(s)) s = `${a.slug}-nr${a.nr ?? a.newsletterId}`
  let k = 2
  while (luate.has(s)) s = `${a.slug}-nr${a.nr ?? a.newsletterId}-${k++}`
  luate.add(s)
  a.slug = s
}

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
