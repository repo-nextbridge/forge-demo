// ★★ THE ROUTES THE LAYOUTS CANNOT REACH — where a fork forgets a refusal and nothing says so.
//
// ── THE DEFECT, MEASURED IN THIS REPOSITORY 2026-09-08, IN SOURCE ────────────────────────────────────────
//
//     apps/storefront/src/app/sitemap.ts:35   (the reference, at the pinned commit)
//         if ((await readClient().storeFlags(store))?.storefront_enabled === false) return [];
//     storefront-coffee/src/app/sitemap.ts    (this fork)
//         — the line is not there —
//
// A store may exist without having a public page (`storefront_enabled === false`: a counter, a wholesale
// desk, a test store). Every URL of such a store answers 404, because `requirePublicStorefront` is mounted in
// both store-scoped trees. `sitemap.xml` IS NOT IN THOSE TREES — the middleware matcher excludes it, and the
// route sits above every `[store]` segment — so the layouts' refusal cannot reach it and the route has to ask
// for itself. The reference asks. The fork did not, and handed a crawler the store's whole list of URLs:
// categories, CMS pages, products, brands, collections — every one of them a 404.
//
// ── WHY NO EXISTING GUARD SAW IT, WHICH IS THE POINT OF THIS FILE ────────────────────────────────────────
//
// `bin/store-mount-drift.guard.mjs` and `bin/fork-chrome-drift.guard.mjs` are both jurisdiction'd on the
// STORE-SCOPED trees — `src/app/<tree>/[store]/…` — and they say so themselves, in their own headers. They
// are not blind by bug; they are blind by DESIGN, and correctly: a store-scoped layout is the one file every
// store URL of a tree passes through, so a rule mounted there covers the whole front cheaply.
//
// The routes that are NOT under a `[store]` segment are precisely the ones that fall outside that bargain:
// nothing frames them, so whatever they refuse they refuse in their own body. That complement is this file's
// jurisdiction, and it is DERIVED as the complement — `src/app/**` minus every path containing `[store]` —
// so it can never disagree with the two guards next door about where one ends and the other begins.
//
// ⇒ Fixing `sitemap.ts` alone would have left the next forgotten route exactly as invisible as this one was.
// The slice is the line AND the eye.
//
// ── WHAT THIS GUARD ASKS ────────────────────────────────────────────────────────────────────────────────
//
//     "Did this fork forget a refusal the reference makes, on a route no layout can refuse for it?"
//
// A REFUSAL, defined structurally so that no route and no function is ever typed out here:
//
//   · it is asked of the PORT — the value comes from a binding this file imported from `@forgecommerce/*`,
//     directly (`resolveStoreForHost(host)`) or through the read client (`readClient().storeFlags(store)`).
//     The kit is the shared, versioned surface, which is the only thing a fork can fall BEHIND on; a file's
//     own `@/lib` is its own business. Same boundary `store-mount-drift` draws, reached from another side.
//   · and it decides an EARLY RETURN out of an EXPORTED handler — `if (…) return …`, either testing the call
//     itself or testing a `const` the handler bound it to. Only the exported function can decide whether the
//     route answers at all; a module-private helper returning early is a fallback inside an answer, not a
//     refusal of one. That distinction is what keeps this rule from drifting into "diff the two trees",
//     which was measured to be 74 differing files and would be switched off within a week.
//
// So the rule reads the REFERENCE's own routes out of the pinned release tree, derives the refusals it makes
// there, and requires the fork's file at the same path to make them too. This file names no route, no
// function and no flag. `storeFlags` is caught today because the reference refuses on it; whatever the
// reference starts refusing on next month is caught by this file unchanged.
//
// ⚠️ A RED HERE IS NOT AUTOMATICALLY "GO COPY THE PRODUCT". It says the reference grew a refusal on a route
// nothing else can refuse for, and this fork did not follow. The fork's owner may answer "I do not want it",
// in DIVERGENCES below. What he is not allowed to do is not know.
//
// ⚠️ IT COMPARES SOURCE, so it proves the ASKING and never the response. What the fork actually serves is
// proven by the fork's own suite (`storefront-coffee/src/app/sitemap.test.ts`), which `bin/test.sh` reaches
// through `bin/fork-suite.guard.mjs`.
//
//   node --test bin/fork-refusal-drift.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/fork-refusal-drift.guard.mjs

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import test from 'node:test';
import { surfaceForks, surfaces } from './forks.mjs';
import { pinnedCommit, releaseTree } from './release-tree.mjs';

