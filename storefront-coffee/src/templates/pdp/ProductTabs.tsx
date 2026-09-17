// ProductTabs — the PDP's "abas" (HANDOVER §4), CSS-ONLY (radio + label + general-sibling `:checked`): no
// JavaScript, every panel in the DOM (SSR-friendly, crawler sees everything, works with JS off — the theme ethos).
//
// o4-PDP #25 — the label strip SCROLLS horizontally instead of wrapping to a second line. All the radios come
// first, then the `.tablist` (a `overflow-x: auto`, `flex-wrap: nowrap` scroll strip of labels), then the
// `.panels`. The checked radio lights its label and reveals its panel by POSITION: `radio:nth-of-type(k):checked ~
// .tablist .tab:nth-child(k)` and `~ .panels .panel:nth-child(k)` — the general-sibling combinator lets the strip
// and panels be their own containers (so the strip can scroll on its own), and the nth correspondence keeps it
// generic for any N (the module ships rules up to a generous ceiling). No `order` reflow, no JS.
//
// The tabs are DERIVED FROM DATA, no vertical vocabulary hard-coded here:
//   • one tab per `content_section` (RICH, S2) — the merchant's titles ("Descrição", "Cuidados", …), body is
//     safe Markdown;
//   • a "Detalhes" tab that is the product's CUSTOM FIELDS as an automatic key/value table (the same fields that
//     become filters) — appended AFTER the content sections. Cadastrou um CF, apareceu; zero exclusion list.
// A tab with no data never renders: no content sections → those tabs are absent; no custom fields → no "Detalhes".
// The first tab is selected by default. (This replaces the S2 <details> accordions the PDP shipped with.)

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { Markdown } from '@/components/Markdown';
import { customFieldEntries, labelOf } from '@/lib/custom-fields';
import styles from './ProductTabs.module.css';

type Tab = { id: string; title: string; body: React.ReactNode };

export function ProductTabs({ product }: { product: ProductDoc }) {
  const sections = product.content_sections ?? [];
  const cfEntries = customFieldEntries(product.metadata);

  const tabs: Tab[] = sections.map((s, i) => ({
    id: `s${i}`,
    title: s.title,
    body: <Markdown>{s.body}</Markdown>,
  }));

  // The automatic "Detalhes" tab — appended last, only when there is at least one renderable custom field (D3/D4).
  if (cfEntries.length > 0) {
    tabs.push({
      id: 'details',
      title: 'Detalhes',
      body: (
        <table className={styles.specs} data-testid="pdp-details-table">
          <tbody>
            {cfEntries.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{labelOf(key)}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    });
  }

  if (tabs.length === 0) return null;

  // A per-product name/id prefix so two PDPs on one page (never today, but cheap) don't share a radio group.
  const group = `pdp-tabs-${product.product_id}`;

  return (
    <section className={styles.tabs} aria-label="Informações do produto" data-testid="pdp-tabs">
      {/* All radios first (the state holders) — hidden but focusable. `nth-of-type` counts them 1..N. */}
      {tabs.map((t, i) => (
        <input
          key={t.id}
          type="radio"
          name={group}
          id={`${group}-${t.id}`}
          className={styles.radio}
          defaultChecked={i === 0}
        />
      ))}
      {/* The scroll strip: labels never wrap, they swipe (overflow-x: auto). */}
      <div className={styles.tablist} role="tablist" data-testid="pdp-tablist">
        {tabs.map((t) => (
          <label
            key={t.id}
            htmlFor={`${group}-${t.id}`}
            className={styles.tab}
            data-testid={`pdp-tab-${t.id}`}
          >
            {t.title}
          </label>
        ))}
      </div>
      {/* The panels: all in the DOM, only the checked one shown (nth-child driven from the radios above). */}
      <div className={styles.panels}>
        {tabs.map((t) => (
          <section key={t.id} className={styles.panel} aria-label={t.title}>
            {t.body}
          </section>
        ))}
      </div>
    </section>
  );
}
