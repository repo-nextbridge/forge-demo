// THE COFFEE SHOP'S HOME, as the approved design draws it — hardcoded, with exactly TWO dynamic pieces.
//
// The design is a written page, not a composition: a hero, a manifesto of four claims, subscription in three
// steps, the six coffees, a strip of seals, a wall of reviews. Only two of those come from data, and the
// artboard itself marks them with holes — the product cards and the review wall. Everything else is copy this
// shop owns, which is what makes it a FORK rather than a theme.
//
// ── SYNCHRONOUS AND PROP-FED, on purpose ────────────────────────────────────────────────────────────────
// It receives what it draws. `HomeView` does the reading; this file renders. That is what lets the whole page
// be asserted in a unit test with no port, no kernel and no network — and the two rules that matter here
// (what a card omits when data is missing, what the wall does when it is empty) are exactly the rules a
// fixture-shaped test forgets to exercise.
//
// ── THE FIVE SLOTS ARE KEPT AND MOUNTED ─────────────────────────────────────────────────────────────────
// The template manifest this shop inherited declares five drop targets, and every one of them still renders
// here. Keeping them is not politeness to the reference vitrine: an unfilled slot renders NOTHING, so the
// page is byte-for-byte the design until somebody composes a block into it — and the day this shop wants a
// campaign banner above the coffees, it is a placement in the admin rather than a deploy. Dropping the
// outlets while leaving the declarations would be a promise that renders nothing, which is the one shape
// this house refuses.

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { formatMoney } from '@forgecommerce/storefront-kit/money';
import { MediaImage } from '@forgecommerce/storefront-kit/MediaImage';
import { coverMediaOf } from '@forgecommerce/storefront-kit/sku';
import { imagesOf, mediaSrc } from '@forgecommerce/storefront-kit/media/src';
import type { ReactNode } from 'react';
import { Icon, noteIcon, PathIcon, ScrollHintIcon } from '@/components/coffee/icons';
import { field, notesOf, priceOf, variantSummary } from '@/lib/coffee/product-view';
import type { WallReview } from '@/lib/coffee/reviews-view';
import { STAR_MAX } from '@/lib/coffee/reviews-view';
import styles from './coffee.module.css';

/** The manifesto beside the hero — four claims, two on each side, copy this shop owns. */
const CLAIMS = [
  {
    icon: 'leaf',
    title: 'Compra direta',
    body: 'Pagamos acima do mercado a 11 famílias produtoras em Minas, ES e Mogiana.',
  },
  {
    icon: 'grinder',
    title: 'Moagem no seu método',
    body: 'Grãos, V60/filtrado ou espresso — moído na hora do envio, nunca antes.',
  },
  {
    icon: 'timer',
    title: 'Torrado nesta semana',
    body: 'A data de torra vem impressa no selo. Nada com mais de 15 dias sai daqui.',
  },
  {
    icon: 'label',
    title: 'Notas no rótulo',
    body: 'Região, processo, variedade, torra e pontuação SCA — tudo à vista, sem mistério.',
  },
] as const;

const SEALS = [
  { icon: 'truck', lines: ['Frete grátis', 'acima de R$ 149'] },
  { icon: 'percent', lines: ['10% OFF em', 'toda assinatura'] },
  { icon: 'refresh', lines: ['Torrado na semana', 'do seu pedido'] },
  { icon: 'shield', lines: ['Não gostou?', 'Trocamos o pacote'] },
] as const;

export type HomeCoffeeProps = {
  base: string;
  products: ProductDoc[];
  reviews: WallReview[];
  /** The store-wide rating, or null when nothing has been reviewed. Never invented. */
  rating: { average: number; count: number } | null;
  slots: Record<'hero' | 'bannerStrip' | 'belowShelf' | 'belowCategories' | 'belowBrands', ReactNode>;
};

/** The five dots. `filled` is rounded from the average — a 4,6 draws five, a 4,4 draws four. */
function Dots({ filled, small = false }: { filled: number; small?: boolean }) {
  return (
    <span className={small ? styles.reviewDots : styles.dots} aria-hidden>
      {Array.from({ length: STAR_MAX }, (_, i) => (
        <span
          key={i}
          className={
            i < filled
              ? small
                ? styles.reviewDot
                : styles.dot
              : small
                ? styles.reviewDotEmpty
                : styles.dotEmpty
          }
        />
      ))}
    </span>
  );
}

