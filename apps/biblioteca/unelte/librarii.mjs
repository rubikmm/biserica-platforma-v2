/**
 * A12 · De unde se aduc copertile: fiecare librarie cu felul ei de a-si scrie fisa.
 *
 * Statea totul in `imbogatire.mjs`, dar de la cinci surse la nouasprezece n-ar mai fi
 * incaput nimic altceva in fisierul acela. Aici sunt DOAR sursele si cititorii lor;
 * mersul in patru pasi (index, potriveste, adu, strange) a ramas dincolo.
 *
 * O sursa are:
 *   nume, gazda   cum se cheama si unde sta (numele se arata pe fisa cititorului)
 *   pauza         milisecunde intre doua cereri catre ea — `Crawl-delay` din robots.txt
 *                 unde e scris, altfel 2 s din bun-simt
 *   citeste(html, carte)   html -> fisa; `carte` e cartea noastra (o folosesc numai
 *                 agregatoarele, ca sa aleaga EDITIA potrivita dintre mai multe)
 * si un fel de a-si da lista de titluri, unul din doua:
 *   sitemapuri[]  cand are sitemap (+ doarUrl, titluDinUrl)
 *   culege()      cand n-are: un generator care umbla prin paginile de lista, incet
 *
 * Cine adauga o sursa noua adauga un rand aici si nimic altundeva.
 */
import { plat } from "./potrivire.mjs";

/* ------------------------------------------------------------- ajutoarele ---- */

const ENTITATI = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", shy: "",
  hellip: "…", ndash: "–", mdash: "—", bull: "•", middot: "·", deg: "°", euro: "€",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bdquo: "„", sbquo: "‚", laquo: "«", raquo: "»",
  // Romanescul scris cu entitati (asa scrie Predania): î â ă ș ț si majusculele lor.
  icirc: "î", Icirc: "Î", acirc: "â", Acirc: "Â", abreve: "ă", Abreve: "Ă",
  scedil: "ș", Scedil: "Ș", tcedil: "ț", Tcedil: "Ț", scaron: "š", Scaron: "Š",
  agrave: "à", aacute: "á", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", iuml: "ï",
  ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", ouml: "ö", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", szlig: "ß",
};
export const dezescapa = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-zA-Z]+);/g, (t, n) => (n in ENTITATI ? ENTITATI[n] : t));

