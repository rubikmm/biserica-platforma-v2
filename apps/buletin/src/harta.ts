/**
 * HARTA BULETINULUI — cuprinsul foii, ca DATE, și potrivitorul determinist care lucrează pe ea.
 *
 * Cererea utilizatorului (19.09.2026, 11:27): „Cred că trebuie să avem altă abordare cu AI-ul free.
 * Aș vrea să aibă un cuprins pe care să facă match — cu subiecte. Dacă nu înțelege subiectul spune
 * asta. Apoi nivelul 2 să înțeleagă acțiunea — dacă nu o poate alege să zică asta și apoi
 * confirmarea. La ambele nivele să întrebe dacă nu e sigur. Cu o hartă așa simplă ar trebui să pot
 * lucra și fără AI."
 *
 * Deci modelul NU mai primește patru unelte și optsprezece reguli ca să aleagă singur. Drumul e:
 *
 *   mesaj → [NIVEL 1: subiectul, din cuprins] → [NIVEL 2: acțiunea, din subiect] → [CONFIRMARE]
 *
 * iar fiecare treaptă are și o ieșire cinstită: „nu înțeleg despre ce e vorba" / „e vorba de X sau
 * de Y?". Modelul e chemat DOAR când potrivitorul de aici n-a fost sigur — și atunci face o
 * clasificare mică, cu JSON strict, fără unelte.
 *
 * ⚠️ DE CE AICI ȘI NU ÎN CHAT-WORKER. Numai buletinul știe starea: ce întrebare e pendinte, ce
 * articole există, ce titluri s-au propus. Chat-worker cheamă potrivitorul ca pe un serviciu (la fel
 * ca pe cârligul `laText`) și nu cunoaște niciun câmp al foii. Așa harta rămâne a aplicației, iar
 * mecanismul (două nivele + confirmare) rămâne al platformei.
 *
 * ⚠️ NICIO SCRIERE AICI. `potriveste` e o funcție pură: același mesaj și aceeași stare dau mereu
 * același răspuns, fără rețea și fără depozit — deci se poate proba cap-coadă fără model. Scrierea
 * rămâne unde era: `scrieRaspuns` din `schita.ts`, chemată prin acțiunile de azi.
 */
import type { ActiuneHarta, HartaAplicatie, SubiectHarta } from '@xc/actiuni'
import { CAMPURI_CU_VARIANTE, eRefuz } from './refuz.js'
import type { Articol } from './schita.js'

// ---------------------------------------------------------------------------
// TABELUL 1 — CUPRINSUL (subiectele) și TABELUL 2 — acțiunile fiecăruia
// ---------------------------------------------------------------------------

/** Cum se numește articolul în interpretarea scrisă în propunere: „Titlul SECUNDARULUI 1 → …". */
export const LA_GENITIV: Record<Articol, string> = {
  principal: 'articolului principal',
  s1: 'secundarului 1',
  s2: 'secundarului 2',
}

/**
 * Cele nouă acțiuni ale unui ARTICOL, aceleași la principal și la cei doi secundari. Scrise o dată:
 * trei copii s-ar fi depărtat una de alta la prima schimbare.
 *
 * ⚠️ `poza` cere `fisier`, nu text, și NU confirmă: poza se urcă prin clemă, iar cârligul `laFisier`
 * o scrie în schiță pe loc — o propunere Da/Nu ar veni după fapt.
 */
const ALE_ARTICOLULUI: ActiuneHarta[] = [
  { id: 'text', nume: 'textul', cere: 'text', confirma: true },
  { id: 'autor', nume: 'autorul', cere: 'text', confirma: true },
  { id: 'ani', nume: 'anii vieții', cere: 'text', confirma: true },
  { id: 'pomenire', nume: 'ziua de pomenire', cere: 'text', confirma: true },
  { id: 'titlu', nume: 'titlul', cere: 'text', confirma: true },
  { id: 'semnatura', nume: 'semnătura de sub titlu', cere: 'text', confirma: true },
  { id: 'sursa', nume: 'sursa', cere: 'text', confirma: true },
  { id: 'mentiune', nume: 'mențiunea de deasupra sursei', cere: 'text', confirma: true },
  {
    id: 'poza',
    nume: 'poza',
    cere: 'fisier',
    confirma: false,
    raspuns: 'Poza se dă din clema 📎 de lângă câmpul de scris — o pun singur la articolul de acum.',
  },
]

const STERGE_SECUNDARUL: ActiuneHarta = { id: 'sterge', nume: 'șterge-l', cere: 'nimic', confirma: true }

