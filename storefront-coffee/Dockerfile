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
COPY .next/standalone ./
COPY .next/static ./.next/static

# ★ YOUR OWN STATIC FILES. The tracer does NOT copy `public/` for you — a standalone build traces the modules
# the server reaches, and a file nothing imports is reached by nobody. So it is copied explicitly, and the
# directory ships with the cut (`public/assets/`) so this line never fails on a fresh clone.
#
# ⚠️ PUT THEM UNDER `public/assets/`, NOT AT THE ROOT OF `public/`. Both end up in the image; only one is
# reachable. `src/middleware.ts` rewrites a bare path into the store tree (`/logo.png` -> `/s/<store>/logo.png`),
# where no such file exists, and the asset 404s with the file sitting right here in the image. `assets/` is
# excluded from that rewrite; nothing else in `public/` is.
COPY public ./public

EXPOSE 3000

# Liveness only: any HTTP response means the server is up (a bare "/" without a matching Host resolves to a
# clean 404, which is still a response). This never depends on host->store config being present.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
