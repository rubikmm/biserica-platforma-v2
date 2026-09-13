/**
 * A12 · Urcarea imbogatirii in R2 — foaia si copertile.
 *
 * Doua depozite, si amandoua trebuie tinute la zi: cel LOCAL (`wrangler dev`, adica
 * `.wrangler` din container) si cel de SUS (productia). Ordinea nu conteaza aici — spre
 * deosebire de migratiile D1, o foaie lipsa nu darama nimic: aplicatia merge si fara ea.
 *
 *   node unelte/urca.mjs local     in depozitul de lucru, prin wrangler
 *   node unelte/urca.mjs sus       in productie, prin API-ul R2 (mult mai iute)
 *   node unelte/urca.mjs sus mici  numai copertile mici (cand se schimba doar ele)
 *   node unelte/urca.mjs sus mari  numai copertile mari (originalele, pentru lupa)
 *   node unelte/urca.mjs sus pdf   numai cartile in PDF (`pdfuri/` -> `pdfuri/` in R2)
 *
 * COPERTILE se micsoreaza intai, in DOUA marimi. De la magazin vin de 960 de pixeli
 * inaltime si vreo 140 KB; pe fisa se arata pe 190 de pixeli latime. 480 de pixeli ajung
 * si pentru ecranele dese, si taie greutatea paginii de vreo patru ori. A doua marime,
 * 80 de pixeli (`mici/` -> `coperti-mici/` in R2), e pentru inceputul randului din liste
 * (7 sept. 2026): acolo se vad pe 26 px, iar o cautare are pana la 300 de randuri.
 * Originalele raman pe disc, in `coperti/`, ca sa nu trebuiasca aduse din nou daca ne
 * razgandim la marime.
 *
 * A TREIA marime (8 sept. 2026, cerere user: „as vrea sa pot vedea coperta mare —
 * cateodata nu pot nici sa citesc ce scrie") e chiar ORIGINALUL, urcat asa cum a venit,
 * fara micsorare si fara re-comprimare: `coperti/` de pe disc -> `coperti-mari/` in R2.
 * Ce se vede pe ecran la lupa e tot ce avem — mai mare de-atat nu da nicio librarie.
 */
