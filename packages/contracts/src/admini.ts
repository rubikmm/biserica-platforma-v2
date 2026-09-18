/**
 * ADMINISTRATORII PE APLICATIE — registrul care spune ce cheie face pe cineva administratorul unei
 * singure aplicatii.
 *
 * De ce exista (user, 18.09.2026): „Vreau sa fie valabila la toate aplicatiile — sa aiba toate
 * capacitatea de a avea setat administratori — eu ii setez la fiecare aplicatie in parte ca
 * administrator (deci nu doar super-admin)."
 *
 * ⚠️ AXA E CHEIA, NU ROLUL SI NU SCOPE-UL. Un administrator de aplicatie e un om cu ROLUL `user`
 * care a primit, punctual, cheia aplicatiei (`permission_grants` la autorizare, prin `/acorda`).
 * Tiparul nu e nou: asa se da `library.borrow` si asa numeste Curatenia adminii ei de pe
 * 14.09.2026 (eticheta „Admin" din panou ACORDA `cleaning.manage`). `Scope` exista in contracte
 * (`parish:`, `team:`, `audience:`), dar toate aplicatiile intreaba autorizarea cu `global`, deci un
 * rol cu scope ingust ar fi fost refuzat peste tot: cheia e singura axa care lucreaza cu adevarat.
 *
 * ⚠️ Rolul de admin GLOBAL ramane neatins: `PERMISIUNI_IMPLICITE.admin` are toate cheile de mai jos,
 * deci parintele face peste tot ce facea si pana acum. Deosebirea se vede la RETRAGERE: dreptul
 * venit din rol nu se poate lua din aplicatie (ar trebui coborat rolul, ceea ce e altceva) —
 * autorizarea le si deosebeste, in `/cine-are` si `/harta-admini`.
 *
 * ⚠️ Cine e sub masca „vezi ca" NU capata granturi: autorizarea decide cu permisiunile implicite ale
 * rolului imprumutat. Deci un super-admin „ca utilizator" nu vede panourile niciunei aplicatii, chiar
 * daca omul adevarat ar avea cheia — asa se cuvine, altfel previzualizarea ar minti.
 */
import type { Permisiune } from './permisiuni.js'

export interface AplicatieAdministrabila {
  /** codul aplicatiei, cum il stie platforma: `program`, `calendar`, `curatenie`… */
  cod: string
  /** numele pentru ochi, cum se scrie in tabel si in Setari */
  nume: string
  /** cheia din `URL_*`, ca tabelul din Administrare sa poata lega numele aplicatiei */
  cheieUrl: string
  /**
   * Cheia care spune „e administratorul acestei aplicatii". Pe ea se aprinde bulina din tabelul
   * Administrarii si pe ea atarna panourile aplicatiei (`eAdmin`).
   */
  cheieAdmin: Permisiune
  /**
   * Celelalte chei care vin ODATA cu numirea, fiindca fara ele numirea ar fi pe jumatate: un
   * administrator al Programului care poate scrie dar nu poate valida n-ar putea duce nimic la capat.
   * Se acorda si se retrag impreuna cu `cheieAdmin`.
   */
  cheiInsotitoare: readonly Permisiune[]
  /** Ce poate face adminul ei, pe romaneste — se scrie in rubrica din Setarile aplicatiei. */
  faptele: string
}

