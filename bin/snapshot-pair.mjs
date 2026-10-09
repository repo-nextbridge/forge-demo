#!/usr/bin/env node
// ★★★ WHAT A SNAPSHOT OF THIS BOX MUST CARRY, AND WHEN A SNAPSHOT MAY NOT BE RESTORED — the half of
// `bin/snapshot.sh` that is a JUDGEMENT rather than a gesture, kept in node so a guard can grade it.
//
//   node bin/snapshot-pair.mjs names  --author bin/birth-remote.sh       the pair's names, as JSON
//   node bin/snapshot-pair.mjs state                                     box-down's STATE volumes + disposition
//   node bin/snapshot-pair.mjs manifest --dir <facts dir>                build manifest.json from the box's facts
//   node bin/snapshot-pair.mjs judge --dir <facts dir>                   0 restorable · 1 refused (reasons on stderr)
//
// ── ⛔ THE DATABASE IS NOT THE WHOLE STATE OF A BORN BOX (measured on this tree, 2026-10-09) ────────────────
//
// A birth MINTS values that live outside Postgres and that Postgres references or checks:
//
//   · `.secrets` — the operator and admin-service tokens per tenant (bin/birth-remote.sh:721-722, step 3), the
//     platform token (:814, step 4), the bulk reader (:825, step 4b), the gate's /enter keys (:885, step 5b).
//     The kernel stores what it needs to CHECK them; the box holds the only copy that can PRESENT them.
//   · `.env` — the store ids and the host → store map (:755-767, :950, :1015), the sibling switcher (:805-806),
//     the /enter map (:923), the purge secret (:777). Every `sto_…` in there is a row id of THIS database.
//
// ⇒ A dump alone restores rows whose ids and token hashes match the box that minted them — and a box reborn
// from zero after the gold was taken carries DIFFERENT ones. The operator token then answers 401 against the
// restored tenant and FORGE_STORE_HOSTS points every face at a store id that no longer exists: a box that is
// up, green at /health, and serves nobody. So a snapshot is the PAIR — dump + what the birth minted outside
// it — and a restore puts both back. `bin/snapshot.guard.mjs` proves the pair is put back, and that a gold
// without it is refused before anything is destroyed.
//
// ★ THE NAMES ARE READ OUT OF THE BIRTH, NEVER TYPED HERE. `remote_env_put <KEY>` / `remote_secret_put <name>`
// (and the bench's `put_env` / `put_secret`) are the birth's own record of what it writes; the day a step
// mints a ninth value, the snapshot carries it without an edit to this file. The same derivation
// `bin/birth-remote.guard.mjs` uses for the sentinel rule.
//
// ⛔ IDENTITY IS NOT IN THE PAIR. The bucket keys, OAuth clients, SMTP — what the box IS to the outside — do not
// change across a rebirth and belong to whoever owns the box; a restore that rewrote them would roll back an
// owner's rotation. `forge-postgres-password` is not in it either: `pg_dump` carries no roles, so the dump
// does not reference it.
//
// ★★ ONE EXCEPTION, AND IT IS THE DATABASE'S, NOT THE BIRTH'S: `forge-vault-key`. It is minted once, by hand,
// before the first deploy (bin/deploy.sh:273), and the kernel ENCRYPTS what apps store with it
// (compose.yml:89, "Rotating it re-keys them"). A dump restored under another vault key holds ciphertext
// nobody can open. On the same box it is the same value and putting it back changes nothing; on a box rebuilt
// from a lost disk it is the one secret without which the gold is not a gold.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Secrets the DATABASE references that no birth mints — see the header for why there is exactly one. */
export const DB_REFERENCED_SECRETS = ['forge-vault-key'];

/**
 * What a restore must find in a gold's pair, or the gold is not a born box. `forge-operator-token` is the
 * birth's own record that it ran (bin/birth-remote.sh, THE REFUSAL); the vault key is the database's.
 */
export const PAIR_REQUIRED_SECRETS = ['forge-operator-token', ...DB_REFERENCED_SECRETS];

