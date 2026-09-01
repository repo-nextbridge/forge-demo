// ★★ THE PERMANENT NEGATIVE CONTROLS FOR `src/hydration.guard.test.tsx` (this app's copy; the admin keeps
// its own at `apps/admin/test-support/hydration-specimens.tsx` — two apps, no shared import between them,
// so the specimens are stated twice on purpose). They live in the tree, not inside the
// test, and they are the reason the guard can be trusted: a guard nobody has ever seen FAIL is a guard nobody
// knows is wired. Each specimen carries one of the two defects Q3-HYDRATION measured on staging, in its
// smallest honest form; the guard asserts it catches every one of them.
//
// ⚠️ THESE ARE NOT DEAD CODE AND MUST NOT BE "FIXED". Making them deterministic or making the markup valid
// would leave the guard green and blind — the failure they produce IS their purpose. Nothing renders them but
// the guard: they are not in the catalog registry, no page imports them.//
// ★★ WHY THIS FILE LIVES OUTSIDE `src/`, AND IT IS NOT TO DODGE ANYTHING. Two ratchets read the app's SOURCE
// and forbid, on purpose, exactly what a specimen here has to CONTAIN: `scripts/i18n/datetime.guard.test.ts`
// ("only lib/datetime.ts constructs an Intl.DateTimeFormat") and the anti-literal ratchet. Both are right, and
// so is the specimen — the collision is that a control must hold the defect the rule forbids.
//
// The resolution is neither an exception list nor a formatter smuggled past the scan: it is that the premise
// of both rules — "code that RENDERS FOR A USER does not decide its own clock, and does not hardcode copy" —
// is simply not about this file. Nothing renders it but the guard; no page, no bundle. So it sits beside
// `src/`, not inside it, and both rules stay true with no amendment and no name on any list. `tsc` still
// checks it (the guard imports it, and the compiler follows the graph), so it cannot rot.

/** DEFECT 1 — THE AMBIENT CLOCK. The reviews block printed the date with no `timeZone`, so the container (UTC)
 * and the shopper's browser disagreed about the day and React threw the tree away (#418). The instant is
 * pinned 29 minutes past midnight UTC: the seam where UTC and America/Sao_Paulo name different days. */
export function AmbientClockSpecimen() {
  const at = new Date('2026-07-30T00:29:52.832Z');
  return (
    <p>
      {new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        at,
      )}
    </p>
  );
}

/** DEFECT 2 — THE FORM THE PARSER THROWS AWAY. The simulator wrapped a picker that draws its own form. The
 * HTML5 tree builder ignores an inner `<form>` start tag outright, so the browser builds one form where React
 * rendered two, and hydration finds a tree that is not the one it sent. */
export function NestedFormSpecimen() {
  return (
    <form method="get" action="/outer">
      <input name="outer" defaultValue="" />
      <div>
        <form method="get" action="/inner">
          <input name="inner" defaultValue="" />
          <button type="submit">Usar</button>
        </form>
      </div>
    </form>
  );
}

/** THE POSITIVE CONTROL — the same two shapes, done right: the zone is named, and the forms are siblings.
 * It proves the guard's verdict tracks the DEFECT and not merely "this specimen file". A guard that fails
 * everything is as useless as one that passes everything. */
export function CleanSpecimen() {
  const at = new Date('2026-07-30T00:29:52.832Z');
  return (
    <div>
      <p>
        {new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(at)}
      </p>
      <form method="get" action="/outer">
        <input name="outer" defaultValue="" />
      </form>
      <form method="get" action="/inner">
        <input name="inner" defaultValue="" />
        <button type="submit">Usar</button>
      </form>
    </div>
  );
}
