# Your storefront, as an image your compose.yml can pin.
#
# THIN ON PURPOSE: it copies the `.next/standalone` output your build already produced instead of rebuilding
# inside the container. Two reasons, and neither is speed alone:
#   - the build that ships is the build you tested, byte for byte — not a second one that ran somewhere else;
#   - a container that rebuilds needs your whole toolchain and your registry credentials inside it.
#
# So the order is: build first, then image.
#
#   FORGE_BUILD_STANDALONE=1 npm run build
#   docker build -t my-storefront:1 .
#
# `output: 'standalone'` (gated behind that env var in next.config.mjs) emits a minimal server plus only the
# dependencies actually reached, which is why no node_modules is copied here.

FROM node:24-slim

ENV NODE_ENV=production
ENV PORT=3000
# Bind ALL interfaces (incl. loopback). The Next standalone server listens on `process.env.HOSTNAME || '0.0.0.0'`
# — and Docker ALWAYS injects HOSTNAME=<container-id>, so without this it would bind ONLY the container's IP and
# the loopback healthcheck would ECONNREFUSED (the app still served via the network, but showed "unhealthy").
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# The standalone server and its traced dependencies. `.next/static` is emitted separately and must sit next to
# it.
#
# ⚠️ ★★ pk35/d3 — THE ENTRY IS UNDER `storefront-coffee/`, NOT AT THE ROOT OF `standalone/`, and the reason is
# one directory up. This front imports an app THIS BOX wrote (`@forge/ext-demo-setup`, installed from
# `file:../apps/demo-setup`), and the standalone tracer never copies a file from above its root — so
# `next.config.mjs` sets `outputFileTracingRoot` to the REPOSITORY root, and Next mirrors the path from that
# root into the output. `totem/Dockerfile` carries the same three lines for the same app and the same reason.
COPY .next/standalone ./
COPY .next/static ./storefront-coffee/.next/static

# ★ YOUR OWN STATIC FILES. The tracer does NOT copy `public/` for you — a standalone build traces the modules
# the server reaches, and a file nothing imports is reached by nobody. So it is copied explicitly, and the
# directory ships with the cut (`public/assets/`) so this line never fails on a fresh clone.
#
# ⚠️ PUT THEM UNDER `public/assets/`, NOT AT THE ROOT OF `public/`. Both end up in the image; only one is
# reachable. `src/middleware.ts` rewrites a bare path into the store tree (`/logo.png` -> `/s/<store>/logo.png`),
# where no such file exists, and the asset 404s with the file sitting right here in the image. `assets/` is
# excluded from that rewrite; nothing else in `public/` is.
COPY public ./storefront-coffee/public

EXPOSE 3000

# Liveness, graded on the SERVER'S HALF of the status: 5xx is unhealthy, everything below it is an answer.
# This never depends on host->store config being present.
#
# ⚠️ NOT `r.ok`, and that is a measurement rather than a preference: a bare "/" carrying a Host no store claims
# resolves to a clean 404 (measured 2026-09-09 on the live bench: `Host: cafe.localhost` -> 404), so `r.ok`
# would paint a perfectly healthy container red forever.
#
# ⚠️ AND NOT `.then(() => exit(0))`, which is what this line used to be. Discarding the response makes `then`
# resolve for 200, 404 and 500 alike, so the ONLY way the container could ever go unhealthy was a refused
# connection. Measured: `forge-preseed-storefront-coffee-1` sat at `health=healthy`, `FailingStreak=0`, for 15
# hours while its middleware threw on every request — 118 stack traces in 20 min, one per `--interval`, because
# this probe was both the traffic producing the error and the authority calling the container healthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "storefront-coffee/server.js"]
