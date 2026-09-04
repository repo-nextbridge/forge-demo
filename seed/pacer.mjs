// THE PACER — one step per FACE, because the kernel's buckets are per face and never one.
//
// ★★ WHY THIS FILE EXISTS, AND THE COMMENT IT REPLACES WAS TRUE.
//
// The version this replaces lived inline in `bin/seed.mjs` as ONE token bucket over every call, and it
// carried this justification:
//
//     ⚠️ IT COVERS READS TOO, and that is not caution. The limiter is ONE bucket over the command face AND
//     the internal read face […]. A pacer that counted only writes would be a pacer that is wrong by
//     exactly the number of reads.
//
// Every word of that is correct — about the CREDENTIAL bucket. It is also the sentence that cost the box an
// hour, because it reads as "there is one bucket" and there are three, and the tightest of them is not the
// one it describes. Measured on the box of 2026-09-03 (`apps/api/src/index.ts` of the release it runs):
//
//   | face       | path shape                               | subject      | ceiling   | kernel knob |
//   |------------|------------------------------------------|--------------|-----------|-------------|
//   | credential | /v1/commands, /v1/read/internal, /v1/ext | credential   | 6000/60 s | FORGE_RATE_LIMIT_PER_CREDENTIAL |
//   | anonymous  | /v1/read/<cap>, /v1/{cart,checkout,…}    | store + IP   |  400/60 s | none (ANONYMOUS_FACE_CAP) |
//   | ext_public | /v1/ext-public/<app>/<model>             | IP           |   30/60 s | none at that release |
//
// ⇒ 100/s, 6,6/s and 0,5/s. One knob for the three of them means the run pays the SMALLEST of the three on
// every call it makes, and the smallest belongs to the face this seed touches 52 times out of ~1900.
//
// ★ THE COST, MEASURED — two full births of the same box on the night of 2026-09-03:
//     · 85/s (the default) → ~11 min, and death by 429 on the FIRST anonymous form post;
//     · 0,5/s (the only global pace that fits the form's bucket) → ~74 min, and it completed.
//   The difference is 63 min. At 2 s a call that is ~1890 calls waiting for a bucket that never applied to
//   them: 52 of them were the form; the other ~1840 were commands and credentialed reads, which had 100/s
//   available and used 0,5/s.
//
// ⛔ AN UNKNOWN PATH IS NOT A FAST PATH. `faceOf` answers `undefined` for a shape it does not know and the
// caller must die on it, rather than defaulting to the credential lane. This repo has paid three times in
// one night for `undefined` read as a VALUE instead of as "this question does not exist" — and here the
// generous default is exactly the failure the file exists to prevent: a new tight face, added later, would
// silently ride the 100/s lane and the box would die at 22:00 on a run nobody changed.

/**
 * ★ THE FACES, IN MATCH ORDER, and the order is load-bearing: `/v1/read/internal/…` is a credentialed read
 * and `/v1/read/<capability>` is an anonymous one, so the deeper pattern has to be asked first.
 *
 * ⚠️ THE PUBLIC READ IS MATCHED BY **ONE SEGMENT**, AND THAT IS NOT TIDINESS — it is the kernel's own
 * construction, copied deliberately. `ANONYMOUS_PUBLIC_READ_ROUTE` is `/v1/read/:capability` because a
 * capability name never contains a slash, and the two read faces that are NOT public live one segment
 * deeper: `/v1/read/internal/<name>` (per credential) and `/v1/read/customer/<cap>` (a shopper session).
 * `/v1/read/bulk/<name>` is deeper too and has a bucket of its OWN. A `/v1/read/` prefix would swallow all
 * three and pace them at a ceiling that is not theirs — measured here, in the first red of this slice.
 */
