/**
 * A12 · Pregateste pagina /propuneri (numai pe preview) si aplica raspunsurile.
 *
 * Regula omului, din 31 august 2026: UNEALTA PROPUNE, OMUL HOTARASTE. Tot ce nu se
 * poate confirma singur — autorul lipseste la magazin, sau titlul seamana doar pe
 * jumatate — sta deoparte, cu steagul `nehotarat` pe fisa, si nu ajunge in foaie pana
 * nu apasa el „Păstrează”.
 *
 *   node unelte/propuneri.mjs            aduna nehotaratele -> R2 local -> /propuneri
 *   node unelte/propuneri.mjs aplica     ia raspunsurile din R2 local -> hotarari.json
 *   node unelte/propuneri.mjs aproba     hotaraste singur unde toate semnele se potrivesc
 *
 * Dupa „aplica" se ruleaza din nou `imbogatire.mjs strange`: fisele cu „da" intra in
 * foaie, cele cu „nu" raman pe disc, nearatate nimanui (se pot rasgandi oricand).
 */
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { plat, seamana, seamanaOricum, greutati, jetoane, numeDeFamilie, acelasiNume } from "./potrivire.mjs";

const exec = promisify(execFile);
const A = "/data/imbogatire";
const GALEATA = "xc-biblioteca-staging";

const citeste = async (c, altfel = null) => (existsSync(c) ? JSON.parse(await readFile(c, "utf8")) : altfel);
const slugish = (x) => plat(x ?? "").replace(/[^a-z0-9]+/g, "");

/** Wrangler pune un obiect in depozitul LOCAL (preview). Sus nu ajunge niciodata. */
const puneLocal = (cheie, cale, tip) =>
  exec("npx", ["wrangler", "r2", "object", "put", `${GALEATA}/${cheie}`, `--file=${cale}`,
    `--content-type=${tip}`, "--local", "-c", "apps/biblioteca/wrangler.jsonc", "--persist-to", ".wrangler/state"], { cwd: "/workspace", maxBuffer: 1 << 22 });

/**
 * Cat de probabil e ca omul sa spuna „da" — o singura cifra, ca sa se poata ASEZA
 * propunerile de la cea mai limpede la cea mai indoielnica (cerere user, 8 sept. 2026:
 * „arata-le in ordinea cea mai probabil sa fie acceptate"). Nu hotaraste nimic: ce e
 * sigur a fost deja hotarat de `aproba`, cu pazele lui. Asta doar randuieste ce ramane,
 * ca omul sa apese repede cat timp e limpede si sa se opreasca de unde incepe ghicitul.
 *
 * Cantareste ce se vede pe fisa, in ordinea in care conteaza:
 *   autorul   — acelasi om e semnul cel mai tare; „unul din doi nu l-a trecut" e neutru
 *   editura   — aceeasi editura inseamna aproape sigur aceeasi carte
 *   titlul    — cat de mult seamana, cu bucata de titlu cantarind mai putin decat intregul
 *   anul      — acelasi an adauga putin; departarea a fost deja taiata de `aproba`
 *   rafturile — doua carti ale noastre catre acelasi raft: cel putin una e gresita
 */
function sansa({ autor, editura, scor, prinBucata, anLaFel, incurcat }) {
  let s = 0.10;
  s += autor === "acelasi" ? 0.34 : 0.10;          // „altul" nu ajunge pana aici
  s += editura === "aceeasi" ? 0.30 : editura === "nu se poate" ? 0.10 : 0;
  s += (prinBucata ? 0.24 : 0.32) * Math.min(1, scor);
  if (anLaFel) s += 0.06;
  if (incurcat) s *= 0.45;
  return Number(Math.min(1, s).toFixed(3));
}

