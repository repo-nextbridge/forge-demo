# Certificates of your own for a promoted bench (normally empty)

Leave this folder empty and a bench promoted to a host or an IP (`bash bench/promote.sh 192.168.1.20`) serves
its https doors with its own **local CA**: the first visit from each device shows a certificate warning, which
goes away for good once that device trusts `.forge-bench/ca.crt` (exported by `bench/up.sh`).

Put a certificate here when you would rather no device ever warns — one PEM per file, chain first and private
key after, for the name or IP you promote to:

```bash
mkcert -cert-file c.pem -key-file k.pem 192.168.1.20 && cat c.pem k.pem > bench/certs/bench.pem && rm c.pem k.pem
bash bench/promote.sh 192.168.1.20
```

For a public DNS name, the output of any ACME client works the same way; the bench never calls a public ACME
directory itself. `*.pem` here is git-ignored. Point `FORGE_BENCH_TLS_CERT_DIR` (in `bench/bench.env` or the
shell) somewhere else to keep them outside this repository. Production's `FORGE_TLS_CERT_DIR` (`caddy/certs`)
is a different folder, for a different edge, and the bench never reads it.