export const CUPRINS: SubiectHarta[] = [
  {
    id: 'motto',
    nume: 'Motto-ul numărului',
    cuvinte: ['motto', 'moto', 'citat', 'cine a spus', 'zicere', 'deviza'],
    actiuni: [
      { id: 'schimba', nume: 'scrie alt motto', cere: 'text', confirma: true },
      { id: 'autor', nume: 'cine l-a spus', cere: 'text', confirma: true },
      { id: 'pastreaza', nume: 'rămâne cel de acum', cere: 'nimic', confirma: false },
    ],
  },
  {
    id: 'principal',
    nume: 'Articolul principal',
    cuvinte: ['principal', 'articolul mare', 'textul principal', 'primul articol', 'pagina intai', 'pagina 1'],
    actiuni: ALE_ARTICOLULUI,
  },
  {
    id: 's1',
    nume: 'Articolul secundar 1',
    // ⚠️ și genitivul („titlul SECUNDARULUI 1"): fără el, instrucțiunea cea mai firească din lume
    // n-ar fi nimerit niciun subiect, fiindcă potrivirea e pe cuvinte întregi.
    cuvinte: ['secundar 1', 'secundarul 1', 'secundarului 1', 's1', 'primul secundar', 'al doilea text', 'al doilea articol'],
    actiuni: [...ALE_ARTICOLULUI, STERGE_SECUNDARUL],
  },
  {
    id: 's2',
    nume: 'Articolul secundar 2',
    cuvinte: ['secundar 2', 'secundarul 2', 'secundarului 2', 's2', 'al doilea secundar', 'al treilea text', 'al treilea articol'],
    actiuni: [...ALE_ARTICOLULUI, STERGE_SECUNDARUL],
  },
  {
    id: 'numar',
    nume: 'Numărul întreg',
    cuvinte: ['numar', 'buletin', 'compune', 'varianta', 'socoteala', 'incape', 'unde am ramas', 'chestionar', 'de la capat', 'mai adaugam', 'foaia'],
    actiuni: [
      { id: 'compune', nume: 'compune numărul', cere: 'nimic', confirma: true },
      { id: 'socoteste', nume: 'socotește dacă încape', cere: 'nimic', confirma: false },
      { id: 'continua', nume: 'unde am rămas?', cere: 'nimic', confirma: false },
      { id: 'mai_adaugam', nume: 'mai adăugăm un secundar', cere: 'nimic', confirma: false },
      /*
       * ⚠️ `de_la_capat` CONFIRMĂ MEREU, chiar cerut în cuvintele lui (hotărâre a orchestratorului,
       * 19.09.2026): e singura acțiune a hărții care ȘTERGE ce a strâns omul. Restul se scriu peste
       * un câmp; asta golește foaia.
       */
      { id: 'de_la_capat', nume: 'ia-o de la capăt', cere: 'nimic', confirma: true },
      {
        id: 'valideaza',
        nume: 'validează numărul',
        cere: 'nimic',
        confirma: false,
        ascunsa: true,
        raspuns: 'Validarea nu se face din chat: apasă „Validează" pe ecranul „buletin nou". Publicarea e a ta.',
      },
      /*
       * RETRAGEREA (ne-publicarea) — user, 20.09.2026: „trebuie să avem și buton de ne-publicare —
       * dacă s-a publicat greșit — și să poată face asta și chat-ul".
       *
       * ⚠️ CONFIRMĂ MEREU, ca `de_la_capat`: scoate un număr din arhiva parohiei. Ce se șterge e
       * doar RÂNDUL — fișierele rămân, iar numărul se întoarce ca schiță —, dar între apăsare și
       * urmare stă tot un Da/Nu cu numărul scris în el (rezumatul vine de la `buletin.retrage`).
       * ⚠️ ASCUNSĂ, ca și validarea: nu se oferă pe butoanele nivelului 2. E fapta cea mai rară a
       * buletinului, iar un buton „retrage numărul" pus lângă „compune numărul", pe ecranul unde
       * omul lucrează la ciornă, ar fi o capcană. Se recunoaște însă din vorbe („retrage numărul",
       * „l-am publicat greșit"), deci chatul o poate face — doar nu o propune singur.
       */
      { id: 'retrage', nume: 'retrage numărul publicat', cere: 'nimic', confirma: true, ascunsa: true },
    ],
  },
  {
    id: 'program',
    nume: 'Programul de pe pagina 4',
    cuvinte: ['program', 'calendar', 'slujbe', 'slujba', 'validat', 'propus', 'pagina 4', 'pagina a patra'],
    actiuni: [
      { id: 'stare', nume: 'cum stă programul', cere: 'nimic', confirma: false },
      {
        id: 'schimba',
        nume: 'schimbă programul',
        cere: 'text',
        confirma: false,
        ascunsa: true,
        raspuns: 'Programul săptămânii se face în aplicația Program, nu de aici. Eu doar îl tipăresc pe pagina 4.',
      },
    ],
  },
]

export const HARTA_BULETIN: HartaAplicatie = {
  potrivitor: 'buletin.harta',
  despre: 'numărul de buletin care se pregătește: motto, articolul principal, cel mult doi secundari, programul de pe pagina 4',
  subiecte: CUPRINS,
}

export const subiectul = (id: string): SubiectHarta | undefined => CUPRINS.find((s) => s.id === id)
export const actiunea = (subiect: string, id: string): ActiuneHarta | undefined =>
  subiectul(subiect)?.actiuni.find((a) => a.id === id)

/** Acțiunile pe care le OFERIM pe butoane (cele ascunse se recunosc, dar nu se propun). */
export const oferite = (s: SubiectHarta): ActiuneHarta[] => s.actiuni.filter((a) => !a.ascunsa)

const E_ARTICOL = new Set(['principal', 's1', 's2'])
export const eArticol = (id: string): id is Articol => E_ARTICOL.has(id)

// ---------------------------------------------------------------------------
// Potrivitorul determinist
// ---------------------------------------------------------------------------

/**
 * Ce știe potrivitorul despre unde am rămas. Vine din schiță, socotit de `urmatoareaIntrebare` —
 * potrivitorul nu citește nimic singur.
 */
export interface StareHarta {
  /** Întrebarea pe care chatul tocmai a pus-o; `null` ori `gata` = niciuna pendinte. */
  intrebare: { subiect: string; articol: Articol; candidati?: string[] } | null
  /** Câți secundari are numărul acum (0-2). */
  secundari?: number
  /**
   * CE VALOARE AȘTEPT — pusă de chat după ce omul a apăsat un buton de nivel 2 („s1 titlu") și i s-a
   * cerut valoarea. Fără ea, răspunsul „DESPRE POST" venit după butonul acela n-ar avea niciun
   * subiect și ar cădea în „nu înțeleg".
   */
  asteapta?: { subiect: string; actiune: string; articol?: Articol } | null
}

export type Potrivire =
  /** Știu și subiectul, și acțiunea. `raspuns` = omul a răspuns la întrebarea pusă, nu a dat o instrucțiune. */
  | {
      nivel: 'sigur'
      subiect: string
      actiune: string
      valoare?: string
      articol?: Articol
      confirma: boolean
      raspuns?: boolean
      /**
       * Omul a NUMIT câmpul el însuși („titlu: Niciunul"), nu i s-a dedus din întrebarea pendinte.
       * Atunci valoarea se scrie cum a spus-o, chiar dacă e o vorbă care altminteri ar fi refuz.
       */
      numit?: boolean
    }
  /** Știu ce vrea, dar nu cu ce: „Ce titlu pui la secundarul 1?". */
  | { nivel: 'valoare'; subiect: string; actiune: string; articol?: Articol }
  /** Între două-trei lucruri, la nivelul 1 (subiect) sau la nivelul 2 (acțiune). */
  | {
      nivel: 'nesigur'
      ce: 'subiect' | 'actiune'
      subiect?: string
      intre: Array<{ id: string; nume: string }>
      /**
       * OMUL A VENIT DIN MENIU, apăsând (ori scriind) NUMAI numele subiectului. Atunci treapta a doua
       * nu e o nedumerire a chatului, ci pagina următoare a meniului — se citește ca meniu („Articolul
       * principal. Ce vrei să faci?") și poartă și drumul înapoi. Fără semnul ăsta, o apăsare de buton
       * primea „Nu știu ce să fac cu articolul principal", adică o eroare în loc de un cuprins.
       */
      dinMeniu?: boolean
    }
  /** „meniu", „?" — omul cere chiar cuprinsul. */
  | { nivel: 'meniu' }
  | { nivel: 'necunoscut' }

