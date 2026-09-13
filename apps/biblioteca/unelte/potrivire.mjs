/**
 * A12 · Potrivirea unui titlu din catalog cu un titlu de la un magazin online.
 *
 * Titlurile nu sunt scrise la fel nicaieri: la noi vin din tabelul parohiei („Ne
 * vorbeste Parintele Cleopa, vol. 1"), la ei din fisa magazinului („Ne vorbeste
 * parintele Cleopa vol 1"). Se compara pe JETOANE, nu pe siruri, si jetoanele nu
 * cantaresc la fel: „biblia" spune mult mai mult decat „viata" sau „ortodox".
 *
 * Doua paze care taie potrivirile aratoase dar gresite:
 *  - VOLUMUL: „Biblia (vol. 1)" nu e „Paraclise vol 1", si nici „vol. 2" nu e „vol. 1".
 *  - ANUL si EDITURA se pun la socoteala DUPA ce fisa e adusa (vezi `confirma`).
 */

/** Fara diacritice si cu litere mici — aceeasi socoteala ca `plat` din src/nume.ts. */
export const plat = (s) =>
  String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[șş]/gi, "s").replace(/[țţ]/gi, "t").toLowerCase();

/** Cuvintele de legatura nu deosebesc doua carti — nu intra la socoteala. */
const LEGATURI = new Set(`
  a al ale ai la de din cu si in pe un o una ei lui sau spre catre dupa fara
  pentru prin peste sub intre ca ce cel cea cei cele acest aceasta
`.trim().split(/\s+/));

/** Cuvinte care apar pe fiecare a treia carte ortodoxa — le lasam, dar cantaresc putin
 *  de la sine, prin IDF. Aici nu se taie nimic pe lista neagra: IDF face treaba. */

export const jetoane = (s) =>
  plat(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .filter((t) => t && !LEGATURI.has(t));

/**
 * Al catelea volum, daca titlul o spune. Recunoaste „vol. 3", „volumul III", „partea a
 * II-a" si cifra romana singura la coada. `null` cand titlul nu pomeneste niciun volum.
 */
export function volumul(titlu) {
  const t = plat(titlu);
  const rom = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10,
                xi:11, xii:12, xiii:13, xiv:14, xv:15 };
  let m = t.match(/\b(?:vol|volumul|volume|partea|part|tomul|tom)\.?\s*(?:a\s*)?([ivx]+|\d{1,2})\b/);
  if (!m) m = t.match(/[\s(]([ivx]{1,5})[-\s]*a?\s*[)\s]*$/);
  if (!m) return null;
  const v = m[1];
  return /^\d+$/.test(v) ? Number(v) : (rom[v] ?? null);
}

/** Cat de rar e fiecare jeton in gramada lor de titluri. Rar = spune mult. */
export function greutati(titluri) {
  const df = new Map();
  for (const t of titluri) for (const j of new Set(jetoane(t))) df.set(j, (df.get(j) ?? 0) + 1);
  const N = titluri.length;
  return (j) => Math.log(N / (1 + (df.get(j) ?? 0))) + 0.35;
}

/**
 * Cat de mult seamana doua titluri: 0 deloc, 1 leit. Dice cantarit cu IDF —
 * cuvintele rare care se potrivesc urca scorul, cele comune abia il misca.
 * Zero taiat scurt cand volumele se bat cap in cap.
 *
 * Cuvintele se potrivesc si cand difera printr-o litera (de la cinci litere in sus).
 * Tabelul parohiei e scris de mana: „Identitatea si LIBERATEA omului", „Descoperire cu
 * amanuntul" fata de „cu amaruntul" al editurii. Fara ingaduinta asta, o singura litera
 * gresita nu doar ca nu aduce nimic, ci TRAGE SCORUL IN JOS de doua ori — cuvantul
 * gresit e rar, deci cantareste mult, si de-o parte, si de alta. Asa s-au pierdut, la
 * prima incercare din 7 sept. 2026, potriviri bune cu 0.73, la un prag de 0.80.
 * Potrivirea pe-o-litera cantareste 0.9 din cat ar fi cantarit una leita.
 */
export function seamana(a, b, idf) {
  const va = volumul(a), vb = volumul(b);
  if (va !== null && vb !== null && va !== vb) return 0;
  const A = [...new Set(jetoane(a))], B = [...new Set(jetoane(b))];
  if (!A.length || !B.length) return 0;
  const suma = (S) => S.reduce((n, j) => n + idf(j), 0);
  const inB = new Set(B), luate = new Set();
  let comun = 0;
  for (const j of A) if (inB.has(j)) { comun += idf(j); luate.add(j); }
  for (const j of A) {
    if (inB.has(j) || j.length < 5) continue;
    for (const k of B) {
      if (luate.has(k) || k.length < 5) continue;
      if (oLitera(j, k)) { comun += Math.min(idf(j), idf(k)) * 0.9; luate.add(k); break; }
    }
  }
  return (2 * comun) / (suma(A) + suma(B));
}

