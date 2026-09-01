// Markdown — the ONE safe renderer for tenant-authored markdown (RICH product sections, category description).
// It renders markdown AND embedded HTML, but the HTML is SANITIZED, never raw: `rehype-raw` parses the raw HTML
// in the source into the hast tree, then `rehype-sanitize` strips everything outside its allow-list (the
// GitHub-flavored defaultSchema) — so a `<script>`/`onclick`/`javascript:` is removed, while safe tags like
// `<strong>`, `<a>`, `<ul>` render. react-markdown still emits React elements (never dangerouslySetInnerHTML)
// and sanitizes link/image URLs. Runs server-side in the SSR/RSC render (sanitize markdown server-side). The
// plugin ORDER is load-bearing: rehype-raw MUST come before rehype-sanitize (parse raw, then sanitize).

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{children}</ReactMarkdown>;
}
