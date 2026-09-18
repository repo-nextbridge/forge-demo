// ★★★ THE GUARD THAT KEEPS THE DELIVERY PUBLIC — and the one that must never cry wolf.
//
// `bin/private-trace.mjs` is the scanner and carries the reasoning; this file is the verdict, the vacuum
// check and the fixtures. What it asserts, in one line:
//
//     ⛔ WHAT IS PRIVATE DOES NOT ENTER WHAT IS DELIVERED.
//
// This repository is BSL / source-available. A name, a chat message, an attribution or a personal address
// that reaches a tracked file is PUBLISHED — and a test title or an `assert` message is published twice, in
// the file and in the output of every run.
//
// ── ⚠️ WHY THIS GUARD IS THE LAST THING WRITTEN, not the first ────────────────────────────────────────────
// It is born on a tree that was already cleaned. On a dirty one it would be red on arrival, and the first
// thing anybody would do is widen it until it was green — which is how a rule becomes a decoration. Written
// last, its green is a MEASUREMENT, and every later finding is a real one.
//
// ── ⛔ AND WHY THE FIXTURES ARE BUILT AT RUN TIME FROM THE COMMIT REGISTER ─────────────────────────────────
// A sabotage needs a real name to be a sabotage. Typing one here would publish, in a tracked file, the exact
// thing this guard exists to keep out — the guard would be the leak, and it would be the leak in the most
// quoted file in the repository. ⇒ every fixture below composes its name from `humanTokens()`, which reads
// `git log`. THIS FILE SPELLS NO PERSON'S NAME, and it still proves the axis.
//
//   node --test bin/private-trace.guard.mjs      (or: bash bin/test.sh)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

import { AXIS, MIN_REASON, RULE_SOURCES, humanTokens, report, scanRepo, scanText } from './private-trace.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The register, read once: it is what the fixtures are built out of and what the name axis grades against. */
const REGISTER = humanTokens(ROOT);
/**
 * The two shapes of the register a fixture needs.
 *
 * `NAME` is the longest token that is one plain word — a fixture reads like the prose it imitates. `SHORT` is
 * the shortest token there is, and it is the one the word-boundary control needs: the short token is the one
 * that hides inside longer ordinary words, so it is the one a missing boundary would betray.
 */
const NAME = [...REGISTER.tokens].filter((t) => /^\p{L}+$/u.test(t)).sort((a, b) => b.length - a.length)[0] ?? '';
const SHORT = [...REGISTER.tokens].sort((a, b) => a.length - b.length)[0] ?? '';

const scan = (src) => scanText(src, { tokens: REGISTER.tokens, path: 'fixture' }).findings;
const axes = (src) => scan(src).map((f) => f.axis);
const shown = (src) => report(scan(src));

// ── 1 · THE ANTI-VACUUM, AND IT COMES FIRST ───────────────────────────────────────────────────────────────
//
// ⛔ A population of nothing is a green that graded nothing, and that is the failure this whole pack was paid
// for. So before a single line of this repository is judged, these prove there is something to judge.

