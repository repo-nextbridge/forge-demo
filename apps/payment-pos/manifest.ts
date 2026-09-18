// The counter's payment app (PAY-POS) — what this app IS, and the two ways a coffee is paid for at a till.
//
// ★ IT BELONGS TO THIS BOX AND TO NOBODY ELSE, and that is the first fact about it rather than a footnote.
// `forge.origin: "instance"` in package.json is the declaration; `instanceApps` in this repository's
// composition.json is where it is asked for; and the image that composes it comes out of the oven stamped
// `offerable: false`, which the platform's release gate refuses to promote. Every sentence below that would be
// reckless in an app we OFFER is safe here for that one structural reason — see the README.
//
// ★★ WHY THIS APP EXISTS INSTEAD OF A CONFIG CHANGE ON `payment-reference`. Two walls, both measured, both the
// reference app's own rather than the kernel's:
//   · its PIX behaviour is `pix_mode`, which is UNIVERSAL app config — one value for every store that has the
//     app installed. Turning it to `approve` so the totem could settle would ALSO settle the coffee store's
//     PIX, and that store's live "aguardando pagamento" is a thing this demo exists to show;
//   · its webhook needs a `provider_ref` that its own `initiate` never hands back (`pixPending()` returns
//     `copy_paste` and `expires_in` and nothing else), so no screen can ever call it.
// This app answers the second one in a single line — see `provider.ts`, where the ref rides inside the app's
// own `next_action`. That line is the whole difference, and it cost no kernel change at all.
//
// ── ⚠️ THE METHODS DECLARED HERE ARE `pix` AND `card`, AND THAT IS NOT A CLIMBDOWN ────────────────────────
//
// `paymentMethods` in /contracts is a CLOSED vocabulary (`pix | card | promissory | zero`) and this schema
// validates against it: a manifest declaring `pos_pix` does not load, it THROWS at `extensionManifestSchema
// .parse`. Measured before a line of this app ran. And the closed list is right — `method ⊥ provider` is the
// doctrine: the checkout speaks a method, and WHICH app serves it is resolved separately. A private method
// name would be this app teaching the kernel its vocabulary, which is the thing the split exists to prevent.
//
// So `pos_pix` and `pos_card` are THIS APP'S OWN names for its two behaviours, and they survive exactly where
// they belong to it: the `provider_ref` prefixes it mints, its `next_action` type (`pos_pix_qr`), and the
// prose. They are never spoken to the kernel.
//
// ★ HOW A SHOPPER GETS THIS APP RATHER THAN ANOTHER ONE SERVING `pix`: the front pins it on the cart —
// `cart.set_payment_method { method: 'pix', payment_app: 'payment-pos' }` — and `place_order` records the
// RESOLVED id on the order, which is what `payment.initiate` then charges. Without that pin the kernel takes
// the first installed app that serves the method, ordered by `installed_at`, which on this box is
// `payment-reference`. The totem always pins. This is written down in `CONTRATO-POS.md` for the totem's side.
//
// TWO BEHAVIOURS, TWO OPPOSITE SETTLEMENTS, and the manifest is where that stops being a surprise:
//   · `card` (this app's `pos_card`) settles at `initiate` — the machine already said yes before the kernel
//     was asked;
//   · `pix` (this app's `pos_pix`) does not settle at all until somebody scans, which at a demo counter is a
//     tap on the QR.
//
// TWO BLOCKS, TWO ROLES (PAY-APP-SHAPE). The totem draws its own screens and renders neither of them. They are
// here because a payment app without them is broken for every OTHER front, and because the composition may ask.

import { type ExtensionManifest, extensionManifestSchema } from '@forgeco/contracts';

const DESCRIPTION_EN =
  'The counter’s payment methods for a self-service totem: the card machine, approved on the spot because the machine has already taken the payment, and a PIX QR on the totem’s screen. No PSP is ever contacted: this app belongs to one box and is never offered. Enable each method per store via PAY-TOGGLES.';

