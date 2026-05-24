import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  badge?: ReactNode;
  badgeTone?: 'ok' | 'wait' | 'closed';
  children?: ReactNode;
};

export default function PageHeader({ title, badge, badgeTone = 'wait', children }: PageHeaderProps) {
  return (
    <header className="card page-header">
      {badge && <span className={`badge ${badgeTone}`}>{badge}</span>}
      <h1 className="page-title gradient-text">{title}</h1>
      {children}
    </header>
  );
}
