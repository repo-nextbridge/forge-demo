// ★★★ WHAT IS PRIVATE DOES NOT ENTER WHAT IS DELIVERED.
//
// This repository is BSL / source-available: the customer, the partner and the product team READ these
// files. Everything tracked here is shipped, and a private record that reaches a tracked file is published
// the moment the box is handed over. This module is the scanner that says whether that happened; the verdict
// and the fixtures live next door in `private-trace.guard.mjs`.
//
//     node bin/private-trace.mjs            # scan this checkout, exit 1 on the first finding
//     node bin/private-trace.mjs <root>     # scan another checkout
//
// ── ★ FOUR AXES, AND THE ONE CONSTRAINT THAT SHAPED ALL OF THEM ───────────────────────────────────────────
//
// 1. A PERSON'S NAME — in code, in a comment, in a TEST TITLE, in an `assert` message, in JSX, in a string or
//    in a `.md`. Test titles and assert messages are the most exposed surface there is: they are printed by
//    every run of the suite, so they leave the repository even when nobody opens a file.
// 2. A QUOTED CONVERSATION — the sentence somebody typed in a chat, carried into a comment as evidence.
// 3. ATTRIBUTION BY PRONOUN — `he decided`, `His own rule`, `decisão dele`, `ele pediu`. No name is spelled
//    and the private record is carried all the same.
// 4. PERSONAL DATA — a person's e-mail, a `/home/<user>` path, a social handle, a media file named after
//    somebody.
//
// ⛔ AND THE CONSTRAINT: THIS FILE MAY NOT SPELL THE NAME IT FORBIDS. A denylist of real people, typed into a
// tracked file, publishes exactly what the rule exists to keep out — the guard would be the leak. So the
// names are DERIVED AT RUN TIME from the only durable register of humans this repository owns: its own commit
// graph (`git log`, author and committer). Authorship is metadata of the history, not content of the
// delivery, and it is already there for every clone. ⇒ the scanner knows the names; the source does not.
//
// ⚠️ WHAT THAT DERIVATION DOES NOT REACH, said out loud so nobody reads this guard as a promise it does not
// make: a person who never committed here — a customer contact, a colleague named only in prose — is not in
// the register and this axis will not see them. The other three axes are what stand between that case and the
// delivery, and a human reviewer is still the last one.
//
// ★ THE ORGANISATION IS NOT THE PERSON. The e-mail domain is where somebody works; the local part is who they
// are. So the domain's words are subtracted from the token set — otherwise the company's own name, which this
// box writes in every hostname, would be red on the first run and the guard would be loosened by lunchtime.
//
// ── ⛔ THE THREE THINGS THIS SCANNER MAY NOT REFUSE, because being wrong here is worse than not existing ───
//
// A. A PT-BR SCREEN STRING IN QUOTES (`«Compra Segura»`, `*"O app não fez isso."*`). It names a VALUE, not a
//    person. This repository is full of them and they are the reason a comment can be checked against the
//    product at all. ⇒ a quoted span is a finding only when something ATTRIBUTES it — a name, a pronoun, an
//    acting owner, or a decision phrase pointing at a person. An unattributed quote is prose, and prose is
//    the reviewer's job, not this file's.
// B. `the owner` / `o dono` AS A DOMAIN ROLE — of the order, of the store, of the instance, of the row, the
//    IAM role, `two owners` meaning two writers. Grep cannot derive that distinction, and a path allowlist
//    would not either. ⇒ THE VOCABULARY DERIVES IT: **an owner OF something is a role; an owner who ACTS is a
//    person.** `o dono da tag`, `the owner of the record`, `the owner's own files` — role, green. `o dono
//    abriu`, `the owner decided` — a human being did a human thing, red.
//    ⛔ AND THE POSSESSION CUTS BOTH WAYS, which is the half that was missing until 2026-09-15: a record, a
//    tag or an order has MANY holders, so the phrase names a role — but the PRODUCT, the platform, the
//    company, the repository have exactly one, so `o dono do produto` names the individual and no verb is
//    needed for it to. That shape survived four sweeps of this repository and stood six times in one
//    delivered runbook; see `OWNER_OF_THE_PRODUCT`.
// C. A DATE OF MEASUREMENT (`medido na bancada 2026-09-01`, `the birth of 13/09`). It is a durable record and
//    this repository is built out of them. A date is never evidence by itself here; it is only ever the
//    company a finding keeps.
//
// ── ★ THE SHAPES THAT COST THE CLEAN-UP SLICES THE MOST ───────────────────────────────────────────────────
//
// · EVERYTHING IS CASE-INSENSITIVE. `The owner`, `His`, an upper-cased name at the start of a sentence — nine
//   occurrences escaped a case-sensitive sweep of a small repository.
// · AN ASSERT MESSAGE IS MULTI-LINE, a `*"…"*` opens on one line and closes on the next, and `the owner` can
//   break across a wrap. ⇒ the text is FLATTENED before matching: comment markers are blanked out, newlines
//   are kept as whitespace, and every offset is preserved so a finding still names the line it starts on.
// · A WORD BOUNDARY IS NOT OPTIONAL: a five-letter name is inside longer ordinary words, and a bare substring
//   match would be red on a word nobody wrote about anybody.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** File extensions whose bytes are not text. The PATH of one is still graded — a photo can be named after a person. */
const BINARY = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'pdf', 'zip', 'gz', 'tgz', 'woff', 'woff2',
  'ttf', 'otf', 'eot', 'mp4', 'webm', 'mp3', 'wav', 'crt', 'key', 'der', 'p12',
]);

