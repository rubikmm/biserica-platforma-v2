/**
 * A12 · Cauta greseli de scris in numele cartilor si scrie raportul pentru user.
 *
 *   node unelte/greseli.mjs catalog    cauta in catalog, punand cuvintele unele langa altele
 *   node unelte/greseli.mjs librarii   pune titlurile noastre langa titlurile librariilor
 *   node unelte/greseli.mjs raport     scrie raportul din ce s-a indreptat deja
 *
 * Tabelul parohiei e scris de mana, de mai multi oameni, de-a lungul anilor. Greselile
 * nu se vad cu ochiul liber intr-o lista de 1349 de randuri, dar se vad cand pui
 * cuvintele unele langa altele: un cuvant scris O SINGURA DATA, la o litera departare de
 * un cuvant scris CORECT DE ZECI DE ORI, e aproape sigur o scapare. Asa au iesit
 * „Tâlcuuire", „copiilr", „Sfântuluui", „Măăstirea", „Cheorghe", „Prdici".
 *
 * A doua cautare are un martor din afara: pentru cartile carora librariile online le-au
 * gasit fisa, titlul lor sta langa al nostru. Asa au iesit „Csmologia", „Cuviasa",
 * „liberatea", „Cate de Rugăciuni" — greseli pe care catalogul singur nu le putea arata,
 * fiindca fiecare aparea o singura data si nu semana cu nimic.
 *
 * Unealta NU indreapta nimic. Ce se indreapta trece prin `INDREPTARI` din
 * `unelte/actualizeaza.mjs`, scris de mana, rand cu rand — fiindca jumatate din ce
 * gaseste ea sunt cuvinte scrise asa dinadins („Materic", „Comentar", ortografia din
 * 1914 a Bibliei) si numai omul poate spune care e care.
 */
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { plat } from "./potrivire.mjs";

const A = "/data/imbogatire";
const CATALOG = "/data/catalog/catalog.json";
const CAMPURI = ["titlu", "autor", "editura", "loc"];

/** Cuvintele unui text, fara cele prea scurte ca sa insemne ceva. */
const cuvinte = (s) => plat(s ?? "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((x) => x.length >= 4);

/** Doua cuvinte care difera printr-o singura litera (scapata, in plus, sau alta). */
function laOLitera(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}

/** Cauta in catalog: diacritice cazute, litere dublate, cuvinte rare langa cuvinte dese. */
async function inCatalog() {
  const carti = JSON.parse(await readFile(CATALOG, "utf8")).carti;
  const faraSemne = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[șşȘŞ]/g, (c) => (c === c.toUpperCase() ? "S" : "s"))
    .replace(/[țţȚŢ]/g, (c) => (c === c.toUpperCase() ? "T" : "t"));

  // 1. acelasi cuvant scris si cu, si fara diacritice — cel rar e de obicei scaparea
  const forme = new Map();
  for (const c of carti) for (const k of CAMPURI) {
    if (!c[k]) continue;
    for (const w of String(c[k]).split(/[^\p{L}\p{M}]+/u)) {
      if (w.length < 4) continue;
      const cheie = faraSemne(w).toLowerCase();
      if (!forme.has(cheie)) forme.set(cheie, new Map());
      const m = forme.get(cheie);
      m.set(w, (m.get(w) ?? 0) + 1);
    }
  }
  console.log("== acelasi cuvant, si cu si fara diacritice ==");
  const rand = [];
  for (const m of forme.values()) {
    if (m.size < 2) continue;
    const cu = [...m].filter(([f]) => /[ăâîșțĂÂÎȘȚ]/.test(f));
    const fara = [...m].filter(([f]) => !/[ăâîșțĂÂÎȘȚ]/.test(f));
    if (!cu.length || !fara.length) continue;
    const nCu = cu.reduce((s, x) => s + x[1], 0), nFara = fara.reduce((s, x) => s + x[1], 0);
    if (nCu > nFara) rand.push([nFara, `${fara.map((x) => `${x[0]}×${x[1]}`)} → ${cu.map((x) => `${x[0]}×${x[1]}`)}`]);
  }
  for (const [, t] of rand.sort((a, b) => a[0] - b[0])) console.log("  " + t);

  // 2. litera dublata unde n-are ce cauta
  console.log("== litera dublata ==");
  for (const c of carti) for (const k of CAMPURI) {
    if (!c[k]) continue;
    for (const w of String(c[k]).split(/[^\p{L}\p{M}]+/u))
      if (/([aăâîouAĂÂÎOU])\1/.test(w) && !/^(oo|ee)/i.test(w)) console.log(`  nr ${c.nr} [${k}] ${w} ← ${c[k]}`);
  }

  // 3. cuvant scris o data, la o litera de un cuvant scris de multe ori
  const cate = new Map(), unde = new Map();
  for (const c of carti) for (const k of ["titlu", "autor", "editura"]) {
    if (!c[k]) continue;
    for (const w of cuvinte(c[k])) {
      cate.set(w, (cate.get(w) ?? 0) + 1);
      if (!unde.has(w)) unde.set(w, [c.nr, k, c[k]]);
    }
  }
  const dese = [...cate].filter(([, n]) => n >= 4).map(([w]) => w);
  console.log("== cuvant scris o data, langa unul scris des ==");
  for (const [w, n] of cate) {
    if (n > 1) continue;
    const p = dese.find((d) => d !== w && laOLitera(w, d));
    if (p) console.log(`  "${w}" ≈ "${p}" (×${cate.get(p)}) — nr ${unde.get(w)[0]} [${unde.get(w)[1]}] ${unde.get(w)[2]}`);
  }
}

