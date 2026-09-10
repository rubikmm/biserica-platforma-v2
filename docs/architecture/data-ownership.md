# Cine deține ce date

Regula: **o bază, un proprietar**. Nicio altă componentă nu are binding către ea. Se verifică
citind fișierele `wrangler.jsonc` — dacă un worker are un `d1_databases` care nu e al lui, e o
greșeală, nu o scurtătură.

| Bază | Proprietar | Ce ține | Cine mai citește |
|---|---|---|---|
| `xc-identity-*` | `identity-worker` | utilizatori, sesiuni, jetoane, consimțăminte, emailuri sandbox | nimeni — doar prin `/sesiune` |
| `xc-authz-*` | `authorization-worker` | atribuiri de rol, granturi de permisiuni | nimeni — doar prin `/can`, `/roluri` |
| `xc-audit-*` | `audit-worker` | jurnalul append-only, marcaje de idempotență | `admin`, prin `/citeste`, după `audit.read` |
| `xc-calendar-*` | `app-calendar` | evenimente, outbox propriu | nimeni |
| `xc-communication-*` | `communication-worker` | audiențe, preferințe, șabloane, cereri, livrări | `admin`, prin `/livrari` |
| `xc-automation-*` | `automation-worker` | reguli, acțiuni | `admin`, prin `/actiuni` |
| `xc-media-*` (R2) | `media-worker` | fișierele tuturor domeniilor, prefixate `<domeniu>/…` | nimeni — doar prin contract |

## Consecințe practice

- **Rolurile nu stau la identitate.** `identity-worker` le cere lui `authorization-worker` când
  construiește răspunsul de sesiune. Dacă autorizarea tace, sesiunea rămâne validă, dar fără
  roluri — adică fără drepturi. Refuzul e starea sigură.
- **Auditul nu are UPDATE sau DELETE.** Nu există în cod, în niciun worker.
- **Fișierele nu se ating direct.** Aplicațiile nu primesc binding de bucket; trec prin
  `media-worker`, care impune convenția de chei și poate fi auditat într-un singur loc.

## Ce se întâmplă la migrarea unei aplicații din V1

Aplicația migrată primește **baza ei nouă**, cu prefix `xc-`. Datele din V1 se **copiază**, nu se
partajează și nu se sincronizează în ambele sensuri. Pentru fiecare entitate există, la orice
moment, o singură sursă de adevăr:

- înainte de cutover: V1;
- după cutover: V2.

Nu există etapă în care ambele scriu aceleași date.
