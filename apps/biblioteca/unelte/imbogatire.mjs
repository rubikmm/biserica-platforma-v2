/**
 * A12 · Imbogatirea catalogului cu ce arata magazinele si editurile online.
 *
 * Catalogul parohiei stie doar atat: titlu, autor, editura, an, loc, cate bucati.
 * Fisa unei carti arata sarac fara coperta si fara doua randuri despre ce e inauntru.
 * Unealta asta cauta fiecare titlu la librariile ortodoxe si aduce ce gaseste:
 * coperta, cate pagini, o descriere, ISBN, formatul — iar de la Predania si CARTEA
 * INTREAGA IN PDF, pe care ei o dau gratuit (cerere user, 7 sept. 2026).
 *
 * Merge in patru pasi, fiecare relubil de unde a ramas — nu se reia tot degeaba:
 *
 *   node unelte/imbogatire.mjs index [sursa…]   listele lor -> lista locala de titluri
 *   node unelte/imbogatire.mjs potriveste       catalogul nostru x listele lor -> potriviri.json
 *   node unelte/imbogatire.mjs adu [cate] [--iar]  aduce fisele potrivite, incet si politicos
 *   node unelte/imbogatire.mjs strange          fisele -> imbogatire.json (+ coperti, + pdf)
 *   node unelte/imbogatire.mjs stare            cat s-a strans pana acum
 *   node unelte/imbogatire.mjs proba <sursa> <url>   ce citeste cititorul dintr-o pagina
 *
 * DATELE DIN CATALOG NU SE ATING. Tot ce se aduce sta deoparte, in `imbogatire.json`,
 * legat de carte prin slug. O extragere noua din site-ul vechi nu strica nimic, iar
 * daca imbogatirea se sterge cu totul, catalogul ramane intreg.
 *
 * POLITETEA nu e optionala: un singur fir, pauza intre cereri (cea ceruta de robots.txt
 * acolo unde e ceruta), User-Agent care spune cine suntem si de ce batem la usa.
 * Sursele si cititorii lor stau in `unelte/librarii.mjs` — aici e doar mersul lucrului.
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { seamana, seamanaOricum, greutati, jetoane, numeDeFamilie, acelasiNume } from "./potrivire.mjs";
import { SURSE } from "./librarii.mjs";

const ACASA = "/data/imbogatire";
const CATALOG = "/data/catalog/catalog.json";
const UA = "biblioteca-sfantul-ilie/1.0 (catalogul bibliotecii parohiei Sfantul Ilie; " +
           "+https://biblioteca.sfantul-ilie.ro/despre-imbogatire)";

/* ------------------------------------------------------------- ajutoarele ---- */

const dorm = (ms) => new Promise((r) => setTimeout(r, ms));
const citesteJson = async (cale, altfel = null) =>
  existsSync(cale) ? JSON.parse(await readFile(cale, "utf8")) : altfel;
const scrieJson = (cale, x) => writeFile(cale, JSON.stringify(x, null, 1));

/** Cerere cu rabdare: reincearca de trei ori, cu pauza tot mai lunga. */
async function adu(url, { binar = false, incercari = 3, pauza = 2000 } = {}) {
  for (let i = 1; i <= incercari; i++) {
    try {
      const r = await fetch(url, {
        headers: { "user-agent": UA, "accept-language": "ro,en;q=0.7" },
        signal: AbortSignal.timeout(binar ? 120000 : 30000),
      });
      if (r.status === 404 || r.status === 410) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return binar ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      if (i === incercari) { console.error("  ! " + url + " — " + e.message); return null; }
      await dorm(pauza * i);
    }
  }
}

/* ------------------------------------------------------------- pasul INDEX --- */

