// Catalog example for Markdown (/ui-storefront/markdown) — the one safe renderer for tenant-authored markdown
// (rich product sections, category descriptions). It renders markdown AND embedded HTML but SANITIZES the HTML
// (rehype-raw → rehype-sanitize), so the fixture includes a heading, a bold run, a list and a link (all allowed)
// alongside a `<script>` and an inline handler (both stripped) to make the sanitization visible in the gallery.

import { Markdown } from './Markdown';

const SAMPLE = `## Sobre o Speed Elite

O **Speed Elite** foi feito para dias de prova: placa de propulsão, espuma de alto retorno e apenas **232 g** no pé.

- Retorno de energia de até 85%
- Placa em nylon de ponta a ponta
- Cabedal respirável de tramas duplas

Veja o [guia de tamanhos](#tamanhos) antes de comprar.

<script>alert('xss')</script>
<button onclick="alert('nope')">Não deve executar</button>`;

export function MarkdownExamples() {
  return (
    <div style={{ maxWidth: 'var(--size-container)' }}>
      <Markdown>{SAMPLE}</Markdown>
    </div>
  );
}
