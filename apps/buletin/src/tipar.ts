/**
 * BROȘURA — PDF-ul unui numar, asezat pentru TIPAR SI PLIERE (cerere user, 17.09.2026: „un buton de
 * tip «Tipărește»… ar trebui să tipărească «booklet». Deci ar trebui să creăm o variantă specială
 * pentru acest buton: o variantă de PDF").
 *
 * Buletinul are patru pagini A4 (595×842 pt). Ca sa iasa o brosura, cele patru se pun cate DOUA pe
 * o coala culcata, in ordinea plierii — nu in ordinea citirii:
 *
 *      coala, fata:  [ p4 | p1 ]        pliezi la mijloc si iese
 *      coala, verso: [ p2 | p3 ]        exact foaia parohiei, in ordine
 *
 * ⚠️ ORDINEA NU E O SOCOTEALA LA NIMEREALA: pagina din dreapta fetei e prima, iar cea din stanga e
 * ULTIMA. Regula, pentru orice numar de pagini multiplu de patru (coala `s`, numarate de la 1):
 *      fata  = [ n - 2s ,  1 + 2s ]
 *      verso = [ 2 + 2s ,  n - 1 - 2s ]
 * Numerele care lipsesc (un numar cu 6 pagini, de pilda) raman pagini albe — se completeaza pana la
 * urmatorul multiplu de patru, altfel plierea n-ar da o brosura.
 *
 * ⚠️ DOUA FELURI DE COALA. Cel cerut de user (17.09.2026: „A4 imprimanta / booklet și îndoit, în
 * final e un A5 îndoit") e PRIMUL, si e cel implicit:
 *   - `a4` (IMPLICIT) — coala A4 culcata, cu paginile micsorate ca sa incapa doua (A4 → A5). Se
 *     tipareste pe imprimanta parohiei, se indoaie, si iese o brosura A5. Scrisul ramane la ~71%
 *     din cel al foii mari — asta e intelegerea, nu o scapare;
 *   - `a3` — coala de DOUA ori cat pagina, deci paginile raman la marimea lor adevarata (A4 → A3).
 *     Pentru cine ajunge vreodata la un copiator A3: brosura iese identica cu foaia de azi.
 *
 * Tiparul e fata-verso obisnuit; asezarea colilor e tot ce trebuie sa dam noi („nu contează — se
 * tipărește corect când se scanează în jos, doar trebuie booklet" — user, 17.09.2026).
 *
 * ⚠️ REVERSUL (user, 17.09.2026, 22:00: „există imprimante care au nevoie de opțiunea specială ca
 * interiorul să fie întors ca să iasă cu un booklet… dacă apăs tipărește și am revers ON foaia a doua
 * este întoarsă 180 de grade"). Unele imprimante intorc coala pe latura scurta la fata-verso, si
 * atunci versoul iese cu capul in jos fata de fata. Cu `revers`, fiecare VERSO din brosura se roteste
 * cu 180° (atributul de rotire al paginii, pe care il asculta si vizualizatorul, si imprimanta), ca
 * dupa intoarcerea imprimantei sa cada la loc. Fata nu se atinge. E un comutator al omului, nu al
 * numarului — de aceea sta in adresa (`?revers=1`) si in cheia din depozit, nu in baza.
 */
import { PDFDocument, degrees } from 'pdf-lib'

export type Coala = 'a3' | 'a4'

/** A4 culcata, in puncte — masura colii cand se cere `a4`. */
const A4_CULCAT = { latime: 841.89, inaltime: 595.28 }

/**
 * Perechile de pagini, coala cu coala: intai fata, apoi versoul ei, apoi coala urmatoare.
 * Numerele sunt de la 1; `0` inseamna pagina alba (numarul n-avea atatea).
 */
