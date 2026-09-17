// THE COFFEE PAGE, as the approved design draws it.
//
// ── ★ THE FOUR-PHOTO CONVENTION IS BY POSITION, WHICH MEANS IT IS BY COUNT TOO ───────────────────────────
// The design shows four photographs: the bag (transparent, the buy box's own), then a wide shot of the roast
// and two squares. The convention is POSITION — media[0] is the bag, media[1..] are the story — and a
// convention of position has to survive one, two, three or four. This shop's catalogue ships ONE photo per
// coffee today, so:
//
//   · with one photo the page shows the bag, clean, and the story grid is ABSENT — no empty frames, no
//     hatched placeholders, no "foto em breve";
//   · with four it is the artboard, and nobody edits this file to get there.
//
// That is why the missing photographs are a CONTENT decision the merchant can take whenever they like, at
// zero code cost, instead of a slice that has to come back. The gap is real and named in the report; what is
// not real is the idea that the page needs them.
//
// ── WHAT IS DATA AND WHAT IS COPY ────────────────────────────────────────────────────────────────────────
// "Quem plantou" and the blurb are the PRODUCT'S OWN description and rich sections — the merchant writes
// them. "Características" is the `cf.*` vocabulary the port serves, labelled by this shop (the anonymous
// face publishes values, never declarations). The seals and the perks are copy this shop owns.

import { MediaImage } from '@forgeco/storefront-kit/MediaImage';
import { imagesOf, mediaSrc } from '@forgeco/storefront-kit/media/src';
import type { MediaRef, ProductDoc } from '@forgeco/storefront-kit/read-client';
import type { ReactNode } from 'react';
import { Icon, noteIcon, PathIcon } from '@/components/coffee/icons';
import { FACT_PATHS, SEAL_PATHS } from '@/components/coffee/icons';
import { field, notesOf, specsOf } from '@/lib/coffee/product-view';
import type { WallReview } from '@/lib/coffee/reviews-view';
import { STAR_MAX } from '@/lib/coffee/reviews-view';
import { CoffeeBuyBox } from './CoffeeBuyBox';
import styles from './coffee.module.css';

const SEALS = [
  { d: SEAL_PATHS.directTrade, label: 'Compra direta do produtor' },
  { d: SEAL_PATHS.weeklyRoast, label: 'Torra da semana' },
  { d: SEAL_PATHS.valve, label: 'Embalagem com válvula' },
  { d: SEAL_PATHS.guarantee, label: 'Garantia no 1º pacote' },
] as const;

export type PdpCoffeeProps = {
  product: ProductDoc;
  reviews: WallReview[];
  rating: { average: number; count: number } | null;
  addLine: (skuIds: string[], qty: number, customFields: Record<string, string>) => Promise<void>;
  slots?: ReactNode;
};

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

function Shot({ media, className, alt }: { media: MediaRef; className: string; alt: string }) {
  const src = mediaSrc(media);
  return (
    <div className={className}>
      <MediaImage src={src.url} providerKey={src.providerKey} alt={media.alt ?? alt} fill sizes="50vw" />
    </div>
  );
}

