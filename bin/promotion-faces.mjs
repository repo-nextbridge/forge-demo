#!/usr/bin/env node
// ★★★ THE EDGE'S HOSTNAMES, DERIVED FROM `seed/box.json` BY THE PROMOTION — never typed into a `.env`.
//
//   node bin/promotion-faces.mjs --destination <hostname|localhost>
//
// stdout carries the plan, one `NAME<TAB>value` line per variable the caller must write; stderr carries the
// reasoning an operator reads. Nothing here writes a file: the caller does, which is what lets a refusal be
// atomic (see the promotion block of `bin/box-up.sh` — everything before its first `put_env` is a read).
//
// ── ⛔ THE GAP THIS CLOSES, AND IT IS ONE END OF A WIRE THAT ALREADY HAD TWO ─────────────────────────────
//
// Since pk34/d1 a face of this box has THREE ends: `seed/box.json` declares the hostname (a hostname is DATA
// — it is the `host` column the kernel keys its directory on), `caddy/Caddyfile` decides which CONTAINER
// answers there, and compose has to deliver the variable that carries the first to the second.
// `bin/box-domains.guard.mjs` grades all three — and NOBODY EVER WROTE THE VALUE. `bin/box-up.sh --promote`
// rewrote four variables (the host → store map, the public origin, the gate's admin link and the sibling
// list) and not one of the six the edge reads, so a deployment of this instance filled them BY HAND. A
// hostname typed into a `.env` beside a hostname declared in a file is the shape this house does not accept:
// the two agree until somebody renames one.
//
// ⚠️ AND THE QUIET FAILURE IS NOT A CRASH, WHICH IS WHY IT SURVIVED A WHOLE SLICE. Every address in
// `caddy/Caddyfile` carries a `<something>.unset.localhost` sentinel (pk34, measured): a variable nobody set
// costs ONE face on a name nothing resolves, and the other five serve. So a half-filled edge comes up, looks
// healthy, and one shop is simply not on the internet.
//
// ── ★★ THE THREE STATES, AND THEY ARE THE ONES `bin/verify-config.mjs` ALREADY GRADES ────────────────────
//
// This box is born on `localhost` (§0b) and the promotion is a NAMED step, so "no face is published" is a
// legitimate, common state — it is what a bench IS. The rule therefore reads the DECLARATION and the
// DESTINATION, and answers one of three:
//
//   BENCH       `seed/box.json` declares no face at all. Nothing to write, and that is not a failure: a box
//               with no declared address cannot be published at one, and the promotion still does everything
//               else it does. ⇒ the anti-vacuum case, and it is a case a real repository can reach (a
//               deployment that has not chosen its hostnames yet).
//   DEPLOYMENT  the destination IS one of the declared faces ⇒ this promotion is the deployment those
//               declarations describe, so ALL of them are written, from the file, in one pass.
//   ELSEWHERE   the destination is a real address that the declaration does not name — a tailnet, a laptop,
//               a staging box. The declared hostnames are NOT addresses this box answers at, so writing them
//               would put a public name on an edge that cannot serve it and ask a CA for a certificate on
//               behalf of a box that is somewhere else. They are left alone, and the run SAYS so by name.
//
// ⛔ WHY "ELSEWHERE" LEAVES THEM AND DOES NOT REFUSE, MEASURED ON THE LIVE BENCH 2026-09-13: `.env` holds
// `FORGE_PUBLIC_ORIGIN=https://ms-s1.<tailnet>` with `FORGE_DOMAIN=localhost`, i.e. the demo bench is
// promoted to a tailnet and is NOT at `store.forgecommerce.pro`. Writing the six there would make
// `bin/verify-config.mjs` grade six PUBLISHED faces on a box whose directory holds a tailnet name, and every
// one of them would come out ✗ — the "abandoned promotion" verdict, printed over a bench that is exactly
// what it is meant to be. The instrument may only assert about the box what it actually knows.
//
// ── ★★★ AND A FACE THE EDGE READS THAT NOTHING DECLARES IS A REFUSAL, NOT A SENTINEL ────────────────────
//
// In the DEPLOYMENT state the plan must be COMPLETE or it must not run. If `caddy/Caddyfile` has a site block
// for `{$FORGE_OUTLET_DOMAIN}` and `seed/box.json` declares no face carrying that variable, writing the other
// five leaves that one on its sentinel: the edge loads, five faces serve, and the outlet answers on a name
// nothing resolves with nothing in any log. That is the defect with a nicer coat on. So the promotion refuses
// and NAMES the variable, its sentinel and the line of the file that reads it — before anything is written.
//
// ★ THE COVERAGE RULE HAS ONE AUTHOR: `faceCoverage()` in `bin/box-domains.mjs`, which is also what
// `bin/box-domains.guard.mjs` asserts with at test time. The guard grades the repository; this grades the box
// the promotion is standing on — same rule, two callers, and a deployment that added a store to its own
// `seed/box.json` is graded where it lives.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, declaredFaces, envSitesOf, faceCoverage, isBenchAddress, readBox } from './box-domains.mjs';

