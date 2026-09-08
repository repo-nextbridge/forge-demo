// THE DECLARATION READER, GRADED — because two steps now answer questions about this box out of it.
//
// `bin/verify-config.mjs` grades the box against `.env`; `bin/warm-box.mjs` learns from the same file which
// store this box serves at the ROOT of the origin it is warming. Both used to be «read the file and hope»:
// the first carried its own parser, the second carried none and reported a warm shop while it warmed the
// address space nobody browses. One module, and these are the rules it has to keep.
//
//   node --test bin/box-env.test.mjs      (or: bash bin/test.sh)

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { readDeclaration, storeAtRoot, storeHosts } from './box-env.mjs';

/** A `.env` written the way `bin/box-up.sh`'s `put_env` writes one. */
function envFile(body) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-box-env-'));
  const file = join(dir, '.env');
  writeFileSync(file, body);
  return { file, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test('★★ the single quotes box-up.sh writes are stripped — they are bash\'s, not part of the value', () => {
  // ⚠️ THE QUOTES ARE NOT DECORATION: `.env` is read by TWO parsers (compose's own and bash's `source`), and
  // `box-up.sh` quotes the JSON values for that reason. A reader that kept them would fail to parse exactly
  // the two variables that carry this box's addresses.
  const { file, clean } = envFile(
    ["FORGE_PUBLIC_ORIGIN=https://box.example.test", `FORGE_STORE_HOSTS='{"localhost":"sto_ROOT"}'`, ''].join('\n'),
  );
  try {
    const declared = readDeclaration(file);
    assert.equal(declared.FORGE_PUBLIC_ORIGIN, 'https://box.example.test');
    assert.deepEqual(storeHosts(declared), { localhost: 'sto_ROOT' });
  } finally {
    clean();
  }
});

test('★★ comments, blank lines and `export ` noise are not variables', () => {
  const { file, clean } = envFile(['# a comment', '', 'FORGE_A=1', 'not a line at all', ''].join('\n'));
  try {
    assert.deepEqual(readDeclaration(file), { FORGE_A: '1' });
  } finally {
    clean();
  }
});

test('★★ a file that is not there THROWS — «no declaration» is a different sentence from «a wrong one»', () => {
  assert.throws(() => readDeclaration('/nonexistent/does/not/exist/.env'), { code: 'ENOENT' });
});

test('★★ a host map that is absent, empty or not JSON is {} — never a crash, never a guess', () => {
  assert.deepEqual(storeHosts({}), {});
  assert.deepEqual(storeHosts({ FORGE_STORE_HOSTS: '' }), {});
  assert.deepEqual(storeHosts({ FORGE_STORE_HOSTS: 'not json' }), {});
  assert.deepEqual(storeHosts({ FORGE_STORE_HOSTS: '"a string"' }), {});
});

// ── ★★★ THE MATCHING RULE, WHICH IS THE KERNEL'S AND NOT AN INVENTION HERE ───────────────────────────────
//
// `docs/reference/read.store.by_host.md`: matching tries the exact host WITH its port first, then falls back
// to the bare host. A second, different rule in this repository would make two steps disagree about the same
// box — the warmer would name one store at the root and the kernel another.

const MAP = {
  FORGE_STORE_HOSTS: JSON.stringify({
    localhost: 'sto_ROOT',
    'localhost:8200': 'sto_ROOT',
    'box.example.test': 'sto_ROOT',
  }),
};

test('★★★ the exact authority wins, and a bare host is the FALLBACK — the kernel\'s own order', () => {
  assert.equal(storeAtRoot(MAP, 'localhost:8200'), 'sto_ROOT');
  // Declared bare, asked with a port: the fallback answers, which is how a map written for `loja.com`
  // still resolves a proxy forwarding `loja.com:443`.
  assert.equal(storeAtRoot(MAP, 'box.example.test:443'), 'sto_ROOT');
  assert.equal(storeAtRoot(MAP, 'box.example.test'), 'sto_ROOT');
});

test('★★ a `Host:` header is case-insensitive, so this comparison is too', () => {
  assert.equal(storeAtRoot(MAP, 'BOX.Example.Test'), 'sto_ROOT');
});

test('★★★ an authority nobody claims is null — the ANTI-VACUUM: this must not answer "the first one"', () => {
  // ⚠️ THE FAILURE THIS FORBIDS is `bin/box-up.sh --promote`'s deliberate shortcut, which reads the root
  // store as «the `localhost` key, else the first value in the map». That is right where it stands (it is
  // re-writing the map it just read) and would be a lie here: a step warming an origin nobody claims would
  // be told a store is at its root.
  assert.equal(storeAtRoot(MAP, 'somewhere-else.example.test'), null);
  assert.equal(storeAtRoot(MAP, ''), null);
  assert.equal(storeAtRoot({}, 'localhost'), null);
});
