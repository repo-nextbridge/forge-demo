// The `demo-setup` manifest — what this app IS, and why it lives in a customer's repository.
//
// ★★ IT BELONGS TO THIS BOX AND TO NOBODY ELSE, and that is the first fact about it rather than a footnote.
// `forge.origin: "instance"` in package.json is the declaration; `instanceApps` in this repository's
// composition.json is where it is asked for; no Forge release carries it, and a fleet list that named it
// would be refused with rule `not-carried`. It is the third specimen of the species this box already owned
// (`demo-gate` is UI, `payment-pos` is a payment driver) and the one written to be LOOKED AT: the owner's
// words, 08/09 — «esse app me ajuda a mostrar para os clientes como eles podem fazer apps livremente
// (principal forma de extensão do Forge) … esse mostra mais claramente e de forma simples um logo virando
// outro».
//
// ★★ WHY THE MARK IS AN APP'S AND NOT THE PLATFORM'S. The régua of CLAUDE.md decides it in one line: a logo
// is CONTENT, and content is never dictated by the product. The alternative that was considered and refused
// by the owner was "the mark becomes a field of the store" — which would weld a content field into the Forge
// admin and make every customer carry a shape most of them will never use. So the product ships SLOTS with a
// bare default (pk26/P1) and whoever wants a mark writes the block. This app is that, for this box.
//
// ⛔ FOUR BLOCKS, ONE PER PLACE, AND THE KERNEL IS WHAT REQUIRES IT. `placement: 'single'` is enforced per
// (store, app, component) — `assertSingleFree`, packages/core/src/commands/composition.ts:176 — so one
// component cannot fill two slots. Before pk26 the mark was one block read in four renders, which is how a
// Compose board came to configure something it could not say the location of.
//
// ⛔ AND NO ADMIN PAGE, WHICH IS A SUBTRACTION AND NOT AN OVERSIGHT. There is no path from a page to the
// vitrine's mark: the only access is the slot, and the shops that wear this run the VANILLA storefront image,
// unforked. A page would either mirror what the seed already writes or invite a visitor to edit something the
// weekly reset erases. Page administers, block renders — and `demo-gate`, the box's other UI app, has never
// needed one either.
//
// ★ AREAS CONFINE BY PREFIX and this app invents no vocabulary in the kernel: `header`, `footer` and
// `account` are the page prefixes the four slots already live under (trava 7).

import { type ExtensionManifest, extensionManifestSchema } from '@forgecommerce/contracts';

const DESCRIPTION_EN =
  "The demo's own marks: the shop's name and logo in the four places a store shows one — the header bar, the mobile drawer, the footer column and the login box — each placed and configured on its own in Compose. Written inside this instance, composed into its images, offered to nobody: it is what a customer's own app looks like.";

/** The three fields every mark has. `logo` is a `type:'id'` reference, so the generated drawer renders the
 *  shared asset picker and the kernel stamps `logo_url` beside it at read time — zero lines of admin code. */
const MARK_FIELDS = [
  { name: 'logo', type: 'id' as const, optional: true },
  { name: 'text', type: 'string' as const, optional: true },
  { name: 'tail', type: 'string' as const, optional: true },
];

