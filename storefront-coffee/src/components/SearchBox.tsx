// SearchBox — a native GET form to the platform search route (`/search?q=`). WITHOUT JS: submitting navigates
// to the SSR search page (the baseline that always works). WITH JS: a live suggest PANEL enhances it (read.suggest
// via /api/suggest — now enriched with category + compare_at), degrading silently to the plain GET on any error.
// The panel is the prototype's two-column layout (§2.2): a results list ("Categoria · preço-de preço") on the
// left + a FEATURED ProductCard (display-only) on the right (desktop); a single column on mobile. Hovering a
// result features it. The field carries `data-input-box`, so the theme's shared border hover→focus fade
// (globals.css §2.7) applies. Green zone.
'use client';

import { ltreeToSegments } from '@forgeco/storefront-kit/catalog-path';
import { FadeLayer } from '@forgeco/storefront-kit/FadeLayer';
import { ArrowRight, Search } from '@forgeco/storefront-kit/icons';
import { formatMoney } from '@forgeco/storefront-kit/money';
import type {
  ProductDoc,
  SuggestProduct,
  SuggestResult,
} from '@forgeco/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgeco/storefront-kit/store-route';
import { SEARCH_PROMPT } from '@forgeco/storefront-kit/subtemplates';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useOptionalMinicart } from '@/components/minicart/MinicartProvider';
// MS-M1α — `currentStore` used to live in this file. It is the whole class's rule now (lib/store-param.ts):
// this box was the ONLY fragment forwarding its store, and the siblings that did not were the leak.
import { currentStore } from '@/lib/store-param';
import { ProductCard } from './ProductCard';
import styles from './SearchBox.module.css';

/** Synthesize a minimal ProductDoc from an (enriched) suggest row so the featured column renders the theme's OWN
 * ProductCard (§2.2) — photo, the -N% badge (from compare_at) and the price. DISPLAY-ONLY: read.suggest carries
 * no sku id (the add island needs one), so the featured card omits it (`cart={false}`). */
function suggestToDoc(p: SuggestProduct): ProductDoc {
  const media = p.image
    ? [{ provider_key: '', kind: 'image' as const, role: null, position: 0, url: p.image }]
    : [];
  return {
    product_id: p.handle,
    title: p.title,
    description: null,
    handle: p.handle,
    status: 'active',
    metadata: null,
    options: [],
    skus:
      p.price != null
        ? [
            {
              id: `suggest:${p.handle}`,
              code: p.handle,
              amount: p.price,
              currency: 'BRL',
              status: 'active',
              name: null,
              ref: null,
              ean: null,
              compare_at_amount: p.compare_at,
              is_default: true,
              metadata: null,
              option_values: [],
              media,
            },
          ]
        : [],
    categories: [],
    media,
  };
}

