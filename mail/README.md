# The bench's mail collector — and why a certificate is committed next to it

`compose.yml` declares a `mailpit` service under the **`bench-mailbox`** compose profile. A profile is not a
comment: a service that carries one is not created by `docker compose up` unless the profile is asked for, so
a DEPLOYMENT of this repository starts no collector and keeps the real SMTP it is configured with. The one
thing that asks for it is `FORGE_BENCH_MAILBOX` in `.env`, read by `env-source.sh` — see the block there.

## Why the box needs one at all

The kernel runs `NODE_ENV=production` on this box (compose.yml), and the mail transport that PRINTS a message
to the terminal is constructible only under `!production` — deliberately, by construction, in
`apps/api/src/smtp-channel-driver.ts`. So a production box with no mail configured does not "log the code":
every message FAILS BY NAME and nobody can log in. Until this service existed, the only mailbox this box had
was the real Resend account, whose only deliverable address is the owner's own — which is why an executor
could not log in as a shopper, and why `pk34/p1` stopped rather than fake it.

## Why the collector has to speak TLS, measured rather than assumed

The driver builds its transport as `{ host, port, secure: port === 465, requireTLS: !secure, auth }`. With
`requireTLS`, nodemailer sends `STARTTLS` **whether or not the server advertises it** and refuses to deliver
if the upgrade fails. Measured against nodemailer 9.0.3 (the version the pinned kernel image carries) on
2026-09-14:

```
collector with no TLS (mailpit's default)      FAILED ETLS    Error upgrading connection with STARTTLS: 502 5.5.1 Not implemented
collector with a self-signed cert, untrusted   FAILED ESOCKET self-signed certificate
collector with that cert + NODE_EXTRA_CA_CERTS DELIVERED      250 2.0.0 Ok: queued as 4buOsS0VvGnpRYlIONi6Ei
```

⇒ two halves, and neither works alone: mailpit is started with `--smtp-tls-cert/--smtp-tls-key` so it offers
STARTTLS, and the kernel is handed `NODE_EXTRA_CA_CERTS` pointing at the SAME certificate so the handshake it
is forced into can succeed. `--smtp-auth-accept-any --smtp-auth-allow-insecure` is the other half of the
driver's contract: it always sends `AUTH`, because the four variables travel together and one of them is a
password.

## ⛔ The key in this folder is NOT a secret, and committing it is the decision

`bench-collector.crt` / `bench-collector.key` are a self-signed pair for the hostname `mailpit`, a container
that exists only inside a bench's own compose network and that receives mail nobody sends anywhere. It
authenticates a throwaway collector to a kernel sitting beside it; it signs nothing, it encrypts nothing that
leaves the box, and it is trusted by exactly one process that this repository also configures.

The alternative was minting it at birth. It was refused for the reason this whole wave exists: a birth step a
human can forget is a birth that snags, and a compose file whose mounted file may or may not be there starts
a container that exits. A committed pair makes `docker compose --profile bench-mailbox up -d` work on a
machine that has never run anything else. It is dated 100 years out so it cannot expire into a mystery.

⚠️ It is therefore **the one PEM this repository commits**, and it stays that way. A certificate for anything
that faces a network — the edge's TLS, a customer's domain — belongs in `FORGE_TLS_CERT_DIR`, which is
gitignored, or in the secret store `env-source.sh` reads. `bin/bench-mailbox.guard.mjs` holds that line.

## Reading the mail

The web face is on `http://127.0.0.1:<FORGE_MAIL_HTTP_PORT>` (8204 by default, bound to
`FORGE_BENCH_BIND` like every other door of this box). The login code is in the message body.
