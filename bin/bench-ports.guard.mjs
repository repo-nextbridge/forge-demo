// ★★ ONE BENCH PORT, ONE NUMBER — and `.env.example` is the one that says it.
//
// THE DEFECT, MEASURED 2026-09-07 (pk23/D2; found by pk22/balcao and not fixed there). The counter's HTTP
// door was declared in five places and three of them disagreed. Line numbers are `0f0141c`'s — the state
// BEFORE this slice moved them:
//
//   .env.example:231          FORGE_TOTEM_HTTP_PORT=8203        the declaration
//   bin/box-up.sh:737-739     ${FORGE_TOTEM_HTTP_PORT:-8203}    the tailnet lookup
//   bin/box-up.sh:1626        ${FORGE_TOTEM_HTTP_PORT:-8203}    the bench summary the operator reads
//   README.md:735             http://localhost:8203             the bench's address table
//   compose.override.yml:166  ${FORGE_TOTEM_HTTP_PORT:-8102}    ⇐ WHAT ACTUALLY PUBLISHES
//   README.md:1306/1320       8102                              ⇐ and a second half of the README
//   caddy/Caddyfile.local:181 "(8102 by default)"               ⇐ and the edge's own comment
//
// Measured with `docker compose --env-file <.env.example minus that one line> config`: `published: "8102"`.
// So WITH a `.env` the five agree and nothing is wrong; WITHOUT the variable the box publishes 8102 while
// every document, and the summary the birth itself prints, announce 8203. A number that only agrees once the
// operator already has everything right is a number that bites exactly the virgin box.
//
// The history says which one is the truth: `97c0da7` created the totem on 8102, and `b9142c8` ("two tenants,
// four stores") moved the bench's doors into the 82xx family — 8200 shop, 8201/8202 admins, 8243 https,
// 8203 counter — by editing `.env.example` ALONE. The other places were left on the old number. 8203 is the
// decision; 8102 is what a half-applied rename left behind. Proof it is now one number: with that variable
// removed from the env file, `docker compose config` publishes `8203` on target 82, which is what the live
// bench (`forge-preseed-caddy-1`, born WITH a `.env`) already had.
//
// ★ AND A SIXTH PLACE FELL OUT OF WRITING THE RULE GENERALLY: `caddy/Caddyfile.local:17-19` told an operator
// to put `FORGE_HTTP_PORT=8080` in `.env` while `.env.example` ships 8200 — the same species, a door away.
//
// ── WHAT THIS GUARD HOLDS ───────────────────────────────────────────────────────────────────────────────
//   0. IT SEES ITS SUBJECTS   — the declarations are derived from `.env.example`, and every graded file must
//                               exist and yield something. Pointed at a compose that no longer reads the
//                               counter's port, it goes RED naming itself instead of passing on an empty set.
//   1. ONE VARIABLE, ONE NUM  — every `${FORGE_*_PORT:-N}` fallback in THE BOX'S OWN files equals the number
//                               `.env.example` declares. The message names both numbers and both files.
//   2. THE DOCUMENTS AGREE    — a document that writes a number next to a port variable writes THAT number.
//   3. THE ADDRESSES EXIST    — every `http://localhost:<port>` a document hands out is a port this box
//                               publishes. This is the rule that catches "Open http://localhost:8102", which
//                               names no variable at all and is what a human actually pastes.
//   4. TWO DOORS, TWO NUMBERS — no two port variables declare the same value.
//
// ⚠️ `compose.yml` IS DELIBERATELY NOT GRADED, and this is a decision, not an oversight. That file says of
// itself that it began as `templates/instance/compose.yml` and is the PRODUCT's shape; its fallbacks are what
// a DEPLOYMENT gets (`:-80`, `:-443`) and a deployment's edge is not this bench. `compose.override.yml` is
// the BOX's file — its own header says so — and the ports it publishes are inert in a deployment (the
// production Caddyfile has no `:82` site), so its fallback only ever acts on a bench and must be the bench's
// number. If `compose.yml` is ever made the bench's file too, move it into `gradedFallbackFiles()` on purpose.
//
// ⚠️ THIS FILE IS THE THING THAT KEEPS THE FIVE IN AGREEMENT. There is no templating that could make them
// literally one string — a checked-in compose file and a README cannot read `.env.example` — so agreement is
// asserted, not derived. Deleting this guard puts the box back where 2026-09-07 found it.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const SOURCE_OF_TRUTH = '.env.example';

/** The box's own files, whose port fallbacks act on THIS bench. See the header for why `compose.yml` is out. */
function gradedFallbackFiles() {
  const shell = readdirSync(join(ROOT, 'bin'))
    .filter((name) => name.endsWith('.sh'))
    .sort()
    .map((name) => `bin/${name}`);
  return ['compose.override.yml', ...shell];
}

