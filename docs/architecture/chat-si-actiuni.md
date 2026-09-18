# Acțiunile interne și modulul de Chat

> Stare: propunere de arhitectură, 11.09.2026. Cerere user: *„un modul de Chat (AI) care să poată fi
> expus în oricare aplicație și cu ajutorul căruia să se poată acționa asupra aplicației prin
> mecanisme interne api — expuse tot intern. Nu vreau să se confunde cu cele publice, dar nici să
> dubleze alte funcții disponibile la fel"* și *„să poată fi implementat pe toate aplicațiile din
> această platformă cu un simplu întrerupător"*.

## Ce se construiește, de fapt

**Două lucruri separate, nu unul.** Distincția e miezul cererii și se ține cu dinții:

1. **Registrul de acțiuni** (`@xc/actiuni` + convenția `/_actiuni`) — lista a ceea ce știe să facă
   fiecare aplicație, descrisă odată, în cod, folosibilă de oricine are drept să ceară: un AI, o
   altă aplicație a platformei, un script de întreținere.
2. **Modulul de Chat** (`services/chat-worker` + bula din `@xc/ui`) — **primul client** al
   registrului, nu proprietarul lui.

Dacă chatul se dovedește o idee proastă și se scoate, registrul rămâne și își merită singur costul.
Dacă registrul ar fi ascuns în chat, fiecare altă aplicație care vrea ceva de la `program` ar fi
nevoită să treacă printr-un model de limbaj ca să afle o oră de slujbă — absurd.

## 1. Cele trei feluri de API, și granițele dintre ele

| | Cine cheamă | Cum se ajunge la el | Ce e |
|---|---|---|---|
| **Public**, `/v1/…` | browsere, alte situri, foile | adresa publică a aplicației | citire, stabil, cu cache și ETag, contract public |
| **De serviciu**, `https://<x>.intern/…` | serviciile platformei între ele | Service Binding | ce există azi: `/sesiune`, `/can`, `/scrie`, punctual, scris de mână la fiecare nevoie |
| **Acțiuni**, `/_actiuni/…` | AI, aplicații, unelte | Service Binding | **verbe descrise**, cu argumente validate, permisiune și audit |

Deosebirea dintre al doilea și al treilea nu e tehnică, e de natură: rutele de serviciu sunt
**perechi private** (identitatea știe ce-i cere contul), acțiunile sunt o **listă publicată
înăuntru** — cine o citește află ce poate cere, fără să întrebe un om și fără să citească codul.

### Regula care împiedică dublarea

> **O acțiune nu conține logică proprie.** E un înveliș subțire peste exact aceeași funcție de
> domeniu pe care o cheamă și ruta `/v1`.

Concret, în `apps/program`:

```
src/date.ts        saptamanaDin(db, luni)        ← logica, într-un singur loc
src/index.ts       GET /v1/saptamana/<luni>      → saptamanaDin(...)
src/actiuni.ts     program.saptamana             → saptamanaDin(...)
```

Dacă scriind o acțiune simți nevoia de cod nou, codul acela aparține domeniului (`src/date.ts`) și
trebuie scris acolo, unde îl poate folosi și ruta publică. **Semnul rău**: o acțiune care cheamă
prin HTTP propriul `/v1`. Înseamnă că logica n-a fost desfăcută din rută.

### Regula care împiedică confuzia cu publicul

- Calea începe cu `_`, care în platformă înseamnă **intern**; nu apare niciodată într-o pagină.
- Workerul **refuză** o cerere `/_actiuni` care n-a venit prin Service Binding: se cere antetul
  `x-xc-intern` cu secretul platformei (`SECRET_INTERN`, varsă de mediu). Fără el → 404, nu 403:
  de pe internet, calea nu există.
- Acțiunile nu se rutează prin gateway-ul de preview.

## 2. Forma unei acțiuni

Se declară o singură dată, în `src/actiuni.ts` al aplicației:

