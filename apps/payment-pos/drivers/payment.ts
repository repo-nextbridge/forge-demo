// MURO-3 — the packaging entry point for this app's payment driver: what the loader imports when the app
// travels as a directory. The implementation stays in `provider.ts`, which is also what the compiled path
// imports (`forge.wiring.drivers.payment` in package.json) — one implementation, two ways of travelling.

export { provider as default } from '../provider';
