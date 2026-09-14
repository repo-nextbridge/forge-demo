// ★★★ THIS BENCH HAS A MAILBOX A HUMAN CAN READ — and the rule is derived from what `env-source.sh` really
// exports, never from a list of service names written here.
//
//   node --test bin/bench-mailbox.guard.mjs        (or: bash bin/test.sh)
//
// ── THE DEFECT, MEASURED ON BOTH BENCHES 2026-09-13 ──────────────────────────────────────────────────────
//
//     docker ps -a            forge-preseed · k8-midia → ZERO mail containers
//     docker inspect kernel   FORGE_SMTP_HOST=smtp.resend.com, FORGE_SMTP_FROM=hi@forgecommerce.pro
//
// So the only deliverable address this box had was the owner's own (it is in the dataset), and NOBODY ELSE
// COULD LOG IN — not as a shopper, not as an operator. `pk34/p1` stopped on exactly that and refused to
// derive a code from `code_hash`, which was right: the box was not measurable, and pretending otherwise is
// the disease this house is named after.
//
// ⚠️ AND THE ESCAPE A DEVELOPER EXPECTS DOES NOT EXIST HERE. The transport that PRINTS the code to a terminal
// is constructible only under `!production` (apps/api/src/smtp-channel-driver.ts, deliberately) and this
// compose declares `NODE_ENV: production` — which is the subject of `bin/dev-mail-promise.guard.mjs` next
// door. That guard forbids the false PROMISE of a terminal inbox; this one requires a REAL inbox to exist.
// Neither one's red means the other's subject moved.
//
// ── THE RULE, AND WHY IT IS NOT "compose declares a service called mailpit" ──────────────────────────────
//
// The question a bench actually has is «where does the login code go, and can I open it». That is two facts
// this repository owns in two files, and a guard that named the service would be green on the day they stop
// agreeing. So it RUNS `env-source.sh` in a box of its own making — the technique
// `bin/purge-secret-one-home.guard.mjs` already uses, for the same reason: the verdict must not depend on
// the laptop — and asks compose about the host that run actually exported.
//
//   · with the bench mailbox DECLARED  → the exported `FORGE_SMTP_HOST` is a service compose declares, that
//     service is behind the compose PROFILE the same run exported, and the kernel is handed a trust anchor
//     that is one of the files that service presents;
//   · with it NOT declared             → nothing points at a collector and no profile is asked for, so an
//     INSTANCE of this repository keeps the real provider. The distinction is declared, not accidental.
//
// ── WHY TLS IS PART OF THE RULE, MEASURED RATHER THAN ASSUMED ────────────────────────────────────────────
//
// The kernel builds its transport as `{ secure: port === 465, requireTLS: !secure }`, and nodemailer sends
// `STARTTLS` WHETHER OR NOT the server advertises it, then refuses to deliver when the upgrade fails.
// Measured 2026-09-14 against nodemailer 9.0.3, the version the pinned image carries:
//
//     collector with no TLS (mailpit's default)       FAILED   ETLS    «502 5.5.1 Not implemented»
//     collector with a self-signed cert, untrusted     FAILED   ESOCKET «self-signed certificate»
//     the same cert + NODE_EXTRA_CA_CERTS              DELIVERED        «250 2.0.0 Ok: queued»
//
// ⇒ a collector that offers no certificate, or a certificate the kernel is not told to trust, is a container
// that runs and receives NOTHING. Both halves are therefore rules, and a box that half-configures them is
// exactly as unloginable as a box with no collector at all — with a green `docker ps` on top.

import { execFile } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'env-source.sh');
const COMPOSE = join(ROOT, 'compose.yml');
const run_ = promisify(execFile);

/** The two secrets `env-source.sh` refuses to continue without, so a fixture is a box that can be sourced. */
const BASE_SECRETS = ['forge-postgres-password=pw', 'forge-vault-key=vk'];

/** What this guard asks a sourced box about. Not a list of RULES — a list of the variables whose VALUES the
 *  rules are derived from, which is the difference between reading the box and describing it. */
