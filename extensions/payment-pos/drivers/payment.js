// ../../forge-demo/apps/payment-pos/simulation.ts
var POS_PIX_REF_PREFIX = "pospix_";
var POS_CARD_REF_PREFIX = "poscard_";
function unwrap(raw) {
  if (typeof raw === "object" && raw !== null && "body" in raw) {
    return raw.body;
  }
  return raw;
}
function isScanEvent(value) {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value;
  return typeof candidate.provider_ref === "string" && candidate.provider_ref.length > 0 && (candidate.event === "approved" || candidate.event === "rejected");
}
function decideScan(raw) {
  const payload = unwrap(raw);
  if (!isScanEvent(payload)) {
    return {
      ok: false,
      refusal: "malformed_payload",
      because: "the payload is not this app\u2019s scan event ({ provider_ref, event })"
    };
  }
  if (!payload.provider_ref.startsWith(POS_PIX_REF_PREFIX)) {
    return {
      ok: false,
      refusal: "not_this_apps_pix_charge",
      because: "the ref is not one of this app\u2019s open PIX charges"
    };
  }
  return { ok: true, event: payload };
}
function posPixRef(idempotencyKey) {
  return `${POS_PIX_REF_PREFIX}${idempotencyKey}`;
}
function posCardRef(idempotencyKey) {
  return `${POS_CARD_REF_PREFIX}${idempotencyKey}`;
}
function fakePixCode(providerRef) {
  const token = providerRef.replace(/[^a-z0-9]/gi, "").toUpperCase().padEnd(20, "0").slice(0, 20);
  const crc = token.slice(0, 4);
  return `00020126580014BR.GOV.BCB.PIX0136${token}FORGEBALCAO00QR5204000053039865802BR5912FORGE BALCAO6009SAO PAULO62070503***6304${crc}`;
}

// ../../forge-demo/apps/payment-pos/provider.ts
var PIX_EXPIRES_IN_SECONDS = 900;
function settled() {
  return { type: "settled", data: { status: "approved" } };
}
function pixPending(providerRef) {
  return {
    type: "pos_pix_qr",
    data: {
      copy_paste: fakePixCode(providerRef),
      provider_ref: providerRef,
      expires_in: PIX_EXPIRES_IN_SECONDS
    }
  };
}
var provider = {
  methods: ["pix", "card"],
  initiate(_ctx, req) {
    if (req.method === "pix") {
      const providerRef = posPixRef(req.idempotency_key);
      return Promise.resolve({ provider_ref: providerRef, next_action: pixPending(providerRef) });
    }
    return Promise.resolve({
      provider_ref: posCardRef(req.idempotency_key),
      next_action: settled()
    });
  },
  // ⚠️ `async`, AND THAT IS LOAD-BEARING RATHER THAN STYLE. This function is declared to return a promise, so
  // a caller awaits it; a SYNCHRONOUS throw from it escapes before the promise exists and lands outside the
  // `await`, which is a different control path from the rejection every caller is written for. Caught by this
  // app's own refusal tests, which passed the refusal and failed the shape.
  async reconcile(_ctx, req) {
    const decision = decideScan(req.raw);
    if (!decision.ok) {
      throw new Error(`payment-pos refused a scan (${decision.refusal}): ${decision.because}`);
    }
    return {
      provider_ref: decision.event.provider_ref,
      status: decision.event.event
    };
  }
};
export {
  provider as default
};
