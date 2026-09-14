import { STIL_BUTON } from './buton.js'
import { STIL_PANOU } from './panou.js'
import { STIL_PLAYER } from './player.js'

/**
 * Stilul emisiei — se lipește DUPĂ stilul global al carcasei și îl completează.
 *
 * Paleta de semnal (verde = cântă / ales, albastru = buton de acțiune, roșu/galben = alertă) e
 * adusă din V1 cu tot cu varianta pentru tema întunecată. În V1 culorile erau scrise fix și pe
 * temă închisă ieșeau verde-închis pe negru sau cartele albe (reclamat de utilizator, 6.09.2026);
 * de aceea fiecare are perechea ei, pe același mecanism ca în carcasă (sistem + `data-tema`).
 */
export const STIL_EMISIE = `
:root {
  --verde:#16a34a; --verde-text:#166534; --verde-fund:rgba(22,163,74,.08);
  --bun:#15803d; --rau:#b91c1c;
  --albastru-btn:#2563eb; --albastru-btn-hover:#1d4ed8;
  --alerta-fund:#fef2f2; --alerta-rama:#fecaca; --alerta-text:#991b1b;
  --atentie-fund:#fffbeb; --atentie-rama:#fde68a; --atentie-text:#92400e;
}
@media (prefers-color-scheme: dark) { :root:not([data-tema="light"]) {
  --verde:#22c55e; --verde-text:#4ade80; --verde-fund:rgba(34,197,94,.14);
  --bun:#4ade80; --rau:#f87171;
  --albastru-btn:#2f6fe0; --albastru-btn-hover:#3b82f6;
  --alerta-fund:rgba(220,38,38,.16); --alerta-rama:rgba(248,113,113,.45); --alerta-text:#fca5a5;
  --atentie-fund:rgba(234,179,8,.14); --atentie-rama:rgba(250,204,21,.4); --atentie-text:#fde68a;
} }
:root[data-tema="dark"] {
  --verde:#22c55e; --verde-text:#4ade80; --verde-fund:rgba(34,197,94,.14);
  --bun:#4ade80; --rau:#f87171;
  --albastru-btn:#2f6fe0; --albastru-btn-hover:#3b82f6;
  --alerta-fund:rgba(220,38,38,.16); --alerta-rama:rgba(248,113,113,.45); --alerta-text:#fca5a5;
  --atentie-fund:rgba(234,179,8,.14); --atentie-rama:rgba(250,204,21,.4); --atentie-text:#fde68a;
}
${STIL_PLAYER}
${STIL_PANOU}
${STIL_BUTON}`
