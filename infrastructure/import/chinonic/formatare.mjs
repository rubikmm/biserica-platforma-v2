/**
 * FORMATAREA MINIMĂ a unui text citit la chinonic — o singură regulă, folosită în amândouă locurile
 * unde se scrie text: la fragmentul scos din buletin (`extrage.mjs`) și la textul întreg adus de la
 * sursă (`adu-textul.mjs`). Scris o dată, ca fișa să arate la fel indiferent de unde vine textul.
 *
 * ⚠️⚠️ CE A CERUT USERUL (16.09.2026): „text raw cu formatare minimă (bold, italic, liste), fără
 * nimic din site-ul destinatar". Până acum se stoca numai `<p>` cu text gol de orice marcaj, iar
 * ORICE RÂND SUB 60 DE SEMNE SE ARUNCA — așa se pierdeau replicile, versurile, subtitlurile și
 * rândurile de listă. Aici se păstrează PATRU lucruri și nimic mai mult:
 *   îngroșarea, înclinarea, listele și citatele.
 * ⚠️ SUBTITLURILE DEVIN PARAGRAF ÎNGROȘAT (hotărârea userului, 16.09.2026, întrebat anume: „paragraf
 * bold"). Nu `<h2>`: un titlu de secțiune din alt site n-are ce căuta în ierarhia paginii noastre —
 * acolo `<h1>` e titlul articolului, iar un `<h2>` străin i-ar fura rangul.
 *
 * ⚠️⚠️ NU SE ÎNCREDE ÎN HTML-UL STRĂIN. Nimic din ce vine din email ori de pe alt site nu ajunge în
 * pagină ca HTML. Drumul e: marcajele care au voie se prefac în SEMNE DE CONTROL (sentinelele de mai
 * jos), restul etichetelor se taie, textul se escapează în întregime, și abia la urmă sentinelele
 * devin iar etichete — ale noastre. Așa nu poate intra niciun `<script>`, niciun stil de email și
 * nicio urmă de numărătoare, oricât de prost ar fi scris izvorul.
 */

/*
 * ⚠️ Se decodeaza de DOUA ori: 45 de fragmente vechi au entitati codate de doua ori la trimitere
 * (`&amp;atilde;`, `&amp;shy;`), iar o singura trecere lasa „&atilde;" in textul curat (16.09.2026).
 * `atilde` (ã) e felul in care site-urile vechi scriau ă; `shy` e cratima moale, nevazuta.
 */
const ENT = {
  acirc: 'â', Acirc: 'Â', icirc: 'î', Icirc: 'Î', abreve: 'ă', Abreve: 'Ă', atilde: 'ă', Atilde: 'Ă',
  scedil: 'ș', Scedil: 'Ș', tcedil: 'ț', Tcedil: 'Ț', amp: '&', nbsp: ' ', shy: '', quot: '"',
  apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', ldquo: '„', rdquo: '”', ndash: '–', mdash: '—',
  hellip: '…', bdquo: '„', bull: '•', middot: '·', laquo: '«', raquo: '»', deg: '°',
  /*
   * ⚠️ `&not;` SE ARUNCĂ, ca `&shy;` (măsurat 16.09.2026: 18 locuri, cele mai multe din arhiva veche).
   * Semnul ¬ n-are ce căuta într-un text de citit; site-urile de atunci îl scriau în locul cratimei de
   * despărțire la capăt de rând — „cres&not;tinii" e „creștinii", nu „cres¬tinii".
   */
  not: '',
  sect: '§', para: '¶', dagger: '†', trade: '™', reg: '®', copy: '©', times: '×', divide: '÷',
  euro: '€', pound: '£', prime: '′', Prime: '″', lsaquo: '‹', rsaquo: '›', sbquo: '‚', dash: '–',
  // literele latine cu semne, din numele și citatele străine
  aacute: 'á', agrave: 'à', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç', eacute: 'é', egrave: 'è',
  ecirc: 'ê', euml: 'ë', iacute: 'í', igrave: 'ì', iuml: 'ï', ntilde: 'ñ', oacute: 'ó', ograve: 'ò',
  ouml: 'ö', otilde: 'õ', oslash: 'ø', uacute: 'ú', ugrave: 'ù', uuml: 'ü', yacute: 'ý', szlig: 'ß',
  Aacute: 'Á', Agrave: 'À', Auml: 'Ä', Aring: 'Å', Ccedil: 'Ç', Eacute: 'É', Egrave: 'È', Euml: 'Ë',
  Iacute: 'Í', Ntilde: 'Ñ', Oacute: 'Ó', Ouml: 'Ö', Oslash: 'Ø', Uacute: 'Ú', Uuml: 'Ü',
}
/*
 * Literele grecești, scrise pe nume în citatele din Părinți („&alpha;&gamma;&alpha;&pi;&eta;").
 * Se pun din cod, nu una câte una: în Unicode stau chiar în ordinea numelor lor, iar `sigmaf` (ς) ține
 * tocmai locul gol din șirul majusculelor — deci același rang merge la amândouă șiruri.
 */
