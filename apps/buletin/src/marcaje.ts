/**
 * MARCAJELE OMULUI ÎN TEXTUL FOII — o singură convenție, aceeași peste tot (user, 19.09.2026, 18:01:
 * „aș vrea atât în texte cât și în titluri să am italic și bold: plain text: `_italic_` și `*bold*`…
 * și la sursa și la textul mare conținut articol").
 *
 *   `_între liniuțe de jos_` → cursiv  (`<i>`)
 *   `*între steluțe*`        → aldin   (`<b>`)
 *   amândouă, în orice ordine (`_*x*_`, `*_x_*`) → aldin cursiv
 *   fără marcaj → scris normal
 *
 * ⚠️ REGULA E PRUDENTĂ DINADINS. Liniuța de jos trăiește în URL-uri („/a_b_c") și în nume de fișier
 * („nume_fisier_2"), iar steluța e semnul înmulțirii („5 * 3"). De aceea un marcaj se DESCHIDE doar
 * la începutul șirului sau după spațiu / paranteză / ghilimea, se ÎNCHIDE doar înaintea sfârșitului,
 * a unui spațiu sau a unei punctuații, iar între ele stau 1–400 de semne care nu încep și nu se
 * termină cu spațiu. Un semn singur („5 * 3", „nume_fisier") rămâne ce a fost: literă pe hârtie.
 *
 * ⚠️ Stă în fișierul lui, nu în `foaie.ts`, fiindcă îl cere și `masuri.ts` (ca să nu numere
 * steluțele drept litere), iar `foaie.ts` îl importă deja pe `masuri.ts`: invers s-ar închide cercul.
 * `foaie.ts` le dă mai departe (`export { marcaj, curatDeMarcaje }`), acolo le caută restul codului.
 */

/**
 * Semnele după care un marcaj are voie să se DESCHIDĂ (plus începutul șirului).
 * `;` e coada unei entități (`&quot;_x_` vine din „_x_"), `>` e coada unui tag pus de noi —
 * `marcaj()` lucrează pe text DEJA escapat, deci alt `<` sau `>` nu există acolo.
 */
const DESCHIDERE = '\\s(\\[„“"«‚‹;>'
/** Semnele înaintea cărora are voie să se ÎNCHIDĂ (plus sfârșitul șirului). */
const INCHIDERE = '\\s.,;:!?)\\]”“"»…&<'

/**
 * Regula unui marcaj. `pereche` e semnul CELUILALT marcaj: el are voie să stea lipit, ca cele două
 * să se poată încuiba în orice ordine (`_*x*_` și `*_x_*`). Lipit de el însuși (`**x**`) nu are:
 * acolo omul n-a vrut un marcaj, ci două steluțe.
 */
const regula = (semn: string, pereche: string): RegExp =>
  new RegExp(
    `(?:^|(?<=[${DESCHIDERE}${pereche}]))${semn}((?!\\s)[^${semn}\\n]{1,400}(?<!\\s))${semn}(?:$|(?=[${INCHIDERE}${pereche}]))`,
    'g',
  )

/** `*aldin*` — se pune ÎNTÂI, ca steluțele să nu vadă tagurile cursivului. */
const ALDIN = regula('\\*', '_')
/** `_cursiv_` — al doilea: `*_x_*` a ajuns deja `<b>_x_</b>`, de asta `>` și `<` sunt în seturi. */
const CURSIV = regula('_', '\\*')

/**
 * Marcajele, puse pe un text DEJA ESCAPAT — în pagină nu ajunge niciodată alt HTML decât al nostru.
 * Se aplică la toate câmpurile de text ale foii: paragrafe, titluri, semnătură, mențiune, sursă,
 * motto. NU în zona neagră (autor / ani / pomenire): acolo scrisul e Trajan alb pe negru și numele
 * se desparte cu ` / `, deci rămâne brut.
 */
export const marcaj = (escapat: string): string =>
  escapat.replace(ALDIN, '<b>$1</b>').replace(CURSIV, '<i>$1</i>')

/**
 * Același text, cu marcajele ȘTERSE — pentru socoteală (`masuri.ts`): steluțele și liniuțele nu se
 * tipăresc, deci nu au voie să fie numărate ca litere, nici la rândurile textului, nici la geometria
 * titlului. Lucrează pe textul BRUT (nu escapat): acolo se numără semnele.
 *
 * ⚠️ Aceleași două reguli ca `marcaj()`, nu o ștergere lacomă a tuturor `*` și `_`: altfel
 * „nume_fisier_2" ar pierde liniuțele care se tipăresc.
 */
export const curatDeMarcaje = (text: string): string =>
  (text ?? '').replace(ALDIN, '$1').replace(CURSIV, '$1')

/**
 * BARA = RÂND NOU, dar NUMAI ÎN TITLU ȘI ÎN SEMNĂTURĂ (user, 19.09.2026, 18:07: „am vrut să scriu
 * și la titlu principal așa CHIPUL BLÂND/ AL DUHOVNICULUI și nu a mers… `/` să fie rând următor").
 * Cu sau fără aer în jur: „A/ B", „A / B", „A/B" se rup la fel, iar spațiile din jurul barei nu mai
 * ajung pe hârtie.
 *
 * ⚠️ NU e un marcaj al întregului text, de aceea stă în funcția lui și nu în `marcaj()`: bara e
 * literă cinstită în paragrafe („și/sau"), în sursă („http://x.ro/a/b") și în motto. Se cheamă doar
 * acolo unde omul desenează un rând: titlul articolului și semnătura de sub el. Zona neagră își are
 * despărțirea ei, mai veche și cu alt înțeles (`despartAutor` din `foaie.ts`).
 *
 * ⚠️ `curatDeMarcaje` NU o scoate: ea nu e un semn de stil, ci o rupere de rând. Unde se numără
 * semnele unui rând (`masuri.ts`) se desparte la ea și se măsoară fiecare bucată.
 *
 * ⚠️ ORDINEA: `randNou` se cheamă pe textul ESCAPAT, ÎNAINTE de `marcaj()` — pe două temeiuri.
 * Întâi, după marcaje în text umblă tagurile noastre, iar `</b>` are și el o bară: „DESPRE *POST*"
 * ar ieși „DESPRE <b>POST<br>b>". Al doilea, bara nu e printre semnele înaintea cărora un marcaj
 * are voie să se închidă, deci într-un titlu cu bara lipită de steluță aldinul nu s-ar pune; prefăcută
 * întâi în `<br>`, ea devine chiar `<`, semn de închidere primit (vezi `INCHIDERE`).
 */
export const BARA_RAND_NOU = /\s*\/\s*/

/**
 * Textul escapat, cu barele prefăcute în `<br>`. Bucățile goale („A /", „//") nu lasă rânduri.
 * Se cheamă ÎNTRE `esc()` și `marcaj()`.
 */
export const randNou = (escapat: string): string =>
  (escapat ?? '').split(BARA_RAND_NOU).filter((b) => b !== '').join('<br>')

/**
 * Aceleași bucăți, pentru socoteală: rândurile pe care le-a cerut omul cu bara. Niciodată listă
 * goală — un text fără bară e o singură bucată, el însuși.
 */
export const bucatiPeRanduri = (text: string): string[] => {
  const bucati = (text ?? '').split(BARA_RAND_NOU).map((b) => b.trim()).filter(Boolean)
  return bucati.length ? bucati : ['']
}
