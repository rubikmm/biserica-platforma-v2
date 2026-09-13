/**
 * Întrebări frecvente — `faq.php` din V1, cuvânt cu cuvânt. Pagină publică.
 *
 * Singurul răspuns schimbat e cel despre parolă: în V1 „doar administratorii au parolă"; în V2
 * nimeni nu are parolă nici la administrare — se intră cu contul platformei, cu cod pe e-mail.
 */

import { MIN_VOLUNTARI } from "../config.js";
import { esc } from "@xc/ui";
import { type Ctx, pagina } from "../pagina.js";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Cum mă programez la o duminică?",
    a: "Apasă pe butonul <strong>Autentificare</strong> din colțul dreapta-sus, alege-ți numele din listă, apoi apasă pe oricare slot „liber\" la duminica dorită. Slotul devine verde — ești înscris(ă).",
  },
  {
    q: "Cum mă dezînscriu de la o duminică?",
    a: "Apasă din nou pe slotul tău ocupat (cel cu numele tău). Se eliberează imediat.",
  },
  {
    q: "Am ales o poziție greșită. Cum schimb?",
    a: "Apasă pe poziția corectă din aceeași duminică. Slotul vechi se eliberează automat și ocupi pe cel nou — fără mesaje extra.",
  },
  {
    q: "Nu mă găsesc în lista de voluntari. Ce fac?",
    a: "Vorbește cu un administrator. Lista lor și datele de contact apar în secțiunea de <strong>Autentificare</strong> (click pe nume să vezi telefon / email). Ei te pot adăuga în sistem.",
  },
  {
    q: "Ce înseamnă „liber\" pe un buton?",
    a: "Slotul nu e ocupat încă. Apasă pe el ca să te înscrii.",
  },
  {
    q: "Ce înseamnă butonul „+\"?",
    a: `Apare doar când toate cele ${MIN_VOLUNTARI} sloturi de bază sunt deja ocupate. Click pe „+\" adaugi un voluntar în plus (al ${MIN_VOLUNTARI + 1}-lea, apoi al ${MIN_VOLUNTARI + 2}-lea etc.).`,
  },
  {
    q: "De ce nu pot modifica o duminică din trecut?",
    a: "Duminicile deja consumate sunt blocate — rămân ca istoric și nu pot fi schimbate.",
  },
  {
    q: "De ce nu pot modifica luna trecută?",
    a: "Sloturile sunt editabile doar pentru luna curentă și luna viitoare. Lunile anterioare apar în „Arhivă\" — doar pentru vizualizare.",
  },
  {
    q: "Cum mă programez pentru luna viitoare?",
    a: "În secțiunea Calendar, apasă pe „Luna viitoare\". Acolo poți alege sloturi la fel ca în luna curentă.",
  },
  {
    q: "Cum mă deconectez?",
    a: "Apasă pe numele tău din colțul dreapta-sus → <strong>Ieșire</strong>.",
  },
  {
    q: "Aplicația merge pe telefon?",
    a: "Da, este optimizată pentru mobil. Poți chiar să o salvezi pe ecranul principal: pe iOS din Safari → Share → Add to Home Screen; pe Android din Chrome → meniul ⋮ → Add to Home Screen.",
  },
  {
    q: "Trebuie să introduc parolă?",
    a: "Nu, nimeni. Voluntarii își aleg numele din listă și asta e tot. Administratorii intră cu contul parohiei — email și un cod de șase cifre, fără parolă nici ei.",
  },
  {
    q: "Aplicația mă „ține minte\"?",
    a: "Da. Browser-ul reține pe ce nume te-ai conectat și data viitoare intri direct pe el. Dacă apeși „Ieșire\", trebuie să re-alegi numele — dar butonul tău rămâne evidențiat în listă.",
  },
];

/** Stilul întrebărilor frecvente (același și la FAQ-ul de administrare). */
export const STIL_FAQ = `
.faq-group { margin-bottom: 28px; }
.faq-group-title {
    margin: 0 0 10px;
    font-size: 1.1rem;
    color: var(--accent-dark);
    font-weight: 700;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
}
details.faq-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 8px;
}
details.faq-item[open] { border-color: var(--accent); }
details.faq-item summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--text);
    list-style: none;
    position: relative;
    padding-right: 24px;
}
details.faq-item summary::-webkit-details-marker { display: none; }
details.faq-item summary::after {
    content: '+';
    position: absolute;
    right: 0;
    top: -2px;
    color: var(--accent-dark);
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
    transition: transform 0.15s;
}
details.faq-item[open] summary::after { content: '−'; }
.faq-answer {
    margin-top: 10px;
    color: var(--text);
    font-size: 0.95rem;
}
.faq-answer code {
    background: var(--tinta);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.92em;
}
.back-btn {
    display: inline-block;
    margin-bottom: 20px;
    padding: 8px 14px;
    background: var(--accent);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
}
.back-btn:hover { background: var(--accent-dark); }
`;

export function paginaFaq(ctx: Ctx): string {

  const corp = `<a href="${esc(ctx.prefix)}/" class="back-btn">← Înapoi la Programare</a>

            <section class="faq-group">
                <h2 class="section-title">Întrebări frecvente</h2>
                ${FAQ.map((item) => `<details class="faq-item">
                        <summary>${esc(item.q)}</summary>
                        <div class="faq-answer">${item.a}</div>
                    </details>`).join("\n                ")}
            </section>`;

  return pagina(ctx, { titluPagina: "Întrebări frecvente", corp, local: STIL_FAQ });
}