async function pasIndex(care) {
  await mkdir(`${ACASA}/index`, { recursive: true });
  for (const [id, s] of Object.entries(SURSE)) {
    if (care.length && !care.includes(id)) continue;
    const locuri = new Map();
    if (s.culege) {
      // Sursa fara sitemap isi umbla singura paginile de lista, in ritmul ei.
      for await (const x of s.culege(adu, dorm, s)) {
        const t = (x.titlu ?? "").trim();
        if (t.length > 2 && !locuri.has(t)) locuri.set(t, x.url);
        if (locuri.size % 250 === 0 && locuri.size) process.stdout.write(`\r${id}: ${locuri.size} titluri…`);
      }
      if (locuri.size) process.stdout.write("\r");
    } else {
      for (const sm of s.sitemapuri) {
        const xml = await adu(sm);
        if (!xml) { console.log(`${id}: lista ${sm} n-a raspuns`); continue; }
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
          const u = m[1].trim().replace(/&amp;/g, "&");
          if (s.doarUrl && !s.doarUrl.test(u)) continue;
          const t = s.titluDinUrl(u);
          if (t && t.length > 2 && !locuri.has(t)) locuri.set(t, u);
        }
        await dorm(s.pauza);
      }
    }
    const lista = [...locuri].map(([titlu, url]) => ({ titlu, url }));
    if (!lista.length) { console.log(`${id}: NIMIC — indexul vechi ramane cum era`); continue; }
    await scrieJson(`${ACASA}/index/${id}.json`, lista);
    console.log(`${id}: ${lista.length} titluri in index`);
  }
}

/* -------------------------------------------------------- pasul POTRIVESTE --- */

/**
 * Peste pragul asta potrivirea se ia in seama; sub el nici nu se incearca. E JOS
 * dinadins (0.60): titlul din lista lor vine din adresa paginii — ciuntit, fara
 * diacritice, uneori fara subtitlu — deci scorul de aici e mereu mai mic decat cel
 * adevarat. Paza nu sta aici, ci la confirmarea de dupa aducere: 0.80 pe titlul
 * intreg si autorul care trebuie sa fie acelasi.
 */
const PRAG_ADU = 0.60;
/** Cate usi se bat cel mult pentru o carte, si cate la aceeasi sursa. */
const CEL_MULT = 12, PE_SURSA = 2;

