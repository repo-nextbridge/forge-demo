# The counter's totem, as an image compose can start.
#
# THIN ON PURPOSE, exactly like `storefront-coffee/Dockerfile`: it copies the `.next/standalone` output the
# build already produced instead of rebuilding inside the container. Two reasons, and neither is speed alone:
#   - the build that ships is the build that was tested, byte for byte — not a second one that ran elsewhere;
#   - a container that rebuilds needs the whole toolchain and the registry credentials inside it.
#
# So the order is: build first, then image — and `bin/build-totem.sh` is the other half of that bargain.
#
#   bash bin/build-totem.sh <path to the forge monorepo checkout>

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
# ⚠️ THE ENTRY IS AT THE ROOT OF `standalone/`, NOT UNDER A SUBDIRECTORY, and that is worth knowing before it
# surprises somebody: `next.config.mjs` sets `outputFileTracingRoot` to the REPOSITORY root (the demo gate's
# real path is one directory up from this app), and Next mirrors the path from that root into the output. So
# the server lands at `standalone/totem/server.js` and the workspace's node_modules beside it.
COPY .next/standalone ./
COPY .next/static ./totem/.next/static

EXPOSE 3000

# Liveness, graded on the SERVER'S HALF of the status: 5xx is unhealthy, everything below it is an answer. This
# never depends on the store being reachable — a counter whose kernel is briefly down is still a running
# process, and restarting it would not help, so the probe never asks about anything but this server.
#
# ⚠️ NOT `r.ok`: a bare "/" is routed by the app itself and a 404 there is a legitimate answer from a server
# that is up (measured 2026-09-09 on the sibling fork), so `r.ok` would paint a healthy container red.
#
# ⚠️ AND NOT `.then(() => exit(0))`, which is what this line used to be. Discarding the response makes `then`
# resolve for 200, 404 and 500 alike, so the ONLY way the container could ever go unhealthy was a refused
# connection — measured on the bench, the sibling fork reported itself healthy for 15 hours while it answered
# 500 to every request, its own probe included. `bin/container-health.guard.mjs` now RUNS this line.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "totem/server.js"]
