// The post-mortem capture, proven without a daemon — `docker` is injected, so every case below is a
// measurement of THIS code rather than of this machine's docker.
//
// ⚠️ THE FIRST TEST IS THE ONE THAT MATTERS. `docker ps -a --filter label=…` on a project that does not exist
// exits **0** with an empty stdout (measured on this bench, 2026-09-05). A capture that trusted the exit code
// would create a directory, write nothing into it, and report success — a post-mortem folder that says the
// kernel was silent when in truth nobody ever looked. The void has to accuse itself.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { EvidenceError, captureDirName, captureEvidence, parseContainers } from './evidence.mjs';

const NOW = new Date('2026-09-05T04:01:44.512Z');
const root = () => mkdtempSync(join(tmpdir(), 'pk14-evidence-'));

/** A docker that answers a script of canned responses, keyed by the first argument. */
const fakeDocker = (script) => {
  const calls = [];
  const fn = (args) => {
    calls.push(args);
    const handler = script[args[0]];
    const answer = typeof handler === 'function' ? handler(args) : handler;
    return { status: 0, stdout: '', stderr: '', ...(answer ?? {}) };
  };
  fn.calls = calls;
  return fn;
};

const PS_ROWS =
  'aaaa1111\tkernel\t2026-09-05 04:01:44 -0300 -03\trunning\tforge-preseed-kernel-1\n' +
  'bbbb2222\tcaddy\t2026-09-05 04:01:45 -0300 -03\trunning\tforge-preseed-caddy-1\n';

describe('the void accuses itself', () => {
  it('⛔ a project with no container is a FAILURE, not an empty folder', () => {
    const dir = root();
    // Measured shape: docker answers this case with exit 0 and nothing on stdout.
    const docker = fakeDocker({ ps: { status: 0, stdout: '' } });
    assert.throws(
      () => captureEvidence({ docker, project: 'nao-existe-xyz', reason: 'seed-red', root: dir, now: NOW }),
      (err) => err instanceof EvidenceError && /NO CONTAINER/.test(err.message),
    );
    // ★ AND IT LEFT NOTHING BEHIND. A directory named after a red birth, containing nothing, is a lie that
    // reads like evidence.
    assert.deepEqual(readdirSync(dir), []);
  });

  it('names the project it looked for, so the operator can tell a typo from a torn-down box', () => {
    const docker = fakeDocker({ ps: { status: 0, stdout: '' } });
    assert.throws(
      () => captureEvidence({ docker, project: 'forge-preseed', reason: 'x', root: root(), now: NOW }),
      /forge-preseed/,
    );
  });

  it('docker refusing to answer is also a refusal to capture — and it quotes docker', () => {
    const dir = root();
    const docker = fakeDocker({ ps: { status: 1, stderr: 'permission denied while trying to connect' } });
    assert.throws(
      () => captureEvidence({ docker, project: 'p', reason: 'x', root: dir, now: NOW }),
      (err) => err instanceof EvidenceError && /permission denied/.test(err.message),
    );
    assert.deepEqual(readdirSync(dir), []);
  });
});

