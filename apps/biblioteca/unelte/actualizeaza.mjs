/**
 * A12 · Aduce catalogul la zi dintr-o foaie noua trimisa de parohie.
 *
 *   node unelte/actualizeaza.mjs raport <fisier.xlsx>    arata ce s-ar schimba, nu scrie
 *   node unelte/actualizeaza.mjs scrie  <fisier.xlsx>    scrie /data/catalog/catalog.json
 *
 * Catalogul din R2 a fost pana acum extras din tabelul site-ului vechi (14.11.2023).
 * Din 8 septembrie 2026 sursa e foaia de calcul a parohiei — acelasi tabel, dar tinut
 * la zi de om, cu numar de inventar cu tot.
 *
 * PATRU REGULI, in ordinea asta:
 *
 * 1. IDENTITATEA UNEI CARTI E NUMARUL DE INVENTAR (`nr`), nu titlul. Parohia il pastreaza
 *    de la o versiune la alta; titlul se mai indreapta.
 *
 * 2. SLUGUL NU SE SCHIMBA cat timp randul e aceeasi carte — el e adresa fisei
 *    (`/carte/{slug}`), cheia copertei din R2, cheia fisei de imbogatire si `carte_slug`
 *    din cererile de imprumut (D1). Se schimba numai cand la acelasi numar a ajuns ALTA
 *    carte; atunci slugul vechi ramane ca redirectare 301 si fisa de imbogatire care
 *    atarna de el se scoate — nu mai e a cartii aceleia.
 *
 * 3. CASUTA GOALA E GOALA: "***", "****", "-" si "—" inseamna toate acelasi lucru —
 *    "nu se stie" — si devin `null`. Foaia le scrie cum se nimereste, cu trei sau patru
 *    stelute; nu e o deosebire, e graba.
 *
 * 4. CAND VECHIUL SI NOUL DIFERA DOAR PRIN SPATII SAU PRIN SEMNE TIPOGRAFICE
 *    (doua spatii in loc de unul, trei puncte in loc de puncte de suspensie, apostrof
 *    drept in loc de apostrof curbat), RAMANE VECHIUL. Foaia trece prin multe maini si
 *    semnele se strica pe drum; nu e o indreptare a parohiei, e o pierdere. Restul se ia
 *    din foaie — parohia stie mai bine.
 *
 * Peste toate sta `INDREPTARI`, tabelul scris de mana de mai jos.
 */
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

/** Cititorul de xlsx sta langa unealta, nu la o cale socotita din directorul de unde a fost
 *  chemata: in monorepo unealta se cheama din radacina (`node apps/biblioteca/unelte/…`). */
const XLSX_PY = join(import.meta.dirname, "xlsx.py");

const exec = promisify(execFile);
const CATALOG = "/data/catalog/catalog.json";

/**
 * Greselile de tipar, indreptate de mana — fiecare rand o hotarare omeneasca, de sters
 * daca nu e buna. Cheia e `nr|camp`, ca sa se vada de la o privire pe ce rand se apasa;
 * valoarea e [cum scrie in foaie, cum trebuie]. Daca foaia se schimba si nu mai scrie
 * asa, indreptarea nu se aplica — se vede in raport si se sterge randul.
 *
 * Nu intra aici nimic care ar putea fi scris asa dinadins: "Materic" (chiar asa se
 * numeste cartea Avvei Isaia catre monahia Teodora), "Comentar", "Anastasis",
 * "Kavsokalivitul" fata de "Kavsokalyvitul" — acelea raman cum sunt si se intreaba omul.
 *
 * Cele mai multe sunt litere lipsa sau diacritice cazute; le-a gasit o cautare peste tot
 * catalogul (cuvinte scrise o singura data, la o litera departare de un cuvant scris
 * corect de multe ori), nu ochiul liber.
 */
