// ★★ IS THIS FAILED `docker build` THE REGISTRY'S FAULT, OR THIS TREE'S? — the one question a retry is not
// allowed to guess at.
//
// ── WHY IT EXISTS (pk24/D2, from the caderno §B2) ────────────────────────────────────────────────────────
//
// Measured on 2026-09-07, baking this box: Docker Hub answered **500** to the HEAD request for
// `node:24-slim`. The admin image did not rebuild, and `bin/build-local.sh` refused to write the lock —
// correctly, and that refusal is not touched by this file (`build-local.sh:237-243`: a lock whose provenance
// the image does not carry is a lie about the artifact). The operator ran `docker pull` and re-ran the
// command BY HAND. In a pipeline that same minute is a red build with no cause of its own, and the habit it
// teaches — "just re-run CI" — is worse than the outage.
//
// ⚠️ A RETRY IS NOT `|| true`, AND THE WHOLE DIFFICULTY IS THE CLASSIFICATION. Repeating a failure that will
// never pass wastes a ceiling; repeating a failure that passes ONE TIME IN THREE turns a real defect green.
// The second is the dangerous one, so the line drawn here is STRUCTURAL rather than a beauty contest between
// error strings:
//
//     a failure INSIDE a build step  → never transient. The Dockerfile ran and this tree is the cause.
//     a failure RESOLVING or MOVING  → transient ONLY if it carries a transport or registry-side marker
//     an image, carrying 5xx/429/       (5xx, 429, TLS/timeout/reset/EOF/DNS). A 404, an `unauthorized`, a
//     a timeout/reset/DNS marker        tag that does not exist are the registry answering CORRECTLY.
//     anything else                  → NOT transient. The default is to fail, because an unrecognised
//                                       failure is exactly the one nobody has reasoned about yet.
//
// That first rule is what protects a flaky test or a flaky `npm install` inside a `RUN` from being retried
// into a green: those always print `did not complete successfully: exit code:`, and that string is checked
// BEFORE anything else and wins over every transient marker in the same output.
//
// ── ★ THE STRINGS ARE MEASURED, NOT REMEMBERED ──────────────────────────────────────────────────────────
//
// Every content marker below was produced on this workstation on 2026-09-08 by building a four-line
// Dockerfile that fails that way, and the fixtures in `bin/registry-transient.test.mjs` are those outputs
// verbatim. The transient side is measured where it could be (`connection refused` against a dead port) and
// otherwise assembled from buildkit's own format, which the same probes fixed:
//
//     ERROR: failed to build: failed to solve: <ref>: failed to resolve source metadata for <ref>: <cause>
//
// — the `<cause>` is the registry client's error, and it is the only part that separates a 500 from a 404.
//
//   node --test bin/registry-transient.test.mjs        (or: bash bin/test.sh)
//   node bin/registry-transient.mjs <file with the build output>   → exit 0 transient, 1 not

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A failure of a build STEP. The Dockerfile ran; whatever went wrong is a property of this tree and of the
 *  inputs it was handed, and repeating it is how a one-in-three defect becomes a green build. Checked first
 *  and never overridden. */
const STEP_FAILURE = [
  // `RUN` (any shell), measured: `process "/bin/sh -c exit 7" did not complete successfully: exit code: 7`
  /did not complete successfully: exit code:/i,
  // `COPY`/`ADD` of something the context does not have, measured on both halves of the same message
  /failed to compute cache key/i,
  /failed to calculate checksum of ref/i,
  // the Dockerfile itself does not parse — a source defect that no amount of network will fix
  /dockerfile parse error/i,
  /unknown instruction/i,
];

/** The registry answering CORRECTLY about something this tree asked for. A tag that does not exist, a
 *  repository this daemon may not read, a digest nobody published: repeating the question gets the same
 *  answer, and the honest thing is to say so on the first one. */
const REGISTRY_VERDICT = [
  /: not found(\b|$)/i,
  /manifest unknown/i,
  /repository does not exist/i,
  /\bunauthorized\b/i,
  /\bdenied\b/i,
  /authentication required/i,
  /\b40[0-9] (Bad Request|Unauthorized|Forbidden|Not Found|Method Not Allowed)/i,
];

