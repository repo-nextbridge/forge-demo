// Unmount React trees between tests so testing-library queries don't see leftover renders.
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// PRE-S7-STOREFRONT-DEBT — the SECOND clock, and the one that actually flaked. `testTimeout: 15000` (in
// vitest.config.ts, since PR 95) is vitest's budget for a whole case; testing-library keeps its OWN, whose
// default is 1000ms — independent of vitest, and never raised here. THAT is the clock that failed the
// checkout.e2e in the CI of PR 214: `Unable to find [data-testid=shipping-options]`, because the shipping quote
// is an awaited port call and a cold, loaded runner did not answer inside one second. Locally it answers in ~20ms.
//
// So both clocks now carry a real budget. This is a CEILING against a slow runner, not an expectation: nothing
// waits for it when the app is healthy, and no assertion is weakened — an element that is genuinely missing
// still fails the test, it just takes longer to say so. The stake is not this file: a flake reddens main, and
// Deploy Staging only fires on a green main, so one flaky test blocks everyone's deploy.
configure({ asyncUtilTimeout: 15_000 });
