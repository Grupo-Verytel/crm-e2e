import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/**
 * App shell: fixed sidebar + header + scrollable content on the calm bg canvas.
 * Keep the content area white-dominant; one bold element per screen.
 */
export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-screen bg-bg text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
