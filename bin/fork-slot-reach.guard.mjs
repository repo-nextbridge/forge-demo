// ★★★ A BLOCK OF THIS BOX IS PLACED IN A SLOT THE FRONT THAT SERVES THAT STORE ACTUALLY DRAWS — said here,
// in the loop, and never discovered by eye on a shop somebody is looking at.
//
//   node --test bin/fork-slot-reach.guard.mjs        (or: bash bin/test.sh)
//
// ── ⛔ THE DEFECT, MEASURED ON THE DEPLOYED BOX, 18/09 ─────────────────────────────────────────────────────
//
// The owner placed the demonstration notice (`demo-setup/demo_ribbon` — «nothing here is charged or shipped»)
// in `storefront:footer.end` on the three shops, from Compose. The row exists and is ENABLED on all three.
// The shoe shop and the outlet drew it. THE CAFÉ DID NOT.
//
// The café's vitrine is a FORK (`storefront-coffee/`) and it draws its own chrome. The chrome it replaced —
// `StorefrontChrome` → `FooterDefault` of `@forgeco/storefront-kit` — publishes `footer.end` at the foot of
// the footer; the replacement never republished it. Every other half of the mechanism was in place: the app
// is composed into the fork's build, its generated registry resolves the block, the port answers the
// placement, and the admin lists it. There was simply no render site in that app for it to land in.
//
// ⛔ AND THE SILENCE IS TOTAL, FROM EVERY SIDE. `bin/front-app-reach.guard.mjs` — the sibling of this file —
// asks whether the fork can IMPORT the component, and the answer was yes. The fork's own suite renders its
// chrome and asks about what it DOES draw. `read.extension_composition` publishes the placement. A slot that
// is missing is an assertion nobody wrote, on a screen nobody compares.
//
// ── ★★ WHAT IS DERIVED, AND BOTH SIDES ARE ────────────────────────────────────────────────────────────────
//
//   WHICH FRONT SERVES WHICH SHOP   `seed/box.json` declares one `domain` per store and names the variable
//                                   that carries it; `caddy/Caddyfile` turns that variable into a site block
//                                   whose `import forge_shop_host <service>` names the container whose
//                                   VITRINE answers there. That pairing is already the subject of
//                                   `bin/box-domains.guard.mjs`, and it is read here through the same module
//                                   (`bin/box-domains.mjs`) rather than parsed a second time.
//   WHICH OF THEM ARE OURS TO GRADE  the ones whose service is a DIRECTORY of this repository that installs
//                                   the kit (`bin/forks.mjs`). `storefront` — the vanilla image — is not,
//                                   and it is out of jurisdiction on purpose: its source is the product's,
//                                   it publishes the kit's slots by construction, and the product grades it.
//   WHAT IS PLACED WHERE            every seed declaration of the `app`/`slots`/`stores` shape whose `app` is
//                                   one of `composition.json`'s `instanceApps`. THE OBLIGATION IS THE
//                                   INSTANCE'S — the doctrine `bin/front-apps.mjs` opens with: if the app is
//                                   ours and the front is ours, this repository is the only party holding
//                                   both ends. An OOTB app's placement (`seed/chrome.json` → the `chrome`
//                                   app) is the product's business and is not graded here.
//   WHICH DEPLOYABLE OWES A TARGET  the app's own `forge.wiring`, through `frontComponents()`. A block with a
//                                   payment ROLE is served by the CHECKOUT (`payment-pos`'s two are), so the
//                                   vitrine not drawing it is correct and not a finding.
//   WHAT A FORK PUBLISHES           the render sites in its own `src`: `<Slot name="…">` and
//                                   `<ExtensionOutlet … name="…">`, read as CODE.
//   WHICH SLOT NO VITRINE DRAWS     ★ v031/H29 — the funnel's. `storefront:checkout.bottom` is a slot of the
//                                   storefront SURFACE drawn by the CHECKOUT we host (`/checkout*` goes to
//                                   that container on every shop, café included), so a fork not drawing it is
//                                   correct. Derived, never listed: `slotsDrawnElsewhere()` (bin/app-manifest.mjs)
//                                   reads the release's slot catalogue and keeps the slots whose template is a
//                                   template DIRECTORY of the deployable that consumes them and not one of the
//                                   vitrine's. The chrome both wear (`footer.end`) is in neither, so the café's
//                                   fork dropping it is still the red of 18/09.
//
// ⛔ NOTHING HERE SPELLS A STORE HANDLE, A FORK DIRECTORY, AN APP ID OR A SLOT NAME. The defect this grades
// arrives as a fork rewriting a chrome months from now, and a guard carrying its own copy of the answer would
// have been green about the very edit it exists to catch.
//
// ── ⛔ THE TWO WAYS A RULE LIKE THIS GOES VACUOUS, AND WHAT IS DONE ABOUT EACH ─────────────────────────────
//
// ⛔ A RULE THAT READS SOURCE MUST READ **CODE**. This repository's forks write long prose, and the chrome
// this slice touched now names `footer.start`, `footer.aside` and seven more IN A COMMENT explaining why it
// does not publish them. A grep would find every one of those and report a fork that publishes eleven slots
// and draws one. So comments are STRIPPED before the question is asked, and a test below proves the stripper
// still lets a real render site through.
//
// ⛔ AND THE JURISDICTION MUST REALLY SUBTRACT. «Every store, always» wearing a derivation as a costume is
// the other failure: the last test asserts that at least one shop of this box is served by a front this
// repository does NOT own, so the narrowing above is a fact about the box and not a sentence in this header.
//
// ── ⚠️ WHAT THIS FILE DOES **NOT** PROVE, SAID RATHER THAN LEFT TO BE ASSUMED ──────────────────────────────
//
// It reads the render sites in a fork's source. It does not prove the FILE holding them is the one the app
// mounts: a slot published in a component no layout renders would satisfy this rule. That is a real gap and
// it has an owner — `bin/fork-chrome-drift.guard.mjs` grades which chrome each of the fork's two trees mounts
// (they must be ONE, and it must be the fork's own), and the fork's own
// `CoffeeChrome.footer-end.guard.test.tsx` renders that chrome and asserts the outlet is in it, at the foot.
// Three rules, one claim, none of them pretending to be the other two.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { declaredFaces, envSitesOf, readBox } from './box-domains.mjs';
import { forks } from './forks.mjs';
import { composedInstanceApps, frontComponents } from './front-apps.mjs';
import { slotsDrawnElsewhere } from './app-manifest.mjs';
import { STOREFRONT } from './app-blocks.mjs';
import { blocksFor } from '../seed/blocks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const say = (line) => console.error(`[fork-slot-reach] ${line}`);