/**
 * How each STATE volume of `bin/box-down.sh` comes back. box-down is the ONE author of WHICH volumes are
 * state; this table only says HOW each returns, and a STATE volume missing here is a refusal to take a gold
 * (a snapshot that silently left a state volume behind would restore a box that is not the one it says).
 *
 *   dump     logical dump of the database served by `service` — portable across a kernel upgrade, which a
 *            copy of the data directory is not (migrate runs on top of it).
 *   discard  NOT carried: derived from the database. Redis is «speed, never truth» (the product's
 *            packages/db/src/cache.ts:1-4) with a one-hour backstop TTL — restored next to an older database
 *            it would serve the dirty store's read model for up to an hour. Destroyed and re-derived.
 *   archive  a tar of the volume, put back byte for byte (media under the local driver; empty under s3).
 */
export const STATE_DISPOSITION = {
  pgdata: { how: 'dump', service: 'postgres' },
  redisdata: { how: 'discard' },
  media: { how: 'archive' },
};

/** box-down's STATE list, read out of the script exactly as `bin/box-volumes.guard.mjs` reads it. */
export function stateVolumes(boxDownText) {
  const m = /^STATE='([^']*)'/m.exec(boxDownText);
  if (!m) throw new Error('bin/box-down.sh no longer declares STATE= — the snapshot cannot know what state is.');
  return m[1].split(/\s+/).filter(Boolean);
}

/** Every STATE volume with its disposition; throws naming the ones nobody decided. */
export function statePlan(boxDownText, disposition = STATE_DISPOSITION) {
  const vols = stateVolumes(boxDownText);
  const undecided = vols.filter((v) => !disposition[v]);
  if (undecided.length > 0) {
    throw new Error(
      `bin/box-down.sh calls ${undecided.join(', ')} STATE and bin/snapshot-pair.mjs has no disposition for ` +
        'it — a gold taken now would not carry it, and a restore would bring the box back without it. ' +
        'Decide dump / discard / archive in STATE_DISPOSITION.',
    );
  }
  return vols.map((v) => ({ volume: v, ...disposition[v] }));
}

/**
 * The pair's names, read out of a birth script. Code only: comment lines are dropped first, so a sentence
 * that QUOTES `remote_env_put FOO` mints nothing.
 *
 * @returns {{ env: string[], secrets: string[], secretFamilies: string[] }}
 *   `secretFamilies` are the per-tenant bases of `secret_name_for` (`<base>` for the first tenant,
 *   `<base>-<tenant>` for the others) — matched by family, since the tenants are data.
 */
export function mintedNames(birthText) {
  const code = birthText
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const env = new Set();
  for (const m of code.matchAll(/^\s*(?:remote_env_put|put_env)\s+([A-Z_][A-Z0-9_]*)\b/gm)) env.add(m[1]);
  // ⚠️ AND THE WRITES THAT DO NOT GO THROUGH THE HELPER. Measured 2026-10-09: the bench birth writes
  // FORGE_TOTEM_STORE_ID with `sed -i "s|^FORGE_TOTEM_STORE_ID=…"` / `printf 'FORGE_TOTEM_STORE_ID=%s\n' >> .env`
  // (bin/box-up.sh:1958-1961), and a helper-only parse missed the counter's store id — a row id of the dump.
  for (const m of code.matchAll(/sed -i "s\|\^([A-Z_][A-Z0-9_]*)=[^\n]*\.env"/g)) env.add(m[1]);
  for (const m of code.matchAll(/printf '([A-Z_][A-Z0-9_]*)=%s\\n'[^\n]*>>\s*"\$HERE\/\.env"/g)) env.add(m[1]);
  const secrets = new Set();
  for (const m of code.matchAll(/^\s*(?:remote_secret_put|put_secret)\s+(forge-[a-z0-9-]+)\b/gm)) secrets.add(m[1]);
  const families = new Set();
  const fn = /^secret_name_for\(\)\s*\{([\s\S]*?)^\}/m.exec(code);
  const usesFamilies = /(?:remote_secret_put|put_secret)\s+"\$\(secret_name_for\b/.test(code);
  if (fn && usesFamilies) {
    for (const m of fn[1].matchAll(/base=(forge-[a-z0-9-]+)/g)) families.add(m[1]);
  }
  for (const s of DB_REFERENCED_SECRETS) secrets.add(s);
  return { env: [...env].sort(), secrets: [...secrets].sort(), secretFamilies: [...families].sort() };
}

/** Does a `.secrets` name belong to the pair? Exact name, or a member of a per-tenant family. */
export function secretInPair(name, names) {
  if (names.secrets.includes(name)) return true;
  return names.secretFamilies.some((base) => name === base || (name.startsWith(`${base}-`) && /^[a-z0-9-]+$/.test(name.slice(base.length + 1))));
}

