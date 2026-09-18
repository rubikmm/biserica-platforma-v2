/**
 * RUBRICA „CHAT AI" DIN SETĂRILE APLICAȚIEI.
 *
 * Cerută de user pe 18.09.2026, 12:53: „să activăm din Administrare / Super-Admin aplicațiile care
 * primesc chat — și din Setări aplicație pe un tab Chat AI să avem câmpurile specifice aplicației".
 * Deci două ecrane, cu două treburi deosebite:
 *
 *   - **Administrare → Module** (super-admin): modulul pornit, ÎN CARE aplicații, cine-l vede, cu ce
 *     model. Adică banii și deschiderea — lucruri ale platformei.
 *   - **Setări → Chat AI** (adminul APLICAȚIEI, aici): ce știe și ce poate face bula ei. Adică treaba
 *     aplicației, scrisă de cel care o ține.
 *
 * ⚠️ Scrisă o singură dată, ca abonarea și ca Setările: aplicația nu-și face rubrica ei de chat, o
 * cere de aici. Altfel a doua aplicație ar copia-o, și de-acolo încolo ar fi două.
 *
 * ⚠️ Uneltele se arată CU BIFĂ, nu scrise de mână, și se cer de la `chat-worker` — el știe ce
 * publică fiecare aplicație și ce vede bula asta. O listă scrisă de mână se strică în tăcere: un
 * nume greșit nu supără pe nimeni, doar că unealta nu există.
 */
import type { Efect } from '@xc/actiuni'
import { esc } from '@xc/ui'
import type { ConfigAplicatie } from './comutator.js'

/** O unealtă așa cum o știe chat-worker: numele canonic, la ce e bună și dacă schimbă ceva. */
export interface UnealtaDeBifat {
  nume: string
  descriere: string
  /**
   * ⚠️ Tipul vine din `@xc/actiuni`, nu scris de mână: lista efectelor crește (`ciorna`, 18.09.2026),
   * iar rubrica trebuie doar să știe care dintre ele CERE CONFIRMARE — și aceea e numai `scrie`.
   */
  efect: Efect
  /** Aplicația care o publică — la Program, bula vede și calendarul, și tipicul. */
  aplicatie: string
}

export interface DateleRubricii {
  prefix: string
  csrf: string
  /** Codul aplicației în care stăm: `buletin`, `program`… */
  aplicatie: string
  /** Ce scrie acum în `modul:chat:<aplicatie>`. */
  cfg: ConfigAplicatie
  /** Modulul pornit pe platformă (din Module). */
  activ: boolean
  /** Aplicația asta e bifată în Module. */
  pornit: boolean
  /** Ce poate chema bula de aici; `null` = chat-worker n-a răspuns, deci nu știm. */
  unelte: UnealtaDeBifat[] | null
}

const CAT_SCRIE = 'schimbă date — cere confirmarea omului';

/**
 * Bucata de pagină. Se lipește în Setări prin punctul de prindere `rubrici`, deci poartă clasele
 * ei (`set-grup`, `set-spune`) și butoanele carcasei — nimic nou de stilat.
 */
export function rubricaChat(o: DateleRubricii): string {
  const stare = !o.activ
    ? ['', 'Modulul de chat e oprit pe toată platforma. Se pornește din <strong>Administrare → Module</strong>.']
    : !o.pornit
      ? ['', 'Chatul nu e aprins la această aplicație. Se bifează din <strong>Administrare → Module</strong>. Ce scrii aici se păstrează și se folosește din clipa aprinderii.']
      : ['da', 'Bula e aprinsă aici.']

  /*
   * ⚠️ Stilul vine ÎN bucată, nu din `stil.ts`-ul aplicației. Rubrica asta se lipește în Setările
   * oricărei aplicații, iar ca să se vadă la fel peste tot ar fi trebuit adăugat un import în toate
   * cele paisprezece — și una uitată ar fi arătat strâmb, fără ca nimeni să afle. Se plătește
   * numai pe pagina Setărilor, numai adminului: nici cache, nici pagină publică.
   */
  return `<section class="set-grup" id="chat-ai">
  <style>${STIL_SETARI_CHAT}</style>
  <span class="set-treapta">Adminul aplicației</span>
  <h2>Chat AI</h2>
  <p class="set-spune">Ce știe și ce poate face bula acestei aplicații. Îndrumările intră în
  instrucțiunile modelului la fiecare mesaj, iar uneltele bifate sunt tot ce are voie să cheme —
  pentru orice altceva răspunde că nu poate face asta aici.</p>
  <p class="set-stare"><span class="set-bulina ${stare[0]}"></span> <span>${stare[1]}</span></p>

  <form method="post" action="${esc(o.prefix)}/chat/setari">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}">

    <h3>Îndrumări</h3>
    <p class="set-spune">Obiceiurile locului, tonul, ce să nu facă — în cuvintele tale. Scurt și
    concret merge cel mai bine, și se plătește la fiecare mesaj, deci nu ține aici ce poate afla
    singur cu o unealtă.</p>
    <textarea name="indrumari" class="camp chat-indrumari" rows="8" maxlength="8000"
      placeholder="Ex.: Motto-ul se scrie fără ghilimele. Nu inventa autori: dacă nu-l știi, întreabă.">${esc(o.cfg.indrumari)}</textarea>

    <h3>Ce poate face</h3>
    ${uneltele(o)}

    <p><button class="btn" type="submit">Salvează</button></p>
  </form>
</section>`
}

