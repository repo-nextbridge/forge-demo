// ★★ A COST WITHOUT A DATE IS A COST THAT AGES IN SILENCE — the docs' durations, held to their measurements.
//
//   node --test bin/cost-dates.guard.mjs      (or: bash bin/test.sh)
//
// ⛔ THE DEFECT THIS HOLDS, MEASURED 2026-10-10 (RESULTADOS-dx0 N11). Nine places in this repository said a
// birth was "19 min 17 s" (one bench run of 2026-09-04) or that warming was "~1h10" (no dated run at all),
// while the births measured that day on the same bench took 23–35 min and a deployed box 80–97 min. Each
// copy was true once; none of them said WHEN, so none of them could be seen to age.
//
// THREE RULES, and what each one reaches, said out loud:
//
//   1. THE TABLE. README "⏱ What it costs", between `<!-- costs:begin` and `<!-- costs:end -->`, is the one
//      place a cost lives. Every row carries a date (YYYY-MM-DD) and a machine; a row that says
//      "not measured" is the only one allowed a dash.
//   2. THE RETIRED NUMBERS. "19 min 17 s", "~19 min(utes)" and "~1h10" may not come back as a claim — in the
//      docs, the scripts' comments or their help. They may appear only with a date on the same line or the
//      next one to it, which is how the history of a number is told ("until 2026-10-10 …").
//   3. AN UNDATED COST IN THE DOCS. A markdown paragraph that talks about a birth, a seed or a warming and
//      quotes a cost-shaped duration ("~21 min", "19 min 17 s", "2h10", "40 minutes") must carry a date — in
//      itself or in one of the three paragraphs before it (a table under a dated sentence) — or cite the
//      table. ⚠️ This one is a HEURISTIC over prose: it reads markdown only (comments in scripts are prose
//      too, and they are reached by rule 2 alone — the scripts quote durations of timeouts and ceilings far
//      too often for a shape to tell them from costs); and a constant's value (`= 5 minutes`) is not a cost.
//      It caught six undated or stale paragraphs on the tree it was written against.
//
// ⚠️ These rules read PROSE on purpose: the defect is a sentence, not code.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tracked = (...globs) =>
  execFileSync('git', ['ls-files', ...globs], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\b/;
const CITES_TABLE = /What it costs/;
const RETIRED = /19 min 17 s|~\s?19 min(?:utes)?\b|~\s?1h10\b/i;
const TOPIC = /\b(birth|born|nasc\w*|warm\w*|aquec\w*|box-up|seed-demo|step 9|passo 9)\b/i;
const DUR =
  /(?<!= )(?:(?:~|≈)\s?\d+(?:[.,]\d+)?\s?(?:min|minutes|minutos|h)\b|\b\d+h\d+\b|\b\d+\s?min\s?\d+\s?s\b|\b\d+(?:[.,]\d+)?\s?(?:minutes|minutos)\b)/i;

/** This file names the retired numbers in order to refuse them; the private-trace fixture is a fictional
 * document about a trace, not a claim about this box. */
const NOT_CLAIMS = new Set(['bin/cost-dates.guard.mjs', 'bin/private-trace.guard.mjs']);

/** Paragraphs of a text, each with the line it starts on. Comment markers are kept: rule 2 reads them. */
function paragraphs(text) {
  const out = [];
  let line = 1;
  for (const p of text.split(/\n[ \t]*(?:(?:#|\/\/)[ \t]*)?\n/)) {
    out.push({ p, line });
    line += p.split('\n').length + 1;
  }
  return out;
}

/** Rule 3 over one markdown text: the paragraphs that quote a cost with no date near them. */
export function undatedCosts(text) {
  const ps = paragraphs(text);
  return ps
    .filter(({ p }, i) => {
      if (!TOPIC.test(p) || !DUR.test(p)) return false;
      const near = ps.slice(Math.max(0, i - 3), i + 1).map((x) => x.p);
      return !near.some((q) => DATE.test(q) || CITES_TABLE.test(q));
    })
    .map(({ p, line }) => `${line}: ${p.match(DUR)[0]} — ${p.slice(0, 110).replace(/\s+/g, ' ')}`);
}

/** Rule 2 over one text: the lines that carry a retired number with no date on them or on a neighbour. A
 * line window, not a paragraph: a long comment block always holds SOME date, and that date says nothing about
 * the number. */
export function retiredClaims(text) {
  const lines = text.split('\n');
  return lines.flatMap((l, i) =>
    RETIRED.test(l) && !lines.slice(Math.max(0, i - 1), i + 2).some((n) => DATE.test(n))
      ? [`${i + 1}: ${l.match(RETIRED)[0]} — ${l.trim().slice(0, 110)}`]
      : [],
  );
}

function costTable() {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const m = readme.match(/<!-- costs:begin[^\n]*-->\n([\s\S]*?)\n<!-- costs:end -->/);
  assert.ok(m, 'README.md lost its `<!-- costs:begin … -->` / `<!-- costs:end -->` markers — the one table of costs');
  return m[1]
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*(what|---)/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

test('every row of the cost table carries a date and a machine', () => {
  const rows = costTable();
  assert.ok(rows.length >= 5, `the cost table parsed to ${rows.length} row(s); the guard would grade nothing`);
  for (const [what, measured, when, where] of rows) {
    if (/not measured/.test(measured)) continue;
    assert.match(when, /^\d{4}-\d{2}-\d{2}$/, `"${what}" (${measured}) has no date — a cost that cannot age visibly`);
    assert.ok(where && where !== '—', `"${what}" (${measured}) does not say on which machine`);
  }
});

test('the retired numbers do not come back as claims', () => {
  const files = tracked('README.md', '*.md', 'docs', 'bin', '.env.example').filter(
    (f) => /\.(md|sh|mjs|example)$/.test(f) && !NOT_CLAIMS.has(f),
  );
  assert.ok(files.length > 50, `only ${files.length} file(s) found to read`);
  const bad = files.flatMap((f) => retiredClaims(readFileSync(join(ROOT, f), 'utf8')).map((x) => `${f}:${x}`));
  assert.deepEqual(bad, [], 'a retired cost is quoted again without a date. Cite README "What it costs" instead.');
});

test('a markdown paragraph that quotes a birth / seed / warming cost carries a date or cites the table', () => {
  const files = tracked('README.md', 'docs').filter((f) => f.endsWith('.md'));
  const bad = files.flatMap((f) => undatedCosts(readFileSync(join(ROOT, f), 'utf8')).map((x) => `${f}:${x}`));
  assert.deepEqual(bad, [], 'an undated cost. Add the date and machine, or point at README "What it costs".');
});

test('the rules are not vacuous: each one refuses its own shape and lets the dated one through', () => {
  assert.equal(undatedCosts('A birth on this bench takes ~19 min.').length, 1);
  assert.equal(undatedCosts('A birth on this bench took 28,6 min on 2026-10-10.').length, 1 - 1);
  assert.equal(undatedCosts('Measured 2026-09-15:\n\n| gesto | relógio |\n|---|---|\n| nascer | ~21 min |').length, 0);
  assert.equal(undatedCosts('Step 8 caps the seed at `DEFAULT_ACTION_TIMEOUT_MS` = 5 minutes.').length, 0);
  assert.equal(retiredClaims('# a pipeline burned ~1h10 of warming').length, 1);
  assert.equal(retiredClaims('until 2026-10-10 this said "19 min 17 s"').length, 0);
  assert.equal(retiredClaims('# Measured 2026-10-10 on a bench.\n#\n# Elsewhere: warming costs ~1h10.').length, 1);
});
