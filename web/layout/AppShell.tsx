'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { SearchModal } from '@/features/search';
import { LanguageProvider } from '@/shared/i18n';
import type { SearchIndex } from '@/shared/types/skill';
import type { DocLink } from '@/features/docs/registry';

interface AppShellProps {
  children: React.ReactNode;
  searchData: SearchIndex[];
  docLinks: DocLink[];
}

export function AppShell({ children, searchData, docLinks }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-col bg-bg text-fg">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-ink">
          Skip to content
        </a>
        <Header onSearchOpen={openSearch} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <SearchModal isOpen={searchOpen} onClose={closeSearch} searchData={searchData} docLinks={docLinks} />
      </div>
    </LanguageProvider>
  );
}