function uneltele(o: DateleRubricii): string {
  if (o.unelte === null) {
    // Nu știm ce unelte există: nu arătăm bife care ar minți, și PĂSTRĂM alegerea de acum, ca
    // salvarea îndrumărilor să n-o șteargă fără să știe nimeni.
    return `<p class="set-spune">Nu am putut afla acum ce unelte are bula (creierul chatului n-a
    răspuns). Îndrumările se pot salva; alegerea de acum rămâne neatinsă.</p>
    ${o.cfg.unelte.map((u) => `<input type="hidden" name="u" value="${esc(u)}">`).join('\n    ')}`
  }
  if (!o.unelte.length) {
    return `<p class="set-spune">Aplicația nu publică nicio unealtă, deci bula poate doar să stea de
    vorbă: răspunde din îndrumări și spune limpede când nu știe.</p>`
  }
  // Toate bifate când lista e goală: „nimic ales" a însemnat dintotdeauna „toate" — dacă am arăta
  // căsuțe goale, ecranul ar minți despre ce poate face bula acum.
  const bifat = (nume: string) => (o.cfg.unelte.length === 0 ? true : o.cfg.unelte.includes(nume))
  const peAplicatii = new Map<string, UnealtaDeBifat[]>()
  for (const u of o.unelte) peAplicatii.set(u.aplicatie, [...(peAplicatii.get(u.aplicatie) ?? []), u])

  const grup = (numeApp: string, lista: UnealtaDeBifat[]) => `
    ${peAplicatii.size > 1 ? `<h4 class="chat-grup">${esc(numeApp)}</h4>` : ''}
    ${lista
      .map(
        (u) => `<label class="bifa chat-unealta">
      <input type="checkbox" name="u" value="${esc(u.nume)}" ${bifat(u.nume) ? 'checked' : ''}>
      <span><code>${esc(u.nume)}</code>${u.efect === 'scrie' ? ` <em class="chat-efect">${CAT_SCRIE}</em>` : ''}
      <small>${esc(u.descriere)}</small></span>
    </label>`,
      )
      .join('\n    ')}`

  return `<p class="set-spune">Bifează puțin și limpede: un model mic nimerește mai bine între trei
  unelte decât între paisprezece. Nimic bifat = are voie la toate.</p>
  <div class="chat-unelte">${[...peAplicatii].map(([n, l]) => grup(n, l)).join('\n')}</div>`
}

/** Stilul rubricii — puțin, fiindcă restul vine din Setări și din carcasă. */
export const STIL_SETARI_CHAT = `
.chat-indrumari { width:100%; font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; resize:vertical }
.chat-unelte { display:flex; flex-direction:column; gap:10px; margin:0 0 14px }
.chat-grup { margin:8px 0 2px; font:600 12px/1 ui-sans-serif,system-ui; letter-spacing:.06em;
             text-transform:uppercase; color:var(--faint) }
.chat-unealta code { font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace }
.chat-unealta small { display:block; color:var(--faint); font:13px/1.45 ui-sans-serif,system-ui }
.chat-efect { font:600 11px/1 ui-sans-serif,system-ui; color:var(--rosu); font-style:normal;
              text-transform:uppercase; letter-spacing:.04em; margin-left:6px }
`
