// ★★ THE COUNTER'S REFUSALS, SAID OUT LOUD — the one place a port failure becomes a line somebody can read.
//
// ── THE DEFECT THIS FILE EXISTS FOR (A52, 2026-09-02) ────────────────────────────────────────────────────
//
// "não consigo add nenhum sku no totem" → the screen said "Não foi possível concluir. Chame um atendente."
// and the container's whole log was:
//
//     ✓ Ready in 181ms          ← and nothing else, after several "Adicionar" that all failed
//
// `withBag` caught EVERY error, turned it into `{ok:false, kind:'refused'}`, and threw the port's own words
// away. The refusal was handled with elegance on screen and DISAPPEARED for the person who had to fix it —
// so the first two hours of the investigation were spent proving, one by one, things that were never wrong
// (the port accepts; the field is `qty`; the route is `/v1/cart/commands/*`). The port had been answering
// `validation_failed (cart not found)` the entire time.
//
// ★ THE RULE THAT COMES OUT OF IT, and it is the same one A46 produced on the other end of this repository:
// treat "it did not work" as DATA TO RECORD, not only as text to show. A screen that says nothing to the
// customer is a design choice; a process that says nothing to its operator is a defect.
//
// ⚠️ WHAT MAY NOT GO IN A LINE OF THIS LOG. The counter handles a person's name at the till, and the log of a
// kiosk is read over somebody's shoulder. So the context a caller passes is IDS AND COMMAND NAMES ONLY —
// never a buyer's name, address, e-mail or coupon-bearing basket. The signature takes `Record<string, string
// | undefined>` and every call site in `app/actions.ts` passes ids; nothing here reaches into an object to
// find more.

/** The shape `CommandFailed` (the kit's command client) carries. Duck-typed rather than `instanceof`: the
 * class travels inside a tarball dependency, and a log line must never be the thing that fails to resolve. */
type PortError = { code?: unknown; message?: unknown };

function portErrorOf(error: unknown): PortError | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = (error as { error?: unknown }).error;
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  return candidate as PortError;
}

/** The command the kit was posting when it threw, when the error names one. */
function commandNameOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const name = (error as { commandName?: unknown }).commandName;
  return typeof name === 'string' ? name : undefined;
}

/** What the port actually said: `command · code: message` when it answered a structured error, else the
 * thrown thing. This string is the whole point of the file — it is what was missing from the container. */
export function describeRefusal(error: unknown): string {
  const port = portErrorOf(error);
  if (port && typeof port.code === 'string') {
    const command = commandNameOf(error);
    const said = `${port.code}: ${typeof port.message === 'string' ? port.message : '(no message)'}`;
    return command ? `${command} · ${said}` : said;
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * Record one refused write, with the port's own code and message and the ids that locate it.
 *
 * Deliberately `console.error` and deliberately unconditional: this app has no logger, and a refusal that is
 * only visible when somebody remembered to raise a level is the defect above wearing a different hat.
 */
export function logPortRefusal(
  /** The server action that was running, e.g. `addItem`. */
  action: string,
  /** Ids only — see the header. Undefined entries are dropped rather than printed as "undefined". */
  context: Record<string, string | undefined>,
  error: unknown,
): void {
  const where = Object.entries(context)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.error(`[totem] ${action} refused by the port — ${describeRefusal(error)}${where ? ` · ${where}` : ''}`);
}
