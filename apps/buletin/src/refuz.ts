/**
 * „NICIUNUL" ÎNSEAMNĂ NU, NU TITLUL „NICIUNUL".
 *
 * Fapt din 19.09.2026, 11:03: chatul a propus trei titluri („Acestea sunt 3 posibile titluri: …
 * Folosim unul sau ai altă idee?"), omul a scris „Niciunul", iar titlul numărului a devenit literal
 * „Niciunul" — și a ajuns așa în PDF. Cauza: „niciunul" nu era în tiparul lui „nu", deci mesajul a
 * căzut la capătul potrivitorului, acolo unde ORICE text e chiar valoarea întrebării pendinte.
 *
 * ⚠️ Leacul nu e un tipar mai lung într-un singur loc: aceeași vorbă poate veni pe trei drumuri —
 * potrivitorul determinist (`harta.ts`), traducerea alegerii venite de la model (`traduFapta`) și
 * chemarea directă a lui `buletin.raspunde`. Lista de aici e păzitorul comun al celor trei, și de
 * aceea stă într-un modul fără nicio altă legătură: o poate importa și harta, și schița, fără cerc.
 *
 * ⚠️ REFUZUL E AL RĂSPUNSULUI, NU AL VALORII SPUSE ANUME. „titlu: Niciunul" rămâne titlul
 * „Niciunul" — omul a numit câmpul și a spus ce vrea în el. Numai vorba singură, venită ca RĂSPUNS
 * la o întrebare cu variante, se citește ca refuz.
 */

/** Câmpurile la care chatul PROPUNE ceva, deci la care un refuz are înțeles („sari peste"). */
export const CAMPURI_CU_VARIANTE = new Set(['titlu', 'autor', 'ani', 'pomenire', 'sursa'])

/**
 * Forma în care se compară vorbele de refuz: fără diacritice, cu litere mici, cratimele desfăcute
 * („nu-mi" = „nu mi"), fără punctuație și fără aer în plus. „Nici unul!" și „niciunul" ajung la fel.
 */
function normalizat(text: string): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-‐‑–—]/g, ' ')
    .replace(/[„”"«»'`.!?,;:…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // „nici unul" / „nici una" se scriu și legat: o singură formă de ținut minte mai jos
    .replace(/^nici (unul|una)\b/, (_, c: string) => `nici${c}`)
}

/**
 * VORBELE PRIN CARE OMUL REFUZĂ VARIANTELE PROPUSE. Închisă dinadins, ca lista de subiecte a lui
 * `buletin.raspunde`: un tipar larg („orice începe cu «nu»") ar înghiți și titluri adevărate
 * („NU JUDECA"), iar aici greșeala se vede abia pe hârtie.
 *
 * ⚠️ „altul" / „alta" intră aici FĂRĂ text după ele: omul spune că vrea altceva, dar încă n-a spus
 * ce — deci se sare, iar chatul îi spune că poate scrie el titlul oricând. „altul: DESPRE POST" nu
 * nimerește lista, fiindcă nu e vorba singură.
 */
export const CUVINTE_DE_REFUZ = new Set([
  'nu',
  'nu am',
  'nu are',
  'nu stiu',
  'nu vreau',
  'nu se stie',
  'niciunul',
  'niciuna',
  'niciunul dintre ele',
  'niciuna dintre ele',
  'nu mi place',
  'nu mi plac',
  'nu mi place niciunul',
  'nu mi place niciuna',
  'nu mi plac deloc',
  'nu imi place',
  'nu imi plac',
  'nu imi place niciunul',
  'nu imi place niciuna',
  'nu imi plac deloc',
  'altul',
  'alta',
  'altceva',
  'alt titlu',
  'alta idee',
  'am alta idee',
])

/** Vorba asta, singură, e un refuz al variantelor propuse? */
export function eRefuz(text: string): boolean {
  return CUVINTE_DE_REFUZ.has(normalizat(text))
}
