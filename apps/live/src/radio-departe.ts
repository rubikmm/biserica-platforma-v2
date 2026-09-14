import { BIBLIOTECA_GOALA } from '@xc/comanda'
import { SELECTIE_GOALA, type BibliotecaRadio, type SelectieRadio } from '@xc/contracts'

/**
 * RADIOUL, văzut de aici — ceasul lui stă în cealaltă aplicație.
 *
 * ⚠️ Împărțirea în două aplicații (cerere a utilizatorului, 14.09.2026) a tăiat o legătură care în
 * V1 era o simplă chemare de funcție: LIVE și radio se exclud, dar acum trăiesc în workeri
 * diferiți. Regula aleasă: **`live` ține starea, `radio` o ascultă.** Când pornește directul, tot
 * de aici se stinge ceasul radioului; la STOP, tot de aici se pornește la loc. Radioul nu
 * hotărăște niciodată singur asupra directului.
 *
 * Vorbim prin Service Binding, nu prin internet: adresele `/_intern/…` ale radioului NU se servesc
 * de pe internet (fără antetul de mai jos răspund 404, ca `/_actiuni` din chat — vezi ADR 0007).
 */

export interface EnvRadioDeparte {
  /** Service Binding către workerul radioului. */
  RADIO?: Fetcher
}

const ANTET = { 'x-xc-intern': '1', 'content-type': 'application/json' }
/** Gazda nu contează — cererea nu iese pe internet, o ia direct celălalt worker. */
const BAZA = 'https://radio.intern'

async function cere<T>(env: EnvRadioDeparte, cale: string, init: RequestInit | undefined, implicit: T): Promise<T> {
  if (!env.RADIO) return implicit
  try {
    const r = await env.RADIO.fetch(`${BAZA}${cale}`, { ...init, headers: { ...ANTET, ...(init?.headers ?? {}) } })
    if (!r.ok) {
      console.log('[radio]', cale, r.status)
      return implicit
    }
    return (await r.json()) as T
  } catch (e) {
    console.log('[radio]', cale, String(e))
    return implicit
  }
}

/** Selecția de acum (ceasul) + amprenta bibliotecii, fără lista întreagă de fișiere. */
export interface CeasRadio {
  selectie: SelectieRadio
  biblioteca: { generat_la: string; semnatura: string; fisiere: number }
}

const CEAS_GOL: CeasRadio = {
  selectie: SELECTIE_GOALA,
  biblioteca: { generat_la: '', semnatura: '', fisiere: 0 },
}

export function ceasRadio(env: EnvRadioDeparte): Promise<CeasRadio> {
  return cere<CeasRadio>(env, '/_intern/ceas', undefined, CEAS_GOL)
}

/** Indicele întreg — cerut doar când panoul vede că s-a schimbat amprenta. */
export function indiceRadio(env: EnvRadioDeparte): Promise<BibliotecaRadio> {
  return cere<BibliotecaRadio>(env, '/_intern/indice', undefined, BIBLIOTECA_GOALA)
}

/** Mută ceasul radioului. `de` dat explicit = preluăm ceasul altcuiva (decizia aparatului). */
export function puneCeas(
  env: EnvRadioDeparte,
  s: Partial<Pick<SelectieRadio, 'pornit' | 'director' | 'fisier_start' | 'de'>>,
  cine: string | null,
): Promise<SelectieRadio> {
  return cere<SelectieRadio>(
    env,
    '/_intern/ceas',
    { method: 'POST', body: JSON.stringify({ ...s, cine }) },
    SELECTIE_GOALA,
  )
}
