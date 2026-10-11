#!/usr/bin/env bash
# THE BENCH'S MAILBOX, from the terminal — the newest messages, and the login code in the newest one.
#
#   bash bench/mail.sh                              the newest messages to anyone
#   bash bench/mail.sh operator@bench.example.test  the newest message to that address, and its code
#
# The same messages are in the mailbox's web face (the `mailbox` door `bench/up.sh` prints). Nothing a bench
# sends leaves this machine: the kernel's mail goes to this mailbox and the mailbox relays to nobody.
set -euo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
bench_load_declarations
bench_ports
command -v jq >/dev/null 2>&1 || bench_die '`jq` is required.'
api="http://127.0.0.1:$FORGE_MAIL_HTTP_PORT/api/v1"
to="${1:-}"
if [ -n "$to" ]; then
  list="$(curl -fsS -G "$api/search" --data-urlencode "query=to:$to" --data-urlencode 'limit=5' 2>/dev/null)"
else
  list="$(curl -fsS "$api/messages?limit=5" 2>/dev/null)"
fi || bench_die "the mailbox does not answer on $api — is the bench up (bash bench/up.sh)?"
echo "$list" | jq -r '.messages[] | "\(.Created)  \(.To[0].Address)  \(.Subject)"'
[ -n "$to" ] || exit 0
id="$(echo "$list" | jq -r '.messages[0].ID // empty')"
[ -n "$id" ] || bench_die "no message to $to yet."
code="$(curl -fsS "$api/message/$id" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1 || true)"
[ -n "$code" ] && echo "code: $code" || echo "(no six-digit code in the newest message to $to)"
