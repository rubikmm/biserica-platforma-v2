/**
 * Subțierea arhivei de rapoarte — `admin/cleanup-newsletters.php` din V1. Păstrează doar PRIMA și
 * ULTIMA intrare din `newsletter_history` și șterge tot ce e între ele.
 *
 * Poarta e `cleaning.manage`, ținută în `index.ts`. Pagina e de unică folosință: se deschide numai
 * când arhiva trebuie subțiată, iar din panou se ajunge la ea de la fila Arhivă.
 */

import { numar, ruleaza, toate } from "../depozit.js";
import { esc } from "@xc/ui";
import { citestePost } from "../html.js";
import { type Ctx, campCsrf, pagina } from "../pagina.js";
import { formatDtLocal } from "../timp.js";
import type { Baza } from "../oameni.js";

interface RandArhiva {
  id: number;
  kind: string | null;
  sunday_date: string;
  subject_short: string;
  created_at: string;
  is_test: number | null;
}

const STIL_CLEANUP = `
.flash { padding: 12px 14px; border-radius: 6px; margin-bottom: 18px; }
.flash.ok { background: #dcecc9; border: 1px solid #6b8e4e; color: #4f6c3b; }
.flash.err { background: #fbe9e9; border: 1px solid #b04848; color: #7a2828; }
main table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 0.9rem; }
main th, main td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border);
                   text-transform: none; letter-spacing: 0; font-size: 0.9rem; color: var(--text); }
main th { background: var(--tinta); color: var(--text-muted); font-weight: 600; }
main tr.keep { background: rgba(107, 142, 78, 0.14); }
main tr.delete-row td { color: var(--danger); text-decoration: line-through; }
.btn-purge { display: inline-block; padding: 10px 18px; background: var(--danger); color: white;
             text-decoration: none; border: none; border-radius: 6px; font-size: 1rem;
             font-weight: 600; cursor: pointer; }
.warn { background: var(--cald); border: 1px solid var(--cald-chenar); padding: 12px;
        border-radius: 6px; color: var(--cald-text); margin: 18px 0; font-size: 0.92rem; }
`;

export async function paginaCuratareArhiva(
  ctx: Ctx,
  db: Baza,
  request: Request,
  antete: Record<string, string>,
): Promise<Response> {
  let flash: [string, string] | null = null;

  if (request.method === "POST") {
    const post = await citestePost(request);
    if ((post.action ?? "") === "do_cleanup") {
      const minId = await numar(db, "SELECT COALESCE(MIN(id), 0) FROM newsletter_history");
      const maxId = await numar(db, "SELECT COALESCE(MAX(id), 0) FROM newsletter_history");
      if (minId === 0 || maxId === 0) {
        flash = ["err", "Arhiva e goală — nimic de șters."];
      } else if (minId === maxId) {
        flash = ["err", "E doar 1 intrare în arhivă — nimic de șters."];
      } else {
        const del = await ruleaza(db, "DELETE FROM newsletter_history WHERE id != ? AND id != ?", minId, maxId);
        const deleted = Number(del.meta?.changes ?? 0);
        flash = ["ok", `Șterse ${deleted} trimiteri. Au rămas doar ID #${minId} (cea mai veche) și ID #${maxId} (cea mai nouă).`];
      }
    }
  }

  // Statusul curent
  const rows = await toate<RandArhiva>(
    db,
    `SELECT id, kind, sunday_date, substr(subject, 1, 60) AS subject_short, created_at, is_test
     FROM newsletter_history ORDER BY id ASC`,
  );
  const total = rows.length;
  const minId = total > 0 ? Number(rows[0]?.id ?? 0) : 0;
  const maxId = total > 0 ? Number(rows[total - 1]?.id ?? 0) : 0;
  const between = Math.max(0, total - 2);

  const tabel = total === 0
    ? `<p>Tabela e goală.</p>`
    : `<table>
            <thead>
                <tr>
                    <th>ID</th><th>Tip</th><th>Sunday date</th><th>Subject</th>
                    <th>Creat</th><th>Status</th>
                </tr>
            </thead>
            <tbody>
            ${rows.map((r) => {
              const id = Number(r.id);
              const isKeep = id === minId || id === maxId;
              const rowClass = isKeep ? "keep" : "delete-row";
              const status = isKeep
                ? (id === minId ? "✓ PRIMUL (păstrat)" : "✓ ULTIMUL (păstrat)")
                : "✗ va fi șters";
              return `<tr class="${rowClass}">
                    <td>${id}</td>
                    <td>${esc(r.kind ?? "weekly")}
                        ${Number(r.is_test ?? 0) === 1 ? "(test)" : ""}</td>
                    <td>${esc(r.sunday_date)}</td>
                    <td>${esc(r.subject_short)}</td>
                    <td>${esc(formatDtLocal(r.created_at, "Y-m-d H:i:s"))}</td>
                    <td><strong>${status}</strong></td>
                </tr>`;
            }).join("\n            ")}
            </tbody>
        </table>`;

  let actiune = "";
  if (total > 2 && (!flash || flash[0] !== "ok")) {
    actiune = `<div class="warn">
            <strong>⚠ Atenție:</strong> ștergerea e definitivă. Vor fi șterse
            <strong>${between}</strong> intrări (cele marcate cu roșu mai sus).
            Vor rămâne doar 2 — prima și ultima.
        </div>
        <form method="post" onsubmit="return confirm('Sigur ștergi ${between} intrări din arhiva rapoartelor?');">
            <input type="hidden" name="action" value="do_cleanup">${campCsrf(ctx)}
            <button type="submit" class="btn-purge">Confirmă curățarea (șterge ${between})</button>
        </form>`;
  } else if (total <= 2) {
    actiune = `<p style="color: var(--text-muted);">Nu e nimic de șters — sunt cel mult 2 intrări în arhivă.</p>`;
  }

  const corp = `<h2 class="section-title">Curățarea arhivei de rapoarte</h2>
    <p>Aici se păstrează doar <strong>prima</strong> (ID #${minId || "—"})
       și <strong>ultima</strong> (ID #${maxId || "—"}) intrare din arhivă.
       Restul de <strong>${between}</strong> intrări vor fi șterse.</p>

    ${flash ? `<div class="flash ${flash[0]}">${esc(flash[1])}</div>` : ""}

    <h3>Starea curentă (${total} intrări)</h3>
    ${tabel}

    ${actiune}

    <p class="info-jos" style="text-align:left">
        <strong>⚠ Pagină de unică folosință</strong> — se folosește doar când arhiva trebuie subțiată.
        <a href="${esc(ctx.prefix)}/setari?tab=archive">← Înapoi la Arhivă</a>
    </p>`;

  return new Response(
    pagina(ctx, { titluPagina: "Curățarea arhivei de rapoarte", corp, local: STIL_CLEANUP }),
    { headers: { "content-type": "text/html; charset=utf-8", ...antete } },
  );
}
