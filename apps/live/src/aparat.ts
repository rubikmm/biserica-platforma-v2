import { DurableObject } from 'cloudflare:workers'
import { COMANDA_GOALA, type ComandaAparat, type Telemetrie } from '@xc/contracts'

/**
 * APARATUL — legătura aplicației cu daemonul de la biserică.
 *
 * Aparatul stă după NAT, deci EL deschide toate legăturile: cere comanda în long-poll și își
 * trimite telemetria. Aici ținem, într-un obiect durabil cu o singură cheie:
 *   - COMANDA: ce vrem de la el (stare, director, piesa de start), cu o versiune care crește la
 *     fiecare schimbare — după ea știe dacă are ceva nou de făcut;
 *   - STAREA: ultima telemetrie (ce face, ce piesă, erori, disc, programul lui de slujbe).
 *
 * ⚠️ Numele câmpurilor sunt cele din V1, dinadins: **aparatul e ACELAȘI**, nu-l rescriem odată cu
 * platforma. Contractul e descris și în `aparat/worker.py`, de partea cealaltă.
 */

export interface EnvAparat {
  APARAT: DurableObjectNamespace<Aparat>
  APARAT_SECRET?: string
}

type Schimbare = Partial<Pick<ComandaAparat, 'stare' | 'director' | 'fisier_start' | 'selectie'>>

/**
 * După atâtea secunde fără telemetrie, aparatul e „nu răspunde". El bate la 20 s, deci lăsăm loc
 * de trei bătăi pierdute: altfel panoul ar striga „legătură ruptă" la prima cerere căzută.
 */
const APARAT_VIU_S = 75
const ASTEAPTA_MAX_S = 30

export class Aparat extends DurableObject {
  /** Cine așteaptă o comandă nouă (long-poll). Doar în memorie — la trezire nu e nimeni. */
  private asteptatori = new Set<() => void>()

  async comanda(): Promise<ComandaAparat> {
    return (await this.ctx.storage.get<ComandaAparat>('comanda')) ?? COMANDA_GOALA
  }

  /** Întoarce comanda de îndată ce e altă versiune decât `versiune`, sau după `secunde`. */
  async asteaptaComanda(versiune: number, secunde: number): Promise<ComandaAparat> {
    const c = await this.comanda()
    if (c.versiune !== versiune) return c
    await new Promise<void>((gata) => {
      const trezeste = () => {
        this.asteptatori.delete(trezeste)
        clearTimeout(ceas)
        gata()
      }
      const ceas = setTimeout(trezeste, Math.max(1, Math.min(secunde, ASTEAPTA_MAX_S)) * 1000)
      this.asteptatori.add(trezeste)
    })
    return this.comanda()
  }

  /**
   * Aceeași comandă, dar aplicată abia peste `ms` (alarma obiectului, supraviețuiește evacuării).
   * Orice comandă pusă între timp o anulează: LIVE apăsat la loc în fereastra de suprapunere nu
   * mai e urmat de un „oprit" rătăcit.
   */
  async puneComandaDupa(schimbare: Schimbare, de: string | null, ms: number): Promise<void> {
    await this.ctx.storage.put('intarziata', { schimbare, de })
    await this.ctx.storage.setAlarm(Date.now() + ms)
  }
  override async alarm(): Promise<void> {
    const i = await this.ctx.storage.get<{ schimbare: Schimbare; de: string | null }>('intarziata')
    if (!i) return
    await this.puneComanda(i.schimbare, i.de)
  }

  async puneComanda(schimbare: Schimbare, de: string | null): Promise<ComandaAparat> {
    await this.ctx.storage.delete('intarziata')
    await this.ctx.storage.deleteAlarm()
    const veche = await this.comanda()
    const noua: ComandaAparat = {
      versiune: veche.versiune + 1,
      stare: schimbare.stare ?? veche.stare,
      director: schimbare.director !== undefined ? schimbare.director : veche.director,
      // Piesa de start e o intenție de moment: nu se moștenește de la comanda anterioară.
      fisier_start: schimbare.fisier_start ?? null,
      selectie:
        schimbare.selectie !== undefined ? schimbare.selectie : schimbare.stare === 'radio' ? (veche.selectie ?? null) : null,
      la: new Date().toISOString(),
      de,
    }
    await this.ctx.storage.put('comanda', noua)
    for (const t of [...this.asteptatori]) t()
    return noua
  }

  async puneStare(t: Telemetrie): Promise<void> {
    await this.ctx.storage.put('stare', t)
  }
  async stare(): Promise<Telemetrie | null> {
    return (await this.ctx.storage.get<Telemetrie>('stare')) ?? null
  }

  /**
   * Ultima decizie a aparatului pe care am preluat-o, ca să n-o aplicăm de două ori — comparația
   * cu `comanda.la` nu ajunge dacă ceasul aparatului e înaintea celui de aici.
   */
  async deciziePreluata(): Promise<string | null> {
    return (await this.ctx.storage.get<string>('decizie_preluata')) ?? null
  }
  async puneDeciziePreluata(la: string): Promise<void> {
    await this.ctx.storage.put('decizie_preluata', la)
  }
}

export function aparatul(env: EnvAparat) {
  return env.APARAT.get(env.APARAT.idFromName('biserica'))
}

export function aparatViu(t: Telemetrie | null): boolean {
  if (!t?.la) return false
  const de = Date.parse(t.la)
  return Number.isFinite(de) && Date.now() - de < APARAT_VIU_S * 1000
}

/**
 * Trecerea LIVE → radio să nu se simtă: aparatul primește „oprit" abia după câteva secunde, ca
 * directul să mai curgă cât ascultătorii se prind de radio și fac trecerea lină. Dacă aparatul nu
 * e pe LIVE, comanda pleacă pe loc.
 */
export const SUPRAPUNERE_MS = 6000
export async function treceAparatLin(
  ap: DurableObjectStub<Aparat>,
  schimbare: Schimbare,
  cine: string | null,
): Promise<void> {
  const c = await ap.comanda()
  if (c.stare === 'live') await ap.puneComandaDupa(schimbare, cine, SUPRAPUNERE_MS)
  else await ap.puneComanda(schimbare, cine)
}
