# Replay din DLQ și revocarea sesiunilor

## Mesaje în DLQ

Un mesaj ajunge în `xc-events-dlq-staging` după 5 reîncercări eșuate, sau imediat dacă envelope-ul
nu trece de validarea de contract.

### Ce verifici întâi

```bash
wrangler queues list
wrangler tail xc-events-staging --env staging
```

Două cauze tipice:

1. **Consumatorul e stricat** (o eroare în `automation-worker`) → repară, redeployează, apoi dă
   replay. Mesajele sunt valide, doar procesarea a căzut.
2. **Envelope invalid** → replay-ul nu ajută. Contractul s-a schimbat fără versiune nouă, ceea ce
   e o greșeală de tratat în cod, nu în coadă.

### Replay

Consumatorii sunt idempotenți (`evenimente_procesate`), deci un mesaj deja procesat cu succes nu
produce efecte a doua oară. Replay-ul e sigur.

Dacă mesajele au fost deja procesate parțial, verifică întâi în `xc-automation-staging`:

```sql
SELECT id, rule_id, stare, created_at FROM actions ORDER BY created_at DESC LIMIT 20;
```

## Revocarea sesiunilor

### A unui singur utilizator

Din interfață: `/` → „Închide toate sesiunile". Sau intern:

```bash
curl -s -X POST https://identity.intern/revoca-toate \
  -H 'content-type: application/json' -d '{"userId":"<id>"}'
```

Efectul e imediat: sesiunile sunt opace și verificate central la fiecare cerere.

### A tuturor (incident)

```sql
UPDATE sessions SET revoked_at = datetime('now') WHERE revoked_at IS NULL;
```

Rulat pe `xc-identity-staging`. Toată lumea trebuie să se autentifice din nou, cu ambii factori.

## Rotația secretelor

```bash
wrangler secret put EMAIL_API_KEY --env staging --config services/identity-worker/wrangler.jsonc
```

Tokenul Cloudflare nu se rotește de aici — e comun întregii flote, iar schimbarea lui se discută
pe `#proj-biserica-platforma`.
