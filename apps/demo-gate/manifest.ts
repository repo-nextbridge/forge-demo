// The demo-gate manifest (DEMO-GATE) — what this app IS and the powers it asks for. Validated against the
// contract shape (@forgeco/contracts). Deterministic app: no AI, no privileged write, no data of its own, and
// `scopes: []` — it drives NO kernel command. It only FILLS the neutral theme slot `storefront:gate` with a
// full-screen interstitial — ONE screen that both maps every face this box publishes and shows, in the same
// drawing, that they sit on a single kernel — plus the ribbon that stays under the store once the visitor is
// through. ⛔ v2 retired the second screen: it explained in prose what the first one was already
// demonstrating, and a visitor who has to switch views to be told what they are looking at has been told the
// architecture is elsewhere. The diagram IS the explanation now.
// Installing it (consenting to the `storefront:gate` target) turns the gate ON; uninstalling it turns the
// store byte-identical to no-gate.
//
// The MANIFEST-DEFAULT hook targets `storefront:gate` directly (no Compose placement needed — the gate is a
// single, fixed, full-screen slot, unlike a banner the operator arranges). The `single` block declaration is
// there so the block is a first-class citizen of the Compose model, but the gate needs no per-instance config:
// the marketing-site link, the admin origin PER TENANT and the access key those `/enter` routes redeem are
// INSTANCE wiring (env + the admin `/enter` route), never in the browser — the same class as the media base
// URL. The screen COPY is embedded (PT/EN/ES), not config, and the hub's ADDRESSES are the box's own
// declaration (`seed/box.json` → `faces.generated.ts`), not this app's.

import { type ExtensionManifest, extensionManifestSchema } from '@forgeco/contracts';

export const manifest: ExtensionManifest = extensionManifestSchema.parse({
  id: 'demo-gate',
  name: 'Demo gate',
  kind: 'app',
  version: '0.1.0',
  icon: 'icon.png',
  description:
    "The public demo's front door. It covers every storefront route with one full-screen diagram of the box: every shop this box publishes drawn as a card, gathered under the tenant that owns it, each tenant's admin beside it \u2014 opening already signed in \u2014 and all of them tied to the single kernel underneath. A ribbon keeps saying the store is a demo while the visitor browses. The addresses are the box's own declaration, never this app's; the copy is embedded in PT/EN/ES. Install to turn the gate on; uninstall and the store is byte-identical. The gate is a neutral theme slot; this app is its first consumer.",
  maturity: 'stable',
  i18n: {
    en: {
      name: 'Demo gate',
      description:
        "The public demo's front door. It covers every storefront route with one full-screen diagram of the box: every shop this box publishes drawn as a card, gathered under the tenant that owns it, each tenant's admin beside it \u2014 opening already signed in \u2014 and all of them tied to the single kernel underneath. A ribbon keeps saying the store is a demo while the visitor browses. The addresses are the box's own declaration, never this app's; the copy is embedded in PT/EN/ES. Install to turn the gate on; uninstall and the store is byte-identical. The gate is a neutral theme slot; this app is its first consumer.",
      'block.gate.label': 'Demo gate',
    },
    'pt-BR': {
      name: 'Portaria da demo',
      description:
        "A porta de entrada da demo pública. Ela cobre todas as rotas da vitrine com um único diagrama de tela cheia da caixa: cada loja que esta caixa publica desenhada como um cartão, reunida sob o tenant que é dono dela, o admin de cada tenant ao lado — abrindo já autenticado — e todos ligados ao mesmo kernel embaixo. Uma tarja segue avisando que a loja é uma demonstração enquanto o visitante navega. Os endereços são a declaração da própria caixa, nunca deste app; os textos são embutidos em pt/en/es. Instale para ligar a portaria; desinstale e a loja fica idêntica byte a byte. A portaria é um slot neutro do tema; este app é o primeiro consumidor dele.",
      'block.gate.label': 'Portaria da demo',
    },
    es: {
      name: 'Puerta de la demo',
      description:
        "La puerta de entrada de la demo pública. Cubre todas las rutas de la tienda con un único diagrama a pantalla completa de la caja: cada tienda que esta caja publica dibujada como una tarjeta, reunida bajo el tenant que la posee, el admin de cada tenant al lado — que abre ya autenticado — y todos unidos al mismo kernel debajo. Una franja sigue avisando de que la tienda es una demostración mientras el visitante navega. Las direcciones son la declaración de la propia caja, nunca de esta app; los textos van embebidos en pt/en/es. Instálala para encender la puerta; desinstálala y la tienda queda idéntica byte a byte. La puerta es un slot neutro del tema; esta app es su primer consumidor.",
      'block.gate.label': 'Puerta de la demo',
    },
  },
  scopes: [],
  contact: {
    // The gate renders through the manifest-default hook: install → the `storefront:gate` target is filled.
    hooks: [{ component: 'gate', target: 'storefront:gate' }],
    blocks: [
      {
        component: 'gate',
        label: 'Demo gate',
        surface: 'storefront',
        placement: 'single',
        config_schema: [],
      },
    ],
  },
});

export default manifest;