async function pasPotriveste() {
  const cat = JSON.parse(await readFile(CATALOG, "utf8"));
  const lor = [];
  for (const id of Object.keys(SURSE)) {
    const l = await citesteJson(`${ACASA}/index/${id}.json`, []);
    for (const x of l) lor.push({ ...x, sursa: id });
  }
  if (!lor.length) throw new Error("indexul e gol — ruleaza intai pasul „index”");
  const idf = greutati(lor.map((x) => x.titlu));

  // Index invers pe jetoane, ca sa nu comparam fiecare titlu cu toate cele 150.000.
  const unde = new Map();
  lor.forEach((x, i) => {
    x.j = new Set(jetoane(x.titlu));
    for (const t of x.j) { let a = unde.get(t); if (!a) unde.set(t, a = []); a.push(i); }
  });

  const potriviri = [];
  for (const c of cat.carti) {
    const A = new Set(jetoane(c.titlu));
    if (!A.size) continue;
    // Cuvintele care apar peste tot („sfantul", „viata") ar aduce zeci de mii de
    // candidati pentru nimic, asa ca de obicei se sar. Dar o carte al carei titlu e
    // FACUT numai din cuvinte de-astea („Vietile sfintilor") ar ramane fara niciun
    // candidat — pentru ea se cauta a doua oara, fara pragul asta.
    const aduna = (prag) => {
      const c = new Set();
      for (const t of A) {
        const a = unde.get(t);
        if (a && a.length <= prag) for (const i of a) c.add(i);
      }
      return c;
    };
    let candidati = aduna(4000);
    if (!candidati.size) candidati = aduna(40000);
    // Cele mai bune doua din fiecare sursa: daca prima nu se confirma, o incearcam pe a doua.
    const scoruri = [];
    for (const i of candidati) {
      // Titlul intreg sau o bucata a lui — capul dinaintea parantezei ori subtitlului
      // (`variante` din potrivire.mjs, 8 sept. 2026). Bucata se tine minte pe candidat:
      // fisa adusa asa nu intra singura in foaie, ci merge la om, in /propuneri.
      const { scor: s, varianta } = seamanaOricum(c.titlu, lor[i].titlu, idf);
      if (s >= PRAG_ADU) scoruri.push({ i, s, varianta });
    }
    scoruri.sort((a, b) => b.s - a.s);
    const pe_sursa = new Map();
    const alese = [];
    for (const { i, s, varianta } of scoruri) {
      const n = pe_sursa.get(lor[i].sursa) ?? 0;
      if (n >= PE_SURSA) continue;
      pe_sursa.set(lor[i].sursa, n + 1);
      alese.push({ url: lor[i].url, sursa: lor[i].sursa, titluLor: lor[i].titlu, scor: Number(s.toFixed(3)),
                   ...(varianta ? { varianta } : {}) });
      if (alese.length >= CEL_MULT) break;
    }
    if (alese.length) potriviri.push({ slug: c.slug, titlu: c.titlu, autor: c.autor, editura: c.editura, an: c.an, alese });
  }
  await scrieJson(`${ACASA}/potriviri.json`, potriviri);
  const sigure = potriviri.filter((p) => p.alese[0].scor >= 0.86).length;
  const prinBucata = potriviri.filter((p) => p.alese.every((a) => a.varianta)).length;
  console.log(`potriviri de incercat: ${potriviri.length} / ${cat.carti.length} carti`);
  console.log(`  dintre care cu scor mare (>=0.86): ${sigure}`);
  console.log(`  dintre care numai prin bucata de titlu (cap/coada): ${prinBucata}`);
  console.log(`  de adus, cu tot cu rezerve: ${potriviri.reduce((n, p) => n + p.alese.length, 0)} fise`);
}

/* ---------------------------------------------------------------- pasul ADU -- */

/**
 * Fisa adusa e chiar a cartii noastre? Titlul din lista lor e ciuntit (fara diacritice,
 * fara semne), asa ca abia acum, cu titlul adevarat si cu autorul din fisa, se poate
 * spune. Trei chingi: titlul, omul si anul.
 *
 * Omul nu se iarta pe scor: potrivirea pe jetoane da 1.00 si pe titluri rasturnate
 * („De la moarte la viata" / „Viata dupa moarte"), asa ca un titlu „leit" nu dovedeste
 * nimic despre autor. Ingaduinta e doar la transliterare (`acelasiNume`).
 */
function confirma(carte, fisa, idf) {
  if (!fisa?.titlu) return { bun: false, de_ce: "fisa n-are titlu" };
  // Titlul intreg intai; daca nu trece pragul, bucatile lui (capul dinaintea parantezei
  // sau subtitlului, coada de dupa — `variante`). Potrivirea pe o bucata NU e o potrivire
  // intreaga: fisa se aduce, dar ramane `nehotarat` — o vede omul in /propuneri, sau o
  // hotaraste `propuneri.mjs aproba` cand autorul si editura sunt aceleasi (8 sept. 2026).
  let s = seamana(carte.titlu, fisa.titlu, idf), varianta = null;
  if (s < 0.80) ({ scor: s, varianta } = seamanaOricum(carte.titlu, fisa.titlu, idf));
  if (s < 0.80) return { bun: false, de_ce: `titlul difera (${s.toFixed(2)})`, scor: s };

  const ai = numeDeFamilie(carte.autor), lor = numeDeFamilie(fisa.autor);
  const acelasiOm = acelasiNume(ai, lor);
  if (ai.size && lor.size && !acelasiOm)
    return { bun: false, de_ce: `alt autor (${carte.autor} vs ${fisa.autor})`, scor: s, autorRau: true };

  // Anul se bate cap in cap? Numai cand amandoua sunt un singur an si omul nu e sigur.
  const anN = String(carte.an ?? "").match(/^\d{4}$/)?.[0];
  const anL = String(fisa.an ?? "").match(/\b(1[89]\d\d|20\d\d)\b/)?.[0];
  if (anN && anL && Math.abs(Number(anN) - Number(anL)) > 25 && !acelasiOm)
    return { bun: false, de_ce: `ani prea departati (${anN} vs ${anL})`, scor: s, autorRau: true };

  return { bun: true, scor: Number(s.toFixed(3)), acelasiOm, varianta };
}

