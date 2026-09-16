/**
 * TITLUL ȘI AUTORUL unui text citit la chinonic — regulile de despărțire, singure într-un modul, ca
 * să poată fi probate (`tests/chinonic-titlu-autor.test.ts`). Sunt reguli măsurate pe arhivă, nu
 * adevăruri: fiecare are în spate un articol care ieșea prost. De aceea stau sub probe.
 *
 * Le folosește `extrage.mjs`; aici nu se citește nimic din afară și nu se scrie nimic.
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
}
const entOData = (s) => s.replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
export const ent = (s) => entOData(entOData(s))

/**
 * Semnele cu care un rand SE CONTINUA in randul urmator — dupa ele nu poate incepe autorul.
 * ⚠️ Punctele de suspensie NU sunt printre ele: in buletin ele inchid un titlu prea lung („…în chipul
 * vieţi…"), iar numele vine tocmai dupa.
 */
const seContinua = (r) => /[,:;–—\-]$/.test(r.trim())
/**
 * Titlurile de cinste cu care incepe un nume, in arhiva asta. Sunt ancorate la inceputul randului:
 * „arhiepiscopul Constantinopolului," din mijlocul unui titlu lung nu trebuie sa treaca drept autor.
 *
 * ⚠️ Hotarul de la capat e „nu urmeaza o litera", NU `\b` (indreptat 16.09.2026, prins de probe).
 * Dupa `\b` nicio prescurtare nu se potrivea: intre punctul din „Protos." si spatiul de dupa el nu e
 * hotar de cuvant — amandoua sunt semne —, deci „Sf.", „Pr.", „Arhim." si „Protos." cadeau toate, si
 * tocmai ele sunt jumatate din numele arhivei.
 */
const CINSTE = new RegExp('^(sf(â|a)nt(ul|a)|sf\\.|sfin[tț]ii|cuvios(ul|a)|p(ă|a)rintele|pr\\.|preot(ul)?|'
  + 'protos\\.|protosinghel(ul)?|arhim\\.|arhimandrit(ul)?|ieromonah(ul)?|monah(ul)?|mitropolit(ul)?|'
  + 'miropolit(ul)?|episcop(ul)?|arhiepiscop(ul)?|patriarh(ul)?|preasfin[tț]itul|[ÎI]PS|PS|stare[tț]ul|'
  + 'egumen(ul)?|diacon(ul)?|protoiereu|avva)(?!\\p{L})', 'iu')
/** Cuvintele mici care stau intr-un nume fara majuscula: „Nicolae de la Rohia", „Ioan Gură de Aur". */
const MARUNTE = /^(de|din|la|al|ale|a|cel|cea|si|și|von|van|the|of|d[ei]la)$/i

/** Numele scris curat: fara entitati si fara semnul cu care se lipea de text („Episcopul …:"). */
export const curataNumele = (r) => ent(r).trim().replace(/[.:;,–—-]+$/, '').trim()

/**
 * Randul e un NUME de om? Doua feluri de a fi: ori incepe cu un titlu de cinste, ori e scurt si scris
 * tot cu majuscule de inceput („Stephen Freeman", „Doxologia"). Un rand cu cifre, cu ghilimele ori cu
 * cuvinte scrise mic la inceput nu e nume, ci urmarea titlului.
 */
