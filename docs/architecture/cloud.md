# Schema platformei in termeni Cloudflare — staging

> Generat din `wrangler.jsonc` cu `node infrastructure/cutover/schema-cloud.mjs` (2026-09-14).
> Nu se scrie de mana: se regenereaza dupa orice schimbare de legaturi sau resurse.

## La nivel de platforma

Fiecare aplicatie e un **Worker** separat, cu datele ei. Browserul vorbeste DOAR cu aplicatia de pe
subdomeniul lui; aplicatia e BFF-ul: ea cheama serviciile prin **Service Bindings** (chemare interna,
fara internet, fara DNS, fara CORS). Nimeni nu citeste baza altcuiva.

Trei straturi:

1. **Aplicatiile** (`apps/`) — au adresa publica si paginile. Proprietare pe domeniul lor.
2. **Serviciile** (`services/`) — n-au adresa publica: identitate, autorizare, audit, comunicare,
   evenimente, automatizare, media, chat. Se ajunge la ele numai prin Service Binding.
3. **Resursele** — D1 (baze), R2 (depozite), KV (comutatoare), Queues (evenimente),
   Durable Objects (starea vie a emisiei), Workers AI + AI Gateway (chatul), Browser Rendering (hartii).

```mermaid
graph LR
  account["account"]
  admin["admin"]
  biblia["biblia"]
  biblioteca["biblioteca"]
  buletin["buletin"]
  calendar["calendar"]
  curatenie["curatenie"]
  home["home"]
  live["live"]
  newsletter["newsletter"]
  program["program"]
  radio["radio"]
  tipic["tipic"]
  audit(("audit"))
  authorization(("authorization"))
  automation(("automation"))
  chat(("chat"))
  communication(("communication"))
  event(("event"))
  identity(("identity"))
  media(("media"))
  account --> identity
  admin --> identity
  admin --> authorization
  admin --> audit
  admin --> automation
  admin --> communication
  biblia --> identity
  biblioteca --> identity
  biblioteca --> authorization
  biblioteca --> communication
  buletin --> identity
  buletin --> audit
  buletin --> communication
  calendar --> identity
  calendar --> authorization
  calendar --> audit
  calendar --> communication
  calendar --> biblia
  curatenie --> identity
  curatenie --> authorization
  curatenie --> communication
  curatenie --> calendar
  home --> identity
  live --> identity
  live --> authorization
  live --> radio
  live --> program
  newsletter --> identity
  program --> identity
  program --> authorization
  program --> audit
  program --> calendar
  program --> tipic
  program --> communication
  program --> media
  program --> chat
  radio --> identity
  radio --> authorization
  radio --> live
  tipic --> identity
  tipic --> authorization
  tipic --> audit
  tipic --> calendar
  automation --> communication
  automation --> audit
  chat --> program
  chat --> calendar
  chat --> tipic
  chat --> audit
  event --> automation
  identity --> authorization
  identity --> audit
```

## Aplicatie cu aplicatie

### account — `xc-account-staging`
- **Adresa**: cont.staging.sfantul-ilie.ro (Custom Domain)
- **Cheama**: identity

### admin — `xc-admin-staging`
- **Adresa**: admin.staging.sfantul-ilie.ro (Custom Domain)
- **KV**: CONFIG
- **Cheama**: identity, authorization, audit, automation, communication

### biblia — `xc-biblia-staging`
- **Adresa**: biblia.staging.sfantul-ilie.ro (Custom Domain)
- **R2**: xc-biblia-staging
- **Cheama**: identity
- **Chemat de**: calendar

### biblioteca — `xc-biblioteca-staging`
- **Adresa**: biblioteca.staging.sfantul-ilie.ro (Custom Domain)
- **D1**: xc-biblioteca-staging
- **R2**: xc-biblioteca-staging
- **Cron**: 0 6 * * *
- **Cheama**: identity, authorization, communication

### buletin — `xc-buletin-staging`
- **Adresa**: buletin.staging.sfantul-ilie.ro (Custom Domain)
- **D1**: xc-buletin-staging
- **R2**: xc-buletin-staging
- **Cheama**: identity, audit, communication