/** Coperta se ia de la ei si se tine la noi. Daca poza mare nu vine, se ia cea mica. */
async function aduCoperta(fisa, slug) {
  for (const u of [fisa.imagine, fisa.imagine_rezerva].filter(Boolean)) {
    const bin = await adu(u, { binar: true });
    if (bin && bin.length > 2000) {
      await writeFile(`${ACASA}/coperti/${slug}.jpg`, bin);
      return `${slug}.jpg`;
    }
  }
  return null;
}

/**
 * Cartea intreaga in PDF, acolo unde editura o da singura (Predania). Se cere doar dupa
 * ce fisa s-a confirmat, si se pastreaza numai daca e chiar un PDF cu ceva in el:
 * o parte din fisierele lor sunt goale pe serverul lor (0 octeti) sau lipsesc.
 */
async function aduPdf(url, slug) {
  const bin = await adu(url, { binar: true });
  if (!bin || bin.length < 20000 || bin.subarray(0, 5).toString() !== "%PDF-") return null;
  await writeFile(`${ACASA}/pdfuri/${slug}.pdf`, bin);
  return { pdf: `${slug}.pdf`, pdf_octeti: bin.length };
}

/**
 * „doar" / „fara": la ce usi se bate in trecerea asta. Agregatoarele cer 20 de secunde
 * intre cereri (asa scrie in robots.txt-ul lor), deci o trecere cu ele inauntru tine
 * ore — se face intai recolta ieftina, si abia dupa aceea, separat, cea inceata.
 */
