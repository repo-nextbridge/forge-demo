// DEMO-GATE — "is the browser on THIS face?", in one place because the answer has a sharp edge and a second
// copy of it is how one copy quietly stops matching the other.
//
// The hub asks it to decide which card is the way in — the face the visitor is standing on is a dismiss form
// and every other is a link to another origin (`block/hub`). The edge:
//
// ⚠️ ANCHORED EQUALITY, NEVER A SUBSTRING. `cafe.forgecommerce.pro` is inside `notcafe.forgecommerce.pro`,
// and this repository has paid for an unanchored host match more than once.
//
// The PORT is dropped on purpose: the declaration carries no port (`seed/box.json` states
// `store.forgecommerce.pro`, the edge adds the scheme and the port), and a cookie ignores the port anyway, so
// a bench on `:8200` and a deployment on `:443` are the same origin to the questions this is asked for. A
// bracketed IPv6 literal keeps its address and an unbracketed one keeps every colon it has, because there is
// no port to strip there and cutting at the last colon would eat a hextet.

/** A `Host`-ish string reduced to its bare hostname, lowercased: scheme, path and port removed. */
export function bareHost(value: string): string {
  const withoutScheme = value.replace(/^\w+:\/\//, '').replace(/\/.*$/, '');
  const host = withoutScheme.startsWith('[')
    ? withoutScheme.slice(1, withoutScheme.indexOf(']'))
    : (withoutScheme.match(/:/g) ?? []).length > 1
      ? withoutScheme
      : withoutScheme.replace(/:\d+$/, '');
  return host.toLowerCase();
}

/** Is `here` the hostname `host` is published at? False whenever either side is missing — an unknown host is
 *  never a match, which is what keeps the hub drawing its own door instead of guessing a face. */
export function sameHost(host: string | null | undefined, here: string | undefined): boolean {
  if (!host || !here) return false;
  return bareHost(here) === host.toLowerCase();
}
