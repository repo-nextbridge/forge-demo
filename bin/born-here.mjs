#!/usr/bin/env node
// ★★★ HAS ANYTHING BEEN BORN ON THIS DATABASE? — asked of the box's own directory, never of a file beside it.
//
//   node bin/deployed-faces.mjs | node bin/born-here.mjs --api https://<the box's public origin>
//
// stdin is the face plan `bin/deployed-faces.mjs` prints (`kind tenant store variable value directory`).
// stderr is what the operator reads. The exit code is the answer:
//
//   0  NOTHING is born here — no face this box declares is claimed in the kernel's directory
//   1  this box HOLDS A BIRTH — at least one declared face is claimed, by the tenant/store named
//   2  THIS STEP could not ask (the box did not answer, a read came back neither 200 nor 404). Not a claim.
//
// ── ⛔ THE DEFECT, MEASURED ON THE REHEARSAL OF 2026-10-09 (v032/E, finding 1) ─────────────────────────────
//
// The rebirth from zero is three gestures — `box-down.sh --env stag` → `deploy.sh stag` → `birth-remote.sh
// stag` — and the third REFUSED it. Its refusal asked two proxies: is `forge-operator-token` in `.secrets`
// (box-down keeps `.secrets` on purpose: identity, not state) and does the `<project>_pgdata` volume exist.
// The second proxy was written for `box-down` → birth, and it is defeated by the gesture in between:
// `deploy.sh` runs `docker compose up` + `migrate`, which CREATES `pgdata` again — empty. Measured on the
// stag that day: 14 system tables, `[migrate] tenants: none registered yet`, no catalogue. So the documented
// path of the rebirth needed `--again`, whose sentence tells the operator they are re-applying over a LIVE
// box. That was false, and a refusal that is false on the common path trains everybody to type past it.
//
// ★ SO THE QUESTION IS ASKED OF THE STATE ITSELF: does this database hold a tenant? Step 3 (`provision-ref`)
// claims every tenant's admin hostname in `forge_control.admin_directory`, and step 6b claims every store's
// public hostname in `store_directory`. Both are answered by GLOBAL, public, actorless reads of the port —
// `read.admin.by_host` and `read.store.by_host`, the same two `bin/verify-config.mjs` grades the box with —
// so this asks the product's contract and not its tables. A box that has been through step 3 claims at least
// one admin face; a box that `deploy.sh` just brought up on an empty volume claims none (404 for every one).
//
// ⛔ AND «COULD NOT ASK» IS NEVER «EMPTY». A kernel that is down, an edge without a certificate, a 5xx: each is
// exit 2, and the caller refuses on it exactly as it refuses a live box. The cheap mistake here is the
// expensive one — a timeout read as «nothing born» would let a birth re-apply itself over a shop.

import process from 'node:process';

const TAG = '[born-here]';

/**
 * @param {{origin: string, faces: Array<{kind: string, tenant: string, store: string, value: string, directory: boolean}>,
 *          fetchImpl?: typeof fetch}} args
 * @returns {Promise<{claimed: string[], unknown: string[], asked: number}>}
 */
export async function askBirth({ origin, faces, fetchImpl = fetch }) {
  const base = origin.replace(/\/+$/, '');
  const claimed = [];
  const unknown = [];
  let asked = 0;
  for (const face of faces) {
    // The counter's hostname is served at the edge and claimed by NO store on purpose (`directory: false`),
    // so its silence says nothing about a birth and asking it would only add a 404 to the count.
    if (face.kind === 'store' && !face.directory) continue;
    const read = face.kind === 'admin' ? 'admin.by_host' : 'store.by_host';
    const label = face.kind === 'admin' ? `${face.tenant} · admin` : `${face.tenant}/${face.store}`;
    asked += 1;
    try {
      const res = await fetchImpl(`${base}/v1/read/${read}?host=${encodeURIComponent(face.value)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 404) continue;
      if (!res.ok) {
        unknown.push(`${label} ${face.value} — ${read} answered HTTP ${res.status}`);
        continue;
      }
      const body = await res.json().catch(() => null);
      const who = body?.tenant_id ?? body?.store_id;
      if (who) claimed.push(`${label} ${face.value} → ${who}`);
      else unknown.push(`${label} ${face.value} — ${read} answered 200 with no id`);
    } catch (error) {
      unknown.push(`${label} ${face.value} — ${error.message}`);
    }
  }
  return { claimed, unknown, asked };
}

/** The TSV `bin/deployed-faces.mjs` prints, back into objects. */
export function parseFaces(text) {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [kind, tenant, store, variable, value, directory] = l.split('\t');
      return { kind, tenant, store, variable, value, directory: directory === 'directory' };
    });
}

async function main() {
  const i = process.argv.indexOf('--api');
  const origin = i > -1 ? process.argv[i + 1] : '';
  if (!origin) {
    console.error(`${TAG} no --api — there is no box to ask.`);
    return 2;
  }
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const faces = parseFaces(Buffer.concat(chunks).toString('utf8'));
  if (faces.length === 0) {
    console.error(`${TAG} no face plan on stdin — nothing to ask the directory about.`);
    return 2;
  }
  const { claimed, unknown, asked } = await askBirth({ origin, faces });
  for (const line of claimed) console.error(`${TAG}   claimed   ${line}`);
  // ★ A CLAIM WINS OVER AN UNKNOWN: one face the directory names is already a birth, whatever the others said.
  if (claimed.length > 0) return 1;
  if (unknown.length > 0) {
    for (const line of unknown) console.error(`${TAG}   unknown   ${line}`);
    return 2;
  }
  console.error(`${TAG}   ${asked} declared face(s) asked of ${origin} — the directory claims NONE of them.`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main());
