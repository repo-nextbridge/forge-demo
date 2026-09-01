# @forge/ext-payment-pos

The **counter's** payment app: the card machine and the totem's PIX QR. It belongs to this box, it is never
offered to anybody, and two of the sentences below would be reckless in an app that was.

## The two methods

| the counter says | the kernel's method | what `initiate` does |
|---|---|---|
| "pague na maquininha" | `card` | **settles immediately** |
| "aponte a câmera no QR" | `pix` | returns the QR **and the ref**, and waits |

### `card` — the machine already said yes

`initiate` returns the neutral synchronous envelope (`next_action: { type: 'settled', data: { status } }`)
and the kernel reconciles it in the same request. **The spec's "approves in about 2 seconds" is an animation
on the totem's screen.** There is no state in the kernel between started and paid: no pending envelope, no
job, no poll, no timer. By the time this app runs, the physical machine has taken the payment and the
customer has put their card away; the kernel is being told, not asked.

A pending card would have invented a state nobody observes, and it would have needed a second public door to
close it.

### `pix` — and the one line this whole app exists for

`initiate` does not settle. It returns:

```json
{ "type": "pos_pix_qr",
  "data": { "copy_paste": "000201…", "provider_ref": "pospix_<attempt id>", "expires_in": 900 } }
```

**`provider_ref` is the difference.** The kernel hands a non-settled `next_action` back to the caller
verbatim, so a field this app puts in `data` is a field the screen reads — and the ref is exactly what the
webhook face needs to settle that charge later. `payment-reference`'s PIX envelope carries `copy_paste` and
`expires_in` and no ref, which is precisely why no screen can ever settle one of its PIX charges. That
measured gap is why this app was written instead of the reference app being reconfigured. The other reason:
the reference app's PIX mode is **universal** config, so making it auto-approve for the counter would also
settle the coffee store's PIX, and that store's live "aguardando pagamento" is a thing the demo exists to
show.

`copy_paste` is **decorative**: BR-Code-shaped, deterministic from the ref, and not scannable. Nobody pays a
simulator, and no screen may present it as though somebody could.

## ⚠️⚠️ THIS APP OPENS A PUBLIC, UNAUTHENTICATED DOOR THAT APPROVES A PAYMENT

The totem's "tap the QR to simulate the scan" is this:

```bash
curl -X POST http://<edge>/webhooks/payment/<store id>/payment-pos \
     -H 'content-type: application/json' \
     -d '{"provider_ref":"pospix_<attempt id>","event":"approved"}'
```

No auth. No signature. It settles a real order.

**It is acceptable HERE and nowhere else, for one structural reason: this app is never offered to anybody.**
`forge.origin: "instance"` declares it; `instanceApps` in `composition.json` is where this box asks for it;
and the image that composes it comes out of the oven stamped `offerable: false`, which the platform's release
gate refuses to promote. In an app we ship, this door would be a vulnerability. **Do not copy this pattern
into one.**

### What actually holds the door shut — three things, and two of them are the kernel's

1. **The ref is opaque and unpredictable, and that is a PREMISE, not an accident.** It is derived from the
   attempt id, which the kernel generates, and it leaves the kernel in exactly ONE place: inside the
   `next_action` returned by that attempt's own `initiate`. Guessing it is guessing an id. Every other
   protection below assumes this one; if a ref ever starts appearing in a log, a URL or a page's HTML, the
   door is open and this list is worthless.
2. **The kernel refuses a ref that names no attempt** — `payment.reconcile` throws `validation_failed:
   intent not found`.
3. **The kernel refuses a second settlement** — `update payment_intent … where status = 'pending'`, so the
   second caller changes no row: no second `order.paid`, no second stock commit.