const read = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch (error) {
    assert.fail(
      `${rel} could not be read (${error.code ?? error.message}). This guard derives one whole side of its ` +
        'answer from that file; a green without it would mean nothing.',
    );
  }
};

/** The edge file a DEPLOYMENT of this instance reads — the one that says which container answers at which
 *  hostname. ⚠️ Not `Caddyfile.local`: that is the bench's opt-in, and a rule about what this box SERVES has
 *  to be about the file a deployment gets. */
const EDGE = 'caddy/Caddyfile';

/** The npm script a front declares when it is a front this repository BUILDS. `bin/forks.mjs` derives the
 *  list from it, and `bin/revendor-forks.sh` asks for the same one, for the same reason: building is what
 *  turns this source into the image that serves a shop. */
const BUILT = 'build';

/** Source with its comments removed — the same subtraction `bin/no-gate.guard.mjs` and `bin/front-apps.mjs`
 *  make, and for the same measured reason. See the header. */
const codeOf = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * ★ EVERY SLOT A FRONT RENDERS A SITE FOR, read out of its own source.
 *
 * Both literals count, and they are two halves of one gesture rather than two mechanisms: `<Slot name>` is
 * the declared render POSITION and `<ExtensionOutlet name>` is what FILLS it, and this repository's fronts
 * write them nested (the kit does too). Either alone is a slot that is half published, and naming both here
 * means the rule is about the NAME being present in the tree, which is what a placement needs.
 *
 * ⚠️ `[^>]*` SPANS LINES ON PURPOSE — a negated class matches a newline, and the kit's own call sites put
 * `name=` on its own line under a multi-line `<ExtensionOutlet`. A single-line regex would have reported the
 * neatly formatted call sites as absent.
 */
const SITE = /<(?:Slot|ExtensionOutlet)\b[^>]*\bname=["']([^"']+)["']/g;