export function PdpCoffee({ product, reviews, rating, addLine, slots }: PdpCoffeeProps) {
  const photos = imagesOf(product.media ?? []);
  const [cover, ...story] = photos;
  const coverSrc = mediaSrc(cover);
  const notes = notesOf(product);
  const specs = specsOf(product);

  // The facts beside the bag: each one drawn only when its own field is there. `torra` and `sca` are the two
  // this catalogue actually fills; the shipping promise is this shop's copy and always true.
  const roast = field(product, 'torra');
  const sca = field(product, 'sca');
  const lot = field(product, 'lote');

  // The rich sections the merchant wrote. RICH is optional on the wire (a doc projected before it lacks the
  // key), so it is defaulted here and never `.map`ped directly — the rule the read client states.
  const sections = product.content_sections ?? [];

  return (
    <div className={styles.page}>
      <section className={styles.top}>
        <div className={styles.wrap}>
          <div className={styles.split}>
            <div className={styles.shotSide}>
              <div className={styles.aside}>
                {notes.map((note) => (
                  <span className={styles.note} key={note}>
                    <span className={styles.noteDisc}>
                      <PathIcon d={noteIcon(note)} size={17} strokeWidth={1.4} />
                    </span>
                    {note}
                  </span>
                ))}
                {(sca || roast || lot) && (
                  <div className={styles.facts}>
                    {sca ? (
                      <div className={styles.fact}>
                        <PathIcon d={FACT_PATHS.sca} size={16} strokeWidth={1.3} />
                        <span>Pontuação SCA {sca}</span>
                      </div>
                    ) : null}
                    {roast ? (
                      <div className={styles.fact}>
                        <PathIcon d={FACT_PATHS.roast} size={16} strokeWidth={1.3} />
                        <span>Torra {roast}</span>
                      </div>
                    ) : null}
                    {lot ? (
                      <div className={styles.fact}>
                        <PathIcon d={FACT_PATHS.lot} size={16} strokeWidth={1.3} />
                        <span>{lot}</span>
                      </div>
                    ) : null}
                    <div className={styles.fact}>
                      <PathIcon d={FACT_PATHS.shipping} size={16} strokeWidth={1.3} />
                      <span>Envio em até 24h</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.shot}>
                {cover ? (
                  <MediaImage
                    className={styles.shotImg}
                    src={coverSrc.url}
                    providerKey={coverSrc.providerKey}
                    alt={cover.alt ?? product.title}
                    // ★ THE SAME NUMBER AS `.shot`'s `max-width` IN `coffee.module.css`, and it has to be:
                    // this pair is what a responsive srcset is chosen against, so a CSS box that grew past
                    // them makes the browser take the smaller file and scale it up. Guarded, because the
                    // symptom (a soft photo) and the cause (a stylesheet) sit in different files.
                    width={400}
                    sizes="(max-width: 900px) 70vw, 400px"
                    priority
                  />
                ) : null}
              </div>
            </div>

            <div className={styles.panel}>
              {field(product, 'subtitle') ? (
                <div className={styles.kicker}>{field(product, 'subtitle')}</div>
              ) : null}
              <h1 className={styles.title}>{product.title}</h1>
              {specs.length > 0 ? (
                <div className={styles.sub}>
                  {[field(product, 'regiao'), field(product, 'processo'), roast]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              ) : null}
              <div className={styles.rule} />
              {product.description ? <p className={styles.blurb}>{product.description}</p> : null}
              <CoffeeBuyBox product={product} addLine={addLine} />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.rich}>
        <div className={styles.richGrid}>
          {/* ★ ABSENT, not empty: with no story photos there is no grid and no frame. */}
          {story.length > 0 ? (
            <div className={styles.gallery}>
              {story.map((media, i) => (
                <Shot
                  key={media.provider_key}
                  media={media}
                  alt={product.title}
                  className={i === 0 ? styles.galleryWide : styles.gallerySquare}
                />
              ))}
            </div>
          ) : null}

          <div>
            <div className={styles.seals}>
              {SEALS.map((seal) => (
                <div className={styles.seal} key={seal.label}>
                  <PathIcon d={seal.d} size={22} />
                  <span>{seal.label}</span>
                </div>
              ))}
            </div>

            {specs.length > 0 ? (
              <div className={styles.card} style={{ marginTop: 20 }}>
                <h2 className={styles.cardTitle}>Características</h2>
                {specs.map((spec) => (
                  <div className={styles.spec} key={spec.key}>
                    <span className={styles.specKey}>{spec.label}</span>
                    <span className={styles.specValue}>{spec.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {sections.length > 0 ? (
              <div className={`${styles.card} ${styles.story}`} style={{ marginTop: 20 }}>
                <h2 className={styles.cardTitle}>{sections[0]?.title ?? 'Quem plantou'}</h2>
                {sections.map((section) => (
                  <p key={section.title}>{section.body}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {slots}

      {reviews.length > 0 ? (
        <section className={styles.reviews}>
          <div className={styles.wrap}>
            <div className={styles.reviewsHead}>
              <h2 className={styles.h2}>O que dizem do {product.title}</h2>
              {rating ? (
                <div className={styles.rating}>
                  <Dots filled={Math.round(rating.average)} />
                  <span>
                    {rating.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ·{' '}
                    {rating.count.toLocaleString('pt-BR')}{' '}
                    {rating.count === 1 ? 'avaliação deste café' : 'avaliações deste café'}
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
                    {/* ⚠️ THE ARTBOARD PRINTS A BREWING METHOD HERE ("V60", "Prensa francesa") AND THE APP'S
                     * MODEL HAS NO SUCH FIELD — it is not missing from the read, it is absent from the model.
                     * Nothing is invented: what is shown instead is `origin`, which the app DERIVES (it reads
                     * the verified column together with the order it was checked against). A trust mark, which
                     * is what the design wanted the line for. */}
                    <div className={styles.reviewMeta}>
                      {review.author}
                      {review.verified ? ' · Compra verificada' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