const GRECESTI = ('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron '
  + 'pi rho sigmaf sigma tau upsilon phi chi psi omega').split(' ')
for (const [rang, nume] of GRECESTI.entries()) {
  ENT[nume] = String.fromCharCode(0x3b1 + rang)
  ENT[nume[0].toUpperCase() + nume.slice(1)] = String.fromCharCode(0x391 + rang)
}
const entOData = (s) => s.replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
export const ent = (s) => entOData(entOData(s))

/*
 * SENTINELELE — marcajele care au voie, purtate prin toată curățarea ca semne de control, ca să nu
 * fie confundate cu text și ca să nu poată deveni etichete decât la îmbrăcarea finală. Semnele 1, 2
 * și 3 nu apar niciodată într-un text scris de om.
 *
 * ⚠️ Scrise prin `String.fromCharCode`, nu ca literali: un caracter de control pus de-a dreptul în
 * fișier nu se vede la citire, iar o greșeală în el (doi identici, unul șters de un editor) ar fi un
 * defect care nu se poate găsi cu ochiul. Aici se vede limpede care e care.
 */
const C = (n) => String.fromCharCode(n)
const B_DA = `${C(1)}b`
const B_NU = `${C(2)}b`
const I_DA = `${C(1)}i`
const I_NU = `${C(2)}i`
/** Semnul unui rând de listă, pus în locul lui `<li>`. */
const LISTA = C(3)
const RE_SENTINELE = new RegExp(`[${C(1)}${C(2)}][bi]|${LISTA}`, 'g')
const RE_MARCAJE = new RegExp(`[${C(1)}${C(2)}][bi]`, 'g')

/** Textul gol de sentinele — cel care se măsoară, se compară și se dă probelor. */
export const faraSentinele = (t) => (t ?? '').replace(RE_SENTINELE, '')

/**
 * ⚠️ MARCAJELE NEÎNCHISE SE ARUNCĂ, TOATE. Un `<strong>` deschis și niciodată închis (editorul de
 * email le rupe des) ar îngroșa restul paginii de la locul lui în jos. Dacă socoteala nu iese
 * curată pe rândul acesta, rândul rămâne text simplu — pierdem o îngroșare, nu stricăm pagina.
 */
function echilibrat(t) {
  let b = 0
  let i = 0
  for (const m of t.match(RE_MARCAJE) ?? []) {
    if (m === B_DA) b++
    else if (m === B_NU) b--
    else if (m === I_DA) i++
    else i--
    if (b < 0 || i < 0) return faraSentinele(t)
  }
  if (b !== 0 || i !== 0) return faraSentinele(t)
  // marcaje care nu cuprind nimic: „<strong></strong>" e podoabă de editor, nu îngroșare
  return t
    .replace(new RegExp(`${B_DA}\\s*${B_NU}`, 'g'), ' ')
    .replace(new RegExp(`${I_DA}\\s*${I_NU}`, 'g'), ' ')
}

const escapa = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/**
 * Un rând, gata de pus în pagină: escapat de tot, apoi cu sentinelele prefăcute în etichetele
 * noastre. ⚠️ Ordinea e toată siguranța: se escapează ÎNTÂI, deci nimic din text nu poate deveni
 * etichetă.
 */
