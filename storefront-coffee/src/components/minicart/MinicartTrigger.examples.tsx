// Catalog example for MinicartTrigger (/ui-storefront/minicart-trigger) — the cart icon + the anchored dropdown,
// driven by a LIVE stub cart (add / update / remove mutate a local array and re-read, exactly like the port). A
// "demo add" button exercises the ADD open-mode (4s timer + auto-close); clicking the icon exercises the ICON
// open-mode (backdrop + mobile swipe-hint). This is the fidelity/behaviour-review surface for the minicart.
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { useMemo } from 'react';
import { type MinicartActions, MinicartProvider, useMinicart } from './MinicartProvider';
import { MinicartTrigger } from './MinicartTrigger';

type L = {
  line_id: string;
  sku_id: string;
  qty: number;
  unit: number;
  title: string;
  variant: string;
};

function useStubActions(): MinicartActions {
  return useMemo(() => {
    const cart: L[] = [
      {
        line_id: 'ln_1',
        sku_id: 'sku_1',
        qty: 1,
        unit: 69990,
        title: 'Tênis Velocity 9',
        variant: '40 / Branco',
      },
      {
        line_id: 'ln_2',
        sku_id: 'sku_2',
        qty: 2,
        unit: 32990,
        title: 'Meia Performance',
        variant: 'Único',
      },
    ];
    let seq = 3;
    const snap = (): MinicartSnapshot => {
      const lines: SummaryLine[] = cart.map((l) => ({
        line_id: l.line_id,
        sku_id: l.sku_id,
        qty: l.qty,
        unit_amount: l.unit,
        line_total: l.unit * l.qty,
        title: l.title,
        variant: l.variant,
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
      addLine: async (sku, qty = 1) => {
        const hit = cart.find((l) => l.sku_id === sku);
        if (hit) hit.qty += qty;
        else
          cart.push({
            line_id: `ln_${seq++}`,
            sku_id: sku,
            qty,
            unit: 45990,
            title: 'Tênis Trail Grip',
            variant: '42 / Terracota',
          });
      },
      updateLine: async (id, qty) => {
        const l = cart.find((x) => x.line_id === id);
        if (l) l.qty = qty;
      },
      removeLine: async (id) => {
        const i = cart.findIndex((x) => x.line_id === id);
        if (i >= 0) cart.splice(i, 1);
      },
    };
  }, []);
}

function DemoAdd() {
  const { addAndOpen } = useMinicart();
  return (
    <button type="button" data-testid="demo-add" onClick={() => addAndOpen('sku_new')}>
      Adicionar (demo)
    </button>
  );
}

export function MinicartTriggerExamples() {
  const actions = useStubActions();
  return (
    <MinicartProvider actions={actions}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 24,
          padding: '80px 24px 0',
          minHeight: 560,
        }}
      >
        <DemoAdd />
        <MinicartTrigger base={HOST_BASE} />
      </div>
    </MinicartProvider>
  );
}