/** Pune titlul nostru langa titlul librariei care vinde aceeasi carte. */
async function laLibrarii() {
  const carti = JSON.parse(await readFile(CATALOG, "utf8")).carti;
  const deSlug = new Map(carti.map((c) => [c.slug, c]));
  const lorNr = new Map(), noiNr = new Map();
  const fise = [];
  for (const f of fs.readdirSync(`${A}/fise`).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(`${A}/fise/${f}`, "utf8"));
    if (!d?.gasit || !d.titlu) continue;
    fise.push(d);
    for (const w of new Set(cuvinte(d.titlu))) lorNr.set(w, (lorNr.get(w) ?? 0) + 1);
  }
  for (const c of carti) for (const w of new Set(cuvinte(c.titlu))) noiNr.set(w, (noiNr.get(w) ?? 0) + 1);

  const vazut = new Set();
  for (const d of fise) {
    const c = deSlug.get(d.slug);
    if (!c) continue;
    const lor = new Set(cuvinte(d.titlu));
    for (const w of cuvinte(c.titlu)) {
      if (lor.has(w) || vazut.has(c.nr + "|" + w)) continue;
      for (const l of lor) {
        // al nostru scris o data la noi, al lor scris si de altii: al lor e cuvantul bun
        if (laOLitera(w, l) && (noiNr.get(w) ?? 0) <= 1 && (lorNr.get(l) ?? 0) >= 1) {
          vazut.add(c.nr + "|" + w);
          console.log(`nr ${c.nr}: "${w}" → "${l}"?\n   NOI: ${c.titlu}\n    EI: ${d.titlu}  (${d.sursa_nume})`);
          break;
        }
      }
    }
  }
  console.log("total:", vazut.size);
}

