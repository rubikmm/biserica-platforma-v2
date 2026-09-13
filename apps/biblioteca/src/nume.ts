/**
 * A12 · Numele din catalog — cum se despart, cum se unesc, cum se scriu, dupa ce se aseaza.
 *
 * Autorii vin din tabelul vechi asa cum i-a scris cine a tinut evidenta: cu titlul in
 * fata („Arhim. Cleopa Ilie", „Sfantul Ioan Gura de Aur"), cate doi-trei intr-o casuta
 * („Arhim. Antipa Dinescu, Ierom. Petroniu Tanase"), si acelasi om scris in mai multe
 * feluri („Arhim Cleopa Ilie", „Arhim. Cleopa Ilie", „Parintele Cleopa Ilie"). Patru
 * treburi, in ordinea asta:
 *
 * 1. DESPARTIREA — `autorii()` taie casuta in oameni, la virgula, dar numai unde dupa
 *    virgula chiar incepe altcineva, nu functia celui dinainte („Daniel, Patriarhul
 *    B.O.R." ramane un singur om).
 * 2. UNIREA — `slugAutor()` da acelasi slug pentru acelasi om scris altfel: fara titlu,
 *    fara diacritice, fara paranteze. Slugul e identitatea; `numeUnit()` alege apoi un
 *    singur fel de a-l scrie.
 * 3. SCRISUL — titlul trece la coada, prescurtat: „Arhim. Cleopa Ilie" -> „Cleopa Ilie,
 *    Arhim.". Asa se vede din prima ca numele e numele, si de ce sta omul la litera lui.
 * 4. ASEZAREA — `numeDeAsezare()`, `litera()` si `dupaNume()` sorteaza si grupeaza dupa
 *    numele omului, nu dupa titlu.
 *
 * Datele din R2 nu se ating: tot ce urmeaza se petrece la citire si la afisare.
 * La EDITURI socoteala e alta si mult mai scurta — vezi `TITLURI`.
 */

export type Fel = "autor" | "editura";

/** Fara diacritice si cu litere mici — folosit si la cautare, si la slug-uri. */
export const plat = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[șş]/gi, "s").replace(/[țţ]/gi, "t").toLowerCase();

/** Un cuvant adus la forma de cautat in liste: fara diacritice, puncte sau virgule. */
const cheie = (s: string) => plat(s).replace(/[.,;]/g, "");

/**
 * Titlul cum se scrie la noi. Cheia e cuvantul platit (fara punct), valoarea e forma
 * de aratat. Toate sunt prescurtari: „Arhimandrit", „Arhim" si „Arhim." ies deopotriva
 * „Arhim.". Tot aici se indreapta si doua greseli de tipar din tabelul vechi
 * („Pritoiereul", „Stavrofoa").
 */
const PRESCURTARI: Record<string, string> = {
  sfantul: "Sf.", sfanta: "Sf.", sfantului: "Sf.", sfintei: "Sf.", sfintii: "Sf.",
  sf: "Sf.", st: "Sf.",
  fericitul: "Fer.", fericita: "Fer.",
  cuviosul: "Cuv.", cuvioasa: "Cuv.", preacuviosul: "Preacuv.", preacuvioasa: "Preacuv.",
  parintele: "Pr.", parinte: "Pr.", preot: "Pr.", preotul: "Pr.", pr: "Pr.",
  arhimandrit: "Arhim.", arhim: "Arhim.",
  schiarhimandrit: "Schiarhim.", schiarhim: "Schiarhim.",
  ieromonah: "Ierom.", ierom: "Ierom.",
  ieroschimonah: "Ieroschim.", ieroschim: "Ieroschim.",
  ierodiacon: "Ierod.", ierod: "Ierod.",
  protosinghel: "Protos.", protos: "Protos.",
  protopresbiter: "Protopresb.", protopresb: "Protopresb.",
  protoiereu: "Protoiereu", protoiereul: "Protoiereu", pritoiereul: "Protoiereu",
  diacon: "Diac.", diac: "Diac.",
  episcop: "Ep.", episcopul: "Ep.", ep: "Ep.",
  arhiepiscop: "Arhiep.", arhiepiscopul: "Arhiep.", arhiep: "Arhiep.",
  mitropolit: "Mitrop.", mitropolitul: "Mitrop.", mitrop: "Mitrop.",
  stavrofoa: "Stavrofora", stavrofora: "Stavrofora",
  ips: "ÎPS", ps: "PS", pf: "PF",
  prof: "Prof.", conf: "Conf.", lect: "Lect.", asist: "Asist.", univ: "Univ.",
  acad: "Acad.", dr: "Dr.", drd: "Drd.", ing: "Ing.", dipl: "Dipl.",
  coord: "Coord.",
};