test('★★★ THE VACUUM: a checkout with nothing tracked is REFUSED, never reported clean', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-private-empty-'));
  try {
    execFileSync('git', ['-C', dir, 'init', '-q']);
    assert.throws(
      () => scanRepo(dir),
      /nothing is tracked/i,
      'a repository with no files scanned clean — a guard that grades an empty population is a guard that ' +
        'passes anything the day someone narrows what it looks at.',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★★ THE SECOND VACUUM: files but NO register of humans is REFUSED — the name axis would grade nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-private-noreg-'));
  try {
    execFileSync('git', ['-C', dir, 'init', '-q']);
    writeFileSync(join(dir, 'a.md'), 'a delivered file\n');
    execFileSync('git', ['-C', dir, 'add', 'a.md']);
    assert.throws(
      () => scanRepo(dir),
      /register of humans .* is EMPTY/i,
      'a checkout with no history was graded anyway. With no register there are no name tokens, so the name ' +
        'axis matches nothing and every file passes it — green, and blind.',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★ the register this tree derives is usable: at least one token, none of them short enough to be a word', () => {
  assert.ok(
    REGISTER.tokens.length > 0,
    `no name token could be derived from this repository's commit graph (${REGISTER.authors.length} author ` +
      'identity/identities read). The name axis is blind.',
  );
  for (const t of REGISTER.tokens) {
    assert.ok(t.length >= 4, `the token ${JSON.stringify(t)} is short enough to appear inside ordinary prose`);
  }
  // …and the ORGANISATION is not in it. A company name is in every hostname this box publishes; forbidding it
  // would make the guard red on arrival and loosened by lunchtime.
  for (const org of REGISTER.orgs) {
    assert.ok(!REGISTER.tokens.includes(org), `${JSON.stringify(org)} is the organisation, not a person`);
  }
});

test('★★★ THE SCAN REACHES THE WHOLE DELIVERY — counted, not assumed', () => {
  const { files, scanned, bytes } = scanRepo(ROOT);
  assert.ok(files.length > 500, `only ${files.length} tracked file(s) were collected — the population shrank`);
  assert.ok(scanned.length > 500, `only ${scanned.length} file(s) were actually read`);
  assert.ok(bytes > 1_000_000, `only ${bytes} byte(s) of text were read — something excluded most of the tree`);

  // Landmarks, one per KIND of delivered file, because an exclusion never removes the whole tree — it removes
  // a corner, and a count alone would not notice.
  for (const landmark of [
    'README.md',
    'bin/box-up.sh',
    'bin/seed.mjs',
    'docs/operations/runbook-demo.md',
    'compose.yml',
    'seed/commerce.mjs',
    'storefront-coffee/src/middleware.ts',
    'apps/demo-gate/block/gate.tsx',
  ]) {
    assert.ok(scanned.includes(landmark), `${landmark} is delivered and was not read`);
  }
  for (const ext of ['md', 'mjs', 'ts', 'tsx', 'json', 'sh', 'yml', 'css']) {
    assert.ok(
      scanned.some((f) => f.endsWith(`.${ext}`)),
      `no .${ext} file was read, and this repository delivers them`,
    );
  }
  // ★ A photograph's BYTES are not text and are skipped; its NAME is delivered prose and is not.
  assert.ok(files.some((f) => f.endsWith('.jpg') || f.endsWith('.png')), 'no image is tracked — the path axis has no subject');
  assert.ok(!scanned.some((f) => f.endsWith('.png')), 'an image was read as text');
});

// ── 2 · THE VERDICT ON THIS TREE ──────────────────────────────────────────────────────────────────────────

test('★★★ nothing private is in what this repository delivers', () => {
  const { findings, held } = scanRepo(ROOT);
  assert.deepEqual(
    findings,
    [],
    `the delivery carries ${findings.length} private trace(s):\n${report(findings)}\n\n` +
      'Each one is a real finding: this tree was at zero when the rule was written, so ⛔ do NOT widen the ' +
      'rule to make this green. Say the reason as a fact in the file\'s own voice, or — if the value is ' +
      'FUNCTIONAL and cannot be fictional — declare it beside itself with `forge-private-ok: <why>`.',
  );
  // ⚠️ Not an assertion, a report: an exception nobody re-reads is an exception that outlives its reason.
  for (const h of held) console.error(`[private-trace] held at ${h.path}:${h.line} [${h.axis}] — ${h.reason}`);
});

// ── 3 · THE SABOTAGES — each one red, and each one NAMING the thing ───────────────────────────────────────
//
// ⚠️ Every fixture below is composed from `NAME`, which came out of `git log` a moment ago. Nothing here is
// typed, which is why this file can be read by the customer it protects.

test('★★★ SABOTAGE — a person in a TEST TITLE is red (the CI prints this one to the world)', () => {
  const found = scan(`test('the case ${NAME} reported is red', () => {});\n`);
  assert.equal(found.length, 1, `a name in a test title was not found:\n${shown(`test('${NAME}', () => {})`)}`);
  assert.equal(found[0].axis, AXIS.NAME);
  assert.ok(found[0].evidence.toLowerCase().includes(NAME), 'the finding does not quote what it found');
  assert.equal(found[0].line, 1);
});

test('★★★ SABOTAGE — a person in a MULTI-LINE assert message is red, and named on the line that carries them', () => {
  // ⛔ THE SHAPE THAT ESCAPED FIVE CLEAN-UP SLICES: the `assert` is on one line and the person is two lines
  //    below it, inside a concatenated message. A per-line grep of the call sees nothing.
  const src = [
    "assert.equal(chosen.id, 'adu_owner',",
    "  'the key would redeem into a colleague instead of ' +",
    `    'the account ${NAME} signed the release with — see the slice report.',`,
    ');',
  ].join('\n');
  const found = scan(src);
  assert.equal(found.length, 1, `a name inside a wrapped assert message was not found:\n${shown(src)}`);
  assert.equal(found[0].axis, AXIS.NAME);
  assert.equal(found[0].line, 3, 'the finding does not name the line the person is actually on');
});

test('★★★ SABOTAGE — an UPPER-CASED person is red: this rule is case-insensitive or it is nothing', () => {
  // ⛔ Nine occurrences escaped a case-sensitive sweep of a repository this size, all of them at the start of
  //    a sentence or in a shouted heading.
  const src = `// ${NAME.toUpperCase()} MEASURED THIS ON THE BENCH.\n`;
  assert.deepEqual(axes(src), [AXIS.NAME], `an upper-cased name was not found:\n${shown(src)}`);
});

test('★★★ SABOTAGE — a person in a `.md` is red (documentation is delivered too)', () => {
  const src = `# O nascimento\n\nMedido em 2026-09-01: a caixa nasce em ~19 min, conferido por ${NAME}.\n`;
  assert.deepEqual(axes(src), [AXIS.NAME], `a name in prose was not found:\n${shown(src)}`);
});

test('★★★ SABOTAGE — an ATTRIBUTED «…» citation is red, and the attribution is what makes it one', () => {
  // ★ THE ONE THAT PROVES THE AXIS EXISTS SEPARATELY. There is no name here and no pronoun: only a decision
  //   hung on a role and a sentence somebody typed beside it. A role may carry a decision (see the negative
  //   controls); the transcript of the conversation is not the decision.
  // ⚠️ THE ROLE HERE IS `o tech lead` ON PURPOSE. It used to be `o dono do produto`, which is now a person by
  //   itself, and a fixture carrying two findings could not prove that THIS axis is the one that fired.
  const src =
    '// Por decisão do tech lead: «nascer caixa ou aquecer será feito de madrugada, nada a corrigir».\n';
  const found = scan(src);
  assert.deepEqual(found.map((f) => f.axis), [AXIS.QUOTE], `an attributed conversation quote was not found:\n${shown(src)}`);
  assert.ok(found[0].evidence.includes('madrugada'), 'the finding does not quote the sentence it refuses');
});

test('★★★ SABOTAGE — a citation that OPENS on one line and CLOSES on the next is red just the same', () => {
  // ⛔ The flattening exists for this: a comment wraps at 110 columns and the closing `"*` lands below.
  const src = ['// Decisão dele, e o que ela diz é *"o café ganha portaria? Sim ganha', '// portaria"*.'].join('\n');
  const found = scan(src);
  assert.ok(
    found.some((f) => f.axis === AXIS.QUOTE),
    `a quotation broken across two comment lines was not found:\n${shown(src)}`,
  );
});

test('★★★ SABOTAGE — `His` with a capital, attributing a call to a person, is red', () => {
  const src = '// His own call, and it is the reason this file stopped deriving the ceiling from the clock.\n';
  assert.deepEqual(axes(src), [AXIS.PRONOUN], `a capitalised possessive attribution was not found:\n${shown(src)}`);
});

test('★★★ SABOTAGE — `o dono decidiu` is red, and it is the OWNER WHO ACTS that makes it so', () => {
  const src = '//    e o aquecimento numa segunda entrada de cron. Madrugada, como o dono decidiu.\n';
  const found = scan(src);
  assert.deepEqual(found.map((f) => f.axis), [AXIS.PRONOUN], `an acting owner was not found:\n${shown(src)}`);
  assert.ok(found[0].evidence.includes('dono'), 'the finding does not quote the attribution');
});

test('★★★ SABOTAGE — `o dono do produto` is red WITH NO VERB IN SIGHT, and this is the hole the rule had', () => {
  // ⛔ THE SHAPE THAT SURVIVED FOUR CLEAN-UP PASSES OVER THIS REPOSITORY and stood SIX times in one delivered
  //    runbook (measured 2026-09-15). Rule B exempts `o dono DE algo` because a record, a tag and an order
  //    have many holders — but that exemption only asked for a PREPOSITION, and the product has exactly one
  //    holder. Nobody acts in either line below, so the acting-owner rule never looked at them.
  for (const src of [
    '// os quatro digests são de imagens construídas na estação de trabalho do dono do produto.\n',
    '// Quando a Demo ganhar o staging dela (card no roadmap do dono do produto, no vault), a sequência muda.\n',
    '// Ditada pelo dono do produto e conferida contra a doutrina do ciclo de vida.\n',
  ]) {
    assert.deepEqual(axes(src), [AXIS.PRONOUN], `an owner OF THE PRODUCT was read as a domain role:\n${shown(src)}`);
  }
});

test('★★★ SABOTAGE — the same possession in English: `the owner of the product`, `the product owner`', () => {
  for (const src of [
    '// The ceiling derives from the plan, as the owner of the product settled it.\n',
    '// Baked on the product owner’s workstation from a branch, never from a registry.\n',
    '// O roadmap da plataforma é do dono da plataforma e não mora neste repositório.\n',
  ]) {
    assert.ok(
      axes(src).includes(AXIS.PRONOUN),
      `an owner of the product/platform was read as a domain role:\n${shown(src)}`,
    );
  }
});

test('★★★ SABOTAGE — a QUALIFIED decision noun still attributes the citation beside it', () => {
  // ⛔ ONE ADJECTIVE WAS ENOUGH TO LOSE A TRANSCRIPT. `Veredicto ANTERIOR do …` put a word between the noun
  //    and the preposition, the attribution rule stopped matching, and the sentence somebody typed next to it
  //    went green for want of anything attributing it. The tail still has to end on a role, so nothing
  //    looser gets in with it.
  const src =
    '⇒ **Veredicto anterior do tech lead sobre a LENTIDÃO:** *"nascer caixa ou aquecer será feito de\n' +
    'madrugada. Então nada a corrigir"*.\n';
  assert.ok(
    scan(src).some((f) => f.axis === AXIS.QUOTE),
    `a citation hung on a QUALIFIED decision noun was not found:\n${shown(src)}`,
  );
});

test('★★ SABOTAGE — `ele pediu` / `ele decidiu` are red, and a THING doing something is not', () => {
  assert.deepEqual(axes('// O Outlet deixa a prateleira vazia (ele pediu uma PLP limpa).\n'), [AXIS.PRONOUN]);
  assert.deepEqual(axes('// O cookie vale para as seis lojas? AINDA não é o que ele decidiu.\n'), [AXIS.PRONOUN]);
});

test('★★★ SABOTAGE — personal data: an address, a home directory, a handle', () => {
  const mail = `${NAME}@${(REGISTER.orgs[0] ?? 'somewhere')}.pro`;
  assert.ok(
    scan(`const FROM = '${mail}';\n`).some((f) => f.axis === AXIS.DATA || f.axis === AXIS.NAME),
    `a person's e-mail was not found: ${mail}`,
  );
  const home = scan(`// measured on 2026-09-08 from /home/${NAME}/projetos/forge-demo\n`);
  assert.ok(home.some((f) => f.axis === AXIS.DATA), `a \`/home/<user>\` path was not found:\n${report(home)}`);
  const handle = scan('// the announcement lives on twitter, at @some_person_handle.\n');
  assert.deepEqual(handle.map((f) => f.axis), [AXIS.DATA], `a social handle beside its network was not found`);
});

test('★★ SABOTAGE — a media file NAMED after somebody is red on its PATH, whose bytes are never read', () => {
  const path = `seed/photos/foto-do-${NAME}.jpg`;
  const found = scanText(path, { tokens: REGISTER.tokens, path }).findings;
  assert.deepEqual(found.map((f) => f.axis), [AXIS.NAME], `a photograph named after a person was not found: ${path}`);
});

// ── 4 · THE DECLARED EXCEPTION, AND THE HOLE IT MUST NOT BECOME ───────────────────────────────────────────

test('★★★ an exception is declared BESIDE the value, with its reason — and it holds the finding', () => {
  const src = `const OPERATOR = '${NAME}@invited.pro'; // forge-private-ok: functional, this mailbox receives the OTP\n`;
  const { findings, held } = scanText(src, { tokens: REGISTER.tokens, path: 'fixture' });
  assert.deepEqual(findings, [], `a declared exception did not hold:\n${report(findings)}`);
  assert.ok(held.length > 0, 'the exception was applied but not recorded — an unrecorded hold is invisible');
  assert.match(held[0].reason, /receives the OTP/, 'the reason is not carried with the hold');
});

test('★★★ …and an exception whose REASON is gone is RED, naming the marker', () => {
  // ⛔ An exception without a reason is a path in an ignore list wearing a comment: nobody can tell, later,
  //    whether the value is still functional. The rule dies the day it becomes unfalsifiable.
  const src = `const OPERATOR = '${NAME}@invited.pro'; // forge-private-ok\n`;
  const found = scan(src);
  assert.ok(
    found.some((f) => f.axis === AXIS.HOLE),
    `an exception with no reason was accepted:\n${shown(src)}`,
  );
  assert.ok(
    found.some((f) => f.why.includes(String(MIN_REASON))),
    'the refusal does not say how much reason it wanted',
  );
});

// ── 5 · THE NEGATIVE CONTROLS — being wrong HERE is worse than not existing at all ────────────────────────
//
// ⛔ Each of these is something this repository is FULL of. A guard that reddens them gets loosened or
// deleted within a day, and then the four axes above protect nothing.

test('★★★ CONTROL — a PT-BR SCREEN STRING IN QUOTES STAYS GREEN. It names a value, not a person.', () => {
  for (const src of [
    '// `end_text` stays «Compra Segura» and is now the picture\'s accessible name.\n',
    '// O passo recusa e diz *"required variable FORGE_TOTEM_STORE_ID is missing a value"*.\n',
    '// A vitrine responde *"O app não fez isso."* quando o plano não existe.\n',
    '// O login devolveu «This address is not registered on this instance» — medido em 2026-09-09.\n',
    '// A portaria mostra «Loja de demonstração» e a conta diz "Você não tem pedidos".\n',
  ]) {
    assert.deepEqual(scan(src), [], `a screen string was refused — translating it would make the comment LIE ` +
      `about the string:\n${shown(src)}`);
  }
});

test('★★★ CONTROL — `the owner` / `o dono` AS A ROLE stays green. An owner OF something is not a person.', () => {
  for (const src of [
    '// the owner of the record is the phase, not the shop.\n',
    "// What the owner owns is `/assets/...`, and it is a prefix on purpose.\n",
    '// ★ TWO CAUSES, ONE OWNER — establishing the owner was the most valuable part of the measurement.\n',
    "test('★★ the OWNER is picked out of a tenant with colleagues, never whoever sorts first', () => {});\n",
    '| `forge.lock` com imagem por tag | o dono da tag repontar os bytes debaixo da sua instância |\n',
    '// `ownerAssets` holds the files the store owner uploaded; `owner_entity` names the row that owns them.\n',
    '// A tabela tem two owners e o último escreve por cima — a pergunta é quem escreve DEPOIS de mim.\n',
  ]) {
    assert.deepEqual(scan(src), [], `a domain role was read as a person:\n${shown(src)}`);
  }
});

test('★★★ CONTROL — a DATE OF MEASUREMENT stays. This repository is built out of them.', () => {
  for (const src of [
    '// ⛔ THE DEFECT, MEASURED ON THE BENCH 2026-09-08: the step exited non-zero on its first pass.\n',
    '// Medido em 04/09, duas corridas completas pelo tailnet, mesmo resultado.\n',
    '// ★ Desde 02/09 a resposta é TODO app que a plataforma oferece (17) mais os dois desta caixa.\n',
  ]) {
    assert.deepEqual(scan(src), [], `a measurement date was read as a conversation:\n${shown(src)}`);
  }
});

test('★★★ CONTROL — a ROLE may carry a decision. `the tech lead` is a role, and it has no name in it.', () => {
  // ⚠️ THE THIRD LINE HERE USED TO READ `por decisão do dono do produto`, and it is a SABOTAGE now, not a
  //    control: a role is a function a team fills, and the product has exactly one owner. The line that
  //    replaces it is the same sentence hung on a role that stays one. See `OWNER_OF_THE_PRODUCT`.
  for (const src of [
    '// (Decision of the tech lead, pre-seed wave.)\n',
    '// survives a restart, which was the defect. (Approved by the tech lead, 2026-09-01.)\n',
    '// O passo 14 é um RELATÓRIO, não um portão — por decisão do arquiteto.\n',
  ]) {
    assert.deepEqual(scan(src), [], `an attribution to a role without a name was refused:\n${shown(src)}`);
  }
});

test('★★★ CONTROL — and the possession is what tells them apart: a RECORD, a TAG, an ORDER keep their role', () => {
  // ⛔ BEING WRONG HERE UNDOES THE RULE ABOVE. This repository is full of owners of things, and the sentence
  //    that makes `dono do produto` a person has to leave every one of them alone.
  for (const src of [
    '| `forge.lock` com imagem por tag | o dono da tag repontar os bytes debaixo da sua instância |\n',
    '// the owner of the record is the phase, not the shop; `o dono do pedido` is the shopper.\n',
    '// o dono da loja subiu o arquivo, e `ownerAssets` é onde ele fica.\n',
    '// the owner of the row that the projection writes is the tenant, never the request.\n',
  ]) {
    assert.deepEqual(scan(src), [], `an owner OF A DOMAIN OBJECT was read as a person:\n${shown(src)}`);
  }
});

test('★★★ CONTROL — Portuguese `ele`/`ela` standing for a THING stays green, and that is most of them', () => {
  // ⚠️ Portuguese has no `it`. Every step, column, variable and verdict in these documents is `ele` or `ela`,
  //    so a rule that read the pronoun alone as an attribution would accuse half the runbook.
  for (const src of [
    '// ⚠️ Desde 09/09 essa variável decide MAIS que as páginas: ela diz QUAL LOJA o fork é.\n',
    '// | a coluna health | `docker ps` | desde 09/09 ela é um veredicto, e não era |\n',
    '// Quando ele não consegue saber, diz que não sabe, e o veredicto deixa de ser "warm".\n',
    '// O guard `env-forwarding` do produto pega isto — e grada os 3 composes DELE, não este.\n',
    '// O cliente continua conseguindo começar o pedido dele com o mesmo toque de sempre.\n',
    '// A ordem dos widgets era decidida pela ordem de instalação: a posição de um widget É a ordem em que o app dele foi instalado.\n',
  ]) {
    assert.deepEqual(scan(src), [], `a thing was read as a person:\n${shown(src)}`);
  }
});

test('★★ CONTROL — English prose about a SHOPPER stays green: a pronoun is not an attribution', () => {
  for (const src of [
    "// The obvious alternative — \"a customer's catalogue is his own data, so it belongs in his repo\" — was\n// measured before it was rejected.\n",
    '// The group already decided that a customer who lands on a dead end keeps the café around him — header,\n// footer, and the store\'s own type.\n',
    '// In under three seconds he learns the only thing there is to know. Different knowledge, different page.\n',
  ]) {
    assert.deepEqual(scan(src), [], `prose about a shopper was read as an attribution:\n${shown(src)}`);
  }
});

test('★★ CONTROL — the fictional addresses, phones and placeholder paths this box ships stay green', () => {
  for (const src of [
    "  <li>E-mail: contato@loja.exemplo</li><li>WhatsApp: (11) 4000-3000</li>\n",
    "export FORGE_SMTP_FROM=\"${FORGE_SMTP_FROM:-hi@forgecommerce.pro}\"\n",
    "const FROM = 'balcao+r1nech@forge.demo';\n",
    '       from      /home/you/.local/bin/node\n',
    "import { HomeView } from '@/templates/home/HomeView';\n",
    "  const deps = 'react@18.3.1 react-dom@18.3.1';\n",
    '  case " $(store_host_names | tr \'\\n\' \' \') " in *" $FORGE_TAILNET_HOST "*) return 0 ;; esac\n',
  ]) {
    assert.deepEqual(scan(src), [], `a fictional value or a path that is not a home directory was refused:\n${shown(src)}`);
  }
});

test('★★ CONTROL — the name is matched as a WORD: it does not fire inside a longer one', () => {
  // ⛔ `\brenan\b`-without-a-boundary matching inside `drenando` is the shape that makes a guard untrustworthy:
  //    one absurd finding and the next reader stops reading the rest.
  const inside = `// o cano está d${SHORT}ndo a caixa, e ${SHORT}tes disso nada acontecia\n`;
  assert.deepEqual(scan(inside), [], `the register token fired inside a longer word:\n${shown(inside)}`);
});

test('★★ THE SELF-REFERENCE IS EXACTLY TWO FILES, and both are real — never an ignore list growing a third', () => {
  // The scanner and this guard spell the forbidden shapes on purpose, so they cannot be graded by them. That
  // exemption is the one thing here that could quietly become the ignore list the whole rule refuses, so it
  // is pinned: exactly two entries, both tracked, and both actually the rule's own source.
  assert.deepStrictEqual(
    [...RULE_SOURCES].sort(),
    ['bin/private-trace.guard.mjs', 'bin/private-trace.mjs'],
    'the rule may exempt its OWN source and nothing else — a third path here is an ignore list wearing a name',
  );
  const tracked = new Set(
    execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean),
  );
  for (const path of RULE_SOURCES) {
    assert.ok(tracked.has(path), `${path} is exempted from the rule and is not in the repository`);
  }
});
