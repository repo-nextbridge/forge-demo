// A3 — the JSON-LD embed must neutralize a `</script>` break-out. Third-party text (review names/text, tenant
// content) flows into the structured-data graph; a plain JSON.stringify would let `</script><script>…` escape
// the tag. We render the component and assert the serialized payload contains no literal `<`/`>`/`&`.

import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { JsonLd } from './JsonLd';

test('JsonLd escapes markup characters so a </script> break-out is inert', () => {
  const html = renderToStaticMarkup(
    <JsonLd
      data={{
        '@type': 'Product',
        name: 'Evil </script><script>alert(document.cookie)</script>',
        review: '<!-- & > <',
      }}
    />,
  );
  // The dangerous sequences never appear literally inside the script — they are \uXXXX-escaped.
  expect(html).not.toContain('</script><script>');
  expect(html).toContain('\\u003c'); // '<' escaped
  expect(html).toContain('\\u003e'); // '>' escaped
  expect(html).toContain('\\u0026'); // '&' escaped
  // Exactly one real closing tag for the ld+json script itself.
  expect(html.match(/<\/script>/g)?.length).toBe(1);
});