export function siguranta(t) {
  return escapa(echilibrat(t ?? ''))
    .replaceAll(B_DA, '<strong>').replaceAll(B_NU, '</strong>')
    .replaceAll(I_DA, '<em>').replaceAll(I_NU, '</em>')
    .replaceAll(LISTA, '')
}

/**
 * ⚠️ NORMALIZAREA TEXTULUI (user, 16.09.2026: „referințele păstrează-le, dar imaginile șterge-le și
 * adresele și tot"). Referintele — „(Psalmul 18)", numele unei carti — sunt cuvinte si raman.
 * Adresele („http://…", „www.…") nu sunt text de citit si ies.
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

/** Cât poate avea un subtitlu: mai lung de atât nu mai e titlu de bucată, e proză îngroșată. */
const SUBTITLU = 120

/** Rândul e îngroșat de la un cap la altul — adică un subtitlu, nu o îngroșare dinăuntrul frazei. */
const totIngrosat = (t) => {
  const s = t.trim()
  return s.startsWith(B_DA) && s.endsWith(B_NU)
    && (s.match(new RegExp(B_DA, 'g')) ?? []).length === 1
}

/**
 * Un bloc de text: felul lui și scrisul, cu sentinele. Felurile sunt patru și nu mai multe —
 * `p` (paragraf), `sub` (subtitlu, scris paragraf îngroșat), `li` (rând de listă), `citat`.
 */
export function bloc(fel, text) {
  const t = echilibrat(text ?? '')
  const gol = faraSentinele(t).trim()
  /*
   * ⚠️ SUB DOUĂ LITERE NU E TEXT. Nu se numără semnele, ci LITERELE: din barele laterale ale
   * site-urilor rămâneau resturi ca „")" ori „—" — două semne, deci treceau pragul de lungime și
   * ajungeau paragrafe în fișă, ba mai rău, opreau curățarea coadei (vezi `coadaCurata`).
   */
  if ((gol.match(/\p{L}/gu) ?? []).length < 2) return null
  if (fel === 'sub') return { fel: 'sub', text: gol }
  if (fel === 'p' && totIngrosat(t) && gol.length <= SUBTITLU) return { fel: 'sub', text: gol }
  return { fel, text: t }
}

/**
 * DIN HTML DE EMAIL → blocuri. MailPoet scrie culori, fonturi și tabele inline; aici rămâne doar ce
 * scrie, plus cele patru marcaje. `citat` spune că celula întreagă era un citat
 * (`mailpoet_blockquote`).
 */