async function pasAdu(cateMax, iar = false, doar = null, fara = null) {
  const seCere = (id) => (!doar || doar.includes(id)) && !(fara && fara.includes(id));
  for (const d of ["fise", "coperti", "pdfuri"]) await mkdir(`${ACASA}/${d}`, { recursive: true });
  const potriviri = await citesteJson(`${ACASA}/potriviri.json`);
  if (!potriviri) throw new Error("nu exista potriviri.json — ruleaza pasul „potriveste”");
  const lor = [];
  for (const id of Object.keys(SURSE)) for (const x of await citesteJson(`${ACASA}/index/${id}.json`, [])) lor.push(x);
  const idf = greutati(lor.map((x) => x.titlu));

  // Hotararile omului, tinute minte peste treceri: cartile la care a spus „nu" in
  // /propuneri nu se mai completeaza de la sine, iar adresele scoase la audit nu se mai
  // aduc. Fara asta, o sursa noua le-ar readuce pe toate, taman pe cele judecate.
  const respins = await citesteJson(`${ACASA}/respins-de-om.json`, {});
  const ultima = new Map();          // cand am batut ultima oara la fiecare usa
  let aduse = 0, sarite = 0, respinse = 0, incercate = 0, pdfuri = 0, nehotarate = 0;

  for (const p of potriviri) {
    const cale = `${ACASA}/fise/${p.slug}.json`;
    // `--iar` (dupa ce apar surse noi): fisele gasite raman cum sunt; doar cartile
    // ramase fara nimic se mai incearca o data, si NUMAI la usile la care n-au batut —
    // sursele care si-au spus parerea nu se mai sacaie cu aceeasi intrebare.
    const dejaIncercate = new Set(), adreseIncercate = new Set();
    let motiveVechi = [];
    // O usa e „neincercata" daca sursa n-a fost intrebata deloc — sau, pentru candidatii
    // veniti prin bucata de titlu (`varianta`, 8 sept. 2026), daca ADRESA anume n-a fost
    // ceruta: sursa poate sa-si fi spus parerea despre alta pagina de-a ei. Adresele
    // cerute se scriu de-acum in motive („… @ url"), ca sa nu se mai bata de doua ori.
    const neincercata = (a) => seCere(a.sursa) && !adreseIncercate.has(a.url) &&
      (a.varianta ? true : !dejaIncercate.has(a.sursa));
    if (existsSync(cale)) {
      if (!iar) { sarite++; continue; }
      const veche = await citesteJson(cale);
      if (veche?.gasit) { sarite++; continue; }
      motiveVechi = veche?.motive ?? [];
      for (const m of motiveVechi) {
        const x = String(m).match(/^([a-z0-9_-]+):/); if (x) dejaIncercate.add(x[1]);
        const u = String(m).match(/ @ (\S+)$/); if (u) adreseIncercate.add(u[1]);
      }
    }
    if (!p.alese.some(neincercata)) { if (existsSync(cale)) sarite++; continue; }
    if (cateMax && incercate >= cateMax) break;
    incercate++;
    let gasit = null, motive = [...motiveVechi], aproape = null;
    const hotarat = respins[p.slug];
    if (hotarat?.tot) {
      await scrieJson(cale, { slug: p.slug, gasit: false, motive: [...motiveVechi,
        `om: ${hotarat.de_ce} (${hotarat.la}) — nu se pune nimic fara o noua hotarare`] });
      sarite++;
      continue;
    }
    for (const a of p.alese) {
      if (!neincercata(a)) continue;
      const la = ` @ ${a.url}`;
      if (hotarat?.url?.includes(a.url)) { motive.push(`${a.sursa}: adresa asta a fost scoasa de om${la}`); continue; }
      const s = SURSE[a.sursa];
      const asteptat = (ultima.get(a.sursa) ?? 0) + s.pauza - Date.now();
      if (asteptat > 0) await dorm(asteptat);
      ultima.set(a.sursa, Date.now());
      const html = await adu(a.url);
      if (!html) { motive.push(`${a.sursa}: pagina n-a raspuns${la}`); continue; }
      let fisa = null;
      try { fisa = s.citeste(html, p); } catch (e) { motive.push(`${a.sursa}: fisa n-a putut fi citita (${e.message})${la}`); continue; }
      if (!fisa) { motive.push(`${a.sursa}: n-am putut citi fisa${la}`); continue; }
      if (s.titluCurat && fisa.titlu) fisa.titlu = s.titluCurat(fisa.titlu);
      const v = confirma(p, fisa, idf);
      if (!v.bun) {
        motive.push(`${a.sursa}: ${v.de_ce}${la}`);
        // Potrivirea care a cazut LA MUSTATA (titlu intre 0.70 si 0.80), si nu din
        // pricina autorului, nu se arunca: se tine deoparte si, daca nimic mai bun nu
        // se gaseste, i se arata omului in /propuneri. El hotaraste, nu unealta.
        if (!aproape && !v.autorRau && (v.scor ?? 0) >= 0.70 && (fisa.imagine || fisa.descriere))
          aproape = { fisa, a, scor: v.scor };
        continue;
      }
      gasit = { ...fisa, sursa: a.sursa, sursa_nume: s.nume, url: a.url, scor: v.scor,
                autor_confirmat: !!v.acelasiOm, adus_la: new Date().toISOString().slice(0, 10),
                // Fara autorul confirmat de amandoua partile, fisa NU intra de la sine
                // in foaie: asteapta un „da" al omului in /propuneri (regula lui,
                // 31 aug 2026 — unealta propune, omul hotaraste). La fel cand titlul s-a
                // potrivit doar pe o bucata (8 sept. 2026): coada taiata poate fi tocmai
                // ce deosebeste editia („o noua traducere dupa originalul grecesc").
                ...(v.varianta ? { varianta: v.varianta } : {}),
                nehotarat: v.varianta ? `titlul s-a potrivit doar pe o parte („${v.varianta}”)`
                  : v.acelasiOm ? undefined : "autorul nu s-a putut confirma" };
      break;
    }
    if (!gasit && aproape) {
      const s2 = SURSE[aproape.a.sursa];
      gasit = { ...aproape.fisa, sursa: aproape.a.sursa, sursa_nume: s2.nume, url: aproape.a.url,
                scor: Number((aproape.scor ?? 0).toFixed(3)), autor_confirmat: false,
                adus_la: new Date().toISOString().slice(0, 10),
                nehotarat: `titlul seamana doar pe jumatate (${(aproape.scor ?? 0).toFixed(2)})` };
    }
    if (!gasit) {
      respinse++;
      await scrieJson(cale, { slug: p.slug, gasit: false, motive: [...new Set(motive)] });
      if (respinse % 25 === 0) console.log(`  … ${aduse} aduse, ${respinse} fara potrivire buna`);
      continue;
    }
    if (gasit.imagine) gasit.coperta = await aduCoperta(gasit, p.slug);
    if (gasit.pdf && SURSE[gasit.sursa]?.cuPdf) {
      const d = await aduPdf(gasit.pdf, p.slug);
      if (d) { Object.assign(gasit, d); pdfuri++; } else { gasit.pdf = null; }
    }
    await scrieJson(cale, { slug: p.slug, gasit: true, ...gasit });
    if (gasit.nehotarat) nehotarate++; else aduse++;
    if (aduse % 25 === 0) console.log(`  … ${aduse} aduse (${pdfuri} cu pdf), ${respinse} fara potrivire buna`);
  }
  console.log(`gata: ${aduse} aduse (${pdfuri} cu pdf), ${nehotarate} de aratat omului, ` +
    `${respinse} respinse la confirmare, ${sarite} erau deja luate`);
}

