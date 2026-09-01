// The 404 of the cacheable tree. It is a near-copy of the dynamic tree's not-found for one structural
// reason: Next renders the not-found boundary as part of a route's STATIC SHELL, so this file's imports are
// as load-bearing as the page's — a single dynamic API here turns every cached page of this tree into a
// runtime 500. It therefore reads nothing: the category chips arrive as a client fragment.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { NotFoundChips } from '@/components/NotFoundChips';
import { NotFoundContent } from '@/components/NotFoundContent';

export default function CachedStoreNotFound() {
  return <NotFoundContent base={HOST_BASE} chips={<NotFoundChips />} />;
}