export function ordineaBrosurii(pagini: number): Array<[number, number]> {
  const n = Math.ceil(Math.max(pagini, 1) / 4) * 4
  const coli: Array<[number, number]> = []
  for (let s = 0; s < n / 4; s++) {
    const gol = (p: number): number => (p <= pagini ? p : 0)
    coli.push([gol(n - 2 * s), gol(1 + 2 * s)]) // fata
    coli.push([gol(2 + 2 * s), gol(n - 1 - 2 * s)]) // verso
  }
  return coli
}

/**
 * PDF-ul brosurii, facut din PDF-ul numarului. Intoarce octetii gata de servit.
 *
 * ⚠️ Masura colii se ia din PRIMA pagina a numarului, nu dintr-o constanta: arhiva are 619 numere
 * scanate de-a lungul a paisprezece ani, si nu toate sunt A4 la milimetru. La `a3` coala e mereu
 * dublul paginii, deci socoteala merge si pentru un numar iesit din tipar cu alta masura.
 * ⚠️ Paginile se aseaza CENTRAT pe jumatatea lor, fara rotire: plierea e pe verticala, la mijlocul
 * colii, iar o pagina rotita ar iesi culcata in brosura.
 */
export async function brosura(pdf: ArrayBuffer, coala: Coala = 'a4', revers = false): Promise<Uint8Array> {
  const sursa = await PDFDocument.load(pdf)
  const pagini = sursa.getPageCount()
  const intai = sursa.getPage(0).getSize()

  const foaie =
    coala === 'a4'
      ? A4_CULCAT
      : { latime: intai.width * 2, inaltime: intai.height }
  const jumatate = foaie.latime / 2
  // aceeasi scara pe amandoua laturile: o pagina intinsa pe o singura latura s-ar deforma
  const scara = Math.min(jumatate / intai.width, foaie.inaltime / intai.height)

  const iesire = await PDFDocument.create()
  iesire.setTitle(sursa.getTitle() ?? 'Buletinul parohiei — broșură')
  iesire.setCreator('Platforma parohiei Sfântul Ilie')

  // Se lipesc o singura data toate paginile sursei, apoi se desenează de cate ori e nevoie.
  const lipite = await iesire.embedPages(sursa.getPages())

  ordineaBrosurii(pagini).forEach(([stanga, dreapta], i) => {
    const foaia = iesire.addPage([foaie.latime, foaie.inaltime])
    // fata e la index par, versoul la impar — versoul se intoarce cu capul in jos cand e cerut reversul
    if (revers && i % 2 === 1) foaia.setRotation(degrees(180))
    for (const [nr, deLaX] of [
      [stanga, 0],
      [dreapta, jumatate],
    ] as Array<[number, number]>) {
      if (!nr) continue // pagina alba
      const p = lipite[nr - 1]
      if (!p) continue
      const lat = p.width * scara
      const inalt = p.height * scara
      foaia.drawPage(p, {
        x: deLaX + (jumatate - lat) / 2,
        y: (foaie.inaltime - inalt) / 2,
        xScale: scara,
        yScale: scara,
      })
    }
  })
  return await iesire.save()
}

/** Coada numelui: felul colii si, cand e cerut, reversul — ca `a4`, `a4-revers` si `a3` sa nu se calce. */
const coada = (coala: Coala, revers: boolean): string => `brosura-${coala}${revers ? '-revers' : ''}`

/** Numele sub care se serveste brosura — cel al numarului, cu „-brosura" la coada. */
export const numeBrosura = (cheiePdf: string, coala: Coala, revers = false): string =>
  `${cheiePdf.slice(cheiePdf.lastIndexOf('/') + 1).replace(/\.pdf$/i, '')}-${coada(coala, revers)}.pdf`

/** Cheia sub care se tine in depozit, ca sa nu se refaca la fiecare apasare. */
export const cheiaBrosurii = (cheiePdf: string, coala: Coala, revers = false): string =>
  `tipar/${cheiePdf.replace(/\.pdf$/i, '')}-${coada(coala, revers)}.pdf`
