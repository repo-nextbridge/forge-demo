// ★★ WHAT A FAILED CALL HAS TO SAY, AND THE 04:01 BIRTH IS THE MEASUREMENT.
//
// The curated seed of 2026-09-05 died with exactly this on the screen:
//
//     [seed] catalog.collection.pin → HTTP 502
//
// …and a blank second line. That is not a bug in the printing — `bin/seed.mjs` interpolates the command name
// and up to 900 characters of the body, and it printed both. THE BODY WAS EMPTY. Measured against a real
// Caddy with a dead upstream, 2026-09-05:
//
//     HTTP/1.1 502 Bad Gateway
//     Server: Caddy
//     Content-Length: 0
//
// ⇒ An empty second line and "this seeder does not print bodies" look identical, and the difference decides
// where you go next. So the silence is now STATED, and the four things the old sentence genuinely did not
// carry are printed with it:
//
//   · WHICH DOOR — the method and the URL, so the face is visible rather than inferred from the command name;
//   · HOW LONG — 30 s of nothing is a timeout at the edge; 40 ms of nothing is a proxy with no upstream;
//   · WHERE IN THE SEQUENCE — the run's call number and the pacer's per-face tally. "It died after ~300 good
//     calls" was reconstructed by hand from a terminal scrollback, and only because one was still open;
//   · WHO ANSWERED — `Server: Caddy` / `Via: 1.1 Caddy` on a 5xx is the EDGE speaking. The kernel's own
//     refusals are JSON with a `code`. Those are two different investigations and the header separates them.
//
// ── ⚠️ AND THE ONE THING THAT CANNOT BE PRINTED, BECAUSE IT DOES NOT EXIST ──────────────────────────────────
//
// A request id. MEASURED against the running bench on 2026-09-05, on two faces:
//
//     GET /health                     → content-length, content-type, date, via
//     GET /v1/read/internal/whoami    → the same, plus ratelimit-limit / -remaining / -reset
//
// No `x-request-id`, no `traceparent`, on either. So there is NOTHING to correlate a seed failure with a
// kernel log line except the CLOCK — which is why this sentence carries an ISO instant, and why
// `bin/capture-evidence.mjs` asks docker for the logs `--timestamps`. Lining the two up by hand is the best
// this box can do today; a correlation header is the KERNEL's to emit and lives in the product repository.
// This function names the absence rather than printing an empty field, because "no request id" and "I did
// not look" are the same blank space.

/** The headers worth naming if a door ever starts sending one. Ordered by how much the answer is worth. */
export const CORRELATION_HEADERS = [
  'x-request-id',
  'request-id',
  'x-forge-request-id',
  'x-correlation-id',
  'traceparent',
];

/** `Headers`, a plain object, or nothing — flattened to lowercase entries. A seed must not care which. */
export function headerMap(headers) {
  const out = new Map();
  if (!headers) return out;
  if (typeof headers.entries === 'function') {
    for (const [k, v] of headers.entries()) out.set(String(k).toLowerCase(), String(v));
    return out;
  }
  for (const [k, v] of Object.entries(headers)) out.set(String(k).toLowerCase(), String(v));
  return out;
}

/** The first correlation header this response carries, or null. Named so the caller can say WHICH one. */
export function correlationOf(headers) {
  const map = headerMap(headers);
  for (const key of CORRELATION_HEADERS) if (map.has(key)) return { key, value: map.get(key) };
  return null;
}

/**
 * ★ WHO ANSWERED — the edge or the kernel. A 5xx carrying a proxy's signature and no body is the proxy
 * reporting that it got nothing from upstream; it is NOT the kernel refusing. Conflating them sends the
 * reader to read the seed's input when the answer is in the kernel's log.
 */
export function answeredByEdge({ status, headers, bodyText }) {
  if (status < 500) return false;
  const map = headerMap(headers);
  const signature = `${map.get('server') ?? ''} ${map.get('via') ?? ''}`.toLowerCase();
  const proxied = /caddy|nginx|envoy|traefik|haproxy/.test(signature);
  // A body that parses as one of the kernel's refusals is the kernel talking, whatever proxy relayed it.
  let kernelSpoke = false;
  try {
    const body = JSON.parse(bodyText || '');
    kernelSpoke = Boolean(body?.error?.kind || body?.code || body?.error?.code);
  } catch {
    kernelSpoke = false;
  }
  return proxied && !kernelSpoke;
}

