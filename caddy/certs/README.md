# Provided certificates (normally empty)

Leave this folder empty and Caddy issues its own certificates from Let's Encrypt, which is what you want in
almost every case.

Put a certificate here when a CDN sits in front of this box in **full-strict** mode: the CDN terminates TLS,
so the ACME challenge never reaches you and automatic renewal cannot work — the certificate simply expires
about 90 days after it was issued. The CDN gives you an **Origin Certificate** for exactly this. Write it as
one file, chain first and private key after:

```bash
cat origin.crt origin.key > caddy/certs/origin.pem
docker compose restart caddy
```

Caddy then serves that certificate for the hostnames inside it and issues its own for anything else. Point
`FORGE_TLS_CERT_DIR` (in `.env`) somewhere else if you prefer to keep certificates outside this directory.