/** Din html in text curat: fara etichete, fara spatii duble, cu paragrafele pastrate. */
export function text(html) {
  if (!html) return "";
  return dezescapa(String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((l) => l.trim()).join("\n").trim();
}

/**
 * Textul scurt de pus pe fisa: primele fraze intregi, cel mult ~700 de semne. Se taie
 * la punct, nu la jumatate de cuvant, si se sar randurile de recuzita („Traducere din
 * limba…", „992 pagini, 36 planse") pe care magazinul le pune inaintea descrierii.
 */
export function scurteaza(t, maxim = 700) {
  if (!t) return null;
  const randuri = t.split("\n").filter((r) => {
    const p = plat(r);
    if (r.length < 25) return false;
    return !/^(traducere|traducator|editie|colectia|cuprins|isbn|format|nr\.? pagini|coperta)\b/.test(p);
  });
  let s = randuri.join(" ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length <= maxim) return s;
  const taiat = s.slice(0, maxim);
  const p = Math.max(taiat.lastIndexOf(". "), taiat.lastIndexOf("! "), taiat.lastIndexOf("? "));
  return (p > maxim * 0.5 ? taiat.slice(0, p + 1) : taiat.replace(/\s+\S*$/, "") + "…").trim();
}

/** „***" sau „Lipsa autor" e felul magazinelor de a spune „fara autor" — adica nimic. */
/** Cuvinte de meniu prinse din greseala in dreptul etichetei „Autor". Nu sunt oameni. */
const NU_E_OM = /^(edituri|autori|autor|carti|c[ăa]r[țt]i|acasa|acas[ăa]|produse|categorii|magazin|colec[țt]ii|noutati|nout[ăa][țt]i|oferte|blog|contact|detalii|descriere|informa[țt]ii|recenzii|pagina|shop|home)$/i;

export const curataAutor = (a) => {
  // Unele magazine pun in casuta „Autor" notita de traducere sau de ingrijire a editiei.
  // Se pastreaza omul de dupa „de", ca sa nu ajunga toata fraza sa treaca drept autor.
  a = String(a ?? "").replace(/^\s*(traducere|tradus|traducerea|editie ingrijita|edi[țt]ie [îi]ngrijit[ăa]|pref[ața][țt]?[ăa]|studiu introductiv)[^]*?\bde\b\s*/i, "");
  // Uneori valoarea inghite si eticheta urmatoare („Colectiv de autori Editura: X").
  a = String(a ?? "").split(/\s*(?:Editur[ăa]|ISBN|Pagini|Format|Colec[țt]ia|An apari[țt]ie)\s*:/i)[0];
  const t = String(a ?? "").replace(/[*_\-\s]+/g, " ").trim();
  if (!t || !/\p{L}/u.test(t)) return null;
  if (NU_E_OM.test(t)) return null;
  if (t.length > 90) return null;                       // o fraza intreaga nu e un nume
  if (/^(lipsa autor|fara autor|autor necunoscut|diversi autori|colectiv|colectiv de autori|autori diversi|nespecificat)$/i.test(plat(t))) return null;
  return String(a).replace(/\s+/g, " ").trim();
};

export const numar = (x) => {
  const m = String(x ?? "").match(/\d[\d.\s]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/[.\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 20000 ? n : null;
};

/** Continutul unei etichete `<meta property="og:…">`. */
const og = (html, p) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']og:${p}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']og:${p}["']`, "i"))?.[1]
  ?? null;

/** Ultima bucata din adresa, ca titlu de-a gata: „…/talcuire-la-tatal-nostru" -> „talcuire la tatal nostru". */
const dinUrl = (u) => decodeURIComponent(u.split("?")[0].split("/").filter(Boolean).pop() ?? "")
  .replace(/\.html?$/, "").replace(/-/g, " ").trim();

/* -------------------------------------------------------- citirea fiselor ---- */

/**
 * Sophia isi pune tot produsul ca JSON intr-un atribut al paginii (`product="{…}"`),
 * asa cum il da si aplicatiei ei. E cel mai curat lucru cu putinta: nu ghicim din html.
 */
export function citesteSophia(html) {
  const i = html.indexOf('product="{&quot;');
  if (i < 0) return null;
  const start = html.indexOf('"', i + 8) + 1;
  const capat = html.indexOf('"', start);
  let d;
  try { d = JSON.parse(dezescapa(html.slice(start, capat))); } catch { return null; }
  const spec = (k) => d.specs?.[k]?.values?.ro?.[0] ?? null;
  return {
    titlu: d.title_ro || d.title || null,
    autor: curataAutor(Object.values(d.authors ?? {})
      .map((a) => (a.full_name || a.name || "").trim()).filter(Boolean).join(", ")),
    editura: d.publisher?.title ?? null,
    an: spec("an-aparitie"),
    pagini: numar(spec("pagini")),
    format: spec("format"),
    coperta_tip: spec("tip-coperta"),
    isbn: d.isbn || null,
    descriere: scurteaza(text(d.desc_long_ro || d.desc_short_ro)),
    imagine: d.image_versions?.large || d.image_versions?.small || null,
    categorie: d.categories_tree?.at(-1)?.title ?? null,
  };
}

/** Din ce da JSON-LD-ul drept poza (sir, obiect sau lista) scoate o adresa. */
const poza = (x) => {
  const unul = Array.isArray(x) ? x[0] : x;
  const u = typeof unul === "string" ? unul : (unul?.url ?? unul?.contentUrl ?? null);
  return typeof u === "string" && /^https?:/.test(u) ? u : null;
};

/**
 * Coada de reclama din titlul unei pagini de magazin. Se taie ce e dupa „|" si, dupa
 * liniuta, numai daca ce urmeaza chiar suna a magazin (numele lui, „.ro", „librăria").
 * Restul se lasa in pace: multe titluri au liniuta in ele, iar volumul sta tocmai acolo.
 */
const faraReclama = (t) => t
  .replace(/\s*\|\s*[^|]{1,60}$/, "")
  .replace(/\s+[-–—]\s+[^-–—]{0,60}?(\.ro|c[ăa]r[țt]i bisericesti|libr[ăa]ri[ae][^-–—]{0,25}|editura [^-–—]{0,25}|magazin[^-–—]{0,25}|shop[^-–—]{0,25})\s*$/i, "")
  .replace(/\s+/g, " ").trim();

/** O masura de carte arata a masura: „13x20 cm", „24 × 17,5 cm". Greutatea nu e format. */
const masura = (x) => (x && /\d\s*(x|×|\*)\s*\d/i.test(x) && !/\bkg\b|gram/i.test(x) ? x : null);

/**
 * Pentru celelalte magazine: JSON-LD daca exista (Woo, Drupal Commerce si mai toate il
 * pun), altfel etichetele `og:` si tabelul de caracteristici. Mai putin sigur decat
 * Sophia, de aceea ce iese de aici trece prin aceeasi confirmare.
 */
export function citesteGeneric(html) {
  const ld = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const x = JSON.parse(m[1].trim());
      ld.push(x, ...(Array.isArray(x) ? x : []), ...(x["@graph"] ?? []));
    } catch { /* sarim */ }
  }
  // Tipul se compara INTREG, nu pe bucati: „BookStore" nu e „Book". (Credința
  // Strămoșească isi declara magazinul asa, si fisa lua numele magazinului drept titlu.)
  const fel = (x) => (Array.isArray(x?.["@type"]) ? x["@type"] : [x?.["@type"]]).map(String);
  const prod = ld.find((x) => x && fel(x).some((t) => t === "Product" || t === "Book" || t === "IndividualProduct"));
  // Campurile cu eticheta, in doua feluri de a fi scrise:
  //  „Pagini: 320", „Autor: </b> <a …>Nume</a>"     -> camp()
  //  „<div class=…label>Autor</div><div>Nume</div>" -> campTag() (Agapis, Drupal)
  const camp = (eticheta) => {
    const re = new RegExp(`(?:${eticheta})\\s*:\\s*(?:<[^>]*>\\s*){0,3}([^<\\n]{1,80})`, "i");
    const x = dezescapa(html.match(re)?.[1] ?? "").trim();
    return x && /[\p{L}\p{N}]/u.test(x) ? x : null;
  };
  const campTag = (eticheta) => {
    const re = new RegExp(`>\\s*(?:${eticheta})\\s*:?\\s*<\\/[a-z]+>\\s*(?:<[^>]*>\\s*){0,3}([^<\\n]{1,80})`, "i");
    const x = dezescapa(html.match(re)?.[1] ?? "").trim();
    return x && /[\p{L}\p{N}]/u.test(x) ? x : null;
  };
  const oricare = (eticheta) => camp(eticheta) ?? campTag(eticheta);
  const descr = prod?.description ?? og(html, "description");
  const autor = curataAutor((Array.isArray(prod?.author) ? prod.author : [prod?.author])
    .map((a) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", "))
    ?? curataAutor(oricare("Autori?"));
  let titlu = faraReclama(dezescapa(prod?.name
    ?? html.match(/<h1[^>]*(?:product_title|entry-title|page-title)[^>]*>([^<]{3,200})/i)?.[1]
    ?? og(html, "title") ?? ""));
  // Unele magazine lipesc autorul la coada titlului („Cartea fiintelor imaginare -
  // Jorge Luis Borges"). Se taie, altfel numele lui, fiind rar, trage confirmarea in jos.
  const taiere = Math.max(titlu.lastIndexOf(" - "), titlu.lastIndexOf(" – "));
  if (autor && taiere > 8) {
    const coada = plat(titlu.slice(taiere + 3));
    // Coada e „numele autorului" daca tine unul din cuvintele lui lungi si nu e mai
    // lunga decat titlul ramas (ca sa nu ciuntim un titlu cu liniuta in el).
    const aleAutorului = new Set(plat(autor).split(/[^a-z0-9]+/).filter((x) => x.length >= 4));
    const aleCozii = coada.split(/[^a-z0-9]+/).filter((x) => x.length >= 4);
    const cate = aleCozii.filter((x) => aleAutorului.has(x)).length;
    // Se taie numai daca coada e, in cea mai mare parte, chiar numele omului. „Filocalia
    // - vol. 1" n-are niciun cuvant al autorului in coada, deci ramane intreaga.
    if (aleCozii.length && cate / aleCozii.length >= 0.5) titlu = titlu.slice(0, taiere).trim();
  }
  return {
    titlu: titlu || null,
    autor,
    editura: (typeof prod?.brand === "string" ? prod.brand : prod?.brand?.name) ?? oricare("Editur[ăa]"),
    an: oricare("An(?:ul)? (?:apari[țt]iei|apari[țt]ie)") ?? oricare("An apari[țt]ie"),
    pagini: numar(prod?.numberOfPages ?? oricare("(?:Nr\\.? )?[Pp]agini") ?? oricare("Num[ăa]r (?:de )?pagini")),
    format: masura(oricare("Format")) ?? masura(oricare("Dimensiuni")),
    coperta_tip: oricare("Tip cop(?:ert[ăa])?") ?? oricare("Cop(?:ert[ăa])"),
    isbn: prod?.isbn ?? oricare("ISBN"),
    descriere: scurteaza(text(descr)),
    imagine: poza(prod?.image) ?? og(html, "image"),
    categorie: null,
  };
}

/**
 * Predania isi scrie fisa cu clase in romaneste (`span.autor`, `span.pag`, `span.dim`)
 * si — lucrul pentru care userul a cerut-o anume — pune si CARTEA IN PDF, gratuit,
 * la `/prod_pdf/…`. Unele fisiere sunt goale sau lipsesc chiar la ei; asta se vede abia
 * la descarcare, nu de aici.
 */
export function citestePredania(html) {
  const titlu = dezescapa(html.match(/<h1><strong>([\s\S]*?)<\/strong>/)?.[1] ?? "")
    .replace(/<[^>]*>/g, "").trim();
  if (!titlu) return null;
  const dupa = (re) => dezescapa(html.match(re)?.[1] ?? "").replace(/<[^>]*>/g, "").trim() || null;
  let descriere = null;
  const i = html.indexOf("<h2>Descriere");
  if (i > 0) {
    const j = html.indexOf("<h2>", i + 5);
    descriere = scurteaza(text(html.slice(i + 13, j > 0 ? j : i + 6000)));
  }
  return {
    titlu,
    autor: curataAutor(dupa(/<span class="autor"><strong>Autor:<\/strong>([^<]*)/)),
    editura: "Predania",
    an: null,
    pagini: numar(dupa(/<span class="pag"><strong>Nr\. pagini:<\/strong>([^<]*)/)),
    format: dupa(/<span class="dim"><strong>Format:<\/strong>([^<]*)/),
    coperta_tip: null,
    isbn: null,
    descriere,
    imagine: html.match(/<img src="(\/poze_prod_m\/[^"]+)"/)?.[1]
      ? "https://predania.ro" + html.match(/<img src="(\/poze_prod_m\/[^"]+)"/)[1] : null,
    categorie: null,
    pdf: html.match(/href="(\/prod_pdf\/[^"]+)"/)?.[1]
      ? "https://predania.ro" + html.match(/href="(\/prod_pdf\/[^"]+)"/)[1] : null,
  };
}