/** Every source file of a front, minus its tests and its installed packages. A test that renders a slot is
 *  not a shop that draws one. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(path, out);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
    if (/\.(test|spec|examples)\.[tj]sx?$/.test(entry.name)) continue;
    out.push(path);
  }
  return out;
}

/**
 * The slots one front publishes: slot name → the file of that front that draws it.
 * @param {{ dir: string, path: string }} front
 * @returns {Map<string, string>}
 */
export function publishedSlots(front) {
  const out = new Map();
  const src = join(front.path, 'src');
  let files;
  try {
    files = statSync(src).isDirectory() ? sourceFiles(src) : [];
  } catch {
    files = [];
  }
  for (const file of files) {
    for (const [, name] of codeOf(readFileSync(file, 'utf8')).matchAll(SITE)) {
      if (!out.has(name)) out.set(name, relative(front.path, file));
    }
  }
  return out;
}

/**
 * ★★ WHICH FRONT OF THIS REPOSITORY SERVES WHICH SHOP — the two declarations joined, never a third list.
 *
 * `seed/box.json` says a store is published at a hostname and names the variable that carries it;
 * `caddy/Caddyfile` says which container's VITRINE answers at that variable's address (the argument of the
 * `forge_shop_host` snippet — "the compose service serving the VITRINE at this hostname", in that file's own
 * words). A service that is also a directory of this repository is a front whose source we hold.
 *
 * ⚠️ A FACE WITH NO SNIPPET ARGUMENT IS NOT A SHOP WINDOW, and the counter is the live case: its site block
 * proxies the whole host to `totem` and imports no snippet, because the totem is ONE app serving every path
 * with no store in the URL and no Compose board behind it. It drops out here by the shape of its own site
 * block rather than by a handle typed in this file.
 * @returns {{ front: { dir: string, path: string }, tenant: string, store: string, host: string }[]}
 */
export function servedShops(box, edgeText, ours) {
  const byEnv = new Map();
  for (const site of envSitesOf(edgeText)) {
    const vitrine = site.site.args[0];
    if (vitrine) byEnv.set(site.env, vitrine);
  }
  const out = [];
  for (const face of declaredFaces(box)) {
    if (face.kind !== 'store') continue;
    const service = byEnv.get(face.env);
    const front = ours.find((f) => f.dir === service);
    if (!front) continue;
    out.push({ front, tenant: face.tenant, store: face.store, host: face.host });
  }
  return out;
}

/**
 * ★★ WHAT THIS BOX'S OWN APPS ARE PLACED AT, per store — read from the declarations the birth drives.
 *
 * ⚠️ THE FILES ARE FOUND BY SHAPE AND FILTERED BY OWNERSHIP, never listed. A declaration is a `seed/*.json`
 * carrying `app` + `slots` + `stores`; it is graded here when its `app` is one of `composition.json`'s
 * `instanceApps`. A second app of this box, declared tomorrow, is covered with no edit here — and
 * `seed/chrome.json`, which places an OOTB app, stays out for the reason in the header.
 * @returns {{ app: string, file: string, store: string, component: string, target: string }[]}
 */
export function declaredPlacements(ownApps) {
  const out = [];
  for (const name of readdirSync(join(ROOT, 'seed')).sort()) {
    if (!name.endsWith('.json')) continue;
    let spec;
    try {
      spec = JSON.parse(readFileSync(join(ROOT, 'seed', name), 'utf8'));
    } catch {
      continue; // not a declaration this guard can read; `bin/verify-seed.mjs` owns malformed seed data.
    }
    if (!spec || typeof spec.app !== 'string' || !spec.slots || !spec.stores) continue;
    if (!ownApps.includes(spec.app)) continue;
    for (const store of Object.keys(spec.stores)) {
      for (const { component, slot } of blocksFor(spec, store)) {
        out.push({ app: spec.app, file: `seed/${name}`, store, component, target: slot });
      }
    }
  }
  return out;
}

/**
 * ★★★ DECLARATION × REALITY, IN ONE ANSWER — the shape `bin/front-apps.mjs` established and this file
 * inherits: never a list of names, always both sides derived and compared.
 *
 * A finding is a PAIR: the target a block of this box is placed at, and the shop whose front does not draw
 * it. Both are named, because either alone is unactionable — «`footer.end` is unpublished» does not say which
 * shop is missing a bar, and «the café is missing something» does not say what to add.
 * @returns {{ findings: object[], pairs: number }}
 */