export const APLICATII_ADMINISTRABILE: readonly AplicatieAdministrabila[] = [
  {
    cod: 'program',
    nume: 'Programul liturgic',
    cheieUrl: 'URL_PROGRAM',
    cheieAdmin: 'program.write',
    // Scrierea fara validare nu duce nicaieri: foaia de pe usa si tabelul din buletin ies numai din
    // saptamani validate.
    cheiInsotitoare: ['program.publish'],
    faptele: 'Scrie și validează săptămânile, vede arhiva și paternurile.',
  },
  {
    cod: 'calendar',
    nume: 'Calendarul',
    cheieUrl: 'URL_CALENDAR',
    cheieAdmin: 'calendar.manage',
    cheiInsotitoare: [],
    faptele: 'Adaugă și schimbă sărbători, vede filtrul evlaviei.',
  },
  {
    cod: 'buletin',
    nume: 'Buletinul parohiei',
    cheieUrl: 'URL_BULETIN',
    cheieAdmin: 'bulletin.write',
    // La buletin validarea E publicarea (user, 18.09.2026): numarul compus intra in arhiva.
    cheiInsotitoare: ['bulletin.publish'],
    faptele: 'Compune numărul următor și îl publică în arhivă.',
  },
  {
    cod: 'newsletter',
    nume: 'Newsletterul',
    cheieUrl: 'URL_NEWSLETTER',
    cheieAdmin: 'newsletter.manage',
    cheiInsotitoare: [],
    faptele: 'Adaugă numere în arhivă și ține antetul și subsolul șablonului.',
  },
  {
    cod: 'curatenie',
    nume: 'Curățenia bisericii',
    cheieUrl: 'URL_CURATENIE',
    cheieAdmin: 'cleaning.manage',
    cheiInsotitoare: [],
    faptele: 'Ține panoul, primește oameni în echipă și trimite rapoartele.',
  },
  {
    cod: 'biblioteca',
    nume: 'Biblioteca',
    cheieUrl: 'URL_BIBLIOTECA',
    cheieAdmin: 'library.manage',
    cheiInsotitoare: [],
    faptele: 'Ține pangarul: dă cărțile cerute, le primește înapoi, întreține fișele.',
  },
  {
    cod: 'tipic',
    nume: 'Tipicul',
    cheieUrl: 'URL_TIPIC',
    cheieAdmin: 'typicon.manage',
    cheiInsotitoare: [],
    faptele: 'Umblă la rânduiala zilei.',
  },
  {
    cod: 'biblia',
    nume: 'Biblia',
    cheieUrl: 'URL_BIBLIA',
    cheieAdmin: 'bible.manage',
    cheiInsotitoare: [],
    // ⚠️ Azi Biblia n-are nicio fapta de admin: textul e adus o data si stat pe loc. Cheia exista ca
    // aplicatia sa NU fie deosebita de celelalte cand va avea una — numirea merge de acum, dar nu
    // deschide inca nimic. De spus omului, nu de ascuns.
    faptele: 'Deocamdată nimic: Biblia nu are încă nicio faptă de administrator.',
  },
  {
    cod: 'live',
    nume: 'LIVE — transmisiunea',
    cheieUrl: 'URL_LIVE',
    cheieAdmin: 'broadcast.manage',
    cheiInsotitoare: [],
    faptele: 'Pornește și oprește transmisiunea din biserică.',
  },
  {
    cod: 'radio',
    nume: 'Radio',
    cheieUrl: 'URL_RADIO',
    cheieAdmin: 'broadcast.manage',
    cheiInsotitoare: [],
    faptele: 'Alege ce se aude în boxe între slujbe.',
  },
  {
    cod: 'home',
    nume: 'Website',
    cheieUrl: 'URL_HOME',
    cheieAdmin: 'website.manage',
    cheiInsotitoare: [],
    faptele: 'Vede însemnările de șantier de pe ușă și ține textele citite la chinonic.',
  },
]

/**
 * ⚠️ `live` si `radio` IMPART aceeasi cheie (`broadcast.manage`), dinadins: panoul e unul singur si
 * comanda un singur aparat — „cine poate porni directul poate schimba si muzica" (regula din
 * `permisiuni.ts`). Deci in tabel cele doua buline se aprind si se sting IMPREUNA. Cine vrea sa le
 * despartă vreodata trebuie sa rupa intai cheia in doua, nu registrul asta.
 */
export function aplicatiaAdministrabila(cod: string): AplicatieAdministrabila | undefined {
  return APLICATII_ADMINISTRABILE.find((a) => a.cod === cod)
}

/** Toate cheile care se acorda si se retrag odata, cand cineva e numit admin al aplicatiei. */
export function cheileAdminului(cod: string): readonly Permisiune[] {
  const a = aplicatiaAdministrabila(cod)
  if (!a) return []
  return [a.cheieAdmin, ...a.cheiInsotitoare]
}

/** Aplicatiile care atarna de o cheie, cu numele lor — pentru mesajele „cheia asta deschide…". */
export function aplicatiileCheii(cheie: Permisiune): readonly AplicatieAdministrabila[] {
  return APLICATII_ADMINISTRABILE.filter((a) => a.cheieAdmin === cheie)
}
