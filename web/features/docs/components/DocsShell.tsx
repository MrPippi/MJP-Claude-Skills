'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DocsSidebar } from './DocsSidebar';
import { flattenNav, type NavGroup, type NavItem } from '../lib/nav';
import { MenuIcon, CloseIcon } from '@/shared/ui/icons';
import { useLanguage } from '@/shared/i18n';

const FlatNavContext = createContext<NavItem[]>([]);

export function useFlatNav(): NavItem[] {
  return useContext(FlatNavContext);
}

interface DocsShellProps {
  nav: NavGroup[];
  children: React.ReactNode;
}

export function DocsShell({ nav, children }: DocsShellProps) {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const flat = useMemo(() => flattenNav(nav), [nav]);
  const current = flat.find((i) => i.href === pathname.replace(/\/+$/, ''));

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <FlatNavContext.Provider value={flat}>
      <div className="mx-auto max-w-[90rem] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-line px-4 py-6 lg:block">
          <DocsSidebar nav={nav} />
        </aside>

        <div className="sticky top-[calc(6rem+1px)] z-30 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:top-14 lg:hidden">
          <button type="button" onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 text-sm text-fg-2" aria-expanded={drawerOpen}>
            <MenuIcon className="h-4 w-4" />
            {t.docs.menu}
          </button>
          {current && <span className="truncate text-sm text-fg-3">/ {lang === 'en' ? current.label.en : current.label.zh}</span>}
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.docs.menu}>
            <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-fg)_30%,transparent)]" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto border-r border-line bg-bg px-4 py-4">
              <button type="button" onClick={() => setDrawerOpen(false)} className="icon-btn mb-2 ml-auto" aria-label={t.docs.closeMenu}>
                <CloseIcon className="h-4 w-4" />
              </button>
              <DocsSidebar nav={nav} />
            </div>
          </div>
        )}

        <div className="min-w-0">{children}</div>
      </div>
    </FlatNavContext.Provider>
  );
}
