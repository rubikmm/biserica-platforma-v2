/**
 * AȘTEPTAREA LUNGĂ a aparatului (long-poll), scoasă din obiectul durabil ca să poată fi probată.
 *
 * Aparatul din biserică stă după NAT, deci el cere comanda și ține cererea deschisă ~25 s: ori se
 * schimbă ceva și primește pe loc, ori iese la capătul așteptării cu aceeași versiune.
 *
 * ⚠️ **NIMIC NU SE MAI CITEȘTE DUPĂ AȘTEPTARE.** Asta e toată pricina pentru care bucata asta
 * există separat. Până pe 18.09.2026, ramura de expirare făcea încă o citire de storage — o citire
 * pornită dintr-un `setTimeout` parcat 25 de secunde. Când între timp obiectul durabil fusese mutat
 * ori repornit (Cloudflare o face singur), citirea cădea și cererea ieșea **HTTP 500**: între 2 și 23
 * pe zi, toate la capătul celor 25 s. Aparatul mergea mai departe pe ultima comandă, deci nu s-a
 * pierdut nimic — dar jurnalul era plin de erori care păreau ale emisiei.
 *
 * Reparația: ce s-a citit la INTRARE se ține în mână și se întoarce la expirare, iar cine schimbă
 * comanda trezește așteptătorii CU valoarea nouă în braț. Așa pe drumul ăsta nu mai există nicio
 * citire care să poată cădea.
 */

/** Mai mult de atât nu ținem o cerere deschisă: aparatul cere cel mult 25 s, noi lăsăm marjă. */
export const ASTEAPTA_MAX_S = 30

/** Câte secunde așteptăm de fapt. Orice număr fără noimă (lipsă, `NaN`, negativ) ajunge la o secundă. */
export function secundeDeAsteptare(secunde: number): number {
  if (!Number.isFinite(secunde)) return 1
  return Math.max(1, Math.min(secunde, ASTEAPTA_MAX_S))
}

/**
 * Așteaptă până când cineva trezește mulțimea (cu valoarea nouă) sau până se sfârșește timpul (și
 * atunci întoarce ce i s-a dat la intrare). În amândouă cazurile așteptătorul se scoate din
 * mulțime și ceasul se stinge, ca să nu rămână nimic agățat.
 */
export function asteaptaSchimbarea<T>(acum: T, secunde: number, asteptatori: Set<(nou: T) => void>): Promise<T> {
  return new Promise<T>((gata) => {
    const trezeste = (nou: T = acum) => {
      asteptatori.delete(trezeste)
      clearTimeout(ceas)
      gata(nou)
    }
    // `setTimeout` cheamă fără argumente, deci la expirare `nou` rămâne pe ce aveam la intrare.
    const ceas = setTimeout(trezeste, secundeDeAsteptare(secunde) * 1000)
    asteptatori.add(trezeste)
  })
}