/* ------------------------------------------------------------- pasul PDFURI -- */

/**
 * Cartea intreaga, de la editurile care o dau ele insele. E un pas aparte, nu o parte
 * din „adu", din doua pricini: cartea poate avea deja fisa de la alt magazin (si atunci
 * la Predania nu se mai bate la usa niciodata), iar PDF-ul are ALT stapan decat coperta,
 * deci se scrie cu izvorul lui langa el (`pdf_sursa`).
 *
 * Din 124 de carti ale Predaniei, la 7 sept. 2026 doar 14 aveau fisierul intreg: 65 de
 * adrese dau 404 chiar la ei si 43 sunt fisiere de zero octeti. Nu e nimic de dres la
 * noi — cand isi repara ei site-ul, pasul asta le ia singur, rulat din nou.
 */
async function pasPdfuri() {
  await mkdir(`${ACASA}/pdfuri`, { recursive: true });
  const cat = JSON.parse(await readFile(CATALOG, "utf8"));
  let luate = 0, incercate = 0;
  for (const [id, s] of Object.entries(SURSE)) {
    if (!s.cuPdf) continue;
    const lista = await citesteJson(`${ACASA}/index/${id}.json`, []);
    if (!lista.length) { console.log(`${id}: n-are index`); continue; }
    const idf = greutati(lista.map((x) => x.titlu));
    for (const c of cat.carti) {
      // Cea mai buna potrivire din lista lor, cu aceeasi masura ca la confirmare.
      let cel = null;
      for (const x of lista) {
        const sc = seamana(c.titlu, x.titlu, idf);
        if (sc >= 0.80 && (!cel || sc > cel.sc)) cel = { ...x, sc };
      }
      if (!cel) continue;
      const cale = `${ACASA}/fise/${c.slug}.json`;
      const fisa = await citesteJson(cale);
      if (fisa?.pdf && fisa?.pdf_octeti) continue;              // il avem deja
      incercate++;
      const html = await adu(cel.url);
      await dorm(s.pauza);
      if (!html) continue;
      const lor = s.citeste(html, c);
      if (!lor?.pdf) continue;
      const v = confirma(c, lor, idf);
      if (!v.bun) { console.log(`  - ${c.slug}: ${v.de_ce}`); continue; }
      const d = await aduPdf(lor.pdf, c.slug);
      await dorm(s.pauza);
      if (!d) continue;                                          // gol sau lipsa la ei
      // Se agata de fisa care exista (coperta poate fi de la alt magazin); daca nu e
      // niciuna, se face una din ce ne-a dat editura.
      const nou = fisa?.gasit
        ? { ...fisa, ...d, pdf_sursa: { nume: s.nume, url: cel.url } }
        : { slug: c.slug, gasit: true, ...lor, ...d, sursa: id, sursa_nume: s.nume, url: cel.url,
            scor: v.scor, autor_confirmat: !!v.acelasiOm, adus_la: new Date().toISOString().slice(0, 10),
            pdf_sursa: { nume: s.nume, url: cel.url }, nehotarat: v.acelasiOm ? undefined : "autorul nu s-a putut confirma" };
      await scrieJson(cale, nou);
      luate++;
      console.log(`  + ${c.slug} — ${(d.pdf_octeti / 1048576).toFixed(1)} MB de la ${s.nume}`);
    }
  }
  console.log(`pdf-uri: ${luate} luate, din ${incercate} carti cercetate`);
}

