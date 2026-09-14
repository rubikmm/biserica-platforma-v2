#!/bin/sh
# Publica workerii de PRODUCTIE, fara rute: exista, dar nu-i vede nimeni din afara.
# Se ruleaza in mai multe treceri, fiindca un Service Binding cere workerul tinta deja publicat;
# ce cade intr-o trecere se incearca in urmatoarea, cand vecinii lui exista.
#
#   sh infrastructure/cutover/publica-productie.sh [nume...]
#
# ⚠️ Rutele (Custom Domains) NU sunt in configuratii: mutarea hostname-ului de la V1 e pasul
# explicit al cutover-ului si se face unul cate unul, cu omul de fata.
set -e
cd "$(dirname "$0")/../.."
set -a; . /backup/_setup/cloudflare.env; set +a

TOATE="services/audit-worker services/authorization-worker services/media-worker \
services/communication-worker services/automation-worker services/event-worker \
services/identity-worker apps/biblia apps/calendar apps/tipic apps/program apps/curatenie \
apps/biblioteca apps/buletin apps/newsletter apps/live apps/radio apps/account apps/admin \
apps/home services/chat-worker"

[ $# -gt 0 ] && TOATE="$*"

RAMASE="$TOATE"
for trecere in 1 2 3; do
  [ -z "$RAMASE" ] && break
  echo "--- trecerea $trecere ---"
  URMATOARE=""
  for p in $RAMASE; do
    printf '%-38s ' "$p"
    if out=$(npx wrangler deploy --env production -c "$p/wrangler.jsonc" 2>&1); then
      echo "publicat"
    else
      echo "amanat"
      URMATOARE="$URMATOARE $p"
      ULTIMA_EROARE=$(echo "$out" | grep -iE "error|✘" | head -3 | tr '\n' ' ')
      echo "      $ULTIMA_EROARE"
    fi
  done
  RAMASE="$URMATOARE"
done

if [ -n "$RAMASE" ]; then
  echo "NEPUBLICATI:$RAMASE"
  exit 1
fi
echo "toti workerii de productie sunt publicati"
