// The sentence a failed call prints, graded against the ONE it printed on 2026-09-05 04:01.
//
//     [seed] catalog.collection.pin → HTTP 502
//     <blank>
//
// Every test below names a thing that line did not carry and that the reader needed. The fixture is the real
// shape of a Caddy 502, measured 2026-09-05 against a proxy with a dead upstream: `Server: Caddy`,
// `Content-Length: 0`, no body, and no correlation header of any kind.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GATEWAY_STATUSES,
  answeredByEdge,
  correlationOf,
  headerMap,
  httpFailure,
  mayRetry,
} from './failure.mjs';

/** The measured 502. Two headers and nothing else — this is not a simplification, it is the whole response. */
const CADDY_502 = { server: 'Caddy', date: 'Sun, 06 Sep 2026 00:43:03 GMT', 'content-length': '0' };

const theBirth = (over = {}) =>
  httpFailure({
    name: 'catalog.collection.pin',
    method: 'POST',
    url: 'http://localhost:8200/v1/commands/catalog.collection.pin',
    status: 502,
    statusText: 'Bad Gateway',
    headers: CADDY_502,
    bodyText: '',
    elapsedMs: 62,
    call: 312,
    at: new Date('2026-09-05T07:01:52.000Z'),
    pace: 'pace — 312 call(s) through 3 face(s)',
    ...over,
  });

describe('what the 04:01 line did not say', () => {
  it('still names the command — that half was never missing', () => {
    assert.match(theBirth(), /^catalog\.collection\.pin → HTTP 502 Bad Gateway/);
  });

  it('★ names the DOOR: the method and the URL, so the face is read rather than inferred', () => {
    assert.match(theBirth(), /POST http:\/\/localhost:8200\/v1\/commands\/catalog\.collection\.pin/);
  });

  it('★ says WHERE IN THE SEQUENCE it died — the fact that was reconstructed from a scrollback', () => {
    assert.match(theBirth(), /call #312 of this run/);
    assert.match(theBirth(), /pace — 312 call\(s\)/);
  });

  it('★ says HOW LONG the call took — 30 s of nothing and 60 ms of nothing are different diagnoses', () => {
    assert.match(theBirth(), /62 ms/);
  });

  it('★ carries an ISO instant, because the clock is the ONLY correlation this door offers', () => {
    assert.match(theBirth(), /2026-09-05T07:01:52\.000Z/);
  });

  it('★★ STATES THE SILENCE. An empty body and "this tool prints no bodies" look identical', () => {
    const out = theBirth();
    assert.match(out, /THE RESPONSE CARRIED NO BODY \(0 bytes\)/);
    assert.match(out, /this is a silence, not a refusal/);
  });

  it('★★ names WHO answered — a proxy 5xx is the edge, and it points at the kernel log', () => {
    const out = theBirth();
    assert.match(out, /THE EDGE ANSWERED, NOT THE KERNEL \(Caddy\)/);
    assert.match(out, /capture-evidence\.mjs/);
    assert.match(out, /postmortem/);
  });

  it('says out loud that no request id exists, and lists the headers that DO', () => {
    const out = theBirth();
    assert.match(out, /NO REQUEST ID/);
    assert.match(out, /content-length, date, server/);
    // ⚠️ The absence is a measurement, not an omission: this bench's kernel sends none on any face.
    assert.doesNotMatch(out, /x-request-id: /);
  });
});

describe('when the door DOES speak', () => {
  it('prints the body and its size, and does not cry silence', () => {
    const out = theBirth({ status: 409, statusText: 'Conflict', bodyText: '{"code":"conflict"}' });
    assert.match(out, /body \(19 bytes\): \{"code":"conflict"\}/);
    assert.doesNotMatch(out, /CARRIED NO BODY/);
  });

  it('★ a kernel refusal RELAYED by the proxy is not blamed on the edge', () => {
    // The 500 came through Caddy, but the body is one of the kernel's own refusals — so the answer is in
    // the seed's input, not in the container's log, and sending the reader to `docker logs` would be wrong.
    const out = theBirth({ status: 500, bodyText: '{"error":{"kind":"internal","message":"boom"}}' });
    assert.doesNotMatch(out, /THE EDGE ANSWERED/);
  });

  it('a 4xx is never the edge, whatever proxy relayed it', () => {
    assert.equal(answeredByEdge({ status: 404, headers: CADDY_502, bodyText: '' }), false);
  });

  it('a correlation header, if a door ever sends one, is printed by NAME', () => {
    const out = theBirth({ headers: { ...CADDY_502, 'x-request-id': 'req_01ABC' } });
    assert.match(out, /x-request-id: req_01ABC/);
    assert.doesNotMatch(out, /NO REQUEST ID/);
  });

  it('reads `Headers` and plain objects alike — a seed must not care which it holds', () => {
    const h = new Headers({ 'X-Request-Id': 'req_9' });
    assert.deepEqual(correlationOf(h), { key: 'x-request-id', value: 'req_9' });
    assert.equal(headerMap({ 'Content-Length': '0' }).get('content-length'), '0');
  });
});

describe('★★ whether to send it again — the measured policy', () => {
  it('a read hit by a gateway 5xx IS retried', () => {
    assert.equal(mayRetry({ method: 'GET', status: 502, attempt: 0 }).retry, true);
    assert.equal(mayRetry({ method: 'GET', status: 503, attempt: 1 }).retry, true);
  });

  it('⛔ a WRITE is never retried, and the reason names what a 502 does not prove', () => {
    const verdict = mayRetry({ method: 'POST', status: 502, attempt: 0 });
    assert.equal(verdict.retry, false);
    assert.match(verdict.why, /does not say whether it ran/);
    assert.match(verdict.why, /idempotency-key/);
  });

  it('a 500 is the KERNEL failing, not a gateway blip — not retried even for a read', () => {
    assert.equal(mayRetry({ method: 'GET', status: 500 }).retry, false);
    assert.ok(!GATEWAY_STATUSES.has(500));
  });

  it('two extra attempts and no more — a third would be a policy about an outage', () => {
    assert.equal(mayRetry({ method: 'GET', status: 502, attempt: 2 }).retry, false);
    assert.match(mayRetry({ method: 'GET', status: 502, attempt: 2 }).why, /already retried 2/);
  });

  it('★ the decision NOT to retry is printed — silence reads like a retry that also failed', () => {
    const out = theBirth({ retryVerdict: mayRetry({ method: 'POST', status: 502 }) });
    assert.match(out, /not retried — POST is a WRITE/);
  });

  it('…and NOT printed where the question was never live — a 409 was answered by the upstream', () => {
    const out = theBirth({ status: 409, bodyText: '{"code":"conflict"}', retryVerdict: mayRetry({ method: 'POST', status: 409 }) });
    assert.doesNotMatch(out, /not retried/);
  });

  it('and a retry that was spent is counted on the line', () => {
    assert.match(theBirth({ method: 'GET', retried: 2 }), /2 retries already spent/);
    assert.match(theBirth({ method: 'GET', retried: 1 }), /1 retry already spent/);
  });
});