describe('a capture that has something to capture', () => {
  const run = (overrides = {}) => {
    const dir = root();
    const docker = fakeDocker({
      ps: { stdout: PS_ROWS },
      logs: (args) =>
        args.at(-1) === 'aaaa1111'
          ? { stdout: 'listening on 8080\n', stderr: 'ECONNRESET from postgres\n' }
          : { stdout: 'caddy up\n' },
      inspect: { stdout: '[{"Id":"aaaa1111"}]' },
      ...overrides,
    });
    const out = captureEvidence({ docker, project: 'forge-preseed', reason: 'seed-red', root: dir, now: NOW });
    return { dir, out, docker };
  };

  it('writes one log file per container, named by SERVICE', () => {
    const { out } = run();
    const files = readdirSync(out.dir).sort();
    assert.deepEqual(files, [
      'MANIFEST.md',
      'caddy.inspect.json',
      'caddy.log',
      'kernel.inspect.json',
      'kernel.log',
    ]);
  });

  it("★ keeps BOTH halves of `docker logs` — a kernel's interesting half is its stderr", () => {
    const { out } = run();
    const kernel = readFileSync(join(out.dir, 'kernel.log'), 'utf8');
    assert.match(kernel, /listening on 8080/);
    assert.match(kernel, /ECONNRESET from postgres/);
  });

  it('the directory name is sortable and carries the reason', () => {
    const { out } = run();
    assert.match(out.dir, /2026-09-05T04-01-44Z__seed-red$/);
  });

  it('the manifest states WHEN each container was created — the field that ties a log to a run', () => {
    const { out } = run();
    const manifest = readFileSync(join(out.dir, 'MANIFEST.md'), 'utf8');
    assert.match(manifest, /04:01:44/);
    assert.match(manifest, /aaaa1111/);
    assert.match(manifest, /seed-red/);
  });

  it('asks for the log with --timestamps, because a log without a clock cannot be lined up with the seed', () => {
    const { docker } = run();
    const logCall = docker.calls.find((c) => c[0] === 'logs');
    assert.ok(logCall.includes('--timestamps'), `logs called as: ${logCall.join(' ')}`);
  });
});

describe('a container that is there and says nothing', () => {
  it('⚠️ is written, NAMED in the manifest and counted — never a silent 0-byte file', () => {
    const dir = root();
    const notes = [];
    const docker = fakeDocker({ ps: { stdout: PS_ROWS }, logs: { stdout: '', stderr: '' }, inspect: { stdout: '[]' } });
    const out = captureEvidence({
      docker,
      project: 'p',
      reason: 'seed-red',
      root: dir,
      now: NOW,
      note: (m) => notes.push(m),
    });
    assert.equal(out.captured, 0);
    assert.equal(out.empty, 2);
    assert.equal(notes.filter((n) => /0 bytes/.test(n)).length, 2);
    assert.match(readFileSync(join(out.dir, 'MANIFEST.md'), 'utf8'), /⚠️ \*\*0\*\*/);
  });

  it('a log docker REFUSED is a different fact from an empty log, and the manifest keeps them apart', () => {
    const docker = fakeDocker({
      ps: { stdout: PS_ROWS },
      logs: { status: 1, stderr: 'configured logging driver does not support reading' },
      inspect: { stdout: '[]' },
    });
    const notes = [];
    const out = captureEvidence({ docker, project: 'p', reason: 'r', root: root(), now: NOW, note: (m) => notes.push(m) });
    const manifest = readFileSync(join(out.dir, 'MANIFEST.md'), 'utf8');
    assert.match(manifest, /docker refused/);
    assert.ok(notes.some((n) => /refused its log/.test(n)));
  });
});

describe('parsing', () => {
  it('an unlabelled container is kept and SAID, not dropped', () => {
    const rows = parseContainers('cccc\t\t2026-09-05 04:00:00 -0300 -03\texited\tstray\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].service, '(unlabelled)');
  });

  it('ignores blank lines rather than inventing a container out of one', () => {
    assert.deepEqual(parseContainers('\n\n  \n'), []);
  });

  it('the folder name never carries a path separator, whatever the reason says', () => {
    assert.equal(captureDirName('../../etc/passwd', NOW), '2026-09-05T04-01-44Z__etc-passwd');
  });
});

describe('the file it writes is the file it names', () => {
  it('every entry it returns exists on disk', () => {
    const docker = fakeDocker({ ps: { stdout: PS_ROWS }, logs: { stdout: 'x' }, inspect: { stdout: '[]' } });
    const out = captureEvidence({ docker, project: 'p', reason: 'r', root: root(), now: NOW });
    for (const entry of out.entries) assert.ok(existsSync(join(out.dir, entry.file)), entry.file);
  });
});