export function SearchBox({
  base,
  defaultValue = '',
  placeholder = SEARCH_PROMPT,
  previewResult,
}: {
  /** MULTISTORE M1-β — the store prefix of the current request. The form ACTION needs it most: a native GET
   * to a bare `/search` leaves the store on submit, and it does so with JS off, where nothing can rescue it. */
  base: StoreBase;
  defaultValue?: string;
  /** ★★ P2 · ACC1-4 — defaults to the KIT's one prompt. It used to default to a second literal of its own
   * ("O que você procura?"), so the same store greeted the shopper differently on the vitrine and on
   * `/account`: two headers, one chrome, two questions. */
  placeholder?: string;
  /** Preview/test seam: seed the panel open with a static result (no fetch), for the /ui-storefront catalog. */
  previewResult?: SuggestResult;
}) {
  const [value, setValue] = useState(defaultValue);
  const [result, setResult] = useState<SuggestResult | null>(previewResult ?? null);
  const [open, setOpen] = useState(Boolean(previewResult));
  const [focused, setFocused] = useState(false); // #11 — dim/blur the page behind the search while it is active
  const [picked, setPicked] = useState<string | null>(null);
  const pathname = usePathname();
  // The cart dropdown and the suggest panel are mutually exclusive header overlays. When the minicart opens (an
  // add, or the cart icon), close the suggest panel so the two never stack on mobile — the systemic half of the
  // z-index fix. `useOptionalMinicart` tolerates the previews / SSR shells that mount the box with no provider.
  const minicartOpen = useOptionalMinicart()?.open ?? false;

  // Close the suggest panel on ANY navigation. The header (and this box) persist across App-Router routes, so a
  // suggestion / "Ver todos" click would otherwise leave the dropdown open, covering the new page. It reopens
  // only when the shopper interacts again (focus/typing). The onClick handlers below also close it immediately
  // (no flash during the route transition); this effect is the catch-all (Enter-to-search, etc.).
  useEffect(() => {
    setOpen(false);
    setFocused(false);
  }, [pathname]);

  // Close the suggest panel whenever the minicart opens (mutually exclusive header overlays).
  useEffect(() => {
    if (minicartOpen) {
      setOpen(false);
      setFocused(false);
    }
  }, [minicartOpen]);

  useEffect(() => {
    if (previewResult) return; // static preview — never fetch.
    const q = value.trim();
    if (q.length < 2) {
      setResult(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q });
        const store = currentStore();
        if (store) qs.set('store', store);
        const res = await fetch(`/api/suggest?${qs.toString()}`, { signal: ctrl.signal });
        if (res.ok) {
          setResult((await res.json()) as SuggestResult);
          setOpen(true);
        }
      } catch {
        // Network/abort → keep the plain GET behavior (no panel). Autocomplete only ever enhances.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, previewResult]);

  const products = result?.products ?? [];
  // SEARCH-3 (front) — the suggest ALSO returns matching CATEGORIES (e.g. "tenis" → the "Tênis" category, even
  // when no product TITLE contains the term because the catalog is in English). Show them, and open the panel
  // when there are products OR categories — a category-only match must not read as an empty/broken dropdown.
  const categories = result?.categories ?? [];
  const hasResults = products.length > 0 || categories.length > 0;
  const featured = products.find((p) => p.handle === picked) ?? products[0] ?? null;

  return (
    <div className={styles.wrap} data-active={focused || undefined}>
      {/* #11 — a full-viewport scrim (dim + blur) behind the search while it is active, so the focus is the input
          and its panel (the command-palette pattern). Fades; never intercepts clicks. */}
      <div className={styles.scrim} data-open={focused || undefined} aria-hidden="true" />
      <form
        className={styles.box}
        action={storeHref(base, '/search')}
        method="get"
        aria-label="Busca"
        autoComplete="off"
        data-testid="search-box"
      >
        {/* The field carries data-input-box → the shared border hover→focus fade (globals.css §2.7). NO submit
         * button: the pill field is the whole affordance; Enter submits the form to /search. */}
        <div className={styles.field} data-input-box="">
          <Search className={styles.icon} size={15} />
          <input
            className={styles.input}
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => {
              setFocused(true);
              if (hasResults) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setFocused(false);
                e.currentTarget.blur();
              }
            }}
            // Close after focus leaves the input (a small delay lets a suggestion click land first).
            onBlur={() =>
              setTimeout(() => {
                setOpen(false);
                setFocused(false);
              }, 120)
            }
            placeholder={placeholder}
            // ★★ P2 · ACC1-4 — the SAME words the box shows. This was a third literal: the visible prompt
            // said one thing and the accessible name another, so a screen reader and a sighted shopper were
            // asked different questions by one input.
            aria-label={placeholder}
          />
        </div>
      </form>

      {/* Fluidity (§10.1): the panel never unmounts — it fades. Clicking inside must NOT close it: mousedown
       * preventDefault stops the input's blur (§2.2), so the click lands on the link and navigates. */}
      <FadeLayer
        open={open && hasResults}
        className={styles.panel}
        data-single={!featured || undefined}
        data-testid="suggest-dropdown"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className={styles.results}>
          <div className={styles.resultsHead}>
            <span className={styles.resultsTitle}>Resultados</span>
            <Link
              href={storeHref(base, '/search')}
              className={styles.seeAll}
              onClick={() => setOpen(false)}
            >
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {/* Matching CATEGORIES first (the term is a category the store sells) — each links to its PLP. */}
          {categories.length > 0 ? (
            <nav className={styles.catList} aria-label="Categorias">
              {categories.map((c) => (
                <Link
                  key={c.path}
                  href={storeHref(base, `/${ltreeToSegments(c.path).join('/')}`)}
                  className={styles.catRow}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.rowName}>{c.name}</span>
                  <span className={styles.catTag}>Categoria</span>
                </Link>
              ))}
            </nav>
          ) : null}
          <div className={styles.resultsList}>
            {products.map((p) => (
              <Link
                key={p.handle}
                href={storeHref(base, `/p/${p.handle}`)}
                className={styles.row}
                data-active={featured?.handle === p.handle ? '' : undefined}
                onMouseEnter={() => setPicked(p.handle)}
                onClick={() => setOpen(false)}
              >
                <span
                  className={styles.thumb}
                  style={p.image ? { backgroundImage: `url("${p.image}")` } : undefined}
                />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{p.title}</span>
                  <span className={styles.rowMeta}>
                    {p.category ? `${p.category} · ` : ''}
                    {p.compare_at != null ? (
                      <s className={styles.rowOld}>{formatMoney(p.compare_at, 'BRL')}</s>
                    ) : null}
                    {p.compare_at != null ? ' ' : ''}
                    {p.price != null ? formatMoney(p.price, 'BRL') : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        {featured ? (
          <div className={styles.featured}>
            <ProductCard product={suggestToDoc(featured)} base={base} cart={false} />
          </div>
        ) : null}
      </FadeLayer>
    </div>
  );
}
