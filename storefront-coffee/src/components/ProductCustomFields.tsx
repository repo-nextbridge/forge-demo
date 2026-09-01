// ProductCustomFields — the product's custom fields (the merchant's declared extra data, carried in
// `product.metadata` and validated by the kernel) rendered as a plain key/value spec list.
//
// S7-SF-PDP — the projection logic (humanize key, scalars only) now lives in `lib/custom-fields` so this and the
// PDP "Detalhes" tab agree; the PDP renders these THROUGH that tab now (this component stays for other consumers
// / the /ui-storefront catalog). The kernel does NOT auto-render custom fields (deliberate doctrine: a typed,
// validated slot — the theme decides the look and the home).

import { customFieldEntries, labelOf } from '@/lib/custom-fields';

export function ProductCustomFields({
  metadata,
  className,
}: {
  /** ProductDoc['metadata'] — the product's custom-field bag, as the read port returns it. */
  metadata: unknown;
  className?: string;
}) {
  const entries = customFieldEntries(metadata);
  if (entries.length === 0) return null;

  return (
    <dl className={className} data-testid="product-custom-fields">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{labelOf(key)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