/** Raportul pentru user: cuvantul gresit langa numele cartii. */
async function raport() {
  const R = JSON.parse(await readFile("/data/catalog/raport-actualizare.json", "utf8"));
  const nou = JSON.parse(await readFile(CATALOG, "utf8"));
  const deNr = new Map(nou.carti.map((c) => [c.nr, c]));

  /** Cuvintele schimbate intre doua scrieri ale aceluiasi text. */
  function schimbate(a, b) {
    const A2 = String(a ?? "").split(/\s+/).filter(Boolean);
    const B2 = String(b ?? "").split(/\s+/).filter(Boolean);
    const p = [];
    let i = 0, j = 0;
    while (i < A2.length && j < B2.length) {
      if (A2[i] === B2[j]) { i++; j++; continue; }
      if (A2[i + 1] === B2[j + 1]) { p.push([A2[i], B2[j]]); i++; j++; continue; }
      if (A2[i + 1] === B2[j]) { p.push([A2[i], ""]); i++; continue; }
      if (A2[i] === B2[j + 1]) { p.push(["", B2[j]]); j++; continue; }
      p.push([A2[i], B2[j]]); i++; j++;
    }
    for (; i < A2.length; i++) p.push([A2[i], ""]);
    for (; j < B2.length; j++) p.push(["", B2[j]]);
    return p;
  }

  // Ce nu e greseala de scris, ci hotarare a parohiei.
  const ALPAROHIEI = new Set([108, 1016, 735, 158, 784]);
  const CAMP = { titlu: "titlul", autor: "autorul", editura: "editura", an: "anul", loc: "locul" };
  const greseli = [], parohia = [];
  for (const s of R.schimbari) {
    if (s.camp === "bucati") continue;
    const c = deNr.get(s.nr);
    if (ALPAROHIEI.has(s.nr) || s.vechi == null || s.nou == null) { parohia.push({ ...s, titlu: c.titlu }); continue; }
    const p = schimbate(s.vechi, s.nou).filter(([a, b]) => a !== b);
    if (p.length) greseli.push({ nr: s.nr, camp: s.camp, perechi: p, titlu: c.titlu });
  }
  greseli.sort((a, b) => a.nr - b.nr);
  const bucati = R.schimbari.filter((x) => x.camp === "bucati");
  const ori = (x) => x || "—";
  const l = [];
  l.push("# Greșeli găsite în numele cărților\n");
  l.push(`A12 · Biblioteca parohiei Sfântul Ilie — foaia din ${R.data ?? "?"} pusă lângă catalogul de pe site.\n`);
  l.push("Toate cele din tabelul dintâi sunt **deja îndreptate în baza de date**. Fiecare rând");
  l.push("se poate da înapoi: e o linie în tabelul `INDREPTARI` din `unelte/actualizeaza.mjs`.\n");
  l.push("## 1. Cuvinte greșite, îndreptate\n");
  l.push("| Nr. inv. | Unde | Scria | Scrie acum | Cartea |");
  l.push("|---:|---|---|---|---|");
  for (const r of greseli)
    l.push(`| ${r.nr} | ${CAMP[r.camp]} | **${r.perechi.map(([x]) => ori(x)).join(" · ")}** | ` +
      `**${r.perechi.map(([, x]) => ori(x)).join(" · ")}** | ${r.titlu.replace(/\|/g, "\\|")} |`);
  l.push(`\n**${greseli.length} de rânduri îndreptate.**\n`);
  l.push("## 2. Ce a schimbat parohia (nu sunt greșeli de scris)\n");
  l.push("| Nr. inv. | Ce | Era | E acum |");
  l.push("|---:|---|---|---|");
  for (const s of parohia) l.push(`| ${s.nr} | ${CAMP[s.camp] ?? s.camp} | ${ori(s.vechi)} | ${ori(s.nou)} |`);
  l.push("\n## 3. Exemplare — câte s-au schimbat\n");
  l.push("| Nr. inv. | Era | E acum | Cartea |");
  l.push("|---:|---:|---:|---|");
  for (const s of bucati) l.push(`| ${s.nr} | ${s.vechi} | ${s.nou} | ${deNr.get(s.nr).titlu.replace(/\|/g, "\\|")} |`);
  l.push("");
  fs.writeFileSync("/data/catalog/greseli.md", l.join("\n"));
  console.log(`scris /data/catalog/greseli.md — ${greseli.length} greseli, ${parohia.length} schimbari ale parohiei, ${bucati.length} la exemplare`);
}

const ce = process.argv[2];
if (ce === "catalog") await inCatalog();
else if (ce === "librarii") await laLibrarii();
else if (ce === "raport") await raport();
else { console.log("pasi: catalog | librarii | raport"); process.exit(1); }
