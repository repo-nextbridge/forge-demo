#!/usr/bin/env node
// ★★ WHICH TENANTS THIS RUN BUILDS — declared by the developer, never by editing `seed/box.json` (DX-I5).
//
//   node bin/box-tenants.mjs [--tenant <id>]… [--declared "<FORGE_BOX_TENANTS value>"]
//
// stdout: the tenants this run builds, one per line, IN `seed/box.json` ORDER (the order is load-bearing:
// `bin/box-up.sh::secret_name_for` gives the FIRST declared tenant the unsuffixed secret names, and the root
// of the shop to its bootstrap store — so a selection may narrow the list, never reorder it).
// stderr + exit 1: a refusal, naming every tenant `seed/box.json` declares.
//
// ── ⛔ WHY THIS EXISTS, MEASURED 2026-10-10 (RESULTADOS-dx0, line 4) ───────────────────────────────────────
//
// `bin/box-up.sh` built EVERY tenant `seed/box.json` declares, and the only way to build fewer was to edit
// that versioned file. The café is cheap; the cost is step 9 of `forgeco` — the massive footwear catalogue,
// 23 to 32 minutes — and a developer working on the café's fork or on the totem paid half an hour for a
// shop they never open. So the selection is a DECLARATION with two spellings, and the command line wins:
//
//   bash bin/box-up.sh --tenant forgecafe          this run only (repeatable: `--tenant a --tenant b`)
//   FORGE_BOX_TENANTS=forgecafe   (in `.env`)      this bench, every run — `--warm-only`/`--verdict-only` too
//
// Neither set ⇒ every declared tenant, which is exactly what every bench born before this slice builds.
//
// ⛔ A NAME `seed/box.json` DOES NOT DECLARE IS REFUSED, NEVER DROPPED. A typo (`forgecaf`) that quietly
// selected nothing — or, worse, everything — would hand a developer a bench that is not the one they asked
// for, with a green summary. So the refusal names the stranger AND the tenants that do exist.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A declaration's spelling: comma- and/or space-separated, quotes stripped, empty items ignored. */
export function parseTenantList(value) {
  return String(value ?? '')
    .replace(/['"]/g, '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {{ declared: string[], asked?: string[], fromEnv?: string }} args
 *   `declared` — every tenant id `seed/box.json` declares, in its order.
 *   `asked`    — the `--tenant` values of this invocation (they WIN over `fromEnv` when any is given).
 *   `fromEnv`  — the `FORGE_BOX_TENANTS` value, raw.
 * @returns {{ wanted: string[], notAsked: string[], source: 'command line' | 'FORGE_BOX_TENANTS' | 'every tenant' }}
 * @throws {Error} naming the unknown tenant(s) and every declared one.
 */
export function resolveTenants({ declared, asked = [], fromEnv = '' }) {
  if (!declared?.length) throw new Error('seed/box.json declares no tenant at all — there is nothing to select from.');
  const fromArgs = asked.flatMap(parseTenantList);
  const fromFile = parseTenantList(fromEnv);
  const source = fromArgs.length > 0 ? 'command line' : fromFile.length > 0 ? 'FORGE_BOX_TENANTS' : 'every tenant';
  const picked = fromArgs.length > 0 ? fromArgs : fromFile.length > 0 ? fromFile : declared;
  const unknown = [...new Set(picked.filter((t) => !declared.includes(t)))];
  if (unknown.length > 0) {
    throw new Error(
      `${unknown.map((t) => `"${t}"`).join(', ')} ${unknown.length === 1 ? 'is not a tenant' : 'are not tenants'} ` +
        `seed/box.json declares (asked on the ${source}). The tenants this box can build: ${declared.join(', ')}. ` +
        'Nothing was touched.',
    );
  }
  const wanted = declared.filter((t) => picked.includes(t));
  return { wanted, notAsked: declared.filter((t) => !wanted.includes(t)), source };
}

/**
 * The tenant whose bootstrap store is the ROOT of the shop: the FIRST one `seed/box.json` declares.
 * `bin/box-up.sh` step 3b sets `ROOT_STORE` from `head -1` of the same list; this is that rule for a reader
 * that is not a shell (`bin/verify-config.mjs`).
 */
export const rootTenant = (box) => box?.tenants?.[0]?.id ?? null;

/** The declared ids of a parsed `seed/box.json`. */
export const declaredTenants = (box) => (box?.tenants ?? []).map((t) => t.id);

// ── the command line ─────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const asked = [];
  let fromEnv = process.env.FORGE_BOX_TENANTS ?? '';
  let boxPath = join(ROOT, 'seed/box.json');
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tenant') asked.push(argv[++i] ?? '');
    else if (a === '--declared') fromEnv = argv[++i] ?? '';
    else if (a === '--box') boxPath = argv[++i] ?? boxPath;
    else {
      process.stderr.write(`[box-tenants] unknown argument "${a}"\n`);
      process.exit(2);
    }
  }
  // `--tenant` with no value is a question nobody can answer — refused before it can mean "every tenant".
  if (asked.some((v) => v === '' || v.startsWith('--'))) {
    process.stderr.write('[box-tenants] --tenant needs a tenant id, e.g. `--tenant forgecafe`.\n');
    process.exit(1);
  }
  let box;
  try {
    box = JSON.parse(readFileSync(boxPath, 'utf8'));
  } catch (error) {
    process.stderr.write(`[box-tenants] ${boxPath} could not be read (${error.code ?? error.message}).\n`);
    process.exit(2);
  }
  try {
    const { wanted } = resolveTenants({ declared: declaredTenants(box), asked, fromEnv });
    process.stdout.write(`${wanted.join('\n')}\n`);
  } catch (error) {
    process.stderr.write(`[box-tenants] ${error.message}\n`);
    process.exit(1);
  }
}
