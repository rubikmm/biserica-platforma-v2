/**
 * Întrebările administratorilor — `admin/faq.php` din V1. Poarta e `cleaning.manage`, ținută în
 * `index.ts`.
 *
 * Trei răspunsuri s-au rescris, fiindcă lucrul despre care vorbeau nu mai există: parola de admin
 * (schimbarea ei și „am uitat parola") și felul în care se dă dreptul de administrare.
 */

import { esc } from "@xc/ui";
import { type Ctx, pagina } from "../pagina.js";
import { STIL_FAQ } from "../pagini/faq.js";

/** Întrebările (răspunsurile conțin HTML de încredere, ca în PHP — nu se escapează). */
export const ADMIN_FAQ: { q: string; a: string }[] = [
  {
    q: "Cum adaug un voluntar nou?",
    a: "Tab „Voluntari\" → completează formularul de sus (prenume, nume, email, telefon) → „Adaugă voluntar\".",
  },
  {
    q: "Cum fac un voluntar admin?",
    a: "Comutatorul <strong>„Admin\"</strong> din cartela lui îl trece ca administrator <em>al echipei</em>: apare primul în listă și primește rapoartele din oficiu. <strong>Dreptul de a intra în panou nu se dă de aici</strong> — el se dă contului lui din Administrarea platformei, ca permisiunea <code>cleaning.manage</code>.",
  },
  {
    q: "Ce este toggle-ul „Voluntar\"?",
    a: "Marchează dacă persoana este un voluntar care participă la curățenie. Implicit ON. Poți avea admini care nu sunt voluntari (toggle off) — ei nu apar în secțiunea de programare a duminicii, dar pot administra.",
  },
  {
    q: "Ce este toggle-ul „Monitor\"?",
    a: "Marchează cineva care primește <strong>newsletter-ul</strong>, dar nu are acces de admin. Util pentru oameni informați despre programări fără să facă modificări.",
  },
  {
    q: "Cum dezactivez un voluntar (fără să-l șterg)?",
    a: "Click pe butonul „Dezactivează\" din cardul voluntarului. Iese din listă, dar istoricul programărilor rămâne intact.",
  },
  {
    q: "Cum schimb numele scurt sau prescurtarea unui voluntar?",
    a: "Tab „Voluntari\" → click „Editează\" la un voluntar. „Nume scurt\" se generează automat din nume; „Prescurtare\" (slug URL) o poți edita manual sau o lași goală pentru regenerare.",
  },
  {
    q: "Cum șterg complet mesajele de sistem?",
    a: "Tab „Mesaje de sistem\" → buton roșu <strong>„Șterge tot logul\"</strong>.",
  },
  {
    q: "Cum filtrez mesajele de sistem?",
    a: "În tab-ul „Mesaje de sistem\" apar chip-uri colorate pentru fiecare tip de eveniment. Click pe unul → afișează doar mesajele de acel tip. Click pe „Toate\" → revii la lista completă.",
  },
  {
    q: "Cum funcționează newsletter-ul?",
    a: "Fila „Newsletter\" — vezi cui i se trimite (Administratori + Monitori + Voluntari programați pentru duminică). Butonul „Trimite acum\" îl pornește cu mâna. Ceasul aplicației bate din oră în oră și trimite singur la ziua și ora setate (implicit: sâmbătă, ora 16). <strong>Scrisorile pleacă prin poșta platformei</strong>, care ține și arhiva livrărilor — aplicația nu mai trimite email singură, ca varianta veche.",
  },
  {
    q: "Cum schimb ziua și ora de trimitere automată a newsletter-ului?",
    a: "Tab „Newsletter\" → în cardul „Newsletter săptămânal\", apasă butonul „Programează\" sub propoziția cu data. Alege ziua și ora, apoi „Salvează\".",
  },
  {
    q: "Cum văd ce newsletter-e au plecat?",
    a: "Tab „Newsletter\" → secțiunea „Trimiteri anterioare\" → alege din dropdown un newsletter trimis → „Vezi conținut\" → vezi exact emailul care a plecat.",
  },
  {
    q: "Cum intru în panou? Ce parolă are administrarea?",
    a: "Niciuna. Panoul cere <strong>contul platformei</strong> (email + cod de șase cifre) și permisiunea <code>cleaning.manage</code>, dată din Administrarea platformei. Parola locală din varianta veche a fost scoasă cu totul, împreună cu resetarea prin email.",
  },
  {
    q: "Nu pot intra în panou. Ce verific?",
    a: "Că ai intrat cu contul parohiei (numele tău scrie în colțul dreapta-sus) și că acel cont are <code>cleaning.manage</code>. Dacă porți o mască „vezi ca utilizator\", scoate-o: sub mască drepturile sunt ale rolului împrumutat, nu ale tale.",
  },
  // Intrarea „Cum aplic un update?" (folderul update/ de pe cPanel) nu mai are sens pe Cloudflare — scoasă.
];

export function paginaFaqAdmin(ctx: Ctx): string {
  const corp = `<a href="${esc(ctx.prefix)}/setari" class="back-btn">← Înapoi la Setări</a>

            <section class="faq-group">
                <h2 class="section-title">FAQ pentru Administratori</h2>
                ${ADMIN_FAQ.map((item) => `<details class="faq-item">
                        <summary>${esc(item.q)}</summary>
                        <div class="faq-answer">${item.a}</div>
                    </details>`).join("\n                ")}
            </section>`;

  return pagina(ctx, { titluPagina: "FAQ Administratori", corp, local: STIL_FAQ });
}
