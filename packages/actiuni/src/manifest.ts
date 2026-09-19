import { z } from 'zod'
import { Obiect, type Actiune, type Efect, type ExempluActiune, type Registru } from './contract.js'

/**
 * MANIFESTUL — lista aplicatiei, gata de citit de un model sau de o alta aplicatie.
 *
 * Nu se scrie de mana si nu se tine la zi de mana: se calculeaza din registru, iar formele
 * argumentelor ies din schemele zod cu `z.toJSONSchema`. Deci descrierea pentru masini NU poate
 * ramane in urma fata de cod — daca schema se schimba, manifestul se schimba cu ea.
 */

export interface DescriereActiune {
  nume: string
  descriere: string
  efect: Efect
  permisiune: string | null
  /** `date` = JSON de citit; `obiect` = o hartie care circula (vezi `Obiect`). */
  da: 'date' | 'obiect'
  intrare: Record<string, unknown>
  iesire: Record<string, unknown>
  exemple: Array<string | ExempluActiune>
  /** Se cheama inainte de orice raspuns si intra in context (vezi `Actiune.fundal`). */
  fundal: boolean
  /** Nu e o unealta pentru model, e o usa pentru cod (vezi `Actiune.ascunsa`). */
  ascunsa: boolean
  /** Ce se propune dupa ce actiunea s-a facut (vezi `Actiune.urmare`). */
  urmare: { actiune: string; argumente: Record<string, string> } | null
}

/**
 * HARTA UNEI APLICAȚII — cuprinsul ei, ca DATE (user, 19.09.2026: „aș vrea să aibă un cuprins pe
 * care să facă match — cu subiecte… apoi nivelul 2 să înțeleagă acțiunea… Cu o hartă așa simplă ar
 * trebui să pot lucra și fără AI").
 *
 * ⚠️ CE SCHIMBĂ EA. O aplicație care declară o hartă capătă în chat FLUXUL CU DOUĂ NIVELE: mesajul
 * trece întâi prin potrivitorul ei determinist, iar dacă acela nu e sigur, modelul face doar două
 * clasificări mici (subiect, apoi acțiune), cu JSON strict și fără unelte. O aplicație FĂRĂ hartă
 * rămâne pe drumul de până acum — uneltele din manifest, alese de model. De aceea harta stă aici,
 * lângă manifest, și e opțională: nimic nu se schimbă pentru cine n-o scrie.
 *
 * Harta NU conține logică: e tabelul, în date. Potrivirea și traducerea într-un apel adevărat le
 * face aplicația, în acțiunea numită de `potrivitor` — numai ea știe starea (ce întrebare e pendinte,
 * ce articole există).
 */
export interface ActiuneHarta {
  id: string
  /** Cum se scrie pe buton, omenește: „titlul", „compune numărul". */
  nume: string
  /** Ce valoare cere de la om: `nimic`, `text` (scrisă de el), `fisier` (prin clemă). */
  cere: 'nimic' | 'text' | 'fisier'
  /** Se cere Da/Nu, cu interpretarea scrisă, înainte de a se face? */
  confirma: boolean
  /** Nu se oferă ca buton și nu intră în socoteala „acțiune unică" — dar se recunoaște la citire. */
  ascunsa?: boolean
  /** Ce se răspunde când lucrul NU se face de aici („se face în Program, nu de aici"). */
  raspuns?: string
}

export interface SubiectHarta {
  id: string
  /** Cum îi spune omul: „Articolul principal". */
  nume: string
  /** După ce se recunoaște — și pentru potrivitorul determinist, și pentru model. */
  cuvinte: string[]
  actiuni: ActiuneHarta[]
}

export interface HartaAplicatie {
  /**
   * Numele acțiunii (ascunse) care potrivește un mesaj și traduce o alegere într-un apel adevărat.
   * Chatul o cheamă ca serviciu, exact cum cheamă cârligul `laText`.
   */
  potrivitor: string
  /** Despre ce e vorba aici, într-o frază — intră în prompturile de nivel 1 și 2. */
  despre?: string
  subiecte: SubiectHarta[]
}

export interface Manifest {
  aplicatie: string
  versiune: string
  actiuni: DescriereActiune[]
  /** Vezi `HartaAplicatie`. Lipsa ei = aplicația rămâne pe drumul cu unelte. */
  harta?: HartaAplicatie | null
}

