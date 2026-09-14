import { DurableObject } from 'cloudflare:workers'
import { ordineNaturala, semnaturaDin } from '@xc/comanda'
import { SELECTIE_GOALA, STRUCTURA_CANONICA, type BibliotecaRadio, type FisierRadio, type SelectieRadio } from '@xc/contracts'

/**
 * CEASUL radioului — un obiect durabil cu o singură cheie.
 *
 * Aici nu se ține „ce se aude", ci DE CÂND curge selecția. Ce se aude se socotește de fiecare dată
 * din ceas și din durate (`ceSeAude` din `@xc/comanda`). Diferența nu e academică: dacă am ține
 * piesa curentă scrisă undeva, cineva ar trebui s-o mute la fiecare schimbare — un ceas, un cron,
 * un aparat. Așa, radioul merge singur la nesfârșit fără să pornească nimeni nimic.
 *
 * Tot aici se schimbă INDICELE bibliotecii, fiindcă obiectul durabil serializează: două urcări
 * deodată nu se mai calcă una pe alta (în V1 asta a fost capcana care strica lista).
 */

export interface EnvCeas {
  FISIERE: R2Bucket
  RADIO: DurableObjectNamespace<Radio>
}

const CHEIE_INDICE = 'indice/biblioteca.json'
/** Prefixul sub care stă muzica în depozit. Restul depozitului (înregistrări, predici) nu ne privește. */
export const PREFIX = 'mp3player/'

export class Radio extends DurableObject {
  async selectie(): Promise<SelectieRadio> {
    return (await this.ctx.storage.get<SelectieRadio>('selectie')) ?? SELECTIE_GOALA
  }

  /** Indicele așa cum e ACUM în depozit (fără nimic ținut minte) — pentru cine are nevoie de adevăr. */
  async indice(): Promise<BibliotecaRadio> {
    const env = this.env as unknown as EnvCeas
    const o = await env.FISIERE.get(CHEIE_INDICE)
    return o ? ((await o.json()) as BibliotecaRadio) : { generat_la: '', semnatura: '', fisiere: [] }
  }

  /** `adaugate` intră sau înlocuiesc, `sterse` ies. Totul sub un singur fir de execuție. */
  async actualizeazaIndice(
    adaugate: FisierRadio[] = [],
    sterse: string[] = [],
    directoareNoi: string[] = [],
    directoareSterse: string[] = [],
  ): Promise<BibliotecaRadio> {
    const env = this.env as unknown as EnvCeas
    const b = await this.indice()
    const m = new Map(b.fisiere.map((f) => [f.cale, f]))
    for (const c of sterse) m.delete(c)
    for (const f of adaugate) m.set(f.cale, f)
    const fisiere = [...m.values()].sort((x, y) => ordineNaturala(x.cale, y.cale))

    const d = new Set([...(b.directoare ?? []), ...STRUCTURA_CANONICA, ...directoareNoi])
    for (const x of directoareSterse) {
      for (const y of [...d]) if (y === x || y.startsWith(`${x}/`)) d.delete(y)
    }
    const noua: BibliotecaRadio = {
      generat_la: new Date().toISOString(),
      semnatura: await semnaturaDin(fisiere),
      fisiere,
      directoare: [...d].sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1)),
    }
    await env.FISIERE.put(CHEIE_INDICE, JSON.stringify(noua), {
      httpMetadata: { contentType: 'application/json' },
    })
    return noua
  }

  /**
   * Mută ceasul. `de` dat explicit = preluăm ceasul altcuiva (hotărârea aparatului), ca boxele din
   * biserică și telefoanele să rămână pe aceeași secundă fără să repornească nimic. Altfel ceasul o
   * ia de la capăt ori de câte ori se schimbă ce se aude.
   */
  async pune(s: Partial<SelectieRadio>, cine: string | null): Promise<SelectieRadio> {
    const veche = await this.selectie()
    const noua: SelectieRadio = {
      versiune: veche.versiune + 1,
      pornit: s.pornit ?? veche.pornit,
      director: s.director !== undefined ? s.director : veche.director,
      fisier_start: s.fisier_start !== undefined ? s.fisier_start : veche.fisier_start,
      de: s.de || new Date().toISOString(),
      cine,
    }
    await this.ctx.storage.put('selectie', noua)
    return noua
  }
}

export function radioul(env: EnvCeas) {
  return env.RADIO.get(env.RADIO.idFromName('parohia'))
}

export { CHEIE_INDICE }
