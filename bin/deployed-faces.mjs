#!/usr/bin/env node
// ★★★ THE FACES OF A **DEPLOYED** BOX — the structure from `seed/box.json`, the addresses from `deploy/`.
//
//   node bin/deployed-faces.mjs                 (with deploy/box.env + deploy/<env>.env already in the env)
//
// stdout is one TSV line per face — `kind  tenant  store  variable  value  directory` — and stderr is the
// reasoning an operator reads. Nothing here writes anything: the caller does.
//
// ── ⛔ THE GAP THIS CLOSES, AND `RESULTADOS-d1.md` NAMED IT BEFORE THIS FILE EXISTED ──────────────────────
//
// `seed/box.json` declares ONE hostname per store and one per tenant, and it has NO environment axis: what it
// names is the PRODUCTION six (`store.forgecommerce.pro` and its siblings). A staging box is the same
// topology at different addresses, and there is nowhere in that file to say so — so `deploy/stag.env` types
// the six, and d1 recorded that as «the second place a hostname is stated».
//
// ★ IT IS NOT A SECOND PLACE ONCE THE TWO HALVES ARE DIFFERENT QUESTIONS, which is what this file makes true.
// `seed/box.json` already answers «which VARIABLE carries this face» — `domain.env` on a store,
// `admin_domain.env` on a tenant, declared since pk34 and graded at all three ends by
// `bin/box-domains.guard.mjs`. `deploy/<env>.env` answers «what is that variable's VALUE on THIS box». So the
// structure has one author and the address has one author, and neither repeats the other. A fifth store that
// grows a `domain` block arrives here with no edit; a third environment is one more file.
//
// ⚠️ AND `bin/promotion-faces.mjs` IS NOT THIS, WHICH IS WHY THIS IS A SECOND FILE AND NOT A FLAG ON THAT
// ONE. That module answers a question about a BENCH being pointed somewhere: the destination is a single
// address and the three states it chooses between (BENCH / DEPLOYMENT / ELSEWHERE) are about whether the
// declared hostnames are the ones this box really answers at. A deployed box does not have a destination — it
// has six of them, one per face, and they are not the declared ones. Asked about `stg.store.forgecommerce.pro`
// that module answers ELSEWHERE and writes nothing, correctly: the staging names are not in the declaration.
//
// ── ★★ WHAT IT REFUSES, AND THE REFUSAL IS THE POINT ─────────────────────────────────────────────────────
//
// A face whose variable this environment does not carry is a REFUSAL, never a skipped line. Every address in
// `caddy/Caddyfile` carries a `<something>.unset.localhost` sentinel (pk34, measured): a variable nobody set
// costs ONE face on a name nothing resolves, and the other five serve. The edge comes up, looks healthy, and
// one shop is simply not on the internet — with nothing in any log. That is the defect this whole family of
// modules exists to make loud, so a birth that would produce it stops before it writes anything.
//
// A variable that carries a BENCH address on a deployed box is the same refusal one notch quieter: the box
// would claim `localhost` in the kernel's directory and a browser on the internet would get `unknown_host`.
//
// ⚠️ THE COUNTER IS THE ONE FACE WITH AN ADDRESS AND NO DIRECTORY CLAIM, and that distinction is carried
// rather than re-derived: `seed/box.json` says `directory: false` on it and `bin/box-domains.mjs` already
// reads it. WHERE A FRONT OF THIS BOX ANSWERS is not the same fact as WHAT THE KERNEL'S ADDRESS BOOK CLAIMS
// FOR THAT STORE — the edge serves `totem.…`, the store's `host` column stays null, and `bin/prove-doors.mjs`
// asserts that negative. A birth that claimed it would put an «Acompanhar o pedido» button on every counter
// receipt pointing at the totem's own 404.

import process from 'node:process';

import { declaredFaces, isBenchAddress, readBox } from './box-domains.mjs';

const TAG = '[deployed-faces]';

/** 1 is «this environment is not one a deployed box may be born into»; 2 is «THIS STEP could not tell»,
 *  which no caller may publish as either outcome. The split every instrument in this box makes. */
export class CannotPlan extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

/**
 * @param {Record<string, string | undefined>} env  the shell the caller sourced `deploy/` into
 * @returns {{faces: Array<object>}}
 */
export function deployedFaces(env, box = readBox()) {
  let declared;
  try {
    declared = declaredFaces(box);
  } catch (err) {
    throw new CannotPlan(`seed/box.json could not be read: ${err.message}`, 2);
  }
  if (declared.length === 0) {
    throw new CannotPlan(
      'seed/box.json declares no face at all — no `domain` on any store, no `admin_domain` on any tenant.\n' +
        `     A deployed box IS its faces; there is nothing here to point at ${env.FORGE_DEPLOY_HOST ?? 'that host'}.`,
      1,
    );
  }

  const missing = [];
  const bench = [];
  const faces = [];
  for (const face of declared) {
    const value = (env[face.env] ?? '').trim();
    if (!value) {
      missing.push(face);
      continue;
    }
    if (isBenchAddress(value)) {
      bench.push({ ...face, value });
      continue;
    }
    faces.push({ ...face, value });
  }

  if (missing.length > 0) {
    throw new CannotPlan(
      'this environment does not carry an address for ' +
        `${missing.length} of the ${declared.length} face(s) this box declares:\n` +
        missing.map((f) => `       ${f.label.padEnd(24)} needs ${f.env}  (declared as ${f.host})`).join('\n') +
        '\n     Every one of them is a site block in caddy/Caddyfile with a `.unset.localhost` sentinel behind it,' +
        '\n     so the edge would come up, five faces would serve, and that one would answer on a name nothing' +
        '\n     resolves — with nothing in any log. Declare it in deploy/<env>.env beside its siblings.',
      1,
    );
  }
  if (bench.length > 0) {
    throw new CannotPlan(
      `${bench.length} face(s) of this environment carry a BENCH address:\n` +
        bench.map((f) => `       ${f.label.padEnd(24)} ${f.env}=${f.value}`).join('\n') +
        '\n     A deployed box that claimed one of those in the kernel’s directory would answer `unknown_host`' +
        '\n     to every browser on the internet, and the certificate for it would never be asked for.',
      1,
    );
  }
  return { faces };
}

export function main(env = process.env) {
  let plan;
  try {
    plan = deployedFaces(env);
  } catch (err) {
    if (err instanceof CannotPlan) {
      console.error(`${TAG} ${err.message}`);
      return err.code;
    }
    console.error(`${TAG} ${err.message}`);
    return 2;
  }
  for (const f of plan.faces) {
    console.error(
      `${TAG} ${f.label.padEnd(24)} ${f.value}${f.directory ? '' : '   (edge only — the directory does not claim it)'}`,
    );
    process.stdout.write(
      [f.kind, f.tenant, f.store ?? '-', f.env, f.value, f.directory ? 'directory' : 'edge-only'].join('\t') + '\n',
    );
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
