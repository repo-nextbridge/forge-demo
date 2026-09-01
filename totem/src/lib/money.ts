// Money on the counter's screen. The kernel speaks CENTS; the prototype's labels are `R$ 12,00`.
//
// ⚠️ EVERY NUMBER THAT REACHES THIS FILE CAME FROM THE KERNEL. Nothing here adds, discounts or totals — the
// totem renders the port's arithmetic and never its own. That is not style: the coupon has to take exactly
// 10%, the same coffee has to cost the same as it does in the online shop, and both are only true if one
// engine computes them. See `src/lib/cart.ts`.

/** `1290` → `R$ 12,90`. BRL is the only currency this counter takes; the parameter keeps that visible. */
export function money(cents: number, currency = 'BRL'): string {
  const symbol = currency === 'BRL' ? 'R$' : currency;
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(cents);
  return `${sign}${symbol} ${(abs / 100).toFixed(2).replace('.', ',')}`;
}
