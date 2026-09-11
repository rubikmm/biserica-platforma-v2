import { z } from 'zod'
import { Obiect, type Actiune, type Efect, type Registru } from './contract.js'

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
  exemple: string[]
  /** Se cheama inainte de orice raspuns si intra in context (vezi `Actiune.fundal`). */
  fundal: boolean
}

export interface Manifest {
  aplicatie: string
  versiune: string
  actiuni: DescriereActiune[]
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
  }
}

export function manifest(aplicatie: string, versiune: string, r: Registru): Manifest {
  return { aplicatie, versiune, actiuni: r.map(descrie) }
}

/**
 * Uneltele pentru model: doar numele, descrierea si forma argumentelor. Schema de IESIRE ramane
 * in manifest pentru aplicatiile care o citesc, dar nu se trimite modelului — ar umple contextul
 * fara sa-l ajute sa aleaga.
 *
 * `efect: scrie` se scrie in descriere, ca modelul sa stie ca urmeaza o confirmare de la om.
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
  return m.actiuni.filter((a) => !a.fundal).map((a) => ({
    name: numeUnealta(a.nume),
    description:
      a.descriere +
      (a.efect === 'scrie'
        ? ' [SCHIMBĂ date. Cheam-o direct, fără să ceri voie în text: chemarea doar pregătește o propunere, pe care omul o confirmă pe un buton.]'
        : '') +
      (a.da === 'obiect' ? ' [dă o hârtie: se arată ca fișier, se poate trimite]' : '') +
      (a.exemple.length ? ` Exemple: ${a.exemple.join(' / ')}` : ''),
    parameters: a.intrare,
  }))
}
