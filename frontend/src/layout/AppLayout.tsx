import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/**
 * App shell: fixed sidebar + header + scrollable content on the calm bg canvas.
 * Keep the content area white-dominant; one bold element per screen.
 */
export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-bg text-ink">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((isCollapsed) => !isCollapsed)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