/**
 * The inline exception, and it is the ONLY way to hold a finding.
 *
 * ★ It is declared WHERE THE THING IS, with the reason beside it — never as a path in an ignore list. A path
 * in a list stops grading a whole file forever, silently, and nobody ever reads it again; a marker next to the
 * value is read by everyone who reads the value. ⛔ And a marker with no reason is a hole, so it is itself a
 * finding: this scanner goes red naming the marker that lost its reason.
 */
const PRAGMA = /forge-private-ok:\s*(.*)$/i;
const PRAGMA_BARE = /forge-private-ok\b/i;
/** A reason shorter than this is not a reason. */
export const MIN_REASON = 16;

const AXIS = {
  NAME: 'person-name',
  QUOTE: 'quoted-conversation',
  PRONOUN: 'attribution-by-pronoun',
  DATA: 'personal-data',
  HOLE: 'exception-without-reason',
};
export { AXIS };

/** A word boundary that understands accents — `\b` treats `ã` as a boundary and would split Portuguese words. */
const EDGE_L = '(?<![\\p{L}\\p{N}_])';
const EDGE_R = '(?![\\p{L}\\p{N}_])';
const word = (body, flags = 'giu') => new RegExp(`${EDGE_L}(?:${body})${EDGE_R}`, flags);

// ── THE REGISTER OF HUMANS ────────────────────────────────────────────────────────────────────────────────

/** Words that are an organisation, a tool or a protocol — never the person — wherever they come from. */
const NOT_A_PERSON = new Set(['noreply', 'no-reply', 'users', 'github', 'gitlab', 'local', 'localhost', 'bot']);

/**
 * The names this delivery may not carry, derived from the commit graph rather than typed here.
 *
 * Returns `{ tokens, orgs, authors }`. A token is matched as a whole word, case-insensitively: the given
 * name, the surname, the e-mail's local part and its pieces, the local part with its separators removed, and
 * the full name with any of `. _ -` or space between its words.
 *
 * ⚠️ Tokens shorter than four characters are dropped. `ana`, `li`, `du` inside ordinary prose would be red on
 * every line of a Portuguese document, and a guard that is red everywhere is a guard that gets deleted.
 */
