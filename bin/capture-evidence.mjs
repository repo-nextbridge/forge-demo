#!/usr/bin/env node
// THE HAND. `bin/evidence.mjs` decides what a post-mortem is; this reaches the daemon and exits with a
// verdict, so a shell script can call it and a human can call it.
//
//   node bin/capture-evidence.mjs --reason seed-red
//   node bin/capture-evidence.mjs --project forge-preseed --reason before-recreate
//
// EXIT CODES, and they are three because the three cases are genuinely different:
//   0  evidence on disk, at least one container said something.
//   1  NOTHING was captured — no such box, or docker refused. The message names which.
//   2  every container was found and every log was EMPTY. The files are on disk (an empty log is a fact),
//      and the caller is told, because "the box said nothing" is a finding and not a success.
//
// ⚠️ IT MUST NEVER TAKE DOWN THE RUN THAT CALLS IT. A birth that already failed is not improved by a second
// failure on top of it, and a promotion that worked must not be marked red because its post-mortem was
// unnecessary. `bin/box-up.sh` reads the exit code and NOTES it; it never dies on it.

import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVIDENCE_ROOT, EvidenceError, captureEvidence } from './evidence.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argOf = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const project = argOf('--project', process.env.COMPOSE_PROJECT_NAME || 'forge-preseed');
const reason = argOf('--reason', 'manual');
const rootArg = argOf('--root', EVIDENCE_ROOT);
const root = isAbsolute(rootArg) ? rootArg : join(ROOT, rootArg);
const tail = Number(argOf('--tail', '5000'));

// The same accessor the rest of this repo uses to reach the daemon — this bench runs docker through a group
// shim (`sg docker -c`), and a post-mortem that only worked for members of the docker group would be missing
// on exactly the machine this box lives on.
const DOCKER_SH = process.env.FORGE_DOCKER_SH ?? 'sg docker -c';
const quote = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;

/**
 * ⚠️ `spawnSync`, NEVER `execFileSync`. `execFileSync` throws on a non-zero child and only then carries
 * `stderr` — so a child that SUCCEEDS while complaining (or one whose failure the caller wants to read
 * rather than throw on) is measured as silence. This function is asked to report what docker said in BOTH
 * cases, so it needs the shape that always returns all three fields.
 */
function docker(args) {
  const line = `docker ${args.map(quote).join(' ')}`;
  const prefix = DOCKER_SH.trim().split(/\s+/);
  const res = spawnSync(prefix[0], [...prefix.slice(1), line], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (res.error) return { status: 127, stdout: '', stderr: `${res.error.message} (via ${DOCKER_SH})` };
  return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

const note = (m) => process.stderr.write(`   ${m}\n`);

try {
  const out = captureEvidence({ docker, project, reason, root, tail, note });
  process.stderr.write(
    `\n[evidence] ${out.captured} of ${out.entries.length} container log(s) saved — ${out.dir}\n` +
      `   ⚠️ THIS IS THE ONLY COPY. The containers it came from are recreated by \`box-up.sh --tailnet\` and\n` +
      '      removed by `box-down.sh`; this directory survives both.\n',
  );
  if (out.captured === 0) {
    process.stderr.write(
      '[evidence] ⛔ every container was found and EVERY LOG WAS EMPTY. That is not a successful capture —\n' +
        '   read MANIFEST.md: either the daemon is not keeping logs for this project, or the box really did\n' +
        '   die without a word, and those are two different investigations.\n',
    );
    process.exit(2);
  }
  process.exit(0);
} catch (err) {
  if (err instanceof EvidenceError) {
    process.stderr.write(`\n[evidence] ⛔ NO EVIDENCE TAKEN.\n  ${err.message}\n\n`);
    process.exit(1);
  }
  throw err;
}