const say = (line) => console.error(`[fork-refusal] ${line}`);

/** The scope whose modules ARE the product's rules out here. A fork installs these by name; everything else
 *  it imports is its own file, and its own file is its own business. */
const KIT_SCOPE = '@forgecommerce/';

/**
 * ★ THE REFUSALS THIS FORK HAS DECIDED NOT TO ADOPT — empty today, and it is the affordance that makes the
 * failure message honest. Without it "refuse it" is advice with nowhere to go, and the only way to silence a
 * red would be to delete the rule, which silences the next one too.
 *
 * One entry per refusal: `{ fork, route, question, why }`. Every entry is PRINTED on every run, so a
 * divergence can never be quietly permanent; and an entry naming a refusal the reference no longer makes is
 * RED, so a waiver outlives its reason by exactly one run.
 */
const DIVERGENCES = [
  {
    fork: 'storefront-coffee',
    route: 'src/app/sitemap.ts',
    question: 'instanceReadClient().storeFlags',
    // ⚠️ DECLARADA NO CORTE DO pk35, 14/09, e a razão é de TAMANHO, não de desacordo.
    //
    // A `pk35/p9` tirou o sitemap da REFERÊNCIA da face anônima: ele caminhava em `readClient()` e gastava o
    // balde do COMPRADOR daquela loja — e numa loja grande demais para caber no cache a caminhada roda em TODA
    // requisição (55 chamadas por requisição a 50 000 produtos; oito visitas de robô num minuto gastam a janela
    // inteira de que as páginas do comprador vivem). Ela trocou por `instanceReadClient()`.
    //
    // O fork faz A MESMA PERGUNTA — `storeFlags` antes de servir — só que pela face antiga. ⇒ ⛔ não é uma loja
    // servindo o que o produto recusa: é a MESMA recusa, comprada com o orçamento errado.
    //
    // ⛔ POR QUE NÃO FOI FEITO AQUI, dito de frente: trocar a chamada é uma linha, mas o fork carrega a PRÓPRIA
    // cópia da caminhada (`src/lib/sitemap-data.ts`) e a própria suíte — medido no corte: 26 testes vermelhos,
    // porque o mock do módulo conhece só a face antiga. Adotar a face de verdade é a mesma fatia que a `p9` fez
    // do outro lado, com o mesmo cuidado, e o corte não é hora de escrevê-la cansado.
    //
    // ★ O QUE ISSO CUSTA HOJE, medido pela `p9` na bancada: 6 chamadas por MISS = 1,5 % da janela daquela loja,
    // no máximo 12× por hora, e ZERO em regime quente. ⇒ risco de mecanismo, sem estrago hoje — e o número que
    // justifica a fatia é o da loja grande, que esta demo não tem.
    why:
      'THE SAME REFUSAL, BOUGHT WITH THE WRONG BUDGET. pk35/p9 moved the reference sitemap off the anonymous ' +
      'face so a crawler stops spending the shopper rate-limit window; this fork asks the identical ' +
      '`storeFlags` question, still through `readClient()`. Adopting the instance face here is one line in ' +
      'the route and a slice in the fork: it carries its own `src/lib/sitemap-data.ts` and its own suite (26 ' +
      'tests go red, the module mock knows only the old face). Measured cost today: 6 port calls per cache ' +
      'MISS, 1.5% of that store window, at most 12 times an hour, ZERO while warm.',
  },
];

const PINNED = pinnedCommit();
const TREE = PINNED ? releaseTree(PINNED) : { tried: [] };
const FORKS = surfaceForks(TREE);

// ── reading a route ─────────────────────────────────────────────────────────────────────────────────────

