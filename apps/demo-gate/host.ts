// DEMO-GATE — "is the browser on THIS face?", asked in one place because it is asked from two.
//
// The hub asks it to decide which card is the way in (`block/hub`), and the count reader asks it to decide
// which shop it already has an id for (`counts`). Two copies of a host comparison is how one of them quietly
// stops matching the other, and this one has a sharp edge worth stating once:
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