import { readdir, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ACASA = "/data/imbogatire";
const GALEATA = "xc-biblioteca-staging";
/** Cele doua marimi: unde se pun pe disc, sub ce cheie merg in R2, cat de late ies. */
// Geometria e a lui ImageMagick: „incape in cutia asta, si numai daca e mai mare".
// Cea de fisa a ramas 480x480 — copertile vin inalte, deci ies de ~312x480 — ca sa nu se
// refaca toate altfel; cea mica e legata de latime (160, adica 52 px pe ecran, de trei
// ori — 80 era pentru 26 px, cat a fost coperta din lista in dimineata de 7 sept. 2026).
const MARIMI = {
  web:  { cheie: "coperti",      geometrie: "480x480>", calitate: 82, latime: 480 },
  mici: { cheie: "coperti-mici", geometrie: "160x320>", calitate: 80, latime: 160 },
  // Marea n-are geometrie: e originalul de pe disc, urcat neatins din `coperti/`.
  mari: { cheie: "coperti-mari", geometrie: null, dir: "coperti" },
};

/** Unde stau pe disc fisierele unei marimi (marea le ia de-a dreptul din originale). */
const dirul = (marime) => `${ACASA}/${MARIMI[marime].dir ?? marime}`;

/** Copertile gata de web, intr-o marime: micsorate, fara metadate, incarcate progresiv. */
async function pregatesteCopertile(marime) {
  const { geometrie, calitate, latime } = MARIMI[marime];
  if (!geometrie) {
    const toate = (await readdir(dirul(marime))).filter((f) => f.endsWith(".jpg"));
    console.log(`coperti pregatite (${marime}): ${toate.length} — originalele, neatinse`);
    return toate;
  }
  await mkdir(`${ACASA}/${marime}`, { recursive: true });
  // Geometria cu care s-au facut cele de pe disc sta langa ele: daca s-a schimbat intre
  // timp, se refac TOATE — altfel verificarea pe data ar tine copertile vechi, mai mici.
  const semn = `${ACASA}/${marime}/.geometrie`;
  const altaMarime = !existsSync(semn) || (await readFile(semn, "utf8")).trim() !== geometrie;
  if (altaMarime) console.log(`${marime}: alta geometrie (${geometrie}) — se refac toate`);
  const toate = (await readdir(`${ACASA}/coperti`)).filter((f) => f.endsWith(".jpg"));
  let facute = 0;
  for (const f of toate) {
    const iesire = `${ACASA}/${marime}/${f}`;
    // Sarim ce e deja facut si mai nou decat originalul.
    if (!altaMarime && existsSync(iesire)) {
      const [a, b] = await Promise.all([stat(`${ACASA}/coperti/${f}`), stat(iesire)]);
      if (b.mtimeMs >= a.mtimeMs) continue;
    }
    await exec("convert", [`${ACASA}/coperti/${f}`, "-resize", geometrie,
      "-strip", "-quality", String(calitate), "-interlace", "Plane", iesire]);
    facute++;
  }
  await writeFile(semn, geometrie + "\n");
  const dupa = (await readdir(`${ACASA}/${marime}`)).filter((f) => f.endsWith(".jpg"));
  console.log(`coperti pregatite (${marime}, ${latime} px): ${dupa.length} (${facute} facute acum)`);
  return dupa;
}

/** Cate octeti au toate la un loc — ca sa stim ce urcam. */
async function greutate(dir, fisiere) {
  let n = 0;
  for (const f of fisiere) n += (await stat(`${dir}/${f}`)).size;
  return (n / 1048576).toFixed(1) + " MB";
}

/** Cartile intregi in PDF, asa cum le da editura. Se urca asa cum sunt, nu se ating. */
async function pdfuriDeUrcat() {
  if (!existsSync(`${ACASA}/pdfuri`)) return [];
  const f = (await readdir(`${ACASA}/pdfuri`)).filter((x) => x.endsWith(".pdf"));
  if (f.length) console.log(`de urcat (pdf): ${f.length} carti, ${await greutate(`${ACASA}/pdfuri`, f)}`);
  return f;
}

async function sus(marimi, cuFoaia, pdfuri = []) {
  const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env;
  if (!cont || !jeton)
    throw new Error("lipseste tokenul — `set -a; . /backup/_setup/cloudflare.env; set +a`");
  const adresa = (cheie) =>
    `https://api.cloudflare.com/client/v4/accounts/${cont}/r2/buckets/${GALEATA}/objects/${cheie}`;

  // API-ul R2 striga „throttling" (429, cod 971) daca urcam prea des — la 900 de
  // coperti a picat vreo suta din prima incercare, 7 sept. 2026. La 429 se asteapta
  // mult mai mult decat la o eroare oarecare, si se incearca de cinci ori.
  const pune = async (cheie, corp, tip) => {
    for (let i = 1; i <= 5; i++) {
      const r = await fetch(adresa(cheie), {
        method: "PUT",
        headers: { authorization: `Bearer ${jeton}`, "content-type": tip },
        body: corp, signal: AbortSignal.timeout(60000),
      });
      if (r.ok) return true;
      if (i === 5) { console.error(`  ! ${cheie}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`); return false; }
      await new Promise((x) => setTimeout(x, (r.status === 429 ? 6000 : 1500) * i));
    }
  };

  if (cuFoaia) {
    await pune("imbogatire.json", await readFile(`${ACASA}/imbogatire.json`), "application/json");
    console.log("imbogatire.json: urcata");
  }

  for (const f of pdfuri) {
    const ok = await pune(`pdfuri/${f}`, await readFile(`${ACASA}/pdfuri/${f}`), "application/pdf");
    if (!ok) console.error(`  ! pdf cazut: ${f}`);
  }
  if (pdfuri.length) console.log(`pdf-uri urcate in productie: ${pdfuri.length}`);

  // Cateva deodata, dar nu prea multe: nu e o intrecere, iar API-ul are limite.
  for (const [marime, coperti] of Object.entries(marimi)) {
    let gata = 0, cazute = 0;
    const rand = [...coperti];
    const fir = async () => {
      for (let f = rand.pop(); f; f = rand.pop()) {
        const ok = await pune(`${MARIMI[marime].cheie}/${f}`, await readFile(`${dirul(marime)}/${f}`), "image/jpeg");
        ok ? gata++ : cazute++;
        if ((gata + cazute) % 50 === 0) console.log(`  … ${gata + cazute}/${coperti.length}`);
      }
    };
    await Promise.all(Array.from({ length: 3 }, fir));
    console.log(`coperti (${marime}) urcate in productie: ${gata}${cazute ? `, cazute: ${cazute}` : ""}`);
  }
}

async function local(marimi, cuFoaia, pdfuri = []) {
  const w = async (cheie, cale) => {
    await exec("npx", ["wrangler", "r2", "object", "put", `${GALEATA}/${cheie}`,
      `--file=${cale}`, "--local", "-c", "apps/biblioteca/wrangler.jsonc", "--persist-to", ".wrangler/state"], { cwd: "/workspace", maxBuffer: 1 << 22 });
  };
  if (cuFoaia) {
    await w("imbogatire.json", `${ACASA}/imbogatire.json`);
    console.log("imbogatire.json: pusa in depozitul local");
  }
  for (const f of pdfuri) {
    try { await w(`pdfuri/${f}`, `${ACASA}/pdfuri/${f}`); } catch (e) { console.error("  ! pdf", f, e.message.slice(0, 80)); }
  }
  if (pdfuri.length) console.log(`pdf-uri puse local: ${pdfuri.length}`);

  for (const [marime, coperti] of Object.entries(marimi)) {
    let gata = 0;
    const rand = [...coperti];
    const fir = async () => {
      for (let f = rand.pop(); f; f = rand.pop()) {
        try { await w(`${MARIMI[marime].cheie}/${f}`, `${dirul(marime)}/${f}`); gata++; } catch (e) { console.error("  !", f, e.message.slice(0, 80)); }
        if (gata % 50 === 0) console.log(`  … ${gata}/${coperti.length}`);
      }
    };
    await Promise.all(Array.from({ length: 4 }, fir));
    console.log(`coperti (${marime}) puse local: ${gata}`);
  }
}

const unde = process.argv[2];
const numai = process.argv[3] ?? null;          // "mici" | "mari" | "pdf" | nimic = tot
const doarPdf = numai === "pdf";
const doarOMarime = numai === "mici" || numai === "mari";
if (!["local", "sus"].includes(unde) || (numai && !["mici", "mari", "pdf"].includes(numai))) {
  console.log("folosire: node unelte/urca.mjs local|sus [mici|mari|pdf]");
  process.exit(1);
}
// Cu „mici"/„mari" se urca doar marimea aceea, fara foaie si fara celelalte — pentru cand
// se schimba numai ea (marimea, calitatea), nu si datele.
const marimi = {};
for (const m of doarPdf ? [] : doarOMarime ? [numai] : ["web", "mici", "mari"]) {
  marimi[m] = await pregatesteCopertile(m);
  console.log(`de urcat (${m}): ${marimi[m].length} coperti, ${await greutate(dirul(m), marimi[m])}`);
}
const pdfuri = doarOMarime ? [] : await pdfuriDeUrcat();
const cuFoaia = !doarOMarime && !doarPdf;
await (unde === "sus" ? sus(marimi, cuFoaia, pdfuri) : local(marimi, cuFoaia, pdfuri));