/** What a human reads to find a door. Derived under `docs/`, so a page joins the rules by existing. */
function gradedDocuments() {
  const pages = readdirSync(join(ROOT, 'docs'), { recursive: true })
    .filter((name) => String(name).endsWith('.md'))
    .sort()
    .map((name) => `docs/${name}`);
  return ['README.md', 'caddy/Caddyfile.local', ...pages];
}

/**
 * The documents rule 3 grades for BARE addresses (`http://localhost:<port>`, naming no variable).
 *
 * ⚠️ `caddy/Caddyfile.local` is deliberately NOT among them, and it is the one carve-out in this file. Its
 * header quotes a MEASUREMENT — `GET /admin → 307 Location: http://localhost:8080/login` — taken back when
 * the bench published 8080. Rewriting a recorded measurement so a guard goes green is the one thing this
 * house does not do, so rule 3 does not ask it to. Rule 2 still holds that file to the declared number
 * wherever it names a variable, which is where its claims about THIS bench live.
 */
const DOCUMENTS_WITH_ADDRESSES = (documents) =>
  documents.filter((file) => file !== 'caddy/Caddyfile.local');

function read(relative) {
  const path = join(ROOT, relative);
  assert.ok(existsSync(path), `${relative} is gone — this guard grades files that must exist`);
  const text = readFileSync(path, 'utf8');
  assert.notEqual(text.trim(), '', `${relative} is empty — nothing to grade is not the same as nothing wrong`);
  return text;
}

/**
 * Line number (1-based) of a character OFFSET — not of the first line that happens to contain the same text.
 * `bin/box-up.sh` reads the counter's port on four different lines; a message that names 737 four times sends
 * whoever fixes it to one of them and leaves the other three.
 */
function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/** THE ONE SOURCE: `FORGE_*_PORT=<n>` in `.env.example`. Everything below is graded against this map. */
function declaredPorts() {
  const source = read(SOURCE_OF_TRUTH);
  const out = new Map();
  for (const match of source.matchAll(/^(FORGE_[A-Z0-9_]*_PORT)=(\d+)\s*$/gm)) {
    out.set(match[1], { port: Number(match[2]), line: lineAt(source, match.index) });
  }
  return out;
}

/** Every `${FORGE_*_PORT:-N}` in one file, with the line it sits on. */
function fallbacks(relative) {
  const source = read(relative);
  const out = [];
  for (const match of source.matchAll(/\$\{(FORGE_[A-Z0-9_]*_PORT):-(\d+)\}/g)) {
    out.push({ variable: match[1], port: Number(match[2]), line: lineAt(source, match.index) });
  }
  return out;
}

/**
 * Every place a document writes a NUMBER as the value of a port variable: `VAR=8102`, `${VAR} (8102 by
 * default)`. Four digits with a word boundary, within 60 characters of the name and on the same line — `:82`
 * (a container's listener) and `pk23` are not port claims and must not be read as any.
 */
function statedPorts(relative) {
  const source = read(relative);
  const out = [];
  source.split('\n').forEach((text, index) => {
    for (const named of text.matchAll(/FORGE_[A-Z0-9_]*_PORT/g)) {
      const window = text.slice(named.index + named[0].length, named.index + named[0].length + 60);
      const number = window.match(/(?<![\d.])(\d{4})(?![\d.])/);
      if (number) out.push({ variable: named[0], port: Number(number[1]), line: index + 1 });
    }
  });
  return out;
}

const DECLARED = declaredPorts();
const GRADED_FALLBACK_FILES = gradedFallbackFiles();
const GRADED_DOCUMENTS = gradedDocuments();

// ── 0. IT SEES ITS SUBJECTS ─────────────────────────────────────────────────────────────────────────────

test('★ the declarations exist at all, and the counter is among them', () => {
  // ⚠️ ANTI-VACUITY FIRST. A guard whose subject list is empty passes every rule below in silence, which is
  // the failure mode the pk18 rename already cost this house once.
  assert.ok(DECLARED.size > 0, `${SOURCE_OF_TRUTH} declares no FORGE_*_PORT — this guard is grading nothing`);
  assert.ok(
    DECLARED.has('FORGE_TOTEM_HTTP_PORT'),
    `${SOURCE_OF_TRUTH} no longer declares FORGE_TOTEM_HTTP_PORT — the counter's door was this guard's whole reason`,
  );
});