/**
 * Titluri care se sar la asezare dar se lasa asa cum sunt scrise: nu au o prescurtare
 * incetatenita, deci nu inventam una.
 */
const NEPRESCURTATE = `
  monah monahul monahia maica staretul stareta egumen egumenul egumena
  avva gheron gheronda vladica papa patriarh patriarhul
  protodiacon protopop prot protopsalt decan psiholog presbitera paroh
  ierarh mucenic mucenita sfintit sfintita marele apostol proroc doc
`.trim().split(/\s+/);

/**
 * Ce trece drept titlu, pe fiecare fel de nume.
 *
 * La EDITURI lista e scurta dinadins: doar „Ed."/„Editura", cuvantul de prisos din fata.
 * „Manastirea", „Episcopia", „Fundatia", „Sfantul Nectarie", „Mitropolitul Iacov
 * Putneanul" NU sunt titluri acolo — sunt chiar numele editurii, si se aseaza la litera
 * lor. Un „Sfantul" taiat la autori e cuvenit; taiat la edituri ar muta editura aiurea.
 */
const TITLURI: Record<Fel, Set<string>> = {
  autor: new Set([...Object.keys(PRESCURTARI), ...NEPRESCURTATE]),
  editura: new Set(["ed", "editura", "edit"]),
};

/**
 * Cuvintele dupa care un „Sfanta"/„Ed." din fata nu mai e titlu, ci inceputul numelui
 * unui asezamant: „Sfanta Manastire Paraclitou" ramane la S, nu ajunge la M.
 */
const ASEZAMINTE = new Set(`
  manastire manastirea manastiri schit schitul
  episcopia arhiepiscopia mitropolia patriarhia protoieria parohia
  chinovia obstea fratia asociatia fundatia tipografia
`.trim().split(/\s+/));

const eMare = (c: string) => c === c.toUpperCase() && c !== c.toLowerCase();

/** Cuvantul incepe cu litera mare? Parantezele si ghilimelele nu se pun la socoteala. */
const cuMare = (cuvant: string | undefined) => {
  const litere = (cuvant ?? "").replace(/^[^\p{L}]+/u, "");
  return litere.length > 0 && eMare(litere[0]!);
};

/** Cate cuvinte de la inceput sunt titlu, luate crud — fara nicio judecata pe urma. */
function titluDinFata(bucati: string[], fel: Fel): number {
  let i = 0;
  while (i < bucati.length && TITLURI[fel].has(cheie(bucati[i] ?? ""))
         && !ASEZAMINTE.has(cheie(bucati[i + 1] ?? ""))) i++;
  return i;
}

/**
 * Cate cuvinte de la inceput se taie. Zero daca numele incepe de-a dreptul, daca titlul
 * ar inghiti tot numele, sau daca dupa taiere n-ar mai ramane un nume propriu —
 * „Isihast anonim" si „Editura de suflet" raman intregi, ca acolo cuvantul din fata e
 * chiar numele.
 *
 * Initialele nu sunt titluri: „N. Steinhardt", „V. Voiculescu", „I. Popescu-Pasarea",
 * „K. V. Zorin" stau la litera lor, cum e drept. Singura litera scurta trecuta in tabel
 * e „St.", care in catalog e englezescul Saint („St. Theophan the Recluse").
 */
function catTitlu(bucati: string[], fel: Fel): number {
  const i = titluDinFata(bucati, fel);
  if (i === 0 || i >= bucati.length) return 0;
  return cuMare(bucati[i]) ? i : 0;
}