/** Comments are prose ABOUT the refusal; only the code refuses. Stripped before anything is matched, so a
 *  commented-out guard cannot satisfy the rule and prose describing one cannot satisfy the call. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * ★★ NEXT'S BOUNDARY FILES ARE NOT ROUTES, AND THIS RULE IS ABOUT ROUTES — corrected pk32/d3.
 *
 * `error.tsx`, `global-error.tsx` and `not-found.tsx` answer no URL: they render INSIDE one, after it has
 * already decided to fail. "Did this route refuse before answering?" is not a question about them, and the
 * reserved names are Next's own, so this is a property of the framework rather than a list somebody typed.
 *
 * ⛔ IT IS A CORRECTION OF A FALSE ACCUSATION, MEASURED 2026-09-10. pk31/p1 taught the reference's
 * `src/app/error.tsx` to branch on `isCeilingRefusalDigest(error.digest)` — a kit binding deciding an early
 * return out of an exported function, which is exactly the SHAPE this file calls a refusal. It is not one: the
 * value comes from the `digest` Next hands the boundary, nothing is asked of the port, and a boundary that
 * does not branch serves an apology rather than something "nobody should be served". The drift went unseen
 * only because this fork had no boundary at all, so the route answered NOT CHECKED; the day pk32/d3 gave it
 * one, this guard failed naming `src/app/error.tsx → isCeilingRefusalDigest` — a fork that asks the SAME
 * question, through a weld, because the kit ships `src/ceiling-digest.ts` and does not publish the subpath.
 *
 * ⇒ a red here would have been about the guard's own over-capture, and `DIVERGENCES` could not carry it: that
 * mechanism prints "does NOT refuse on X", which would be a false sentence on every run.
 *
 * ★ AND WHAT GRADES A BOUNDARY INSTEAD IS STRICTLY STRONGER, in each fork's own suite:
 * `storefront-coffee/src/busy-boundary.guard.test.tsx` and `totem/src/busy-boundary.guard.test.tsx` RENDER
 * every boundary they find on disk with a ceiling refusal and with a 503 and grade the bodies — which is the
 * lesson pk31/p1 paid for, where reading the source left an unused import satisfying the rule.
 */
const BOUNDARY_FILES = new Set(['error.tsx', 'global-error.tsx', 'not-found.tsx']);

/**
 * Every route module of a surface that NO store-scoped layout can refuse for: `src/app/**` minus every path
 * that contains a `[store]` segment, minus Next's boundary files (above — they are not routes). The
 * subtraction is the whole jurisdiction, written as a subtraction on purpose — the two sibling guards own the
 * paths this one drops, and a new tree tomorrow lands on exactly one side of the line without anybody choosing.
 */
function unframedRoutes(base) {
  const app = join(base, 'src', 'app');
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(relative(base, full));
    }
  };
  walk(app);
  return out
    .filter((rel) => !rel.split(sep).includes('[store]'))
    .filter((rel) => !BOUNDARY_FILES.has(rel.split(sep).at(-1)))
    .sort();
}

/** The VALUE bindings a file takes from the kit, as `local name → exported name`. `import type` is skipped:
 *  a type is erased at build time, so a fork that does not need the annotation is not a fork missing a rule.
 *  The exported name is what gets REPORTED, so an alias on either side cannot make two files disagree. */
function kitBindings(source) {
  const map = new Map();
  for (const [, typeOnly, clause, spec] of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    if (typeOnly || !spec.startsWith(KIT_SCOPE)) continue;
    for (const part of clause.split(',')) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith('type ')) continue;
      const [exported, local] = trimmed.split(/\s+as\s+/).map((s) => s.trim());
      map.set(local ?? exported, exported);
    }
  }
  return map;
}

/** From `index`, the balanced span that starts at the next `open` character. Returns `[inner, endIndex]`. */
function balanced(text, index, open, close) {
  const start = text.indexOf(open, index);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return [text.slice(start + 1, i), i];
  }
  return null;
}

/**
 * The bodies of the module's EXPORTED functions — `export function`, `export default function` and
 * `export const NAME = (…) => {…}`, async or not. This is the "who may refuse" half of the definition: only
 * the exported handler decides whether the route answers.
 */
