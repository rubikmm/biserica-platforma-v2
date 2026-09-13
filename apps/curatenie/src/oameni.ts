/**
 * CARTEA OAMENILOR — cine e fiecare membru al echipei, cerut de la identitate.
 *
 * Pana pe 14.09.2026 aplicatia tinea ea insasi nume, e-mail si telefon (`volunteers.first_name`
 * si celelalte): era ultima abatere de la „datele stau intr-un loc, autentificarea la fel".
 * Utilizatorul a cerut atunci ca voluntarii sa fie CONTURI ale platformei, iar apartenenta la
 * echipa sa fie o asociere pe contul lor. De atunci:
 *
 *   - `volunteers` mai tine doar cheia locala (`id`, ceruta de cheile straine ale programarilor),
 *     `user_id`, adresa scurta (`slug`) si datele randului;
 *   - numele, adresa, telefonul si etichetele (Voluntar / Monitor / Admin) se CER de la identitate,
 *     o data pe cerere, si se lipesc peste randuri aici.
 *
 * ⚠️ De ce un INVELIS peste `D1Database` si nu un parametru in plus: functiile depozitului sunt
 * chemate din vreo 45 de locuri, toate cu `db` pe primul loc. Invelisul duce cartea oamenilor
 * odata cu baza, deci niciun apel n-a trebuit rescris. E facut din nou la fiecare cerere —
 * binding-ul D1 e acelasi obiect intre cereri, deci nimic nu se agata de el.
 */

import type { MembruAplicatie, StareAsociere } from '@xc/contracts'

export const APLICATIE = 'curatenie'

/**
 * Vocabularul pe care curatenia il pune pe asociere. Identitatea il pastreaza ca pe niste cuvinte
 * si nu-l intelege — intelesul e numai aici. Aceleasi coduri sunt scrise si in registrul din
 * `@xc/contracts`, de unde le citeste pagina contului ca sa le scrie omului pe romaneste.
 */
export const ETICHETA_VOLUNTAR = 'voluntar'
export const ETICHETA_MONITOR = 'monitor'
export const ETICHETA_ADMIN = 'admin'
/** Cheia pe care o acorda eticheta de admin. Eticheta NU e un desen: e numirea insasi. */
export const CHEIE_ADMIN = 'cleaning.manage'

export interface Om {
  userId: string
  email: string | null
  displayName: string | null
  firstName: string
  lastName: string
  phone: string | null
  /** Numele scurt scris de om pe contul lui („Mihai P."). Gol → se socoteste din prenume + inițială. */
  shortName: string | null
  disabled: boolean
  stare: StareAsociere | null
  etichete: string[]
}

function catreOm(m: MembruAplicatie): Om {
  // Cand omul n-a completat prenume/nume pe contul lui, se taie numele afisat in doua — ca sa
  // existe totusi ceva de scris pe un buton. Adresa e ultima plasa.
  let first = (m.firstName ?? '').trim()
  let last = (m.lastName ?? '').trim()
  if (!first && !last) {
    const brut = (m.displayName ?? m.email ?? '').trim()
    const bucati = brut.split(/\s+/).filter(Boolean)
    first = bucati[0] ?? ''
    last = bucati.slice(1).join(' ')
  }
  return {
    userId: m.userId,
    email: m.email || null,
    displayName: m.displayName,
    firstName: first,
    lastName: last,
    phone: m.phone,
    shortName: (m.shortName ?? '').trim() || null,
    disabled: !!m.disabledAt,
    stare: m.stare,
    etichete: m.etichete ?? [],
  }
}

/** Oamenii aplicatiei, indexati dupa contul lor. Se face o data pe cerere. */
export class CarteaOamenilor {
  private dupaUser = new Map<string, Om>()

  constructor(membri: MembruAplicatie[]) {
    for (const m of membri) this.dupaUser.set(m.userId, catreOm(m))
  }

