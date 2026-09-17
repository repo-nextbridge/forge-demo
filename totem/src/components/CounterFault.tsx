// ★★★ pk32/d3 — THE COUNTER'S FAULT SCREEN, AND A TILL'S VERSION OF THIS IS NOT A SHOP'S.
//
// ── WHAT WAS MEASURED, 2026-09-10 ─────────────────────────────────────────────────────────────────────────
//
//     find storefront-coffee/src totem/src -name 'error.tsx' -o -name 'global-error.tsx'   → EMPTY
//
// So ANY throw in `app/page.tsx` — and that page reads the menu and the cart on every render, because a till
// may never be cached — put Next's white "Application error: a server-side exception has occurred" on a 1080 ×
// 1920 screen bolted to a wall, in English, 16px, with no way to tap out of it. The counter already knows how
// to speak about a refusal: `Totem.tsx` says "O balcão recebeu muitos pedidos ao mesmo tempo. Tente de novo em
// N segundos." when a TAP is rate limited. What it had never been given is that voice for the RENDER.
//
// ── WHY THE TOTEM'S BODY IS NOT THE VITRINE'S ─────────────────────────────────────────────────────────────
//
// The coffee shop's boundary offers three doors — retry, the shop, the search — because a customer with a phone
// has somewhere else to go. This screen has exactly ONE door, and the difference is the situation: there is no
// browser chrome, no other tab, no address bar, and the person standing here is in a queue. A kiosk that offers
// "Voltar à loja" offers a link to nowhere. So: say what happened, say when to try again if that is knowable,
// give one enormous button, and name the staff as the fallback — which is the counter's established voice for
// "this one is not yours to fix" (`lib/refusal-log.ts` carries the measurement behind that sentence).
//
// ⚠️ THE WAIT SENTENCE IS NOT THIS FILE'S. `ceilingWaitSentence` is the one wording of how long "not now" lasts
// across the product and both forks — reached here by importing the kit itself. A second wording here would be
// two shops. The HEADLINE is the counter's own, and deliberately so.

'use client';

import { ceilingWaitSentence } from '@forgeco/storefront-kit/ceiling-digest';
import styles from './CounterFault.module.css';

export function CounterBusy({
  waitSeconds,
  reset,
}: {
  /** The port's own `Retry-After`, in whole seconds; null when it published none — never a default. */
  waitSeconds: number | null;
  reset: () => void;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.panel} data-testid="busy-boundary">
        <div className={styles.mark}>forge.co</div>
        <div className={styles.title}>O balcão recebeu muitos pedidos ao mesmo tempo</div>
        <div className={styles.note}>
          Nada quebrou e nenhum pedido foi perdido. É só esperar um instante e tocar abaixo.
        </div>
        <div className={styles.wait} data-testid="busy-wait">
          {ceilingWaitSentence(waitSeconds)}
        </div>
        <button type="button" className={styles.retry} onClick={reset} data-testid="busy-retry">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

export function CounterDown({
  digest,
  reset,
}: {
  /** Next's correlation id for the server-side throw — for whoever is called to the counter, never the point. */
  digest?: string;
  reset: () => void;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.panel} data-testid="error-boundary">
        <div className={styles.mark}>forge.co</div>
        <div className={styles.title}>O balcão não conseguiu abrir a tela de pedidos</div>
        <div className={styles.note}>
          Desculpe. Tente de novo no botão abaixo; se continuar assim, peça seu café direto com um
          atendente — ele consegue registrar o pedido no caixa.
        </div>
        <button type="button" className={styles.retry} onClick={reset} data-testid="error-retry">
          Tentar de novo
        </button>
        {digest ? (
          <div className={styles.code} data-testid="error-digest">
            Código: {digest}
          </div>
        ) : null}
      </div>
    </div>
  );
}