/** Numele de familie ale unui autor, ca sa vedem daca fisa adusa e a omului potrivit. */
export function numeDeFamilie(camp) {
  if (!camp) return new Set();
  return new Set(
    jetoane(camp).filter((t) => t.length >= 4 &&
      !/^(sfantul|sfanta|parintele|arhim|ierom|ierod|protos|mitrop|arhiep|episcop|monahul|monahia|monahie|prof|univ|coord|diac|staretul|cuviosul|fericitul|preot)$/.test(t)));
}

/**
 * Acelasi om in doua feluri de a-l scrie? Ingaduinta e la transliterare, nu la om:
 * „Teodoropulos"/„Theodoropulos", „Skartsiouni"/„Skartsiuni", „Anastasiu"/„Anastasiou",
 * „Damaschim"/„Damaschin" — o singura litera in plus, in minus sau schimbata e tot el.
 * Numele scurte trebuie sa fie leite: la „Ilie"/„Ilia" o litera e alt om.
 */
export function acelasiNume(aiNostri, aiLor) {
  for (const a of aiNostri)
    for (const b of aiLor) {
      if (a === b || (a.length >= 5 && b.length >= 5 && oLitera(a, b))) return true;
      const x = intors(a), y = intors(b);
      if (x === y || (x.length >= 5 && y.length >= 5 && oLitera(x, y))) return true;
    }
  return false;
}

/**
 * Acelasi nume trecut prin alta scoala de transcriere. Grecescul si slavonescul ajung
 * la noi pe doua-trei drumuri deodata: „Damaschin"/„Damaskin", „Theodoropoulos"/
 * „Teodoropulos", „Nikodim"/„Nicodim", „Symeon"/„Simeon". Se aduc toate la o forma
 * simpla — fara „h" de podoaba, cu „c" in loc de „k", cu „i" in loc de „y" — si abia
 * atunci se compara. Nu uneste oameni deosebiti: numele scurte cer tot potrivire leita.
 */
function intors(x) {
  return x
    .replace(/sch/g, "sc").replace(/ch/g, "c").replace(/th/g, "t").replace(/ph/g, "f")
    .replace(/kh/g, "h").replace(/k/g, "c").replace(/y/g, "i").replace(/w/g, "v")
    .replace(/ou/g, "u").replace(/ei/g, "i").replace(/ae/g, "e")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Bucatile unui titlu lung, ca sa se poata potrivi si cand magazinul il scrie mai scurt.
 * Tabelul parohiei pune in titlu si ce n-ar sta pe coperta: „Razboiul nevazut (o noua
 * traducere dupa originalul grecesc)", „Pacate si virtuti - Cele 7 pacate de moarte si
 * virtutile care le corespund", „Sfantul Teodor Studitul - Despre datoria de a marturisi".
 * Coada asta e rara, deci cantareste mult si trage scorul sub prag desi cartea e in lista
 * lor (8 sept. 2026: 115 din cele 249 de carti fara niciun candidat aveau paranteza sau
 * subtitlu). Se dau, in ordine: CAPUL (pana la prima paranteza, liniuta sau doua puncte),
 * daca are macar doua cuvinte care inseamna ceva; COADA (ce e dupa), daca are macar trei —
 * o coada scurta („Catehism") ar prinde orice. Titlul fara nicio taietura nu da nimic.
 */
export function variante(titlu) {
  const t = String(titlu ?? "").trim();
  const m = t.match(/^(.+?)\s*(?:\(|\s[-–—]\s|:\s)(.*)$/s);
  if (!m) return [];
  const cap = m[1].trim();
  const coada = m[2].replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const out = [];
  if (cap !== t && jetoane(cap).length >= 2) out.push(cap);
  if (jetoane(coada).length >= 3) out.push(coada);
  return out;
}

/**
 * Cel mai bun scor dintre titlul intreg si bucatile lui; `varianta` spune care bucata a
 * mers (null cand a mers intregul). Volumul se pazeste pe titlul INTREG: capul isi pierde
 * „(vol. 3)", si fara paza asta „Ne vorbeste Parintele Cleopa (vol. 3)" ar lua fisa
 * volumului 1.
 */
export function seamanaOricum(a, b, idf) {
  const va = volumul(a), vb = volumul(b);
  if (va !== null && vb !== null && va !== vb) return { scor: 0, varianta: null };
  let scor = seamana(a, b, idf), varianta = null;
  for (const v of variante(a)) {
    const s = seamana(v, b, idf);
    if (s > scor) { scor = s; varianta = v; }
  }
  return { scor, varianta };
}

/** Cel mult o litera diferenta (Levenshtein <= 1), fara matrice. */
function oLitera(a, b) {
  if (a.length === b.length) {
    let rele = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++rele > 1) return false;
    return true;
  }
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [lung, scurt] = a.length > b.length ? [a, b] : [b, a];
  let i = 0, j = 0, sarit = false;
  while (i < lung.length && j < scurt.length) {
    if (lung[i] === scurt[j]) { i++; j++; continue; }
    if (sarit) return false;
    sarit = true; i++;
  }
  return true;
}
