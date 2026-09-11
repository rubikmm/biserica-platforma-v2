import { z } from 'zod'

/**
 * OBIECTUL CARE CIRCULA — o hartie gata facuta: „Sfintii zilei", foaia A4 a saptamanii, pozele.
 *
 * Sta in contracte, nu intr-o aplicatie, fiindca trei straturi il ating si niciunul nu-l detine:
 * aplicatia il FACE (program stie ce scrie pe foaie), `media-worker` il TINE (R2), iar
 * `communication-worker` il TRIMITE. Intre ele circula DOAR cheia — octetii nu trec niciodata
 * prin chat, prin model sau prin corpul unui mesaj.
 *
 * Urmarea practica: aceeasi foaie ceruta de trei ori se face o singura data. Amprenta e a
 * continutului, deci o corectura in calendar schimba cheia si hartia se reface singura.
 */
export const Obiect = z.object({
  fel: z.enum(['pdf', 'jpg', 'png', 'json', 'txt']),
  /** Cum se numeste fisierul in atasament: `sfintii-2026-09-13.pdf`. */
  nume: z.string().min(1),
  /** Cum se numeste in vorbe: „Sfinții zilei — duminică, 13 septembrie". */
  titlu: z.string().min(1),
  /** Cheia din media-worker (R2): `<domeniu>/<cale>`. Dupa ea se cere si se trimite. */
  cheie: z.string().min(1),
  /** Amprenta continutului din care s-a facut. */
  amprenta: z.string().min(1),
  octeti: z.number().int().nonnegative(),
})
export type Obiect = z.infer<typeof Obiect>
