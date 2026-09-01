// Empty-state — centered, no fill/border: heading + muted text (+ optional action). The shelf's
// not-blank fallback for an empty category. Server-rendered.
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty} data-testid="empty-state">
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