async function construieste() {
  const catalog = JSON.parse(await readFile("/data/catalog/catalog.json", "utf8"));
  const deCat = new Map(catalog.carti.map((c) => [c.slug, c]));
  const hotarari = await citeste(`${A}/hotarari.json`, {});
  await mkdir(`${A}/propuse-mici`, { recursive: true });

  const idf = greutati(catalog.carti.map((c) => c.titlu));
  const deLuat = [];
  for (const f of (await readdir(`${A}/fise`)).filter((x) => x.endsWith(".json"))) {
    const d = await citeste(`${A}/fise/${f}`);
    if (!d?.gasit || !d.nehotarat || hotarari[d.slug]) continue;
    deLuat.push({ d, c: deCat.get(d.slug) ?? {} });
  }
  // Doua carti ale noastre catre acelasi raft din magazin — aceeasi paza ca la `aproba`,
  // aici doar ca sa coboare in lista, nu ca sa taie ceva.
  const laAcelasiRaft = new Map();
  for (const { d, c } of deLuat) {
    const l = laAcelasiRaft.get(d.url) ?? new Set();
    l.add(plat(c.titlu ?? d.slug));
    laAcelasiRaft.set(d.url, l);
  }

  const propuneri = [];
  for (const { d, c } of deLuat) {
    // Recomandarea uneltei, cu acelasi temei ca in 31 aug: aceeasi editura inseamna
    // aproape sigur aceeasi carte; altfel omul se uita cu ochii lui.
    const aceeasiEditura = c.editura && d.editura &&
      (slugish(c.editura).includes(slugish(d.editura)) || slugish(d.editura).includes(slugish(c.editura)));
    // Scorul unei fise potrivite pe o bucata de titlu (`varianta`) e al bucatii, nu al
    // titlului intreg — nu spune „leit" despre nimic.
    const titluLeit = !d.varianta && (d.scor ?? 0) >= 0.94;
    const anRau = c.an && d.an && String(c.an).match(/\d{4}/) && String(d.an).match(/\d{4}/) &&
      Math.abs(Number(String(c.an).match(/\d{4}/)[0]) - Number(String(d.an).match(/\d{4}/)[0])) > 25;
    const recomand = anRau ? "nu" : aceeasiEditura || titluLeit ? "da" : "nu";
    const motiv = anRau
      ? `anii sunt prea departe unul de altul (${c.an} față de ${d.an})`
      : aceeasiEditura ? `aceeași editură ca în catalogul parohiei (${d.editura})`
      : titluLeit ? `titlul se potrivește aproape leit (${(d.scor ?? 0).toFixed(2)}), dar editura nu se poate verifica`
      : `${d.nehotarat}, iar editura lor („${d.editura ?? "—"}”) nu se potrivește cu a noastră`;
    propuneri.push({
      slug: d.slug,
      nostru: { titlu: c.titlu ?? d.slug, autor: c.autor ?? null, editura: c.editura ?? null,
                an: c.an ?? null, loc: c.loc ?? null, nr: c.nr ?? null },
      gasit: { titlu: d.titlu ?? "", autor: d.autor ?? null, editura: d.editura ?? null,
               an: d.an ?? null, pagini: d.pagini ?? null, format: d.format ?? null,
               isbn: d.isbn ?? null, descriere: d.descriere ?? null,
               coperta: !!d.coperta, sursa: d.sursa_nume, url: d.url },
      recomand, motiv,
      sansa: sansa({
        autor: (() => {
          const ai = numeDeFamilie(c.autor), lor = numeDeFamilie(d.autor);
          return !ai.size || !lor.size ? "nu se poate" : acelasiNume(ai, lor) ? "acelasi" : "altul";
        })(),
        editura: !c.editura || !d.editura ? "nu se poate" : aceeasiEditura ? "aceeasi" : "alta",
        scor: seamanaOricum(c.titlu ?? "", d.titlu ?? "", idf).scor,
        prinBucata: !!d.varianta,
        anLaFel: !!(c.an && d.an && String(c.an).match(/\d{4}/) && String(d.an).match(/\d{4}/) &&
                    String(c.an).match(/\d{4}/)[0] === String(d.an).match(/\d{4}/)[0]),
        incurcat: (laAcelasiRaft.get(d.url)?.size ?? 1) > 1,
      }),
    });
  }
  // De la cea mai limpede la cea mai indoielnica (cerere user, 8 sept. 2026): omul apasa
  // repede cat timp e limpede si se opreste de unde incepe ghicitul.
  propuneri.sort((a, b) => b.sansa - a.sansa || (a.slug < b.slug ? -1 : 1));
  await writeFile(`${A}/propuse/propuneri.json`, JSON.stringify(propuneri, null, 1));
  console.log(`propuneri: ${propuneri.length} (${propuneri.filter((p) => p.recomand === "da").length} cu DA, ` +
    `${propuneri.filter((p) => p.recomand === "nu").length} cu NU, ` +
    `${propuneri.filter((p) => p.gasit.coperta).length} cu copertă)`);
  const peTrepte = [[0.75, "limpezi"], [0.55, "de cantarit"], [0, "indoielnice"]];
  for (const [prag, nume] of peTrepte)
    console.log(`  ${nume}: ${propuneri.filter((p) => p.sansa >= prag &&
      p.sansa < (peTrepte.find((t) => t[0] > prag)?.[0] ?? 2)).length}`);

  await puneLocal("propuneri/propuneri.json", `${A}/propuse/propuneri.json`, "application/json");
  console.log("propuneri.json: pus in R2-ul local");

  // Copertile de aratat: micsorate la 200 px, ca pagina sa se deschida si pe telefon.
  // Si ORIGINALUL, pentru lupa din coltul copertei (cerere user, 8 sept. 2026: „daca faci
  // zoom la poze, ma uit") — o singura data: ce s-a urcat sta scris in `urcate-mari.json`
  // cu data fisierului, ca sa nu se urce din nou la fiecare refacere a paginii (fiecare
  // punere prin wrangler tine ~5 secunde).
  // AMANDOUA marimile se urca o singura data: ce e sus sta scris in `urcate.json`, cu data
  // fisierului de pe disc. O punere prin wrangler tine ~5 secunde, deci o refacere a
  // paginii insemna, pana la 8 sept. 2026, un sfert de ora de asteptare degeaba.
  const semn = `${A}/propuse/urcate.json`;
  const urcate = await citeste(semn, await citeste(`${A}/propuse/urcate-mari.json`, {}));
  let mici = 0, mari = 0;
  for (const p of propuneri.filter((x) => x.gasit.coperta)) {
    const sursa = `${A}/coperti/${p.slug}.jpg`;
    if (!existsSync(sursa)) continue;
    const mic = `${A}/propuse-mici/${p.slug}.jpg`;
    if (!existsSync(mic)) await exec("convert", [sursa, "-resize", "200x300>", "-strip", "-quality", "80", mic]);
    const data = (await stat(sursa)).mtimeMs;
    const stia = urcate[p.slug];
    const facut = typeof stia === "object" ? stia : { mare: stia };   // foaia veche, doar mari
    if (facut.mic !== data) { await puneLocal(`propuneri/coperti/${p.slug}.jpg`, mic, "image/jpeg"); facut.mic = data; mici++; }
    if (facut.mare !== data) { await puneLocal(`propuneri/coperti-mari/${p.slug}.jpg`, sursa, "image/jpeg"); facut.mare = data; mari++; }
    urcate[p.slug] = facut;
    if ((mici + mari) % 25 === 0 && (mici + mari)) console.log(`  … ${mici + mari} coperti puse local`);
    await writeFile(semn, JSON.stringify(urcate, null, 1));
  }
  console.log(`coperti puse local: ${mici} mici, ${mari} mari (restul erau deja acolo)`);
}

