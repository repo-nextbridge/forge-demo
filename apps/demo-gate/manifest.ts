// The demo-gate manifest (DEMO-GATE) — what this app IS and the powers it asks for. Validated against the
// contract shape (@forgecommerce/contracts). Deterministic app: no AI, no privileged write, no data of its own, and
// `scopes: []` — it drives NO kernel command. It only FILLS the neutral theme slot `storefront:gate` with a
// full-screen interstitial (the "Demo store" screen). Installing it (consenting to the `storefront:gate` target)
// turns the gate ON; uninstalling it turns the store byte-identical to no-gate.
//
// The MANIFEST-DEFAULT hook targets `storefront:gate` directly (no Compose placement needed — the gate is a
// single, fixed, full-screen slot, unlike a banner the operator arranges). The `single` block declaration is
// there so the block is a first-class citizen of the Compose model, but the gate needs no per-instance config:
// its two links (site/admin) and the access key are INSTANCE wiring (env + the admin `/enter` route), never in
// the browser — the same class as the media base URL. The screen COPY is embedded (PT/EN/ES), not config.

import { type ExtensionManifest, extensionManifestSchema } from '@forgecommerce/contracts';

export const manifest: ExtensionManifest = extensionManifestSchema.parse({
  id: 'demo-gate',
  name: 'Demo gate',
  kind: 'app',
  version: '0.1.0',
  icon: 'icon.png',
  description:
    'A full-screen gate for a public demo store: any visitor lands on a "Demo store" notice (fictional environment) and chooses a path: the storefront, or the admin (signed in with one click). Install to turn the gate on; uninstall and the store is byte-identical. The gate is a neutral theme slot; this app is its first consumer.',
  maturity: 'stable',
  i18n: {
    en: {
      name: 'Demo gate',
      description:
        'A full-screen gate for a public demo store: any visitor lands on a "Demo store" notice (fictional environment) and chooses a path: the storefront, or the admin (signed in with one click). Install to turn the gate on; uninstall and the store is byte-identical. The gate is a neutral theme slot; this app is its first consumer.',
      'block.gate.label': 'Demo gate',
    },
    'pt-BR': {
      name: 'Portaria da demo',
      description:
        'Uma portaria de tela cheia para uma loja de demonstração pública: todo visitante cai num aviso de "Loja de demonstração" (ambiente fictício) e escolhe um caminho: a vitrine ou o admin (com login em um clique). Instale para ligar a portaria; desinstale e a loja fica idêntica byte a byte. A portaria é um slot neutro do tema; este app é o primeiro consumidor dele.',
      'block.gate.label': 'Portaria da demo',
    },
    es: {
      name: 'Puerta de la demo',
      description:
        'Una puerta a pantalla completa para una tienda de demostración pública: todo visitante llega a un aviso de "Tienda de demostración" (entorno ficticio) y elige un camino: la tienda o el admin (con acceso en un clic). Instálala para encender la puerta; desinstálala y la tienda queda idéntica byte a byte. La puerta es un slot neutro del tema; esta app es su primer consumidor.',
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
