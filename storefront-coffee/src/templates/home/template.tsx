// Home template (structure, yellow zone): PURE COMPOSITION for the merchandising, plus the theme's own
// navigation sections. The three Compose SLOTS (hero / banner strip / below-shelf) render exactly what the
// merchant arranged — nothing else (S6-FIXPACK: the hardcoded "Bem-vindo…" hero and the invented 12-newest
// shelf are gone; no fill → an empty slot). The `categories` / `brands` sections are NOT Compose slots: they
// are theme chrome over CORE reads (read.categories / read.brands), exactly like the header megamenu — the
// page hands them in, and an empty store renders nothing. Keeping them out of the slot registry is deliberate:
// a declared slot is a promise that a merchant-dropped block renders there (outlets.test guards it), and these
// sections are theme-owned, not drop targets.
//
// The template stays SYNCHRONOUS (renderToString-safe): it just places the nodes the page hands it (async
// <ExtensionOutlet>s and async section components) into position.

import type { ReactNode } from 'react';
import { Slot } from '@/lib/slots/Slot';
import styles from './template.module.css';

export function HomeTemplate({
  hero,
  bannerStrip,
  belowShelf,
  belowCategories,
  belowBrands,
  categories,
  brands,
}: {
  hero?: ReactNode;
  bannerStrip?: ReactNode;
  belowShelf?: ReactNode;
  /** A Compose slot AFTER the categories section — so blocks can be spread down the page, not only at the top. */
  belowCategories?: ReactNode;
  /** A Compose slot AFTER the brands section — the last drop target on the home. */
  belowBrands?: ReactNode;
  /** The "Compre por categoria" section (theme chrome over read.categories) — a fixed section, not a slot. */
  categories?: ReactNode;
  /** The "Marcas" section (theme chrome over read.brands) — a fixed section, not a slot. */
  brands?: ReactNode;
}) {
  return (
    <main className={styles.home}>
      <Slot name="home.hero">{hero}</Slot>
      <Slot name="home.banner_strip">{bannerStrip}</Slot>
      <Slot name="home.below_shelf">{belowShelf}</Slot>
      {categories}
      <Slot name="home.below_categories">{belowCategories}</Slot>
      {brands}
      <Slot name="home.below_brands">{belowBrands}</Slot>
    </main>
  );
}
