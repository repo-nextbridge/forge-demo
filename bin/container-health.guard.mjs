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

// ── 3 · pk28/D2 — AND THE PULSE HAS TO BE ABLE TO SAY NO ──────────────────────────────────────────────────
//
// Everything above asks whether a container HAS a probe. Until 2026-09-09 nothing asked whether that probe
// could ever answer NO, and both of this repository's probes could not:
//
//     fetch(url).then(() => process.exit(0))    <- the response is DISCARDED. `then` resolves for 200, for
//                                                  404 and for 500 alike; only a REFUSED CONNECTION is red.
//
// ★★ MEASURED ON THIS BOX, not reasoned. `forge-preseed-storefront-coffee-1` — the image built from
// `storefront-coffee/Dockerfile` — sat at `health=healthy`, `FailingStreak=0`, for 15 hours while its Next
// middleware threw `TypeError: (0 , i.isServerActionSubmission) is not a function` on the probe's own request:
// 118 stack traces in 20 min, one every ~10.2 s, which is this probe's `--interval` to the second. Measured
// the same day with the probe's exact Host (`curl -H 'Host: 127.0.0.1:3000' http://<container-ip>:3000/`):
// **HTTP 500**, and the counter went up by one per call. So the healthcheck was the traffic PRODUCING the
// error and the authority calling the container healthy, and `docker ps` printed `(healthy)` next to a front
// that answered 500 to every request it routed.
//
// ── WHY THE OBVIOUS FIX (`r.ok`) IS WRONG, AND THIS IS THE MEASUREMENT THAT SETTLES IT ────────────────────
//
// `r.ok` is 200–299. Measured 2026-09-09 against the two live containers of this box, a bare `/` with a Host
// no store claims answers **404** (`Host: 172.24.0.8` and `Host: cafe.localhost` -> 404 on the coffee front),
// and the shipped comment beside each probe already argued exactly that ("a bare `/` without a matching Host
// resolves to a clean 404, which is still a response"). The discarded response was therefore a REASONED
// liveness choice — the reasoning just never noticed that it swallowed 5xx along with the 404. Tightening to
// `r.ok` would paint a healthy fork red on every box.
//
// ⇒ THE RULE, DERIVED FROM THE PATH THE PROBE ITSELF FETCHES rather than from a list of images — the same
// derivation the product's `scripts/ci/container-health.guard.test.ts` makes, so the two sides of the fence
// grade the eighth front the same way:
//
//   · a probe of a DEDICATED health endpoint (`/health`)  it exists to answer 200 and nothing else, so `r.ok`
//                                                         is exactly right (this is the kernel's probe, which
//                                                         lives in the product; no Dockerfile HERE has one).
//   · a probe of any OTHER route (`/`)                    the app's own routing decides the status and 404 is
//                                                         a legitimate answer, so the probe grades the
//                                                         SERVER's half — `r.status < 500` — and must NOT use
//                                                         `r.ok`, which is red on a healthy box.
//
// ⚠️ AND THE RULE IS NOT ONLY READ, IT IS RUN. The last test below takes the `node -e` script OUT of each
// Dockerfile and executes it against a local server that answers 200, 404, 500, 503 and nothing at all. A
// static regex can be satisfied by a line that mentions `r.status` and still exits 0 for a 500; only running
// it proves the table. The old line scores 0/5 on it.

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:http';

/** Build output and vendored trees — a copy of a file, never the file. */
const PRUNED = new Set(['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage', 'dataset']);

function walkDockerfiles(dir = ROOT, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (PRUNED.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkDockerfiles(abs, found);
    else if (entry.isFile() && (entry.name === 'Dockerfile' || entry.name.endsWith('.Dockerfile')))
      found.push(abs.slice(ROOT.length + 1));
  }
  return found;
}

const DOCKERFILES = walkDockerfiles().sort();

/** The path a `/health`-style probe asks for is the one graded with `.ok`; everything else is an app route. */
const DEDICATED_HEALTH_PATH = '/health';

/**
 * The command a Dockerfile's HEALTHCHECK runs, with `\` continuations joined, or null when it declares none.
 * PARSED, not grepped: the paragraph above a HEALTHCHECK is prose ABOUT it — the block you are reading names
 * `then(() => process.exit(0))` — and a grep cannot tell the two apart.
 */
