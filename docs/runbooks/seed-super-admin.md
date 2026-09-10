# Primul super-admin

## Cum funcționează

Nu există parolă în cod, în seed sau în migrații. Mecanismul e o singură variabilă:

```jsonc
"vars": { "EMAIL_SUPERADMIN": "rubikmm@gmail.com" }
```

La **înregistrare**, dacă adresa normalizată se potrivește cu ea, utilizatorul primește automat
rolul `super-admin` pe scope-ul `global`. Restul primesc `user`.

Parola o alege omul, în formular. Nimeni altcineva nu o vede și nu o poate reconstrui din
baza de date.

## Pașii

1. Verifică `EMAIL_SUPERADMIN` în `wrangler.jsonc`-ul mediului.
2. Deschide `/auth/inregistrare` și creează contul cu acea adresă.
3. În `dev`, linkul de confirmare apare în pagină. În alte medii vine pe email.
4. Deschide linkul → sesiunea se creează, adresa e marcată confirmată.
5. Verifică pe `/`: la „Roluri" trebuie să scrie `super-admin · global`.

## Dacă adresa a fost deja înregistrată înainte de a fi trecută în variabilă

Rolul se atribuie o singură dată, la creare. Pentru un cont existent, atribuirea se face prin
`authorization-worker`, din interiorul containerului:

```bash
curl -s -X POST https://authz.intern/atribuie \
  -H 'content-type: application/json' \
  -d '{"userId":"<id>","role":"super-admin","scope":"global"}'
```

`/atribuie` e o rută internă, accesibilă doar prin Service Binding — nu e expusă public.

## Ce nu face

- Nu creează utilizatori automat.
- Nu setează parole.
- Nu acordă nimic dacă `EMAIL_SUPERADMIN` e gol — atunci toți primesc `user`, iar primul
  super-admin trebuie făcut manual, ca mai sus.
