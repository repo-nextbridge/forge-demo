#!/usr/bin/env node
// ★★★ ONE MESSAGE AT THE END OF A CYCLE — over the BOX'S OWN RELAY, with no dependency and no vendor.
//
//   … | node bin/cycle-mail.mjs --to <addr> --subject <line>        the body arrives on stdin
//   node bin/cycle-mail.mjs --probe                                 say whether a message COULD be sent
//
// ── ⛔ WHY SMTP BY HAND AND NOT A VENDOR'S HTTP API ─────────────────────────────────────────────────────────
//
// The relay this box happens to use today answers on an HTTP endpoint too, and one `fetch` would have been
// forty lines instead of a hundred and fifty. It is the wrong forty lines: the product's own doctrine is that
// an instance is never tied to a particular SaaS, and a cycle that could only report itself through ONE
// company's API would be exactly that tie, in the one script an operator cannot avoid running. SMTP is what
// every instance already configures — `FORGE_SMTP_*`, all four or none, enforced as a fatal boot error by the
// kernel — so the mail rides the relay the box ALREADY proves it can use every time somebody signs in.
//
// ⇒ AND THAT IS THE SECOND REASON: this message is a WITNESS. A cycle that reports green over the same relay
// the shop's one-time codes go out on has demonstrated that relay works, in the same breath.
//
// ── ⚠️ THE LIMIT, SAID OUT LOUD ────────────────────────────────────────────────────────────────────────────
//
// A cycle that fails BECAUSE the box's mail is broken cannot mail about it. That is not a hole to be plugged
// here — a second channel would be a second thing to configure, to forget and to be wrong about. The
// scheduler's own mail is the fallback, and it always was: `bin/box-cycle.sh` keeps its SHORT channel on
// stderr precisely so that a unit with no working relay still sends the four lines that matter, including
// where the log is. ⇒ SILENCE IS NOT GREEN, and the runbook says so in as many words.
//
// ── ★ WHAT IT DOES NOT DO ──────────────────────────────────────────────────────────────────────────────────
//
// No HTML, no template, no attachment. The body is the text it is given — the verdict and the clocks — and a
// mail that needs rendering is a mail nobody reads on a phone at 3am.

import { createConnection } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const PROBE = args.includes('--probe');

const env = process.env;
const HOST = env.FORGE_SMTP_HOST ?? '';
const PORT = Number(env.FORGE_SMTP_PORT ?? 587);
const USER = env.FORGE_SMTP_USER ?? '';
const PASS = env.FORGE_SMTP_PASS ?? '';
const FROM = env.FORGE_SMTP_FROM ?? '';

/** ⛔ ALL FOUR OR NONE, and it is the KERNEL'S rule, not this file's — `smtp-channel-driver.ts` refuses to
 *  boot on a partial set and names the missing one. Repeating the rule here (rather than sending with three
 *  of four and reading a server error) means the operator gets the same sentence from both. */
const MISSING = [
  ['FORGE_SMTP_HOST', HOST],
  ['FORGE_SMTP_USER', USER],
  ['FORGE_SMTP_PASS', PASS],
  ['FORGE_SMTP_FROM', FROM],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (PROBE) {
  if (MISSING.length > 0) {
    console.error(`[cycle-mail] no mail from here: missing ${MISSING.join(', ')}`);
    process.exit(1);
  }
  console.error(`[cycle-mail] a message could be sent: ${USER}@${HOST}:${PORT} as <${FROM}>`);
  process.exit(0);
}

const TO = flag('--to');
const SUBJECT = flag('--subject') ?? 'forge cycle';
if (!TO) {
  console.error('[cycle-mail] --to <address> is required. usage in this file’s header.');
  process.exit(2);
}
if (MISSING.length > 0) {
  console.error(
    `[cycle-mail] ⛔ cannot send: ${MISSING.join(', ')} ${MISSING.length === 1 ? 'is' : 'are'} not in this ` +
      'environment. The kernel’s rule is ALL FOUR OR NONE and this follows it — a relay configured by halves ' +
      'fails per message, which is the failure this refusal exists to replace.',
  );
  process.exit(1);
}

const body = await new Promise((resolve) => {
  let acc = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => {
    acc += c;
  });
  process.stdin.on('end', () => resolve(acc));
});

/** A tiny line protocol: write, then wait for the reply whose first line carries an expected code.
 *  ⚠️ SMTP replies can be MULTI-LINE (`250-…` continuing, `250 …` last), which is why the test is on the
 *  space rather than on the code alone — a naive `startsWith('250')` returns on the first of five lines and
 *  every command after it reads somebody else's answer. */
function talk(socket) {
  let buffer = '';
  const waiters = [];
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const m = buffer.match(/^(?:\d{3}-[^\n]*\n)*(\d{3}) [^\n]*\n/);
      if (!m) break;
      const reply = buffer.slice(0, m[0].length);
      buffer = buffer.slice(m[0].length);
      const w = waiters.shift();
      if (w) w({ code: Number(m[1]), text: reply.trim() });
    }
  });
  const next = () => new Promise((res) => waiters.push(res));
  return {
    next,
    async send(line, expect) {
      if (line !== null) socket.write(`${line}\r\n`);
      const reply = await next();
      if (expect && !expect.includes(reply.code)) {
        throw new Error(`server answered ${reply.code} to ${line === null ? 'the greeting' : line.split(' ')[0]}: ${reply.text}`);
      }
      return reply;
    },
  };
}

const enc = (s) => Buffer.from(s, 'utf8').toString('base64');
/** ⚠️ A LINE THAT STARTS WITH A DOT ENDS THE MESSAGE — the oldest bug in SMTP. Doubled, per RFC 5321. */
const dotStuff = (text) => text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');

const plain = createConnection({ host: HOST, port: PORT });
plain.setTimeout(30_000, () => {
  console.error(`[cycle-mail] ⛔ ${HOST}:${PORT} did not answer within 30s.`);
  process.exit(1);
});

try {
  let c = talk(plain);
  await c.send(null, [220]);
  await c.send(`EHLO forge-cycle`, [250]);
  await c.send('STARTTLS', [220]);

  // ⛔ THE CERTIFICATE IS VERIFIED. A relay whose name does not match is a relay somebody else is answering
  // for, and a cycle that mailed its verdict to a stranger would be worse than one that mailed nothing.
  const secure = tlsConnect({ socket: plain, servername: HOST });
  await new Promise((res, rej) => {
    secure.once('secureConnect', res);
    secure.once('error', rej);
  });
  c = talk(secure);
  await c.send(`EHLO forge-cycle`, [250]);
  await c.send('AUTH LOGIN', [334]);
  await c.send(enc(USER), [334]);
  await c.send(enc(PASS), [235]);
  await c.send(`MAIL FROM:<${FROM}>`, [250]);
  await c.send(`RCPT TO:<${TO}>`, [250, 251]);
  await c.send('DATA', [354]);
  const headers = [
    `From: ${FROM}`,
    `To: ${TO}`,
    `Subject: ${SUBJECT}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    `Date: ${new Date().toUTCString()}`,
  ].join('\r\n');
  secure.write(`${headers}\r\n\r\n${dotStuff(body)}\r\n.\r\n`);
  await c.send(null, [250]);
  await c.send('QUIT', [221]).catch(() => {});
  secure.end();
  console.error(`[cycle-mail] ✓ sent to ${TO}`);
  process.exit(0);
} catch (err) {
  console.error(`[cycle-mail] ⛔ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