export function orphans({ shops, placements, servedBy, published, elsewhere = new Map() }) {
  const findings = [];
  const drawnElsewhere = [];
  let pairs = 0;
  for (const shop of shops) {
    const slots = published.get(shop.front.dir);
    assert.ok(slots, `no published-slot set was derived for ${shop.front.dir}`);
    for (const placement of placements) {
      if (placement.store !== shop.store) continue;
      // Which DEPLOYABLE owes this block is the app's own declaration, not this file's guess. A block with a
      // payment role is the checkout's; the vitrine not drawing it is correct.
      const surfaces = servedBy.get(`${placement.app}/${placement.component}`);
      if (!surfaces) continue; // the app declares no front component under this name — nothing to render.
      if (!surfaces.includes('storefront')) continue;
      if (!placement.target.startsWith(STOREFRONT)) continue;
      pairs += 1;
      const slot = placement.target.slice(STOREFRONT.length);
      if (slots.has(slot)) continue;
      // ★ v031/H29 — a slot another deployable's own template draws is not this fork's to publish. Counted and
      // said, never dropped in silence: the run prints which pairs were answered this way, and by whom.
      if (elsewhere.has(slot)) {
        drawnElsewhere.push({ at: `${shop.tenant}/${shop.store}`, target: placement.target, by: elsewhere.get(slot) });
        continue;
      }
      findings.push({
        fork: shop.front.dir,
        at: `${shop.tenant}/${shop.store}`,
        target: placement.target,
        app: placement.app,
        component: placement.component,
        file: placement.file,
        host: shop.host,
      });
    }
  }
  return { findings, pairs, drawnElsewhere };
}

// ── what this run read, said before any assertion ──────────────────────────────────────────────────────────

const BOX = readBox(ROOT);
const EDGE_TEXT = read(EDGE);
const OURS = forks(BUILT);
const OWN_APPS = composedInstanceApps().map((a) => a.id);
const SERVED_BY = new Map(frontComponents().map((c) => [`${c.app}/${c.component}`, c.servedBy]));
const SHOPS = servedShops(BOX, EDGE_TEXT, OURS);
const PLACEMENTS = declaredPlacements(OWN_APPS);
const PUBLISHED = new Map(OURS.map((f) => [f.dir, publishedSlots(f)]));
const ELSEWHERE = slotsDrawnElsewhere();

say(`fronts this repository builds: ${OURS.map((f) => f.dir).join(', ') || 'none'}`);
for (const front of OURS) {
  const slots = [...PUBLISHED.get(front.dir).keys()].sort();
  say(`${front.dir} publishes ${slots.length} slot(s): ${slots.join(' · ') || 'none'}`);
}
say(`apps of this box: ${OWN_APPS.join(', ') || 'none'}`);
say(
  ELSEWHERE.tried
    ? `slots drawn by another deployable: NOT READ — ${ELSEWHERE.tried.join(' · ')}`
    : `slots drawn by another deployable (${ELSEWHERE.from}): ${[...ELSEWHERE.slots.keys()].join(' · ')}`,
);
say(
  `shops served by a front of this repository: ${
    SHOPS.map((s) => `${s.tenant}/${s.store} → ${s.front.dir}`).join(', ') || 'none'
  }`,
);

// ── ⛔ the premise. Every verdict below walks a list, and a list that lost its subject would be green ───────