export const manifest: ExtensionManifest = extensionManifestSchema.parse({
  id: 'demo-setup',
  name: 'Demo setup',
  kind: 'app',
  version: '0.1.0',
  // ⚠️ DECLARING THIS IS HALF THE ICON AND THE OTHER HALF IS `"./icon"` IN package.json — a COMPOSED app's
  // icon is soldered from the package's EXPORTS and nothing ever opens the manifest to notice a disagreement.
  // `demo-gate` lost its icon to exactly that, and `bin/composition.guard.mjs` holds both halves together and
  // compares the BYTES.
  icon: 'icon.png',
  description: DESCRIPTION_EN,
  maturity: 'stable',
  i18n: {
    // ⚠️ THE `en` ENTRY OF EVERY OPERATOR-FACING FIELD IS THE LITERAL ABOVE, CHARACTER FOR CHARACTER, and
    // `manifest.test.ts` holds this app to it. The monorepo enforces that with a guard that enumerates its
    // OWN `extensions/` directory and therefore never sees an app living in a customer's repository — the
    // same reason `payment-pos` duplicates the check here.
    en: {
      name: 'Demo setup',
      description: DESCRIPTION_EN,
      'block.header_brand.label': 'Mark · store header',
      'block.drawer_brand.label': 'Mark · mobile drawer',
      'block.footer_brand.label': 'Mark · store footer',
      'block.account_brand.label': 'Mark · login box',
      'compose.text': 'Name',
      'compose.text.hint': 'The word before the tail, e.g. "acme". With a logo, its description instead.',
      'compose.tail': 'Tail',
      'compose.tail.hint': 'Drawn in the accent colour of the theme, e.g. ".shop". Blank: no tail.',
      'compose.logo': 'Logo',
      'compose.logo.hint':
        'Drawn instead of the words, at 1.6× the text size, keeping the file’s own proportions.',
      'compose.tagline': 'Tagline',
      'compose.tagline.hint':
        'One line under the mark, in the footer only. Blank: the mark stands alone.',
    },
    'pt-BR': {
      name: 'Configuração da demo',
      description:
        'As marcas da própria demo: o nome e o logo da loja nos quatro lugares em que uma loja mostra um — a barra do cabeçalho, a gaveta do celular, a coluna do rodapé e a caixa de login — cada um colocado e configurado por si no Compose. Escrito dentro desta instância, composto nas imagens dela, ofertado a ninguém: é o que se parece com um app do próprio cliente.',
      'block.header_brand.label': 'Marca · cabeçalho da loja',
      'block.drawer_brand.label': 'Marca · gaveta do celular',
      'block.footer_brand.label': 'Marca · rodapé da loja',
      'block.account_brand.label': 'Marca · caixa de login',
      'compose.text': 'Nome',
      'compose.text.hint':
        'A palavra antes da terminação, ex.: "acme". Com logo, vira a descrição dele.',
      'compose.tail': 'Terminação',
      'compose.tail.hint':
        'Desenhada na cor de destaque do tema, ex.: ".loja". Em branco: sem terminação.',
      'compose.logo': 'Logo',
      'compose.logo.hint':
        'Desenhado no lugar das palavras, com 1,6× o tamanho do texto, na proporção do arquivo.',
      'compose.tagline': 'Assinatura',
      'compose.tagline.hint':
        'Uma linha abaixo da marca, só no rodapé. Em branco: a marca fica sozinha.',
    },
    es: {
      name: 'Configuración de la demo',
      description:
        'Las marcas de la propia demo: el nombre y el logo de la tienda en los cuatro lugares donde una tienda muestra uno — la barra de cabecera, el cajón del móvil, la columna del pie y la caja de acceso — cada uno colocado y configurado por separado en Compose. Escrita dentro de esta instancia, compuesta en sus imágenes, ofertada a nadie.',
      'block.header_brand.label': 'Marca · cabecera de la tienda',
      'block.drawer_brand.label': 'Marca · cajón del móvil',
      'block.footer_brand.label': 'Marca · pie de la tienda',
      'block.account_brand.label': 'Marca · caja de acceso',
      'compose.text': 'Nombre',
      'compose.text.hint':
        'La palabra antes de la terminación, p. ej. "acme". Con logo, su descripción.',
      'compose.tail': 'Terminación',
      'compose.tail.hint':
        'Se dibuja con el color de acento del tema, p. ej. ".tienda". En blanco: sin terminación.',
      'compose.logo': 'Logo',
      'compose.logo.hint':
        'Se dibuja en lugar de las palabras, a 1,6× el tamaño del texto, con la proporción del archivo.',
      'compose.tagline': 'Lema',
      'compose.tagline.hint':
        'Una línea bajo la marca, solo en el pie. En blanco: la marca queda sola.',
    },
  },
  // ZERO SCOPES. This app drives no kernel command: it renders what the placement's config already carries,
  // and the config is written by Compose (or, on this box, by the seed driving the same commands an operator
  // would). The smallest attack surface is the one that is not there.
  scopes: [],
  contact: {
    // ⛔ NO MANIFEST-DEFAULT HOOKS, AND THE REASON IS THE CAFÉ. Installing an app is TENANT-wide, and a hook
    // is materialised as a real placement in EVERY store at install (`seedDefaultPlacements`). These blocks
    // draw nothing when unconfigured AND they replace the front's own wordmark — so four default placements
    // would strip the mark from every store of the tenant, including the counter, the moment somebody
    // installed the app. Placement here is a deliberate gesture, made per store, by `seed/demo-setup.mjs`.
    hooks: [],
    blocks: [
      {
        component: 'header_brand',
        label: 'Mark · store header',
        surface: 'storefront',
        placement: 'single',
        area: 'header',
        config_schema: MARK_FIELDS,
      },
      {
        component: 'drawer_brand',
        label: 'Mark · mobile drawer',
        surface: 'storefront',
        placement: 'single',
        area: 'header',
        config_schema: MARK_FIELDS,
      },
      {
        // ★ THE ONLY ONE WITH A FOURTH FIELD, and the asymmetry is the whole story of this block. The footer
        // slot's fallback cedes the Forge mark AND «Leve. Inteligente. Sua.» as one node, so a shop that
        // places a mark here loses the sentence. `tagline` is how it gets one of its own — by configuration,
        // which is the thing worth showing a customer.
        component: 'footer_brand',
        label: 'Mark · store footer',
        surface: 'storefront',
        placement: 'single',
        area: 'footer',
        config_schema: [...MARK_FIELDS, { name: 'tagline', type: 'string' as const, optional: true }],
      },
      {
        component: 'account_brand',
        label: 'Mark · login box',
        surface: 'storefront',
        placement: 'single',
        area: 'account',
        config_schema: MARK_FIELDS,
      },
    ],
  },
});

export default manifest;
