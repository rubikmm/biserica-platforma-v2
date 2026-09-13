/**
 * A10-biblia · stilul LOCAL al aplicatiei.
 *
 * Se lipeste DUPA stilul global al carcasei (`@xc/ui`) si il suprascrie. In V1 fisierul era gol:
 * tot ce-i trebuia Bibliei statea in stilul comun. In V2 carcasa nu mai duce `.vers` (singurele
 * aplicatii care scriu versete sunt Biblia si Tipicul), deci regula sta local, aceeasi la amandoua.
 *
 * ⚠️ Fara backtick in comentarii: fisierul e un template literal.
 */
export const LOCAL = `
/* versetele: numarul marunt, in fata randului */
.vers b { color:var(--faint); font:600 12px ui-sans-serif,system-ui; margin-right:4px }

/* panoul de cautare, deschis din lupa din antet */
#panou-cauta { padding:10px 2px 6px }
#panou-cauta form { margin:0 }
`