test('⛔ THE DERIVATION — there are fronts, shops and placements to compare, and the parse really parsed', () => {
  assert.ok(
    OURS.length > 0,
    `no directory of this repository declares a \`${BUILT}\` script and installs the kit, so "the forks" is ` +
      'empty and every rule below grades nothing. Either this box stopped owning a front — which is the ' +
      'whole demonstration gone — or `bin/forks.mjs` stopped recognising one.',
  );
  assert.ok(
    envSitesOf(EDGE_TEXT).length > 0,
    `${EDGE} yielded no site block whose address comes from a variable. The parse in \`bin/box-domains.mjs\` ` +
      'is line-based (see its header); a file that stopped obeying that shape would make this guard quietly ' +
      'grade an empty edge.',
  );
  assert.ok(
    SHOPS.length > 0,
    `no shop of ${'seed/box.json'} is served by a front this repository builds. That is either a topology ` +
      `change nobody recorded, or the pairing between a store's \`domain.env\` and the \`forge_shop_host\` ` +
      `argument in ${EDGE} has broken — in which case this rule is comparing nothing at all.`,
  );
  assert.ok(
    PLACEMENTS.length > 0,
    'no `seed/*.json` declares a block of an app on `composition.json`\'s `instanceApps`. The rule below ' +
      'would then pass over an empty set, which is exactly the shape of the defect it grades.',
  );
  // ⚠️ ASKED OF THE FRONTS THAT SERVE A SHOP, AND NOT OF EVERY FRONT THIS REPOSITORY BUILDS — because one of
  // them legitimately publishes none. `totem/` is a cut of no Forge surface: a whole-host app with no store
  // in the URL, no Compose board behind it and a registry it writes by hand, and `seed/demo-setup.json`
  // declares its store `null`. Demanding a slot of it would be this rule inventing an obligation; what it
  // may not tolerate is a front it IS grading whose source it reads as empty.
  for (const shop of SHOPS) {
    assert.ok(
      PUBLISHED.get(shop.front.dir).size > 0,
      `${shop.front.dir} serves ${shop.tenant}/${shop.store} and publishes NO slot at all, by this guard's ` +
        'reading of its own source. That is either a shop window that stopped being extensible or a reader ' +
        'that stopped reading — and the second one makes every finding below a lie.',
    );
  }
});

// ── ★★★ the verdict ────────────────────────────────────────────────────────────────────────────────────────

test('★★★ every block of this box is placed in a slot the shop’s OWN front draws — named, pair by pair', (t) => {
  // ⇒ SABOTAGE: take the slot back out of the fork's chrome, or point a declaration at a slot the fork does
  //   not draw, and this names the target AND the shop. What it stands in front of is a placement that is
  //   enabled in the database, listed in the admin, answered by the port — and rendered by nothing, on a
  //   shop a customer is looking at, until somebody notices by eye. That is how this box's demonstration
  //   notice was missing from one of its three shops.
  const { findings, pairs, drawnElsewhere } = orphans({
    shops: SHOPS,
    placements: PLACEMENTS,
    servedBy: SERVED_BY,
    published: PUBLISHED,
    elsewhere: ELSEWHERE.slots ?? new Map(),
  });
  say(`${pairs} (block × shop) pair(s) graded`);
  for (const d of drawnElsewhere) say(`${d.target} @ ${d.at} — drawn by ${d.by}, not by the shop's fork`);
  // ⚠️ WITHOUT THE RELEASE'S CATALOGUE A FINDING MAY BE A FUNNEL SLOT THIS RUN CANNOT CLASSIFY, so it is
  // reported NOT CHECKED with the list rather than accused — and a run with no finding still passes.
  if (ELSEWHERE.tried && findings.length > 0) {
    t.skip(
      `NOT CHECKED — ${findings.map((f) => `${f.target} @ ${f.at}`).join(', ')} is not drawn by the fork, and ` +
        `whether another deployable draws it is unknown here (${ELSEWHERE.tried.join(' · ')}). Set ` +
        'FORGE_MONOREPO=<a Forge clone at the pinned commit>.',
    );
    return;
  }
  assert.ok(
    pairs > 0,
    'not one placement of this box lands on a shop served by a front of this repository, so the comparison ' +
      'below ran over nothing. A green here would be a statement about an empty loop.',
  );
  assert.deepEqual(
    findings.map((f) => `${f.target} @ ${f.at}`),
    [],
    `${findings.length} block(s) of this box are placed at a target the front serving that shop does not ` +
      'draw:\n' +
      findings
        .map(
          (f) =>
            `  · ${f.target} @ ${f.at} (${f.host}) — placed by ${f.file} as ${f.app}/${f.component}; ` +
            `${f.fork}/src publishes no \`<Slot name="${f.target.slice(STOREFRONT.length)}">\``,
        )
        .join('\n') +
      '\nThe placement is real: the port answers it, the admin lists it, the fork can import the block ' +
      '(bin/front-app-reach.guard.mjs says so) — and there is no render site for it to land in, so the page ' +
      'simply does not have it and nothing anywhere says why. Either the fork republishes the slot in the ' +
      'place the reference chrome publishes it, or the declaration stops pointing a block of ours at a ' +
      'front of ours that cannot draw it.',
  );
});

// ── ⛔ the anti-vacuum half ─────────────────────────────────────────────────────────────────────────────────

