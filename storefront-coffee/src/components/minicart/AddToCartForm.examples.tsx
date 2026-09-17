// Catalog example for AddToCartForm (/ui-storefront/add-to-cart-form) — the PDP "Adicionar ao carrinho" as a
// progressively-enhanced native <form>. With JS, submit is intercepted and the SKU is added via the port + the
// drawer opens; with no JS the Server Action redirects to /checkout. Wrapped in a live stub MinicartProvider so
// useMinicart() resolves. Shows the default label and a custom-label variant. The stub action is a no-op resolve.
'use client';

import { EMPTY_SNAPSHOT } from '@forgeco/storefront-kit/minicart-types';
import { AddToCartForm } from './AddToCartForm';
import { type MinicartActions, MinicartProvider } from './MinicartProvider';

/** A minimal stub port — the example only exercises render, so the calls resolve to nothing. */
const stubActions: MinicartActions = {
  readCart: async () => EMPTY_SNAPSHOT,
  addLine: async () => {},
  updateLine: async () => {},
  removeLine: async () => {},
};

/** The no-JS fallback Server Action stand-in — resolves without navigating in the gallery. */
const noopAction = async () => {};

export function AddToCartFormExamples() {
  return (
    <MinicartProvider actions={stubActions}>
      <div style={{ display: 'grid', gap: 16, maxWidth: 360 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Rótulo padrão.</p>
        <AddToCartForm action={noopAction} skuId="sku_velocity_9" />

        {/* The override, with a label a host would actually differ on. It used to read "Adicionar ao carrinho"
            — which is now the DEFAULT, so the variant demonstrated nothing at all. */}
        <p style={{ color: 'var(--color-subtle)' }}>Rótulo customizado.</p>
        <AddToCartForm action={noopAction} skuId="sku_velocity_9" label="Adicionar à lista" />
      </div>
    </MinicartProvider>
  );
}
