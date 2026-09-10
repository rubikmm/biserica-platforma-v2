# Activarea emailului real

## Situația actuală

**Nu pleacă niciun email.** Adaptorul activ e `sandbox`: scrie mesajul în tabela `emails_iesire`
și îl loghează. În `dev`, linkul de confirmare apare direct în pagină, ca fluxul să fie testabil.

Asta e o alegere deliberată, nu o lipsă: nimic din V2 nu trebuie să ajungă la oameni reali cât
timp platforma e în construcție.

## Ce lipsește

Tokenul Cloudflare al parohiei **nu are** permisiuni de Email Routing sau Email Service. Chiar
dacă le-ar avea, Cloudflare nu oferă trimitere de email tranzacțional din Workers.

E nevoie de un furnizor extern (Resend, Postmark, Brevo, SMTP prin HTTP) și de o cheie de API.

## Cum se activează

1. Alege furnizorul și creează o cheie de API.
2. Verifică domeniul expeditor la furnizor (SPF/DKIM pe `sfantul-ilie.ro`) — **atenție**, asta
   atinge DNS-ul de producție, deci se face doar cu confirmare explicită.
3. Pune secretele, fără să le scrii în repo:

```bash
wrangler secret put EMAIL_API_KEY --env staging --config services/identity-worker/wrangler.jsonc
```

4. Schimbă în `wrangler.jsonc`-ul mediului:

```jsonc
"vars": {
  "ADAPTOR_EMAIL": "http",
  "EMAIL_API_URL": "https://api.furnizorul.com/emails",
  "EMAIL_EXPEDITOR": "parohia@sfantul-ilie.ro"
}
```

5. Adaptorul `EmailFurnizorHttp` din `services/identity-worker/src/email.ts` e deja scris; verifică
   doar dacă formatul cerut de furnizorul ales se potrivește cu corpul trimis acolo.

## Pentru comunicarea în masă

`communication-worker` are un comutator separat, `LIVRARE_REALA`. Cât timp e `nu`, adaptoarele
reale nici nu pot fi alese — funcția aruncă. Trecerea pe `da` cere un adaptor implementat și e o
decizie explicită a utilizatorului, nu un efect secundar al configurării emailului de login.

Distincția e intenționată: un link de autentificare către o singură persoană care tocmai a cerut-o
e altceva decât un anunț către toată parohia.
