// ★★ EVERY CONTAINER OF THIS BOX ANSWERS "AM I UP?" — and the one that did not was the EDGE.
//
//   node --test bin/container-health.guard.mjs        (or: bash bin/test.sh)
//
// ── THE DEFECT, MEASURED 2026-09-05 ON THE LIVE BENCH (C6) ────────────────────────────────────────────────
//
//     forge-preseed-caddy-1              Up About a minute                <- the edge
//     forge-preseed-checkout-1           Up About a minute (healthy)
//     forge-preseed-admin-1              Up About a minute (healthy)
//     forge-preseed-storefront-1         Up About a minute (healthy)
//     forge-preseed-storefront-coffee-1  Up About a minute (healthy)
//     forge-preseed-totem-1              Up About a minute (healthy)
//     forge-preseed-kernel-1             Up About a minute (healthy)
//     forge-preseed-postgres-1           Up 34 minutes (healthy)
//     forge-preseed-redis-1              Up 34 minutes (healthy)
//
// Eight of nine, and `docker inspect forge-preseed-caddy-1 --format '{{json .Config.Healthcheck}}'` answered
// `null`. The edge was serving everything at that moment — every one of those eight was reached THROUGH it.
//
// ★ WHY A MISSING PROBE IS WORSE THAN A FAILING ONE. An operator's first move is `docker ps`, and a column
// where one row is permanently blank teaches them to read that row as "unknown, probably fine". On the day
// the edge really is down the row says exactly the same thing it said on every other day, so the one signal
// that would have named the outage is the one signal nobody looks at any more.
//
// ── THE RULE THIS FILE ENFORCES, AND IT IS DERIVED RATHER THAN A LIST ─────────────────────────────────────
//
// A service's probe comes from ONE of three places, decided by where its image comes from:
//
//   1. `image: ${FORGE_...}`   a Forge RELEASE image. The product declares `HEALTHCHECK` inside it (measured:
//                              the kernel's is `fetch(.../health)`), and this repository must not restate it.
//   2. `build:` in this repo   OUR image. The `HEALTHCHECK` belongs in the Dockerfile, so it travels with the
//                              image wherever it runs — the totem and the coffee vitrine already do this.
//   3. anything else           a THIRD-PARTY tag (`postgres:18`, `redis:7`, `caddy:2`). Nobody upstream put a
//                              probe in it, so compose is the only place one can be declared. postgres and
//                              redis always had theirs; `caddy:2` is the one that did not.
//
// ⚠️ IT IS NOT A NAMED LIST OF SERVICES, on purpose. The next third-party container somebody adds to this box
// is caught the first time this runs, which is the half a hand-written list cannot do.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE_FILES = ['compose.yml', 'compose.override.yml'];

/**
 * The `services:` block of a compose file, as { name: { file, lines[], keys:Set } }.
 *
 * ⚠️ A HAND-ROLLED READER, AND THE REASON IS THAT THIS REPOSITORY HAS NO PACKAGE MANAGER — it is a box's
 * configuration, not a library (see bin/test.sh), so there is no YAML parser to import and adding one would
 * be a dependency tree for four regexes. It is deliberately NARROW: two-space service keys, four-space
 * property keys, which is the shape both files are written in. `assertReaderSees` below is what stops that
 * narrowness from turning into a silent green.
 */
function servicesOf(file) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
  const out = new Map();
  let inServices = false;
  let current = null;
  for (const line of lines) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    if (!inServices) continue;
    // A top-level key at column 0 ends the services block (`volumes:`, `networks:`).
    if (/^\S/.test(line)) {
      inServices = false;
      current = null;
      continue;
    }
    const service = /^ {2}([a-z0-9][a-z0-9._-]*):\s*$/.exec(line);
    if (service) {
      current = { name: service[1], file, keys: new Set(), body: [] };
      out.set(current.name, current);
      continue;
    }
    if (!current) continue;
    const key = /^ {4}([a-z0-9_]+):/.exec(line);
    if (key) current.keys.add(key[1]);
    current.body.push(line);
  }
  return out;
}

/** The two files merged the way compose merges them: the override ADDS keys to a service it names again. */
function allServices() {
  const merged = new Map();
  for (const file of COMPOSE_FILES) {
    for (const [name, svc] of servicesOf(file)) {
      const hit = merged.get(name);
      if (!hit) {
        merged.set(name, { name, files: [file], keys: new Set(svc.keys), body: [...svc.body] });
        continue;
      }
      hit.files.push(file);
      for (const k of svc.keys) hit.keys.add(k);
      hit.body.push(...svc.body);
    }
  }
  return merged;
}

/** The `image:` value of a service, or null. */
function imageOf(svc) {
  const hit = svc.body.find((l) => /^ {4}image:/.test(l));
  return hit ? hit.replace(/^ {4}image:\s*/, '').trim() : null;
}