export class CannotPlan extends Error {
  /** `code` is the EXIT STATUS this refusal deserves, and the split is the one every instrument in this box
   *  makes: 1 is «the box is not in a state this step may write to», 2 is «THIS STEP could not tell» — a fact
   *  about the read, which no caller may publish as a verdict about the box. */
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

export const STATES = ['bench', 'deployment', 'elsewhere', 'back'];

/**
 * ★★ THE RULE. Takes the declaration, the edge and the destination; answers `{ state, writes, lines }`.
 * `writes` is what the caller must put into `.env`; `lines` is what the operator reads. It touches no file
 * and no environment of its own, which is what lets `bin/promotion-faces.guard.mjs` prove every branch in
 * milliseconds instead of from a real promotion.
 *
 * @param faces       every face `seed/box.json` declares (`declaredFaces`)
 * @param envSites    every site address of `caddy/Caddyfile` that comes from a variable (`envSitesOf`)
 * @param destination the hostname this box is being promoted to, or `localhost` for the way back
 * @param current     what `.env` holds for those variables today, for the operator's before → after
 */
export function facePlan({ faces, envSites, destination, current = {} }) {
  const dest = String(destination ?? '').trim();
  if (!dest) {
    throw new CannotPlan(
      'no destination was given, and the faces to write depend on which one it is.',
      2,
    );
  }
  // ⚠️ ANTI-VACUUM, AND IT IS THE FIRST THING. An edge that parsed into zero variable-addressed site blocks is
  // a PARSER that stopped working, not a box with nothing to publish — and "no variable is uncovered" would
  // then be true of every possible declaration. A rule that cannot be wrong is not grading anything.
  if (!Array.isArray(envSites) || envSites.length === 0) {
    throw new CannotPlan(
      'caddy/Caddyfile yielded no site address that comes from a variable, so this plan could not tell a ' +
        'covered face from an uncovered one. That is a fact about the READ, never about the box.',
      2,
    );
  }

  const was = (env) => String(current[env] ?? '').trim();
  const shown = (value) => (value === '' ? '(empty)' : value);

  if (dest === 'localhost') {
    // ── THE WAY BACK, AND IT WRITES NOTHING ON PURPOSE ──────────────────────────────────────────────────
    // ⛔ THE TWO OBVIOUS UNDOS ARE BOTH MEASURED DEAD. Emptying them is refused by compose itself — the edge
    // service reads `${FORGE_DOMAIN:?…}`, and `${VAR:?}` rejects a variable that is PRESENT AND EMPTY, so the
    // whole box stops starting. Writing `localhost` into all six is worse: six site blocks with one address
    // is a duplicate site address, which does not degrade one host — it stops `caddy/Caddyfile` loading and
    // takes store, checkout and admin down together (the same dead edge pk34 measured from the other side).
    // ⇒ So the way back releases what it CLAIMED (the admin directory, the host → store map) and leaves the
    //   declaration of where this deployment publishes itself where it is — saying which names are still
    //   there, because a demotion that left six public hostnames on the edge in silence is the half-state
    //   nobody chose.
    // ★ THE ADDRESS, NEVER THE VARIABLE — the pk34 repair, and the same predicate `bin/verify-config.mjs`
    // grades with: a face answering at loopback is not published, and a variable nobody set is not either.
    const standing = faces.filter((f) => was(f.env) !== '' && !isBenchAddress(was(f.env)));
    const lines =
      standing.length === 0
        ? ['the edge names no published hostname, so this demotion has none to leave behind.']
        : [
            `the edge still names ${standing.length} published hostname(s), and this direction does not ` +
              'unname them: emptying one is refused by compose (`${FORGE_DOMAIN:?…}` rejects a present-and-' +
              'empty value) and pointing them all at localhost is a duplicate site address, which is the ' +
              'whole edge down rather than one face.',
            ...standing.map((f) => `  still declared: ${f.env}=${was(f.env)}   (${f.label})`),
            'Nothing routes to this box through them while it is on localhost. Promote it again, or take ' +
              'the declarations out of seed/box.json.',
          ];
    return { state: 'back', writes: [], lines };
  }

  if (faces.length === 0) {
    // ── THE BENCH. Not a failure, and not silence either. ───────────────────────────────────────────────
    return {
      state: 'bench',
      writes: [],
      lines: [
        'seed/box.json declares no face at all, so this promotion has no hostname to give the edge. The box ' +
          'is promoted anyway — the host → store map, the public origin and the admin doors are the ' +
          'promotion; the faces are the EDGE, and a box that declares none simply has none.',
      ],
    };
  }

  const { undeclared } = faceCoverage(faces, envSites);
  const hostOf = new Map(faces.map((f) => [f.host, f]));
  const arrival = hostOf.get(dest);

  if (!arrival) {
    // ── ELSEWHERE. It says what it knows about ITSELF — the destination — and asserts nothing about the box.
    return {
      state: 'elsewhere',
      writes: [],
      lines: [
        `this box publishes itself at "${dest}", which is not one of the ${faces.length} face(s) ` +
          'seed/box.json declares — so those hostnames are not addresses this box answers at, and the edge ' +
          'keeps whatever it holds. Nothing here is wrong: a bench on a tailnet is exactly this state.',
        ...faces.map((f) => `  declared elsewhere: ${f.env}=${f.host}   (${f.label})`),
        'A deployment promotes to one of those names, and then all of them are written from the file.',
      ],
    };
  }

  if (undeclared.length > 0) {
    // ⛔ THE REFUSAL, AND IT NAMES THE SENTINEL BECAUSE THE SENTINEL IS WHAT THE OPERATOR WOULD HAVE GOT.
    throw new CannotPlan(
      `the edge reads ${undeclared.length} variable(s) that seed/box.json declares no face for, so a plan ` +
        'built from that file would leave them on their sentinels — one hostname each, answering on a name ' +
        'nothing resolves, with nothing in any log:\n' +
        undeclared
          .map(
            (s) =>
              `       caddy/Caddyfile:${s.line} reads {$${s.env}} and would fall back to ` +
              `"${s.fallback ?? '(nothing)'}"`,
          )
          .join('\n') +
        '\n     Declare the face in seed/box.json (a `domain` on the store, an `admin_domain` on the tenant), ' +
        'or take the site block out of caddy/Caddyfile. Writing the others and leaving these is the silent ' +
        'half-published edge this step exists to prevent.',
      1,
    );
  }

  const writes = faces.map((f) => ({ env: f.env, value: f.host, label: f.label, was: was(f.env) }));
  const changed = writes.filter((w) => w.was !== w.value);
  return {
    state: 'deployment',
    writes,
    lines: [
      `"${dest}" is this box's ${arrival.label} face, so this promotion IS the deployment seed/box.json ` +
        `describes: all ${writes.length} face(s) are written from the file, and ${changed.length} of them ` +
        'change.',
      ...writes.map(
        (w) =>
          `  ${w.env}=${w.value}   (${w.label})${w.was === w.value ? '' : `   ← was ${shown(w.was)}`}`,
      ),
    ],
  };
}

const argOf = (argv, name) => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : undefined;
};

function main(argv) {
  const root = argOf(argv, '--root') ?? ROOT;
  let plan;
  try {
    plan = facePlan({
      faces: declaredFaces(readBox(root)),
      envSites: envSitesOf(readFileSync(join(root, 'caddy/Caddyfile'), 'utf8')),
      destination: argOf(argv, '--destination') ?? '',
      current: process.env,
    });
  } catch (error) {
    if (!(error instanceof CannotPlan)) throw error;
    process.stderr.write(
      `\n[promotion-faces] ⛔ THE EDGE'S HOSTNAMES WERE NOT DERIVED, so nothing may be written:\n` +
        `     ${error.message}\n\n`,
    );
    return error.code;
  }
  for (const line of plan.lines) process.stderr.write(`[promotion-faces] ${line}\n`);
  for (const w of plan.writes) process.stdout.write(`${w.env}\t${w.value}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