/** Raspunsurile date in pagina (R2 local) devin hotarari pe disc, langa fise. */
async function aplica() {
  const { stdout } = await exec("npx", ["wrangler", "r2", "object", "get",
    `${GALEATA}/propuneri/raspunsuri.json`, "--local", "--pipe", "-c", "apps/biblioteca/wrangler.jsonc", "--persist-to", ".wrangler/state"],
    { cwd: "/workspace", maxBuffer: 1 << 24 });
  const rasp = JSON.parse(stdout);
  const hotarari = await citeste(`${A}/hotarari.json`, {});
  let da = 0, nu = 0;
  for (const [slug, x] of Object.entries(rasp)) {
    hotarari[slug] = x.raspuns;
    x.raspuns === "da" ? da++ : nu++;
  }
  await writeFile(`${A}/hotarari.json`, JSON.stringify(hotarari, null, 1));
  console.log(`hotarari.json: ${Object.keys(hotarari).length} cu totul (acum ${da} „da”, ${nu} „nu”)`);
  console.log("mai departe: node unelte/imbogatire.mjs strange");
}

/**
 * Hotararea in locul omului, pentru fisele la care cele trei semne se potrivesc.
 *
 *   node unelte/propuneri.mjs aproba          arata ce s-ar hotari, nu scrie nimic
 *   node unelte/propuneri.mjs aproba scrie    scrie in hotarari.json
 *
 * Cererea userului, 8 septembrie 2026: „aproba tot ce ai marcat ca fiind corect =
 * autor, editura, titlu aproximativ, iar restul lasa-le la propuneri". Cele trei semne
 * se citesc fiecare in trei feluri — se potriveste, nu se potriveste, sau nu se poate
 * sti (unul din doi n-are trecut nimic acolo) — si abia impreuna spun ceva:
 *
 *   NU        alt autor decat al nostru. Regula omului din 31 august 2026, fara portita
 *             de scor: titlurile rasturnate dau 1.00 si asa a ajuns „De la moarte la
 *             viata" sa poarte fisa „Viata dupa moarte". La fel, anii prea departati.
 *   DA        acelasi autor SI aceeasi editura — nimic nu se bate cap in cap;
 *             sau acelasi autor si editura nu se poate verifica, cu titlul destul de
 *             aproape (0.70);
 *             sau aceeasi editura si titlul destul de aproape (0.70) — magazinul nu si-a
 *             trecut autorul, dar editura e a noastra;
 *             sau titlul leit (0.97), cu editura care nu se impotriveste.
 *   ALTFEL    ramane propunere: omul se uita cu ochii lui.
 *
 * Doua paze peste tot:
 *   — un titlu prea scurt nu spune destul. „Scrisori" se potriveste leit cu „Scrisori
 *     catre cei", si totusi e alta carte; de aceea potrivirea numai pe titlu cere cel
 *     putin trei cuvinte care inseamna ceva.
 *   — cand doua carti ALE NOASTRE, cu titluri diferite, arata catre acelasi raft din
 *     magazin, cel putin una e gresita: nu se aproba niciuna. („Cartea nuntii" a lui
 *     Danion Vasile si „Cartea nuntii" de la Elpis, amandoua catre acelasi link.)
 */