export function humanTokens(root) {
  let raw = '';
  try {
    raw = execFileSync('git', ['-C', root, 'log', '--format=%an%x00%ae%x00%cn%x00%ce'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    return { tokens: [], orgs: [], authors: [], why: `git log could not be read in ${root}: ${err.message}` };
  }
  const authors = new Set();
  const orgs = new Set();
  const tokens = new Set();
  const fields = raw.split(/[\0\n]/).map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < fields.length; i += 2) {
    const name = fields[i];
    const mail = fields[i + 1] ?? '';
    authors.add(`${name} <${mail}>`);
    const at = mail.indexOf('@');
    const local = at > 0 ? mail.slice(0, at) : '';
    const domain = at > 0 ? mail.slice(at + 1) : '';
    // ★ The domain is the ORGANISATION. Its words are subtracted below, never forbidden.
    for (const piece of domain.split(/[.\-_]/)) if (piece.length >= 3) orgs.add(piece.toLowerCase());
    const parts = [];
    for (const piece of name.split(/[\s._\-]+/)) parts.push(piece);
    for (const piece of local.split(/[.\-_+]/)) parts.push(piece);
    for (const piece of parts) {
      const t = piece.toLowerCase();
      if (t.length >= 4 && !NOT_A_PERSON.has(t)) tokens.add(t);
    }
    if (local && local.length >= 4) {
      tokens.add(local.toLowerCase());
      tokens.add(local.toLowerCase().replace(/[.\-_]/g, ''));
    }
    const nameWords = name.split(/[\s._\-]+/).filter((w) => w.length >= 3);
    if (nameWords.length > 1) tokens.add(nameWords.join(' ').toLowerCase());
  }
  for (const o of orgs) tokens.delete(o);
  return { tokens: [...tokens].filter((t) => !orgs.has(t)), orgs: [...orgs], authors: [...authors] };
}

/** One regex for the whole register: each token, with `.`/`_`/`-`/space interchangeable inside it. */
function tokenRe(tokens) {
  if (tokens.length === 0) return null;
  const bodies = tokens
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((t) => t.split(/[\s._\-]+/).map(esc).join('[\\s._\\-]{0,2}'));
  return word(bodies.join('|'));
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── FLATTENING ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Blank out line-leading comment markers, keeping every byte offset exactly where it was.
 *
 * ⚠️ Length-preserving ON PURPOSE. A finding has to be able to say `file:line`, and the cheapest way to keep
 * that true through a rewrite is to never change a length: the marker becomes spaces, the newline stays a
 * newline, and the offset of a match in the flattened text is the offset of the same text in the file.
 */
export function flatten(src) {
  const out = src.split('\n').map((line) => {
    const m = /^(\s*)(\/\/+|#+|\*+|--|<!--)(\s|$)/.exec(line);
    if (!m) return line;
    return line.slice(0, m[1].length) + ' '.repeat(m[2].length) + line.slice(m[1].length + m[2].length);
  });
  return out.join('\n');
}

function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return starts;
}

function lineOf(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

const squeeze = (s) => s.replace(/\s+/g, ' ').trim();

// ── THE VOCABULARIES ──────────────────────────────────────────────────────────────────────────────────────
//
// ⚠️⚠️ THE ONE THING THAT DECIDES WHETHER THIS GUARD SURVIVES ITS FIRST WEEK: **Portuguese `ele`/`ela` ARE
// NOT `he`/`she`.** English prose calls a thing `it`, so `his`/`her` in this repository is almost always a
// person. Portuguese has no `it`: every variable, column, step, box and verdict in these documents is `ele`
// or `ela`, and this repository is written that way on every page — *"a coluna health … ela é um veredicto"*,
// *"a variável … ela diz qual loja"*. Measured on this tree the first time the rule was written as a sentence
// window: 12 findings, 2 of them people. ⇒ THE PORTUGUESE RULE IS ADJACENCY TO A VERB ONLY A PERSON CONJUGATES
// — `ele pediu`, `ele decidiu`, `ela aprovou` — and possession of a DECISION — `decisão dele`, `achado dele`.
// ⛔ `diz` and `mostra` are deliberately absent: a step says things, a column shows them.

/**
 * English: the pronoun ADJACENT to the speech act, never merely in the same sentence.
 *
 * ⛔ THE SENTENCE WINDOW WAS TRIED FIRST AND IT ACCUSED A CORRECT COMMENT. `storefront-coffee/src/app/s/
 * [store]/(storefront)/error.tsx:3` reads *"The group already decided that a customer who lands on a dead end
 * keeps the café around him"* — a decision, and a `him`, and they have nothing to do with each other: the
 * `him` is the shopper. ⇒ an attribution is `he decided`, `his own call`, `settled by her` — the pronoun and
 * the act TOUCHING. Everything looser accuses prose about customers, of which this repository is made.
 */
const EN_ACT =
  'said|says|asked|asks|told|tells|decided|decides|named|names|settled|settles|accepted|accepts|approved|' +
  'approves|wanted|wants|ordered|orders|requested|requests|complained|complains|wrote|writes|vetoed|chose|picked';
const EN_SPOKEN_THING = 'words|word|call|rule|decision|order|verdict|opinion|sentence|request|wish|ask|say';
const EN_ATTRIBUTION = new RegExp(
  `${EDGE_L}(?:he|she)${EDGE_R}\\s+(?:also\\s+|just\\s+|never\\s+|then\\s+|later\\s+|already\\s+)?` +
    `${EDGE_L}(?:${EN_ACT})${EDGE_R}` +
    `|${EDGE_L}(?:his|her)${EDGE_R}\\s+(?:own\\s+)?${EDGE_L}(?:${EN_SPOKEN_THING})${EDGE_R}` +
    `|${EDGE_L}(?:${EN_ACT})${EDGE_R}\\s+by\\s+${EDGE_L}(?:him|her)${EDGE_R}`,
  'giu',
);

/**
 * Portuguese: the pronoun IMMEDIATELY followed by something only a person does.
 *
 * ⛔ `pedido` IS DELIBERATELY ABSENT FROM EVERY LIST HERE. In this domain it is an ORDER — `o pedido dele` is
 * the shopper's order on every page of the storefront — and a rule that read it as "his request" would accuse
 * the commerce vocabulary of carrying a private record.
 */
const PT_ACT =
  'pediu|pede|mandou|manda|decidiu|decide|decidira|aceitou|aprovou|liberou|autorizou|vetou|nomeou|escolheu|' +
  'quis|queria|quer|preferiu|prefere|reclamou|confirmou|achou|disse|respondeu|escreveu';
const PT_PRONOUN_ACT = new RegExp(
  `${EDGE_L}(?:ele|ela)${EDGE_R}\\s+(?:n[ãa]o\\s+|j[áa]\\s+|tamb[ée]m\\s+|s[óo]\\s+)?${EDGE_L}(?:${PT_ACT})${EDGE_R}`,
  'giu',
);
/** …and a DECISION that is somebody's: `decisão dele`, `achado dele`, `veredicto dela`. */
const PT_POSSESSED_DECISION = new RegExp(
  `${EDGE_L}(?:decis[ãa]o|veredicto|achado|palavra|vontade|escolha|ordem|autoriza[çc][ãa]o|aprova[çc][ãa]o)` +
    `${EDGE_R}\\s+(?:dele|dela)${EDGE_R}`,
  'giu',
);

/**
 * An owner who ACTS. See rule B in the header: this list holds only what a human being does — never `owns`,
 * `holds`, `is`, `was found`. And `o dono DE algo` is filtered out before the verb is ever looked for.
 */
const HUMAN_ACT =
  'abriu|viu|leu|clicou|decidiu|pediu|disse|falou|mandou|quis|queria|aceitou|aprovou|liberou|reclamou|' +
  'escolheu|achou|nomeou|confirmou|vetou|autorizou|' +
  'opened|saw|read|clicked|decided|asked|said|told|wanted|accepted|approved|chose|named|complained|settled';

/** `o dono`/`the owner` NOT followed by `of|do|da|de|'s` — an owner OF something is a role, and rule B keeps it. */
const ACTING_OWNER = new RegExp(
  `${EDGE_L}(?:o dono|a dona|the owner)(?!\\s+(?:do|da|de|dos|das|of)${EDGE_R})(?!['’]s)` +
    `[^.;!?\\n]{0,40}?${EDGE_L}(?:${HUMAN_ACT})${EDGE_R}`,
  'giu',
);

/**
 * ★★★ THE ONE POSSESSION THAT IS NOT A DOMAIN OBJECT: THE PRODUCT ITSELF. This is the refinement rule B was
 * missing, and it is the hole six occurrences walked through.
 *
 * ⛔ MEASURED ON THIS TREE 2026-09-15: `do dono do produto`, six times in one delivered runbook, after four
 * clean-up passes over this repository. Rule B derives a ROLE from the possession — `o dono da tag`, `the
 * owner of the record`, `o dono do pedido`, whoever holds that object — and the `of`-exemption in
 * `ACTING_OWNER` is what keeps those green. But that exemption only ever asked for a PREPOSITION, and `do
 * produto` is one. ⇒ the exemption written for domain objects swallowed the possession that is not one.
 *
 * ★ THE POSSESSION DECIDES, AND IT CUTS BOTH WAYS. A record, a tag, an order, a row: many holders, so the
 * phrase names a role. The product, the platform, the company, the repository: exactly ONE holder, and the
 * title identifies that individual as surely as spelling the name would.
 *
 * ⚠️ AND IT NEEDS NO VERB, which is the other half of why nothing saw it: `a estação de trabalho do dono do
 * produto` and `o roadmap do dono do produto` attribute a workstation and a private board to a person with
 * nobody doing anything, so `ACTING_OWNER` — which waits for a human act — never looked.
 *
 * ✅ `the tech lead`, `o arquiteto` STAY GREEN and must: a function a team fills, with no possession in it.
 * See the negative controls — reddening the roles this repository attributes design decisions to is how this
 * rule would get switched off.
 */
const SOLE_POSSESSION =
  'produto|product|plataforma|platform|empresa|company|neg[óo]cio|business|reposit[óo]rio|repository';
const OWNER_OF_THE_PRODUCT = new RegExp(
  `${EDGE_L}(?:don[oa]s?|owner)${EDGE_R}\\s+(?:d[oa]s?|of(?:\\s+the)?)\\s+(?:${SOLE_POSSESSION})${EDGE_R}` +
    `|${EDGE_L}(?:product|platform|company)\\s+owner${EDGE_R}`,
  'giu',
);

/**
 * A decision NAMED AS A PERSON'S — `Decision of the tech lead`, `approved by the tech lead`, `achado dele`.
 *
 * ✅ ON ITS OWN THIS IS NOT A FINDING. A role without a name is allowed to carry a decision; that is how a
 * decision stays attributable without a private record. It is here because it is what turns a QUOTE beside it
 * into a transcript: the role may hold the decision, but the sentence somebody typed is not the decision.
 *
 * ⚠️ AND THE TARGET MUST BE A PERSON OR A PERSON'S ROLE. Without that, `ordem de recriação` (the order the
 * steps run in) and `Decision of 2026-08-31` are attributions, which they are not.
 *
 * ⛔ AND THE NOUN MAY BE QUALIFIED, which is the second thing the runbook proved. `Veredicto ANTERIOR do dono
 * do produto: *"…"*` carried a transcript past this rule because one adjective stood between the noun and the
 * preposition, and the citation next to it went green for want of an attribution. ⇒ up to two words are
 * allowed to stand there; the tail still has to end on a person's role, so nothing looser gets in.
 */
const PERSON_ROLE = 'dono|dona|owner|tech lead|arquiteto|architect|product owner|dono do produto';
const QUALIFIER = '(?:\\s+\\p{L}+){0,2}?';
const ATTRIBUTED_DECISION = new RegExp(
  `${EDGE_L}(?:decision|decis[ãa]o|verdict|veredicto|approval|aprova[çc][ãa]o|ordem|achado|palavra|sentença)` +
    `${EDGE_R}${QUALIFIER}\\s+(?:(?:of|do|da|de|by|from)\\s+(?:the\\s+|o\\s+|a\\s+)?(?:${PERSON_ROLE})${EDGE_R}|` +
    `${EDGE_L}(?:dele|dela)${EDGE_R})|` +
    `${EDGE_L}(?:approved|decided|asked|settled|ordered|aprovado|decidido|autorizado)${EDGE_R}` +
    `\\s+(?:by|por)\\s+(?:the\\s+|o\\s+|a\\s+)?(?:${PERSON_ROLE})${EDGE_R}`,
  'giu',
);

/** A person's e-mail is one that is neither a role mailbox nor at an address reserved for fiction. */
const MAILBOX_ROLE =
  /^(hi|hello|ola|olá|oi|contato|contact|support|suporte|sac|help|ajuda|no-?reply|admin|administrator|operator|operador|balcao|balcão|vendas|sales|info|dev|team|equipe|postmaster|webmaster|billing|financeiro|press|imprensa|jobs|rh|security|abuse|root|user|test|example|demo|forge)$/i;
const RESERVED_DOMAIN =
  /(^|\.)(example|exemplo|test|invalid|localhost|local|demo|fake|dummy)$/i;
/** ⚠️ The last label must be ALPHABETIC: without that, `react@18.3.1` in a bundled support file is an address. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** A `/home/<user>` that is a real account rather than a stand-in for one. `templates/home/` is not a path root. */
const HOME_PATH = /(^|[^\w.$-])\/home\/([A-Za-z0-9_.$~{}<>-]+)/g;
const HOME_PLACEHOLDER =
  /^(you|user|username|usuario|usuário|me|someone|alguem|alguém|runner|ci|node|root|ubuntu|app|forge|\$user|\$\{user\}|<user>|<usuario>|~)$/i;

/** A social handle is only a handle when a network is standing next to it. */
const SOCIAL =
  /\b(twitter|instagram|linkedin|telegram|tiktok|threads|bluesky|mastodon|facebook)\b[^\n]{0,40}@([A-Za-z0-9_.]{3,})/gi;

/** A phone-shaped literal. On its own it is shop data — see `scanText` for the only company that reddens it. */
const PHONE = /(\+\d{2}\s?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]\d{4}/g;

/**
 * A quoted span, in the two shapes this house writes a quotation in.
 *
 * ⚠️ THE CONTENT MUST BE THREE WORDS AND MUST NOT BEGIN OR END IN WHITESPACE, and that is not tidiness: a
 * shell `case " $x " in *" $y "*)` is `*"…"*` too, and there are a dozen of them under `bin/`. A conversation
 * is a sentence; a glob is a word wrapped in spaces.
 */
const QUOTED = [/\*"([^"]{2,400})"\*/g, /«([^»]{1,400})»/g];
const IS_SENTENCE = /^\S[\s\S]*\s[\s\S]*\s[\s\S]*\S$/;

// ── THE SCAN ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every attribution in the text: a person named, a pronoun that decides, an owner who acts, a decision hung
 * on a role. Returned as spans so a quote can ask whether one stands OUTSIDE it.
 *
 * ⛔ OUTSIDE IS THE WHOLE POINT. A quoted screen string that happens to contain `ele` — and Portuguese screen
 * strings do — would otherwise attribute themselves, and the guard would refuse the values it exists to keep.
 */
function attributions(flat, names) {
  const found = [];
  const push = (kind, m, why) => found.push({ kind, start: m.index, end: m.index + m[0].length, text: squeeze(m[0]), why });
  if (names) for (const m of flat.matchAll(names)) push('name', m, 'a person from this repository\'s own commit register');
  for (const m of flat.matchAll(EN_ATTRIBUTION)) push('pronoun', m, 'a pronoun beside a speech act');
  for (const m of flat.matchAll(PT_PRONOUN_ACT)) push('pronoun', m, 'a pronoun doing something only a person does');
  for (const m of flat.matchAll(PT_POSSESSED_DECISION)) push('pronoun', m, 'a decision owned by a pronoun');
  for (const m of flat.matchAll(ACTING_OWNER)) push('owner', m, 'an owner who ACTS is a person; an owner OF something is a role');
  for (const m of flat.matchAll(OWNER_OF_THE_PRODUCT))
    push('owner', m, 'the owner OF THE PRODUCT is one individual — a record, a tag or an order has many holders, this has one');
  for (const m of flat.matchAll(ATTRIBUTED_DECISION)) push('decision', m, 'a decision hung on a person or a person\'s role');
  return found.sort((a, b) => a.start - b.start);
}

/**
 * Grade one file's text. `tokens` is the register from `humanTokens`; `path` only decorates the findings.
 *
 * Every rule runs on the FLATTENED text and reports the line the match STARTS on, so a `*"…"*` that opens at
 * the end of one comment line and closes on the next is named where a reader will find it.
 */
export function scanText(src, { tokens = [], path = '<text>' } = {}) {
  const flat = flatten(src);
  const starts = lineIndex(src);
  const rawLines = src.split('\n');
  const findings = [];
  const held = [];
  const names = tokenRe(tokens);

  const reason_ = (line) => {
    // The marker holds the line it is on and the line after it — an exception is written above or beside the
    // thing it excuses.
    for (const l of [line, line - 1]) {
      const text = rawLines[l - 1];
      if (text && PRAGMA_BARE.test(text)) {
        const reason = (PRAGMA.exec(text)?.[1] ?? '').trim();
        if (reason.length >= MIN_REASON) return reason;
      }
    }
    return null;
  };

  const add = (axis, offset, evidence, why) => {
    const line = lineOf(starts, offset);
    const reason = reason_(line);
    if (reason) {
      held.push({ path, line, axis, reason });
      return;
    }
    // ⚠️ ONE LINE, ONE FINDING PER AXIS. A citation is frequently caught by two rules at once — the quote's
    //    own shape and the decision phrase introducing it — and printing the same sentence twice makes a
    //    report look longer than the work it describes, which is how a reader learns to skim it.
    if (findings.some((f) => f.line === line && f.axis === axis)) return;
    findings.push({ path, line, axis, evidence: squeeze(evidence).slice(0, 180), why });
  };

  // ⛔ A marker that lost its reason is a hole in the rule, so it is graded before anything it might excuse.
  for (const [i, text] of rawLines.entries()) {
    if (!PRAGMA_BARE.test(text)) continue;
    const reason = (PRAGMA.exec(text)?.[1] ?? '').trim();
    if (reason.length < MIN_REASON) {
      findings.push({
        path,
        line: i + 1,
        axis: AXIS.HOLE,
        evidence: squeeze(text).slice(0, 180),
        why:
          `an exception is declared with its reason beside it — this one carries ${reason.length} characters of ` +
          `reason, and fewer than ${MIN_REASON} is a path in an ignore list wearing a comment.`,
      });
    }
  }

  const attributed = attributions(flat, names);

  // 1 · THE NAME — the axis the CI output exposes hardest, because a test title is printed by every run.
  for (const a of attributed) {
    if (a.kind !== 'name') continue;
    add(
      AXIS.NAME,
      a.start,
      flat.slice(Math.max(0, a.start - 60), a.end + 60),
      'a person from this repository\'s own commit register is named in a delivered file',
    );
  }

  // 3 · ATTRIBUTION BY PRONOUN, and by an owner who acts.
  for (const a of attributed) {
    if (a.kind !== 'pronoun' && a.kind !== 'owner') continue;
    add(
      AXIS.PRONOUN,
      a.start,
      a.text,
      `${a.why} — the reason survives without the attribution: say what was settled, as a fact, in this file's voice`,
    );
  }

  // 2 · THE QUOTED CONVERSATION — a value stays, a transcript goes.
  for (const re of QUOTED) {
    for (const m of flat.matchAll(re)) {
      if (!IS_SENTENCE.test(m[1])) continue;
      const start = m.index;
      const end = start + m[0].length;
      const by = attributed.find(
        (a) => (a.end <= start && start - a.end <= 160) || (a.start >= end && a.start - end <= 60),
      );
      if (!by) continue;
      add(
        AXIS.QUOTE,
        start,
        `${m[0]}   ← attributed by: ${by.text}`,
        'a quoted sentence with an attribution beside it is a conversation record. A PT-BR SCREEN STRING IS NOT — ' +
          'that is a value and it stays. Say what this one settled, in this file\'s own voice.',
      );
    }
  }
  // …and the same citation written with a plain quote, which only the attribution tells from a value.
  for (const a of attributed) {
    if (a.kind !== 'decision' && a.kind !== 'owner') continue;
    const tail = flat.slice(a.end, a.end + 90);
    const q = /[:—–-]\s*(?:\*"|«|")\s*\S+\s+\S+/.exec(tail);
    if (!q) continue;
    add(AXIS.QUOTE, a.start, `${a.text}${tail.slice(0, q.index + 60)}`, 'a decision is attributed and then quoted — the decision stays, the transcript of it does not');
  }

  // 4 · PERSONAL DATA
  for (const m of flat.matchAll(EMAIL)) {
    const [local, domain] = m[0].split('@');
    // ⚠️ `${VAR:-hi@host}` hands the local part a leading `-`, and a role mailbox with punctuation glued to
    //    it is still a role mailbox. Strip what is not a letter before asking.
    if (MAILBOX_ROLE.test(local.replace(/^[^A-Za-z0-9]+/, '').split('+')[0])) continue;
    if (RESERVED_DOMAIN.test(domain)) continue;
    add(
      AXIS.DATA,
      m.index,
      m[0],
      'an e-mail that is neither a role mailbox nor at a domain reserved for fiction is somebody\'s address',
    );
  }
  for (const m of flat.matchAll(HOME_PATH)) {
    if (HOME_PLACEHOLDER.test(m[2])) continue;
    add(
      AXIS.DATA,
      m.index + m[1].length,
      `/home/${m[2]}`,
      'an absolute path through somebody\'s home directory names the account that ran the command',
    );
  }
  for (const m of flat.matchAll(SOCIAL)) {
    add(AXIS.DATA, m.index, m[0], 'a social handle beside the network that serves it is a person, not a dependency');
  }
  for (const m of flat.matchAll(PHONE)) {
    // ⛔ A phone number ALONE is shop data here — four fictional counters publish one, and the seed is full of
    // them. It is a finding only when a person is standing beside it, because nothing in the digits tells the
    // two apart and a rule that reddened the seed would be switched off within a day.
    const start = m.index;
    const end = start + m[0].length;
    const by = attributed.find((a) => Math.max(a.start, start) - Math.min(a.end, end) <= 120);
    const mine = /\b(meu|minha|my)\b/i.test(sentenceAround(flat, start, end));
    if (!by && !mine) continue;
    add(AXIS.DATA, start, sentenceAround(flat, start, end), 'a telephone number beside a person is that person\'s number');
  }

  findings.sort((a, b) => a.line - b.line || a.axis.localeCompare(b.axis));
  return { findings, held };
}

function sentenceAround(flat, start, end) {
  let a = start;
  let b = end;
  while (a > 0 && !'.;!?\n'.includes(flat[a - 1]) && start - a < 200) a--;
  while (b < flat.length && !'.;!?\n'.includes(flat[b]) && b - end < 200) b++;
  return flat.slice(a, b);
}

// ── THE POPULATION ────────────────────────────────────────────────────────────────────────────────────────

export function trackedFiles(root) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean);
}