const ms = (n) => (Number.isFinite(n) ? `${Math.round(n)} ms` : 'unknown time');

/**
 * The sentence `fail()` prints for a call the door refused. Pure: it renders what it is handed and invents
 * nothing — every number in it is measured by the caller at the moment of the call.
 */
export function httpFailure({
  name,
  method = 'GET',
  url = '',
  status,
  statusText = '',
  headers,
  bodyText = '',
  elapsedMs,
  call,
  retried = 0,
  retryVerdict = null,
  pace = '',
  at = new Date(),
}) {
  const lines = [`${name} → HTTP ${status}${statusText ? ` ${statusText}` : ''}`];
  lines.push(`  ${method.toUpperCase()} ${url}`);

  const where = Number.isFinite(call) ? `call #${call} of this run` : 'call # unknown';
  const again = retried > 0 ? ` · ${retried} retr${retried === 1 ? 'y' : 'ies'} already spent` : '';
  lines.push(`  ${where} · ${ms(elapsedMs)} · ${at.toISOString()}${again}`);

  const correlation = correlationOf(headers);
  if (correlation) {
    lines.push(`  ${correlation.key}: ${correlation.value}`);
  } else {
    const seen = [...headerMap(headers).keys()].sort();
    lines.push(
      `  NO REQUEST ID — this door sends none (headers seen: ${seen.join(', ') || 'none'}).\n` +
        `     Correlate by the CLOCK: the instant above against \`docker logs --timestamps\`.`,
    );
  }

  const bytes = Buffer.byteLength(bodyText ?? '');
  if (bytes === 0) {
    lines.push(
      '  ⚠️ THE RESPONSE CARRIED NO BODY (0 bytes) — this is a silence, not a refusal. The kernel\'s own',
      '     refusals are JSON and name a `code`; nothing here does.',
    );
  } else {
    lines.push(`  body (${bytes} bytes): ${String(bodyText).slice(0, 900)}`);
  }

  if (answeredByEdge({ status, headers, bodyText })) {
    const map = headerMap(headers);
    const who = map.get('server') || map.get('via') || 'a proxy';
    lines.push(
      `  ⇒ ★ THE EDGE ANSWERED, NOT THE KERNEL (${who}). A ${status} from the proxy means the upstream did`,
      '     not answer IT — so what this call asked for is only knowable from the KERNEL\'s log, and that log',
      '     lives in a container that `bash bin/box-up.sh --tailnet` recreates and `box-down.sh` removes.',
      '     ⇒ `node bin/capture-evidence.mjs --reason seed-red` copies it to `postmortem/` — do that BEFORE',
      '       running anything that touches the box. (A red `box-up` already does it for you.)',
    );
  }

  // ★ A DECISION NOT TO RETRY IS STATED — but only where the question was live. Silence on a gateway 5xx
  // reads exactly like a retry that also failed, and the two send the reader to opposite places: one is
  // "the box is sick", the other is "this call may not be repeated safely and nobody tried". On a 409 the
  // upstream DID answer, nobody was ever going to retry, and saying so is noise on the line that matters.
  if (retryVerdict && !retryVerdict.retry && GATEWAY_STATUSES.has(status)) {
    lines.push(`  not retried — ${retryVerdict.why}`);
  }

  if (pace) lines.push(`  ${pace}`);
  return lines.join('\n');
}

