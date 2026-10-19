// ★★ MZ-9 — THE CHROME SLOTS THIS FORK PUBLISHES ARE THE CHROME SLOTS THIS FORK DRAWS. Both directions.
//
// ⛔ THE DEFECT (found by the product's CS-1, #668; measured here 2026-10-19 by calling `GET /api/slots`):
// the fork's registry aggregated the kit's `headerManifest` + `footerManifest`, so it declared ELEVEN chrome
// slots, while <CoffeeChrome> — the chrome both trees of this app wear — draws ONE (`footer.end`). Compose asks
// the store's own front which slots exist, and offered ten places no page of this vitrine has.
//
// ⚠️ WHY `lib/slots/outlets.test.ts` NEVER SAW IT: it sweeps this app AND the kit's source for an outlet per
// declared slot, and the kit's own chrome mounts all eleven. True of the kit, false of this shop — the kit's
// chrome is mounted by no layout here. This rule reads THIS APP's source only.
//
//   PUBLISHED  the `header.*`/`footer.*` names in `slotRegistry()` (what `GET /api/slots` serves as this app's own)
//   DRAWN      the `header.*`/`footer.*` names this app's source mounts: `<Slot name="…">` or
//              `<ExtensionOutlet name="…">`, read as CODE (comments out — CoffeeChrome's own comment spells
//              `<Slot name="footer.end">`, which would satisfy a text match on its own)
//
// A slot published and not drawn is the defect above; a slot drawn and not published is a place an operator
// can never reach from Compose. The kit's chrome is still KNOWN (`knownSlotRegistry()`, for the gallery), and
// that is not this rule's business — only what is offered.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { knownSlotRegistry, slotRegistry } from '@/templates/registry';

const SRC = join(import.meta.dirname, '../..');
const CHROME = /^(header|footer)\./;

const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** Chrome slot names mounted by the given sources, code only. */
function drawnChromeSlots(sources: readonly string[]): string[] {
  const names = new Set<string>();
  for (const code of sources.map(stripComments)) {
    for (const m of code.matchAll(/<(?:Slot|ExtensionOutlet)\s+name="([^"]+)"/g)) {
      if (CHROME.test(m[1] as string)) names.add(m[1] as string);
    }
  }
  return [...names].sort();
}

const published = () => [...slotRegistry().keys()].filter((n) => CHROME.test(n)).sort();
const drawn = () => drawnChromeSlots(sourceFiles(SRC).map((f) => readFileSync(f, 'utf8')));

test('★★ the chrome slots published are exactly the chrome slots this app draws', () => {
  expect(drawn().length, 'no chrome slot drawn at all — the rule would compare nothing').toBeGreaterThan(0);
  expect(published()).toEqual(drawn());
});

test('the kit chrome stays KNOWN to <Slot> — the gallery renders it — without being published', () => {
  const known = knownSlotRegistry();
  for (const name of slotRegistry().keys()) expect(known.has(name), name).toBe(true);
  expect(known.has('header.end')).toBe(true);
  expect(slotRegistry().has('header.end')).toBe(false);
});

test('control: a mount written only in a comment is not a mount', () => {
  expect(drawnChromeSlots(['// <Slot name="footer.end">', '/* <ExtensionOutlet name="header.end" */'])).toEqual(
    [],
  );
  expect(drawnChromeSlots(['<ExtensionOutlet\n  name="header.end" store={s} />'])).toEqual(['header.end']);
});
