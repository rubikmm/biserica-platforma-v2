import { DurableObject } from 'cloudflare:workers'
import type { NumarAscultatori } from '@xc/contracts'

/**
 * CÂȚI OAMENI ASCULTĂ acum (cerere a utilizatorului, 7.09.2026, la Vecernie: „poți să-mi zici câtă
 * lume ascultă?").
 *
 * Sunetul nu trece prin worker (directul: SFU → browser; radioul: depozit → browser), deci nu avem
 * de unde număra ascultătorii din trafic. Numărăm din pagină: cât timp omul a apăsat play ȘI se
 * aude ceva, playerul bate la `/api/ascult` cu un id aleator al paginii; la stop bate „plec".
 *
 * Nu se păstrează NIMIC despre om — doar un id aleator al paginii și felul aparatului (telefon sau
 * nu). Paginile deschise fără play nu se numără deloc.
 *
 * ⚠️ Bătăile stau în STOCAREA obiectului, nu în memoria lui: un obiect durabil fără treabă e
 * adormit, iar memoria se pierde — la o bătaie la 30 s asta se întâmplă mereu, și numărul ar cădea
 * la zero între două bătăi (văzut în proba din 7.09.2026).
 */

export interface EnvAscultatori {
  ASCULTATORI: DurableObjectNamespace<Ascultatori>
}

const VIATA_S = 90

interface Bataie {
  sursa: 'live' | 'radio'
  telefon: boolean
  la: number
}

export class Ascultatori extends DurableObject {
  async bate(id: string, sursa: 'live' | 'radio' | null, telefon: boolean, plec: boolean): Promise<void> {
    const cheie = `b:${id}`
    if (plec || !sursa) {
      await this.ctx.storage.delete(cheie)
      return
    }
    await this.ctx.storage.put<Bataie>(cheie, { sursa, telefon, la: Date.now() })
  }

  async numar(): Promise<NumarAscultatori> {
    const batai = await this.ctx.storage.list<Bataie>({ prefix: 'b:' })
    const prag = Date.now() - VIATA_S * 1000
    const n: NumarAscultatori = { total: 0, live: 0, radio: 0, telefoane: 0 }
    const vechi: string[] = []
    for (const [cheie, b] of batai) {
      if (b.la < prag) {
        vechi.push(cheie)
        continue
      }
      n.total++
      if (b.sursa === 'live') n.live++
      else n.radio++
      if (b.telefon) n.telefoane++
    }
    if (vechi.length) await this.ctx.storage.delete(vechi)
    return n
  }
}

function obiect(env: EnvAscultatori): DurableObjectStub<Ascultatori> {
  return env.ASCULTATORI.get(env.ASCULTATORI.idFromName('ascultatori'))
}

/** `POST /api/ascult` — bătaia paginii: `{ id, sursa, plec? }`. Răspunde 204, fără conținut. */
export async function bataiePagina(request: Request, env: EnvAscultatori): Promise<Response> {
  const j = (await request.json().catch(() => null)) as { id?: unknown; sursa?: unknown; plec?: unknown } | null
  const id = typeof j?.id === 'string' ? j.id.slice(0, 32) : ''
  if (!id) return new Response(null, { status: 400 })
  const sursa = j?.sursa === 'live' || j?.sursa === 'radio' ? j.sursa : null
  const ua = request.headers.get('user-agent') ?? ''
  const telefon = /Mobile|Android|iPhone|iPad/i.test(ua)
  await obiect(env).bate(id, sursa, telefon, j?.plec === true)
  return new Response(null, { status: 204 })
}

export async function numarAscultatori(env: EnvAscultatori): Promise<NumarAscultatori> {
  return obiect(env).numar()
}