/**
 * Libraria Bizantina (OpenCart): autorul si editura stau intr-o lista de sub titlu,
 * „<li><strong>Autor:</strong> <a…>Nume</a></li>". Poza aratata e taiata la 400 px de
 * ei (`image/cache/…-400x400.jpg`); originalul sta la aceeasi cale fara `cache/` si
 * fara sufix, asa ca il cerem pe acela si o pastram pe cealalta ca rezerva.
 */
export function citesteBizantina(html) {
  const lista = (eticheta) => {
    const m = html.match(new RegExp(`<strong>\\s*${eticheta}\\s*:\\s*<\\/strong>([\\s\\S]{0,200}?)<\\/li>`, "i"));
    return m ? dezescapa(m[1].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() || null : null;
  };
  const mica = og(html, "image");
  const mare = mica?.includes("/image/cache/")
    ? mica.replace("/image/cache/", "/image/").replace(/-\d+x\d+(\.[a-z]+)$/i, "$1") : null;
  return {
    titlu: dezescapa(og(html, "title") ?? html.match(/<h1[^>]*heading-product">([^<]*)/)?.[1] ?? "").trim() || null,
    autor: curataAutor(lista("Autor")),
    editura: lista("Editura"),
    an: lista("An apari[țt]ie"),
    pagini: numar(lista("(?:Nr\\.? )?[Pp]agini")),
    format: lista("Format"),
    coperta_tip: lista("Cop(?:ert[ăa])"),
    isbn: lista("ISBN"),
    descriere: scurteaza(text((og(html, "description") ?? "").replace(/^[^]*Libraria Bizantina/i, "").trim())),
    imagine: mare ?? mica,
    imagine_rezerva: mare ? mica : null,
    categorie: null,
  };
}

/** Doxologia (Drupal): autorul e un link `/autor/…`, restul in campuri `field-…`. */
export function citesteDoxologia(html) {
  const camp = (nume) => {
    const m = html.match(new RegExp(`field-name-field-${nume}[\\s\\S]{0,300}?field-item[^>]*>([^<]{1,80})`, "i"));
    return m ? dezescapa(m[1]).trim() || null : null;
  };
  return {
    titlu: dezescapa(og(html, "title") ?? "").trim() || null,
    autor: curataAutor(dezescapa(html.match(/id="carte-autor"[^>]*>\s*<a[^>]*>([^<]*)/)?.[1] ?? "")),
    editura: "Doxologia",
    an: camp("an(?:ul)?-apari[a-z-]*"),
    pagini: numar(camp("numar-pagini")),
    format: camp("format"),
    coperta_tip: null,
    isbn: camp("isbn"),
    descriere: scurteaza(text(og(html, "description"))),
    imagine: og(html, "image"),
    categorie: null,
  };
}

/**
 * Targul Cartii — agregator de anticariate. Aici sta nadejdea pentru cartile din
 * 1925–1995, epuizate, pe care niciun magazin nou nu le mai are.
 *
 * O pagina tine TOATE editiile aceleiasi carti, iar numele fisierului fiecarei poze
 * spune a cui e editia: `…-valoarea-sufletului-bunavestire1994-l-135567-228x280.JPG`.
 * De aceea cititorul primeste si cartea noastra: alege poza editiei care se potriveste
 * cu editura si anul din tabelul parohiei, si abia daca nu gaseste ia prima poza.
 */
export function citesteTargulCartii(html, carte) {
  const t = dezescapa(og(html, "title") ?? "").replace(/\s*-\s*TargulCartii\.ro\s*$/i, "").trim();
  if (!t) return null;
  const bucati = t.split(" - ");
  const autor = bucati.length > 1 ? bucati.pop().trim() : null;
  const poze = [...new Set([...html.matchAll(/src="((?:https:\/\/www\.targulcartii\.ro)?\/galerie\/cache\/[^"]+\.(?:jpe?g|png|avif|webp))"/gi)]
    .map((m) => (m[1].startsWith("http") ? m[1] : "https://www.targulcartii.ro" + m[1])))];
  let aleasa = null;
  if (carte && poze.length) {
    const ed = plat(carte.editura ?? "").replace(/[^a-z0-9]+/g, "");
    const an = String(carte.an ?? "").match(/\d{4}/)?.[0];
    const scor = (p) => {
      const f = plat(p).replace(/[^a-z0-9]+/g, "");
      return (ed && ed.length >= 4 && f.includes(ed.slice(0, 8)) ? 2 : 0) + (an && f.includes(an) ? 1 : 0);
    };
    aleasa = poze.slice().sort((a, b) => scor(b) - scor(a))[0];
    if (scor(aleasa) === 0) aleasa = poze[0];
  }
  return {
    titlu: bucati.join(" - ").trim() || null,
    autor: curataAutor(autor),
    editura: null,
    an: null,
    pagini: null,
    format: null,
    coperta_tip: null,
    isbn: null,
    descriere: null,
    imagine: aleasa ?? null,
    categorie: null,
  };
}

/**
 * Anticariat-unu: titlul lor e cum a fost scris pe fisa de raft — cu autorul, anul si
 * starea exemplarului la un loc („MARTURII … de IEROD. CLEOPA PARASCHIV , 2018,
 * PREZINTA MICI SUBLINIERI *"). Se curata la titlu adevarat, iar din descriere
 * („EDITURA PANAGHIA , 302 PAGINI , COPERTA BROSATA") ies editura si paginile.
 */
export function citesteAnticariat(html) {
  let t = dezescapa(og(html, "title") ?? "").trim();
  if (!t) return null;
  t = t.replace(/\s*[*]+\s*$/, "")
       .replace(/\s*,\s*(prezinta|contine|are|cu)\s[^,]*$/i, "")
       .replace(/\s*,\s*(19|20)\d\d\s*$/, "")
       .replace(/\s+(de|DE)\s+[^,]{3,60}(?=\s*(,|$))/, "")
       .trim();
  const autor = curataAutor(dezescapa(
    html.match(/Autor:\s*<\/div>\s*<div[^>]*>([^<]{2,80})/i)?.[1]
    ?? html.match(/Autor:\s*(?:<[^>]*>\s*){0,3}([^<\n]{2,80})/i)?.[1] ?? ""));
  const desc = text(html.match(/Descriere\s*<\/[a-z]+>([\s\S]{0,600})/i)?.[1] ?? "");
  return {
    titlu: t,
    autor,
    editura: desc.match(/EDITURA\s+([A-ZĂÂÎȘȚ][^,\n]{2,40})/i)?.[1]?.trim() ?? null,
    an: dezescapa(og(html, "title") ?? "").match(/\b(19|20)\d\d\b/)?.[0] ?? null,
    pagini: numar(desc.match(/(\d{2,4})\s*PAGINI/i)?.[1]),
    format: null,
    coperta_tip: desc.match(/COPERTA\s+([A-ZĂÂÎȘȚa-z]{4,12})/i)?.[1] ?? null,
    isbn: null,
    descriere: null,
    imagine: og(html, "image"),
    categorie: null,
  };
}

/**
 * Editura Mitropoliei Olteniei: un WordPress vechi, o pagina pe carte, titlul paginii
 * scris „Autor, Titlul cartii". Anul si ISBN-ul stau in textul de sub poza
 * („Ed. Mitropolia Olteniei, Craiova, 2007, ISBN 978-…").
 */
export function citesteOltenia(html) {
  const h = dezescapa(html.match(/<h1 class="entry-title">([^<]*)/)?.[1] ?? "").trim();
  if (!h) return null;
  const virgula = h.indexOf(", ");
  const autor = virgula > 0 && virgula < h.length - 8 ? h.slice(0, virgula) : null;
  const titlu = virgula > 0 ? h.slice(virgula + 2) : h;
  const corp = text(html.match(/entry-content[^>]*>([\s\S]{0,4000})/)?.[1] ?? "");
  return {
    titlu: titlu.trim() || null,
    autor: curataAutor(autor),
    editura: "Mitropolia Olteniei",
    an: corp.match(/,\s*((?:19|20)\d\d)\s*,\s*ISBN/)?.[1] ?? null,
    pagini: null,
    format: null,
    coperta_tip: null,
    isbn: corp.match(/ISBN\s*([\d-]{10,20})/)?.[1] ?? null,
    descriere: scurteaza(corp),
    imagine: html.match(/src="(https:\/\/editura-mitropoliaolteniei\.ro\/[^"]*wp-content\/uploads\/[^"]+\.(?:jpe?g|png))"/i)?.[1] ?? null,
    categorie: null,
  };
}

/* --------------------------------------------------- culesul fara sitemap ---- */

/**
 * Predania nu are nici sitemap, nici paginare: `/biblioteca` arata o singura pagina
 * („Pagina: 1"), iar restul cartilor stau in sectiunile din meniu — Duhovnici, Vietile
 * Sfintilor, Velimirovici, Praxis, Bernea, Martor, Anne, Tineri, Copii. Deci se ia
 * meniul din prima pagina si se umbla sectiune cu sectiune.
 */
async function* culegePredania(adu, dorm, s) {
  const acasa = await adu(`${s.gazda}/`);
  await dorm(s.pauza);
  const sectiuni = new Set(["biblioteca", "noutati"]);
  for (const m of (acasa ?? "").matchAll(/<a href="\/([a-z0-9-]{3,40})"([^>]*)>([^<]{3,40})<\/a>/g)) {
    if (/produs|pdf/.test(m[2])) continue;                    // linkurile cartilor, nu ale sectiunilor
    if (/^(gdpr|politica|termeni|contact|client|index|misiune|proiecte|despre)/.test(m[1])) continue;
    sectiuni.add(m[1]);
  }
  const vazute = new Set();
  for (const sec of sectiuni) {
    const html = await adu(`${s.gazda}/${sec}`);
    await dorm(s.pauza);
    if (!html) continue;
    for (const m of html.matchAll(/<a href="\/([a-z0-9-]+)" class="produs-titlu"[^>]*><strong>([^<]*)<\/strong>/g)) {
      if (vazute.has(m[1])) continue;
      vazute.add(m[1]);
      yield { url: `${s.gazda}/${m[1]}`, titlu: dezescapa(m[2]) };
    }
  }
}

/** Doxologia: `/carti?page=0…`, titlurile sunt linkurile cu `class="prod-title-r"`. */
async function* culegeDoxologia(adu, dorm, s) {
  const vazute = new Set();
  for (let n = 0; n <= 80; n++) {
    const html = await adu(`${s.gazda}/carti?page=${n}`);
    if (!html) break;
    let noi = 0;
    for (const m of html.matchAll(/<a href="\/([a-z0-9-]+)" class="prod-title-r"[^>]*>\s*([^<]*)/g)) {
      if (vazute.has(m[1])) continue;
      vazute.add(m[1]); noi++;
      yield { url: `${s.gazda}/${m[1]}`, titlu: dezescapa(m[2]).trim() || m[1].replace(/-/g, " ") };
    }
    if (!noi) break;
    await dorm(s.pauza);
  }
}

/**
 * Libraria Bizantina n-are sitemap, dar are lista editurilor, si fiecare editura isi
 * are paginile ei. Se umbla pe acolo, editura cu editura — 240 de edituri, cate doua-trei
 * pagini fiecare. Dureaza vreo jumatate de ceas si nu supara pe nimeni: o cerere la 2 s.
 */
async function* culegeBizantina(adu, dorm, s) {
  const acasa = await adu(`${s.gazda}/lista-edituri`);
  await dorm(s.pauza);
  const edituri = [...new Set([...(acasa ?? "").matchAll(/href="(https:\/\/www\.librariabizantina\.ro\/editura-[^"?#]+)"/g)]
    .map((m) => m[1]))];
  for (const e of edituri) {
    const vazute = new Set();
    for (let n = 1; n <= 40; n++) {
      const html = await adu(n === 1 ? e : `${e}?page=${n}`);
      await dorm(s.pauza);
      if (!html) break;
      let noi = 0;
      for (const m of html.matchAll(/<h4[^>]*product-name"><a href="([^"]+)" title="([^"]*)"/g)) {
        if (vazute.has(m[1])) continue;
        vazute.add(m[1]); noi++;
        yield { url: m[1], titlu: dezescapa(m[2]) };
      }
      if (!noi) break;
    }
  }
}

/** Mitropolia Olteniei: toate cartile stau ca ancore in meniul din prima pagina. */
async function* culegeOltenia(adu, dorm, s) {
  const html = await adu(`${s.gazda}/`);
  if (!html) return;
  for (const m of html.matchAll(/<a href="(https:\/\/editura-mitropoliaolteniei\.ro\/\?page_id=\d+)"[^>]*>([^<]{8,160})</g)) {
    const t = dezescapa(m[2]).trim();
    // Sar peste randurile de meniu: anii, colectiile, redactia. O carte are „Autor, Titlu".
    if (/^(anul\s|colec|carte |agend|cd ?\/|redac|colectivul|biblioteci)/i.test(plat(t))) continue;
    if (!t.includes(", ") && t.length < 30) continue;
    yield { url: m[1], titlu: t.includes(", ") ? t.slice(t.indexOf(", ") + 2) : t };
  }
}

/* ---------------------------------------------------------------- sursele ---- */

const wooLista = (n, prefix, gazda) => Array.from({ length: n }, (_, i) =>
  `${gazda}/${prefix}${i === 0 ? "" : i + 1}.xml`);

export const SURSE = {
  sophia: {
    nume: "Librăria Sophia",
    gazda: "https://www.librariasophia.ro",
    sitemapuri: ["https://www.librariasophia.ro/sitemap-carti.xml"],
    pauza: 1500,
    titluDinUrl: (u) => u.split("/").pop().replace(/\.html$/, "").replace(/-\d+$/, "").replace(/-/g, " "),
    citeste: citesteSophia,
  },
  deisis: {
    nume: "Editura Deisis",
    gazda: "https://edituradeisis.ro",
    sitemapuri: ["https://edituradeisis.ro/product-sitemap.xml"],
    pauza: 2000,
    doarUrl: /\/magazin\/.+/,
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },
  evanghelismos: {
    nume: "Editura Evanghelismos",
    gazda: "https://evanghelismos.ro",
    sitemapuri: [1, 2, 3, 4, 5].map((n) => `https://evanghelismos.ro/product-sitemap${n === 1 ? "" : n}.xml`),
    pauza: 2000,
    doarUrl: /\/carte\/.+/,
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },
  egumenita: {
    nume: "Editura Egumenița",
    gazda: "https://www.egumenita.ro",
    sitemapuri: ["https://egumenita.ro/sitemap.xml"],
    pauza: 2000,
    doarUrl: /\/produse\/detalii\/.+/,
    titluDinUrl: (u) => dinUrl(u).replace(/^\d+ /, ""),
    citeste: citesteGeneric,
  },

  /* --- adaugate 7 sept. 2026, la cererea userului („cat mai multe cu coperta") --- */

  predania: {
    nume: "Editura Predania",
    gazda: "https://predania.ro",
    pauza: 2500,
    culege: culegePredania,
    citeste: citestePredania,
    /** Singura sursa care da si cartea intreaga, gratuit. Vezi `pasAdu`. */
    cuPdf: true,
  },
  doxologia: {
    nume: "Editura Doxologia",
    gazda: "https://edituradoxologia.ro",
    // Sitemapul lor n-are cartile (doar autori si teme) — se umbla prin `/carti?page=N`.
    // 10 s intre cereri: chiar asa scrie in robots.txt (`Crawl-delay: 10`).
    pauza: 10000,
    culege: culegeDoxologia,
    citeste: citesteDoxologia,
  },
  bizantina: {
    nume: "Librăria Bizantină",
    gazda: "https://www.librariabizantina.ro",
    pauza: 2000,
    culege: culegeBizantina,
    citeste: citesteBizantina,
  },
  basilica: {
    nume: "Librăria Cărților Bisericești",
    gazda: "https://cartibisericesti.ro",
    sitemapuri: wooLista(8, "product-sitemap", "https://cartibisericesti.ro").map((u) =>
      u.replace("product-sitemap.xml", "product-sitemap1.xml")),
    pauza: 2000,
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },
  colportaj: {
    nume: "Colportaj — Arhiepiscopia Bucureștilor",
    gazda: "https://colportaj.ro",
    sitemapuri: wooLista(8, "product-sitemap", "https://colportaj.ro"),
    pauza: 2000,
    doarUrl: /\/produs\/.+/,
    titluDinUrl: (u) => dinUrl(u).replace(/ \d{3,6}$/, ""),
    titluCurat: (t) => t.replace(/\s+\d{4,6}$/, ""),
    citeste: citesteGeneric,
  },
  agapis: {
    nume: "Editura Agapis",
    gazda: "https://www.edituraagapis.ro",
    sitemapuri: ["https://www.edituraagapis.ro/sitemap_products.xml"],
    pauza: 5000,             // robots.txt: Crawl-delay 5
    doarUrl: /\/cumpara\/.+/,
    titluDinUrl: (u) => dinUrl(u).replace(/( r\d+)? \d{1,5}$/, ""),
    citeste: citesteGeneric,
  },
  areopag: {
    nume: "Editura Areopag",
    gazda: "https://areopag.ro",
    sitemapuri: ["https://areopag.ro/wp-sitemap-posts-product-1.xml"],
    pauza: 2000,
    doarUrl: /\/magazin\/.+/,
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },
  credinta: {
    nume: "Editura Credința Strămoșească",
    gazda: "https://credinta-stramoseasca.ro",
    sitemapuri: ["https://credinta-stramoseasca.ro/product-sitemap.xml"],
    pauza: 2000,
    doarUrl: /\/shop\/.+/,
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },
  reintregirea: {
    nume: "Editura Reîntregirea",
    gazda: "https://editurareintregirea.ro",
    sitemapuri: ["https://editurareintregirea.ro/sitemap.xml"],
    pauza: 3000,
    // Sitemapul lor tine la un loc si revista (`/nr-…`), si articolele, si cartile.
    doarUrl: /^https:\/\/editurareintregirea\.ro\/(?!nr-|articole\/|catalog|lista-|despre|contact|cum-comand|livrarea|modalitati|termeni|politica|procedura|scara)[a-z0-9-]{6,}$/,
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },
  oltenia: {
    nume: "Editura Mitropolia Olteniei",
    gazda: "https://editura-mitropoliaolteniei.ro",
    pauza: 3000,
    culege: culegeOltenia,
    citeste: citesteOltenia,
  },
  printrecarti: {
    nume: "Printre Cărți",
    gazda: "https://www.printrecarti.ro",
    sitemapuri: ["https://www.printrecarti.ro/sitemap.xml"],
    pauza: 2000,
    doarUrl: /\/\d+-[a-z0-9-]+\.html$/,
    // Slugul lor incepe cu numele autorului: „16326-rodica-ojog-brasoveanu-anonima-de-miercuri".
    titluDinUrl: (u) => dinUrl(u).replace(/^\d+ /, ""),
    citeste: citesteGeneric,
  },
  litera: {
    nume: "Editura Litera",
    gazda: "https://www.litera.ro",
    sitemapuri: ["https://www.litera.ro/sitemap-produse1.xml"],
    pauza: 7000,             // robots.txt: Crawl-delay 7
    titluDinUrl: dinUrl,
    citeste: citesteGeneric,
  },

  /* --- agregatoarele: ultima nadejde pentru cartile epuizate din 1925–1995 --- */

  libris: {
    nume: "Libris",
    gazda: "https://www.libris.ro",
    // Sitemapul lor are 426 de bucati, dar 362 sunt carti in engleza: noua ne trebuie
    // cele 27 romanesti (~54.000 de titluri). Aici stau editurile laice din raft —
    // Humanitas, Litera, Nemira, Minerva, Dacia — si reeditarile.
    sitemapuri: Array.from({ length: 27 }, (_, i) =>
      `https://www.libris.ro/sitemap-carte.xml?nofilename=on&page=${i + 1}`),
    pauza: 2000,
    doarUrl: /\/carte\/[^/]+\/\d+$/,
    // Slugul lor tine si numele autorilor dupa titlu; IDF-ul le ingroapa singur.
    titluDinUrl: (u) => u.split("/").filter(Boolean).slice(-2, -1)[0].replace(/-/g, " "),
    citeste: citesteGeneric,
  },

  targulcartii: {
    nume: "Târgul Cărții",
    gazda: "https://www.targulcartii.ro",
    sitemapuri: ["https://www.targulcartii.ro/sitemap_opere.xml"],
    pauza: 20000,            // robots.txt: Crawl-delay 20. Incet, dar viteza nu conteaza.
    doarUrl: /^https:\/\/www\.targulcartii\.ro\/[a-z0-9-]+\/[a-z0-9-]+$/,
    titluDinUrl: dinUrl,
    citeste: citesteTargulCartii,
  },
  anticariat: {
    nume: "Anticariat Unu",
    gazda: "https://www.anticariat-unu.ro",
    sitemapuri: ["https://www.anticariat-unu.ro/sitemap.xml"],
    pauza: 2000,
    doarUrl: /-p\d+$/,
    // Slugul lor tine si autorul, si anul, si starea exemplarului. Se taie ce se poate.
    titluDinUrl: (u) => dinUrl(u)
      .replace(/ p\d+$/, "")
      .replace(/ (de|dupa) [a-z0-9 ]{3,40}$/, "")
      .replace(/ (19|20)\d\d.*$/, "")
      .trim(),
    citeste: citesteAnticariat,
  },
};
