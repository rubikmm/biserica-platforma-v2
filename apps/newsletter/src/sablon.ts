/**
 * ȘABLONUL newsletterului — „zona fixă": ANTETUL și SUBSOLUL care se lipesc la fiecare buletin nou
 * (cerere user, 16.09.2026: „definește undeva două bucăți de HTML afișate în zona de Setări, cu
 * antetul și subsolul pe care să mai putem interveni pe viitor").
 *
 *   sablon/antet.html    cele două poze, și atât: crucea și titlul „Buletinul Online"
 *   sablon/subsol.html   poza părintelui Arsenie Papacioc, titlul, citatul, grupul de WhatsApp, adresa
 *
 * Formele sunt luate din ULTIMUL newsletter trimis, nu scrise de mână (unealta:
 * `infrastructure/import/newsletter-live/sablon-din-numar.mjs`) — grafica se ia din ce există, nu se
 * reface (regula casei, 10.09.2026).
 *
 * ⚠️⚠️ REGULA CARE NU SE ÎNCALCĂ — ȘABLONUL NU E ARHIVA. Fiecare newsletter trimis își păstrează
 * forma LUI, întreagă, în `stiri/<id>.html`: o fotografie a clipei în care a plecat. Bucățile de aici
 * se INSEREAZĂ la facerea unui buletin nou și atât — deci o schimbare în ele nu atinge și nu rescrie
 * niciun număr din arhivă, oricât de vechi. („Fiecare Newsletter care se generează își salvează forma
 * din acel moment — snapshot", user, 16.09.2026.) Dacă vreodată cineva vrea „să îndrepte" arhiva
 * dintr-o schimbare de șablon, răspunsul e nu: arhiva e mărturia a ce a primit omul pe e-mail.
 *
 * ⚠️ Se citesc din depozit, nu din cod, tocmai ca să se poată schimba fără publicare.
 */

/** Cele două bucăți fixe. `null` = bucata nu e (încă) în depozit. */
export interface Sablon {
  antet: string | null
  subsol: string | null
}

const CHEI = { antet: 'sablon/antet.html', subsol: 'sablon/subsol.html' } as const

/**
 * ⚠️ Ține CINCI MINUTE în memoria izolatului, ca și lista numerelor: șablonul se schimbă de mână, rar,
 * dar când se schimbă trebuie să se vadă fără republicarea workerului (lecția plătită cu `lista.json`
 * pe 15.09.2026).
 */
let cache: { sablon: Sablon; la: number } | null = null
const RABDARE_MS = 5 * 60 * 1000

export async function citesteSablon(depozit: R2Bucket): Promise<Sablon> {
  if (cache && Date.now() - cache.la < RABDARE_MS) return cache.sablon
  const [antet, subsol] = await Promise.all([
    depozit.get(CHEI.antet).then((o) => (o ? o.text() : null)),
    depozit.get(CHEI.subsol).then((o) => (o ? o.text() : null)),
  ])
  const sablon = { antet, subsol }
  cache = { sablon, la: Date.now() }
  return sablon
}