/** The Dockerfile a `build:` block points at, as a repo-relative path, or null. */
function dockerfileOf(svc) {
  const at = svc.body.findIndex((l) => /^ {4}build:/.test(l));
  if (at < 0) return null;
  for (let i = at + 1; i < svc.body.length; i += 1) {
    if (/^ {4}\S/.test(svc.body[i])) break;
    const ctx = /^ {6}context:\s*(\S+)/.exec(svc.body[i]);
    if (ctx) return join(ctx[1], 'Dockerfile');
  }
  return null;
}

const SERVICES = allServices();

// ── 0 · THE READER SEES SOMETHING — a guard pointed at nothing must accuse ITSELF ─────────────────────────

test('★★ the reader actually found this box\'s services, in both files', () => {
  // Without this, every assertion below is vacuously true the day the indentation changes or a file is
  // renamed: `for (const x of [])` is green, and green is the one answer that must not be free here.
  assert.ok(
    SERVICES.size >= 8,
    `the compose reader found ${SERVICES.size} service(s). Both files are supposed to declare them; a low ` +
      'count means the reader stopped seeing them, not that the box shrank.',
  );
  for (const name of ['postgres', 'redis', 'caddy', 'kernel', 'totem', 'storefront-coffee']) {
    assert.ok(SERVICES.has(name), `the reader never saw the \`${name}\` service — its scan is broken.`);
  }
  // And it can tell the three classes apart. One example of each has to exist, or the rule below grades
  // nothing.
  const images = [...SERVICES.values()].map(imageOf);
  assert.ok(images.some((i) => i?.startsWith('${FORGE_')), 'no Forge release image found — class 1 is empty');
  assert.ok([...SERVICES.values()].some(dockerfileOf), 'no service built here — class 2 is empty');
  assert.ok(images.some((i) => i && /^[a-z]/.test(i)), 'no third-party image found — class 3 is empty');
});

// ── 1 · A THIRD-PARTY CONTAINER GETS ITS PROBE FROM COMPOSE, BECAUSE NOWHERE ELSE CAN GIVE IT ONE ─────────

test('★★ every third-party image declares a healthcheck in compose — this is the one caddy failed', () => {
  const naked = [];
  for (const svc of SERVICES.values()) {
    const image = imageOf(svc);
    // Class 1 and 2 are somebody's Dockerfile, checked below. Only a literal upstream tag lands here.
    if (!image || image.startsWith('${FORGE_') || dockerfileOf(svc)) continue;
    if (!svc.keys.has('healthcheck')) naked.push(`${svc.name} (${image}) in ${svc.files.join(' + ')}`);
  }
  assert.deepEqual(
    naked,
    [],
    'these containers come from an upstream image that carries no HEALTHCHECK, and this box declares none ' +
      'either — so `docker ps` shows them with a permanently blank health column, whether they are serving ' +
      `or dead:\n  ${naked.join('\n  ')}`,
  );
});

test('★ and the edge\'s probe asks about the EDGE, not about what is behind it', () => {
  // A reverse proxy answering for its upstreams would go red when the kernel restarts — naming the wrong
  // container, which is the same wrong errand as a blank column, just louder. What it may assert is its own
  // listener: `caddy run` binds :80 only after the Caddyfile loaded, and a Caddyfile it cannot load makes the
  // process exit rather than serve. Measured inside the running container 2026-09-05: `nc -z 127.0.0.1 80`
  // → 0, while `nc -z 127.0.0.1 443` → 1 (the bench Caddyfile is HTTP-only), which is why the probe names
  // the one port both the bench and a deployment bind.
  const caddy = SERVICES.get('caddy');
  assert.ok(caddy, 'there is no `caddy` service any more — this test is measuring a box that changed');
  const probe = caddy.body.filter((l) => /^ {6}test:/.test(l)).join('\n');
  assert.ok(probe, 'the caddy healthcheck declares no `test:` — an interval with nothing to run is decoration');
  assert.ok(
    !/kernel|storefront|checkout|admin:3000|totem:3000/.test(probe),
    `the edge's probe reaches a container behind it, so the edge goes red for somebody else's outage:\n${probe}`,
  );
  assert.ok(/\b80\b/.test(probe), `the probe never names the port the edge binds in every mode:\n${probe}`);
});

// ── 2 · AN IMAGE BUILT HERE CARRIES ITS PROBE INSIDE, so it is true wherever the image runs ───────────────

test('every image this repository builds declares HEALTHCHECK in its own Dockerfile', () => {
  const checked = [];
  const naked = [];
  for (const svc of SERVICES.values()) {
    const dockerfile = dockerfileOf(svc);
    if (!dockerfile) continue;
    assert.ok(existsSync(join(ROOT, dockerfile)), `${svc.name} builds from ${dockerfile}, which does not exist`);
    checked.push(dockerfile);
    if (!/^HEALTHCHECK\b/m.test(readFileSync(join(ROOT, dockerfile), 'utf8'))) naked.push(dockerfile);
  }
  assert.ok(checked.length >= 2, `only ${checked.length} Dockerfile(s) reached — the build scan stopped seeing them`);
  assert.deepEqual(
    naked,
    [],
    `these Dockerfiles build a long-running server with no HEALTHCHECK:\n  ${naked.join('\n  ')}`,
  );
});
