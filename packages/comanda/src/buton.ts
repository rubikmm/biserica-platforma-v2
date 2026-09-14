/**
 * Butonul UNIC de ascultare (play / stop), adus din V1 neschimbat.
 *
 * Cererea utilizatorului (7.09.2026): „în loc de pornește și oprește, un buton de play, acel
 * triunghi, și un buton de stop, acel pătrat. Nu ar trebui să mai fie două butoane, pentru că
 * oricum play-ul rămâne dezactivat după ce e apăsat și cântă."
 *
 * Deci UN singur element `#asculta`, cu două înfățișări: `data-mod="play"` (triunghi, cât stă
 * oprit) și `data-mod="stop"` (pătrat, cât cântă). Amândouă formele sunt în același SVG, iar CSS-ul
 * o ascunde pe cea care nu e la rând — așa nu se reîncarcă nimic la apăsare.
 */

/** `clasa` = stilul local al paginii (`direct-btn` pe paginile publice, `ctl-player-btn` în panou). */
export function butonPlayStop(clasa: string): string {
  return (
    `<button id="asculta" type="button" class="${clasa} btn-ps" data-mod="play" aria-label="Ascultă" title="Ascultă" disabled>` +
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
    `<polygon class="ps-play" points="8,5 19,12 8,19"></polygon>` +
    `<rect class="ps-stop" x="6" y="6" width="12" height="12" rx="1.5"></rect>` +
    `</svg></button>`
  )
}

/** Se lipește ULTIMUL în stilul local, ca să bată regulile de buton ale paginilor. */
export const STIL_BUTON = `
/* Butonul unic play/stop: rotund, cu forma in mijloc; culorile raman ale paginii. */
.btn-ps { padding:0; width:60px; height:60px; border-radius:50%;
  display:inline-flex; align-items:center; justify-content:center; line-height:0 }
.btn-ps svg { width:26px; height:26px; fill:currentColor }
.btn-ps[data-mod="play"] svg { transform:translateX(2px) }  /* triunghiul pare centrat abia asa */
.btn-ps[data-mod="play"] .ps-stop { display:none }
.btn-ps[data-mod="stop"] .ps-play { display:none }
/* In panou playerul e o cartela intre comenzi — butonul e mai mic decat pe pagina publica. */
.ctl-player .btn-ps { width:48px; height:48px }
.ctl-player .btn-ps svg { width:21px; height:21px }
`
