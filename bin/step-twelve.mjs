// ★ v031/G — STEP 12 OF A BIRTH, RUN FOR REAL OVER STUBS, so the two roteiro guards can hold what it does
// without a box: `bin/birth-roteiro.guard.mjs` (bench, `bin/box-up.sh`) and `bin/birth-remote.guard.mjs`
// (remote, `bin/birth-remote.sh`). Not a test file itself — `bin/test.sh` collects `*.test.mjs`/`*.guard.mjs`.
//
// The block between `say '12 ·` and the `# ── 13` banner is cut out of the script, its COMMENTS STRIPPED (the
// prose there names `verify-content` and must not satisfy anything), and executed with every helper it calls
// stubbed: `node`/`host_node` record which verifier ran for which tenant and exit with the status the test
// chose. What comes back is the order of calls and the `UNSETTLED` the step leaves for the end of the run.

import { execFileSync } from 'node:child_process';

export function stepTwelveOf(script) {
  const at = script.search(/^say '12 ·/m);
  if (at < 0) throw new Error('the script no longer says step 12');
  const end = script.indexOf('\n# ── 13', at);
  if (end < 0) throw new Error('step 12 has no `# ── 13` banner after it to end the cut');
  return script
    .slice(at, end)
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** @param fails {{ seed?: string[], content?: string[] }} tenants whose verifier exits 1 */
export function runStepTwelve(script, { tenants = ['alpha', 'beta'], fails = {} } = {}) {
  const red = (list) => (list ?? []).join(' ');
  const harness = `
set -uo pipefail
say() { :; }
note() { :; }
die() { echo "DIE $*"; exit 9; }
secret_name_for() { echo "$1-seed"; }
verifier() {
  local which; which="$(basename "$1" .mjs)"; shift
  local t=''; while [ $# -gt 0 ]; do [ "$1" = --tenant ] && t="$2"; shift; done
  echo "CALL $which $t"
  case "$which" in
    verify-seed) case " ${red(fails.seed)} " in *" $t "*) return 1 ;; esac ;;
    verify-content) case " ${red(fails.content)} " in *" $t "*) return 1 ;; esac ;;
  esac
  return 0
}
node() { verifier "$@"; }
host_node() { verifier "$@"; }
HERE=/nowhere
FORGE_PUBLIC_ORIGIN=http://probe.invalid
TENANTS='${tenants.join(' ')}'
${tenants.map((t) => `${t.toUpperCase()}_SEED=tok_${t}`).join('\n')}
${stepTwelveOf(script)}
echo "UNSETTLED=[$UNSETTLED]"
`;
  const out = execFileSync('bash', ['-c', harness], { encoding: 'utf8' });
  return {
    calls: [...out.matchAll(/^CALL (\S+) (\S+)$/gm)].map((m) => `${m[1]}:${m[2]}`),
    unsettled: (/^UNSETTLED=\[(.*)\]$/m.exec(out)?.[1] ?? '').trim().split(/\s+/).filter(Boolean),
    out,
  };
}
