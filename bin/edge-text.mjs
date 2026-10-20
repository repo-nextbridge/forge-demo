// ★ READING THIS BOX'S EDGE AND COMPOSE FILES AS CODE — the helpers more than one guard needs.
//
// Moved here from `bin/noindex-edge.guard.mjs` (MZ-9) when `bin/access-log-edge.guard.mjs` (v0.3.3, VC-2)
// became the second guard asking "does every site block import this snippet?" — a guard file cannot be
// imported without running its tests a second time in the importer's process, and a second copy of the depth
// rule is the drift these guards exist to catch. Nothing about the rules changed in the move.

import { topLevelBlocks } from './box-domains.mjs';

/** The file with every comment removed — a `#` at the start of a line or after whitespace (Caddy's rule). */
export const codeOf = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, '').replace(/\s+$/, ''))
    .join('\n');

/** Site blocks of a Caddyfile's CODE: neither the global options block nor a snippet definition. */
export function sitesOf(text) {
  return topLevelBlocks(codeOf(text)).filter((b) => b.header !== '' && !/^\(.*\)$/.test(b.header));
}

/** The body of a snippet definition, code only, trimmed, blank lines out; `null` if it is not defined. */
export function snippetCode(text, name) {
  const b = topLevelBlocks(codeOf(text)).find((x) => x.header === `(${name})`);
  return b ? b.body.map((l) => l.trim()).filter(Boolean) : null;
}

/** The site blocks that do NOT import the snippet at their own level (depth 0 of the site's body). */
export function sitesWithoutImport(text, name) {
  return sitesOf(text).filter((site) => {
    let depth = 0;
    for (const raw of site.body) {
      const line = raw.trim();
      if (depth === 0 && new RegExp(`^import\\s+${name}$`).test(line)) return false;
      if (line.endsWith('{')) depth += 1;
      if (line === '}') depth -= 1;
    }
    return true;
  });
}

/** The lines of one service of a compose file (a two-space key), comment lines dropped; null if absent. */
export function serviceBlock(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !/^ {2}[a-z0-9_-]+:\s*$/.test(lines[end]) && !/^\S/.test(lines[end])) end += 1;
  return lines.slice(start + 1, end).filter((l) => !/^\s*#/.test(l));
}

/** The named volume a service block mounts at `dir`, or null. */
export function volumeAt(block, dir) {
  const m = (block ?? []).map((l) => /^ {6}- ([a-z0-9_]+):(\S+?)\s*$/.exec(l)).find((x) => x && x[2] === dir);
  return m ? m[1] : null;
}

/** The top-level volumes a compose file declares (none → empty). */
export function topVolumes(text) {
  // ⚠️ `\Z` is NOT a JavaScript anchor; the end-of-input anchor is `$(?![\s\S])`.
  const block = /^volumes:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(text);
  if (!block) return [];
  return block[1].split('\n').map((l) => /^ {2}([a-z0-9_]+):/.exec(l)).filter(Boolean).map((m) => m[1]);
}
