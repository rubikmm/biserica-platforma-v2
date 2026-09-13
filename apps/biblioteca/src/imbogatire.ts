/**
 * A12 · Ce stiu magazinele si editurile despre o carte, si noi nu.
 *
 * Catalogul parohiei tine minte sase lucruri: titlu, autor, editura, an, loc, cate
 * bucati. Atat a scris cine a facut evidenta, si atat trebuie ca sa gasesti cartea in
 * raft. Dar fisa unei carti aratata pe ecran e saraca fara o coperta si doua randuri
 * despre ce e inauntru — asa ca acelea se cauta pe la librariile ortodoxe si se aduc
 * aici, cu `unelte/imbogatire.mjs`.
 *
 * DOUA REGULI, si tin de fond, nu de cod:
 *
 * 1. **Ce se aduce sta deoparte.** Nu se scrie nimic in `catalog.json`. Imbogatirea e
 *    un al doilea fisier in acelasi bucket, legat de carte prin slug. O extragere noua
 *    din site-ul vechi n-o strica, iar daca se sterge cu totul, catalogul ramane intreg.
 *    Ce zice parohia ramane adevarul; ce zice magazinul e doar in completare.
 *
 * 2. **Se spune de unde vine.** Fiecare fisa imbogatita arata numele librariei si duce
 *    la pagina de acolo. Nu dam drept al nostru textul si coperta altcuiva, iar cine
 *    vrea sa cumpere cartea stie unde s-o caute.
 *
 * Copertile stau tot la noi, in acelasi bucket (`coperti/{slug}.jpg`), si se dau de la
 * `/coperta/{slug}.jpg`. Nu trimitem cititorul la magazin dupa poze: acolo linkul se
 * poate schimba oricand, iar browserul lui ar da de stire magazinului ce carti citeste.
 */

/** Ce s-a aflat despre o carte. Orice camp poate lipsi — se arata doar ce exista. */
export interface Imbogatire {
  pagini: number | null;
  descriere: string | null;
  isbn: string | null;
  format: string | null;
  coperta_tip: string | null;
  /** Anul si editura ASA CUM LE STIE MAGAZINUL — se arata doar cand difera de catalog. */
  an: string | null;
  editura: string | null;
  categorie: string | null;
  /** Numele fisierului copertei in bucket, sub `coperti/`. */
  coperta: string | null;
  /**
   * Cartea INTREAGA, acolo unde editura o da singura si gratuit — azi doar Predania
   * (cerere user, 7 sept. 2026). Fisierul sta in bucket sub `pdfuri/`, se da de la
   * `/pdf/{slug}.pdf`, iar pe fisa scrie limpede a cui e darul.
   */
  pdf: { fisier: string; octeti: number; sursa: { nume: string; url: string } } | null;
  sursa: { id: string; nume: string; url: string };
  adus_la: string;
}

/** Fisierul intreg, asa cum sta in bucket la cheia `imbogatire.json`. */
export interface FoaieImbogatire {
  facut_la: string;
  total: number;
  cu_coperta: number;
  cu_pagini: number;
  cu_pdf?: number;
  cu_descriere: number;
  surse: Record<string, { nume: string; gazda: string }>;
  carti: Record<string, Imbogatire>;
}

/** Foaia goala — cand fisierul inca n-a fost urcat, aplicatia merge mai departe fara el. */
export const FOAIE_GOALA: FoaieImbogatire = {
  facut_la: "", total: 0, cu_coperta: 0, cu_pagini: 0, cu_descriere: 0, cu_pdf: 0, surse: {}, carti: {},
};

/**
 * Citeste foaia din bucket. Daca lipseste, NU e o eroare: imbogatirea e in plus, nu
 * temelie. Catalogul trebuie sa se deschida si fara ea.
 */
export async function citesteImbogatirea(bucket: R2Bucket): Promise<FoaieImbogatire> {
  try {
    const o = await bucket.get("imbogatire.json");
    if (!o) return FOAIE_GOALA;
    const f = await o.json<FoaieImbogatire>();
    return f?.carti ? f : FOAIE_GOALA;
  } catch {
    return FOAIE_GOALA;
  }
}

/**
 * Semnul pus langa titlu, oriunde apare cartea intr-o lista: in rezultatele cautarii,
 * la autor, la editura, in vecinatatile altei carti. Spune ca fisa are mai mult decat
 * randul din tabel — coperta, cate pagini, doua randuri despre carte.
 *
 * E un semn, nu un cuvant: intr-un tabel de 1312 randuri un „îmbogățită" scris de
 * fiecare data ar ineca titlurile. `title` spune ce e, pentru cine sta cu mouse-ul pe
 * el, iar `aria-label` pentru cine asculta pagina. Cum arata se hotaraste mai tarziu,
 * la grafica (A4) — de aceea are clasa lui si nu culori scrise aici.
 *
 * De cand coperta sta la inceputul fiecarui rand (7 sept. 2026), cartea CU coperta nu
 * mai are nevoie de semn — coperta insasi spune ca fisa e completata (cerere user).
 * Semnul ramane doar pentru fisa completata fara coperta (descriere, pagini), unde
 * altfel nu s-ar vedea nimic in lista.
 */
export function semn(i: Imbogatire | undefined): string {
  if (!i || i.coperta) return "";
  const are = [
    i.descriere ? "descriere" : null,
    i.pagini ? `${i.pagini} pagini` : null,
  ].filter(Boolean);
  const ce = are.length ? are.join(", ") : "detalii";
  return ` <span class="imb" title="Fișă completată: ${ce}" aria-label="fișă completată">✦</span>`;
}