test('⛔ ANTI-VACUUM — the reader SEES a render site, and is not merely satisfied by the prose about one', () => {
  // ⛔ THE TRAP THIS CLOSES, AND THIS SLICE WALKED STRAIGHT INTO IT: the chrome that gained `footer.end`
  // carries a comment naming the ten slots it deliberately does NOT publish. A reader that did not strip
  // comments would report that fork as publishing all eleven — green about its own documentation.
  const drawing = '<Slot name="footer.end"><ExtensionOutlet name="footer.end" store={s} /></Slot>';
  assert.deepEqual(
    [...codeOf(drawing).matchAll(SITE)].map((m) => m[1]),
    ['footer.end', 'footer.end'],
    'the stripper ate a REAL render site — the reader is blind, and every "publishes no slot" below it is ' +
      'about a file nobody read.',
  );
  const explaining =
    '// this chrome does not publish <Slot name="footer.start">, and here is why\n' +
    '/* nor <ExtensionOutlet name="footer.aside" /> */\nexport const x = 1;';
  assert.deepEqual(
    [...codeOf(explaining).matchAll(SITE)].map((m) => m[1]),
    [],
    'the prose explaining the decision satisfies the rule — a guard in that state is green about its own ' +
      'comment, which is the one failure this house keeps paying for.',
  );
  // …and the multi-line call site the kit itself writes is seen, or every tidily formatted outlet in the
  // product's own shape would read as absent.
  const wrapped = '<ExtensionOutlet\n  name="footer.brand"\n  store={store}\n/>';
  assert.deepEqual(
    [...codeOf(wrapped).matchAll(SITE)].map((m) => m[1]),
    ['footer.brand'],
    'a multi-line `<ExtensionOutlet>` reads as no render site at all',
  );
});

test('⛔ ANTI-VACUUM — the rule SEES: it is handed a placement the fork cannot draw, and it names the pair', () => {
  // ★★★ A rule that has never been seen to redden is a rule nobody has measured. It is given the real fronts
  // and the real shops, and a FABRICATED declaration pointing at a slot no front of this repository draws.
  const shop = SHOPS[0];
  assert.ok(shop, 'there is no shop served by a front of ours to fabricate against');
  const slots = PUBLISHED.get(shop.front.dir);
  // The needle is a name nothing publishes, derived by construction rather than picked out of the air: a
  // slot this fork happened to draw would make the fixture green for the wrong reason.
  let invented = 'fixture.nowhere';
  while (slots.has(invented)) invented += 'x';
  const placement = {
    app: 'fixture-app',
    file: 'seed/fixture.json',
    store: shop.store,
    component: 'fixture-block',
    target: `${STOREFRONT}${invented}`,
  };
  const servedBy = new Map([['fixture-app/fixture-block', ['storefront']]]);
  const caught = orphans({ shops: SHOPS, placements: [placement], servedBy, published: PUBLISHED });
  assert.deepEqual(
    caught.findings.map((f) => `${f.target} @ ${f.at}`),
    [`${STOREFRONT}${invented} @ ${shop.tenant}/${shop.store}`],
    'the rule did not report a block placed at a slot the shop\'s own front does not draw. That is the ' +
      'defect, exactly as it arrived on the deployed box.',
  );
  // …and the SAME placement, pointed at a slot that front really does draw, is clean again — so what it
  // catches is the ABSENCE of the render site and not the presence of a fixture.
  const [drawn] = [...slots.keys()].sort();
  assert.ok(drawn, `${shop.front.dir} publishes nothing to aim the control at`);
  const clean = orphans({
    shops: SHOPS,
    placements: [{ ...placement, target: `${STOREFRONT}${drawn}` }],
    servedBy,
    published: PUBLISHED,
  });
  assert.deepEqual(clean.findings, [], `the rule reddens a block placed at \`${drawn}\`, which is drawn`);
  // ⛔ AND THE DEPLOYABLE SPLIT IS REAL, NOT DECORATION: the same unpublishable target, declared by a block
  // the app says the CHECKOUT serves, is NOT this front's problem and must stay quiet.
  const checkoutSide = orphans({
    shops: SHOPS,
    placements: [placement],
    servedBy: new Map([['fixture-app/fixture-block', ['checkout']]]),
    published: PUBLISHED,
  });
  assert.deepEqual(
    checkoutSide.findings,
    [],
    'a block the app declares for the CHECKOUT was reported against a vitrine. The vitrine does not serve ' +
      'it, and accusing it would make this guard unusable the day a payment app of this box is placed.',
  );
});

