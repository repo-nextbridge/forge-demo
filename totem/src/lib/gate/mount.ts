// IS A GATE IN FRONT OF THIS COUNTER RIGHT NOW? — the data half of the slot.
//
// The kit owns the MACHINERY (the dismissal cookie's name, the two Server Actions) and this app owns the
// DECISION, because this app owns its layout. The question is asked of the port, not of a config file: an
// app filling `storefront:gate` for this store is a fact the kernel publishes, so installing or uninstalling
// the gate changes the counter with no rebuild.
//
// ⚠️ THE COOKIE IS ONLY READ WHEN A GATE IS ACTUALLY GOING TO RENDER. That ordering is the kit's, kept
// deliberately: reading cookies is what makes a route dynamic, and a counter with no gate installed should
// not pay for one. Here it costs little (every totem screen is dynamic anyway), but copying the shape keeps
// this file readable next to the two upstream layouts that do the same thing.

import { GATE_DISMISSED_COOKIE } from '@forgecommerce/storefront-kit/cookies';
import { cookies } from 'next/headers';
import { totemRead } from '../port';
import { resolveTotemStore } from '../store';
import { type GateImplementation, resolveGate } from './registry';

/** The slot a gate fills. Same constant the kit's layouts and its edge directory use. */
export const GATE_TARGET = 'storefront:gate';

export type GateState =
  | { show: 'nothing' }
  | { show: 'interstitial'; gate: GateImplementation; store: string }
  | { show: 'ribbon'; gate: GateImplementation; store: string };

/**
 * What the counter's host must render around the flow.
 *
 * Degrades exactly like the kit's layout, in the same three steps: no app filling the slot → nothing; an app
 * filling it that this build has no implementation for → nothing (never a blank screen); otherwise the
 * dismissal cookie decides between the full-screen interstitial and the ribbon under the flow.
 *
 * ⚠️ A PORT THAT CANNOT ANSWER MEANS "NO GATE", NOT "BLOCK THE COUNTER". `read.extensions` returning null is
 * a store the public face cannot resolve yet (see `menu.ts` for the eventual-consistency measurement) or a
 * blip. Failing towards the gate would put a demo interstitial in front of a working till.
 */
export async function gateState(): Promise<GateState> {
  // ⚠️ AND A PORT THAT IS NOT THERE AT ALL IS THE SAME ANSWER — including at BUILD TIME, which is where this
  // was measured. `next build` prerenders `/_not-found`, that page renders this layout, and `bin/build-totem.sh`
  // runs on a machine with no kernel: the fetch threw `TypeError: fetch failed` and the whole build died on a
  // 404 page. An image that can only be built next to a running kernel is not an image, it is a deployment.
  let installed: Awaited<ReturnType<ReturnType<typeof totemRead>['extensions']>> = null;
  try {
    const store = resolveTotemStore();
    installed = await totemRead().extensions(store.id);
  } catch {
    return { show: 'nothing' };
  }
  const store = resolveTotemStore();
  const filling = installed?.find((ext) => ext.hooks.some((h) => h.target === GATE_TARGET));
  if (!filling) return { show: 'nothing' };

  const gate = resolveGate(filling.extension_id);
  if (!gate) return { show: 'nothing' };

  const dismissed = (await cookies()).get(GATE_DISMISSED_COOKIE)?.value === '1';
  return dismissed
    ? { show: 'ribbon', gate, store: store.id }
    : { show: 'interstitial', gate, store: store.id };
}
