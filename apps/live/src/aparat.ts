import { DurableObject } from 'cloudflare:workers'
import { pieseDin } from '@xc/comanda'
import { COMANDA_GOALA, type ComandaAparat, type SelectieRadio, type SunetAparat, type Telemetrie } from '@xc/contracts'
import { type EnvRadioDeparte, ceasRadio, indiceRadio, puneCeas } from './radio-departe.js'
import {
  CINE_CEAS,
  ISTORIE_MAX,
  ROTIRE_GOALA,
  type StareRotire,
  albumeDin,
  alegeAlbum,
  contorulDeStart,
  durataAlbumului,
  eRotireaPornita,
  sunetCurat,
  ultimulSunetNou,
  urmatoareaRotire,
} from './rotire.js'

/**
 * APARATUL — legătura aplicației cu daemonul de la biserică.
 *
 * Aparatul stă după NAT, deci EL deschide toate legăturile: cere comanda în long-poll și își
 * trimite telemetria. Aici ținem, într-un obiect durabil cu o singură cheie:
 *   - COMANDA: ce vrem de la el (stare, director, piesa de start), cu o versiune care crește la
 *     fiecare schimbare — după ea știe dacă are ceva nou de făcut;
 *   - STAREA: ultima telemetrie (ce face, ce piesă, erori, disc, programul lui de slujbe, sunetul);
 *   - ROTIREA albumelor: de când n-a mai comandat un om și ce albume a ales ceasul (vezi `rotire.ts`);
 *   - ULTIMUL SUNET: cea mai recentă clipă în care microfonul a auzit ceva peste prag — ținută
 *     deoparte fiindcă e MONOTONĂ (nu scade niciodată) și se scrie pe drumul cel mai umblat,
 *     telemetria de la 20 s; înghesuită în `rotire`, fiecare bătaie ar rescrie și contorul omului.
 *
 * ⚠️ Numele câmpurilor sunt cele din V1, dinadins: **aparatul e ACELAȘI**, nu-l rescriem odată cu
 * platforma. Contractul e descris și în `aparat/worker.py`, de partea cealaltă.
 */

export interface EnvAparat {
  APARAT: DurableObjectNamespace<Aparat>
  APARAT_SECRET?: string
}

type Schimbare = Partial<Pick<ComandaAparat, 'stare' | 'director' | 'fisier_start' | 'selectie'>>

/** Comanda „radio" pentru aparat (boxele bisericii): selecția cu ceasul ei. */
export const radioPentruAparat = (sel: SelectieRadio): Schimbare => ({
  stare: 'radio',
  director: sel.director,
  fisier_start: sel.fisier_start,
  selectie: { versiune: sel.versiune, director: sel.director, fisier_start: sel.fisier_start, de: sel.de },
})

/**
 * După atâtea secunde fără telemetrie, aparatul e „nu răspunde". El bate la 20 s, deci lăsăm loc
 * de trei bătăi pierdute: altfel panoul ar striga „legătură ruptă" la prima cerere căzută.
 */
const APARAT_VIU_S = 75
const ASTEAPTA_MAX_S = 30

/**
 * CEASURILE programate, în milisecunde de epocă.
 *
 * ⚠️ Un obiect durabil are **o singură alarmă**, iar aici sunt două ceasuri cu ritmuri cu totul
 * diferite: comanda întârziată (suprapunerea LIVE → radio, câteva secunde) și rotirea albumelor
 * (ore). De aceea nu se mai cheamă `setAlarm`/`deleteAlarm` de-a dreptul: ținem SCRIS ce e
 * programat și pentru când, punem alarma la cel mai apropiat, iar la trezire facem ce e scadent și
 * o programăm din nou. Cine stinge alarma „ca să fie curat" înghite tăcut celălalt ceas.
 */
interface Alarme {
  intarziata?: number
  rotire?: number
}

/** Alarma sună „la sau după" ora cerută; câteva milisecunde în minus n-au de ce s-o rateze. */
const MARJA_ALARMA_MS = 1000

/**
 * Cât așteptăm până reîncercăm, când rotirea e scadentă dar biblioteca n-are alt album pe care să
 * sărim. Fără el, un album de trei minute ne-ar trezi de două sute de ori pe zi degeaba.
 */
