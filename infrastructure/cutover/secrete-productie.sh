#!/bin/sh
# Pune secretele mediului de PRODUCTIE. Nimic nu se tipareste: valorile intra prin stdin.
#
#   sh infrastructure/cutover/secrete-productie.sh /tmp/emisie-v1.env
#
# - SECRET_INTERN: se GENEREAZA nou (nu se poate citi inapoi de la Cloudflare) si se pune pe toti
#   workerii cu `/_actiuni` deodata — altfel chatul primeste 404 de la jumatate din aplicatii.
# - Emisia (WHIP/SFU/APARAT): aceleasi ca in V1, hotarat anume, ca aparatul din biserica sa aiba
#   de schimbat doar adresa la cutover. Vin din fisierul dat ca argument.
# - AI_GATEWAY_TOKEN: din `.dev.vars`-ul chatului.
set -e
cd "$(dirname "$0")/../.."
set -a; . /backup/_setup/cloudflare.env; set +a

EMISIE="${1:-/tmp/emisie-v1.env}"
# ⚠️ LISTA ASTA CREȘTE ODATĂ CU APLICAȚIILE. `apps/buletin` a intrat pe 18.09.2026 și a lipsit
# de aici o zi: bula lui trimitea antetul gol, chat-worker răspundea `Not Found`, iar omul citea
# „Nu am putut trimite mesajul". Când o aplicație capătă bulă sau `/_actiuni`, se scrie AICI.
CU_ACTIUNI="apps/calendar apps/program apps/tipic apps/buletin services/chat-worker"

pune() { # pune <config> <nume>  (valoarea vine pe stdin)
  printf '%-30s %-18s ' "$1" "$2"
  npx wrangler secret put "$2" --env production -c "$1/wrangler.jsonc" >/dev/null 2>&1 && echo pus || { echo ESUAT; exit 1; }
}

INTERN=$(openssl rand -hex 24)
for p in $CU_ACTIUNI; do
  printf '%s' "$INTERN" | pune "$p" SECRET_INTERN
done
unset INTERN

if [ -f "$EMISIE" ]; then
  for n in WHIP_SECRET SFU_APP_ID SFU_APP_SECRET APARAT_SECRET; do
    grep "^$n=" "$EMISIE" | sed "s/^$n=//" | tr -d '\n' | pune apps/live "$n"
  done
else
  echo "lipseste $EMISIE — secretele emisiei raman nepuse"
fi

if [ -f services/chat-worker/.dev.vars ]; then
  grep '^AI_GATEWAY_TOKEN=' services/chat-worker/.dev.vars | sed 's/^AI_GATEWAY_TOKEN=//' | tr -d '\n' \
    | pune services/chat-worker AI_GATEWAY_TOKEN
fi

echo 'gata'
