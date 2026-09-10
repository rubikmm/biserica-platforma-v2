# ADR 0002 — SSO cu sesiuni opace și BFF, nu JWT în browser

**Stare**: acceptat, 10.09.2026

## Context

Aplicațiile sunt pe subdomenii ale aceluiași domeniu și trebuie să împartă autentificarea.
Variantele: JWT în cookie, sesiuni opace verificate central, sau OIDC complet.

## Decizie

Sesiuni **opace**, aleatorii, stocate doar ca hash în D1. Cookie-ul e pus pe domeniul părinte al
mediului. Aplicațiile sunt BFF-uri: primesc cookie-ul și întreabă `identity-worker` prin Service
Binding. Browserul nu apelează niciodată direct un API intern.

## De ce nu JWT

Un JWT e valid până expiră, oriunde ar ajunge. Revocarea cere oricum o listă centrală — adică
exact costul pe care JWT-ul pretinde că-l evită. Cu sesiuni opace, „închide toate sesiunile"
are efect imediat.

## De ce nu OIDC acum

Toate aplicațiile sunt ale noastre, pe subdomenii proprii. OIDC ar fi complexitate fără beneficiu.
Se adaugă când apare o aplicație mobilă sau un terț.

## Consecințe

- Fiecare cerere autentificată face un hop intern către identitate (ieftin, în aceeași rețea).
- Revocarea e centrală și imediată.
- În `dev`, gazda `rubik` nu acceptă `Domain` în cookie; SSO-ul local se vede prin gateway.