/**
 * `unrepresentable: 'any'` fiindca o schema poate contine forme pe care JSON Schema nu le are
 * (date, transformari); mai bine un camp „orice" decat un manifest care crapa. `io: 'input'`
 * pentru argumente — conteaza ce se DA, nu ce iese dupa `default`-uri.
 */
function schema(s: z.ZodType, io: 'input' | 'output'): Record<string, unknown> {
  try {
    return z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Record<string, unknown>
  } catch {
    return { type: 'object', description: 'formă netradusă în JSON Schema' }
  }
}

export function descrie(a: Actiune): DescriereActiune {
  return {
    nume: a.nume,
    descriere: a.descriere,
    efect: a.efect,
    permisiune: a.permisiune ?? null,
    da: a.felIesirii ?? (a.iesire === (Obiect as z.ZodType) ? 'obiect' : 'date'),
    intrare: schema(a.intrare, 'input'),
    iesire: schema(a.iesire, 'output'),
    exemple: a.exemple ?? [],
    fundal: Boolean(a.fundal),
    ascunsa: Boolean(a.ascunsa),
    urmare: a.urmare ?? null,
  }
}

export function manifest(
  aplicatie: string,
  versiune: string,
  r: Registru,
  harta?: HartaAplicatie | null,
): Manifest {
  return { aplicatie, versiune, actiuni: r.map(descrie), ...(harta ? { harta } : {}) }
}

/**
 * Uneltele pentru model: doar numele, descrierea si forma argumentelor. Schema de IESIRE ramane
 * in manifest pentru aplicatiile care o citesc, dar nu se trimite modelului — ar umple contextul
 * fara sa-l ajute sa aleaga.
 *
 * `efect: scrie` se scrie in descriere, ca modelul sa stie ca urmeaza o confirmare de la om; iar
 * `efect: ciorna` se scrie tocmai ca sa stie ca NU urmeaza niciuna — altfel un model mic intreaba
 * „sa scriu?" la fiecare raspuns al omului si chestionarul se dubleaza in apasari.
 */
export interface UnealtaDescrisa {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * ⚠️ NUMELE PENTRU MODEL NU POATE AVEA PUNCT. Măsurat pe Workers AI (11.09.2026): cu
 * `program.slujbele_zilei` modelul alege unealta potrivită, dar răspunsul iese ca TEXT
 * (`[program.slujbele_zilei(zi="duminică")]`) și niciun apel nu se execută; cu underscore, același
 * model, aceeași întrebare, întoarce `tool_calls` cum trebuie. Numele de funcție acceptat e
 * `^[a-zA-Z0-9_-]{1,64}$`, iar punctul cade din el.
 *
 * Numele canonic (`<aplicatie>.<verb>`) rămâne neatins peste tot — în manifest, în audit, în
 * apelurile dintre aplicații. Se traduce DOAR la ieșirea spre model și înapoi la întoarcere,
 * aici, într-un singur loc.
 */
export function numeUnealta(numeActiune: string): string {
  return numeActiune.replaceAll('.', '__')
}

export function actiuneaDupaUnealta(numeUnealta: string): string {
  return numeUnealta.replaceAll('__', '.')
}

export function unelteDinManifest(m: Manifest): UnealtaDescrisa[] {
  // ⚠️ `ascunsa` iese de aici, ca și `fundal`: e o ușă pentru cod (potrivitorul hărții), nu o unealtă
  // de ales. Lăsată în listă, ar fi un verb în plus pe care un model mic l-ar încerca la întâmplare.
  return m.actiuni.filter((a) => !a.fundal && !a.ascunsa).map((a) => ({
    name: numeUnealta(a.nume),
    description:
      a.descriere +
      (a.efect === 'scrie'
        ? ' [SCHIMBĂ date. Cheam-o direct, fără să ceri voie în text: chemarea doar pregătește o propunere, pe care omul o confirmă pe un buton.]'
        : '') +
      (a.efect === 'ciorna'
        ? ' [scrie doar în ciorna aplicației; se face pe loc, fără confirmare — nu întreba „să scriu?", scrie.]'
        : '') +
      (a.da === 'obiect' ? ' [dă o hârtie: se arată ca fișier, se poate trimite]' : '') +
      (a.exemple.length
        ? ` Exemple: ${a.exemple
            .map((e) => (typeof e === 'string' ? `„${e}"` : `„${e.fraza}" → ${JSON.stringify(e.argumente)}`))
            .join(' | ')}`
        : ''),
    parameters: a.intrare,
  }))
}