/* ------------------------------------------------------------ pasul STRANGE -- */

async function pasStrange() {
  const fise = (await readdir(`${ACASA}/fise`)).filter((f) => f.endsWith(".json"));
  const carti = {};
  let cuCoperta = 0, cuPagini = 0, cuText = 0, cuPdf = 0;
  // Hotararile omului din /propuneri: { slug: "da" | "nu" }. Ce e nehotarat si fara „da"
  // nu ajunge in foaie — exista pe disc, dar nu se arata nimanui.
  const hotarari = await citesteJson(`${ACASA}/hotarari.json`, {});
  let asteapta = 0;
  for (const f of fise) {
    const d = await citesteJson(`${ACASA}/fise/${f}`);
    if (!d?.gasit) continue;
    if (d.nehotarat && hotarari[d.slug] !== "da") { asteapta++; continue; }
    const c = {
      pagini: d.pagini ?? null, descriere: d.descriere ?? null, isbn: d.isbn ?? null,
      format: d.format ?? null, coperta_tip: d.coperta_tip ?? null,
      an: d.an ?? null, editura: d.editura ?? null, categorie: d.categorie ?? null,
      coperta: d.coperta ?? null,
      pdf: d.pdf && d.pdf_octeti
        ? { fisier: d.pdf, octeti: d.pdf_octeti,
            // PDF-ul poate veni de la ALTA usa decat coperta: cartea e a editurii, dar
            // poza poate fi luata de la un magazin. Se spune fiecare de unde e.
            sursa: d.pdf_sursa ?? { nume: d.sursa_nume, url: d.url } }
        : null,
      sursa: { id: d.sursa, nume: d.sursa_nume, url: d.url },
      adus_la: d.adus_la,
    };
    // O fisa fara nimic de aratat nu e o imbogatire — n-o punem.
    if (!c.pagini && !c.descriere && !c.coperta && !c.isbn && !c.pdf) continue;
    if (c.coperta) cuCoperta++;
    if (c.pagini) cuPagini++;
    if (c.descriere) cuText++;
    if (c.pdf) cuPdf++;
    carti[d.slug] = c;
  }
  const out = {
    facut_la: new Date().toISOString().slice(0, 10),
    total: Object.keys(carti).length,
    cu_coperta: cuCoperta, cu_pagini: cuPagini, cu_descriere: cuText, cu_pdf: cuPdf,
    surse: Object.fromEntries(Object.entries(SURSE).map(([id, s]) => [id, { nume: s.nume, gazda: s.gazda }])),
    carti,
  };
  await scrieJson(`${ACASA}/imbogatire.json`, out);
  console.log(`imbogatire.json: ${out.total} carti (${cuCoperta} cu coperta, ${cuPagini} cu pagini, ` +
    `${cuText} cu descriere, ${cuPdf} cu pdf)`);
  if (asteapta) console.log(`${asteapta} fise asteapta hotararea omului (vezi /propuneri) — nu sunt in foaie`);
}

