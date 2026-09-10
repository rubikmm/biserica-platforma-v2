# Emailul: cum pleacă și ce faci când nu pleacă

## Drumul

Scrisorile de intrare pleacă prin **Cloudflare Email Service**, prin binding-ul `send_email`
declarat în `services/identity-worker/wrangler.jsonc`:

```jsonc
"send_email": [{ "name": "POSTA" }],
"vars": {
  "ADAPTOR_EMAIL": "cloudflare",
  "POSTA_DE_LA": "no-reply@posta.sfantul-ilie.ro",
  "POSTA_NUME": "Biserica Sfântul Ilie – Hanul Colței"
}
```

Nu există chei de API sau parole de ținut: Cloudflare semnează DKIM și trimite. Planul Workers
plătit include 3.000 de scrisori pe lună.

**Condiția unică**: domeniul expeditor `posta.sfantul-ilie.ro` să fie îmbarcat la Email Sending
(panou → Compute → Email Service → Email Sending). E deja făcut pentru V1 (8.09.2026); V2 folosește
același subdomeniu.

## Pe medii

| Mediu | Adaptor | Ce se întâmplă |
|---|---|---|
| dev | `sandbox` | nimic nu pleacă; linkul apare în pagină și în `emails_iesire` |
| staging | `cloudflare` | scrisoarea pleacă real, către adresa introdusă |
| production | `cloudflare` | idem (când va exista) |

`wrangler dev` **nu** trimite prin binding chiar dacă e declarat — de aceea în dev rămâne sandbox.

## Când nu pleacă

Jurnalul worker-ului (`wrangler tail xc-identity-staging --env staging`) și tabela `emails_iesire`
(coloanele `livrat`, `detaliu`) spun ce s-a întâmplat. Codurile Cloudflare:

| Cod | Înseamnă | Ce faci |
|---|---|---|
| `E_SENDER_NOT_VERIFIED` | domeniul expeditor nu e îmbarcat | verifică `posta.sfantul-ilie.ro` în panou |
| `E_RATE_LIMIT_EXCEEDED` | plafonul lunar/orar atins | așteaptă sau cere plafon mai mare |
| altceva | vezi mesajul | nu ocoli; spune utilizatorului |

Nu există rezervă SMTP în V2 (V1 avea contul de pe cPanel ca rezervă). Dacă va fi nevoie, se
adaugă ca al doilea adaptor în `email.ts`, fără să se atingă restul.

## Comunicarea în masă

`communication-worker` are alt comutator, `LIVRARE_REALA`, și e încă în sandbox. Când se
activează, va folosi același binding pentru email, iar pentru WhatsApp gateway-ul WAHA de pe NAS
(cum face A7 în V1). Decizie separată, explicită — un link de intrare către o persoană care l-a
cerut e altceva decât un anunț către toată parohia.
