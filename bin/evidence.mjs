// ★★ WHAT A RED BIRTH LEAVES BEHIND — the logs of the containers that were alive when it died.
//
// ⛔ THE DEFECT THIS EXISTS FOR, MEASURED ON THE BIRTH OF 2026-09-05 04:01.
//
// The curated seed died on `catalog.collection.pin → HTTP 502` after ~300 good calls. A 502 is the EDGE
// saying "the upstream did not answer me"; the only place that knows WHY is the upstream, and the only copy
// of that knowledge is the kernel container's log. The operator then did the one thing the failure itself
// tells them to do — `bash bin/box-up.sh --tailnet` — and that promotion ends in
// `dc up -d --force-recreate kernel caddy admin storefront checkout storefront-coffee totem`.
//
//     docker inspect, after the fact: the kernel container that served the seed was created 04:01:44
//     and the one standing in its place was created 04:02:06.
//
// ⇒ THE ONLY THING THAT COULD ANSWER THE QUESTION IS DESTROYED BY THE STEP THE ERROR ASKS FOR. Twenty-two
// seconds. And `bin/box-down.sh` removes the containers outright, so even without a promotion the evidence
// has a lifetime measured in whatever happens next.
//
// So the evidence is COPIED TO THE HOST FILESYSTEM, under `postmortem/`, before anything can recreate a
// container — and the run says out loud where it put it. A directory on disk survives `--force-recreate`,
// `box-down`, `down -v` and a reboot; a container's log survives none of them.
//
// ── ⚠️ WHY THIS TALKS TO `docker` AND NOT TO `docker compose` ───────────────────────────────────────────────
//
// A post-mortem must not need the box's own configuration to be readable. `docker compose logs` resolves
// services through `compose.yml` + `.env`, so a birth that died BECAUSE that interpolation is broken is
// exactly the birth whose evidence could not be collected. The compose PROJECT LABEL is on every container
// docker compose ever created (`com.docker.compose.project`), so `docker ps -a --filter label=…` finds them
// with nothing but the project name — which is a string this repository already knows.
//
// ── ⚠️ AND THE VOID HAS TO ACCUSE ITSELF ───────────────────────────────────────────────────────────────────
//
// MEASURED: `docker ps -a --filter label=com.docker.compose.project=nao-existe-xyz` exits **0** with an empty
// stdout. So a capture written the obvious way — list, loop, write — creates a neat empty directory for a box
// that does not exist and reports success. A postmortem folder full of 0-byte files is worse than no folder:
// somebody reads it and concludes the kernel said nothing. Pointing this at a box that is not there is a
// FAILURE OF THE CAPTURE, and it is raised as one.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The capture could not be taken. Distinguished from a normal Error so the callers can exit on purpose. */
export class EvidenceError extends Error {}

/** Where the evidence lives, relative to the repository root. Gitignored — it is a box's remains, not source. */
export const EVIDENCE_ROOT = 'postmortem';

/**
 * The folder name for one capture: sortable, and it carries the REASON in the name.
 *
 * `2026-09-05T04-01-44Z__seed-red` rather than a bare timestamp, because the directory listing is the index:
 * an operator with four captures has to be able to see which one was the red birth without opening any.
 */
