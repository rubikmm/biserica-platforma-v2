/**
 * `@xc/comanda` — partea COMUNĂ a celor două aplicații ale emisiei: `live` și `radio`.
 *
 * În V1 totul era o singură aplicație (`transmisiuni`). Utilizatorul a cerut-o împărțită în două
 * subdomenii (14.09.2026), dar cu ACELAȘI admin — iar radioul și directul rămân două fețe ale
 * aceluiași lucru: nu pot merge deodată, se aud prin același player, se comandă din același panou.
 * Ce e comun stă aici, scris o dată:
 *
 *   - `ceas.ts`   socoteala pură a radioului (ce piesă, ce secundă) — aceeași în amândouă și pe
 *                 aparatul din biserică;
 *   - `player.ts` playerul cu două surse și trecere lină, pentru cele două pagini publice și panou;
 *   - `panou.ts`  panoul de administrare, identic în amândouă aplicațiile;
 *   - `buton.ts`  butonul unic play/stop.
 *
 * Nimic de aici nu atinge rețeaua, depozitul sau obiectele durabile: alea sunt ale aplicațiilor.
 * Așa panoul nu trebuie să știe care dintre cele două îl servește.
 */
export * from './ceas.js'
export * from './buton.js'
export * from './player.js'
export * from './panou.js'
export { STIL_EMISIE } from './stil.js'