### calendar — `xc-calendar-staging`
- **Adresa**: calendar.staging.sfantul-ilie.ro (Custom Domain)
- **D1**: xc-calendar-staging
- **Queues**: xc-events-staging (scrie)
- **Cron**: */5 * * * *
- **Browser Rendering**
- **Cheama**: identity, authorization, audit, communication, biblia
- **Chemat de**: curatenie, program, tipic, chat

### curatenie — `xc-curatenie-staging`
- **Adresa**: curatenie.staging.sfantul-ilie.ro (Custom Domain)
- **D1**: xc-curatenie-staging
- **Cron**: 0 * * * *
- **Cheama**: identity, authorization, communication, calendar

### home — `xc-home-staging`
- **Adresa**: staging.sfantul-ilie.ro (Custom Domain)
- **Cheama**: identity

### live — `xc-live-staging`
- **Adresa**: live.staging.sfantul-ilie.ro (Custom Domain)
- **Durable Objects**: Direct, Aparat, Ascultatori
- **Cheama**: identity, authorization, radio, program
- **Chemat de**: radio

### newsletter — `xc-newsletter-staging`
- **Adresa**: newsletter.staging.sfantul-ilie.ro (Custom Domain)
- **R2**: xc-newsletter-staging
- **Cheama**: identity

### program — `xc-program-staging`
- **Adresa**: program.staging.sfantul-ilie.ro (Custom Domain)
- **D1**: xc-program-staging
- **KV**: CONFIG
- **Queues**: xc-events-staging (scrie)
- **Cron**: */5 * * * *
- **Browser Rendering**
- **Cheama**: identity, authorization, audit, calendar, tipic, communication, media, chat
- **Chemat de**: live, chat

### radio — `xc-radio-staging`
- **Adresa**: radio.staging.sfantul-ilie.ro (Custom Domain)
- **R2**: biserica-transmisiuni
- **Durable Objects**: Radio
- **Cheama**: identity, authorization, live
- **Chemat de**: live

### tipic — `xc-tipic-staging`
- **Adresa**: tipic.staging.sfantul-ilie.ro (Custom Domain)
- **D1**: xc-tipic-staging
- **R2**: xc-tipic-staging
- **Cheama**: identity, authorization, audit, calendar
- **Chemat de**: program, chat

### audit — `xc-audit-staging` *(serviciu intern)*
- **D1**: xc-audit-staging
- **Cheama**: pe nimeni
- **Chemat de**: admin, buletin, calendar, program, tipic, automation, chat, identity

### authorization — `xc-authz-staging` *(serviciu intern)*
- **D1**: xc-authz-staging
- **Cheama**: pe nimeni
- **Chemat de**: admin, biblioteca, calendar, curatenie, live, program, radio, tipic, identity

### automation — `xc-automation-staging` *(serviciu intern)*
- **D1**: xc-automation-staging
- **Cheama**: communication, audit
- **Chemat de**: admin, event

### chat — `xc-chat-staging` *(serviciu intern)*
- **D1**: xc-chat-staging
- **KV**: CONFIG
- **Workers AI** (prin AI Gateway)
- **Cheama**: program, calendar, tipic, audit
- **Chemat de**: program

### communication — `xc-communication-staging` *(serviciu intern)*
- **D1**: xc-communication-staging
- **Cheama**: pe nimeni
- **Chemat de**: admin, biblioteca, buletin, calendar, curatenie, program, automation

### event — `xc-events-staging` *(serviciu intern)*
- **D1**: xc-audit-staging
- **Queues**: xc-events-staging (citeste)
- **Cheama**: automation

### identity — `xc-identity-staging` *(serviciu intern)*
- **D1**: xc-identity-staging
- **Cheama**: authorization, audit
- **Chemat de**: account, admin, biblia, biblioteca, buletin, calendar, curatenie, home, live, newsletter, program, radio, tipic

### media — `xc-media-staging` *(serviciu intern)*
- **R2**: xc-media-staging
- **Cheama**: pe nimeni
- **Chemat de**: program

## Socoteala

- 13 aplicatii + 8 servicii = 21 Workers
- 12 baze D1, 7 depozite R2,
  1 spatiu KV, 1 cozi
- 4 workeri cu ceas (cron), 2 cu Durable Objects