const extOf = (p) => (p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '');

/**
 * ★★ THE FILE THAT DEFINES A RULE IS NOT EVIDENCE OF BREAKING IT.
 *
 * This scanner and its guard are where the forbidden SHAPES are written down: the vocabulary, the example
 * phrase inside each `why`, and the sabotage fixtures, which have to CONTAIN a violation to prove the rule
 * bites. Grading them finds the dictionary guilty of the words it defines, and the only way to make them pass
 * would be to stop explaining what is forbidden — which is the half of a guard a reader actually uses.
 *
 * ⛔ IT IS NOT AN IGNORE LIST, and it is kept from becoming one: the set is exactly these two, the guard
 * asserts both are tracked, and a third entry turns it red. Everything else in the repository is graded,
 * including every other file that merely TALKS about the rule.
 */
export const RULE_SOURCES = ['bin/private-trace.mjs', 'bin/private-trace.guard.mjs'];

/**
 * Scan a whole checkout.
 *
 * ⛔ AN EMPTY POPULATION IS A FAILURE, NOT A PASS. A scanner that found nothing because it looked at nothing
 * is the exact shape of a guard that is green while blind, so this throws instead of returning `[]`.
 */
export function scanRepo(root, { tokens } = {}) {
  const files = trackedFiles(root);
  if (files.length === 0) throw new Error(`[private-trace] nothing is tracked in ${root} — an empty population cannot be graded`);
  const register = tokens ?? humanTokens(root).tokens;
  if (register.length === 0) {
    throw new Error(
      `[private-trace] the register of humans derived from ${root} is EMPTY, so the name axis would pass ` +
        'every file by grading nothing. A checkout with no history cannot answer this question.',
    );
  }
  const findings = [];
  const held = [];
  const scanned = [];
  let bytes = 0;
  for (const path of files) {
    // ★ The two files that DEFINE the rule are not graded by it — see `RULE_SOURCES` above.
    if (RULE_SOURCES.includes(path)) continue;
    // The PATH is graded for everything, binary included: a photograph can be named after somebody.
    const onPath = scanText(path, { tokens: register, path });
    for (const f of onPath.findings) findings.push({ ...f, line: 0, where: 'path' });
    if (BINARY.has(extOf(path))) continue;
    let src;
    try {
      src = readFileSync(join(root, path));
    } catch {
      continue;
    }
    if (src.includes(0)) continue; // a tracked binary with an unexpected extension
    const text = src.toString('utf8');
    bytes += text.length;
    scanned.push(path);
    const r = scanText(text, { tokens: register, path });
    findings.push(...r.findings);
    held.push(...r.held);
  }
  return { files, scanned, bytes, findings, held, register };
}

export function report(findings) {
  return findings
    .map((f) => `  ${f.path}:${f.line}  [${f.axis}]  ${f.evidence}\n      ⇒ ${f.why}`)
    .join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? join(import.meta.dirname, '..');
  const { files, scanned, bytes, findings, held, register } = scanRepo(root);
  console.error(
    `[private-trace] ${files.length} tracked file(s), ${scanned.length} read (${(bytes / 1024).toFixed(0)} KiB), ` +
      `${register.length} name token(s) derived from the commit register.`,
  );
  for (const h of held) console.error(`[private-trace] held at ${h.path}:${h.line} [${h.axis}] — ${h.reason}`);
  if (findings.length === 0) {
    console.error('[private-trace] ✅ nothing private in what this repository delivers.');
    process.exit(0);
  }
  console.error(`[private-trace] ⛔ ${findings.length} finding(s):\n${report(findings)}`);
  process.exit(1);
}