async function aproba(scrie) {
  const catalog = JSON.parse(await readFile("/data/catalog/catalog.json", "utf8"));
  const deCat = new Map(catalog.carti.map((c) => [c.slug, c]));
  const idf = greutati(catalog.carti.map((c) => c.titlu));
  const hotarari = await citeste(`${A}/hotarari.json`, {});

  const fise = [];
  for (const f of (await readdir(`${A}/fise`)).filter((x) => x.endsWith(".json"))) {
    const d = await citeste(`${A}/fise/${f}`);
    if (!d?.gasit || !d.nehotarat || hotarari[d.slug]) continue;
    const c = deCat.get(d.slug);
    if (!c) continue;                       // fisa unei carti care nu mai e in catalog
    fise.push({ d, c });
  }

  // Doua titluri deosebite catre acelasi raft din magazin: nu se aproba niciunul.
  const laAcelasiRaft = new Map();
  for (const { d, c } of fise) {
    const l = laAcelasiRaft.get(d.url) ?? new Set();
    l.add(plat(c.titlu));
    laAcelasiRaft.set(d.url, l);
  }

  const iese = { da: [], nu: [], propunere: [] };
  for (const { d, c } of fise) {
    const ai = numeDeFamilie(c.autor), lor = numeDeFamilie(d.autor);
    const autor = !ai.size ? "noi n-avem" : !lor.size ? "ei n-au"
      : acelasiNume(ai, lor) ? "acelasi" : "altul";
    const editura = !c.editura || !d.editura ? "nu se poate"
      : (slugish(c.editura).includes(slugish(d.editura)) ||
         slugish(d.editura).includes(slugish(c.editura))) ? "aceeasi" : "alta";
    // Titlul intreg SAU o bucata a lui (capul dinaintea parantezei/subtitlului). Fara
    // asta, o fisa adusa prin bucata ramanea cu scorul titlului intreg — mic prin
    // definitie — si nu trecea de niciun prag, oricat de limpezi ar fi fost celelalte
    // semne. Bucata nu slabeste PAZELE: autorul si rafturile se cantaresc la fel.
    const v = seamanaOricum(c.titlu, d.titlu, idf);
    const scor = Number(v.scor.toFixed(3));
    const prinBucata = !!v.varianta;
    const anN = String(c.an ?? "").match(/^\d{4}$/)?.[0];
    const anL = String(d.an ?? "").match(/\b(1[89]\d\d|20\d\d)\b/)?.[0];
    const anRau = !!(anN && anL && Math.abs(Number(anN) - Number(anL)) > 25);
    const incurcat = (laAcelasiRaft.get(d.url)?.size ?? 1) > 1;
    const destuleCuvinte = jetoane(c.titlu).length >= 3;

    let raspuns = "propunere", motiv = "rămâne de hotărât";
    if (autor === "altul") { raspuns = "nu"; motiv = `la ei cartea e a altcuiva (${d.autor})`; }
    else if (anRau) { raspuns = "nu"; motiv = `anii sunt prea departe (${c.an} față de ${d.an})`; }
    else if (incurcat) { motiv = "două cărți ale noastre arată către același raft"; }
    else if (autor === "acelasi" && editura === "aceeasi") { raspuns = "da"; motiv = "același autor și aceeași editură"; }
    else if (autor === "acelasi" && editura === "nu se poate" && scor >= 0.70) { raspuns = "da"; motiv = "același autor, iar editura nu se poate verifica"; }
    else if (editura === "aceeasi" && scor >= 0.70) { raspuns = "da"; motiv = "aceeași editură și titlul se potrivește"; }
    // „Leit" pe titlul INTREG e o dovada; leit pe o BUCATA de titlu nu e: coada taiata
    // poate fi tocmai ce deosebeste editia — „Calea Crucii (in limba rusa)" se potriveste
    // leit cu „Calea Crucii" al Sophiei, si ar lua coperta cartii romanesti (8 sept. 2026).
    // De aceea bucata cere si un al doilea semn: aceeasi editura sau acelasi autor.
    else if (scor >= 0.97 && editura !== "alta" && destuleCuvinte &&
             (!prinBucata || editura === "aceeasi" || autor === "acelasi")) {
      raspuns = "da"; motiv = prinBucata ? "titlul se potrivește leit pe partea de dinaintea subtitlului" : "titlul se potrivește leit";
    }

    iese[raspuns].push({ slug: d.slug, nostru: c.titlu, lor: d.titlu, autor, editura, scor, motiv,
                         prinBucata, coperta: !!d.coperta, sursa: d.sursa_nume });
  }

  for (const fel of ["da", "nu", "propunere"]) {
    console.log(`\n===== ${fel.toUpperCase()} (${iese[fel].length}) =====`);
    for (const x of iese[fel].sort((a, b) => b.scor - a.scor))
      console.log(`[${x.scor.toFixed(2)}] ${x.nostru}\n     ↔ ${x.lor} (${x.sursa})\n     ${x.motiv}`);
  }
  console.log(`\nda ${iese.da.length} · nu ${iese.nu.length} · rămân propuneri ${iese.propunere.length}` +
    ` · dintre cele cu „da", ${iese.da.filter((x) => x.coperta).length} aduc și copertă`);
  await writeFile(`${A}/aprobare.json`, JSON.stringify(iese, null, 1));

  if (!scrie) { console.log('(numai socoteala — "aproba scrie" ca sa se scrie in hotarari.json)'); return; }
  for (const x of iese.da) hotarari[x.slug] = "da";
  for (const x of iese.nu) hotarari[x.slug] = "nu";
  await writeFile(`${A}/hotarari.json`, JSON.stringify(hotarari, null, 1));
  console.log(`hotarari.json: ${Object.keys(hotarari).length} cu totul`);
  console.log("mai departe: node unelte/imbogatire.mjs strange");
}

const ce = process.argv[2];
await (ce === "aplica" ? aplica() : ce === "aproba" ? aproba(process.argv[3] === "scrie") : construieste());