// ── ★★ SHOULD A 5xx BE TRIED AGAIN? — MEASURED, and the answer is not the one the notebook expected ─────────
//
// The 502 of 2026-09-05 was ONE call in ~300, it did not reproduce on a re-run, and the birth after it was
// clean. That is the classic shape of something one more attempt absorbs, so the question is fair. The
// notebook's instruction was "reads and idempotent commands only — and if you cannot tell which commands are
// idempotent from here, say so". Both halves of that turned out to be wrong, in opposite directions.
//
// ⛔ FIRST, WHAT A 502 DOES NOT TELL YOU: whether the command RAN. The edge says *the upstream did not answer
// ME*. The request may have reached the kernel, executed, committed, and only the response been lost.
// Re-sending a write on that evidence is how one seed writes two rows.
//
// ★ SECOND — AND THIS IS THE FINDING — THE KERNEL ALREADY SOLVES THIS, GENERICALLY, AND THIS BOX DOES NOT USE
// IT. Measured in the product repository:
//
//     apps/api/src/adapter.ts:46            const idempotencyKey = c.req.header('idempotency-key');
//     packages/core/src/dispatcher.ts:349   replay = readIdempotent(tx, tenant.id, idempotencyKey) → return
//     packages/core/src/dispatcher.ts:465   insert into command_idempotency (…) — SAME transaction
//
// `idempotency-key` is a header of the WHOLE write face, not a feature of `checkout.place_order` (which is
// merely the one caller in this repo that sends it — `totem/src/lib/cart.ts:123`). A command carrying one is
// replayed rather than re-executed, and the bookkeeping commits with the handler. So "which commands are
// idempotent?" is the wrong question: the CALLER decides, per call.
//
// ⛔ THIRD, AND IT IS WHY THIS IS NOT SWITCHED ON HERE. Fifteen commands REJECT the header outright with
// `validation_failed` — every one that mints a secret, because a raw token must never land in
// `command_idempotency`. One of them is `extension.install`
// (`packages/core/src/commands/extension.ts:1171`), and THIS SEED CALLS IT (`bin/seed-box.mjs`, `apps`). A
// blanket header would therefore turn a green birth red on a step that has nothing to do with 502s — and the
// reject-list belongs to the kernel, so a copy of it living in the demo repository rots on the kernel's
// schedule, not on ours.
//
// ⛔ FOURTH: `command_idempotency` has NO TTL and NO purge (`tenant/0001_core.sql`, named in
// `apps/api/src/purchase.e2e.test.ts:478`). A key that is stable ACROSS births would make the second birth
// REPLAY the first one's results instead of writing — silently, with a 200. Any key this seed sends has to be
// unique per RUN and stable only within it.
//
// ⇒ SO THE POLICY BELOW IS WHAT IS SAFE WITH NO KERNEL COOPERATION AT ALL, and nothing more:
//
//   GET   — every read this seed makes. Repeating one cannot write anything. RETRIED, up to twice.
//   POST  — every command. NOT retried, and the message says WHY rather than staying silent about it.
//
// ⇒ AND THE WRITE HALF IS A DECISION, NOT AN OVERSIGHT: sending `idempotency-key: seed-<run>-<call>` on the
// commands that accept it would make a retry a replay. It is opt-in per call site, it must skip the fifteen,
// and it changes the behaviour of every write in a birth this slice cannot rehearse (the bench is not ours to
// run). It is written down here rather than smuggled in.
//
// ⇒ THE FALLBACK IS ALREADY EXCELLENT, WHICH IS WHY NONE OF THIS IS URGENT: this seed is idempotent BY
// CONSTRUCTION (`bin/seed.mjs` header — everything it creates is keyed by a handle it chooses, and it asks
// the read face first). The answer to a lost write is "run the seed again", which is safe. "Re-send the POST"
// is not.

/** The 5xx a proxy emits when it has no answer from upstream. 500 is excluded: that is the kernel failing. */
export const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** How many EXTRA attempts a retryable call gets. Two, because a third would be a policy about an outage. */
export const MAX_GATEWAY_RETRIES = 2;

/**
 * May this exact call be sent again? Reads only, gateway 5xx only, twice at most.
 *
 * `why` is returned alongside so the failure message can state the reason it did NOT retry — a silent
 * decision not to retry reads exactly like a retry that failed.
 */
export function mayRetry({ method = 'GET', status, attempt = 0, max = MAX_GATEWAY_RETRIES }) {
  if (!GATEWAY_STATUSES.has(status)) {
    return { retry: false, why: `HTTP ${status} is not a gateway refusal — the upstream did answer` };
  }
  if (String(method).toUpperCase() !== 'GET') {
    return {
      retry: false,
      why:
        `${String(method).toUpperCase()} is a WRITE and a ${status} does not say whether it ran — the edge ` +
        'only says the upstream did not answer IT. This call carries no `idempotency-key`, so a re-send ' +
        'would be a second write, not a replay. Re-running the whole seed IS safe (it is idempotent by ' +
        'construction); re-sending this one call is not.',
    };
  }
  if (attempt >= max) {
    return { retry: false, why: `already retried ${attempt}× — this is not a blip` };
  }
  return { retry: true, why: `read, ${status} from the gateway, attempt ${attempt + 1} of ${max}` };
}