const REINCEARCA_ROTIREA_MS = 60 * 60 * 1000

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

  // --- ceasurile obiectului (una singură, două rosturi) ------------------------

  private async alarme(): Promise<Alarme> {
    return (await this.ctx.storage.get<Alarme>('alarme')) ?? {}
  }

  /** Scrie ce ceasuri sunt programate și pune alarma obiectului la cel mai apropiat dintre ele. */
  private async scrieAlarme(a: Alarme): Promise<void> {
    const ramase: Alarme = {}
    if (a.intarziata) ramase.intarziata = a.intarziata
    if (a.rotire) ramase.rotire = a.rotire
    await this.ctx.storage.put('alarme', ramase)
    const ore = [ramase.intarziata, ramase.rotire].filter((t): t is number => t !== undefined)
    if (ore.length > 0) await this.ctx.storage.setAlarm(Math.min(...ore))
    else await this.ctx.storage.deleteAlarm()
  }

  /** Stinge doar ceasul comenzii întârziate, lăsându-l pe al rotirii unde e. */
  private async stingeIntarziata(): Promise<void> {
    const { rotire } = await this.alarme()
    await this.scrieAlarme(rotire !== undefined ? { rotire } : {})
  }

  /**
   * Aceeași comandă, dar aplicată abia peste `ms` (alarma obiectului, supraviețuiește evacuării).
   * Orice comandă pusă între timp o anulează: LIVE apăsat la loc în fereastra de suprapunere nu
   * mai e urmat de un „oprit" rătăcit.
   */
  async puneComandaDupa(schimbare: Schimbare, de: string | null, ms: number): Promise<void> {
    await this.ctx.storage.put('intarziata', { schimbare, de })
    await this.scrieAlarme({ ...(await this.alarme()), intarziata: Date.now() + ms })
  }

  /**
   * Ceasul deșteptător al obiectului. ⚠️ Alarma nu e un adevăr, e doar ORA: ce e de făcut se
   * recitește de fiecare dată din storage, fiindcă între programare și trezire pot trece ore în
   * care omul a apăsat ceva, aparatul a pornit o slujbă sau biblioteca s-a schimbat.
   */
  override async alarm(): Promise<void> {
    const scadenta = (t?: number) => t !== undefined && t <= Date.now() + MARJA_ALARMA_MS
    const a = await this.alarme()
    /*
     * ⚠️ O alarmă pusă ÎNAINTE de multiplexare nu are `alarme` scris lângă ea. Comanda întârziată
     * ține doar șase secunde, deci dacă am ajuns la trezire, ea e cea scadentă — fără rândul ăsta,
     * o publicare nimerită chiar în fereastra de suprapunere ar înghiți tăcut un „oprit".
     */
    const vechime = a.intarziata === undefined && a.rotire === undefined

    if (scadenta(a.intarziata) || vechime) {
      const i = await this.ctx.storage.get<{ schimbare: Schimbare; de: string | null }>('intarziata')
      // `puneComanda` stinge singură ceasul; fără conținut, doar îl curățăm.
      if (i) await this.puneComanda(i.schimbare, i.de)
      else await this.stingeIntarziata()
    }

    if (scadenta((await this.alarme()).rotire)) await this.roteste()
    // Alarma e una singură: după ce am făcut ce era scadent, o punem pe ceasul următor.
    await this.scrieAlarme(await this.alarme())
  }

  async puneComanda(schimbare: Schimbare, de: string | null): Promise<ComandaAparat> {
    await this.ctx.storage.delete('intarziata')
    // ⚠️ NU `deleteAlarm()`: lângă comanda întârziată stă acum ceasul rotirii, care n-are nicio
    // treabă cu ea. Stinsă de tot, rotirea ar tăcea pentru totdeauna, fără nicio urmă.
    await this.stingeIntarziata()
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
    /*
     * SUNETUL: telemetria e date străine, deci trece prin `sunetCurat` (ce nu se poate citi se
     * ignoră, restul telemetriei rămâne întreagă), iar clipa de activitate urcă MONOTON — un `null`
     * de la un aparat care nu măsoară, ori o valoare mai veche de la unul repornit, n-o coboară.
     * ⚠️ Aici NU se atinge alarma: bătaia vine la 20 s, iar rotirea se reprogramează singură când se
     * trezește (vezi `urmatoareaRotire`).
     */
    const clipa = sunetCurat(t.sunet)?.ultimul_peste_prag ?? null
    if (clipa) {
      const vechi = await this.ultimulSunet()
      const nou = ultimulSunetNou(vechi, clipa)
      if (nou !== vechi) await this.ctx.storage.put('ultimul_sunet', nou)
    }
  }
  async stare(): Promise<Telemetrie | null> {
    return (await this.ctx.storage.get<Telemetrie>('stare')) ?? null
  }

  /** Ultima clipă în care microfonul a auzit ceva peste prag (ISO), cât de departe o știm. */
  async ultimulSunet(): Promise<string | null> {
    return (await this.ctx.storage.get<string>('ultimul_sunet')) ?? null
  }

  /**
   * Pentru pagina microfonului: ce aude aparatul ACUM (ultima măsurătoare, curățată) și de când n-a
   * mai auzit nimic. Măsurătoarea se citește din telemetrie, nu dintr-o cheie a ei: `null` acolo
   * înseamnă „aparatul nu măsoară", și tocmai asta trebuie să se vadă pe pagină.
   */
  async sunet(): Promise<{ sunet: SunetAparat | null; ultimul_sunet: string | null }> {
    const [t, ultimul_sunet] = await Promise.all([this.stare(), this.ultimulSunet()])
    return { sunet: sunetCurat(t?.sunet), ultimul_sunet }
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

  // --- rotirea albumelor (v. `rotire.ts`) ---------------------------------------

  /** Ce ținem minte: ultima comandă de om și albumele alese de ceas. */
  async rotire(): Promise<StareRotire> {
    return (await this.ctx.storage.get<StareRotire>('rotire')) ?? ROTIRE_GOALA
  }

  /** Pentru panou: de când n-a mai comandat un om, de când n-a mai auzit nimic, când sună ceasul. */
  async stareRotire(): Promise<{ ultima_om: string | null; ultimul_sunet: string | null; la: string | null }> {
    const [r, a, ultimul_sunet] = await Promise.all([this.rotire(), this.alarme(), this.ultimulSunet()])
    return {
      ultima_om: r.ultima_om,
      ultimul_sunet,
      la: a.rotire === undefined ? null : new Date(a.rotire).toISOString(),
    }
  }

  /**
   * (Re)pune ceasul rotirii. Se cheamă după FIECARE scriere de selecție sau comandă — altfel alarma
   * ar rămâne pe ora unui album care nu mai cântă.
   *
   * ⚠️ `eOm: true` înseamnă o apăsare de om în panou, și numai ea: contorul o ia de la zero, iar
   * istoria se uită (de acum înainte alege omul, nu ceasul). Hotărârile aparatului trec pe aici cu
   * `eOm: false` — vezi pricina în `rotire.ts`.
   */
  async programeazaRotirea(x: {
    eOm: boolean
    pornit: boolean
    de: string
    totalS: number
    /** Selecția de acum e a CEASULUI? Atunci rotirea e în curs și alarma merge pe capătul albumului. */
    aleasaDeCeas?: boolean
  }): Promise<void> {
    const acum = Date.now()
    const veche = await this.rotire()
    /*
     * ⚠️ PRIMA ATINGERE, când nu știm de nicio comandă de om: contorul se seamănă cu o zi ÎN URMĂ
     * (`acum − FARA_OM_MS`), nu cu `acum` (user, 18.09.2026: „să fie deja peste 24h"). Un radio
     * despre care nu ținem minte nicio apăsare se socotește nepăzit, deci rotirea e scadentă pe
     * loc — altfel o aplicație abia publicată ar mai lăsa parohia o zi pe același album.
     */
    const seamanaContorul = !x.eOm && !veche.ultima_om
    const noua: StareRotire = x.eOm
      ? { ultima_om: new Date(acum).toISOString(), istorie: [] }
      : { ...veche, ultima_om: veche.ultima_om ?? contorulDeStart(acum) }
    await this.ctx.storage.put('rotire', noua)

    // ⚠️ O comandă de om cere din nou o oră întreagă de liniște: `scadentaRotirii` socotește din
    // maximul dintre `ultima_om` și `ultimul_sunet`, deci contorul de mai sus mută și ceasul ăsta.
    const la = urmatoareaRotire({
      acum,
      ultimaOm: noua.ultima_om,
      ultimulSunet: await this.ultimulSunet(),
      aleasaDeCeas: x.aleasaDeCeas ?? false,
      pornit: x.pornit,
      de: x.de,
      totalS: x.totalS,
    })
    /*
     * ⚠️ La semănatul contorului, alarma se pune pe ACUM, nu pe capătul albumului. `urmatoareaRotire`
     * amână la capăt orice rotire găsită scadentă în clipa programării — regulă bună la întoarcerea
     * din LIVE, unde albumul chiar a pornit acum, dar nu și aici: albumul de acum curge în buclă de
     * zile, iar capătul lui ar veni la o oră neștiută. Radio nepăzit înseamnă rotire la prima alarmă.
     */
    const cand = seamanaContorul && la !== null ? Math.min(la, acum) : la
    await this.scrieAlarme({ ...(await this.alarme()), rotire: cand ?? undefined })
  }

  /**
   * A sunat ceasul rotirii. Recitim totul (mai cântă radioul? chiar a trecut ziua?) și, dacă e
   * cazul, sărim pe alt album — pe ACELAȘI drum ca o comandă din panou: întâi ceasul radioului,
   * apoi o versiune nouă de comandă, ca aparatul din biserică s-o ia prin long-poll.
   */
  private async roteste(): Promise<void> {
    const env = this.env as unknown as EnvRadioDeparte
    const acum = Date.now()
    const [r, cmd, ceas, ultimulSunet] = await Promise.all([
      this.rotire(),
      this.comanda(),
      ceasRadio(env),
      this.ultimulSunet(),
    ])
    const sel = ceas.selectie
    // Cântă un album pus de CEAS: rotirea e deja pornită și merge mai departe la fiecare capăt,
    // orice s-ar auzi între timp în biserică. O oprește numai o comandă de om (vezi `rotire.ts`).
    const aleasaDeCeas = sel.pornit && sel.cine === CINE_CEAS

    // LIVE sau OPRIT: nu se rotește nimic. Ceasul se pune la loc când radioul reia (`preiaDecizia`).
    if (!sel.pornit || cmd.stare !== 'radio') {
      await this.programeazaRotirea({ eOm: false, pornit: false, de: sel.de, totalS: 0 })
      return
    }

    const b = await indiceRadio(env)
    /*
     * Ne-am trezit degeaba: ori omul a apăsat ceva între timp, ori s-a auzit lumea în biserică după
     * ce pusesem alarma. Nu sărim — ne culcăm la loc până la noua scadență. ⚠️ Aici se vede de ce
     * alarma nu e un adevăr, ci doar o oră: `ultimul_sunet` se schimbă la fiecare bătaie de
     * telemetrie, fără să reprogrameze nimic, iar amânarea asta o ajunge din urmă.
     */
    if (!eRotireaPornita({ acum, ultimaOm: r.ultima_om, ultimulSunet, aleasaDeCeas })) {
      await this.programeazaRotirea({
        eOm: false,
        pornit: true,
        de: sel.de,
        totalS: durataAlbumului(b, sel.director),
      })
      return
    }

    const ales = alegeAlbum(albumeDin(b), sel.director, r.istorie)
    const prima = ales ? pieseDin(b, ales)[0] : undefined
    if (!ales || !prima) {
      // Un singur album în bibliotecă (sau niciunul): n-avem încotro sări. Reîncercăm mai târziu,
      // poate s-a urcat între timp muzică nouă.
      await this.scrieAlarme({ ...(await this.alarme()), rotire: acum + REINCEARCA_ROTIREA_MS })
      return
    }

    // `de` nu se dă: ceasul radioului repornește de la zero, adică de la prima piesă a albumului.
    const noua = await puneCeas(env, { pornit: true, director: ales, fisier_start: prima.cale }, CINE_CEAS)
    /*
     * ⚠️ `puneCeas` înghite erorile și întoarce selecția GOALĂ (vezi `radio-departe.ts`). O comandă
     * făcută din ea ar însemna „radio, fără director" — adică LINIȘTE în boxele bisericii, la trei
     * noaptea, fără să fi apăsat nimeni nimic. Dacă ceasul n-a primit ce i-am cerut, nu comandăm.
     */
    if (!noua.pornit || noua.director !== ales) {
      await this.scrieAlarme({ ...(await this.alarme()), rotire: acum + REINCEARCA_ROTIREA_MS })
      return
    }
    await this.puneComanda(radioPentruAparat(noua), CINE_CEAS)
    await this.ctx.storage.put('rotire', { ...r, istorie: [ales, ...r.istorie].slice(0, ISTORIE_MAX) })
    await this.programeazaRotirea({
      eOm: false,
      pornit: noua.pornit,
      de: noua.de,
      totalS: durataAlbumului(b, ales),
      // Albumul de acum e al ceasului: următoarea trezire e capătul lui, nu vreo scadență de pornire.
      aleasaDeCeas: true,
    })
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
