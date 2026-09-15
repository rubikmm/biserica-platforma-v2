import { STIL_SETARI } from "@xc/setari"
/**
 * Stilul LOCAL al newsletterului. Se lipeste DUPA stilul comun din `@xc/ui` si il suprascrie — la
 * specificitate egala castiga ce e mai jos.
 *
 * Vine cuvant cu cuvant din V1 (`biserica-newsletter/src/stil.ts`, v0.6.5): regulile de aici sunt
 * ale emailurilor randate cu motorul MailPoet, adunate bucata cu bucata pana au aratat bine — „e
 * multa munca acolo pe care nu vreau s-o refac acum" (user, 10.09.2026).
 *
 * ⚠️ Fara accent grav in comentariile de aici: stilul e un template literal, iar un backtick intr-un
 * comentariu inchide sirul si `tsc` scoate erori fara legatura cu locul vinovat.
 */
export const LOCAL = `
/* ARHIVA — un rand pe numar: data marunta la stanga, subiectul dupa ea.
   Nu tabel: pe telefon subiectele sunt lungi si un tabel le-ar rupe urat. */
.luna { margin:30px 0 6px }
.numere { list-style:none; padding:0; margin:0 }
.numere li { padding:9px 0; border-bottom:1px solid var(--rule) }
.numere li:last-child { border-bottom:0 }
.numere .cand { display:inline-block; min-width:58px; color:var(--faint);
                font:13px/1.5 ui-sans-serif,system-ui }
.numere a { color:var(--ink); text-decoration:none }
.numere a:hover { color:var(--rosu); text-decoration:underline }
/* la cautare randurile vin din ani diferiti, deci data poarta si anul — ii trebuie loc */
.numere.cu-an .cand { min-width:88px }
.cate { color:var(--faint); font-size:14px; margin:2px 0 0 }

/* NEWSLETTERUL. Ce se vede aici e emailul asa cum a plecat — tabele si culori
   proprii, scrise acum ani. De-aia are nevoie de doua lucruri:
   1. sa scape de stilul global de tabel (chenare, padding, majuscule la <th>),
   2. sa ramana pe fundal alb si text negru si la tema intunecata — un email nu
      are tema, iar culorile lui sunt scrise in el cu inline style. */
.email { background:#fff; color:#111; border:1px solid var(--rule); border-radius:12px;
         overflow:hidden; margin:18px 0 0 }
.email table { border-collapse:collapse; width:auto; font-size:inherit }
/* Resetul NU atinge text-align si vertical-align: emailul isi spune singur alinierea prin
   atributele "align" si "valign" de pe celule, iar acelea pierd in fata oricarei reguli
   de autor. O regula text-align:inherit aici ar descentra tot ce emailul a centrat. */
.email td, .email th { padding:0; border:0;
                       font:inherit; letter-spacing:normal; text-transform:none; color:inherit }
.email img { max-width:100%; height:auto }
/* MailPoet scoate pozele cu display:block — iar un bloc nu se centreaza din text-align,
   oricat ar scrie align="center" pe celula. In inbox trec fiindca clientii de email nu
   respecta display; intr-un browser adevarat stau la stanga. De-aia: margini automate,
   dar numai in celulele care CHIAR cer centrare (crucea din capul fiecarui numar, poza
   de antet, ilustratiile). Cerere user, 8 sept. 2026: "centreaza crucea". */
.email td[align="center"] img { margin-left:auto; margin-right:auto }
/* Previzualizarea buletinului parohiei — pagina scanata a foii. In email sta intr-o
   coloana de 220 px, langa una de 440: bine pentru un inbox, prea mic pentru o pagina
   scrisa marunt. Aici randul se desface pe verticala si scanarea ia toata latimea.
   Semnul dupa care o cunoastem e numele fisierului, "buletin-nr…" (349 din 448 de
   numere) — nu linkul spre PDF, fiindca numerele mai vechi pun scanarea fara link.
   Numai randurile care CHIAR poarta scanarea; celelalte coloane raman cum au fost
   scrise. (Cerere user, 8 sept. 2026: "este mic dar trebuie sa fie 100% width".) */
.email td:has(> div > table img[src*="buletin-nr"]) > div,
.email td:has(> div > table img[src*="buletin-nr"]) > div > table {
  max-width:100% !important; width:100% !important }
.email img[src*="buletin-nr"] { width:100% }
.email a { text-decoration:underline }
.email hr { margin:0 }
/* fundalul cenusiu al ramei de email nu-si are rostul intr-o pagina: pagina e rama */
.email .mailpoet_template, .email .mailpoet-wrapper { background:transparent !important }
/* media queries proprii ale MailPoet, luate din emailurile randate */
@media screen and (max-width: 480px) {
  .email .mailpoet_button { width:100% !important }
}
@media screen and (max-width: 599px) {
  .email .mailpoet_header { padding:10px 20px }
  .email .mailpoet_button { width:100% !important; padding:5px 0 !important;
                            box-sizing:border-box !important }
  .email div, .email .mailpoet_cols-two, .email .mailpoet_cols-three { max-width:100% !important }
}

/* MENIUL din antet — acelasi tipar ca la A2 Programul (cerere user, 8 sept. 2026: "aceeasi
   navigare sus, dar fara pdf si jpg"): sagetile cresc cat le lasa randul, bulina ramane cat
   un punct, apoi o bara despartitoare si butoanele mici — Arhiva si lupa. Fara tinta, un
   buton ramane pe loc, estompat (.gol): randul nu joaca. */
.btns .gol { opacity:.35; pointer-events:none }
.btns .btn { min-width:0 }
/* bulina din mijloc: un punct, fara text, la fel de inalta ca sagetile; duce mereu la
   cel mai nou numar si ramane apasata cand chiar pe el esti */
.btns .punct { flex:0 0 auto; display:flex; align-items:center; justify-content:center;
               padding-left:20px; padding-right:20px }
.btns .punct::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.btns .punct:hover { color:var(--rosu); border-color:var(--rosu) }
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }
/* butoanele mici: nu cresc, stau cat le tine continutul */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px }
.btns .mic svg { vertical-align:0 }
/* formularul de cautare, sub linia antetului */
#cautare { margin:2px 0 8px }
#cautare button { flex:0 0 auto; padding:9px 18px; border:1px solid var(--rule);
                  border-radius:10px; background:none; color:var(--ink);
                  font:15px ui-sans-serif,system-ui; cursor:pointer }
#cautare button:hover { border-color:var(--rosu); color:var(--rosu) }
/* pe telefon nu incap si cuvintele sagetilor: raman doar ◀ si ▶ */
@media (max-width:600px) {
  .btns { gap:7px }
  .btns .cuv { display:none }
  .btns .mic { padding-left:10px; padding-right:10px }
  .btns .punct { padding-left:14px; padding-right:14px }
}
mark { background:var(--azi-fund); color:inherit; padding:0 2px; border-radius:3px }
.gol { color:var(--soft) }
` + STIL_SETARI