export const FACE_PATTERNS = [
  // ── the CREDENTIAL bucket: FORGE_RATE_LIMIT_PER_CREDENTIAL, 6000/60 s by default ─────────────────────────
  [/^\/v1\/read\/internal\//, 'credential'],
  [/^\/v1\/commands\//, 'credential'],
  [/^\/v1\/internal\//, 'credential'],
  [/^\/v1\/ext\//, 'credential'],
  // ⚠️ MEASURED UNCAPPED, AND IT RIDES THE CREDENTIAL LANE ANYWAY. `/v1/media/commands/*` is NOT in the
  // per-credential mount list (`/v1/commands/*`, `/v1/read/internal/*`, `/v1/internal/*`, `/v1/ext/*`,
  // `/mcp`) — checked in the release this box runs. Nothing caps it, so nothing here needs a fourth lane:
  // there is no reason for this seed to be FASTER than the fastest face that is capped, and pretending a
  // path is uncapped forever is how a lane rots.
  [/^\/v1\/media\/commands\//, 'credential'],
  // ── the KERNEL's anonymous boundary: ONE face-wide ceiling per store+IP, 400/60 s, no knob ───────────────
  [/^\/v1\/(cart|checkout|customer|operator|payment)\/commands\//, 'anonymous'],
  [/^\/v1\/read\/[^/?#]+([?#]|$)/, 'anonymous'],
  // ── an APP's anonymous create face: 30/60 s per IP, and it is the one that killed the 85/s birth ────────
  [/^\/v1\/ext-public\//, 'ext_public'],
  [/^\/v1\/ext-customer\//, 'ext_public'],
];

/**
 * ★ THE BUCKET EACH FACE ANSWERS TO, as data, so the refusal can name the RIGHT one.
 *
 * The 429 message used to name `FORGE_RATE_LIMIT_PER_CREDENTIAL` whatever face refused, which is how an
 * operator reads a correct sentence, turns the knob it names, and dies again in the same place: the birth
 * of 2026-09-03 was refused by `ratelimit:ext-public-write`, a bucket that had no knob at all in that
 * release. A refusal that names a button that does not move the thing is worse than a refusal with no
 * advice.
 *
 * `retryAfterSeconds` is what to wait when the refusal carries no `Retry-After`, and it differs per face
 * because the faces differ: the credentialed and face-wide limiters publish `RateLimit-*` + `Retry-After`
 * (`credential-rate-limit.ts`, `anonymous-face-cap.ts`), while the app form's per-IP cap answers a bare
 * `{"error":{"kind":"rate_limited"}}` with no headers — so the only honest wait there is the window.
 */
export const FACES = {
  credential: {
    label: 'the credential bucket (commands + the internal read face)',
    bucket: 'FORGE_RATE_LIMIT_PER_CREDENTIAL / FORGE_RATE_LIMIT_WINDOW_SECONDS',
    knob: 'FORGE_SEED_RATE_PER_SECOND',
    /** 6000/60 s by default in the kernel; the seed paces below it. */
    defaultRate: 85,
    retryAfterSeconds: 2,
  },
  anonymous: {
    label: "the kernel's face-wide anonymous ceiling (public reads + the public command faces)",
    bucket: 'ANONYMOUS_FACE_CAP — 400 per 60 s per store+IP, no env at this release',
    knob: 'FORGE_SEED_RATE_PER_SECOND_ANONYMOUS',
    /** 400/60 s is 6,66/s; 6 leaves the margin a fixed window needs at its edge. */
    defaultRate: 6,
    retryAfterSeconds: 2,
  },
  ext_public: {
    label: "an app's anonymous create face (/v1/ext-public — the PDP review form)",
    bucket: "ratelimit:ext-public-write — 30 per 60 s per IP; check this release's env for a knob",
    knob: 'FORGE_SEED_RATE_PER_SECOND_EXT_PUBLIC',
    /** 30/60 s is exactly 0,5/s. The 429 net below is what covers the edge of the fixed window. */
    defaultRate: 0.5,
    /** ⚠️ This face publishes NO `Retry-After`, so a refusal here means waiting out the whole window. */
    retryAfterSeconds: 60,
  },
};

/**
 * Which face a URL belongs to, or `undefined` when this file has never heard of it.
 *
 * Takes the full URL or a bare path; anything before `/v1` is ignored, so the caller does not have to
 * remember whether it built an absolute address.
 */
export function faceOf(url) {
  const path = String(url).replace(/^[a-z]+:\/\/[^/]+/i, '');
  for (const [pattern, face] of FACE_PATTERNS) if (pattern.test(path)) return face;
  return undefined;
}

/**
 * The pace of each face, read from the environment, with the kernel's own ceilings as the defaults.
 *
 * ⚠️ NOTHING HERE ASSUMES A CEILING IS FIXED. The tight one is being given a knob in the kernel by a
 * sibling slice; when a box raises it, `FORGE_SEED_RATE_PER_SECOND_EXT_PUBLIC` is how this seed is told.
 * The two are independent on purpose: this pacer has to be right with the ceiling raised and with it left
 * alone, so it reads a number and never derives one.
 */
export function ratesFromEnv(env = process.env) {
  const rates = {};
  for (const [face, spec] of Object.entries(FACES)) {
    const raw = env[spec.knob];
    const value = raw === undefined || raw === '' ? spec.defaultRate : Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `${spec.knob}="${raw}" is not a positive number of requests per second. It paces ${spec.label}.`,
      );
    }
    rates[face] = value;
  }
  return rates;
}

/**
 * ★★ THE HABIT THIS KNOB IS ABOUT TO TEACH, SAID OUT LOUD BEFORE IT COSTS AN HOUR AGAIN.
 *
 * `FORGE_SEED_RATE_PER_SECOND` used to pace EVERY face, so the way past the 429 of 2026-09-03 was to export
 * it at 0,5 — and that is what the 74-minute birth was. It now paces the CREDENTIAL face alone, where 0,5/s
 * buys nothing and costs everything: the next operator to reach for the same fix out of memory would restore
 * the whole defect with the whole cure removed, and the run would look exactly as it should.
 *
 * ⚠️ IT WARNS, IT DOES NOT REFUSE. A box may genuinely want a slow credential lane (a small Postgres, a
 * shared bench), and a seed that refuses a legal number is a seed somebody edits out. Returns the sentences;
 * the caller decides how to say them.
 */
export function pacingWarnings(rates, env = process.env) {
  const out = [];
  if (env[FACES.credential.knob] && rates.credential <= FACES.ext_public.defaultRate * 4) {
    out.push(
      `${FACES.credential.knob}=${rates.credential}/s paces ONLY ${FACES.credential.label}, whose ceiling ` +
        `is ${FACES.credential.bucket}.\n` +
        '  ⚠️ If it was set to get past a 429 on the anonymous form, it is the wrong knob and it is the ' +
        'reason a birth\n' +
        `  takes over an hour: that face is ${FACES.ext_public.knob}, and it already defaults to ` +
        `${FACES.ext_public.defaultRate}/s. Unset this one.`,
    );
  }
  return out;
}

/**
 * ★ ONE TOKEN BUCKET PER FACE, and they do not share tokens — which is the whole slice.
 *
 * ⚠️ THE BUCKET HOLDS AT LEAST ONE TOKEN, AND WITHOUT THIS THE SUB-1/s LANE HANGS FOREVER. The ceiling used
 * to be the rate itself, so a rate under one meant `tokens` could never reach the `>= 1` the pump waits
 * for: the queue filled, the timer re-armed, and nothing was ever sent. Measured on the bench of
 * 2026-09-03 — and it matters more now than it did then, because the `ext_public` lane is 0,5/s BY DEFAULT
 * rather than only when somebody sets the knob.
 *
 * It also COUNTS, per face, and that is not decoration: the run that pays 74 minutes cannot say where the
 * minutes went, and "how many calls went through the tight face" was the question nobody could answer
 * without reading the source. `summary()` prints it at the end of every birth.
 */
export function createPacer(rates) {
  const lanes = new Map();
  const startedAt = Date.now();
  for (const [face, rate] of Object.entries(rates)) {
    lanes.set(face, {
      rate,
      // The ceiling is the rate or one token, whichever is larger — see above.
      ceiling: Math.max(rate, 1),
      tokens: Math.max(rate, 1),
      last: Date.now(),
      queue: [],
      calls: 0,
      // Wall time this lane spent WAITING for its own bucket. The number the report wants.
      waitedMs: 0,
      timer: null,
    });
  }

  const pump = (lane) => {
    const now = Date.now();
    lane.tokens = Math.min(lane.ceiling, lane.tokens + ((now - lane.last) / 1000) * lane.rate);
    lane.last = now;
    while (lane.queue.length > 0 && lane.tokens >= 1) {
      lane.tokens -= 1;
      const waiter = lane.queue.shift();
      lane.waitedMs += now - waiter.queuedAt;
      waiter.resolve();
    }
    if (lane.queue.length > 0 && lane.timer === null) {
      lane.timer = setTimeout(() => {
        lane.timer = null;
        pump(lane);
      }, Math.ceil(1000 / lane.rate));
    }
  };

  return {
    /** Wait for this face's turn. Unknown faces are the caller's to refuse — see `faceOf`. */
    take(face) {
      const lane = lanes.get(face);
      if (!lane) {
        throw new Error(`pacer: no lane for face "${face}". Lanes: ${[...lanes.keys()].join(', ')}.`);
      }
      lane.calls += 1;
      return new Promise((resolve) => {
        lane.queue.push({ resolve, queuedAt: Date.now() });
        pump(lane);
      });
    },
    /** What each lane did, for the report and for the tests. */
    tally() {
      const out = {};
      for (const [face, lane] of lanes)
        out[face] = { calls: lane.calls, rate: lane.rate, waitedMs: Math.round(lane.waitedMs) };
      return out;
    },
    /**
     * ★ THE LINE THE README PROMISES — how many calls each face took and what the pacing cost.
     *
     * It reports what was DONE (the counter each lane increments as it hands out a token), never what was
     * planned: three of the seven failures of the 2026-09-03 birth were a screen stating what the program
     * had not done, and a summary derived from intent would be the fourth.
     */
    summary() {
      const elapsed = (Date.now() - startedAt) / 1000;
      const lines = [];
      let total = 0;
      let waited = 0;
      for (const [face, lane] of lanes) {
        total += lane.calls;
        waited += lane.waitedMs;
        lines.push(
          `    ${face.padEnd(11)} ${String(lane.calls).padStart(5)} call(s) at ${lane.rate}/s — ` +
            `${(lane.waitedMs / 1000).toFixed(1)}s waiting on its own bucket`,
        );
      }
      return (
        `pace — ${total} call(s) through ${lanes.size} face(s) in ${elapsed.toFixed(1)}s, ` +
        `${(waited / 1000).toFixed(1)}s of it pacing:\n${lines.join('\n')}`
      );
    },
  };
}