export function captureDirName(reason, now = new Date()) {
  const stamp = now.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
  const slug = String(reason ?? 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${stamp}__${slug || 'unnamed'}`;
}

/** One `docker ps` row → the fields the post-mortem needs. Tab-separated because a service name cannot hold one. */
export function parseContainers(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, service, created, state, name] = line.split('\t');
      return { id, service: service || '(unlabelled)', created, state, name };
    })
    .filter((row) => row.id);
}

const PS_FORMAT =
  '{{.ID}}\t{{.Label "com.docker.compose.service"}}\t{{.CreatedAt}}\t{{.State}}\t{{.Names}}';

/**
 * Copy every container of one compose project to disk, with what identifies it.
 *
 * `docker` is injected — `(args: string[]) => { status, stdout, stderr }` — so this is testable without a
 * daemon and so the caller decides how it reaches one (this bench goes through `sg docker -c`).
 *
 * Throws `EvidenceError` when there is nothing to capture. Returns the directory and one entry per container
 * otherwise; `entry.bytes === 0` is reported, never hidden, because a container that ran and said nothing is
 * a finding and a container this function failed to read is a different finding.
 */
export function captureEvidence({
  docker,
  project,
  reason,
  root = EVIDENCE_ROOT,
  now = new Date(),
  tail = 5000,
  note = () => {},
}) {
  if (!project) throw new EvidenceError('captureEvidence: no compose project named.');

  const listed = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--format', PS_FORMAT]);
  if (listed.status !== 0) {
    throw new EvidenceError(
      `could not ask docker which containers belong to "${project}" (exit ${listed.status}).\n` +
        `  docker said: ${(listed.stderr || listed.stdout || '(nothing)').trim().slice(0, 400)}\n` +
        '  ⚠️ NOTHING has been written. Whatever the red run was about, its evidence is still only inside\n' +
        '     the containers — do not recreate them until this is answered.',
    );
  }

  const containers = parseContainers(listed.stdout);
  if (containers.length === 0) {
    // ⛔ THE VOID, AND IT EXITS 0 IN DOCKER'S OWN VOICE. See the header: an empty listing is indistinguishable
    // from a healthy answer at the exit code, so this is the one place that has to turn silence into a noise.
    throw new EvidenceError(
      `NO CONTAINER carries the label com.docker.compose.project=${project}, so there is nothing to take\n` +
        '  evidence FROM and no directory has been created.\n' +
        '  ⚠️ `docker ps -a --filter label=…` answers this case with exit 0 and an empty list, so a capture\n' +
        '     that trusted the exit code would have written an empty folder and called it a post-mortem.\n' +
        `  Either the project name is wrong (this box is "${project}"), or the box was already torn down —\n` +
        '  and if it was torn down, the log the red run needed is already gone.',
    );
  }

  const dir = join(root, captureDirName(reason, now));
  mkdirSync(dir, { recursive: true });

  const entries = [];
  for (const container of containers) {
    // `docker logs` writes the container's stdout to OUR stdout and its stderr to OUR stderr, and the
    // interesting half of a kernel is almost always the second one. Both are kept, in that order, rather than
    // whichever the runner happened to hand back.
    const logs = docker(['logs', '--timestamps', '--tail', String(tail), container.id]);
    const text = `${logs.stdout ?? ''}${logs.stderr ?? ''}`;
    const file = `${container.service}.log`;
    writeFileSync(join(dir, file), text);

    const inspected = docker(['inspect', container.id]);
    const inspectFile = `${container.service}.inspect.json`;
    if (inspected.status === 0 && inspected.stdout) writeFileSync(join(dir, inspectFile), inspected.stdout);

    const entry = {
      ...container,
      file,
      inspectFile: inspected.status === 0 && inspected.stdout ? inspectFile : null,
      bytes: Buffer.byteLength(text),
      logStatus: logs.status,
      logError: logs.status === 0 ? null : (logs.stderr || '').trim().slice(0, 300),
    };
    entries.push(entry);
    if (entry.logStatus !== 0) note(`⚠️ ${container.service} — docker refused its log: ${entry.logError}`);
    else if (entry.bytes === 0) note(`⚠️ ${container.service} — 0 bytes of log (it is there and it said nothing)`);
  }

  writeFileSync(join(dir, 'MANIFEST.md'), manifest({ project, reason, now, entries }));

  const captured = entries.filter((e) => e.bytes > 0).length;
  return { dir, entries, captured, empty: entries.length - captured };
}

/**
 * The index of one capture, and it states the two facts that decide whether a log is the right log:
 * WHEN the container was created and WHICH image it is. The 04:01 birth was diagnosed after the fact by
 * exactly those two fields — a log without them cannot be tied to the run that needed it.
 */
export function manifest({ project, reason, now, entries }) {
  const lines = [
    `# post-mortem — ${project}`,
    '',
    `* reason: **${reason}**`,
    `* captured: ${now.toISOString()}`,
    `* containers: ${entries.length}`,
    '',
    '| service | container | created | state | log | bytes |',
    '|---|---|---|---|---|---|',
  ];
  for (const e of entries) {
    const size =
      e.logStatus !== 0 ? `⛔ docker refused (${e.logError || `exit ${e.logStatus}`})` : e.bytes === 0 ? '⚠️ **0**' : String(e.bytes);
    lines.push(`| ${e.service} | \`${e.id}\` | ${e.created} | ${e.state} | ${e.file} | ${size} |`);
  }
  lines.push(
    '',
    '> ⚠️ **A container is not the same container after a recreate.** `bash bin/box-up.sh --tailnet` ends in',
    '> `docker compose up -d --force-recreate`, and `bin/box-down.sh` removes them outright. The `created`',
    '> column above is what ties these logs to the run that failed: on 2026-09-05 the kernel that served the',
    '> seed was created 04:01:44 and the one that replaced it 04:02:06, twenty-two seconds later.',
    '',
  );
  return lines.join('\n');
}
