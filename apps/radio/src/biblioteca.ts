import { toateDirectoarele } from '@xc/comanda'
import type { FisierRadio } from '@xc/contracts'
import { caleCurata, eAudio } from './cai.js'
import { type EnvCeas, radioul } from './ceas.js'
import { biblioteca, cheiaDin, puneInCache } from './depozit.js'
import { masoaraDurata } from './durate.js'

/**
 * MUZICA RADIOULUI — ecranul prin care Părintele își ține biblioteca.
 *
 * Ia locul lui „pun fișierele în OneDrive și aștept să se sincronizeze pe aparat": aici se urcă, se
 * șterge și se fac foldere DIRECT în depozit, iar radioul le vede pe loc. Nu e implicat niciun
 * aparat.
 *
 * ⚠️ Cheia care face totul să meargă fără aparat: **durata o măsoară BROWSERUL**, înainte de urcare
 * (`decodeAudioData`, exact la eșantion; dacă nu se poate, din eticheta fișierului). Așa indicele
 * are durate exacte fără ca nimeni să mai decodeze pe un Raspberry Pi. Butonul „Măsoară duratele" e
 * pentru verificare și remăsurare, și le numără pe Cloudflare (`durate.ts`).
 *
 * Rute (scrierea cere `broadcast.manage`, hotărât de `index.ts`):
 *   GET    /biblioteca/cuprins                    directoarele + fișierele, cu durate
 *   PUT    /biblioteca/fisier?cale=…&durata=…     urcă un fișier (corpul cererii = fișierul)
 *   POST   /biblioteca/sterge                     { fisiere: [...], directoare: [...] }
 *   POST   /biblioteca/director                   { cale } — folder nou (poate rămâne și gol)
 *   POST   /biblioteca/mutare                     { din, in } — redenumește / mută un fișier
 *   POST   /biblioteca/masoara                    { fisiere?, director? } — (re)măsoară duratele
 */

/** Peste atât nu trece printr-un worker; fișierele parohiei sunt mult sub. */
const MAX_OCTETI = 190 * 1024 * 1024

const json = (o: unknown, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } })

export async function bibliotecaRute(
  request: Request,
  url: URL,
  cale: string,
  env: EnvCeas,
  potScrie: boolean,
): Promise<Response | null> {
  const m = request.method

  if (cale === '/biblioteca/cuprins' && m === 'GET') {
    const b = await biblioteca(env)
    return json({
      directoare: toateDirectoarele(b),
      fisiere: b.fisiere,
      semnatura: b.semnatura,
      generat_la: b.generat_la,
      pot_scrie: potScrie,
    })
  }

  if (!potScrie && m !== 'GET') {
    return json({ motiv: 'schimbarea bibliotecii cere permisiunea „broadcast.manage"' }, 403)
  }

  if (cale === '/biblioteca/fisier' && m === 'PUT') {
    const tinta = caleCurata(url.searchParams.get('cale'))
    if (!tinta || !eAudio(tinta)) return json({ motiv: 'cale invalidă sau nu e fișier audio' }, 400)
    const durata = Number(url.searchParams.get('durata') ?? '0')
    if (!Number.isFinite(durata) || durata <= 0) return json({ motiv: 'lipsește durata măsurată' }, 400)
    const lungime = Number(request.headers.get('content-length') ?? '0')
    if (lungime > MAX_OCTETI) return json({ motiv: 'fișier prea mare' }, 413)
    if (!request.body) return json({ motiv: 'corp gol' }, 400)

    const pus = await env.FISIERE.put(cheiaDin(tinta), request.body, {
      httpMetadata: { contentType: request.headers.get('content-type') ?? 'audio/mpeg' },
    })
    const f: FisierRadio = { cale: tinta, durata: Math.round(durata * 100) / 100, octeti: pus?.size ?? lungime }
    const b = await radioul(env).actualizeazaIndice([f], [])
    puneInCache(b)
    return json({ ok: true, fisier: f, semnatura: b.semnatura, total: b.fisiere.length })
  }

  if (cale === '/biblioteca/sterge' && m === 'POST') {
    const c = (await request.json().catch(() => null)) as { fisiere?: string[]; directoare?: string[] } | null
    const fisiere = (c?.fisiere ?? []).map(caleCurata).filter((x): x is string => !!x)
    const directoare = (c?.directoare ?? []).map(caleCurata).filter((x): x is string => !!x)
    if (fisiere.length === 0 && directoare.length === 0) return json({ motiv: 'nimic de șters' }, 400)

    /*
     * Indicele PROASPĂT din depozit, nu cel ținut minte: altfel o piesă urcată acum câteva secunde
     * ar scăpa neștearsă când se șterge tot folderul.
     */
    const b = await radioul(env).indice()
    // Ștergerea unui folder ia cu el tot ce e înăuntru (ca în File Station).
    const deSters = new Set(fisiere)
    for (const d of directoare) {
      for (const f of b.fisiere) if (f.cale.startsWith(`${d}/`)) deSters.add(f.cale)
    }
    const lista = [...deSters]
    for (let i = 0; i < lista.length; i += 100) {
      await env.FISIERE.delete(lista.slice(i, i + 100).map(cheiaDin))
    }
    const noua = await radioul(env).actualizeazaIndice([], lista, [], directoare)
    puneInCache(noua)
    return json({ ok: true, sterse: lista.length, semnatura: noua.semnatura, total: noua.fisiere.length })
  }

  if (cale === '/biblioteca/director' && m === 'POST') {
    const c = (await request.json().catch(() => null)) as { cale?: string } | null
    const noua = caleCurata(c?.cale ?? null)
    if (!noua) return json({ motiv: 'nume invalid' }, 400)
    const b = await radioul(env).actualizeazaIndice([], [], [noua], [])
    puneInCache(b)
    return json({ ok: true, cale: noua, semnatura: b.semnatura })
  }

  if (cale === '/biblioteca/masoara' && m === 'POST') {
    const c = (await request.json().catch(() => null)) as { fisiere?: string[]; director?: string } | null
    const b = await radioul(env).indice()
    let tinte: string[] = (c?.fisiere ?? []).map(caleCurata).filter((x): x is string => !!x)
    const director = caleCurata(c?.director ?? null)
    if (director) tinte = tinte.concat(b.fisiere.filter((f) => f.cale.startsWith(`${director}/`)).map((f) => f.cale))
    if (tinte.length === 0) return json({ motiv: 'nimic de măsurat' }, 400)
    // Cel mult atâtea pe o cerere: pagina cheamă în buclă, ca să nu ținem un worker prea mult.
    const lot = [...new Set(tinte)].slice(0, 25)
    const masurate: FisierRadio[] = []
    const nemasurate: string[] = []
    for (const c1 of lot) {
      const o = await env.FISIERE.get(cheiaDin(c1))
      if (!o) {
        nemasurate.push(c1)
        continue
      }
      const durata = await masoaraDurata(o.body, c1)
      if (durata && durata > 0) masurate.push({ cale: c1, durata, octeti: o.size })
      else nemasurate.push(c1)
    }
    const noua = masurate.length ? await radioul(env).actualizeazaIndice(masurate, []) : b
    if (masurate.length) puneInCache(noua)
    return json({
      ok: true,
      masurate,
      nemasurate,
      ramase: Math.max(0, new Set(tinte).size - lot.length),
      semnatura: noua.semnatura,
    })
  }

  if (cale === '/biblioteca/mutare' && m === 'POST') {
    const c = (await request.json().catch(() => null)) as { din?: string; in?: string } | null
    const din = caleCurata(c?.din ?? null)
    const catre = caleCurata(c?.in ?? null)
    if (!din || !catre || !eAudio(catre)) return json({ motiv: 'cale invalidă' }, 400)
    const b = await biblioteca(env)
    const vechi = b.fisiere.find((f) => f.cale === din)
    if (!vechi) return json({ motiv: 'fișierul nu e în bibliotecă' }, 404)
    const o = await env.FISIERE.get(cheiaDin(din))
    if (!o) return json({ motiv: 'fișierul nu e în depozit' }, 404)
    await env.FISIERE.put(cheiaDin(catre), o.body, { httpMetadata: o.httpMetadata })
    await env.FISIERE.delete(cheiaDin(din))
    const noua = await radioul(env).actualizeazaIndice([{ cale: catre, durata: vechi.durata }], [din])
    puneInCache(noua)
    return json({ ok: true, semnatura: noua.semnatura })
  }

  return null
}