const INDREPTARI = {
  // litera scapata sau dublata
  "291|editura": ["Andeas Print", "Andreas Print"],
  "303|autor":   ["Sfânta Mănastire Paraclitou", "Sfânta Mănăstire Paraclitou"],
  "346|autor":   ["Arhim Daniile Gouvalis", "Arhim Daniil Gouvalis"],
  "349|autor":   ["Ierom Hristodul Aghioitul", "Ierom Hristodul Aghioritul"],
  "498|titlu":   ["Hrană și Bucurie. Prdici la Duminicile de peste an", "Hrană și Bucurie. Predici la Duminicile de peste an"],
  "613|titlu":   ["Hrana vieții feicite a monahilor", "Hrana vieții fericite a monahilor"],
  "627|titlu":   ["Amintirile mele despre papa-Tihon (diție bilingvă română-neogreacă)", "Amintirile mele despre papa-Tihon (ediție bilingvă română-neogreacă)"],
  "634|autor":   ["Ierom. Damaschim", "Ierom. Damaschin"],
  "675|titlu":   ["Tâlcuuire a celor 150 Psalmi", "Tâlcuire a celor 150 Psalmi"],
  "823|titlu":   ["Bătrânul Iosif Isihastul. Nevoințe, expeiențe, învățături", "Bătrânul Iosif Isihastul. Nevoințe, experiențe, învățături"],
  "839|titlu":   ["Sfaturi despre creșterea și educarea copiilr", "Sfaturi despre creșterea și educarea copiilor"],
  "938|titlu":   ["Dumnezeu este iubire. Mărturia Sfântuluui Siluan Athonitul", "Dumnezeu este iubire. Mărturia Sfântului Siluan Athonitul"],
  "940|titlu":   ["Crâmpeie de viață. Din viața și învățătura Părintelui Epfanie Teodoropoulos", "Crâmpeie de viață. Din viața și învățătura Părintelui Epifanie Teodoropoulos"],
  "961|titlu":   ["Viața, pătimirile și testamentele Sfinților Stareți Cheorghe și Calinic de la Cernca", "Viața, pătimirile și testamentele Sfinților Stareți Gheorghe și Calinic de la Cernica"],
  "962|titlu":   ["Sfântul Vasile al Ostroguui, tămăduitorul celor cu mințile bolnave. Viața și minunile", "Sfântul Vasile al Ostrogului, tămăduitorul celor cu mințile bolnave. Viața și minunile"],
  "1067|titlu":  ["Acatistul și Paraclisul Preasfintei Stăpânei noatre Născătoarei de Dumnezeu și Pururea Fecioarei Maria și Canon de umilință către Domnul nostru Iisus Hristos", "Acatistul și Paraclisul Preasfintei Stăpânei noastre Născătoarei de Dumnezeu și Pururea Fecioarei Maria și Canon de umilință către Domnul nostru Iisus Hristos"],
  "1096|titlu":  ["Antologie poeziei creșnine. Primul volum: Autori români", "Antologia poeziei creștine. Primul volum: Autori români"],
  "1216|titlu":  ["Rugăciuni și Acatistte", "Rugăciuni și Acatiste"],
  "1313|titlu":  ["Novum Testamentum Graece et Latine (ediție Nestle-Alaind gr.veche - latină)", "Novum Testamentum Graece et Latine (ediție Nestle-Aland gr.veche - latină)"],
  "1328|editura": ["Măăstirea Stavropighie Sfântul Ioan Botezătorul", "Mănăstirea Stavropighie Sfântul Ioan Botezătorul"],

  // diacritice cazute (acelasi cuvant e scris corect in alte zeci de randuri)
  "288|titlu":   ["Fata nevazuta a homosexualitatii", "Fața nevăzută a homosexualității"],
  "324|autor":   ["Pr Dr Vasile Gavrila", "Pr Dr Vasile Gavrilă"],
  "373|editura": ["Arca Invierii", "Arca Învierii"],
  "374|autor":   ["Razvan Bucuroiu", "Răzvan Bucuroiu"],
  "458|editura": ["Sfînta Chilie Vatopedină a Sfântului Marelui Mucenic Gheorghie", "Sfânta Chilie Vatopedină a Sfântului Marelui Mucenic Gheorghie"],
  "555|titlu":   ["Profetii despre Antihrist", "Profeții despre Antihrist"],
  "559|titlu":   ["Razboiul și Biserica", "Războiul și Biserica"],
  "565|titlu":   ["Invataturile lui Neagoe Basarab către fiul sau Teodosie", "Învățăturile lui Neagoe Basarab către fiul său Teodosie"],
  "658|autor":   ["Ierom. Ioanichie Balan", "Ierom. Ioanichie Bălan"],
  "659|titlu":   ["Marturisirea Ortodoxă (Reeditare a ediției din 1942)", "Mărturisirea Ortodoxă (Reeditare a ediției din 1942)"],
  "721|autor":   ["Sfântul Ioan Gura de Aur", "Sfântul Ioan Gură de Aur"],
  "1056|titlu":  ["Viața și faptele Domnului Țării Romănești Constantin Vodă Brâncoveanu", "Viața și faptele Domnului Țării Românești Constantin Vodă Brâncoveanu"],
  "1139|titlu":  ["Învățături religioase și teologice în Romania", "Învățături religioase și teologice în România"],
  "1269|titlu":  ["Anatomia problemelor familiei (în limba greaca)", "Anatomia problemelor familiei (în limba greacă)"],
  "1316|titlu":  ["Porunci celor care s-au lepădat de lume. Cuvinte de nevointă", "Porunci celor care s-au lepădat de lume. Cuvinte de nevoință"],
  "1318|titlu":  ["Viața, minunile, acatistul și paraclisul Sfantului Gherasim Kefalonitul", "Viața, minunile, acatistul și paraclisul Sfântului Gherasim Kefalonitul"],
  "1321|editura": ["Invierea", "Învierea"],

  // acelasi om sau aceeasi manastire, scrisa gresit intr-un singur loc
  "534|autor":   ["Ierom. Petronie Tănase", "Ierom. Petroniu Tănase"],
  "560|editura": ["Sfânta Mănăstire Sihăstra", "Sfânta Mănăstire Sihăstria"],
  "1123|autor":  ["Roeo Petrasciuc", "Romeo Petrașciuc"],
  "110|autor":   ["Sfântul Ioan Gură de Aur, Sfântul Sofronie al Ierusălimului", "Sfântul Ioan Gură de Aur, Sfântul Sofronie al Ierusalimului"],
  "1149|autor":  ["Sfântul Ioan Gură de Aur, Sfântul Sofronie al Ierusălimului", "Sfântul Ioan Gură de Aur, Sfântul Sofronie al Ierusalimului"],

  // gasite punand titlul nostru langa titlul librariei care vinde aceeasi carte
  // (cautarea din `unelte/greseli.mjs`, pasul „librarii")
  "304|titlu":   ["Explicarea Dumnezieștii Liturghii", "Explicarea Dumnezeieștii Liturghii"],
  "307|titlu":   ["Valeriu Gafancu - Sfântul închisorilor", "Valeriu Gafencu - Sfântul închisorilor"],
  "408|titlu":   ["Povestiile unui pelerin în căutarea rugăciunii neîncetate", "Povestirile unui pelerin în căutarea rugăciunii neîncetate"],
  "452|titlu":   ["Ofranda monahilor comtemporani", "Ofranda monahilor contemporani"],
  "669|titlu":   ["Cate de Rugăciuni cu Acatistele cele mai folositoare din viața omului", "Carte de Rugăciuni cu Acatistele cele mai folositoare din viața omului"],
  "677|titlu":   ["Ferciți cei prigoniți - martiri ai temnițelor comuniste", "Fericiți cei prigoniți - martiri ai temnițelor comuniste"],
  "742|titlu":   ["Epfania: cele din urmă poeme de dragoste creștină", "Epifania: cele din urmă poeme de dragoste creștină"],
  "760|titlu":   ["Identitatea și liberatea omului în Ortodoxie", "Identitatea și libertatea omului în Ortodoxie"],
  "806|titlu":   ["Slujba și Acatistul Sfântului Ierarh Grigorie Dascălu, Mitropolitul Țării Românești", "Slujba și Acatistul Sfântului Ierarh Grigorie Dascălul, Mitropolitul Țării Românești"],
  "928|titlu":   ["Cum să trim ortodoxia astăzi", "Cum să trăim ortodoxia astăzi"],
  "929|titlu":   ["Moartea și dolul: O teologie a nădejdii", "Moartea și doliul: O teologie a nădejdii"],
  "948|titlu":   ["Csmologia creștină și teoriile fizice moderne", "Cosmologia creștină și teoriile fizice moderne"],
  "971|titlu":   ["Cuviasa Pelaghia Ivanovna, cea nebună pentru Hristos", "Cuvioasa Pelaghia Ivanovna, cea nebună pentru Hristos"],
  "1059|titlu":  ["Viața și minunile Părintelui Petru Boianski, noul mucenic (1973 - 1993)", "Viața și minunile Părintelui Petru Boiarski, noul mucenic (1973 - 1993)"],
  "1220|titlu":  ["Sfântul Spirido,n făcătorul de minuni, Episcopul Trimitundei și ocrotitorul Kerkirei", "Sfântul Spiridon, făcătorul de minuni, Episcopul Trimitundei și ocrotitorul Kerkirei"],
  "1305|titlu":  ["Slujind ”Unitatea Duhului întru leggătura păcii” - 15 ani de patriarhat al Preafericitul Părinte Daniel al României", "Slujind ”Unitatea Duhului întru legătura păcii” - 15 ani de patriarhat al Preafericitului Părinte Daniel al României"],
};