/**
 * The lines of a KEY=VALUE file that belong to the pair. Pure, and the guard runs the box-side selection
 * against it, so the python on the box and this cannot disagree without a red.
 */
export function selectPair(text, isMember) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^([A-Za-z_][A-Za-z0-9_-]*)=/.exec(line);
    if (m && isMember(m[1])) out.push(line);
  }
  return out;
}

/** `forgeVersion` and the kernel ref out of a forge.lock's text. */
export function lockStamp(lockText) {
  const lock = JSON.parse(lockText);
  const k = lock.images?.kernel;
  return { forgeVersion: lock.forgeVersion ?? null, kernelRef: (typeof k === 'object' ? k?.ref : k) ?? null };
}

/** `scope/name` lines (system/0001_x.sql, tenant/0001_y.sql) → a sorted, de-duplicated list. */
export function parseMigrations(text) {
  return [...new Set(text.split('\n').map((l) => l.trim()).filter((l) => /^(system|tenant)\/\S+\.sql$/.test(l)))].sort();
}

/** `schema.table<TAB>count` lines → { 'schema.table': n }. */
export function parseCounts(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const [k, v] = line.split('\t');
    if (k && v !== undefined && /^\d+$/.test(v.trim())) out[k.trim()] = Number(v.trim());
  }
  return out;
}

/**
 * ★★ THE JUDGEMENT — may this gold be restored onto this box, and what will migrate have to do?
 *
 * Every refusal is decided HERE, before `bin/snapshot.sh` destroys anything: a restore refused after
 * box-down is a box with no state and no gold.
 *
 * @param {object} f
 * @param {object|null} f.manifest           the gold's manifest.json, or null when the box has none
 * @param {string[]|null} f.kernelMigrations the migrations the KERNEL IMAGE carries (scope/name)
 * @param {boolean} f.sumsOk                 `sha256sum -c` of the gold's files, run on the box
 * @param {string[]} f.pairSecretNames       the NAMES in the gold's pair.secrets (never the values)
 * @returns {{ ok: boolean, refusals: string[], pending: string[] }}
 */
export function judgeGold({ manifest, kernelMigrations, sumsOk, pairSecretNames }) {
  const refusals = [];
  if (!manifest) {
    return {
      ok: false,
      refusals: [
        'THIS BOX HAS NO GOLD — no manifest.json where the gold should be. Nothing was touched. Take one from ' +
          'a proven box (`bin/snapshot.sh take`), or put the off-box copy back (`bin/snapshot.sh push`).',
      ],
      pending: [],
    };
  }
  if (manifest.format !== 1) refusals.push(`the gold's manifest is format ${manifest.format}; this tool reads format 1.`);
  if (!sumsOk) {
    refusals.push(
      "THE GOLD'S FILES DO NOT MATCH ITS OWN SHA256SUMS — a truncated copy or a file edited after the take. " +
        'A gold that cannot prove it is the bytes that were taken is not restored.',
    );
  }
  const names = new Set(pairSecretNames ?? []);
  const missing = PAIR_REQUIRED_SECRETS.filter((n) => !names.has(n));
  if (names.size === 0 || missing.length > 0) {
    refusals.push(
      `THE GOLD HAS NO PAIR — its pair.secrets ${names.size === 0 ? 'is empty or absent' : `lacks ${missing.join(', ')}`}. ` +
        'The dump references tokens and store ids minted outside the database; restored alone it brings back ' +
        'a tenant whose operator token answers 401 and a host map pointing at stores that do not exist. ' +
        'Retake the gold from the born box.',
    );
  }
  let pending = [];
  if (!kernelMigrations || kernelMigrations.length === 0) {
    refusals.push(
      "THE KERNEL'S MIGRATIONS COULD NOT BE READ, so whether this gold is NEWER than the kernel is unknown — " +
        'and unknown is not "no". Nothing was touched.',
    );
  } else {
    const kernel = new Set(kernelMigrations);
    const gold = manifest.migrations ?? [];
    const ahead = gold.filter((m) => !kernel.has(m));
    if (gold.length === 0) refusals.push('the gold records no applied migration — it was not taken from a migrated box.');
    if (ahead.length > 0) {
      refusals.push(
        `THE GOLD IS NEWER THAN THIS KERNEL — it was taken under ${manifest.forgeVersion ?? '?'} and holds ` +
          `${ahead.length} migration(s) this kernel image does not have (${ahead.slice(0, 5).join(', ')}` +
          `${ahead.length > 5 ? ', …' : ''}). A schema the running code has never heard of is not restored; ` +
          'deploy the pin the gold was taken under, or take a new gold.',
      );
    }
    const goldSet = new Set(gold);
    pending = kernelMigrations.filter((m) => !goldSet.has(m));
  }
  return { ok: refusals.length === 0, refusals, pending };
}

