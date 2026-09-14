import { BIBLIOTECA_GOALA } from '@xc/comanda'
import type { BibliotecaRadio } from '@xc/contracts'
import { CHEIE_INDICE, type EnvCeas, PREFIX } from './ceas.js'

/**
 * DEPOZITUL — muzica radioului și indicele ei.
 *
 * ⚠️ **E bucketul din V1, refolosit** (hotărâre a utilizatorului, 14.09.2026: „cei 11 GB poți să îi
 * folosești… ca să nu mai faci atâtea operații"). E o abatere ȘTIUTĂ de la „nu se refolosește nimic
 * din V1, tot ce e nou poartă prefixul `xc-`" — luată ca să nu copiem 11 GB dintr-un depozit în
 * altul degeaba, când oricum urmează cutover-ul. Bucketul ține trei directoare, iar radioul îl
 * privește DOAR pe al lui:
 *   `mp3player/`  muzica radioului — asta citim și scriem;
 *   `remote/`     înregistrările brute ale aparatului — nu le atingem;
 *   `predici/`    arhiva de predici — nu o atingem.
 * De aceea fiecare cale trece prin `cheiaDin`: nimic nu iese din `mp3player/`.
 */

/** Cheia din depozit pentru o cale din bibliotecă. */
export const cheiaDin = (cale: string) => PREFIX + cale

/**
 * Indicele, ținut puțin în izolat: paginile îl cer des, iar el se schimbă doar când cineva urcă
 * sau șterge ceva. După o schimbare se pune pe loc cel proaspăt (`puneInCache`), ca urcarea să se
 * vadă imediat, nu după ce expiră.
 */
let indiceCache: { la: number; b: BibliotecaRadio } | null = null
const TINE_MS = 20_000

export function puneInCache(b: BibliotecaRadio): void {
  indiceCache = { la: Date.now(), b }
}

export async function biblioteca(env: EnvCeas): Promise<BibliotecaRadio> {
  if (indiceCache && Date.now() - indiceCache.la < TINE_MS) return indiceCache.b
  const o = await env.FISIERE.get(CHEIE_INDICE)
  if (!o) return BIBLIOTECA_GOALA
  const b = (await o.json()) as BibliotecaRadio
  indiceCache = { la: Date.now(), b }
  return b
}

function tipDupaNume(cale: string): string {
  const e = cale.slice(cale.lastIndexOf('.') + 1).toLowerCase()
  return e === 'wav'
    ? 'audio/wav'
    : e === 'flac'
      ? 'audio/flac'
      : e === 'm4a' || e === 'aac'
        ? 'audio/mp4'
        : e === 'ogg' || e === 'opus'
          ? 'audio/ogg'
          : 'audio/mpeg'
}

/**
 * Fișierul audio din depozit, cu `Range` — așa poate sări ascultătorul la secunda cerută.
 *
 * ⚠️ Se servește NUMAI ce e în indice: nimeni nu poate cere altceva din bucket pe ruta asta (acolo
 * stau și înregistrările slujbelor, care nu sunt publice).
 *
 * Antetul `access-control-allow-origin` e pentru pagina lui `live`, care stă pe alt subdomeniu:
 * elementul `<audio>` ar merge și fără el, dar playerul cere și un `HEAD` ca să afle debitul piesei.
 */
export async function fisier(request: Request, url: URL, env: EnvCeas): Promise<Response> {
  const cale = url.searchParams.get('cale')
  if (!cale || cale.includes('..')) return new Response('cale invalida', { status: 400 })
  const b = await biblioteca(env)
  if (!b.fisiere.some((f) => f.cale === cale)) return new Response('nu exista', { status: 404 })

  const range = request.headers.get('range')
  const o = await env.FISIERE.get(cheiaDin(cale), range ? { range: request.headers } : undefined)
  if (!o) return new Response('nu exista in depozit', { status: 404 })

  const h = new Headers()
  o.writeHttpMetadata(h)
  h.set('accept-ranges', 'bytes')
  h.set('etag', o.httpEtag)
  h.set('content-type', h.get('content-type') ?? tipDupaNume(cale))
  h.set('access-control-allow-origin', '*')
  h.set('access-control-expose-headers', 'content-length, content-range, accept-ranges')
  /*
   * O piesă nu se schimbă niciodată sub aceeași cale (o piesă nouă = altă cale), deci browserul o
   * poate ține cât vrea: cine prinde a doua oară aceeași melodie n-o mai cere.
   */
  h.set('cache-control', 'public, max-age=2592000, immutable')

  const r = (o as R2ObjectBody & { range?: { offset: number; length: number } }).range
  if (range && r) {
    h.set('content-range', `bytes ${r.offset}-${r.offset + r.length - 1}/${o.size}`)
    h.set('content-length', String(r.length))
    return new Response((o as R2ObjectBody).body, { status: 206, headers: h })
  }
  h.set('content-length', String(o.size))
  return new Response((o as R2ObjectBody).body, { headers: h })
}