/** Transport, or the registry itself being ill. These are the failures that pass on their own the second
 *  time, and the only ones worth a ceiling. */
const TRANSIENT = [
  // ★ THE ONE THIS FILE WAS WRITTEN FOR — Docker Hub's 500 to a HEAD, 2026-09-07.
  [/\b(500 Internal Server Error|502 Bad Gateway|503 Service Unavailable|504 Gateway Time-?out)\b/i, 'the registry answered 5xx'],
  [/unexpected status[^\n]*\b5[0-9][0-9]\b/i, 'the registry answered an unexpected 5xx'],
  [/\btoomanyrequests\b|429 Too Many Requests/i, 'the registry is rate-limiting this daemon'],
  [/TLS handshake timeout/i, 'the TLS handshake to the registry timed out'],
  [/i\/o timeout/i, 'the connection to the registry timed out'],
  [/Client\.Timeout exceeded|net\/http: request canceled/i, 'the request to the registry was cancelled on a timeout'],
  [/connection reset by peer/i, 'the registry reset the connection'],
  [/connect: connection refused/i, 'nothing accepted the connection to the registry'],
  [/unexpected EOF|: EOF(\b|$)/i, 'the connection to the registry ended mid-answer'],
  [/temporary failure in name resolution|server misbehaving/i, 'DNS could not answer for the registry'],
  [/error pulling image configuration/i, 'the image configuration could not be pulled'],
];

/**
 * Classify the combined stdout+stderr of a failed `docker build`.
 * @param {string} output what the build printed. An empty string is NOT transient: a failure that said
 *   nothing is the least understood failure there is.
 * @returns {{ transient: boolean, reason: string }} `reason` is a sentence for the operator, always set —
 *   a retry that does not say why it repeated hides a sick registry, and a refusal that does not say why it
 *   gave up sends the reader to the wrong file.
 */
export function classify(output) {
  const text = String(output ?? '');
  if (!text.trim()) {
    return { transient: false, reason: 'the build printed nothing — no failure this file can recognise' };
  }
  for (const pattern of STEP_FAILURE) {
    if (pattern.test(text)) {
      return {
        transient: false,
        reason: 'a BUILD STEP failed — the Dockerfile ran and this tree is the cause, so repeating it would ' +
          'only turn a one-in-three defect green',
      };
    }
  }
  for (const pattern of REGISTRY_VERDICT) {
    if (pattern.test(text)) {
      return {
        transient: false,
        reason: 'the registry ANSWERED — a missing tag, a repository this daemon may not read, or a digest ' +
          'nobody published. The same question gets the same answer',
      };
    }
  }
  for (const [pattern, reason] of TRANSIENT) {
    if (pattern.test(text)) return { transient: true, reason };
  }
  return {
    transient: false,
    reason: 'no marker this file recognises — an unrecognised failure is the one nobody has reasoned about ' +
      'yet, and the default here is to fail',
  };
}

// ── the shell's door ────────────────────────────────────────────────────────────────────────────────────
// `bin/docker-retry.sh` calls this with the file it captured the build into. The reason goes to stdout so
// the shell can echo it; the exit code carries the verdict, because that is the only thing `if` reads.
//
// ⚠️ THE "AM I THE ENTRY POINT?" TEST IS A REALPATH COMPARISON and not a suffix match on the URL: this file
// is imported by its own test, and a match that is merely close would let that import decide it is the CLI
// and call `process.exit` in the middle of the suite.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write('usage: node bin/registry-transient.mjs <file with the docker build output>\n');
    process.exit(2);
  }
  let output = '';
  try {
    output = readFileSync(path, 'utf8');
  } catch (error) {
    process.stderr.write(`cannot read ${path}: ${error.message}\n`);
    process.exit(2);
  }
  const verdict = classify(output);
  process.stdout.write(`${verdict.reason}\n`);
  process.exit(verdict.transient ? 0 : 1);
}