```ts
export const ACTIUNI = registru([
  actiune({
    nume: 'program.slujbele_saptamanii',
    descriere: 'Slujbele dintr-o săptămână, cu ora, numele și locul. Săptămâna se dă prin ziua ' +
               'ei de luni; „azi" și „viitoare" merg și ele.',
    efect: 'citeste',
    intrare: z.object({ saptamana: z.string().describe('luni în formă 2026-09-14, „azi" sau „viitoare"') }),
    iesire: Saptamana,
    exemple: ['ce slujbe sunt săptămâna viitoare?', 'la ce oră e Liturghia duminică?'],
    async executa({ saptamana }, c) { return saptamanaDin(c.env.DB, luneaCeruta(saptamana)) },
  }),
])
```

Câmpuri și rostul lor:

| Câmp | De ce e acolo |
|---|---|
| `nume` | `<aplicatie>.<verb>`, unic pe platformă. Așa se vede în audit cine ce a cerut |
| `descriere` | scrisă pentru cineva care n-a văzut codul — **din ea alege modelul**, și tot ea e documentația pentru o altă aplicație |
| `efect` | `citeste` sau `scrie`. `scrie` trage după el confirmarea omului și intrarea în audit |
| `permisiune` | cheie din `CHEI_PERMISIUNI`; lipsa ei înseamnă „la liber", ca restul platformei |
| `intrare` / `iesire` | scheme zod. Din ele se naște manifestul, cu `z.toJSONSchema` — deci **descrierea pentru mașini nu poate rămâne în urmă față de cod** |
| `exemple` | fraze omenești care duc la ea; ajută modelul să aleagă și omul să înțeleagă |
| `executa` | cheamă funcția de domeniu. Nimic altceva |

### Două feluri de ieșire: date și obiecte

O acțiune întoarce fie **date** (JSON, de citit și de spus în vorbe), fie un **obiect care circulă**
— o hârtie gata făcută: foaia „Sfinții zilei", foaia A4 a săptămânii, JPG-ul ei, poza săptămânii din
calendar. Deosebirea nu e de formă, e de rost: datele se citesc, obiectele **se trimit**.

```ts
actiune({
  nume: 'program.foaia_sfintilor',
  descriere: 'Foaia „Sfinții zilei" pentru o duminică: sfinții grupați pe cărți, gata de tipărit ' +
             'sau de trimis. PDF sau JPG.',
  efect: 'citeste',
  intrare: z.object({ data: z.string(), fel: z.enum(['pdf', 'jpg']).default('pdf') }),
  iesire: Obiect,                       // ← nu date, ci o hârtie
  async executa({ data, fel }, c) { return foaiaSfintilor(c.env, data, fel) },
})
```

Forma unui obiect — aceeași pentru toate, indiferent cine îl face:

```ts
interface Obiect {
  fel: 'pdf' | 'jpg' | 'png'
  nume: string        // „sfintii-2026-09-13.pdf" — cum se numește fișierul în atașament
  titlu: string       // „Sfinții zilei — duminică, 13 septembrie" — cum se numește în vorbe
  cheie: string       // în media-worker (R2): „program/sfintii/2026-09-13.pdf"
  amprenta: string    // conținutul; același conținut → același obiect, nu se reface
  octeti: number
}
```

**Octeții nu trec niciodată prin model și nici prin chat.** Hârtia se face la cerere (Browser
Rendering, ca azi), se așază în `media-worker` sub cheia ei și mai departe circulă **doar cheia**.
Chatul arată un card cu titlul și un buton; comunicarea atașează obiectul la scrisoare cerându-l tot
după cheie. Așa aceeași foaie trimisă la trei audiențe se face o singură dată, iar o discuție nu
cară niciodată un PDF de 2 MB prin context.

**Circulația prin mediile de comunicare** e o acțiune de sine stătătoare, a comunicării, nu a
aplicației care face hârtia:

```
comunicare.trimite_obiect   { obiect: <cheie>, catre: <audiență|adresă>, mesaj? }   efect: scrie
```

Deci: `program` știe să facă foaia, `media` o ține, `comunicare` o trimite — fiecare la el acasă,
iar chatul doar le înlănțuie. Aceeași foaie pleacă la fel, oricine ar cere-o: un om din chat, un
crontab, o altă aplicație.

**Obiectele de la pornire** (toate există deja ca rute, deci acțiunea e doar învelișul):