export function blocuriDinHtml(brut, citat = false) {
  const cu = faraScripturi(brut)
    .replace(/<\s*(strong|b)\b[^>]*>/gi, B_DA).replace(/<\s*\/\s*(strong|b)\s*>/gi, B_NU)
    .replace(/<\s*(em|i)\b[^>]*>/gi, I_DA).replace(/<\s*\/\s*(em|i)\s*>/gi, I_NU)
    .replace(/<\s*li\b[^>]*>/gi, `\n${LISTA}`)
    .replace(/<br\s*\/?>|<\/(p|div|td|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return ent(cu)
    .split('\n')
    .map((linie) => {
      const eLista = linie.includes(LISTA)
      const t = normalizeaza(linie.replaceAll(LISTA, ''))
      return bloc(eLista ? 'li' : citat ? 'citat' : 'p', t)
    })
    .filter(Boolean)
}

/**
 * ⚠️ SCRIPTUL ȘI STILUL SE SCOT CU TOT CU TRUPUL LOR. Tăierea etichetelor singură lasă înăuntrul
 * textului ce scria între ele — `fetch("…"+document.cookie)` ajungea un paragraf al fișei. Nu e o
 * gaură de securitate (tot se escapează), dar e murdărie care se vede în pagină, iar la un PDF ori la
 * o pagină veche se întâmplă. Deci: întâi trupul, apoi etichetele.
 */
const faraScripturi = (h) => h.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')

/** `[cuvânt](adresă)` → „cuvânt", pozele pleacă de tot: adresa nu e text de citit. */
const faraLegaturi = (l) => l
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
/** Scăpările puse de unealta de conversie (`\*`, `\_`, `\[`) — se scot, altfel marcajele nu se văd. */
const faraScapari = (l) => l.replace(/\\([*_[\]#>`~\-.])/g, '$1')

/** Marcajele dinăuntrul unui rând de markdown → sentinele; restul se taie. */
export function inlineDinMarkdown(brut) {
  return normalizeaza(
    // ⚠️ etichetele se taie ÎNAINTE de decodarea entităților: altfel un „&lt;script&gt;" scris ca text
    // ar deveni etichetă și s-ar pierde tocmai ce scria acolo
    ent(faraLegaturi(faraScripturi(brut)).replace(/<[^>]+>/g, ' '))
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, (m, s, i) => `${B_DA}${i}${B_NU}`)
      .replace(/(?<![\p{L}\d*])\*(?=\S)([^*\n]*?\S)\*(?!\p{L})/gu, (m, i) => `${I_DA}${i}${I_NU}`)
      .replace(/(?<![\p{L}\d_])_(?=\S)([^_\n]*?\S)_(?!\p{L})/gu, (m, i) => `${I_DA}${i}${I_NU}`)
      .replace(/[*_`#]+/g, ' ')                                   // marcajele nepotrivite, rămase
      .replace(/^\s*[|>]+\s*/, ''),
  )
}

/**
 * DINTR-UN RÂND DE MARKDOWN → un bloc. Unealta de conversie a Cloudflare scoate markdown din HTML și
 * din PDF; de aici încolo nu se mai știe de pe ce site a venit.
 */
export function blocDinMarkdown(linie) {
  const l = faraScapari(linie)
  const titlu = /^\s{0,3}#{1,6}\s+(.*)$/.exec(l)
  const lista = /^\s{0,3}(?:[*+-]|\d+[.)])\s+(.*)$/.exec(l)
  const citat = /^\s{0,3}>\s?(.*)$/.exec(l)
  const fel = titlu ? 'sub' : lista ? 'li' : citat ? 'citat' : 'p'
  return bloc(fel, inlineDinMarkdown(titlu?.[1] ?? lista?.[1] ?? citat?.[1] ?? l))
}

/**
 * BLOCURILE → HTML-ul nostru. Rândurile de listă și citatele de un fel se strâng la un loc: patru
 * `<li>` unul după altul sunt o listă, nu patru liste.
 */
export function imbraca(blocuriDate) {
  /*
   * ⚠️ UN CITAT CARE E TOT TEXTUL nu mai e un citat, e textul. Se întâmplă des în buletin: redactorul
   * a pus articolul întreg în stilul de citat al editorului. Lăsat așa, fișa ar avea o dungă pe lângă
   * fiecare rând al ei — și încă una a fragmentului pe deasupra. Deci se dezbracă.
   */
  const totCitat = blocuriDate.length > 1 && blocuriDate.every((b) => b.fel === 'citat')
  const blocuri = totCitat ? blocuriDate.map((b) => ({ ...b, fel: 'p' })) : blocuriDate
  const out = []
  let i = 0
  while (i < blocuri.length) {
    const fel = blocuri[i].fel
    if (fel === 'li' || fel === 'citat') {
      const bucati = []
      while (i < blocuri.length && blocuri[i].fel === fel) bucati.push(siguranta(blocuri[i++].text))
      out.push(fel === 'li'
        ? `<ul>${bucati.map((x) => `<li>${x}</li>`).join('')}</ul>`
        : `<blockquote>${bucati.map((x) => `<p>${x}</p>`).join('')}</blockquote>`)
      continue
    }
    // ⚠️ subtitlul e PARAGRAF ÎNGROȘAT, nu titlu (hotărârea userului): vezi lămurirea din cap
    out.push(fel === 'sub'
      ? `<p class="ch-sub"><strong>${siguranta(blocuri[i].text)}</strong></p>`
      : `<p>${siguranta(blocuri[i].text)}</p>`)
    i++
  }
  return out.join('\n')
}

/** Textul curat al unui șir de blocuri — pentru măsurat și pentru probele de calitate. */
export const textulGol = (blocuri) => blocuri.map((b) => faraSentinele(b.text)).join(' ')