/**
 * Dupa virgula incepe alt OM, sau doar functia celui dinainte?
 *
 *   „Ierom. Petroniu Tanase"   -> alt om: dupa titlu vin doua cuvinte cu litera mare
 *   „Ciprian Voicila"          -> alt om
 *   „Ep. Auxentie de Foticeea" -> alt om: „Auxentie … Foticeea", desi are un „de" la mijloc
 *   „Patriarhul B.O.R."        -> nu: dupa titlu ramane un singur cuvant
 *   „Mitropolit de Suroj"      -> nu: dupa titlu vine „de", cu litera mica
 *   „Arhiepiscopia Bucurestilor" -> nu: e mai departe numele aceluiasi asezamant
 */
function eAltOm(bucata: string): boolean {
  const cuvinte = bucata.trim().split(/\s+/).filter(Boolean);
  const rest = cuvinte.slice(titluDinFata(cuvinte, "autor"));
  if (rest.length === 0 || !cuMare(rest[0])) return false;
  if (ASEZAMINTE.has(cheie(rest[0]!))) return false;
  return rest.filter(cuMare).length >= 2;
}

/**
 * Casuta „autor" taiata in oameni. O carte poate avea doi, trei sau patru; in tabelul
 * vechi stau despartiti prin virgula — dar tot prin virgula se leaga si functia de nume,
 * asa ca se taie numai unde dupa virgula chiar incepe altcineva (vezi `eAltOm`).
 */
export function autorii(camp: string | null | undefined): string[] {
  if (!camp || !camp.trim()) return [];
  const out: string[] = [];
  for (const b of camp.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (out.length > 0 && !eAltOm(b)) out[out.length - 1] += ", " + b;
    else out.push(b);
  }
  // Si „X si Y" poate fi doi oameni („Averchie Tausev si Ierom Seraphim Rose"), dar numai
  // daca fiecare bucata sta singura in picioare: „Oana si Alexandru Iftime" e o pereche
  // care imparte numele de familie, iar „Mitropolia Munteniei si Dobrogei" e un singur
  // asezamant — acolo nu se taie.
  return out.flatMap((p) => {
    const bucati = p.split(/\s+(?:și|si)\s+/);
    return bucati.length > 1 && bucati.every(eAltOm) ? bucati : [p];
  });
}

