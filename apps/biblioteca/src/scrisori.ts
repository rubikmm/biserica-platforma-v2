/**
 * Scrisorile catre enorias — cate una la fiecare pas al unei cereri de carte.
 *
 * ⚠️ **Aici e singura deosebire de fond fata de V1.** Acolo scrisorile se compuneau si NU
 * plecau: platforma n-avea furnizor de email, iar A12 n-avea voie sa ceara adresa nimanui, asa
 * ca ramaneau in tabel cu `trimisa_la` gol si se citeau la `/pangar/scrisori`. In V2 amandoua
 * piedicile au cazut:
 *
 *  - **posta e a platformei** (`communication-worker`), care tine si arhiva livrarilor —
 *    aplicatiile nu trimit email singure, si nici nu-si aleg furnizorul;
 *  - **adresa se cere la identitate in clipa trimiterii** si NU se pastreaza. Biblioteca stie
 *    `user_id`, atat; ce e al altei aplicatii se cere, nu se copiaza.
 *
 * Randul din tabelul `scrisori` ramane totusi: e jurnalul BIBLIOTECII — ce a compus ea, la ce
 * cerere, si daca posta a primit-o. Cand nu se poate trimite (posta tace, omul n-are adresa),
 * randul ramane cu `trimisa_la` gol si cu pricina in `necaz`, si se vede la `/pangar/scrisori`.
 * **Nu pretindem ca a plecat ceva cand n-a plecat** — regula tinuta din V1.
 *
 * Textele de mai jos sunt cele din V1, cuvant cu cuvant. Scrisorile nu se adreseaza pe nume:
 * numele omului nu e al nostru si nu-l avem la indemana cand ceasul de noapte compune anuntul
 * de intarziere.
 */
import { dataCuZi } from "@xc/ui"

export type Sablon =
  | "cerere_primita"
  | "pregatita"
  | "imprumutata"
  | "intarziere"
  | "returnata"
  | "expirata"
  | "respinsa"
  | "anulata"

export interface Scrisoare {
  subiect: string
  corp: string
}

/** Ce trebuie ca sa plece o scrisoare: posta platformei, identitatea si adresa noastra publica. */
export interface Posta {
  COMUNICARE: Fetcher
  IDENTITATE: Fetcher
  ORIGINE_PUBLICA: string
}

const SEMNATURA = (acasa: string) => `

Biblioteca parohiei Sfântul Ilie — Hanul Colței
${acasa}/eu`

/**
 * `zile` e numarul de zile pana la termen, unde exista termen; `data` e termenul.
 * Textele sunt scurte dinadins: se citesc pe telefon, din notificare.
 */
export function compune(
  sablon: Sablon,
  date: { titlu: string; data?: string | null; zile?: number },
  acasa = "https://biblioteca.sfantul-ilie.ro",
): Scrisoare {
  const t = `„${date.titlu}”`
  const cand = date.data ? dataCuZi(date.data) : ""
  const semnatura = SEMNATURA(acasa)

  switch (sablon) {
    case "cerere_primita":
      return {
        subiect: `Am primit cererea pentru ${t}`,
        corp: `Bună ziua,

Am primit cererea pentru cartea ${t}. Pangarul o caută în bibliotecă și, când o
pune deoparte, primești un al doilea mesaj cu ziua până la care te așteaptă.

Nu trebuie să faci nimic până atunci.${semnatura}`,
      }

    case "pregatita":
      return {
        subiect: `${t} te așteaptă la pangar`,
        corp: `Bună ziua,

Cartea ${t} e pregătită și te așteaptă la pangar până ${cand}.

Dacă nu vii până atunci, rezervarea se stinge singură și cartea se întoarce pe raft —
o poți cere din nou oricând.${semnatura}`,
      }

    case "imprumutata":
      return {
        subiect: `Ai împrumutat ${t}`,
        corp: `Bună ziua,

Ai ridicat de la pangar cartea ${t}. O poți ține o lună: termenul e ${cand}.

Când o aduci înapoi, primești un mesaj de încheiere.${semnatura}`,
      }

    case "intarziere":
      return {
        subiect: `${t} trebuia adusă înapoi`,
        corp: `Bună ziua,

Cartea ${t} avea termen ${cand}${date.zile && date.zile > 0 ? `, adică acum ${zileRo(date.zile)}` : ""}.

Te rugăm s-o aduci la pangar când poți. Nu e nicio taxă și nicio supărare — doar că
altcineva o poate aștepta.${semnatura}`,
      }

    case "returnata":
      return {
        subiect: `${t} s-a întors. Mulțumim`,
        corp: `Bună ziua,

Cartea ${t} s-a întors la bibliotecă și împrumutul e închis. Mulțumim.

Poți cere oricând alta din catalog.${semnatura}`,
      }

    case "expirata":
      return {
        subiect: `Rezervarea pentru ${t} s-a stins`,
        corp: `Bună ziua,

Cartea ${t} a așteptat la pangar până ${cand} și s-a întors pe raft.

Dacă tot o vrei, o poți cere din nou — nu se ține socoteala.${semnatura}`,
      }

    case "respinsa":
      return {
        subiect: `Cererea pentru ${t} nu a putut fi îndeplinită`,
        corp: `Bună ziua,

Pangarul nu a putut da curs cererii pentru ${t} — se întâmplă când exemplarul e deja
la cineva sau nu se mai găsește pe raft.

Întreabă la pangar dacă vrei lămuriri, sau alege altă carte din catalog.${semnatura}`,
      }

    case "anulata":
      return {
        subiect: `Ai renunțat la ${t}`,
        corp: `Bună ziua,

Am notat că renunți la cartea ${t}. Cartea e din nou liberă și nu mai ai nimic de făcut.${semnatura}`,
      }
  }
}