| Acțiune | Ce dă | De unde vine azi |
|---|---|---|
| `program.foaia_sfintilor` | „Sfinții zilei", PDF/JPG | `GET /v1/sfintii-zilei/<data>` |
| `program.foaia_saptamanii` | foaia A4 a săptămânii, PDF/JPG | `GET /v1/foaie/<luni>` |
| `program.poza_paginii` | pagina săptămânii ca JPG | `GET /v1/poza/saptamana/<luni>.jpg` |
| `calendar.poza_saptamanii` | săptămâna calendarului, PNG | `GET <calendar>/v1/poza/saptamana/<zi>` |
| `tipic.sfintii_zilei` | **datele**, nu hârtia: pomenirile pe cărți | `GET /v1/sfinti/<data>` |

Ultimul rând e dinadins acolo: „Sfinții zilei" e și obiect (foaia, la `program`), și date
(pomenirile, la `tipic`). Sunt două acțiuni cu nume diferite, fiindcă răspund la două întrebări
diferite — „trimite-mi foaia" și „ce sfinți sunt mâine". Amândouă cheamă exact codul care există.

### Manifestul

`GET /_actiuni` întoarce lista, gata de dat unui model sau citită de o altă aplicație:

```json
{ "aplicatie": "program", "versiune": "0.4.1", "actiuni": [
  { "nume": "program.slujbele_saptamanii", "descriere": "…", "efect": "citeste",
    "permisiune": null, "intrare": { "type": "object", "properties": { … } }, "exemple": ["…"] }
]}
```

Nu se scrie de mână și nu se ține la zi de mână: se calculează din registru la fiecare cerere
(sau din cache-ul de muchie, cheia fiind versiunea aplicației).

## 3. Cine are voie

Nimic nou, aceleași porți ca pentru un om:

