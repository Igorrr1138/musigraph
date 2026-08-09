import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Header } from '@/components/layout/Header';
import { Sheet, SheetContent } from '@/components/ui/sheet';

/**
 * Global frame: sticky 264px sidebar, sticky header, and page content.
 * The playback bar is rendered globally in App and stays fixed to the bottom.
 */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-ink lg:block">
        <AppSidebar />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[264px] border-r border-ink bg-background p-0">
          <AppSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="min-w-0 flex-1 pb-32">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