function exportedBodies(text) {
  const out = [];
  const signature = /export\s+(?:default\s+)?(?:(?:async\s+)?function\s*\*?\s*\w*\s*\(|(?:const|let)\s+\w+\s*(?::[^=]+)?=\s*(?:async\s*)?\()/g;
  for (const match of text.matchAll(signature)) {
    const params = balanced(text, match.index + match[0].length - 1, '(', ')');
    if (!params) continue;
    const body = balanced(text, params[1], '{', '}');
    if (body) out.push(body[0]);
  }
  return out;
}

/**
 * The port questions a snippet ASKS: a kit binding called, reported by its exported name; and, when that call
 * is immediately dotted into (`readClient().storeFlags(…)`), the METHOD, because the client is one binding
 * and the questions asked through it are many — reporting only `readClient` would call the fork even with the
 * refusal gone.
 */
function questions(snippet, kit) {
  const found = new Set();
  for (const [local, exported] of kit) {
    for (const [, method] of snippet.matchAll(new RegExp(`\\b${local}\\s*\\(\\s*\\)\\s*\\.\\s*(\\w+)\\s*\\(`, 'g'))) {
      found.add(`${exported}().${method}`);
    }
    if (new RegExp(`\\b${local}\\s*\\((?!\\s*\\)\\s*\\.)`).test(snippet)) found.add(exported);
  }
  return found;
}

/** The `if (…) return …` conditions of a body — the "what counts as refusing" half. A block form counts when
 *  the block returns without opening one of its own; anything deeper is a branch, not a refusal. */
function refusalConditions(body) {
  const out = [];
  for (const match of body.matchAll(/\bif\s*\(/g)) {
    const cond = balanced(body, match.index, '(', ')');
    if (!cond) continue;
    const after = body.slice(cond[1] + 1);
    if (/^\s*return\b/.test(after) || /^\s*\{[^{}]*\breturn\b/.test(after)) out.push(cond[0]);
  }
  return out;
}

/**
 * ★ THE REFUSALS A ROUTE MAKES, as exported kit names. A question counts when the condition asks it directly,
 * or when the handler bound it to a `const` the condition then tests — `const store = await
 * resolveStoreForHost(req.host); if (!store) return [];` is one refusal in two statements, and reading only
 * the condition would see a bare identifier and miss every refusal shaped like the two in this very file's
 * subject.
 */
function refusals(source) {
  const text = code(source);
  const kit = kitBindings(text);
  const found = new Set();
  if (kit.size === 0) return found;
  for (const body of exportedBodies(text)) {
    const bound = new Map();
    for (const [, name, expression] of body.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)) {
      const asked = questions(expression, kit);
      if (asked.size > 0) bound.set(name, asked);
    }
    for (const cond of refusalConditions(body)) {
      for (const question of questions(cond, kit)) found.add(question);
      for (const [name, asked] of bound) {
        if (new RegExp(`\\b${name}\\b`).test(cond)) for (const question of asked) found.add(question);
      }
    }
  }
  return found;
}

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (TREE.path) {
  say(`the reference read from: ${TREE.path} @ ${TREE.head.slice(0, 9)} (${TREE.how})`);
} else if (PINNED) {
  say(`⚠️ NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say("   set FORGE_MONOREPO=<the release's checkout>. Nothing below can compare this fork to anything.");
}
say(`forks of a packed surface: ${FORKS.map((f) => `${f.dir} (cut of ${f.surface.dir})`).join(', ') || 'none'}`);
for (const d of DIVERGENCES) say(`declared divergence: ${d.fork}/${d.route} does NOT refuse on ${d.question} — ${d.why}`);

// ── the rule ────────────────────────────────────────────────────────────────────────────────────────────

test('a Forge checkout at the pinned commit was found (otherwise nothing here is a measurement)', (t) => {
  if (!PINNED) {
    t.skip('NOT CHECKED — forge.lock no longer names a branch@sha, so there is no tree to read');
    return;
  }
  if (!TREE.path) {
    t.skip(`NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine (set FORGE_MONOREPO)`);
    return;
  }
  assert.ok(surfaces(TREE).length > 0, `${TREE.path} has no scripts/publishing/surfaces.json entries to map a fork to`);
});

test('⛔ THE VACUUM CHECK (forks) — this repository owns at least one fork of a packed surface', (t) => {
  if (!TREE.path) {
    t.skip('NOT CHECKED — without the release tree there is no table of packed surface names to match against');
    return;
  }
  assert.ok(
    FORKS.length > 0,
    'no directory of this repo has a package.json `name` matching a `packedName` in the release\'s ' +
      'scripts/publishing/surfaces.json — either the fork left, or it was renamed and this rule lost it',
  );
});

for (const fork of FORKS) {
  const referenceBase = join(TREE.path, fork.surface.dir);
  /** Every unframed route of the reference that refuses on the port, and what it refuses on. */
  const jurisdiction = new Map();
  for (const rel of unframedRoutes(referenceBase)) {
    const asked = refusals(readFileSync(join(referenceBase, rel), 'utf8'));
    if (asked.size > 0) jurisdiction.set(rel, [...asked].sort());
  }

  test(`⛔ THE VACUUM CHECK (routes) — ${fork.surface.dir} still refuses on the port outside its store trees`, () => {
    // Without this, a reference whose refusals moved, were renamed, or were read out of the wrong tree would
    // leave `jurisdiction` empty and the rule below would pass by having no subject. That is the quietest way
    // a sweep dies, and this repository has paid for it before (`bin/fork-suite.guard.mjs`, the third fork).
    assert.ok(
      jurisdiction.size > 0,
      `no route under ${fork.surface.dir}/src/app outside a [store] segment refuses on a ${KIT_SCOPE}* call. ` +
        'Either the reference stopped refusing out there — in which case this whole file is about nothing ' +
        'and must be re-derived — or the tree above is not the one that was baked.',
    );
    for (const [rel, asked] of jurisdiction) say(`${fork.surface.dir}/${rel} refuses on: ${asked.join(', ')}`);
  });

  test(`⛔ the boundary exclusion is SURGICAL — ${fork.surface.dir} still answers for its real routes`, (t) => {
    if (!TREE.path) {
      t.skip('NOT CHECKED — without the release tree there is nothing to derive a jurisdiction from');
      return;
    }
    // ⚠️ A NARROWING PROVES ITSELF OR IT IS A SWITCH-OFF WEARING A COMMENT. `BOUNDARY_FILES` took three names
    // out of the sweep; these two assertions are what keep that from having taken the subject with them.
    const routes = [...jurisdiction.keys()];
    assert.ok(
      routes.some((rel) => jurisdiction.get(rel).some((q) => q.endsWith('storeFlags'))),
      `no unframed route of ${fork.surface.dir} refuses on \`storeFlags\` any more. That is THE case this file ` +
        'was written for (the sitemap handing a crawler the URLs of a store with no public page), so either ' +
        'the reference moved it or the jurisdiction above narrowed past its own subject. Routes found: ' +
        `${routes.join(', ') || 'none'}`,
    );
    const boundaries = routes.filter((rel) => BOUNDARY_FILES.has(rel.split(sep).at(-1)));
    assert.deepEqual(
      boundaries,
      [],
      'a Next boundary file is back in the jurisdiction of a rule about ROUTES. A boundary answers no URL — ' +
        'it renders inside one that already failed — so "did it refuse before answering?" is not a question ' +
        `about it. What grades a boundary is each fork's own render guard (busy-boundary.guard.test.tsx). ` +
        `Leaked: ${boundaries.join(', ')}`,
    );
  });

  test(`${fork.dir}: every declared divergence still names a refusal the reference makes`, () => {
    const stale = DIVERGENCES.filter(
      (d) => d.fork === fork.dir && !jurisdiction.get(d.route)?.includes(d.question),
    );
    assert.deepEqual(
      stale.map((d) => `${d.route} → ${d.question}`),
      [],
      `${fork.dir}: a declared divergence names a refusal the reference no longer makes. The reason it was ` +
        'written for is gone; delete the entry rather than leave a waiver nobody can read.',
    );
  });

  test(`★★ ${fork.dir} makes every refusal the reference makes where no layout can make it for it`, (t) => {
    if (jurisdiction.size === 0) {
      t.skip('NOT CHECKED — the vacuum check above already failed; there is no jurisdiction to apply');
      return;
    }
    const behind = [];
    for (const [rel, asked] of jurisdiction) {
      const forkFile = join(fork.path, rel);
      if (!existsSync(forkFile)) {
        // A fork may delete a route outright; then it serves no URL there and there is nothing to refuse.
        // Said out loud rather than passed over, so the sweep never looks like it opened a file it did not.
        say(`${fork.dir}: NOT CHECKED — no ${rel} (the reference serves that route and this fork does not)`);
        continue;
      }
      const mine = refusals(readFileSync(forkFile, 'utf8'));
      for (const question of asked) {
        if (mine.has(question)) continue;
        if (DIVERGENCES.some((d) => d.fork === fork.dir && d.route === rel && d.question === question)) continue;
        behind.push(`${rel} → ${question}`);
      }
    }

    assert.deepEqual(
      behind,
      [],
      `${fork.dir} ANSWERS WHERE THE REFERENCE REFUSES:\n${behind.map((b) => `    · ${b}`).join('\n')}\n\n` +
        '  These routes sit outside every [store] segment, so no store-scoped layout refuses for them and\n' +
        '  neither sibling guard has jurisdiction over them — whatever they refuse, they refuse in their own\n' +
        '  body. The reference asks the port before answering and this fork does not, which means the fork\n' +
        '  serves something the product has already decided nobody should be served.\n\n' +
        '  Two ways out, and both are decisions: ask the same question in the fork\'s route, or declare the\n' +
        '  divergence in DIVERGENCES at the top of this file, with a reason somebody can read.',
    );
  });
}