function zileRo(n: number): string {
  if (n === 1) return "o zi"
  return n < 20 ? `${n} zile` : `${n} de zile`
}

/** Adresa omului, ceruta de la identitate pentru o singura trimitere. Nu se pastreaza nicaieri. */
async function adresa(posta: Posta, userId: string): Promise<string | null> {
  try {
    const r = await posta.IDENTITATE.fetch("https://identitate.intern/utilizatori/dupa-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [userId] }),
    })
    if (!r.ok) return null
    const date = (await r.json()) as { utilizatori?: Array<{ id: string; email: string; disabledAt: string | null }> }
    const om = date.utilizatori?.find((u) => u.id === userId)
    return om && !om.disabledAt ? om.email : null
  } catch {
    return null
  }
}

/** Corpul scris ca text curge in HTML cu randurile pastrate — posta cere `html`. */
function caHtml(text: string): string {
  const scapa = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${scapa(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n")
}

/**
 * Compune scrisoarea, o scrie in jurnalul bibliotecii si o da postei platformei.
 *
 * Nicio treapta nu opreste imprumutul: daca posta tace ori omul n-are adresa, randul ramane
 * netrimis, cu pricina scrisa, si cartea se pregateste mai departe. O scrisoare pierduta e o
 * suparare; o cerere care nu se poate face fiindca n-a mers emailul e o defectiune.
 */
export async function trimite(
  db: D1Database,
  posta: Posta | null,
  userId: string,
  cerereId: number | null,
  sablon: Sablon,
  date: { titlu: string; data?: string | null; zile?: number },
  creataLa: string,
  correlationId = "biblioteca",
): Promise<void> {
  const s = compune(sablon, date, posta?.ORIGINE_PUBLICA)
  const r = await db
    .prepare(
      `INSERT INTO scrisori (user_id, cerere_id, sablon, subiect, corp, creata_la, trimisa_la)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(userId, cerereId, sablon, s.subiect, s.corp, creataLa)
    .run()
  const id = Number(r.meta?.last_row_id ?? 0)

  const necaz = await pune(posta, userId, s, cerereId, sablon, correlationId)
  if (necaz) {
    await db.prepare(`UPDATE scrisori SET necaz = ? WHERE id = ?`).bind(necaz.slice(0, 300), id).run()
    console.log(`[scrisoare] ${sablon} → ${userId}: NETRIMISĂ (${necaz})`)
    return
  }
  await db.prepare(`UPDATE scrisori SET trimisa_la = ? WHERE id = ?`).bind(creataLa, id).run()
  console.log(`[scrisoare] ${sablon} → ${userId}: ${s.subiect}`)
}

/** Da scrisoarea postei. Intoarce pricina, daca n-a mers; `null` daca a plecat. */
async function pune(
  posta: Posta | null,
  userId: string,
  s: Scrisoare,
  cerereId: number | null,
  sablon: Sablon,
  correlationId: string,
): Promise<string | null> {
  if (!posta) return "posta nu e legată în acest mediu"
  const catre = await adresa(posta, userId)
  if (!catre) return "contul nu are adresă de email (sau e închis)"
  try {
    const r = await posta.COMUNICARE.fetch("https://comunicare.intern/trimite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sursa: "biblioteca",
        destinatari: [{ userId, adresa: catre }],
        subiect: s.subiect,
        html: caHtml(s.corp),
        text: s.corp,
        // Aceeasi scrisoare nu pleaca de doua ori, oricat s-ar apasa butonul: cheia e cererea
        // si pasul ei. Pentru ceasul de noapte, care poate anunta aceeasi intarziere din 7 in 7
        // zile, intra si ziua.
        idempotencyKey: `biblioteca:${cerereId ?? "fara"}:${sablon}:${new Date().toISOString().slice(0, 10)}`,
        correlationId,
        meta: { aplicatie: "biblioteca", cerereId, sablon },
      }),
    })
    if (!r.ok) return `posta a răspuns ${r.status}`
    const raspuns = (await r.json()) as { ok?: boolean; livrari?: Array<{ stare: string }> }
    if (!raspuns.ok) return "posta n-a primit scrisoarea"
    // Vocabularul livrarilor din comunicare: `sent` (a plecat), `simulated` (sandbox — asa e pe
    // staging, cat timp livrarea reala e stinsa), `failed`, `suppressed` (omul si-a oprit
    // emailurile: nu e o defectiune a noastra, dar nici n-a plecat nimic, si pangarul trebuie
    // s-o stie cand se intreaba de ce n-a venit omul dupa carte).
    const stare = raspuns.livrari?.[0]?.stare
    if (stare === "suppressed") return "omul și-a oprit emailurile de la platformă"
    if (stare && stare !== "sent" && stare !== "simulated") return `posta a întors starea „${stare}”`
    return null
  } catch (e) {
    return `posta n-a răspuns: ${(e as Error).message}`
  }
}
