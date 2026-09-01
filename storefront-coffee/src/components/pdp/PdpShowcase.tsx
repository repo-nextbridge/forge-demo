// Gallery example (/ui-storefront/pdp-showcase) — the PDP body (breadcrumb + gallery + buybox + tabs) rendered
// with fixtures so its fidelity is reviewable and its live behaviours (variant swatch swaps the photo, size
// chips, qty stepper, add-to-cart → minicart, CEP estimate, gallery thumb → stage) are drivable OFFLINE. The
// data-driven neighbours on the real page (reviews, "compre junto", related shelf) are extension outlets and
// are verified on Staging. This composes the SAME native blocks the template does (no route/DB), wrapped in a
// stub MinicartProvider so the buy row actually drives a cart, and publishes a rating so the stars light.
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { useEffect, useMemo } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { PDP_RATING_EVENT, PDP_RATING_GLOBAL, type PdpRating } from '@/lib/pdp-rating';
import { PdpGallerySelector } from '@/templates/pdp/PdpGallerySelector';
import { ProductTabs } from '@/templates/pdp/ProductTabs';
import templateStyles from '@/templates/pdp/template.module.css';
import { type MinicartActions, MinicartProvider } from '../minicart/MinicartProvider';
import { MinicartTrigger } from '../minicart/MinicartTrigger';

/** A 1×1 colored square as a data URI — a stand-in swatch/cover photo (no media door in the offline preview). */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

const COLORS = [
  { id: 'preto', value: 'Preto', hex: '%2317181a' },
  { id: 'azul', value: 'Azul', hex: '%231d4ed8' },
  { id: 'branco', value: 'Branco', hex: '%23e7e9ec' },
  { id: 'verde', value: 'Verde', hex: '%2316a34a' },
  { id: 'laranja', value: 'Laranja', hex: '%23c2410c' },
];
const SIZES = ['38', '39', '40', '41', '42', '43'];

function sampleProduct(): ProductDoc {
  const skus: ProductDoc['skus'] = [];
  for (const c of COLORS) {
    for (const s of SIZES) {
      skus.push({
        id: `sku_${c.id}_${s}`,
        code: `SPD-${c.id.slice(0, 3).toUpperCase()}-${s}`,
        amount: 74990,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: 97490,
        is_default: c.id === 'preto' && s === '40',
        metadata: {},
        option_values: [
          { option_id: 'color', option_name: 'Cor', value_id: c.id, value: c.value },
          { option_id: 'size', option_name: 'Tamanho', value_id: s, value: s },
        ],
        media: [
          {
            provider_key: `demo/${c.id}`,
            kind: 'image',
            role: null,
            position: 0,
            url: square(c.hex),
          },
        ],
      });
    }
  }
  return {
    product_id: 'prod_speed_elite',
    title: 'Tênis Speed Elite',
    description:
      'Placa de propulsão, espuma de alto retorno e peso de apenas 232 g. Feito para dias de prova e treinos de ritmo forte.',
    handle: 'tenis-speed-elite',
    status: 'active',
    metadata: {
      cf_uso: 'Corrida',
      cf_cano: 'Baixo',
      cf_genero: 'Unissex',
      cf_peso: '232 g',
    },
    content_sections: [
      {
        title: 'Descrição',
        body: 'O **Speed Elite** foi desenvolvido para dias de prova. A placa de propulsão em nylon percorre todo o solado e funciona como uma alavanca: flexiona na aterrissagem e devolve a energia na saída do passo. Combinada à espuma supercrítica de **38 mm**, entrega retorno de até **85%**, com apenas **232 g** no pé.',
      },
      {
        title: 'Cuidados',
        body: 'Limpe com pano úmido e sabão neutro. Não use máquina de lavar. Seque à sombra.',
      },
    ],
    meta_title: null,
    meta_description: null,
    // o4 #22 — the doc lists Tamanho BEFORE Cor on purpose (this is what Staging delivers). The buybox must still
    // render Cor first, derived from the colour-axis ROLE (orderedOptions), never from this stored order.
    options: [
      {
        id: 'size',
        name: 'Tamanho',
        position: 0,
        values: SIZES.map((s, i) => ({ id: s, value: s, position: i })),
      },
      {
        id: 'color',
        name: 'Cor',
        position: 1,
        values: COLORS.map((c, i) => ({ id: c.id, value: c.value, position: i })),
      },
    ],
    skus,
    categories: [{ category_id: 'cat_corrida', path: 'tenis/corrida', is_primary: true }],
    media: [
      {
        provider_key: 'demo/cover',
        kind: 'image',
        role: 'hero',
        position: 0,
        url: square('%23c7cdd4'),
      },
    ],
  };
}

function useStubActions(): MinicartActions {
  return useMemo(() => {
    const cart: { id: string; qty: number }[] = [];
    const snap = (): MinicartSnapshot => {
      const lines: SummaryLine[] = cart.map((l) => ({
        line_id: l.id,
        sku_id: l.id,
        qty: l.qty,
        unit_amount: 74990,
        line_total: 74990 * l.qty,
        title: 'Tênis Speed Elite',
        variant: l.id.replace('sku_', '').replace('_', ' · '),
      }));
      const total = lines.reduce((a, l) => a + l.line_total, 0);
      return {
        lines,
        totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: total }],
        totalAmount: total,
        currency: 'BRL',
        count: cart.reduce((a, l) => a + l.qty, 0),
      };
    };
    return {
      readCart: async () => snap(),
      addLine: async (id, qty = 1) => {
        const hit = cart.find((l) => l.id === id);
        if (hit) hit.qty += qty;
        else cart.push({ id, qty });
      },
      updateLine: async () => {},
      removeLine: async () => {},
    };
  }, []);
}

export function PdpShowcase() {
  const actions = useStubActions();
  const product = useMemo(sampleProduct, []);

  // Publish a rating so BuyboxRating lights its stars (in production the reviews extension does this): write the
  // global AND fire the event, exactly as the reviews section does.
  useEffect(() => {
    const rating: PdpRating = { average: 4.7, count: 128 };
    (window as unknown as Record<string, PdpRating>)[PDP_RATING_GLOBAL] = rating;
    window.dispatchEvent(new CustomEvent(PDP_RATING_EVENT, { detail: rating }));
  }, []);

  return (
    <MinicartProvider actions={actions}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 8px' }}>
        <MinicartTrigger base={HOST_BASE} />
      </div>
      <main className={templateStyles.pdp}>
        <Breadcrumb
          crumbs={[
            { label: 'Tênis', path: '/tenis' },
            { label: 'Corrida de rua', path: '/tenis/corrida' },
          ]}
          current={product.title}
          base={HOST_BASE}
        />
        <PdpGallerySelector
          product={product}
          store="demo"
          optimized={false}
          freeShippingThreshold={60000}
          maxInstallments={12}
          initialCep={null}
        />
        <ProductTabs product={product} />
      </main>
    </MinicartProvider>
  );
}
