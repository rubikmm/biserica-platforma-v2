# Identitate, sesiuni și SSO

## Fluxul de intrare — fără parolă

Nu există parolă nicăieri (decizie a utilizatorului, 10.09.2026). Intrarea are un singur gest:

1. omul dă adresa de email;
2. primește un link pe adresa aceea;
3. îl deschide — și abia atunci există o sesiune.

Același gest **naște și contul**: dacă adresa nu are cont, contul se creează la prima confirmare,
cu numele purtat prin jeton. Nu există conturi neconfirmate.

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as app-account (BFF)
  participant I as identity-worker
  participant E as Cloudflare Email Service

  B->>A: POST /auth/login (email) sau /auth/inregistrare (nume + email)
  A->>I: /intrare
  I->>I: rate limit, jeton nou (15 min, un singur consum)
  I->>E: scrisoare cu link (binding send_email)
  I-->>A: challengeSent (mereu true)
  A-->>B: „Verifică-ți emailul"
  B->>A: GET /auth/confirma?jeton=…
  A->>I: /confirma
  I->>I: consumă jetonul; creează contul dacă lipsește; sesiune nouă
  I-->>A: token de sesiune (30 de zile)
  A-->>B: Set-Cookie + redirect
```

## De ce link și nu cod din 6 cifre

Decizia utilizatorului: linkul e mai ușor de folosit pe telefon — o apăsare, fără comutat între
aplicații și fără transcris cifre. Compensații, fiindcă un link e mai ușor de dat mai departe
decât un cod citit cu ochii:

- valabil 15 minute;
- consum unic, **atomic** (`UPDATE … WHERE consumed_at IS NULL`) — două apăsări simultane dau o
  singură sesiune;
- un link nou le închide pe cele anterioare ale aceleiași adrese;
- în baza de date se ține doar hash-ul SHA-256 al jetonului.

## De ce sesiunea e lungă (30 de zile)

Fără parolă, linkul e singurul gest de intrare. O sesiune de câteva ore ar trimite omul la
email la fiecare vizită. 30 de zile e compromisul; contraponderea e revocarea centrală, imediată
(„Închide toate sesiunile"), plus faptul că sesiunile sunt opace și verificate la fiecare cerere.

## Ce se stochează

| Element | Cum |
|---|---|
| Jeton de sesiune | aleator, 32 de octeți; în bază **doar** SHA-256 |
| Jeton de intrare | identic ca tratament — hash, expirare, consum unic; poartă emailul și numele pentru conturile încă nenăscute |
| PII | doar email și nume afișat. Fără telefon, adresă, date personale |
| Parole | **nu există** |

O scurgere a bazei nu dă sesiuni active și nu dă nimic de spart.

## Emailul

Scrisoarea pleacă prin **Cloudflare Email Service** (binding `send_email`, numit `POSTA`), același
drum pe care merge intrarea în platforma V1 din 8.09.2026: 3.000 de scrisori pe lună incluse în
planul Workers plătit, DKIM semnat de Cloudflare, nicio parolă de ținut.

Expeditorul e `no-reply@posta.sfantul-ilie.ro` — subdomeniul îmbarcat la Email Sending — nu
apexul, ca SPF-ul mailului obișnuit al parohiei să rămână neatins.

În `dev`, `wrangler dev` nu trimite prin binding; adaptorul e `sandbox` și linkul apare în pagină.
Pe drumul real, linkul **nu** se scrie în jurnal — ar fi o a doua copie a secretului.

## Cookie-uri

| Atribut | Valoare | De ce |
|---|---|---|
| `HttpOnly` | da | JS-ul paginii nu atinge sesiunea |
| `Secure` | da | doar HTTPS |
| `SameSite` | `Lax` | navigare normală, fără POST-uri din alte origini |
| `Path` | `/` | |
| `Domain` | gol în dev, `.staging.sfantul-ilie.ro` în staging | SSO pe subdomeniile mediului |

**Cookie-ul de staging nu are voie pe `.sfantul-ilie.ro`** — ar fi trimis și aplicațiilor V1.

## Amenințări și ce le oprește

| Amenințare | Măsură |
|---|---|
| Enumerarea conturilor | răspuns identic indiferent dacă adresa are cont |
| Cereri în rafală | limitare pe email (8/15 min) și pe IP (30/15 min), ferestre glisante |
| CSRF | verificare de `Origin` **și** jeton pereche cookie/formular, comparat în timp constant |
| Refolosirea linkului | consum atomic, o singură dată |
| Sesiune furată | revocare centrală, sesiuni opace verificate la fiecare cerere |
| Roboți de „sunt în concediu" | antetul `Auto-Submitted: auto-generated` pe scrisoare |
| Scurgere prin loguri | logger cu redactare obligatorie |

## Ce nu e implementat

- **OIDC** — inutil cât timp toate aplicațiile sunt ale noastre, pe subdomenii proprii.
- **Al doilea factor** — cerut inițial, retras de utilizator odată cu parola. Dacă revine, e o
  schimbare izolată în `identity-worker`.
