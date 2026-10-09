'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GITHUB_REPO_URL } from '@/config/site';
import { ROUTES } from '@/config/routes';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { GitHubIcon, SearchIcon } from '@/shared/ui/icons';
import { useLanguage } from '@/shared/i18n';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onSearchOpen: () => void;
}

type NavKey = 'docs' | 'skills' | 'reference';

function activeNav(pathname: string): NavKey | null {
  if (pathname.startsWith('/docs/skills')) return 'skills';
  if (pathname.startsWith('/docs/reference')) return 'reference';
  if (pathname.startsWith('/docs')) return 'docs';
  return null;
}

export function Header({ onSearchOpen }: HeaderProps) {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const [shortcut, setShortcut] = useState('Ctrl K');

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut('⌘K');
  }, []);

  const links: Array<{ key: NavKey; href: string; label: string }> = [
    { key: 'docs', href: ROUTES.gettingStarted, label: t.nav.docs },
    { key: 'skills', href: ROUTES.skills, label: t.nav.skills },
    { key: 'reference', href: '/docs/reference/packets', label: t.nav.reference },
  ];
  const current = activeNav(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-sm">
          <span className="grid h-8 w-8 place-items-center rounded-[3px] border border-line-strong bg-surface shadow-[0_3px_0_var(--color-line-strong)]">
            <PixelIcon name="pickaxe" className="h-5 w-5" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-lg font-semibold tracking-tight text-fg">MJP</span>
            <span className="hidden text-sm text-fg-3 sm:inline">Claude Skills</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current === link.key ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                current === link.key ? 'bg-surface text-fg font-medium' : 'text-fg-2 hover:text-fg'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSearchOpen}
            aria-label={t.header.searchAriaLabel}
            className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2 sm:w-56 lg:w-64"
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            <span className="hidden flex-1 truncate text-left sm:block">{t.header.searchPlaceholder}</span>
            <kbd className="hidden rounded-[3px] border border-line-strong bg-bg px-1.5 font-pixel text-[10px] text-fg-3 sm:inline">{shortcut}</kbd>
          </button>

          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'zh-TW' : 'en')}
            aria-label={t.header.switchLang}
            title={t.header.switchLang}
            className="icon-btn font-pixel text-[11px]"
          >
            {lang === 'en' ? '中' : 'EN'}
          </button>

          <ThemeToggle />

          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="icon-btn hidden sm:grid">
            <GitHubIcon className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Compact nav row on small screens — no hidden menu needed for three links. */}
      <nav className="flex h-10 items-center gap-1 overflow-x-auto border-t border-line px-3 md:hidden" aria-label="Primary mobile">
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            aria-current={current === link.key ? 'page' : undefined}
            className={`shrink-0 rounded-md px-3 py-1 text-sm ${current === link.key ? 'bg-surface text-fg font-medium' : 'text-fg-2'}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