export function eNume(r) {
  const t = curataNumele(r ?? '')
  // ⚠️ doua puncte in MIJLOC inseamna ca randul spune ceva despre text, nu e un nume: „Sursa: Fișier
  // PDF" trecea drept autor, fiindca toate cuvintele lui incep cu majusculă
  if (!t || t.length > 90 || /\d/.test(t) || /^[„“"«(\-–—•]/.test(t) || /:/.test(t)) return false
  if (CINSTE.test(t)) return true
  const cuvinte = t.split(/\s+/)
  if (cuvinte.length > 6) return false
  return cuvinte.every((c) => MARUNTE.test(c) || /^[\p{Lu}]/u.test(c))
}

/**
 * Randurile titlului se lipesc cu un spatiu. Linia se pune intre ele numai cand acolo se sfarseste o
 * propozitie si incepe alta — adica randul dinainte se termina in cuvant cu majuscula, iar cel de
 * dupa incepe tot cu majuscula. Fara asta iesea „Predica părintelui Dumitru Stăniloae la – Duminica
 * samarinencei": „la" cerea urmarea, nu o linie.
 */
const lipeste = (a, b) => {
  const ultimul = a.trim().split(/\s+/).at(-1) ?? ''
  const propozitieNoua = /^[\p{Lu}]/u.test(ultimul) && /^[\p{Lu}„“"«]/u.test(b.trim())
  return seContinua(a) || !propozitieNoua ? `${a} ${b}` : `${a} – ${b}`
}

/*
 * ⚠️⚠️ TITLUL POATE AVEA MAI MULTE RANDURI (user, 16.09.2026: „Titlul este incomplet și o parte s-a
 * dus la autor"). Pana atunci se lua drept titlu PRIMUL rand si drept autor TOT ce urma, lipit cu
 * „·" — asa a iesit „Predică la duminica a VI-a după Paști –" cu autorul „Despre vindecarea minunată
 * a orbului din naștere · Sfântul Nicolae Velimirovici". In buletin titlul e rupt pe randuri de
 * latimea coloanei, nu de inteles: al doilea rand e de cele mai multe ori urmarea titlului.
 *
 * Regula, masurata pe toata arhiva: se cauta PRIMUL rand care e un NUME de om si care NU e urmarea
 * randului dinainte. De acolo in jos e autorul, cu tot ce-l lamureste („Protos. Arsenie Muscalu
 * (duhovnicul Mănăstirii…)"), iar ce e deasupra e titlul. Cand niciun rand nu e nume, totul e titlu
 * si articolul ramane fara autor: mai bine fara autor decat cu o bucata de titlu pusa drept nume.
 */
export function desparte(randuri) {
  if (!randuri.length) return { titlu: '', autor: '' }
  let taietura = -1
  for (let i = 1; i < randuri.length; i++) {
    if (seContinua(randuri[i - 1])) continue
    if (!eNume(randuri[i])) continue
    /*
     * ⚠️ In MIJLOCUL capului numele se recunoaste numai dupa titlul de cinste. Proba slaba — „toate
     * cuvintele cu majuscula" — lua drept autor si urmarea titlului: „Cuvânt în cea de-a XXXII-a
     * Duminică după Cincizecime" ramanea cu autorul „Despre Zaheu Sfântul Ignatie Briancianinov".
     * Pe ULTIMUL rand proba slaba ramane buna: acolo stau „Stephen Freeman" si „Doxologia".
     */
    if (i < randuri.length - 1 && !CINSTE.test(curataNumele(randuri[i]))) continue
    taietura = i
    break
  }
  const alTitlului = taietura < 0 ? randuri : randuri.slice(0, taietura)
  const alAutorului = taietura < 0 ? [] : randuri.slice(taietura)
  return {
    titlu: alTitlului.reduce((a, b) => lipeste(a, b)),
    autor: curataNumele(alAutorului.join(' ')),
  }
}

/*
 * ⚠️ SINAXARUL NU ARE AUTOR, ARE UN FEL (user, 16.09.2026: „titlu + autor (Sinaxar sau fără autor ca
 * excepție)"). Vietile sfintilor din arhiva chiar n-au un scriitor al lor: sunt sinaxare, luate din
 * Proloage ori de pe site-urile de sinaxar. „Fara autor" la ele se citeste ca o scapare; „Sinaxar"
 * spune ce sunt. Ramane „Fara autor" numai unde textul chiar e al cuiva si nu i-am gasit numele.
 *
 * ⚠️ E o ghiceala dupa forma titlului, ca toate regulile din fisierul asta — de aceea sta sub probe,
 * iar hotararea omului (`indreptari.json`) se pune PESTE ea: o intrare cu `autor` o anuleaza.
 */
const plat = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[șşțţ]/g, (c) => (/[șş]/.test(c) ? 's' : 't')).toLowerCase()
/** Cu ce incepe un titlu de sinaxar: fapta unui sfant, nu un text scris de cineva. */
const INCEPUT_DE_SINAXAR = /^(viata|vietile|sinaxar|proloagele|pomenirea|soborul|aducerea|icoana|minunea|mucenicia|patimirea|acatistul|moastele|sf\.|sfantul|sfanta|sfantului|sfintei|sfintii|sfintilor|sfintele|cuviosul|cuvioasa|cuviosii|mucenicul|mucenita|martirul)(?!\p{L})/u
/** …si ce il scoate din sinaxar: un fel literar anume, deci textul e al cuiva, chiar daca nu-i stim numele. */
const FEL_SCRIS_DE_CINEVA = /(?:^|\P{L})(cuvant|cuvinte|predica|predici|omilie|omilii|talcuire|despre|invatatur|sfaturi|scrisoare|epistol|raspuns|convorbir|interviu)/u

export const eSinaxar = (titlu) => {
  const t = plat(titlu ?? '').trim()
  return !!t && INCEPUT_DE_SINAXAR.test(t) && !FEL_SCRIS_DE_CINEVA.test(t)
}

/** Autorul scris in fisa: numele lui, „Sinaxar" la vietile sfintilor, altfel „Fără autor". */
export const autorulScris = (autor, titlu) => autor || (eSinaxar(titlu) ? 'Sinaxar' : '')

/*
 * ⚠️⚠️ AUTORUL NU STA INTOTDEAUNA IN TITLU. La vreo suta de articole buletinul scrie titlul ingrosat,
 * iar NUMELE pe randul urmator — care nu mai e ingrosat, deci nu intra in „capul" citit de `titluDin`
 * din `extrage.mjs`, ci ajunge primul paragraf al textului („Despre petrecerea revelionului" /
 * „Sfântul Ioan Gură de Aur" / „Anul îţi va merge bine…"). User, 16.09.2026: „majoritatea au autor
 * scris imediat după titlu".
 *
 * Aici se ia de acolo: primul paragraf, daca e un nume, trece la autor si IESE din text — altfel ar
 * ramane scris de doua ori in capul fisei. Se ia si al doilea paragraf cand e lamurirea numelui
 * („Starețul Mănăstirii Sfântul Pavel – Sfântul Munte Athos").
 *
 * ⚠️ Nu se atinge textul cand ce ramane e prea putin: la vreo 25 de articole buletinul n-avea decat
 * poza, linkul si numele autorului — acolo numele CHIAR e tot fragmentul, si daca l-am scoate fisa ar
 * ramane goala. Peste tot altundeva scoaterea lui indreapta si aducerea textului intreg: fragmentul e
 * semnul dupa care se cauta inceputul articolului pe pagina sursa, iar un nume lipit in capul lui
 * facea semnul de negasit (vezi `semneleInceputului` din `adu-textul.mjs`).
 */
export function autorulDinCap(autorDinTitlu, paragrafe) {
  if (autorDinTitlu || !paragrafe.length) return { autor: autorDinTitlu, paragrafe }
  if (!eNume(paragrafe[0])) return { autor: '', paragrafe }
  const cate = paragrafe.length > 2 && eNume(paragrafe[1]) ? 2 : 1
  const ramas = paragrafe.slice(cate)
  if (ramas.join(' ').length < 200) return { autor: '', paragrafe }
  return { autor: paragrafe.slice(0, cate).map(curataNumele).join(', '), paragrafe: ramas }
}