/** Sedila in loc de virgulita: t si s cu sedila sunt semnele turcesti, nu cele romanesti. */
const virgulita = (s) => s.replace(/ţ/g, "ț").replace(/ş/g, "ș")
  .replace(/Ţ/g, "Ț").replace(/Ş/g, "Ș");

/** Casuta goala, oricum ar fi scrisa. */
const gol = (v) => v == null || /^\s*(\*+|[-–—])\s*$/.test(v);

/** Curata o celula: virgulita, spatiile stranse, ce e gol devine `null`. */
const celula = (v) => {
  if (gol(v)) return null;
  return virgulita(String(v)).replace(/\s+/g, " ").trim() || null;
};

/**
 * Doua texte care spun acelasi lucru, deosebite doar prin semne. Daca aici ies egale,
 * ramane cel vechi (regula 4).
 */
const laFel = (a, b) => {
  const f = (s) => (s ?? "").replace(/\s+/g, " ")
    .replace(/…/g, "...").replace(/[’‘‛`´]/g, "'")
    .replace(/[„”“«»]/g, '"')
    .replace(/[–—]/g, "-").replace(/\.$/, "").trim();
  return f(a) === f(b);
};

const plat = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[șş]/gi, "s").replace(/[țţ]/gi, "t").toLowerCase();
const slugDin = (s) => plat(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/**
 * E ALTA CARTE la acelasi numar de inventar, sau tot aia cu titlul limpezit?
 *
 * Tot aia, cand un titlu incepe cu celalalt: parohia mai adauga o lamurire in coada —
 * "Ghidul Mănăstirilor din România" a devenit "… (conține hartă)", aceeasi carte, doar
 * cu editia noua trecuta langa ea. Alta carte, cand titlurile n-au nimic de-a face unul
 * cu altul: la nr. 108 "Dogmatica" era o greseala si a fost inlocuita cu "Pelerinaj la
 * Mormântul Domnului". Numai in cazul al doilea se schimba adresa.
 */
const altaCarte = (titluVechi, titluNou) => {
  const a = slugDin(titluVechi), b = slugDin(titluNou);
  return !(a === b || a.startsWith(b) || b.startsWith(a));
};

function slugLiber(baza, luate) {
  if (!luate.has(baza)) { luate.add(baza); return baza; }
  for (let i = 2; ; i++) { const s = `${baza}-${i}`; if (!luate.has(s)) { luate.add(s); return s; } }
}

/** Foaia "Carti": antet pe randul 5, datele de la 6 in jos, ultimul rand e TOTAL. */
async function citesteFoaia(xlsx) {
  await exec("python3", [XLSX_PY, xlsx, "/tmp/foaie.json"], { cwd: "/workspace" });
  const foi = JSON.parse(await readFile("/tmp/foaie.json", "utf8"));
  const toate = foi["Cărți"] ?? [];
  const data = toate.find((x) => /Data întocmirii/.test(x.c[0] ?? ""))?.c[0] ?? null;
  const carti = toate.filter((r) => r.r >= 6 && Number.isFinite(Number(r.c[0])));
  const randuri = carti.map((r) => {
    const nr = Number(r.c[0]);
    const ia = (i, camp) => {
      const indreptare = INDREPTARI[`${nr}|${camp}`];
      const brut = r.c[i];
      if (indreptare && brut != null && indreptare[0] === String(brut).replace(/\s+/g, " ").trim()) {
        indreptare[2] = "aplicata";
        return indreptare[1];
      }
      return brut;
    };
    return {
      nr,
      titlu: celula(ia(1, "titlu")),
      autor: celula(ia(2, "autor")),
      editura: celula(ia(3, "editura")),
      an: celula(ia(4, "an")),
      loc: celula(ia(5, "loc")),
      bucati: Number(r.c[6]) || null,
    };
  });
  return { randuri, data };
}

async function main() {
  const [ce, xlsx] = process.argv.slice(2);
  if (!xlsx) { console.error("folosire: node unelte/actualizeaza.mjs raport|scrie <fisier.xlsx>"); process.exit(1); }

  const vechi = JSON.parse(await readFile(CATALOG, "utf8"));
  const deNr = new Map(vechi.carti.map((c) => [c.nr, c]));
  const { randuri: foaie, data } = await citesteFoaia(xlsx);

  const raport = { foaie: xlsx.split("/").pop(), data, schimbari: [], noi: [], plecate: [],
                   sluguriNoi: [], pastrateVechi: [], indreptariNeaplicate: [] };
  for (const [cheie, v] of Object.entries(INDREPTARI)) {
    if (v[2] !== "aplicata") raport.indreptariNeaplicate.push({ cheie, cauta: v[0] });
  }

  // Intai se strang slugurile care raman ale cuiva, ca sa nu le calce unul nou.
  const luate = new Set();
  const alteCarti = new Set();
  for (const n of foaie) {
    const v = deNr.get(n.nr);
    if (!v) continue;
    if (!INDREPTARI[`${n.nr}|titlu`] && altaCarte(v.titlu, n.titlu)) alteCarti.add(n.nr);
    else luate.add(v.slug);
  }

  const carti = [];
  for (const n of foaie) {
    const v = deNr.get(n.nr);
    const c = { nr: n.nr, slug: null, titlu: n.titlu, autor: n.autor, editura: n.editura,
                an: n.an, loc: n.loc, bucati: n.bucati };

    if (v) {
      // Regula 4: unde deosebirea e numai de semne, ramane cum a fost.
      for (const k of ["titlu", "autor", "editura", "an", "loc"]) {
        if (v[k] != null && c[k] != null && laFel(v[k], c[k]) && v[k] !== c[k] && !INDREPTARI[`${n.nr}|${k}`]) {
          raport.pastrateVechi.push({ nr: n.nr, camp: k, vechi: v[k], foaie: c[k] });
          c[k] = v[k];
        }
      }
      if (alteCarti.has(n.nr)) {
        c.slug = slugLiber(slugDin(c.titlu), luate);
        raport.sluguriNoi.push({ nr: n.nr, vechi: v.slug, nou: c.slug, titluVechi: v.titlu, titluNou: c.titlu });
      } else {
        c.slug = v.slug;                        // regula 2: adresa nu se clinteste
      }
      for (const k of ["titlu", "autor", "editura", "an", "loc", "bucati"]) {
        const a = v[k] ?? null, b = c[k] ?? null;
        if (String(a) !== String(b)) raport.schimbari.push({ nr: n.nr, camp: k, vechi: a, nou: b, titlu: c.titlu });
      }
    } else {
      c.slug = slugLiber(slugDin(c.titlu), luate);
      raport.noi.push(c);
    }
    carti.push(c);
  }

  const inFoaie = new Set(foaie.map((x) => x.nr));
  for (const v of vechi.carti) if (!inFoaie.has(v.nr)) raport.plecate.push(v);

  const autori = new Set(), edituri = new Set();
  for (const c of carti) { if (c.autor) autori.add(c.autor); if (c.editura) edituri.add(c.editura); }

  const nou = {
    sursa: `foaia parohiei — ${raport.foaie}`,
    actualizatLaSursa: "2025-07-17",
    preluatLa: new Date().toISOString().slice(0, 10),
    total: carti.length,
    totalAutori: autori.size,
    totalEdituri: edituri.size,
    carti,
    autori: [...autori].sort((a, b) => a.localeCompare(b, "ro")),
    edituri: [...edituri].sort((a, b) => a.localeCompare(b, "ro")),
  };

  const numar = (l) => l.reduce((s, c) => s + (c.bucati ?? 0), 0);
  console.log(`titluri: ${vechi.total} → ${carti.length}   exemplare: ${numar(vechi.carti)} → ${numar(carti)}`);
  console.log(`autori (casute): ${vechi.totalAutori} → ${nou.totalAutori}   edituri: ${vechi.totalEdituri} → ${nou.totalEdituri}`);
  console.log(`carti noi: ${raport.noi.length}   plecate: ${raport.plecate.length}   sluguri schimbate: ${raport.sluguriNoi.length}`);
  console.log(`schimbari de valoare: ${raport.schimbari.length}   pastrate cum erau (numai semne): ${raport.pastrateVechi.length}`);
  console.log(`indreptari de mana: ${Object.keys(INDREPTARI).length}, dintre care neaplicate: ${raport.indreptariNeaplicate.length}`);
  for (const x of raport.indreptariNeaplicate) console.log(`   ! ${x.cheie} nu s-a gasit: "${x.cauta}"`);

  await writeFile("/data/catalog/raport-actualizare.json", JSON.stringify(raport, null, 1));
  console.log("raportul intreg: /data/catalog/raport-actualizare.json");

  if (ce === "scrie") {
    await writeFile("/data/catalog/catalog-vechi.json", JSON.stringify(vechi));
    await writeFile(CATALOG, JSON.stringify(nou, null, 1));
    console.log(`scris: ${CATALOG} (copia dinainte: catalog-vechi.json)`);
  } else {
    console.log("(raport — nu s-a scris nimic; \"scrie\" ca sa se scrie)");
  }
}

await main();
