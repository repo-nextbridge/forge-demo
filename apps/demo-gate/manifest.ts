// The demo-gate manifest (DEMO-GATE) — what this app IS and the powers it asks for. Validated against the
// contract shape (@forgecommerce/contracts). Deterministic app: no AI, no privileged write, no data of its own, and
// `scopes: []` — it drives NO kernel command. It only FILLS the neutral theme slot `storefront:gate` with a
// full-screen interstitial of two views — a HUB over every face this box publishes, and a second one that
// explains the demo's architecture — plus the ribbon that stays under the store once the visitor is through.
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

import { type ExtensionManifest, extensionManifestSchema } from '@forgecommerce/contracts';

export const manifest: ExtensionManifest = extensionManifestSchema.parse({
  id: 'demo-gate',
  name: 'Demo gate',
  kind: 'app',
  version: '0.1.0',
  icon: 'icon.png',
  description:
    "The public demo's front door. It covers every storefront route with a full-screen hub over the faces this box publishes — one card per tenant, its shops inside it, and a row at the card's foot that opens that tenant's admin already signed in — plus a second screen that explains the demo's architecture, and a ribbon that keeps saying the store is a demo while the visitor browses. The addresses are the box's own declaration, never this app's; the copy is embedded in PT/EN/ES. Install to turn the gate on; uninstall and the store is byte-identical. The gate is a neutral theme slot; this app is its first consumer.",
  maturity: 'stable',
  i18n: {
    en: {
      name: 'Demo gate',
      description:
        "The public demo's front door. It covers every storefront route with a full-screen hub over the faces this box publishes — one card per tenant, its shops inside it, and a row at the card's foot that opens that tenant's admin already signed in — plus a second screen that explains the demo's architecture, and a ribbon that keeps saying the store is a demo while the visitor browses. The addresses are the box's own declaration, never this app's; the copy is embedded in PT/EN/ES. Install to turn the gate on; uninstall and the store is byte-identical. The gate is a neutral theme slot; this app is its first consumer.",
      'block.gate.label': 'Demo gate',
    },
    'pt-BR': {
      name: 'Portaria da demo',
      description:
        'A porta de entrada da demo pública. Ela cobre todas as rotas da vitrine com um hub de tela cheia sobre as faces que esta caixa publica — um cartão por tenant, com as lojas dele dentro e, no pé do cartão, uma linha que abre o admin daquele tenant já autenticado —, mais uma segunda tela que explica a arquitetura da demo e uma tarja que segue avisando que a loja é uma demonstração enquanto o visitante navega. Os endereços são a declaração da própria caixa, nunca deste app; os textos são embutidos em pt/en/es. Instale para ligar a portaria; desinstale e a loja fica idêntica byte a byte. A portaria é um slot neutro do tema; este app é o primeiro consumidor dele.',
      'block.gate.label': 'Portaria da demo',
    },
    es: {
      name: 'Puerta de la demo',
      description:
        'La puerta de entrada de la demo pública. Cubre todas las rutas de la tienda con un hub a pantalla completa sobre las caras que esta caja publica — una tarjeta por tenant, con sus tiendas dentro y, al pie de la tarjeta, una fila que abre el admin de ese tenant ya autenticado —, más una segunda pantalla que explica la arquitectura de la demo y una franja que sigue avisando de que la tienda es una demostración mientras el visitante navega. Las direcciones son la declaración de la propia caja, nunca de esta app; los textos van embebidos en pt/en/es. Instálala para encender la puerta; desinstálala y la tienda queda idéntica byte a byte. La puerta es un slot neutro del tema; esta app es su primer consumidor.',
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
