// Structured data (schema.org) emitted as a JSON-LD <script> in the server HTML — the crawler reads it
// without running JS. The structure emits the base graph (Product / ItemList / BreadcrumbList); content
// enrichment is the green zone (apps).
//
// XSS-SAFE EMBED: this is the ONE sanctioned dangerouslySetInnerHTML in the storefront (structure.test.ts
// allow-lists this file by name). Plain JSON.stringify is NOT safe inside a <script>: a string value can carry
// `</script>` (or `<!--`) and break out of the tag — and JSON-LD data includes third-party text (product /
// category content authored by the tenant, review names/text authored by shoppers via an app). We escape the
// three characters that can start a markup-significant sequence to their \uXXXX form; the JSON stays valid and
// the payload can never terminate the script element.

/** Serialize data for safe embedding in a <script> element: escape `<`, `>` and `&` so no substring can form
 *  `</script>`, `<!--`, or an entity that the HTML parser would act on. The result is still valid JSON. */
function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
  );
}
