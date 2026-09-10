# Migrarea V1 → V2

## Punctul de plecare

V1 are 12 aplicații, fiecare un worker propriu cu D1 și R2 proprii, pe subdomenii
`<app>.sfantul-ilie.ro`. Codul comun (carcasă, stiluri, JS, titluri, cont) e **copiat** în fiecare
aplicație — de aceea o schimbare de antet costă 12 intervenții.

V2 rezolvă asta prin `packages/` partajate și servicii centrale pentru identitate și autorizare.

## Regula care nu se încalcă

**V1 rămâne în funcțiune, neatinsă, până la cutover-ul explicit al fiecărei aplicații.** Nimic din
V1 nu se șterge, nu se reconfigurează și nu se refolosește. Datele se copiază.

## Ordinea recomandată

Criteriul: cu cât aplicația are mai puține date proprii și mai puțină autentificare, cu atât e
mai devreme.

| # | Aplicație | De ce aici | Dificultate |
|---|---|---|---|
| 1 | **calendar** | pilot deja construit; date simple, fără cont | mică |
| 2 | tipic, biblia, biblioteca | conținut, aproape fără scriere | mică |
| 3 | program, buletin | scriere reală, dar audiență restrânsă | medie |
| 4 | curățenie, transmisiuni | logică proprie mai bogată | medie |
| 5 | cont | **după** ce identitatea V2 e folosită de toate cele de sus | mare |
| 6 | comunicări, newsletter | depind de `communication-worker` cu livrare reală | mare |

`cont` vine târziu intenționat: e aplicația care în V1 ține autentificarea, iar mutarea ei
înseamnă că utilizatorii reali trec pe sesiunile V2. Până acolo, V2 are utilizatorii lui.

## Pașii pentru o aplicație

1. **Contract** — modelul datelor în `packages/contracts`, cu Zod.
2. **Bază nouă** — `xc-<app>-staging`, migrații în `infrastructure/migrations/<app>/`.
3. **Copiere** — export din V1, import în baza nouă. O singură dată, cu verificare de număr de
   rânduri; fără sincronizare continuă.
4. **Aplicație** — `apps/<app>/`, folosind `@xc/auth` și `@xc/authorization`. Fără cod copiat din V1.
5. **Verificare pe staging** — pe `<app>.staging.sfantul-ilie.ro`, cu date copiate.
6. **Cutover** — abia aici se atinge DNS-ul: ruta de producție trece pe workerul V2.
7. **V1 rămâne** — workerul vechi nu se șterge imediat; rămâne oprit din rutare, ca rollback.

## Criteriul de cutover

Toate trebuie adevărate simultan:

- fluxul principal al aplicației merge pe staging, cu date copiate;
- permisiunile sunt verificate prin serviciul central, nu local;
- acțiunile importante apar în audit;
- există un export proaspăt al datelor V1;
- utilizatorul a confirmat explicit.

## Rollback

Cutover-ul e o schimbare de rută DNS, deci rollback-ul e tot una: ruta se întoarce pe workerul V1,
care n-a fost șters. Fereastra în care s-au putut scrie date noi în V2 e singura pierdere posibilă
— de aceea primul cutover se face pe o aplicație cu scrieri rare.

## Curățenia de la final

Toate resursele V2 poartă prefixul `xc-`. La final, curățenia înseamnă: șterge tot ce **nu** are
prefixul `xc-`, după ce fiecare aplicație a fost migrată și a trecut prin perioada de rollback.