async function pasStare() {
  const cat = JSON.parse(await readFile(CATALOG, "utf8"));
  const pot = await citesteJson(`${ACASA}/potriviri.json`, []);
  const fise = existsSync(`${ACASA}/fise`) ? (await readdir(`${ACASA}/fise`)).filter((f) => f.endsWith(".json")) : [];
  let bune = 0;
  const peSursa = new Map();
  for (const f of fise) {
    const d = await citesteJson(`${ACASA}/fise/${f}`);
    if (!d?.gasit) continue;
    bune++;
    peSursa.set(d.sursa, (peSursa.get(d.sursa) ?? 0) + 1);
  }
  const cop = existsSync(`${ACASA}/coperti`) ? (await readdir(`${ACASA}/coperti`)).length : 0;
  const pdf = existsSync(`${ACASA}/pdfuri`) ? (await readdir(`${ACASA}/pdfuri`)).length : 0;
  console.log(`catalog: ${cat.carti.length} carti`);
  console.log(`potriviri de incercat: ${pot.length}`);
  console.log(`fise cercetate: ${fise.length} — cu rezultat: ${bune}, fara: ${fise.length - bune}`);
  console.log(`coperti aduse: ${cop} | pdf-uri aduse: ${pdf}`);
  for (const [s, n] of [...peSursa].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)} ${s}`);
  for (const [id, s] of Object.entries(SURSE)) {
    const l = await citesteJson(`${ACASA}/index/${id}.json`, null);
    if (!l) console.log(`  (fara index: ${id} — ${s.nume})`);
  }
}

/** Proba unui cititor pe o singura pagina — ca sa nu pornim un cules de-o noapte degeaba. */
async function pasProba(id, url) {
  const s = SURSE[id];
  if (!s) throw new Error(`sursa necunoscuta: ${id} (am: ${Object.keys(SURSE).join(", ")})`);
  const html = await adu(url);
  if (!html) throw new Error("pagina n-a raspuns");
  const carte = { titlu: "", autor: null, editura: null, an: null };
  console.log(JSON.stringify(s.citeste(html, carte), null, 1));
}

/* ------------------------------------------------------------------ pornit --- */

export { confirma, SURSE };

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [, , pas, ...rest] = process.argv;
  await mkdir(ACASA, { recursive: true });
  switch (pas) {
    case "index": await pasIndex(rest); break;
    case "potriveste": await pasPotriveste(); break;
    case "adu": {
      const val = (nume) => rest.find((x) => x.startsWith(nume + "="))?.slice(nume.length + 1)?.split(",");
      await pasAdu(Number(rest.find((x) => /^\d+$/.test(x))) || 0, rest.includes("--iar"), val("--doar"), val("--fara"));
      break;
    }
    case "pdfuri": await pasPdfuri(); break;
    case "strange": await pasStrange(); break;
    case "stare": await pasStare(); break;
    case "proba": await pasProba(rest[0], rest[1]); break;
    default:
      console.log("pasi: index [sursa…] | potriveste | adu [cate] [--iar] [--doar=a,b] [--fara=a,b] | pdfuri | strange | stare | proba <sursa> <url>");
      process.exit(1);
  }
}