  om(userId: string | null | undefined): Om | undefined {
    return userId ? this.dupaUser.get(userId) : undefined
  }

  toti(): Om[] {
    return [...this.dupaUser.values()]
  }

  /** Cati membri primiti in echipa are aplicatia — fara cererile in asteptare. */
  catiPrimiti(): number {
    return this.toti().filter((o) => o.stare === 'acceptata').length
  }
}

/** Baza aplicatiei, cu cartea oamenilor legata de ea pe durata cererii. */
export interface Baza extends D1Database {
  oameni: CarteaOamenilor
}

/**
 * Invelisul. Deleaga tot ce foloseste aplicatia (`prepare`, `batch`, `exec`, `dump`) catre
 * binding-ul adevarat — fara mostenire prototipala, ca `this` sa ramana binding-ul nativ.
 */
export function cuOameni(db: D1Database, oameni: CarteaOamenilor): Baza {
  return {
    prepare: (interogare: string) => db.prepare(interogare),
    batch: <T = unknown>(declaratii: D1PreparedStatement[]) => db.batch<T>(declaratii),
    exec: (interogare: string) => db.exec(interogare),
    dump: () => db.dump(),
    oameni,
  } as unknown as Baza
}

// ---------------------------------------------------------------------------
// Vorbitul cu identitatea
// ---------------------------------------------------------------------------

export interface Identitate {
  IDENTITATE: Fetcher
}

async function cere(env: Identitate, cale: string, corp: unknown): Promise<Response> {
  return env.IDENTITATE.fetch(`https://identity.intern${cale}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corp),
  })
}

/**
 * Echipa, de la identitate. Cuprinde SI cererile in asteptare (`stare: 'ceruta'`): panoul are
 * nevoie de ele ca sa le arate, iar restul aplicatiei le deosebeste dupa `stare`.
 *
 * Daca identitatea tace, cartea iese GOALA — si atunci pagina arata o echipa goala, nu una veche
 * si mincinoasa. E alegerea mai putin rea: un nume lipsa se vede, un nume gresit nu.
 */
export async function incarcaOamenii(env: Identitate): Promise<CarteaOamenilor> {
  try {
    const raspuns = await cere(env, '/asocieri/membri', { aplicatie: APLICATIE })
    if (!raspuns.ok) return new CarteaOamenilor([])
    const date = (await raspuns.json()) as { membri?: MembruAplicatie[] }
    return new CarteaOamenilor(date.membri ?? [])
  } catch {
    return new CarteaOamenilor([])
  }
}

/** Toti oamenii platformei, cu starea asocierii lor — pentru lista „+ Adaugă" din panou. */
export async function totiUtilizatorii(env: Identitate): Promise<MembruAplicatie[]> {
  try {
    const raspuns = await cere(env, '/utilizatori/lista', { aplicatie: APLICATIE })
    if (!raspuns.ok) return []
    const date = (await raspuns.json()) as { utilizatori?: MembruAplicatie[] }
    return date.utilizatori ?? []
  } catch {
    return []
  }
}

export async function primesteInEchipa(
  env: Identitate,
  userId: string,
  acceptatDe: string,
  etichete: string[],
): Promise<void> {
  await cere(env, '/asocieri/accepta', { userId, aplicatie: APLICATIE, acceptatDe, etichete })
}

export async function scoateDinEchipa(env: Identitate, userId: string, deCatre: string): Promise<void> {
  await cere(env, '/asocieri/scoate', { userId, aplicatie: APLICATIE, deCatre })
}

export async function scrieEtichetele(env: Identitate, userId: string, etichete: string[]): Promise<void> {
  await cere(env, '/asocieri/etichete', { userId, aplicatie: APLICATIE, etichete })
}

export async function scrieDatele(
  env: Identitate,
  userId: string,
  date: { firstName?: string; lastName?: string; phone?: string; shortName?: string },
): Promise<void> {
  await cere(env, '/utilizatori/date', { userId, ...date })
}