// ★★ THE NAME IS A PLACE, AND THAT IS LOAD-BEARING. `read.payment_methods` hands this name to the checkout,
// which prints it on the provider chooser chip. Installing an app is TENANT-wide (one row per
// `extension_id + tenant_id`), so this app is offered in EVERY store of the tenant and there is no per-store
// gate to stop it — measured, and written up in README.md. A generic name ("Counter payments") would read as
// a legitimate option in the coffee store's checkout; a name that says WHERE reads as what it would be there,
// which is a misconfiguration. The name cannot fix the exposure, but it can stop it from lying.
export const manifest: ExtensionManifest = extensionManifestSchema.parse({
  id: 'payment-pos',
  name: 'Pay at the counter',
  kind: 'app',
  version: '0.1.0',
  // ⚠️ DECLARING THIS IS HALF THE ICON, AND THE OTHER HALF IS `"./icon"` IN package.json. A COMPOSED app's
  // icon is soldered from the package's EXPORTS (`packages/codegen/src/composition.ts:550`), which never
  // opens the manifest to notice a disagreement — so a path declared here with no module to back it 404s at
  // `/v1/extensions/payment-pos/icon` and the admin's Apps area silently falls back to the name initial.
  // That is exactly what happened to an earlier app of this box. `bin/composition.guard.mjs` now holds both halves together
  // and compares the BYTES, so redrawing `icon.png` without re-encoding `icon.ts` is red too.
  icon: 'icon.png',
  description: DESCRIPTION_EN,
  maturity: 'stable',
  i18n: {
    // ⚠️ THE `en` ENTRY OF EVERY OPERATOR-FACING FIELD IS THE LITERAL ABOVE, CHARACTER FOR CHARACTER, and
    // `manifest.test.ts` holds this app to it. In the monorepo that rule is enforced by
    // `scripts/i18n/manifest-copy.guard.test.ts` — which enumerates the monorepo's OWN `extensions/`
    // directory and therefore never sees an app that lives in a customer's repository. Measured, and the
    // reason the check is duplicated here instead of assumed: the literal is the source language AND the
    // fallback, so an `en` entry that disagrees with it makes the fallback a lie.
    en: {
      name: 'Pay at the counter',
      description: DESCRIPTION_EN,
      'block.payment-options.label': 'Pay at the counter · Payment options',
      'block.after-payment.label': 'Pay at the counter · After payment',
      'config.active.label': 'Accept payments at the counter',
      'config.pix_enabled.label': 'Enable the counter’s PIX QR',
      'config.card_enabled.label': 'Enable the card machine',
    },
    'pt-BR': {
      name: 'Pagar no balcão',
      description:
        'As formas de pagamento do balcão para um totem de autoatendimento: a maquininha, aprovada na hora porque a máquina já recebeu, e um QR de PIX na tela do totem. Nenhum PSP é chamado: este app pertence a uma caixa só e nunca é ofertado. Habilite cada método por loja via PAY-TOGGLES.',
      'block.payment-options.label': 'Pagar no balcão · Formas de pagamento',
      'block.after-payment.label': 'Pagar no balcão · Depois do pagamento',
      'config.active.label': 'Aceitar pagamento no balcão',
      'config.pix_enabled.label': 'Habilitar o QR de PIX do balcão',
      'config.card_enabled.label': 'Habilitar a maquininha',
    },
    es: {
      name: 'Pagar en el mostrador',
      description:
        'Las formas de pago del mostrador para un tótem de autoservicio: el datáfono, aprobado al instante porque la máquina ya cobró, y un QR de PIX en la pantalla del tótem. No se llama a ningún PSP: esta app pertenece a una sola caja y nunca se oferta. Habilita cada método por tienda vía PAY-TOGGLES.',
      'block.payment-options.label': 'Pagar en el mostrador · Formas de pago',
      'block.after-payment.label': 'Pagar en el mostrador · Después del pago',
      'config.active.label': 'Aceptar pago en el mostrador',
      'config.pix_enabled.label': 'Habilitar el QR de PIX del mostrador',
      'config.card_enabled.label': 'Habilitar el datáfono',
    },
  },
  // ZERO SCOPES, AND NO ACTION. This app drives no kernel command: `pos_card` settles through the adapter's
  // neutral `settled` convention, and `pos_pix` settles through the app's own `reconcile` — both of which are
  // the KERNEL calling the app, never the app calling the kernel. `payment-zero` carries a manual `settle`
  // action as an operator's escape hatch; a counter's escape hatch is the admin's own "mark as paid", so this
  // app asks for nothing and the smallest attack surface is the one that is not there.
  scopes: [],
  contact: {
    hooks: [
      { component: 'payment-options', target: 'storefront:checkout.payment' },
      { component: 'after-payment', target: 'storefront:checkout.confirmation' },
    ],
    blocks: [
      {
        component: 'payment-options',
        label: 'Pay at the counter · Payment options',
        surface: 'storefront',
        placement: 'single',
        area: 'checkout',
      },
      {
        component: 'after-payment',
        label: 'Pay at the counter · After payment',
        surface: 'storefront',
        placement: 'single',
        area: 'checkout',
      },
    ],
  },
  // PAY-TOGGLES — the neutral convention every payment app in this house uses: an `active` master plus one
  // `<method>_enabled` per method. Both methods on by default; a counter that only takes PIX turns one off.
  config: {
    fields: [
      { name: 'active', type: 'boolean', label: 'Accept payments at the counter', default: true },
      {
        name: 'pix_enabled',
        type: 'boolean',
        label: 'Enable the counter’s PIX QR',
        default: true,
      },
      {
        name: 'card_enabled',
        type: 'boolean',
        label: 'Enable the card machine',
        default: true,
      },
    ],
  },
  paymentProvider: {
    methods: ['pix', 'card'],
    // ★ MINUTES, NEVER DAYS — the opposite end of the promissory app's thirty, and for the mirrored reason.
    // This window is how long the kernel holds stock for an unsettled intent, and a counter's stock is what is
    // ON THE COUNTER right now: a pão de queijo reserved overnight is a pão de queijo nobody could sell.
    //   · card 600s — it settles inside the same request, so the hold only has to outlive that request.
    //     Ten minutes is already pure slack; it exists so a retry after a hiccup still finds its reservation.
    //   · pix  900s — a QR on a screen with a queue behind it. Fifteen minutes is longer than any customer
    //     stands there, which is the point: it must expire while the shop is still open.
    reservationWindowSeconds: { pix: 900, card: 600 },
    // ★ NO `applicableWhen`, DELIBERATELY. A counter charges whatever is on the tray, at any amount; declaring
    // bounds would invent an eligibility rule nobody asked for. `payment-zero` declares `{min:0,max:0}` because
    // "nothing to pay" IS its reason to exist — absence here is the same kind of statement, not an oversight.
  },
});

export default manifest;