test('⛔ THE JURISDICTION REALLY SUBTRACTS — a shop of this box is served by a front we do NOT own', () => {
  // ★ Without this, «every store, always» would be wearing a derivation as a costume. This box runs two of
  // its shops on the VANILLA image, whose source is not here: those are the product's to grade, and the set
  // this rule loops over has to be genuinely smaller than the set of shops.
  const all = declaredFaces(BOX).filter((f) => f.kind === 'store');
  const mine = new Set(SHOPS.map((s) => `${s.tenant}/${s.store}`));
  const theirs = all.filter((f) => !mine.has(`${f.tenant}/${f.store}`));
  assert.ok(
    theirs.length > 0,
    'every shop of this box is served by a front this repository builds, so the narrowing above has never ' +
      'subtracted anything. If that is really the box now, say so here — and then this line is the one that ' +
      'noticed.',
  );
  say(
    `out of jurisdiction: ${theirs.map((f) => `${f.tenant}/${f.store}`).join(', ')} — not served by a front ` +
      'whose source this repository holds',
  );
  // …and each of them really is served by SOMETHING this repository does not build, rather than dropping out
  // because the edge forgot it. A face no site block serves is `bin/box-domains.guard.mjs`'s finding, not a
  // reason for this file to go quiet about a shop.
  const byEnv = new Map(
    envSitesOf(EDGE_TEXT).map((s) => [s.env, s.site.args[0] ?? null]),
  );
  for (const face of theirs) {
    assert.ok(
      byEnv.has(face.env),
      `${face.tenant}/${face.store} declares \`${face.env}\` and ${EDGE} carries no site block for it, so ` +
        'this guard skipped a shop for a reason that is itself a defect (bin/box-domains.guard.mjs owns it).',
    );
  }
});

test('⛔ v031/H29 — «drawn by another deployable» subtracts the FUNNEL and never the CHROME a fork owes', (t) => {
  // ★ The exemption is real only if it is narrow. Handed the real catalogue's answer, a placement at a funnel
  // slot on the café's fork is NOT a finding, and the same placement with the exemption taken away IS one —
  // while `footer.end`, which the checkout's catalogue also lists (its account screens wear the footer), stays
  // a finding the moment the fork stops drawing it. That last line is the defect of 18/09.
  if (ELSEWHERE.tried) {
    t.skip(`NOT CHECKED — the release's slot catalogue could not be read: ${ELSEWHERE.tried.join(' · ')}`);
    return;
  }
  const elsewhere = ELSEWHERE.slots;
  assert.ok(elsewhere.size > 0, 'the release names no slot drawn by another deployable — the exemption is empty');
  const [shop] = SHOPS;
  const funnel = [...elsewhere.keys()].find((slot) => !PUBLISHED.get(shop.front.dir).has(slot));
  assert.ok(funnel, `${shop.front.dir} publishes every funnel slot, so there is nothing to subtract`);
  const chrome = [...PUBLISHED.get(shop.front.dir).keys()].find((slot) => !elsewhere.has(slot) && slot.startsWith('footer.'));
  assert.ok(chrome, `${shop.front.dir} publishes no footer slot the funnel does not also claim — the control has no subject`);
  const servedBy = new Map([['fixture-app/fixture-block', ['storefront']]]);
  const at = (target) => [{ app: 'fixture-app', component: 'fixture-block', store: shop.store, target: `${STOREFRONT}${target}`, file: 'fixture' }];
  const published = new Map(PUBLISHED);
  const findings = (target, ex, drop) => {
    const slots = new Map(PUBLISHED.get(shop.front.dir));
    if (drop) slots.delete(drop);
    published.set(shop.front.dir, slots);
    return orphans({ shops: [shop], placements: at(target), servedBy, published, elsewhere: ex }).findings.length;
  };
  assert.equal(findings(funnel, elsewhere), 0, `${funnel} is the checkout's and was still pinned on the fork`);
  assert.equal(findings(funnel, new Map()), 1, `${funnel} without the exemption is not a finding — the rule is blind`);
  assert.equal(findings(chrome, elsewhere, chrome), 1, `the fork dropped ${chrome} and the exemption hid it`);
});
