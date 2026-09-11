import {
  ANTET_ACTOR,
  ANTET_PREVIZUALIZARE,
  ANTET_PRIN,
  ANTET_SECRET,
  CALE_ACTIUNI,
  type Actor,
  type Previzualizare,
  type Rezultat,
} from './contract.js'
import type { Manifest } from './manifest.js'

/**
 * CLIENTUL — cum cere cineva o actiune de la o aplicatie. „Cineva" e chatul, o alta aplicatie,
 * o automatizare: acelasi drum pentru toti, ca sa nu existe o cale privilegiata.
 *
 * Gazda din adresa nu conteaza (Service Binding-ul duce cererea la worker, oricare ar fi numele),
 * dar se scrie `…intern` ca sa se vada in loguri ca e o chemare interna.
 */

export interface CereriInterne {
  secret: string
  correlationId: string
  /** De unde vine cererea: `chat`, `automatizare`, numele aplicatiei. Ajunge in audit. */
  prin: string
}

export async function cereActiune<T = unknown>(
  serviciu: Fetcher,
  nume: string,
  argumente: unknown,
  actor: Actor,
  o: CereriInterne & { previzualizare?: boolean },
): Promise<Rezultat<T>> {
  try {
    const r = await serviciu.fetch(`https://actiuni.intern${CALE_ACTIUNI}/${encodeURIComponent(nume)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [ANTET_SECRET]: o.secret,
        [ANTET_ACTOR]: JSON.stringify(actor),
        [ANTET_PRIN]: o.prin,
        'x-correlation-id': o.correlationId,
        ...(o.previzualizare ? { [ANTET_PREVIZUALIZARE]: '1' } : {}),
      },
      body: JSON.stringify(argumente ?? {}),
    })

    // 404 fara corp JSON inseamna ca garda a inchis calea (secret gresit sau modul stins).
    const text = await r.text()
    if (!text) {
      return { ok: false, cod: 'indisponibil', mesaj: `aplicația a răspuns ${r.status}` }
    }
    const j = JSON.parse(text) as Rezultat<T>
    if (typeof j !== 'object' || j === null || !('ok' in j)) {
      return { ok: false, cod: 'indisponibil', mesaj: 'răspuns neînțeles de la aplicație' }
    }
    return j
  } catch (e) {
    return {
      ok: false,
      cod: 'indisponibil',
      mesaj: e instanceof Error ? e.message : 'aplicația nu răspunde',
    }
  }
}

/**
 * Ce AR face actiunea, fara s-o faca: argumente validate, drept verificat, rezumat pentru om.
 * Chatul o cheama inainte sa propuna un „Da/Nu" — ca omul sa confirme ceva concret si deja
 * verificat, nu o promisiune care poate cadea dupa.
 */
export function previzualizeaza(
  serviciu: Fetcher,
  nume: string,
  argumente: unknown,
  actor: Actor,
  o: CereriInterne,
): Promise<Rezultat<Previzualizare>> {
  return cereActiune<Previzualizare>(serviciu, nume, argumente, actor, { ...o, previzualizare: true })
}

/**
 * Manifestele se schimba doar la publicarea unei versiuni noi, dar se cer la fiecare mesaj din
 * chat — deci se tin putin in memoria izolatului. Un minut: destul cat sa nu intrebam de zece ori
 * intr-o discutie, prea putin ca sa ramanem cu o lista veche dupa un deploy.
 */
const CACHE_MANIFEST = new Map<string, { la: number; m: Manifest }>()
const VIATA_CACHE = 60_000

export async function manifestulLui(
  serviciu: Fetcher,
  cheieCache: string,
  o: CereriInterne,
): Promise<Manifest | null> {
  const acum = Date.now()
  const tinut = CACHE_MANIFEST.get(cheieCache)
  if (tinut && acum - tinut.la < VIATA_CACHE) return tinut.m

  try {
    const r = await serviciu.fetch(`https://actiuni.intern${CALE_ACTIUNI}`, {
      headers: {
        [ANTET_SECRET]: o.secret,
        [ANTET_PRIN]: o.prin,
        'x-correlation-id': o.correlationId,
      },
    })
    if (!r.ok) return tinut?.m ?? null
    const m = (await r.json()) as Manifest
    if (!m || !Array.isArray(m.actiuni)) return tinut?.m ?? null
    CACHE_MANIFEST.set(cheieCache, { la: acum, m })
    return m
  } catch {
    // O aplicatie care tace nu opreste chatul: se lucreaza cu ce raspunde.
    return tinut?.m ?? null
  }
}
