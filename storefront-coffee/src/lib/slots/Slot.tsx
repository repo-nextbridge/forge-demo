// The storefront's <Slot>: the kit's mechanism, this app's registry.
//
// The component itself lives in `@forgeco/storefront-kit/slots/Slot` — it is shared with the checkout
// deployable, and neither of them may name the other's templates. What is app-specific is WHICH manifests
// exist here, and importing `@/templates/registry` from this module is what guarantees the mount side-effect
// has run for every file that renders a slot through this path.
import '@/templates/registry';

export { Slot } from '@forgeco/storefront-kit/slots/Slot';