/** Slugul unui nume, ca la extragere: platit, cu liniute in loc de orice altceva. */
export function slugDin(s: string): string {
  return plat(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

/**
 * Numele scris cu initiala in loc de prenume. In tabelul vechi cateva nume au ramas asa
 * cum se semna cartea („I. Popescu-Pasarea", „V. Voiculescu"), iar in lista de autori o
 * initiala singura nu spune nimic: nu se stie cine e omul si nu se cauta dupa el.
 *
 * Cheia e slugul numelui FARA titlu, asa cum e scris in catalog; valoarea e numele intreg.
 * Fiecare rand e o cautare facuta de mana si o hotarare omeneasca, ca la `ACEIASI`: se
 * sterge randul si numele se intoarce la initiala. Unde prenumele nu s-a putut afla,
 * numele ramane cum e — nu inventam un prenume ca sa arate bine.
 *
 *   I. Popescu-Pasarea   Ion Popescu-Pasarea (1871-1943), profesor si compozitor psaltic
 *   V. Voiculescu        Vasile Voiculescu (1884-1963), poetul
 *   Al. N. Constantinescu  Alexandru N. Constantinescu (1895-1985), preot la Sf. Ilie Rahova
 *   V. Maleaghin         Vladimir Maleaghin (Vladimir Iurievici Maliaghin), scriitor rus
 *   S. A. Arhanghelow    Serafim A. Arhanghelow, autorul „Tainelor vietii de dincolo" (1897)
 *   Chr. V. Schmidt      Christoph von Schmid (1768-1854) — si numele de familie era stalcit
 */
const INTREGI: Record<string, string> = {
  "i-popescu-pasarea": "Ion Popescu-Pasărea",
  "v-voiculescu": "Vasile Voiculescu",
  "al-n-constantinescu": "Alexandru N. Constantinescu",
  "v-maleaghin": "Vladimir Maleaghin",
  "s-a-arhanghelow": "Serafim A. Arhanghelow",
  "chr-v-schmidt": "Christoph von Schmid",
};

/**
 * Ghilimelele din jurul unui nume se scot la afisare. In tabelul vechi sunt puse cum s-a
 * nimerit — „Parinti Aghioriti" cu ghilimele peste tot numele, „Manastirea ”Sfantul
 * Pantelimon” Teleorman" cu ele la mijloc, iar una a ramas fara ghilimeaua de inchidere.
 * Nu spun nimic despre nume si strica asezarea: un nume care incepe cu ” ajunge la „#",
 * nu la litera lui. Datele din R2 raman cum sunt — asta se petrece numai la citire.
 */
export const faraGhilimele = (s: string) =>
  s.replace(/[„”“"«»]/g, "").replace(/\s+/g, " ").trim();

/** Titlul din fata, prescurtat („Pr. Prof. Dr."), sau „" daca numele n-are titlu. */
export function titluDin(nume: string): string {
  const bucati = nume.trim().split(/\s+/);
  const n = catTitlu(bucati, "autor");
  return bucati.slice(0, n).map((b) => {
    const scurt = PRESCURTARI[cheie(b)];
    // Daca se deosebeste doar prin litera mare/mica („dr." fata de „Dr."), lasam cum era.
    return scurt && scurt.toLowerCase() !== b.toLowerCase() ? scurt : b;
  }).join(" ");
}

/**
 * Numele fara titlul din fata. Ce sta dupa virgula („Mitropolitul Moscovei") ramane.
 * Aici se intregeste si initiala prenumelui, daca numele e in `INTREGI` — asa slugul,
 * litera, sortarea si numele aratat pornesc toate de la acelasi nume intreg.
 */
export function faraTitlu(nume: string): string {
  const bucati = faraGhilimele(nume).trim().split(/\s+/);
  const gol = bucati.slice(catTitlu(bucati, "autor")).join(" ");
  return INTREGI[slugDin(gol)] ?? gol;
}

/**
 * Numele de ARATAT: intai omul, apoi titlul, prescurtat si la fel peste tot. Titlul in
 * fata trage ochiul la functie si pare ca lista e prost asezata; la coada spune acelasi
 * lucru fara sa incurce. Numai la autori — editurile se arata cum sunt in catalog.
 *
 *   „Arhim. Cleopa Ilie"           -> „Cleopa Ilie, Arhim."
 *   „Pr Prof Dr Dumitru Staniloae" -> „Dumitru Staniloae, Pr. Prof. Dr."
 *   „Sfantul Ioan Gura de Aur"     -> „Ioan Gura de Aur, Sf."
 *   „Danion Vasile"                -> neatins: n-are titlu
 *   „Cleopa Ilie, Arhim."          -> neatins: titlul e deja la coada
 */
export function numeAfisat(nume: string): string {
  const t = titluDin(nume);
  return t ? `${faraTitlu(nume)}, ${t}` : nume.trim();
}

/**
 * Numele dupa care se SORTEAZA si se GRUPEAZA — omul, fara titlu si fara ce sta dupa
 * virgula. E si cheia dupa care se unesc variantele aceluiasi om.
 *
 *   „Arhim. Cleopa Ilie" si „Cleopa Ilie, Arhim." -> „Cleopa Ilie"   (litera C)
 *   „Pr. Prof. Acad. Dr. D. Popescu"              -> „D. Popescu"    (litera D)
 *   „Sfantul Filaret, Mitropolitul Moscovei"      -> „Filaret"       (litera F)
 */
export function numeDeAsezare(nume: string, fel: Fel = "autor"): string {
  if (fel === "editura") {
    const bucati = faraGhilimele(nume).trim().split(/\s+/);
    return bucati.slice(catTitlu(bucati, "editura")).join(" ");
  }
  return (faraTitlu(nume).split(",")[0] ?? "").trim();
}

/**
 * Identitatea unui autor: slugul numelui fara titlu. Acelasi om scris altfel ajunge la
 * acelasi slug, si asa se uneste de la sine —
 *
 *   „Arhim. Ioanichie Bălan", „Ierom. Ioanichie Balan"      -> ioanichie-balan
 *   „Arhim. Ioachim (Parr)", „Schiarhim. Ioachim Parr"      -> ioachim-parr
 *   „Diac. Ioan I. Ica jr.", „Coord. Diac. Ioan I. Ică jr." -> ioan-i-ica-jr
 *
 * Intra si ce sta dupa virgula, dinadins: la sfinti si la ierarhi scaunul e singurul
 * lucru care-i deosebeste („Inochentie, Arhiepiscopul Odessei" nu e acelasi cu
 * „Inochentie, Episcop de Kamceatka"). Pentru sortare si litera se ia doar numele —
 * vezi `numeDeAsezare`.
 *
 * Ce e scris chiar altfel („Serafim" fata de „Seraphim") nu se poate ghici din litere;
 * pentru acelea e tabelul `ACEIASI` de mai jos.
 */
export const slugScris = (nume: string) => slugDin(faraTitlu(nume));

/**
 * Acelasi om, scris cu alt nume. Ce se poate uni dupa litere (titlu, diacritice,
 * paranteze) se uneste singur in `slugScris`; aici stau numai perechile pe care nicio
 * regula nu le poate ghici: „Serafim" fata de „Seraphim", „Ierotei Vlahos" fata de
 * „Hierotheos Vlachos", „Theophan the Recluse" fata de „Teofan Zavoratul".
 *
 * E singurul loc din fisier unde sta o hotarare omeneasca, si de aceea e scris pe fata:
 * fiecare rand zice „asta e acelasi om cu asta", iar numele aratat e al celui din
 * dreapta. Cine nu e de acord cu un rand il sterge, si autorul se desparte la loc.
 */
const ACEIASI: Record<string, string> = {
  "serafim-rose": "seraphim-rose",
  "serafim-alexiev": "seraphim-alexiev",
  "ierotei-vlahos": "hierotheos-vlachos",
  "iertheos-mitropolit-al-nafpaktosului": "hierotheos-vlachos",
  "hierotheos-mitropolit-de-nafpaktos": "hierotheos-vlachos",
  "antonie-mitropolit-de-suroj": "antonie-de-suroj",
  "antonie-bloom-mitrop-surojului": "antonie-de-suroj",
  "n-steinhardt": "nicolae-steinhardt",
  "ion-vladuca": "ioan-vladuca",
  "stelian-papadopoulos": "stelianos-papadopoulos",
  "epifanie-teodoropulos": "epifanie-teodoropoulos",
  "benedict-stanciu": "benedict-stancu",
  "atanasie-rakovalis": "athanasie-rakovalis",
  "paul-evdokimos": "paul-evdokimov",
  "roeo-petrasciuc": "romeo-petrasciuc",
  "efrem-filothetul": "efrem-filotheitul",
  "stefanos-anagnostopouls": "stephanos-anagnostopoulos",
  "ioan-krestian": "ioan-krestiankin",
  "dimitriu-c-skartsiuni": "dimitriou-k-skartsiouni",
  "auxentios-al-foticeii": "auxentie-de-foticeea",
  "grigorie-al-nyssei": "grigorie-de-nyssa",
  "tihon-din-zadonsk": "tihon-de-zadonsk",
  "ioan-din-kronstadt": "ioan-de-kronstadt",
  "fermo": "ecaterina-fermo",
  "gheorghe-calciu": "gheorghe-calciu-dumitreasa",
  "constantin-valer-necula": "constantin-necula",
  "ioan-iacob-de-la-piatra-neamt-hozevitul": "ioan-iacob-romanul-de-la-hozeva",
  "k-v-zorin": "konstantin-v-zorin",
  "justinian-chira": "iustinian-chira",
  "simeon-noul-cuvantatoriu-de-dumnezeu": "simeon-noul-teolog",
  "theophan-the-recluse": "teofan-zavoratul",
  "nicolae-m-popescu": "niculae-m-popescu",
  "nicolae-al-ohridei-si-jicei": "nicolae-velimirovici",
};

/** Identitatea unui autor, cu tabelul `ACEIASI` aplicat. Asta e slugul din adresa. */
export const slugAutor = (nume: string) => ACEIASI[slugScris(nume)] ?? slugScris(nume);

/** Cate diacritice are un nume — intre doua feluri de a-l scrie, cel cu ele e cel bun. */
const diacritice = (s: string) => (s.match(/[ăâîșțĂÂÎȘȚ]/g) ?? []).length;

/**
 * Dintr-un pumn de feluri de a scrie acelasi om (fiecare cu cate carti are), unul singur
 * de aratat. Numele si titlul se aleg PE RAND, si asta conteaza: numele dupa cum e scris
 * mai ingrijit (cu diacritice) si mai des, titlul dupa cat de des e pus. Altfel „Arhim
 * Cleopa Ilie" (15 carti) ar pierde in fata lui „Parintele Cleopa Ilie" (3) numai fiindca
 * acela are un „a" cu caciula. La egalitate se ia prescurtarea („Ierom." inaintea lui
 * „Monahul"), apoi forma mai lunga („Monahul" inaintea lui „Monah").
 */
export function numeUnit(variante: Map<string, number>): string {
  const nume = new Map<string, number>();
  const titluri = new Map<string, number>();
  const aduna = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const [v, n] of variante) {
    aduna(nume, faraTitlu(v), n);
    aduna(titluri, titluDin(v), n);
  }
  const celMaiBun = (m: Map<string, number>, cuGrija: boolean) =>
    [...m.entries()].sort((a, b) =>
      (cuGrija ? diacritice(b[0]) - diacritice(a[0]) : 0) || b[1] - a[1] ||
      Number(b[0].includes(".")) - Number(a[0].includes(".")) ||
      b[0].length - a[0].length || a[0].localeCompare(b[0], "ro"))[0]?.[0] ?? "";
  const n = celMaiBun(nume, true);
  const t = celMaiBun(titluri, false);
  return t ? `${n}, ${t}` : n;
}

/**
 * Dintr-un pumn de feluri de a scrie aceeasi editura, unul singur de aratat.
 *
 * In tabelul vechi opt edituri stau scrise in doua feluri („Credința strămoșească" si
 * „Credința Strămoșească", „Mănăstirea Slatioara" si „Mănăstirea Slătioara", „AXA" si
 * „Axa"). Pana acum figurau ca doua edituri diferite, iar pagina uneia arata numai
 * jumatate din titluri — cealalta jumatate era la geamana ei, cu acelasi slug, deci
 * de neajuns. Se unesc dupa slug, ca autorii, si se alege un singur fel de scris:
 * cel cu diacritice, apoi cel mai des intalnit, apoi cel care nu striga cu majuscule.
 */
export function numeEditura(variante: Map<string, number>): string {
  const strigat = (v: string) => Number(v === v.toUpperCase() && /\p{L}{2}/u.test(v));
  return [...variante.entries()]
    .map(([v, n]) => [faraGhilimele(v), n] as [string, number])
    .sort((a, b) =>
      diacritice(b[0]) - diacritice(a[0]) || b[1] - a[1] ||
      strigat(a[0]) - strigat(b[0]) || a[0].localeCompare(b[0], "ro"))[0]?.[0] ?? "";
}

/** Litera sub care sta un nume in listele pe litere. „#" pentru ce nu incepe cu A-Z. */
export function litera(nume: string, fel: Fel): string {
  const p = (plat(numeDeAsezare(nume, fel))[0] ?? "").toUpperCase();
  return p >= "A" && p <= "Z" ? p : "#";
}

/**
 * Cartile fara autor. In tabelul vechi casuta autorului era goala sau „****", iar pana
 * acum cele 351 de titluri nu se vedeau de nicaieri din lista de autori — existau, dar
 * nu erau ale nimanui. Acum stau la un loc, sub „#", si se ajunge la ele ca la orice
 * autor. „#" e litera in care listele tin oricum tot ce nu incepe cu A-Z.
 */
export const FARA_AUTOR = { slug: "fara-autor", nume: "Fără autor", litera: "#" };

/** Comparatia pentru liste: dupa numele fara titlu, cu regulile limbii romane. */
export const dupaNume = (fel: Fel) => (a: string, b: string) =>
  numeDeAsezare(a, fel).localeCompare(numeDeAsezare(b, fel), "ro");
