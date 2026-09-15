/**
 * Depozitul newsletterului: arhiva celor 459 de numere trimise, in R2 (`xc-newsletter-staging`).
 * Copiat obiect cu obiect din bucketul V1 — nu se refoloseste nimic.
 *
 *   lista.json                 fisa fiecarui numar: id, nr, subiect, data, rezumat
 *   cauta.json                 textul curat al fiecarui numar, pentru cautare
 *   stiri/<id>.html            newsletterul fara chenarul de email
 *   media/uploads/…            pozele si PDF-urile la care trimit newsletterele
 *
 * Lista citita o data ramane in memoria izolatului: se cere la fiecare pagina, iar fisa unui numar
 * nu se schimba dupa ce numarul a plecat pe email.
 *
 * ⚠️ DAR TINE DOAR CINCI MINUTE (15.09.2026). Pana azi tinea cat traia izolatul, adica oricat: la
 * prima aducere la zi a arhivei (`infrastructure/import/newsletter-live/adu-la-zi.mjs`) depozitul
 * avea 460 de numere si pagina arata in continuare 459 — lista veche statea in memorie, iar singurul
 * leac ar fi fost o republicare a workerului. Un numar nou tot nu se schimba dupa ce a plecat pe
 * email; ce se schimba e CATE sunt, si asta trebuie sa se vada fara deploy.
 */

/** O fisa din lista.json — atat stim despre un numar fara sa-l aducem intreg. */
export interface Fisa {
  id: number
  /** numarul buletinului, cand subiectul il spune („nr. 505"); anunturile n-au. */
  nr: number | null
  subiect: string
  /** „2024-10-23 14:00:00" — cand a plecat pe email. */
  trimis: string
  /** preheader-ul emailului: randul care se vedea in inbox sub subiect. */
  rezumat: string
}

/** Textul curat al unui numar, pentru cautare. */
export interface Text {
  id: number
  t: string
}

let lista: Fisa[] | null = null
let cititaLa = 0
/** Cat tine lista in memorie — cat si cache-ul paginilor (`CACHE_PAGINI`), ca cele doua sa nu se
 *  contrazica: n-are rost sa reimprospatam lista sub o pagina servita oricum din cache. */
const RABDARE_MS = 5 * 60 * 1000

/** Lista numerelor, in ordinea trimiterii — cel mai vechi primul, cel mai nou ultimul. */
export async function citesteLista(depozit: R2Bucket): Promise<Fisa[]> {
  if (lista && Date.now() - cititaLa < RABDARE_MS) return lista
  const o = await depozit.get('lista.json')
  lista = o ? await o.json<Fisa[]>() : []
  cititaLa = Date.now()
  return lista
}

/** Newsletterul unui numar — fragmentul de pagina, fara chenarul de email. */
export async function citesteNumarul(depozit: R2Bucket, id: number): Promise<string | null> {
  const o = await depozit.get(`stiri/${id}.html`)
  return o ? await o.text() : null
}

/** Textele tuturor numerelor. Se aduc doar cand se cauta — sunt cateva MB. */
export async function citesteTextele(depozit: R2Bucket): Promise<Text[]> {
  const o = await depozit.get('cauta.json')
  return o ? await o.json<Text[]>() : []
}