function ProductCard({ product, base }: { product: ProductDoc; base: string }) {
  const price = priceOf(product);
  const media = imagesOf(coverMediaOf(product))[0];
  // `mediaSrc` answers BOTH halves at once: the master's url and — only when this instance's own media door
  // can serve derivatives of it — the optimizer key. Passing the key when no door exists is what makes a
  // shop request sizes nobody serves.
  const shot = mediaSrc(media);
  const sca = field(product, 'sca');
  const subtitle = field(product, 'subtitle');
  const variants = variantSummary(product);
  const notes = notesOf(product);

  return (
    <a className={styles.card} href={`${base}/p/${product.handle}`}>
      <div className={styles.cardShot}>
        <MediaImage
          src={shot.url}
          providerKey={shot.providerKey}
          alt={media?.alt ?? product.title}
          height={310}
          sizes="(max-width: 700px) 90vw, 340px"
        />
      </div>
      {/* Each of these is absent when the merchant left it absent — no dashes, no "—", no placeholder. */}
      {sca ? <div className={styles.cardSca}>SCA {sca}</div> : null}
      <h3 className={styles.cardTitle}>{product.title}</h3>
      {subtitle ? <div className={styles.cardSub}>{subtitle}</div> : null}
      {notes.length > 0 ? (
        <div className={styles.notes}>
          {notes.map((note) => (
            <span className={styles.note} key={note}>
              <PathIcon d={noteIcon(note)} size={13} strokeWidth={1.4} />
              {note}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.cardFoot}>
        <div>
          {variants ? <div className={styles.cardVariants}>{variants}</div> : null}
          {price ? (
            <div className={styles.cardPrices}>
              <span className={styles.cardPrice}>{formatMoney(price.amount, price.currency)}</span>
              {price.compareAt ? (
                <span className={styles.cardWas}>
                  {formatMoney(price.compareAt, price.currency)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className={styles.cardCta}>Ver café</span>
      </div>
    </a>
  );
}

export function HomeCoffee({ base, products, reviews, rating, slots }: HomeCoffeeProps) {
  // The hero's bag is the FIRST coffee's own photo — the house blend, which is the order the catalogue is
  // written in. Derived rather than named: a shop that reorders its coffees does not edit this file.
  const heroProduct = products[0];
  const heroMedia = heroProduct ? imagesOf(coverMediaOf(heroProduct))[0] : undefined;
  const heroShot = mediaSrc(heroMedia);

  return (
    <div className={styles.page}>
      {slots.hero}

      <section id="top" className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>Torra semanal · Lotes pequenos</div>
            <h1 className={styles.h1}>
              Cafés que conectam
              <br />
              quem plantou a quem bebe
            </h1>
            <p className={styles.lede}>
              Seis cafés com nome, origem e produtor, torrados toda semana.
            </p>
            <div className={styles.ctas}>
              <a className={styles.ctaPrimary} href="#produtos">
                Ver nossos cafés
              </a>
              <a className={styles.ctaGhost} href="#assinatura">
                Saiba como assinar
              </a>
            </div>
          </div>

          <div className={styles.scrollHint}>
            <span>Role para conhecer</span>
            <ScrollHintIcon />
          </div>

          <div className={styles.band}>
            <div className={`${styles.props} ${styles.propsLeft}`}>
              {CLAIMS.slice(0, 2).map((claim) => (
                <div key={claim.title}>
                  <div className={styles.propHead}>
                    <div className={styles.propTitle}>{claim.title}</div>
                    <Icon name={claim.icon} />
                  </div>
                  <p className={styles.propBody}>{claim.body}</p>
                </div>
              ))}
            </div>

            <div className={styles.heroShot}>
              {heroMedia ? (
                <MediaImage
                  className={styles.heroShotImg}
                  src={heroShot.url}
                  providerKey={heroShot.providerKey}
                  alt={heroMedia.alt ?? heroProduct?.title ?? ''}
                  width={520}
                  sizes="(max-width: 900px) 80vw, 520px"
                  priority
                />
              ) : null}
            </div>

            <div className={styles.props}>
              {CLAIMS.slice(2).map((claim) => (
                <div key={claim.title}>
                  <div className={styles.propHead}>
                    <Icon name={claim.icon} />
                    <div className={styles.propTitle}>{claim.title}</div>
                  </div>
                  <p className={styles.propBody}>{claim.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {slots.bannerStrip}

      <section id="assinatura" className={styles.band2}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>Assinatura Forge</div>
            <h2 className={styles.h2}>
              Café fresco em casa,
              <br />
              em três passos.
            </h2>
            <p className={styles.sectionLede}>
              Sem fidelidade: pause, troque o café ou cancele quando quiser.
            </p>
          </div>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.seal}>
                <span className={styles.sealBig}>10%</span>
                <span className={styles.sealSmall}>de desconto</span>
              </div>
              <div className={styles.stepNumber}>01</div>
              <div className={styles.stepTitle}>Escolha seu café</div>
              <p className={styles.stepBody}>
                Cinco dos nossos cafés entram na assinatura, na moagem do seu método.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>02</div>
              <div className={styles.stepTitle}>Defina a periodicidade</div>
              <p className={styles.stepBody}>
                Semanal, quinzenal ou mensal, em 250g ou 1kg. Ajuste, pule uma entrega ou pause a
                qualquer momento.
              </p>
              <div className={styles.freqPills}>
                <span className={styles.freqPill}>Semanal</span>
                <span className={styles.freqPill}>Quinzenal</span>
                <span className={styles.freqPill}>Mensal</span>
              </div>
            </div>
            <div className={styles.stepDark}>
              <div className={styles.stepNumberAccent}>03</div>
              <div className={styles.stepTitle}>Receba em casa</div>
              <p className={styles.stepBodyOnDark}>
                Torrado na semana do envio e postado em até 24h, com frete grátis em toda assinatura.
              </p>
              <a className={styles.stepCta} href="#produtos">
                Começar assinatura
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="produtos" className={styles.products}>
        <div className={styles.wrap}>
          <div className={styles.productsHead}>
            <div>
              <div className={styles.eyebrow}>Torra desta semana</div>
              <h2 className={styles.h2}>
                Cada saca, um produtor
                <br />e um café perfeito.
              </h2>
            </div>
          </div>
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.product_id} product={product} base={base} />
            ))}
          </div>
        </div>
      </section>

      {slots.belowShelf}

      <section className={styles.trust}>
        <div className={styles.trustRow}>
          {SEALS.map((seal) => (
            <div className={styles.trustItem} key={seal.lines.join(' ')}>
              <Icon name={seal.icon} size={26} />
              <div>
                {seal.lines[0]}
                <br />
                {seal.lines[1]}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ⚠️ THE WALL IS ABSENT, NOT EMPTY, when nothing has been reviewed. A section headed "Quem provou,
       * voltou." over no cards is a shop advertising an absence — and the rating line beside it would be a
       * number nobody gave. A store with no reviews simply does not have this section. */}
      {reviews.length > 0 ? (
        <section className={styles.reviews}>
          <div className={styles.wrap}>
            <div className={styles.reviewsHead}>
              <h2 className={styles.h2}>Quem provou, voltou.</h2>
              {rating ? (
                <div className={styles.rating}>
                  <Dots filled={Math.round(rating.average)} />
                  <span>
                    {rating.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} de{' '}
                    {STAR_MAX} · {rating.count.toLocaleString('pt-BR')}{' '}
                    {rating.count === 1 ? 'avaliação' : 'avaliações'}
                  </span>
                </div>
              ) : null}
            </div>
            <div className={styles.wall}>
              {reviews.map((review) => (
                <div className={styles.review} key={review.id}>
                  {review.stars !== null ? <Dots filled={review.stars} small /> : null}
                  <p className={styles.reviewBody}>{review.body}</p>
                  <div className={styles.reviewWho}>
                    <div className={styles.initials} aria-hidden>
                      {review.initials}
                    </div>
                    <div className={styles.reviewMeta}>
                      {review.author}
                      {review.productTitle ? ` · ${review.productTitle}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {slots.belowCategories}
      {slots.belowBrands}
    </div>
  );
}