// ── THE CLI ────────────────────────────────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function readOr(path, fallback) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return fallback;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const verb = process.argv[2];
  const boxDown = () => readFileSync(join(HERE, 'bin/box-down.sh'), 'utf8');
  try {
    if (verb === 'names') {
      const author = arg('--author');
      if (!author) throw new Error('names needs --author <birth script>');
      process.stdout.write(`${JSON.stringify(mintedNames(readFileSync(join(HERE, author), 'utf8')))}\n`);
    } else if (verb === 'state') {
      // One volume per line: `<volume> <how> <service|->`, for the shell to loop over.
      for (const s of statePlan(boxDown())) process.stdout.write(`${s.volume} ${s.how} ${s.service ?? '-'}\n`);
    } else if (verb === 'manifest') {
      const dir = arg('--dir');
      const stamp = lockStamp(readFileSync(join(dir, 'forge.lock'), 'utf8'));
      const pairNames = JSON.parse(readFileSync(join(dir, 'pair-names.json'), 'utf8'));
      const manifest = {
        format: 1,
        takenAt: new Date().toISOString(),
        origin: readOr(join(dir, 'origin'), '').trim(),
        forgeVersion: stamp.forgeVersion,
        kernelRef: stamp.kernelRef,
        migrations: parseMigrations(readFileSync(join(dir, 'migrations.txt'), 'utf8')),
        counts: parseCounts(readFileSync(join(dir, 'counts.tsv'), 'utf8')),
        state: statePlan(boxDown()).map((s) => ({ ...s, present: readOr(join(dir, `present-${s.volume}`), '') !== '' })),
        pair: pairNames,
      };
      process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    } else if (verb === 'judge') {
      const dir = arg('--dir');
      const text = readOr(join(dir, 'manifest.json'), '');
      const verdict = judgeGold({
        manifest: text ? JSON.parse(text) : null,
        kernelMigrations: parseMigrations(readOr(join(dir, 'kernel-migrations.txt'), '')),
        sumsOk: readOr(join(dir, 'sums'), '').trim() === 'OK',
        pairSecretNames: readOr(join(dir, 'pair-secret-names'), '').split('\n').map((s) => s.trim()).filter(Boolean),
      });
      for (const r of verdict.refusals) process.stderr.write(`[snapshot] ⛔ ${r}\n`);
      process.stdout.write(`${JSON.stringify({ ok: verdict.ok, pending: verdict.pending })}\n`);
      process.exit(verdict.ok ? 0 : 1);
    } else if (verb === 'counts-equal') {
      // <manifest> <counts.tsv>: the restored database, counted, against what the take counted.
      const manifest = JSON.parse(readFileSync(process.argv[3], 'utf8'));
      const now = parseCounts(readFileSync(process.argv[4], 'utf8'));
      const want = manifest.counts ?? {};
      const diff = [...new Set([...Object.keys(want), ...Object.keys(now)])]
        .filter((k) => want[k] !== now[k])
        .map((k) => `${k}: gold ${want[k] ?? 'absent'} · restored ${now[k] ?? 'absent'}`);
      if (Object.keys(want).length === 0) {
        process.stderr.write('[snapshot] ⛔ the gold counted no table — there is nothing to compare against.\n');
        process.exit(1);
      }
      if (diff.length > 0) {
        process.stderr.write(`[snapshot] ⛔ ${diff.length} table(s) differ from the gold:\n   ${diff.slice(0, 20).join('\n   ')}\n`);
        process.exit(1);
      }
      process.stdout.write(`${Object.keys(want).length} table(s), ${Object.values(want).reduce((a, b) => a + b, 0)} row(s) — equal to the gold\n`);
    } else {
      process.stderr.write('usage: snapshot-pair.mjs names|state|manifest|judge|counts-equal …\n');
      process.exit(2);
    }
  } catch (err) {
    process.stderr.write(`[snapshot] ⛔ ${err.message}\n`);
    process.exit(2);
  }
}