/** Fără diacritice, cu litere mici, cu aerul strâns — forma în care se compară tot de aici încolo. */
export function curatat(t: string): string {
  return (t ?? '')
    .normalize('NFD')
    // semnele diacritice desprinse de litere (ă, î, ș, ț — și virgula de sub ș/ț)
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[„”"«»]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** „da" în toate hainele lui. Se cere potrivire pe tot mesajul: „da" ≠ „dacă scot secundarul". */
const DA = /^(da|d[ae]a|dda|ok|okay|bine|corect|exact|sigur|asa|asa e|ramane|ramane asa|il folosim|o folosim|le folosim|da te rog|da folosim|adevarat|merge|yes|y)[\s.!,]*$/
/** „nu", cu tot ce-l urmează de obicei. */
const NU = /^(nu|nup|n-?am|nu stiu|nu are|nu e|nu este|nu se stie|nu vreau|nu multumesc|sari|treci mai departe|lasa|las-o|nimic|no|n)[\s.!,]*$/

/**
 * CUPRINSUL, CERUT ANUME — și DRUMUL ÎNAPOI. „înapoi" e aici, nu la acțiuni: de la butoanele
 * nivelului 2 omul trebuie să se poată întoarce la subiecte cu o vorbă, altfel treapta a doua e o
 * fundătură (user, 19.09.2026: a cerut meniul crezând că nu există). Formele se scriu FĂRĂ
 * diacritice și fără majuscule — `curatat` le scoate pe amândouă înainte de potrivire.
 */
const MENIU =
  /^(meniu|meniul|inapoi|inapoi la meniu|arata meniul|arata-?mi meniul|ce subiecte ai|\?+|ajutor|help|ce poti face|ce poti|ce pot face|ce pot|optiuni|lista|cuprins)[\s.!?]*$/

/**
 * FORMELE SCURTE EVIDENTE — comenzi întregi, fără subiect scris. Se cântăresc ÎNAINTEA întrebării
 * pendinte: „compune" spus la mijlocul chestionarului e o comandă, nu răspunsul la întrebare.
 */
const SCURTE: Array<{ tipar: RegExp; subiect: string; actiune: string }> = [
  { tipar: /^(hai,? )?(sa )?(compune|compunem|compui|fa|facem|genereaza|scoate)( |-)?(mi )?(buletinul|numarul|foaia|varianta|varianta zero|pdf-?ul)?[\s.!]*$/, subiect: 'numar', actiune: 'compune' },
  { tipar: /^(socoteala|socoteste|socotim|masoara|cat (mai )?(am )?loc|mai am loc|incape|incape\?|cate semne)[\s.!?]*$/, subiect: 'numar', actiune: 'socoteste' },
  { tipar: /^(unde am ramas|continua|continuam|mai departe|chestionar|chestionarul|buletin nou|numar nou|hai mai departe|reia)[\s.!?]*$/, subiect: 'numar', actiune: 'continua' },
  { tipar: /^((ia-?o |luam |o luam )?de la capat|reseteaza|sterge tot|golesc|goleste tot)[\s.!]*$/, subiect: 'numar', actiune: 'de_la_capat' },
  { tipar: /^(mai adaugam|mai adaug|inca un (text|articol|secundar)|adauga (un )?secundar)[\s.!?]*$/, subiect: 'numar', actiune: 'mai_adaugam' },
  { tipar: /^(valideaza|validam|validare|publica|publicam)([\s.!]|numarul|buletinul)*$/, subiect: 'numar', actiune: 'valideaza' },
  /*
   * RETRAGEREA, în toate hainele ei (20.09.2026). ⚠️ Scrise FĂRĂ diacritice: `curatat` le scoate
   * înainte de potrivire, deci „retrage numărul" ajunge aici „retrage numarul". CRATIMA însă RĂMÂNE
   * („retrage-l", „da-l"), deci pronumele lipit se scrie pe față în tipar.
   */
  {
    tipar:
      /^((hai,? )?(sa )?(o )?)?(retrage|retrag|retragem|retragere|ne-?public(a|am|are)|depublic(a|am|are)|anuleaza publicarea|anulam publicarea|scoate din arhiva|scoatem din arhiva|da(-?(l|mi))? inapoi la schita)(-?(l|o|le|il))?([\s.!]|numarul|buletinul|din arhiva|la schita)*$/,
    subiect: 'numar',
    actiune: 'retrage',
  },
  /*
   * „L-AM PUBLICAT GREȘIT" — retragerea spusă ca pățanie, nu ca poruncă (20.09.2026): e chiar fraza
   * din exemplul acțiunii `buletin.retrage`, și tot ea e prima care-i vine omului. Coada („dă-l
   * înapoi la schiță") e opțională: capul spune deja tot.
   * ⚠️ Nu se încurcă cu validarea: tiparul ei de mai sus cere „publica/publicam" ÎNTREG, iar aici
   * vorba e „publicat", altă formă — „publică numărul" nu ajunge niciodată până aici.
   */
  {
    tipar:
      /^((l|le|i)-?am|am|s-?a|ne-?am|a fost) ?publicat(-?(l|o|le))?( din)? gresit[\s.!,]*((si )?(hai,? )?(sa )?(da|dal|du|adu|pune|intoarce|trage)(-?(l|o|le|mi-?l))?)?([\s.!,]|inapoi|la|in|schita|ciorna|arhiva|numarul|buletinul|il)*$/,
    subiect: 'numar',
    actiune: 'retrage',
  },
]

/** „scoate secundarul 2", „șterge ultimul secundar". */
const STERGERE = /^(sterge|scoate|elimina|arunca|da jos)( |-)?(mi )?(ultimul |al doilea |primul )?(articol(ul)? )?(secundar(ul|ului)?|text(ul)? secundar)( ?(1|2|i|ii))?[\s.!]*$/

/** Cuvintele care numesc o acțiune, oriunde în frază. Ordinea contează: cele lungi, întâi. */
const CUVINTELE_ACTIUNILOR: Array<{ actiune: string; cuvinte: string[]; doarLa?: string[] }> = [
  { actiune: 'mentiune', cuvinte: ['mentiunea de deasupra sursei', 'mentiunea', 'mentiune', 'nota de deasupra', 'nota'] },
  /*
   * ⚠️ „SEMNATURA" E RANDUL DE SUB TITLU, NU AUTORUL (19.09.2026). Până în ziua asta cuvântul era
   * un sinonim al lui `autor` — scrisul alb din zona neagră. De când foaia are chiar un rând de
   * semnătură sub titlu, ăla e lucrul pe care omul îl numește așa („adăugăm ca semnătură sub
   * titluri"), deci vorba s-a mutat aici. Autorul rămâne cu numele lui.
   */
  { actiune: 'semnatura', cuvinte: ['semnatura de sub titlu', 'randul de sub titlu', 'semnatura', 'sub titlu', 'text de'] },
  { actiune: 'pomenire', cuvinte: ['ziua de pomenire', 'pomenirea', 'pomenire', 'praznuit', 'praznuire'] },
  { actiune: 'ani', cuvinte: ['anii vietii', 'anii', 'ani', 'a trait'] },
  { actiune: 'titlu', cuvinte: ['titlul', 'titlu'] },
  { actiune: 'sursa', cuvinte: ['sursa', 'de unde e luat', 'preluat din'] },
  { actiune: 'autor', cuvinte: ['autorul', 'autor', 'cine a spus', 'cine l-a spus'] },
  { actiune: 'text', cuvinte: ['textul', 'text', 'continutul', 'articolul in sine'] },
  { actiune: 'poza', cuvinte: ['poza', 'fotografia', 'imaginea', 'fotografie'] },
  { actiune: 'sterge', cuvinte: ['sterge', 'scoate', 'elimina'], doarLa: ['s1', 's2'] },
  { actiune: 'schimba', cuvinte: ['schimba', 'scrie alt', 'pune alt', 'inlocuieste'], doarLa: ['motto', 'program'] },
  { actiune: 'pastreaza', cuvinte: ['ramane asa', 'pastreaza', 'il pastram', 'ramane'], doarLa: ['motto'] },
  { actiune: 'compune', cuvinte: ['compune', 'genereaza', 'fa numarul', 'fa buletinul'], doarLa: ['numar'] },
  { actiune: 'socoteste', cuvinte: ['socoteala', 'socoteste', 'incape', 'cat loc', 'cate semne'], doarLa: ['numar'] },
  { actiune: 'continua', cuvinte: ['unde am ramas', 'continua', 'chestionar'], doarLa: ['numar'] },
  { actiune: 'de_la_capat', cuvinte: ['de la capat', 'reseteaza'], doarLa: ['numar'] },
  { actiune: 'mai_adaugam', cuvinte: ['mai adaugam', 'inca un text', 'inca un articol'], doarLa: ['numar'] },
  { actiune: 'valideaza', cuvinte: ['valideaza', 'publica'], doarLa: ['numar'] },
  /*
   * ⚠️ „RETRAGE" STĂ DUPĂ „PUBLICA", dar nu se încurcă cu el: potrivirea e pe cuvinte întregi, iar
   * „nepublica"/„depublica" sunt alte cuvinte decât „publica". Ce se putea încurca — „scoate", care
   * la secundari înseamnă ștergere — nu ajunge aici: `sterge` e `doarLa: ['s1','s2']`, iar vorba de
   * aici e întreagă, „scoate din arhiva".
   */
  {
    actiune: 'retrage',
    cuvinte: [
      'retrage', 'retragem', 'retragerea', 'retras', 'retrage-l', 'retrage-o',
      'nepublica', 'nepublicare', 'ne-publica', 'ne-publicare',
      'depublica', 'depublicare',
      'anuleaza publicarea', 'scoate din arhiva', 'da inapoi la schita', 'da-l inapoi la schita',
      // ⚠️ „publicat gresit" ≠ „publica": potrivirea e pe cuvinte întregi, deci nu fură validarea.
      'publicat gresit',
    ],
    doarLa: ['numar'],
  },
  { actiune: 'stare', cuvinte: ['cum sta', 'e validat', 'starea'], doarLa: ['program'] },
]

/** Cuvântul stă în text ca un cuvânt întreg, nu ca bucată din altul („ani" ≠ „companie"). */
function areCuvantul(text: string, cuvant: string): boolean {
  const c = curatat(cuvant)
  if (!c) return false
  const tipar = new RegExp(`(^|[^a-z0-9])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
  return tipar.test(text)
}

/** Subiectele numite în mesaj, în ordinea cuprinsului. */
function subiecteleDin(text: string): string[] {
  const gasite: string[] = []
  for (const s of CUPRINS) {
    if (s.cuvinte.some((c) => areCuvantul(text, c))) gasite.push(s.id)
  }
  /*
   * ⚠️ „secundar 1" îl aprinde și pe `numar` prin cuvântul „numar"? Nu — dar „articolul secundar 1"
   * conține și „secundar 1"; iar `principal` și `s1` nu se pot aprinde amândouă din aceleași vorbe.
   * Ce se poate întâmpla e ca „compune numărul" să aprindă `numar` de două ori: lista e unică.
   */
  return [...new Set(gasite)]
}

/**
 * ACȚIUNEA MAI ANUME O ÎNGHITE PE CEA LARGĂ. Vorbele lungi ale uneia pot conține cuvântul scurt al
 * alteia: „rândul de sub TITLU" și „TEXT de: …" aprind și `titlu`, și `text`, deși omul a numit
 * limpede semnătura (19.09.2026). Fără regula asta potrivirea ar vedea două acțiuni și ar întreba
 * „care din ele?" la fiecare semnătură — adică exact drumul fără AI s-ar rupe.
 */
const INGHITE: Readonly<Record<string, readonly string[]>> = {
  semnatura: ['titlu', 'text'],
}

/** Acțiunile numite în mesaj, îngustate la cele care au rost pentru subiectul ales (dacă e unul). */
function actiunileDin(text: string, subiect?: string): string[] {
  const gasite: string[] = []
  for (const a of CUVINTELE_ACTIUNILOR) {
    // o acțiune legată de un subiect anume nu se caută la alt subiect („șterge" n-are ce face la motto)
    if (a.doarLa && subiect && !a.doarLa.includes(subiect)) continue
    if (a.cuvinte.some((c) => areCuvantul(text, c))) gasite.push(a.actiune)
  }
  const inghitite = new Set(gasite.flatMap((id) => INGHITE[id] ?? []))
  const unice = [...new Set(gasite)].filter((id) => !inghitite.has(id))
  if (!subiect) return unice
  return unice.filter((id) => Boolean(actiunea(subiect, id)))
}

/** Valoarea scrisă în frază: între ghilimele, ori după „în"/„:"/„=". `null` = n-a spus-o. */
function valoareaDin(mesaj: string): string | null {
  const ghilimele = /[„"«]([^„”"«»]{1,4000})[”"»]/.exec(mesaj)
  if (ghilimele) return ghilimele[1]!.trim() || null
  const dupa = /(?:^|\s)(?:in|în|la|cu|=)\s+(.{2,4000})$/i.exec(mesaj.trim())
  if (dupa) {
    const v = dupa[1]!.trim()
    // „la principal" / „la s1" nu e o valoare, e locul
    if (!curatat(v) || subiecteleDin(curatat(v)).length) return null
    return v
  }
  return null
}

/** Numele subiectelor, pentru butoane. */
const caOptiuni = (ids: string[]): Array<{ id: string; nume: string }> =>
  ids.map((id) => ({ id, nume: subiectul(id)?.nume ?? id }))

/**
 * Subiectul unui articol, când omul n-a spus care: cel la care e chestionarul acum.
 * `null` când nu e nicio întrebare pendinte — atunci chiar trebuie întrebat.
 */
const articolulDeAcum = (stare: StareHarta): Articol | null =>
  stare.intrebare && stare.intrebare.subiect !== 'gata' ? stare.intrebare.articol : null

/** Acțiunile unui subiect, ca opțiuni de buton. */
export const actiunileCaOptiuni = (subiect: string): Array<{ id: string; nume: string }> => {
  const s = subiectul(subiect)
  return s ? oferite(s).map((a) => ({ id: a.id, nume: a.nume })) : []
}

/**
 * POTRIVIREA, FĂRĂ MODEL. Ordinea pașilor e tot rostul funcției, deci e scrisă pe față:
 *
 *   1. „meniu" / „?"                          — omul cere chiar cuprinsul
 *   2. sintaxa strictă `subiect[ articol] acțiune: valoare`
 *   3. comenzile scurte întregi („compune", „de la capăt", „scoate secundarul 2")
 *   4. valoarea așteptată după un buton de nivel 2
 *   5. „da" / „nu" / o cifră — răspuns scurt la întrebarea pendinte
 *   6. cuvinte-cheie: UN subiect și O acțiune → instrucțiune liberă (cu confirmare)
 *   7. orice altceva, când e o întrebare pendinte → chiar valoarea ei (fără confirmare)
 *   8. necunoscut
 *
 * ⚠️ De ce 3 înaintea lui 5, și 6 înaintea lui 7: un om care scrie „schimbă titlul secundarului 1 în
 * DESPRE POST" în timp ce chatul îl întreabă textul principal NU răspunde la întrebare — dă altă
 * poruncă. Invers, „Sfântul Vasile cel Mare" scris la întrebarea autorului e doar răspunsul, oricâte
 * cuvinte ar conține.
 */
export function potriveste(mesaj: string, stare: StareHarta): Potrivire {
  const brut = (mesaj ?? '').trim()
  const t = curatat(brut)
  if (!t) return { nivel: 'necunoscut' }

  // 1 -------------------------------------------------------------- meniul
  if (MENIU.test(t)) return { nivel: 'meniu' }

  // 2 -------------------------------------------- sintaxa strictă, cu două puncte
  const strict = sintaxaStricta(brut, stare)
  if (strict) return strict

  // 3 -------------------------------------------------------- comenzile scurte
  for (const s of SCURTE) {
    if (!s.tipar.test(t)) continue
    return sigur(s.subiect, s.actiune, { stare })
  }
  if (STERGERE.test(t)) {
    const care = /\b2\b|al doilea|ii\b/.test(t) ? 's2' : /\b1\b|primul/.test(t) ? 's1' : ultimulSecundar(stare)
    return sigur(care, 'sterge', { stare })
  }

  // 4 ------------------------------------------ valoarea cerută după un buton
  const a = stare.asteapta
  if (a && actiunea(a.subiect, a.actiune)) {
    if (NU.test(t)) return { nivel: 'necunoscut' }
    return sigur(a.subiect, a.actiune, { stare, valoare: brut, articol: a.articol })
  }

  // 5 ------------------------------- „da" / „nu" / cifra, la întrebarea pendinte
  const pendinte = stare.intrebare && stare.intrebare.subiect !== 'gata' ? stare.intrebare : null
  if (pendinte) {
    const subiectPendinte = subiectulIntrebarii(pendinte.subiect, pendinte.articol)
    const actiunePendinte = actiuneaIntrebarii(pendinte.subiect)
    /*
     * ⚠️ „NICIUNUL" E UN NU, NU UN TITLU (19.09.2026, 11:03 — a ajuns așa în PDF). La întrebările la
     * care chatul PROPUNE ceva (titlu, autor, ani, pomenire, sursă), vorbele de refuz se prind AICI,
     * determinist: altfel cad la pasul 7, unde orice text e chiar valoarea întrebării. Lista e în
     * `refuz.ts`, fiindcă aceeași vorbă mai poate veni și pe drumul modelului.
     */
    const refuz = NU.test(t) || (CAMPURI_CU_VARIANTE.has(pendinte.subiect) && eRefuz(t))
    if (DA.test(t) || refuz) {
      return {
        nivel: 'sigur',
        subiect: subiectPendinte,
        actiune: actiunePendinte,
        valoare: refuz ? 'nu' : 'da',
        ...(eArticol(subiectPendinte) ? { articol: pendinte.articol } : {}),
        confirma: false,
        raspuns: true,
      }
    }
    // „2" la întrebarea titlurilor: al doilea din lista propusă (se traduce în `scrieRaspuns`)
    if (pendinte.subiect === 'titlu' && /^[1-9][.)]?$/.test(t)) {
      return {
        nivel: 'sigur',
        subiect: subiectPendinte,
        actiune: 'titlu',
        valoare: t.replace(/[.)]/g, ''),
        articol: pendinte.articol,
        confirma: false,
        raspuns: true,
      }
    }
  }

  /*
   * ⚠️ UN TEXT LUNG NU SE CAUTĂ PE CUVINTE. Un articol de buletin poartă în el „titlu", „text",
   * „program", „autor" și încă zece cuvinte ale hărții: potrivirea pe ele ar trimite un motto dictat
   * din trei rânduri drept titlu al secundarului 2, fără nicio eroare nicăieri. Peste pragul ăsta
   * mesajul e o VALOARE, nu o instrucțiune — aceeași măsură ca a unui câmp scurt al schiței (400).
   */
  if (t.length > PRAG_VALOARE) {
    return pendinte ? chiarValoarea(pendinte, brut) : { nivel: 'necunoscut' }
  }

  // 6 -------------------------------------------------- cuvinte-cheie: unic + unic
  const subiecte = subiecteleDin(t)
  if (subiecte.length === 1) {
    const s = subiecte[0]!
    const actiuni = actiunileDin(t, s)
    if (actiuni.length === 1) return sigur(s, actiuni[0]!, { stare, valoare: valoareaDin(brut) ?? undefined })
    if (actiuni.length === 0 && oferite(subiectul(s)!).length === 1) {
      return sigur(s, oferite(subiectul(s)!)[0]!.id, { stare })
    }
    /*
     * ⚠️ MESAJUL CARE E DOAR NUMELE UNUI SUBIECT („s1", „motto") e o APĂSARE DE BUTON, nu un
     * răspuns — și trebuie să deschidă nivelul 2 chiar dacă e o întrebare pendinte. Fără rândul
     * ăsta, cine apasă „Articolul secundar 1" în meniu, la mijlocul chestionarului, și-ar fi scris
     * „s1" ca răspuns la întrebarea de atunci.
     */
    const doarNumele = subiectul(s)!.cuvinte.some((c) => curatat(c) === t)
    /*
     * ⚠️ Cu o întrebare pendinte nu se mai spune „nu știu ce să fac cu motto-ul": mesajul e mai
     * degrabă chiar răspunsul la ea. Nesigurul rămâne pentru când nu se aștepta nimic.
     */
    if (!pendinte || doarNumele) {
      // ⚠️ `dinMeniu` numai la apăsarea de buton (mesajul E numele subiectului): atunci treapta a
      // doua e meniul mai departe, nu o nedumerire — vezi `Potrivire`.
      const semn = doarNumele ? { dinMeniu: true } : {}
      if (actiuni.length === 0) {
        return { nivel: 'nesigur', ce: 'actiune', subiect: s, intre: actiunileCaOptiuni(s), ...semn }
      }
      return {
        nivel: 'nesigur',
        ce: 'actiune',
        subiect: s,
        intre: actiuni.map((id) => ({ id, nume: actiunea(s, id)?.nume ?? id })),
        ...semn,
      }
    }
  } else if (subiecte.length > 1 && !pendinte) {
    return { nivel: 'nesigur', ce: 'subiect', intre: caOptiuni(subiecte) }
  } else if (subiecte.length === 0 && !pendinte) {
    // acțiune numită fără subiect: dacă e a unui articol, se întreabă la care
    const actiuni = actiunileDin(t)
    const aleArticolului = actiuni.filter((id) => Boolean(actiunea('principal', id)))
    if (aleArticolului.length === 1) {
      return { nivel: 'nesigur', ce: 'subiect', intre: caOptiuni(['principal', 's1', 's2']) }
    }
  }

  // 7 --------------------------------- orice altceva, la o întrebare pendinte: valoarea
  if (pendinte) return chiarValoarea(pendinte, brut)

  // 8 -------------------------------------------------------------- necunoscut
  return { nivel: 'necunoscut' }
}

/** Cât are un mesaj ca să mai fie cântărit ca instrucțiune. Peste atât e o valoare, și atât. */
const PRAG_VALOARE = 400

/** Mesajul e chiar răspunsul la întrebarea pusă: subiectul și acțiunea vin de la ea, el dă valoarea. */
function chiarValoarea(
  pendinte: { subiect: string; articol: Articol },
  brut: string,
): Potrivire {
  const subiect = subiectulIntrebarii(pendinte.subiect, pendinte.articol)
  return {
    nivel: 'sigur',
    subiect,
    actiune: actiuneaIntrebarii(pendinte.subiect),
    valoare: brut,
    ...(eArticol(subiect) ? { articol: pendinte.articol } : {}),
    confirma: false,
    raspuns: true,
  }
}

/** Ultimul secundar deschis; fără niciunul, tot `s1` (acolo cade ștergerea, cu mesajul ei). */
const ultimulSecundar = (stare: StareHarta): string => ((stare.secundari ?? 0) >= 2 ? 's2' : 's1')

/** Cărui subiect din cuprins îi aparține întrebarea pendinte. */
function subiectulIntrebarii(subiect: string, articol: Articol): string {
  if (subiect === 'motto') return 'motto'
  if (subiect === 'mai_adaugam') return 'numar'
  return articol
}

/** Ce acțiune a hărții e întrebarea pendinte. */
function actiuneaIntrebarii(subiect: string): string {
  if (subiect === 'motto') return 'schimba'
  if (subiect === 'mai_adaugam') return 'mai_adaugam'
  return subiect
}

/** O potrivire sigură, cu confirmarea luată din tabel și valoarea cerută cântărită. */
function sigur(
  subiect: string,
  actiuneId: string,
  o: { stare: StareHarta; valoare?: string; articol?: Articol; numit?: boolean },
): Potrivire {
  const a = actiunea(subiect, actiuneId)
  if (!a) return { nivel: 'necunoscut' }
  const articol = o.articol ?? (eArticol(subiect) ? (subiect as Articol) : undefined)
  const valoare = (o.valoare ?? '').trim()
  if (a.cere === 'text' && !valoare && !a.raspuns) {
    return { nivel: 'valoare', subiect, actiune: actiuneId, ...(articol ? { articol } : {}) }
  }
  return {
    nivel: 'sigur',
    subiect,
    actiune: actiuneId,
    ...(valoare ? { valoare } : {}),
    ...(articol ? { articol } : {}),
    ...(o.numit ? { numit: true } : {}),
    confirma: a.confirma,
  }
}

/**
 * SINTAXA STRICTĂ: `subiect[ articol] acțiune: valoare`. Partea din stânga celor două puncte e
 * scurtă și făcută din cuvintele hărții; altfel nu e sintaxă, e o frază cu două puncte în ea.
 */
function sintaxaStricta(brut: string, stare: StareHarta): Potrivire | null {
  const i = brut.indexOf(':')
  if (i < 0) return null
  const stangaBruta = brut.slice(0, i)
  const dreapta = brut.slice(i + 1).trim()
  const stanga = curatat(stangaBruta)
  if (!stanga || stanga.length > 40) return null

  const subiecte = subiecteleDin(stanga)
  const actiuniLibere = actiunileDin(stanga)
  if (!subiecte.length && !actiuniLibere.length) return null
  // partea din stânga trebuie să fie NUMAI cuvintele hărții, nu o frază care le conține
  if (stanga.split(' ').length > 5) return null

  if (subiecte.length > 1) return { nivel: 'nesigur', ce: 'subiect', intre: caOptiuni(subiecte) }

  const subiect = subiecte[0] ?? subiectulPentruActiune(actiuniLibere, stare)
  if (!subiect) {
    return { nivel: 'nesigur', ce: 'subiect', intre: caOptiuni(['principal', 's1', 's2']) }
  }
  const actiuni = actiunileDin(stanga, subiect)
  const actiuneId = actiuni.length === 1 ? actiuni[0]! : actiuni.length === 0 ? implicitaLui(subiect) : null
  if (!actiuneId) {
    return {
      nivel: 'nesigur',
      ce: 'actiune',
      subiect,
      intre: actiuni.map((id) => ({ id, nume: actiunea(subiect, id)?.nume ?? id })),
    }
  }
  // ⚠️ `numit`: omul a scris chiar numele câmpului, deci valoarea e a lui, oricare ar fi ea
  return sigur(subiect, actiuneId, { stare, valoare: dreapta, numit: true })
}

/** La ce articol se scrie o acțiune numită fără subiect: cel al întrebării de acum. */
function subiectulPentruActiune(actiuni: string[], stare: StareHarta): string | null {
  if (actiuni.length !== 1) return null
  const id = actiuni[0]!
  // o acțiune care e a unui singur subiect se leagă singură (compune, socoteste, stare…)
  const ale = CUPRINS.filter((s) => s.actiuni.some((a) => a.id === id))
  if (ale.length === 1) return ale[0]!.id
  return articolulDeAcum(stare)
}

/** Ce se înțelege din `motto: X` — acțiunea firească a subiectului, când nu s-a numit niciuna. */
function implicitaLui(subiect: string): string | null {
  if (subiect === 'motto') return 'schimba'
  if (eArticol(subiect)) return 'text'
  return null
}

// ---------------------------------------------------------------------------
// Din alegere în apel adevărat
// ---------------------------------------------------------------------------

/** Ce are de făcut chatul după ce s-a hotărât subiectul și acțiunea. */
export interface Fapta {
  subiect: string
  actiune: string
  /** Acțiunea de chemat (`buletin.raspunde`); lipsă = nu se cheamă nimic, se spune doar `raspuns`. */
  apel: { actiune: string; argumente: Record<string, unknown> } | null
  /** Interpretarea scrisă negru pe alb, pentru propunerea Da/Nu. */
  rezumat: string
  confirma: boolean
  /** Ce se răspunde în loc de orice faptă („se face în Program, nu de aici"). */
  raspuns?: string
}

/** Numele articolului, la genitiv, pentru interpretarea scrisă. */
const numeleArticolului = (a: Articol | undefined): string => (a ? LA_GENITIV[a] : 'articolului de acum')

const scurtat = (v: string, cat = 70): string => (v.length <= cat ? v : `${v.slice(0, cat).trim()}…`)

/**
 * Ce se spune omului când s-a sărit peste un câmp. La TITLU se adaugă drumul înapoi: el tocmai a
 * refuzat niște propuneri, deci trebuie să afle pe loc că îl poate scrie singur oricând — altfel
 * „am sărit peste titlu" sună a ușă închisă.
 */
const amSarit = (actiune: string): string =>
  actiune === 'titlu'
    ? 'Niciunul dintre titlurile propuse — trecem mai departe. Scrie tu titlul când vrei: „titlu: …".'
    : 'Nu, trecem mai departe.'

/**
 * TRADUCEREA — din `{subiect, acțiune, valoare}` în apelul acțiunii EXISTENTE a buletinului.
 *
 * ⚠️ Aici e tot ce leagă harta de codul de până acum, și nicăieri altundeva: `buletin.raspunde`,
 * `buletin.compune`, `buletin.socoteala`, `buletin.chestionar` rămân neatinse, cu subiectele lor
 * (`SUBIECTE` din `schita.ts`). Harta nu e un al doilea fel de a scrie în schiță; e doar drumul
 * până la ușă.
 *
 * ⚠️ `raspuns: true` (omul a răspuns la întrebarea pusă) schimbă două lucruri: „da"/„nu" devin
 * `pastreaza`/`sari`, iar `articol` NU se mai trimite — așa `buletin.raspunde` vede un răspuns la
 * întrebarea de acum, nu o instrucțiune punctuală (vezi `eRaspunsLaIntrebare` din `actiuni.ts`).
 */
export function traduFapta(alegere: {
  subiect: string
  actiune: string
  valoare?: string
  articol?: Articol
  raspuns?: boolean
  /** Omul a numit câmpul el însuși („titlu: Niciunul") — atunci valoarea nu se mai citește ca refuz. */
  numit?: boolean
}): Fapta | null {
  const a = actiunea(alegere.subiect, alegere.actiune)
  if (!a) return null
  const valoare = (alegere.valoare ?? '').trim()
  const articol = alegere.articol ?? (eArticol(alegere.subiect) ? (alegere.subiect as Articol) : undefined)
  const gata = (apel: Fapta['apel'], rezumat: string, confirma = a.confirma): Fapta => ({
    subiect: alegere.subiect,
    actiune: alegere.actiune,
    apel,
    rezumat,
    confirma,
    ...(a.raspuns ? { raspuns: a.raspuns } : {}),
  })

  /*
   * ⚠️ ACȚIUNILE CARE NU SE FAC DE AICI (poza, validarea, schimbarea programului) au scris în tabel
   * CE SE RĂSPUNDE, și atât: nu se cheamă nimic și nu se propune nimic. Un „nu se poate" cu locul
   * unde se poate e un răspuns bun; o unealtă chemată degeaba nu e.
   */
  if (a.raspuns) return gata(null, a.raspuns, false)

  // ---------------------------------------------------- răspuns la întrebarea pusă
  if (alegere.raspuns) {
    const cuValoare = (subiect: string, v?: string) => ({
      actiune: 'buletin.raspunde',
      argumente: { subiect, ...(v ? { valoare: v } : {}) } as Record<string, unknown>,
    })
    if (/^da$/i.test(valoare)) return gata(cuValoare('pastreaza'), 'Da, rămâne așa.', false)
    if (/^nu$/i.test(valoare)) return gata(cuValoare('sari'), amSarit(alegere.actiune), false)
    /*
     * ⚠️ AL DOILEA PĂZITOR, pentru drumul MODELULUI: nivelul 2 întoarce `{actiune, valoare}` cu ce a
     * scris omul, deci „Niciunul" ar ajunge aici ca valoare a titlului. O vorbă de refuz, singură,
     * nu poate deveni conținutul unui câmp cu variante propuse.
     */
    if (CAMPURI_CU_VARIANTE.has(alegere.actiune) && eRefuz(valoare)) {
      return gata(cuValoare('sari'), amSarit(alegere.actiune), false)
    }
    const camp = campulLui(alegere.subiect, alegere.actiune)
    if (!camp) return null
    return gata(cuValoare(camp, valoare), `${numeleCampului(camp, articol)} → „${scurtat(valoare)}"`, false)
  }

  // ---------------------------------------------------------------- numărul întreg
  if (alegere.subiect === 'numar') {
    if (alegere.actiune === 'compune') return gata({ actiune: 'buletin.compune', argumente: {} }, 'Compun numărul din schiță.')
    if (alegere.actiune === 'socoteste') return gata({ actiune: 'buletin.socoteala', argumente: {} }, 'Socotesc dacă încape.', false)
    if (alegere.actiune === 'continua') return gata({ actiune: 'buletin.chestionar', argumente: {} }, 'Reiau chestionarul de unde am rămas.', false)
    if (alegere.actiune === 'mai_adaugam') {
      const da = !valoare || /^(da|mai|inca)/i.test(curatat(valoare))
      return gata(
        { actiune: 'buletin.raspunde', argumente: { subiect: 'mai_adaugam', valoare: da ? 'da' : 'nu' } },
        da ? 'Deschid încă un articol secundar.' : 'Nu mai adăugăm alte texte.',
        false,
      )
    }
    if (alegere.actiune === 'de_la_capat') {
      return gata(
        { actiune: 'buletin.raspunde', argumente: { subiect: 'de_la_capat' } },
        'Iau schița DE LA CAPĂT: se șterge tot ce s-a strâns (motto-ul numărului trecut rămâne).',
        true,
      )
    }
    /*
     * ⚠️ FĂRĂ ARGUMENTE, dinadins: ținta retragerii e numărul CURENT din arhivă, pe care îl află
     * serverul — nu cel de pe ecranul `/nou`. Modelul n-are ce ghici aici, iar rezumatul adevărat,
     * cu numărul în el, vine de la previzualizarea acțiunii (`buletin.retrage`, `rezuma`).
     */
    if (alegere.actiune === 'retrage') {
      return gata(
        { actiune: 'buletin.retrage', argumente: {} },
        'Retrag din arhivă numărul publicat și îl aduc înapoi ca schiță pe „Numărul următor", cu tot ' +
        'ce are. Fișierele nu se pierd.',
        true,
      )
    }
    return null
  }

  // ---------------------------------------------------------------- programul
  if (alegere.subiect === 'program') {
    if (alegere.actiune === 'stare') {
      return gata({ actiune: 'buletin.socoteala', argumente: {} }, 'Mă uit cum stă programul săptămânii.', false)
    }
    return null
  }

  // ---------------------------------------------------------------- motto-ul
  if (alegere.subiect === 'motto') {
    if (alegere.actiune === 'pastreaza') {
      return gata({ actiune: 'buletin.raspunde', argumente: { subiect: 'pastreaza' } }, 'Motto-ul rămâne cel de acum.', false)
    }
    if (!valoare) return null
    const camp = alegere.actiune === 'autor' ? 'moto_autor' : 'motto'
    return gata(
      { actiune: 'buletin.raspunde', argumente: { subiect: camp, valoare } },
      `${camp === 'motto' ? 'Motto-ul numărului' : 'Cine a spus motto-ul'} → „${scurtat(valoare)}"`,
    )
  }

  // ---------------------------------------------------------------- articolele
  if (!eArticol(alegere.subiect)) return null
  /*
   * ⚠️ Aceeași vorbă de refuz, venită de la model FĂRĂ semnul că omul ar fi numit câmpul: modelul
   * pune `{subiect: 's1', actiune: 'titlu', valoare: 'Niciunul'}` și fără păzitorul ăsta ea s-ar
   * scrie ca instrucțiune punctuală. Cu `numit` (sintaxa `titlu: Niciunul`) rămâne valoare — omul a
   * spus-o anume.
   */
  if (!alegere.numit && CAMPURI_CU_VARIANTE.has(alegere.actiune) && eRefuz(valoare)) {
    return gata({ actiune: 'buletin.raspunde', argumente: { subiect: 'sari' } }, amSarit(alegere.actiune), false)
  }
  if (alegere.actiune === 'sterge') {
    return gata(
      { actiune: 'buletin.raspunde', argumente: { subiect: 'sterge_secundar' } },
      `Șterg ultimul articol secundar (${LA_GENITIV[alegere.subiect as Articol]}).`,
    )
  }
  const camp = campulLui(alegere.subiect, alegere.actiune)
  if (!camp || !valoare) return null
  return gata(
    { actiune: 'buletin.raspunde', argumente: { subiect: camp, valoare, articol } },
    `${numeleCampului(camp, articol)} → „${scurtat(valoare)}"`,
  )
}

/** Din acțiunea hărții în subiectul lui `buletin.raspunde` (lista închisă din `schita.ts`). */
function campulLui(subiect: string, actiune: string): string | null {
  if (subiect === 'motto') return actiune === 'autor' ? 'moto_autor' : 'motto'
  if (subiect === 'numar') return actiune === 'mai_adaugam' ? 'mai_adaugam' : null
  if (actiune === 'mentiune') return 'nota'
  return ['text', 'autor', 'ani', 'pomenire', 'titlu', 'semnatura', 'sursa', 'poza'].includes(actiune) ? actiune : null
}

/** Cum se citește câmpul în interpretare: „Titlul secundarului 1". */
function numeleCampului(camp: string, articol?: Articol): string {
  if (camp === 'motto') return 'Motto-ul numărului'
  if (camp === 'moto_autor') return 'Cine a spus motto-ul'
  const cum: Record<string, string> = {
    text: 'Textul',
    autor: 'Autorul',
    ani: 'Anii vieții',
    pomenire: 'Ziua de pomenire',
    titlu: 'Titlul',
    semnatura: 'Semnătura de sub titlul',
    sursa: 'Sursa',
    nota: 'Mențiunea de deasupra sursei',
    poza: 'Poza',
    mai_adaugam: 'Mai adăugăm',
  }
  return `${cum[camp] ?? camp} ${numeleArticolului(articol)}`
}