const ASKED = [
  'FORGE_SMTP_HOST',
  'FORGE_SMTP_PORT',
  'FORGE_SMTP_USER',
  'FORGE_SMTP_PASS',
  'FORGE_SMTP_FROM',
  'FORGE_MAIL_CA',
  'COMPOSE_PROFILES',
];

/**
 * Source `env-source.sh` in a box of our own making and report what it exported.
 *
 * The file resolves `.env` and `.secrets` from its OWN directory (`BASH_SOURCE`), so a copy in a temp dir is
 * a whole box and no environment of this machine reaches it.
 */
async function sourced({ env = [], secrets = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-bench-mailbox-'));
  try {
    copyFileSync(SOURCE, join(dir, 'env-source.sh'));
    writeFileSync(join(dir, '.env'), `${env.join('\n')}\n`);
    writeFileSync(join(dir, '.secrets'), `${[...BASE_SECRETS, ...secrets].join('\n')}\n`);
    const script = ASKED.map((name) => `printf '%s=%s\\n' ${name} "\${${name}-<unset>}"`).join('; ');
    const { stdout, stderr } = await run_('bash', ['-c', `source ./env-source.sh >/dev/null; ${script}`], {
      cwd: dir,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: dir },
    });
    const out = new Map();
    for (const line of stdout.split('\n')) {
      const at = line.indexOf('=');
      if (at > 0) out.set(line.slice(0, at), line.slice(at + 1));
    }
    return { env: out, stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── the compose reader ───────────────────────────────────────────────────────────────────────────────────

/**
 * The `services:` block of `compose.yml` as { name: { keys:Set, body:[lines] } }.
 *
 * ⚠️ A HAND-ROLLED READER, for the reason `bin/container-health.guard.mjs` states beside its twin: this
 * repository has no package manager, so there is no YAML parser to import. It is narrow on purpose —
 * two-space service keys, four-space properties — and the anti-vacuum test below is what stops that
 * narrowness from becoming a silent green.
 */
function services() {
  const out = new Map();
  let inServices = false;
  let current = null;
  for (const line of readFileSync(COMPOSE, 'utf8').split('\n')) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    if (!inServices) continue;
    if (/^\S/.test(line)) {
      inServices = false;
      current = null;
      continue;
    }
    const service = /^ {2}([a-z0-9][a-z0-9._-]*):\s*$/.exec(line);
    if (service) {
      current = { name: service[1], keys: new Set(), body: [] };
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

/** The `<host path>:<container path>` bind mounts a service declares, as [{ from, to }]. */
function mounts(service) {
  const at = service.body.findIndex((l) => /^ {4}volumes:/.test(l));
  if (at < 0) return [];
  const out = [];
  for (let i = at + 1; i < service.body.length; i += 1) {
    if (/^ {4}\S/.test(service.body[i])) break;
    const entry = /^ {6}- (.+?)\s*$/.exec(service.body[i]);
    if (!entry) continue;
    const parts = entry[1].replace(/^['"]|['"]$/g, '').split(':');
    if (parts.length >= 2 && parts[0].startsWith('.')) out.push({ from: parts[0], to: parts[1] });
  }
  return out;
}

/** What a service's `environment:` block sets `name` to, verbatim (`${VAR:-}` included), or null. */
function environmentOf(service, name) {
  const hit = service.body.find((l) => new RegExp(`^ {6}${name}:`).test(l));
  return hit ? hit.slice(hit.indexOf(':') + 1).trim() : null;
}

/** The compose profiles a service is behind. Empty ⇒ it starts with every `docker compose up`. */
function profilesOf(service) {
  const inline = service.body.find((l) => /^ {4}profiles:\s*\[/.test(l));
  if (inline) return [...inline.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);
  const at = service.body.findIndex((l) => /^ {4}profiles:\s*$/.test(l));
  if (at < 0) return [];
  const out = [];
  for (let i = at + 1; i < service.body.length; i += 1) {
    const entry = /^ {6}- ['"]?([^'"\s]+)['"]?\s*$/.exec(service.body[i]);
    if (!entry) break;
    out.push(entry[1]);
  }
  return out;
}

const SERVICES = services();
/** A box that declares the bench mailbox, and one that does not. Every rule below reads one of the two. */
const ON = await sourced({ env: ['FORGE_BENCH_MAILBOX=1'] });
const OFF = await sourced({ env: ['FORGE_BENCH_MAILBOX='], secrets: ['forge-smtp-pass=resend-key'] });

// ── 0 · ANTI-VACUUM — the two readers see something, and they see DIFFERENT things ────────────────────────

test('★★ the compose reader found this box\'s services, and the sourced box answered', () => {
  assert.ok(
    SERVICES.size >= 8,
    `the compose reader found ${SERVICES.size} service(s) in compose.yml. Every rule below asks it a ` +
      'question; a reader that stopped seeing services answers all of them with silence.',
  );
  for (const name of ['kernel', 'postgres', 'caddy']) {
    assert.ok(SERVICES.has(name), `the reader never saw the \`${name}\` service — its scan is broken`);
  }
  for (const name of ASKED) {
    assert.ok(ON.env.has(name), `sourcing env-source.sh reported nothing for ${name} — the fixture is broken`);
  }
});

test('★★ the switch actually SWITCHES — a guard whose two fixtures agree is grading nothing', () => {
  // ⛔ THE VACUUM THIS FILE IS MOST EXPOSED TO. If `FORGE_BENCH_MAILBOX` stopped being read, both fixtures
  // would come out identical and every rule below would still pass over one world.
  assert.notEqual(
    ON.env.get('FORGE_SMTP_HOST'),
    OFF.env.get('FORGE_SMTP_HOST'),
    'a box that declares FORGE_BENCH_MAILBOX and a box that does not exported the SAME FORGE_SMTP_HOST ' +
      `(${ON.env.get('FORGE_SMTP_HOST')}). env-source.sh is no longer reading the switch, so this bench ` +
      'either has no collector or is sending real mail — and nothing says which.',
  );
});

// ── 1 · WITH THE COLLECTOR DECLARED, THERE IS SOMETHING ON THIS BOX TO RECEIVE THE CODE ───────────────────

test('★★★ THE RULE — the host the bench mails to is a service this compose declares', () => {
  const host = ON.env.get('FORGE_SMTP_HOST');
  assert.ok(host && host !== '<unset>', 'a box declaring FORGE_BENCH_MAILBOX exported no FORGE_SMTP_HOST');
  assert.ok(
    SERVICES.has(host),
    `env-source.sh points this bench's mail at "${host}" and compose.yml declares no service by that name. ` +
      'Every message the box sends — every OTP — then goes to a hostname nothing here serves, the send ' +
      'fails by name, and NOBODY CAN LOG IN: the bench stops being a place where login by OTP can be ' +
      `measured at all. Declared services: ${[...SERVICES.keys()].join(', ')}.`,
  );
});

test('★★ …and that service is behind the PROFILE the same run asked for, so a DEPLOYMENT never starts it', () => {
  const collector = SERVICES.get(ON.env.get('FORGE_SMTP_HOST'));
  assert.ok(collector, 'the previous rule already failed — this one has no subject');
  const profiles = profilesOf(collector);
  assert.ok(
    profiles.length > 0,
    `the \`${collector.name}\` service carries no \`profiles:\`, so EVERY \`docker compose up\` of this ` +
      'repository creates a mail collector — including an instance deployed for somebody, which would then ' +
      'quietly swallow the mail it is supposed to send. The bench/deployment distinction has to be ' +
      'declared, and a profile is where this file declares it.',
  );
  const asked = (ON.env.get('COMPOSE_PROFILES') ?? '').split(',').filter(Boolean);
  assert.ok(
    profiles.some((p) => asked.includes(p)),
    `\`${collector.name}\` is behind profile(s) [${profiles.join(', ')}] and a box declaring ` +
      `FORGE_BENCH_MAILBOX exports COMPOSE_PROFILES=[${asked.join(', ')}]. The container is therefore never ` +
      'created, while the four FORGE_SMTP_* point at it — a bench that looks configured and swallows every ' +
      'message into a connection refused.',
  );
});

test('★★★ the collector OFFERS a certificate and the kernel is told to TRUST that same file', () => {
  // Both halves or neither: measured above, a collector with no cert dies `ETLS 502` and an untrusted one
  // dies `ESOCKET self-signed certificate`. Derived from the service's own command and mounts, so renaming
  // the file is a green rename and deleting it is red.
  const collector = SERVICES.get(ON.env.get('FORGE_SMTP_HOST'));
  assert.ok(collector, 'no collector service — the rule above already named why');

  const command = collector.body.join('\n');
  const presented = [...command.matchAll(/--smtp-tls-(?:cert|key)=(\S+)/g)].map((m) => m[1]);
  assert.equal(
    presented.length,
    2,
    `\`${collector.name}\` is started without --smtp-tls-cert AND --smtp-tls-key, so it offers no STARTTLS. ` +
      'The kernel FORCES the upgrade (`requireTLS: !secure`, apps/api/src/smtp-channel-driver.ts) and ' +
      'nodemailer refuses to deliver when it fails: measured, `ETLS Error upgrading connection with ' +
      'STARTTLS: 502 5.5.1 Not implemented`. The container would run, receive nothing, and read `healthy`.',
  );

  // Every file it presents is a file this repository HAS, reached through one of its own mounts.
  const binds = mounts(collector);
  assert.ok(binds.length > 0, `\`${collector.name}\` declares no bind mount — it presents files from nowhere`);
  const onDisk = (containerPath) => {
    const bind = binds.find((b) => containerPath === b.to || containerPath.startsWith(`${b.to}/`));
    return bind ? join(ROOT, bind.from, containerPath.slice(bind.to.length)) : null;
  };
  for (const file of presented) {
    const host = onDisk(file);
    assert.ok(host && existsSync(host), `\`${collector.name}\` presents ${file}, which this repository does not have at that mount`);
  }

  // And the kernel's trust anchor is ONE OF THOSE FILES, reached through the kernel's own mount.
  const anchorVar = /\$\{([A-Z0-9_]+)(?::-[^}]*)?\}/.exec(environmentOf(SERVICES.get('kernel'), 'NODE_EXTRA_CA_CERTS') ?? '');
  assert.ok(
    anchorVar,
    'the kernel service declares no NODE_EXTRA_CA_CERTS. Node then rejects the collector\'s self-signed ' +
      'certificate and every send dies `ESOCKET self-signed certificate` — measured 2026-09-14.',
  );
  const anchor = ON.env.get(anchorVar[1]);
  assert.ok(
    anchor && anchor !== '<unset>',
    `compose feeds the kernel's NODE_EXTRA_CA_CERTS from \${${anchorVar[1]}} and a box declaring ` +
      'FORGE_BENCH_MAILBOX exports nothing for it.',
  );
  const kernelBinds = mounts(SERVICES.get('kernel'));
  const anchorBind = kernelBinds.find((b) => anchor === b.to || anchor.startsWith(`${b.to}/`));
  assert.ok(
    anchorBind,
    `the kernel is told to trust ${anchor} and mounts nothing that could put a file there ` +
      `(${kernelBinds.map((b) => `${b.from}→${b.to}`).join(', ') || 'no bind mounts'}).`,
  );
  const anchorOnDisk = join(ROOT, anchorBind.from, anchor.slice(anchorBind.to.length));
  assert.ok(existsSync(anchorOnDisk), `the kernel is told to trust ${anchor}, which is not in this repository`);
  assert.ok(
    presented.some((file) => onDisk(file) === anchorOnDisk),
    `the kernel trusts ${anchor} and the collector presents ${presented.join(' / ')} — two different files. ` +
      'A trust anchor that is not the certificate being presented is the same failure as no anchor at all: ' +
      '`ESOCKET self-signed certificate`, on every message.',
  );
});

test('★★ the committed certificate is unmistakably the BENCH\'s, and cannot expire into a mystery', () => {
  // ⚠️ THIS IS THE ONE PEM THIS REPOSITORY COMMITS, and the reason it may be is that it authenticates a
  // throwaway container to the kernel beside it and nothing else. The rule keeps that true: a certificate
  // that named a public hostname would be a real one, committed key and all, and this folder is not where
  // that goes (FORGE_TLS_CERT_DIR is gitignored; the secret store is what env-source.sh reads).
  const collector = SERVICES.get(ON.env.get('FORGE_SMTP_HOST'));
  const anchor = ON.env.get('FORGE_MAIL_CA');
  const bind = mounts(SERVICES.get('kernel')).find((b) => anchor?.startsWith(`${b.to}/`));
  assert.ok(collector && bind, 'the rules above already named why there is nothing to grade here');
  const cert = new X509Certificate(readFileSync(join(ROOT, bind.from, anchor.slice(bind.to.length))));

  const names = (cert.subjectAltName ?? '').split(',').map((n) => n.trim().replace(/^DNS:/, ''));
  assert.ok(names.length > 0, 'the committed certificate carries no subjectAltName — nothing can present it');
  for (const name of names) {
    assert.ok(
      !name.includes('.') || name === 'localhost',
      `the committed certificate is valid for "${name}", which is a public hostname and not a service on a ` +
        'compose network. A certificate for something reachable from outside is a REAL certificate, its key ' +
        'is a REAL secret, and neither belongs in a tracked file. Use FORGE_TLS_CERT_DIR (gitignored) or ' +
        'the secret store.',
    );
  }
  assert.ok(
    names.includes(collector.name),
    `the committed certificate is valid for [${names.join(', ')}] and the kernel reaches the collector at ` +
      `"${collector.name}". The handshake then fails on the NAME rather than on the chain, which is the ` +
      'same dead bench with a different error.',
  );
  // A bench certificate that expires is a bench that stops accepting logins on a Tuesday, with a message
  // nobody is looking for. Ten years is far past the life of any of these boxes.
  const yearsLeft = (new Date(cert.validTo).getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  assert.ok(
    yearsLeft > 10,
    `the committed certificate expires in ${yearsLeft.toFixed(1)} year(s). Re-mint it far out: an expiry ` +
      'here is a box that silently stops delivering login codes long after anybody remembers this file.',
  );
});

// ── 2 · AND AN INSTANCE THAT DECLARES NOTHING KEEPS THE REAL PROVIDER ─────────────────────────────────────

test('★★★ no FORGE_BENCH_MAILBOX ⇒ the real mailbox, and no profile asked for', () => {
  // ⛔ THE HALF THAT MAKES THE OTHER ONE SAFE. A collector that arrived by default would be a deployed
  // instance quietly eating the mail it owes its customers — and it would look perfectly healthy.
  assert.equal(
    OFF.env.get('FORGE_SMTP_HOST'),
    'smtp.resend.com',
    'a box that declares no FORGE_BENCH_MAILBOX and HAS the provider key no longer exports the provider. ' +
      `It exported "${OFF.env.get('FORGE_SMTP_HOST')}".`,
  );
  assert.equal(OFF.env.get('FORGE_MAIL_CA'), '', 'a box on the real provider must trust no extra CA');
  const asked = (OFF.env.get('COMPOSE_PROFILES') ?? '').split(',').filter(Boolean);
  const collector = SERVICES.get(ON.env.get('FORGE_SMTP_HOST'));
  for (const profile of profilesOf(collector ?? { body: [] })) {
    assert.ok(
      !asked.includes(profile),
      `a box with no FORGE_BENCH_MAILBOX asks for the "${profile}" profile anyway, so it creates the ` +
        'collector — and then sends nothing to anyone while every container reads healthy.',
    );
  }
});

test('★ the bench\'s OWN configuration declares the mailbox — otherwise this box is back where it started', () => {
  // `.env.example` IS the bench's configuration (the same seam that decides the ports and the bind
  // interface). Everything above proves the mechanism works; this is the line that says the bench USES it.
  const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
  const declared = /^FORGE_BENCH_MAILBOX=(.*)$/m.exec(example);
  assert.ok(declared, '.env.example no longer names FORGE_BENCH_MAILBOX, so a human copying it gets a box whose mail leaves the machine with no way to read it');
  assert.notEqual(
    declared[1].trim(),
    '',
    '.env.example declares FORGE_BENCH_MAILBOX empty. A bench born from this file then mails through the ' +
      'real provider, whose only deliverable address is one personal inbox — which is exactly the state of ' +
      '2026-09-13, where no executor could log in as anybody and `pk34/p1` had to stop.',
  );
});
