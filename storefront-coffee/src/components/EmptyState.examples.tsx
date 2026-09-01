// Catalog example for the empty-state block (/ui-storefront/empty-state) — the shelf's centered not-blank fallback:
// a heading + muted message, with an optional action slot. Shown without and with an action link. Server-rendered.
import Link from 'next/link';
import { EmptyState } from './EmptyState';

export function EmptyStateExamples() {
  return (
    <div
      style={{
        display: 'grid',
        gap: 32,
        maxWidth: 'var(--size-container)',
        margin: '0 auto',
        padding: 24,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Message only</p>
        <EmptyState
          title="Categoria vazia"
          message="Ainda não há produtos por aqui. Volte em breve."
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>With an action</p>
        <EmptyState
          title="Nenhum produto encontrado"
          message="Nenhum produto corresponde aos filtros selecionados."
          action={<Link href="/search">Ver todos os produtos</Link>}
        />
      </div>
    </div>
  );
}
