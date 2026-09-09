// demo-setup — the app's icon, shipped as a BUNDLED MODULE (like the manifest): no asset file reaches the
// runtime, the kernel serves these bytes at /v1/extensions/demo-setup/icon.
//
// ⛔ IT IS A MODULE BECAUSE THIS APP IS COMPOSED, and `demo-gate` is why the rule is written down. A composed
// app's icon is soldered from the package's EXPORTS (`packages/codegen/src/composition.ts`), which never opens
// the manifest to notice a disagreement — so a declared `icon: 'icon.png'` with no `./icon` export 404s and
// the admin's Apps area silently falls back to the name's initial. The bytes below and `icon.png` are the
// same image, and `bin/composition.guard.mjs` compares them.
//
// THE DRAWING IS THIS APP'S SUBJECT: a wordmark bar and the accent dot beside it — `nome` + `.terminação`,
// the shape every mark in this box has, with the dot in the accent the theme repaints. PNG in base64, 128x128
// (the admin's card draws it at 34px and the sheet at 44px, so 128 covers a 3x screen).
export const icon =
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADsklEQVR42u2bvU4bQRSFFwsb2ZaxYfGPIgoIIkQpIktRlCgFQnmDFOlSuEpNCTUPwCPQU6enRaTgEXgEkKLUG51IK1mOg8frmd2d2e9KR0IIY3zO55l7x0MUURRFURRFWa71en3cardPN7u9q63t+GanP3wYjl4kaL7kj3ySX/JN/nkZeqfTvSRse1DIz9LD0Gy2JqKX0NxJ/srnUgXfaGycEHz+IMj3QoNfq9V6WpoIpDjJf+VQyD4fx/17QiheyiHX/kBPNhiMHjG/PFIeuUCgBgTDyyunDaIIw+Tyy8lKwLJf4e1AXSYNn3+NobXpgFHP3xHRyiEPZvqrlQ+LOOHz/8SQkY/RcMK7n1WAmZ+zATp/JgLT4jJHeJdKWP7ZBsy2Ad1Fw7DwpFyNANCFRAwLT8qV8Y9xkAaQRnBBYVa4AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwCgAQACAAAABAAIABAAIABAAIABAmXV89DL59u518v3Dm7/S1/oeAAQe+vnx2+TH10/PSj+TBwwAkJP2d3eTi8/jhcHPSo/RYwHAY70/2Euuv3xcOvxUeqx+BwBUMHzXEACA42XfRvjTENjeDgDAobLs+SY9QZAAnJ+dJT/vbpPfv568kP5W/c3Pdfu2w09lczooHIDDV0deBT8PBL2Gf4A2GPWySr87GAB8Dn8agtnX5Sr8VEEAoCXU9/BTTW8HLpd/29tAoQCE8O6ftwroSNc1AHoO7wEIJfxU6evSub5rAPQcAAAAbAFsATSBNIGMgYyBHARxEMRRMEfBfBjEh0EAwMfBAMCFEADgShgAcCkUALgWDgD8YwgAIABAAIAAAAEAAgAEAAgAEAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAnf7wAbPCk3I1AmBrO77BsPCkXI0A2Oz2rjAsPClXIwBa7fYphoUn5WoEwHq9Psaw8KRcI9OiEaxoA5hWp9O9xLhwpDyXAoBtoMLLP+NgRce/2Wo2WxMM9F/KMcparAIVffen1WhsnGCkv1J+0arFRFCRzv9/tVar9eK4f4+p/kh5KbfIVmmMGAxGj5hbfimnTGMfZwMVnvkZDRn52A5Y9peDgMawPA1fruFPTweMiMWPela7/ayHRZwY5n/CZ+WQx3aDCAjug8+l0Vu1P9DSxKUSe5c55Gch+7wNGHQXTRcSRS9QLA5bPskv+eZl6BRFURRFUVT56w/BdcoStCtdygAAAABJRU5ErkJggg==';