test('★ compose still PUBLISHES the counter through that variable', () => {
  // ⚠️ THE VACUUM CASE, spelled out. `compose.override.yml` is what actually opens the door; if it stops
  // reading the variable, rule 1 has nothing to compare and would go green over a box whose port moved.
  const found = fallbacks('compose.override.yml').filter((f) => f.variable === 'FORGE_TOTEM_HTTP_PORT');
  assert.ok(
    found.length > 0,
    'compose.override.yml no longer publishes the counter through ${FORGE_TOTEM_HTTP_PORT:-<port>}. Either the door moved (say where, here) or this guard just went blind.',
  );
});

test('the box has files that read a port with a fallback, and this guard reads them', () => {
  const seen = GRADED_FALLBACK_FILES.flatMap((file) => fallbacks(file));
  assert.ok(seen.length > 0, 'no ${FORGE_*_PORT:-N} anywhere in the box files — the scan lost its subjects');
  assert.ok(
    GRADED_FALLBACK_FILES.includes('bin/box-up.sh'),
    'bin/box-up.sh is not in the graded set — the birth script is where the operator READS the address',
  );
});

// ── 1. ONE VARIABLE, ONE NUMBER ─────────────────────────────────────────────────────────────────────────

test('★★ every fallback in the box files is the number `.env.example` declares', () => {
  const divergent = [];
  for (const file of GRADED_FALLBACK_FILES) {
    for (const entry of fallbacks(file)) {
      const declared = DECLARED.get(entry.variable);
      if (!declared) {
        divergent.push(
          `${entry.variable} falls back to ${entry.port} in ${file}:${entry.line} and ${SOURCE_OF_TRUTH} declares it nowhere`,
        );
        continue;
      }
      if (declared.port !== entry.port) {
        divergent.push(
          `${entry.variable}: ${entry.port} in ${file}:${entry.line} but ${declared.port} in ${SOURCE_OF_TRUTH}:${declared.line}`,
        );
      }
    }
  }
  assert.deepEqual(
    divergent,
    [],
    `a bench port has two numbers. With a \`.env\` present they agree and nothing looks wrong; WITHOUT the variable the box publishes one number while the documents and the birth summary announce the other.\n  ${divergent.join('\n  ')}`,
  );
});

// ── 2. THE DOCUMENTS AGREE ──────────────────────────────────────────────────────────────────────────────

test('★★ a document that writes a number next to a port variable writes THAT number', () => {
  const wrong = [];
  for (const file of GRADED_DOCUMENTS) {
    for (const entry of statedPorts(file)) {
      const declared = DECLARED.get(entry.variable);
      if (!declared) continue; // a variable this box does not declare is not this rule's business
      if (declared.port !== entry.port) {
        wrong.push(
          `${entry.variable}: ${entry.port} in ${file}:${entry.line} but ${declared.port} in ${SOURCE_OF_TRUTH}:${declared.line}`,
        );
      }
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `a document states a port the box does not use. The operator copies what the document says.\n  ${wrong.join('\n  ')}`,
  );
});

// ── 3. THE ADDRESSES EXIST ──────────────────────────────────────────────────────────────────────────────

test('★★ every `localhost:<port>` a document hands out is a door this box publishes', () => {
  // The rule that catches an address naming no variable — "Open http://localhost:8102" — which is exactly
  // the line a human pastes into a browser. See DOCUMENTS_WITH_ADDRESSES for the one file left out and why.
  const published = new Set([...DECLARED.values()].map((entry) => entry.port));
  const orphans = [];
  for (const file of DOCUMENTS_WITH_ADDRESSES(GRADED_DOCUMENTS)) {
    read(file)
      .split('\n')
      .forEach((text, index) => {
        for (const match of text.matchAll(/localhost:(\d{2,5})/g)) {
          if (!published.has(Number(match[1]))) orphans.push(`${file}:${index + 1} → ${match[0]}`);
        }
      });
  }
  assert.deepEqual(
    orphans,
    [],
    `a document hands out an address no port variable in ${SOURCE_OF_TRUTH} publishes. Nothing answers there.\n  ${orphans.join('\n  ')}`,
  );
});

// ── 4. TWO DOORS, TWO NUMBERS ───────────────────────────────────────────────────────────────────────────

test('no two port variables declare the same number', () => {
  const byPort = new Map();
  for (const [variable, entry] of DECLARED) {
    byPort.set(entry.port, [...(byPort.get(entry.port) ?? []), variable]);
  }
  const shared = [...byPort]
    .filter(([, variables]) => variables.length > 1)
    .map(([port, variables]) => `${port}: ${variables.join(' and ')}`);
  assert.deepEqual(
    shared,
    [],
    `two doors want one port; the second bind fails and compose refuses the whole stack.\n  ${shared.join('\n  ')}`,
  );
});
