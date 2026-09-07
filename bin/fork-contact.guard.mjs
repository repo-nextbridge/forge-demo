// ★★ THE CAFÉ PUBLISHES ONE PHONE AND ONE E-MAIL, AND NEITHER OF THEM EXISTS.
//
//   node --test bin/fork-contact.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THIS GUARD PROVES ────────────────────────────────────────────────────────────────────────────────
//
// The coffee shop's vitrine is a FORK, so its «Fale conosco» page is template code and not data:
// `storefront-coffee/src/templates/cms/Contact.tsx` prints the channels literally (the CMS carries a title
// and a `template_key` and no body — `seed/vitrine.mjs`). That file is the ONLY place in this repository
// where a shopper-facing contact detail is typed into a component instead of into `seed/`, which is exactly
// why nothing was grading it. Two rules:
//
//   1. EVERY CHANNEL IS FICTIONAL. `.example` is reserved by RFC 2606 and can never be registered; a real TLD
//      here is a stranger's inbox on a demo screen. ⚠️ THIS IS NOT HYPOTHETICAL IN THIS REPOSITORY: this
//      dataset shipped the owner's PERSONAL address once, in fifteen files. `seed/chrome.test.mjs` carries
//      the same rule for `seed/chrome.json`; this file is the half of the rule that reaches the fork.
//
//   2. THEY ARE THE CAFÉ'S OWN CHANNELS, THE SAME ONES ITS FUNNEL SHOWS. The café's account footer already
//      publishes a phone and an e-mail (`seed/chrome.json` → `cafe.account_footer`), and a shopper crosses
//      from the shop's contact page to the account screen in one click. Two authors for one fact is the
//      mistake this repository documents at length elsewhere (`CoffeeChrome.tsx`, on the announcement bar's
//      prices); here the second author is a TEMPLATE, so nothing but this file can tie them together.
//
// ── WHAT IT DELIBERATELY DOES NOT GRADE ──────────────────────────────────────────────────────────────────
//
// The opening hours line, and the fact that the file publishes these channels at ALL. The template's own
// header explains why it diverges from the reference (which prints `contato@loja.exemplo` / `(00) 00000-0000`
// and is being honest about what a reference cannot know): a fork's own voice is what a fork is for. The
// divergence is the feature; the reachability of the addresses is the defect.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { blocksFor } from '../seed/chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTACT = 'storefront-coffee/src/templates/cms/Contact.tsx';
const source = readFileSync(join(ROOT, CONTACT), 'utf8');
const CHROME = JSON.parse(readFileSync(join(ROOT, 'seed/chrome.json'), 'utf8'));

/** ⛔ ONLY THE RENDERED TEXT. This file's header is nineteen lines of prose that NAMES the address it
 *  replaced, so a sweep over the whole source would grade the commentary and go red on its own explanation.
 *  The component body starts at `export function`. */
const body = source.slice(source.indexOf('export function'));

/** The e-mail addresses a shopper reads on the page. */
const addresses = body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];

/** The Brazilian phone numbers a shopper reads on the page: `(NN) NNNN-NNNN` or `(NN) NNNNN-NNNN`. */
const phones = body.match(/\(\d{2}\)\s*\d{4,5}-\d{4}/g) ?? [];

/** The café's own channels, as its hosted account footer publishes them. */
function funnelChannels() {
  const footer = blocksFor(CHROME, 'cafe').find((b) => b.component === 'account_footer')?.config ?? {};
  return { phone: footer.start_text, email: footer.middle_text };
}

test('★★ the contact page actually publishes channels — a rule with nothing to grade accuses itself', () => {
  // ⛔ THE VÁCUO. Everything below loops over what the regexes found; a rewrite that moved the channels into a
  // constant, a translation file or a data read would empty both lists and leave this file green while
  // grading nothing at all. So the counts are pinned first, and a rewrite has to come past this line.
  assert.equal(
    addresses.length,
    1,
    `${CONTACT} renders ${addresses.length} e-mail address(es) and this guard is written for exactly one. ` +
      'If the channels moved out of the template, move this rule to wherever they went.',
  );
  assert.equal(
    phones.length,
    1,
    `${CONTACT} renders ${phones.length} phone number(s) and this guard is written for exactly one.`,
  );
});

test('★★★ no channel on the café’s contact page can be dialled or written to — RFC 2606, always', () => {
  // ⇒ SABOTAGE: put `ola@forge.co` back and this names the address and the TLD. `forge.co` is a REAL
  // delegated TLD (`.co`, Colombia) and the shop is fictional: a demo that prints it is pointing shoppers,
  // and screenshots, at somebody else's domain.
  for (const address of addresses) {
    assert.match(
      address,
      /\.example$/,
      `${CONTACT} puts "${address}" on a shopper's screen. Its TLD is a real one, so that address either ` +
        'belongs to somebody or can be registered by anybody. Contact details in this dataset are fictional ' +
        'by rule — use the RFC 2606 `.example` TLD, the way seed/chrome.json already does.',
    );
  }
  for (const phone of phones) {
    // The dataset's fictional range, and it is a range this box already uses everywhere else: `(11) 4000-…`.
    // A plausible São Paulo landline (`(11) 3237-0188` was the one this file shipped) is somebody's line.
    assert.match(
      phone,
      /^\(11\) 4000-\d{4}$/,
      `${CONTACT} publishes "${phone}". Every other number in this box is in the (11) 4000-xxxx range, ` +
        'which is where this dataset keeps its fictional lines; a plausible number outside it rings ' +
        'somewhere real.',
    );
  }
});

test('★★ …and they are the café’s OWN channels — the shop and its funnel say the same number', () => {
  // The account footer is the other place the same shopper reads the same two facts, one click away.
  const { phone, email } = funnelChannels();
  assert.ok(
    typeof phone === 'string' && phone.length > 0 && typeof email === 'string' && email.length > 0,
    'seed/chrome.json no longer gives `cafe.account_footer` a phone and an e-mail, so there is nothing for ' +
      'the contact page to agree WITH. Either the footer lost them or this rule is pointed at the wrong pair.',
  );
  assert.deepEqual(
    { phone: phones[0], email: addresses[0] },
    { phone, email },
    `${CONTACT} and the café's account footer publish different channels. They are the same shop to a ` +
      'shopper who crosses between them in one click, and a template is a SECOND author for a fact the ' +
      'dataset already states.',
  );
});