- acțiune fără `permisiune` → oricine o poate cere (aplicațiile sunt oricum „la liber", deocamdată);
- acțiune cu `permisiune` → se întreabă `authorization-worker` cu **principalul real al omului din
  chat**, mască „vezi ca" cu tot. Nicio acțiune nu se execută „în numele platformei" pentru că a
  cerut-o un model;
- niciodată `rol === 'admin'` verificat local — regula platformei;
- orice acțiune cu `efect: 'scrie'` scrie în audit: cine, ce, cu ce argumente, ce a ieșit, plus
  `prin: 'chat'` când vine de acolo.

**Consecința importantă**: chatul nu poate face nimic din ce n-ar putea face omul care scrie în el.
Nu e un ocol pe lângă drepturi, e o altă tastatură pentru aceleași drepturi.

## 4. Modulul de Chat

### Unde stă fiecare bucată

```
services/chat-worker/     creierul: discuțiile (D1 xc-chat-*), manifestele, bucla cu modelul
packages/ui/src/chat.ts   bula rotundă, panoul, JS-ul; intră în carcasă ca slot
packages/actiuni/         contractul, registrul, montarea rutelor, clientul, garda internă
apps/<app>/src/actiuni.ts ce știe să facă aplicația
```

`chat-worker` e serviciu intern: `workers_dev: false`, fără domeniu public, ca restul serviciilor.

### De ce nu vorbește browserul direct cu chat-worker

Fiecare aplicație montează `POST <prefix>/chat/mesaj` și trece cererea mai departe prin binding.
Motivul e practic: pagina stă pe `program.staging…`, iar chatul pe alt subdomeniu ar însemna CORS,
cookie-uri `SameSite` și o a doua verificare CSRF. Pe același origin, sesiunea și tokenul CSRF merg
neschimbate, iar aplicația știe deja cine e omul — îl trimite ea mai departe, o dată.

### Bucla unui mesaj

```
om → POST /chat/mesaj ─► chat-worker
                          1. ia discuția din D1
                          2. adună manifestele aplicațiilor deschise pentru chat
                          3. întreabă modelul (mesaje + lista acțiunilor)
                          4. modelul cere o acțiune:
                             ├─ efect „citeste" → o execută, pune rezultatul, se întoarce la 3
                             └─ efect „scrie"  → SE OPREȘTE. Întoarce o propunere:
                                „Validez săptămâna 14–20 sept. Confirmi?" [Da] [Nu]
                          5. răspunsul intră în D1 și pleacă la om
```

Acțiunea care scrie se execută **numai** după ce omul apasă „Da" — a doua cerere, cu `id`-ul
propunerii, verificată din nou la permisiuni (drepturile se pot fi schimbat între timp) și scrisă
în audit. Propunerea expiră în zece minute.

### Bucla nu mai ține conexiunea: răspuns asincron + sondare (18.09.2026)

Bucla de mai sus poate ține **minute** cu un model mic: un mesaj măsurat pe viu a ținut 2 min 49 s.
Cât timp răspunsul venea pe cererea care-l ceruse, se întâmpla ce era de așteptat — conexiunea cădea
pe drum, bula spunea „Nu am putut trimite mesajul", iar răspunsul, scris în D1, apărea „de nicăieri"
la reîncărcarea paginii. Deci mesajul are acum **două mișcări**:

```
om → POST /chat/mesaj ─► chat-worker `/mesaj` (asincron:true)
                            scrie mesajul omului, însemnează „în lucru"
                         ◄─ {conversatieId, mesajId, inLucru:true}      (sub o secundă)
     aplicația ─► chat-worker `/lucreaza`  ── ținut de ctxExec.waitUntil AL APLICAȚIEI
                            bucla de mai sus, cu buget de timp (90 s)
                            scrie etapa lângă mesajul omului: „caut în program… (program.ziua)"
                            la capăt scrie răspunsul agentului în D1
     bula ─► GET /chat/stare?id=… la 2,5 s ─► {gata:false, etapa} … {gata:true, raspuns}
```

Trei lucruri de ținut minte dacă se umblă aici:

- **cine ține lumina aprinsă**: `waitUntil` e al APLICAȚIEI, nu al lui chat-worker. Un worker chemat
  prin Service Binding trăiește cât cererea care l-a chemat; dacă aplicația își întoarce răspunsul și
  nu mai ține nimic aprins, munca poate fi tăiată la mijloc.
- **„gata" nu e un steag**, ci un fapt: `/stare` se uită dacă există un mesaj al agentului DUPĂ
  ultimul mesaj al omului. Așa nu se pierde nicio stare dacă lucrul cade la mijloc, iar paza de lucru
  dublat (`/lucreaza` chemat de două ori) iese din același fapt.
- **etapa stă în `date_json` al mesajului omului** — fără coloană nouă și fără tabel nou: rândul acela
  există oricum, e al discuției și piere odată cu ea.

Forma răspunsului n-a mișcat (`text`, `obiecte`, `propunere`, `unelte`): `/stare` îl întoarce întreg,
iar drumul vechi (`/mesaj` fără `asincron`) răspunde dintr-o bucată, ca până acum.

**Bugetul de timp**: bucla se oprește când s-au scurs 90 de secunde și spune omului ce a apucat să
caute; cu bugetul consumat nu se mai face nici apelul final „fără unelte", nici reîncercarea Workers
AI cu `max_tokens` dublat. Mai bine un răspuns scurt acum decât unul întreg peste trei minute.

### Fișiere urcate în bulă: Word, text și poze (18.09.2026, seara)

Cerere user: *„chatul trebuie să accepte fișiere Word (.docx) sau .txt, poze și text ca și acum"*.
Piesele s-au luat din proiectul de chineză (`src/lib/media.js`) — buton care apasă un
`<input type=file hidden>`, micșorarea pozei în browser (1600 px, JPEG 0.82), `multipart/form-data`
cu câmpul `fisier`, limita de 12 MB întâi pe `content-length`, listă albă MIME↔extensie și **cheia
scrisă de server, niciodată primită de la om**. Docx-ul, txt-ul și „vezi tot" sunt scrise aici.

```
bula ─► POST <prefix>/chat/urca   (multipart: fisier + text)
          1. content-length → 413;  mărimea → 413;  lista albă → 415
          2. .docx/.txt: textul se scoate ÎN WORKER (packages/chat/src/fisiere.ts)
          3. octeții → MEDIA, sub `chat/<app>/<om>/<timp36>-<hex6>.<ext>`
          4. cârligul aplicației (`laFisier`) — dacă are unul
       ◄─ { ok, obiect:{cheie,titlu,fel,octeti}, text, semne, taiat }
bula ─► POST /chat/mesaj cu `text`   ← pleacă SINGUR, omul nu mai apasă o dată
```

**Octeții nu trec prin model**, ca la orice obiect: prin discuție trece textul (la .docx/.txt) sau
cheia (la poză). Cardul din fir dă linkul pe `/chat/fisier/<cheie>`, sub aceeași poartă ca restul.

Trei lucruri de ținut minte dacă se umblă la `fisiere.ts`:

- **zip-ul se citește de la DIRECTORUL CENTRAL, mereu**. Când antetul local are steagul „data
  descriptor" (bit 3) — iar Word scrie des așa — mărimile din el sunt zero: un cititor pornit de
  acolo ia zero octeți și întoarce text gol, fără nicio eroare. Dezumflarea o face
  `DecompressionStream('deflate-raw')`, fără nicio bibliotecă nouă;
- **un .txt se încearcă întâi ca UTF-8 cu `fatal: true`**, apoi ca `windows-1250` (ce scrie Word-ul
  de pe Windows). Fără `fatal`, fișierul ar trece drept UTF-8 cu diacriticele stricate — adică ar
  „merge", și s-ar vedea abia pe hârtie;
- **tăierea la 12000 de semne** (`TAIERE_MESAJ_OM`, în `@xc/chat`) se face la urcare, nu doar la
  creier: cardul spune „tăiat", și vorba aceea trebuie să fie adevărată.

#### Cârligul aplicației: `modulChat({ …, laFisier })`

Fără el, urcarea e generică (textul devine mesajul omului, poza devine un card). Cu el, aplicația ia
fișierul în domeniul ei. La **buletin**: un `.docx` urcat în timpul chestionarului devine TEXTUL
articolului de acum, scris pe loc în schiță prin aceeași funcție de domeniu (`scrieRaspuns`) — deci
articolul nu mai face drumul prin model și înapoi; o poză intră în depozitul buletinului, sub
`poze/<nr>-<data>/…`, iar în schiță se scrie **adresa publică**, fiindcă Browser Rendering o ia de pe
internet, dintr-o sesiune care n-are cookie-urile omului.

### Instrucțiuni punctuale către un obiect al foii (18.09.2026, seara)

Cerere user: *„instrucțiunile sunt precise, către un obiect din lista de obiecte ce formează
buletinul"*, cu modelul mic păstrat: *„partea grea o duce codul, modelul doar potrivește fraza cu un
subiect"*. Deci `buletin.raspunde` are un argument în plus, `articol` (`principal`/`s1`/`s2`), iar
ieșirea se poartă altfel după cum a fost chemată:

| Cum s-a chemat | `intrebare` | `instructiune` |
|---|---|---|
| răspuns la întrebarea de acum (fără `articol`) | următoarea, gata scrisă | „pune-o EXACT așa" |
| instrucțiune punctuală (`articol`, ori alt subiect, ori schița gata) | ce a rămas, sau `null` | „spune ce ai schimbat; dacă e o întrebare, pune-o" |

Fără despărțirea asta, „schimbă motto-ul în X", spus după ce numărul era gata, ducea modelul să reia
cuminte „Care este textul articolului principal?".

**Ecranul se împrospătează fără reîncărcare**: bula emite `xc-chat:raspuns` la fiecare răspuns (cu
`unelte` în `detail` — scoase din `apeluri`, ca să fie acolo și pe drumul asincron), iar `/nou` cere
înapoi doar blocul schiței (`GET /nou?bucata=schita`, aceeași funcție `schitaPeEcran`). Reîncărcarea
întreagă rămâne unde era: după propunerea confirmată, când se schimbă foaia.

### Creierul, în spatele unei uși

```ts
// packages/.../creier.ts — singura funcție care știe cu cine vorbim
export async function intreabaModelul(env, mesaje, unelte): Promise<RaspunsModel>
```

Azi: **Workers AI** (binding `AI`, modelul într-o varsă `MODEL_CHAT`) — alegerea userului,
11.09.2026, pentru cost. Modelele deschise sunt însă vizibil mai slabe la ales și înlănțuit acțiuni
decât Claude; dacă se vede că greșește ce funcție cheamă, **schimbarea e o singură funcție**, nu o
rescriere. Restul modulului nu știe nimic despre furnizor.

### Discuția, în D1 `xc-chat-*`

```
conversatii  (id, user_id, aplicatie, deschisa_la, ultimul_mesaj_la)
mesaje       (id, conversatie_id, rol, text, actiuni_json, creat_la)
propuneri    (id, conversatie_id, actiune, argumente_json, stare, expira_la)
```

Doar `user_id` — nici nume, nici email (regula platformei). Discuția urmează omul din aplicație în
aplicație, fiindcă e legată de el, nu de pagină. **X-ul strânge panoul în cerc și nu închide nimic**:
starea „deschis/strâns" e o simplă clasă pe corp plus o cheie în `localStorage`; discuția e pe server.

## 5. Întrerupătorul — în două locuri, fiindcă sunt două întrebări

### a) În cod: „aplicația asta are chat?"

Trei linii și un fișier, atât:

```ts
// wrangler.jsonc:  { "binding": "CHAT", "service": "xc-chat" }, KV CONFIG, var SECRET_INTERN
import { ACTIUNI } from './actiuni.js'
const chat = modulChat({ aplicatie: 'program', actiuni: ACTIUNI })

const rasp = await chat.ruteaza(req, env, { prefix, principal })   // /_actiuni/* și /chat/*
if (rasp) return rasp
// …
pagina({ …, chat: await chat.bula(env, { eAdmin, prefix }) })      // '' când modulul e stins
```

### b) Din panoul de control: „e pornit acum, și pentru cine?"

Pagina „Module" din `apps/admin` scrie în KV `xc-config-*`, cheia `modul:chat`:

```json
{ "activ": true,
  "aplicatii": { "program": true, "calendar": true, "tipic": false },
  "cineVede": "admini" }
```

Carcasa citește cheia la desenarea paginii (KV, cu cache în memorie de un minut) și desenează bula
sau nu. **Stingerea din admin oprește și rutele**, nu doar bula — altfel ar rămâne o ușă deschisă
pentru cine știe adresa.

`cineVede` are trei trepte: `admini` (pornirea, alegerea userului), `conturi`, `toti`. Deschiderea
spre `toti` cere întâi o limitare pe IP — fiecare mesaj costă bani la fiecare apăsare, iar restul
platformei e la liber tocmai pentru că citirea unei pagini nu costă nimic.

## 6. Ce NU face modulul

- **nu ține date personale** — doar `user_id`, ca orice aplicație;
- **nu trimite email** singur — dacă e nevoie, prin `communication-worker`, ca toată platforma;
- **nu are identitate proprie** — omul e cel din sesiunea platformei;
- **nu ocolește permisiunile** — vezi §3;
- **nu ține cunoștințe proprii despre parohie** — nu copiază programul, calendarul sau tipicul în
  baza lui. Le **cere**, prin acțiuni. Ce spune chatul e ce spune aplicația, mereu proaspăt.

Ultimul punct e regula structurii mari („datele stau într-un loc") aplicată la un modul care, prin
natura lui, ar fi tentat s-o încalce: e ieftin și comod să îndeși în model o copie a programului.
Atunci chatul ar minți cuviincios a doua zi după o corectură.

## 7. Pașii

1. `@xc/actiuni` — contract, registru, manifest, montare, client, gardă, forma `Obiect`. Teste.
2. Acțiuni de citire pe `program`, `calendar`, `tipic` (înveliș peste funcțiile care există),
   inclusiv obiectele din tabelul de mai sus — „Sfinții zilei" printre primele.
3. `chat-worker` — D1, bucla, creierul pe Workers AI, propunerile.
4. Bula în `@xc/ui` + montarea pe `program` (prima aplicație).
5. Pagina „Module" din `apps/admin` + KV.
6. Acțiuni care scriu, cu confirmare: întâi `comunicare.trimite_obiect` (trimiterea unei foi), care
   e și proba fluxului de confirmare cap-coadă.

## 8. Partea executivă — cum scrie chatul (11.09.2026, seara)

Programul V2 nu avea niciun drum de scriere (pagina `/admin` fusese scoasă, propunerea se socotea
din zbor). Scrierea a intrat prin acțiuni, dar stă **în domeniu** (`depozit.ts`): `scrieSaptamana`,
`modificaSlujba`, `adaugaSlujba`, `stergeSlujba`, `valideazaSaptamana`. Fiecare pune în **același
batch** mutația, rândul de `istoric` și evenimentul din `outbox` (`program.week.changed.v1` /
`program.week.validated.v1`) — ori toate, ori niciuna; outbox-ul se golește după commit și din cron.

### Previzualizarea — omul confirmă ceva concret, deja verificat

O acțiune care scrie poate declara `rezuma(argumente, ctx)`. Cu antetul `x-xc-previzualizare: 1`,
`POST /_actiuni/<nume>` **validează argumentele, verifică dreptul și întoarce rezumatul, fără să
execute nimic**. Chatul o cheamă înainte să propună „Da/Nu":

```
om: „mută liturghia de luni la 7"
  → model: modifica_slujba { zi: "luni", ora: "08:00", schimbari: { ora: "07:00" } }
  → chat-worker: previzualizare → „Schimb «Utrenia și Sfânta Liturghie» de luni, 14 septembrie:
                  ora 08:00 → 07:00. Săptămâna nu e scrisă încă — o scriu întâi din propunere."
  → om: [Da]  → chat-worker: cere acțiunea (drept verificat din nou) → „Gata. Am schimbat…"
```

Dacă cererea n-are sens („luni n-are nicio slujbă «acatist»"), previzualizarea cade cu motivul,
nu se propune nimic, iar omul află de ce. Argumentele greșite cad **înainte** de rezumat.

### Săptămâna care nu e scrisă se scrie întâi

Săptămâna viitoare e propunere, nu rând în bază. Orice schimbare în ea **scrie întâi propunerea**
(`scrieSaptamana`, stare `propus`, sursă `manual`), apoi aplică schimbarea — drumul din V1,
propunere → scrisă → (modificată) → validată. Rezumatul o spune, ca omul să confirme știind.
O săptămână validată care se atinge trece în `modificat_dupa_validare`.

### Cum găsește chatul slujba din vorbele omului

`gasesteSlujba(zi, nume?, ora?)`: ziua se poate spune și ca „luni" (`dataCeruta` înțelege numele
zilelor — următoarea zi cu numele acela, azi inclusiv); numele e opțional (dacă ziua are o singură
slujbă sau se dă ora ei de acum); se caută în ce se **vede** — săptămâna scrisă sau propunerea ei.
Când sunt mai multe potriviri, unealta spune care sunt, și abia atunci modelul întreabă omul.

### Ce a trebuit spus modelului, măsurat

Cu descrierea „omul confirmă înainte", modelul **cerea confirmarea în text** („vrei să…?") în loc
să cheme unealta. Regula scrisă: cheamă unealta imediat — chemarea nu execută nimic, ea pregătește
propunerea, iar confirmarea e pe buton; nu pune întrebări de lămurire înainte, unealta spune ce
lipsește.

## 9. Creierul, de la 11.09.2026 seara: Claude prin AI Gateway, o singură factură

Cererea utilizatorului a fixat trei lucruri: **Claude Opus 4.8** („nici mai sus, nici mai jos"),
**totul prin AI Gateway** („nu ocoli această cale") și **fără SDK-uri** („o singură factură foarte
clară"). De aici:

- poarta `xc-chat` e drumul tuturor modelelor — Claude *și* Workers AI. Fără poartă configurată,
  `creier.ts` nu cheamă nimic și spune de ce;
- Claude se cheamă cu cereri simple (`fetch`) către `…/xc-chat/anthropic/v1/messages`, cu
  **Unified Billing**: nicio cheie Anthropic, doar `cf-aig-authorization` cu un token Cloudflare.
  Cloudflare plătește furnizorul din creditele contului; parohia vede o singură factură;
- forma cererii e cea a Messages API: `system`, `messages`, `tools` (cu `input_schema`),
  `thinking: adaptive`, `output_config.effort`. Tura asistentului se pune înapoi în istoric cu
  blocurile brute — gândirea trebuie să însoțească apelul de unealtă căruia i-a dat naștere;
  rezultatele uneltelor merg într-un singur mesaj `user`;
- cerințe pe poartă: `authentication: true` (altfel tokenul e ignorat și cererea pleacă fără cheie —
  „x-api-key header is required"), `workers_ai_billing_mode: unified`, **credite încărcate** (altfel
  `402`).