**(2) and (3) are named here because they are NOT in this app.** `reconcile` runs isolated, with `{ raw }`
and no database: it cannot know that a ref exists or that it has already settled. Do not go looking in this
package for those guards, and **do not add an app-side copy of them** — a record written outside the kernel's
transaction can diverge from it, and the day it does it blocks a legitimate retry forever. That is a weaker
copy of a guarantee the core already makes atomically.

What this app *does* refuse, and what its tests and sabotages cover: a payload that is not its scan event,
and any ref that is not one of **its own open PIX charges** (a `poscard_` ref included — a machine charge
settled at `initiate` and has no scan to simulate).

## ⚠️ INSTALLING THIS APP OFFERS IT IN **EVERY STORE OF THE TENANT**

There is no way to install a payment app in one store, and no way to hide it in one.

**Why, in one line:** installation is per tenant by construction — `extension_installation` carries a unique
index on `(extension_id, tenant_id)` (`system/0008`). What is per store is block *placement*
(`hook_placement`), and a payment provider is never placed to be offered: it is resolved straight from the
installation (`packages/core/src/payment/resolve.ts` joins `extension_installation` to `store_directory` on
the tenant alone, with no store filter).

So, measured on this box:

* `read.payment_methods` lists this app as a provider for **every** store of the tenant;
* the vanilla checkout's provider chooser (`orderedPaymentCandidates`) filters only by method — no store
  gate, no placement gate;
* the only lever that removes it, `active: false`, is the app's own config, which is **also tenant-wide**, so
  turning it off for the coffee store turns off the counter too;
* `applicableWhen` has only `minAmount`/`maxAmount`, so there is no declaration that could scope it either.

**And with no other payment provider installed, this app does not add a chip to a list — it becomes the
tenant's ONLY provider for `pix` and `card`, with no chooser shown at all, and its `card` settles instantly
and free.** That is why the app is named for a *place* ("Pagar no balcão"): the name cannot fix the exposure,
but it makes an appearance outside the counter read as a misconfiguration rather than as an offer.

This is a known property of this box, not a defect of this app, and no slice of this wave can fix it — a
per-store offer gate would be a kernel change. It is carded as product work.

## How a front picks this app

`pos_pix` and `pos_card` are **this app's own names**, and they are never spoken to the kernel:
`paymentMethods` in `/contracts` is a closed vocabulary (`pix | card | promissory | zero`) and the manifest
schema validates against it — a manifest declaring `pos_pix` **throws at parse and the app does not load**.
They survive as the `provider_ref` prefixes (`pospix_`, `poscard_`), the `pos_pix_qr` envelope type, and the
prose.

So the front asks for the neutral method and **pins the app**:

```
cart.set_payment_method { cart_id, method: 'pix', payment_app: 'payment-pos' }
```

`place_order` freezes the resolved id on the order, and `payment.initiate` charges that app. Without the pin
the kernel takes the first installed app serving the method, ordered by `installed_at`.

`CONTRATO-POS.md` (in the wave's briefs) is the totem's side of this, including the two answers that are easy
to get wrong: a settled envelope reaches the front with **empty `data`** (the adapter cleans it), and the
webhook answers **HTTP 200 with an error in the body** when the kernel refuses — so `res.ok` does not mean
paid.

## Config (PAY-TOGGLES)

`active` (master) · `pix_enabled` · `card_enabled`. The neutral convention every payment app here uses;
absence means enabled. Reservation windows: `pix` 900s, `card` 600s — minutes, never days, because a
counter's stock is what is on the counter.

## Checks

This app cannot be typechecked or tested from this repository: its `tsconfig.json` extends
`../../tsconfig.base.json`, and that path only resolves once the app is staged inside a Forge checkout
(`.instance-apps/<id>/../../` is the monorepo root). Stage it there and run `tsc --noEmit`, `vitest run` and
`biome check` from the monorepo, exactly as the oven stages it.

⚠️ `biome` **ignores** `.instance-apps/`, so linting from that path reports "0 files" and looks green. Lint
from a path biome actually scans.