function healthcheckCommandOf(source) {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^HEALTHCHECK\b/.test(lines[i])) continue;
    let joined = lines[i];
    while (joined.trimEnd().endsWith('\\') && i + 1 < lines.length) {
      i += 1;
      joined = `${joined.trimEnd().slice(0, -1)}${lines[i].trim()}`;
    }
    const cmd = /\bCMD\b([\s\S]*)$/.exec(joined);
    return cmd ? cmd[1].trim() : '';
  }
  return null;
}

/**
 * The path a `fetch(...)` probe asks for: the last quoted literal inside the call, which is how these are
 * written (`'http://127.0.0.1:'+(process.env.PORT||3000)+'/'`). Null when the command does not fetch at all —
 * `wget`, `nc`, `pg_isready` grade their own exit status and are not this rule's subject.
 */
function fetchedPathOf(command) {
  const call = /fetch\(([\s\S]*)\)\s*\.\s*then\(/.exec(command);
  if (!call) return null;
  const literals = [...call[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  const last = literals.at(-1);
  return last?.startsWith('/') ? last : '/';
}

/** Does the `then` handler BIND the response and use it to choose the exit code? */
function gradesTheResponse(command) {
  const bound = /\.\s*then\(\s*(?:async\s+)?(?:\(\s*([A-Za-z_$][\w$]*)\s*\)|([A-Za-z_$][\w$]*))\s*=>/.exec(
    command,
  );
  const name = bound?.[1] ?? bound?.[2];
  if (!name) return false;
  return new RegExp(`\\b${name}\\s*\\.\\s*(ok|status)\\b`).test(command);
}

/** The script inside `node -e "…"`, so the real line can be EXECUTED rather than only read. */
function nodeScriptOf(command) {
  const hit = /^node\s+(?:--\S+\s+)*-e\s+"([\s\S]*)"\s*$/.exec(command.trim());
  return hit ? hit[1] : null;
}

const FETCH_PROBES = DOCKERFILES.flatMap((file) => {
  const command = healthcheckCommandOf(readFileSync(join(ROOT, file), 'utf8'));
  if (command === null) return [];
  const path = fetchedPathOf(command);
  return path === null ? [] : [{ file, command, path }];
});

test('★★ the probe reader SEES both forks — a scan that finds no probe grades nothing forever', () => {
  // The whole finding is a clause missing from a copied line. A reader that stopped seeing the line would go
  // green on the exact regression it exists to catch, so the set is PINNED: a third Dockerfile, or a rename,
  // forces a decision here instead of slipping past.
  assert.deepEqual(
    DOCKERFILES,
    ['storefront-coffee/Dockerfile', 'totem/Dockerfile'],
    `the Dockerfile walk found ${DOCKERFILES.length} file(s): ${DOCKERFILES.join(', ')}. This box builds two ` +
      'images; a different list means the walk broke or an image arrived unattended.',
  );
  assert.deepEqual(
    FETCH_PROBES.map((p) => p.file),
    ['storefront-coffee/Dockerfile', 'totem/Dockerfile'],
    'the HEALTHCHECK parser extracted no fetch probe from one of the two Dockerfiles — every rule below then ' +
      `grades nothing. Found: ${FETCH_PROBES.map((p) => p.file).join(', ') || '(none)'}`,
  );
  assert.ok(
    FETCH_PROBES.some((p) => p.path !== DEDICATED_HEALTH_PATH),
    'no probe asks an app route — the `do not discard the response` rule grades nothing',
  );
  // ⓘ No Dockerfile HERE probes `/health` (the kernel's does, and the kernel is the product's image), so the
  // `.ok` rule below currently grades ZERO probes. That is stated rather than asserted away: the day one of
  // these forks grows a real health endpoint, the rule is already waiting for it.
});

test('★★ a fetch probe GRADES the response — `then(() => exit(0))` is green for a 500', () => {
  const blind = FETCH_PROBES.filter((probe) => !gradesTheResponse(probe.command)).map(
    (probe) => `${probe.file} (fetches ${probe.path})`,
  );
  assert.deepEqual(
    blind,
    [],
    'these HEALTHCHECKs throw the response away, so `then` resolves for 200, 404 and 500 alike and the only ' +
      'way the container can go unhealthy is a REFUSED CONNECTION. Measured on this box: a front answering ' +
      '500 to every request — its own probe included, one per --interval — reported itself healthy for 15 ' +
      `hours:\n  ${blind.join('\n  ')}`,
  );
});

test('★★ a probe of an APP ROUTE fails on 5xx and survives a 404 — `r.ok` there is red on a healthy box', () => {
  const wrong = FETCH_PROBES.filter((probe) => probe.path !== DEDICATED_HEALTH_PATH)
    .map((probe) => {
      if (/\.\s*ok\b/.test(probe.command))
        return `${probe.file}: grades with \`.ok\`, but ${probe.path} with a Host no store claims answers 404 (measured 2026-09-09 on this box) — that is unhealthy on a healthy container`;
      if (!/\.\s*status\b/.test(probe.command))
        return `${probe.file}: never reads \`.status\`, so nothing decides the exit code`;
      if (!/\b5\d\d\b/.test(probe.command))
        return `${probe.file}: reads \`.status\` but names no 5xx boundary — say which statuses are the SERVER's fault`;
      return null;
    })
    .filter((line) => line !== null);
  assert.deepEqual(
    wrong,
    [],
    `a probe of a route the app itself routes must grade the SERVER's half of the status:\n  ${wrong.join('\n  ')}`,
  );
});

test('★ a probe of a DEDICATED health endpoint asks for 200 — there a 404 is a defect too', () => {
  const wrong = FETCH_PROBES.filter((probe) => probe.path === DEDICATED_HEALTH_PATH)
    .filter((probe) => !/\.\s*ok\b/.test(probe.command))
    .map(
      (probe) =>
        `${probe.file}: ${probe.path} exists to answer 200 and nothing else, so it is graded with \`.ok\` — a 404 there means the route is gone, which is not health`,
    );
  assert.deepEqual(wrong, [], `${wrong.join('\n  ')}`);
});

// ── 4 · AND THE LINE IS RUN, NOT ONLY READ ────────────────────────────────────────────────────────────────

/** An HTTP server on 127.0.0.1 that answers `status` to everything, and the port it took. */
async function serverAnswering(status) {
  const server = createServer((_req, res) => res.writeHead(status).end(''));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

/** A port nothing is listening on: taken, read, released. */
async function deadPort() {
  const { port, close } = await serverAnswering(200);
  await close();
  return port;
}

/**
 * Runs the probe's own script with PORT pointed at a local server, and resolves with its exit code.
 *
 * ⚠️ ASYNC ON PURPOSE, and it cost a red to learn: `spawnSync` BLOCKS this process's event loop, which is the
 * very loop serving the server below — the probe's connection is never accepted, the child is killed at the
 * timeout and reports exit code `null`. A synchronous spawn cannot talk to an in-process server.
 */
function runProbe(script, port) {
  const child = spawn(process.execPath, ['-e', script], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  return new Promise((resolve) => {
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

test('★★ the probe, EXECUTED: 200 -> 0 · 404 -> 0 · 500 -> 1 · 503 -> 1 · refused -> 1', async () => {
  // ⚠️ THE ONE TEST A REGEX CANNOT REPLACE. A line that merely MENTIONS `r.status` still exits 0 for a 500 if
  // the comparison is backwards, and that mistake reads as a fix. So the script is lifted out of the
  // Dockerfile and run against a server that answers each status in the table.
  const dead = await deadPort();
  for (const probe of FETCH_PROBES) {
    const script = nodeScriptOf(probe.command);
    assert.ok(
      script,
      `${probe.file}: its HEALTHCHECK is not a \`node -e "…"\` command, so this test cannot run it. Either ` +
        `write it that way or teach this extractor the new shape — do not leave the probe ungraded:\n  ${probe.command}`,
    );
    for (const [status, expected] of [
      [200, 0],
      [404, 0],
      [500, 1],
      [503, 1],
    ]) {
      const server = await serverAnswering(status);
      const code = await runProbe(script, server.port);
      await server.close();
      assert.equal(
        code,
        expected,
        `${probe.file}: its healthcheck exited ${code} against HTTP ${status}, and docker reads that exit ` +
          `code as ${code === 0 ? 'HEALTHY' : 'unhealthy'}. Expected ${expected}. ` +
          (status >= 500
            ? 'A 5xx is the SERVER failing; a probe that exits 0 there can never report a dead container.'
            : `A ${status} is an answer — the server is up and routed the request. A probe that exits 1 there paints a healthy box red.`),
      );
    }
    assert.equal(
      await runProbe(script, dead),
      1,
      `${probe.file}: its healthcheck did not exit 1 against a REFUSED connection — the one case the old ` +
        'blind probe did get right.',
    );
  }
});
