'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSearchIndex, search } from '@/features/search/api/search';
import type { SearchIndex } from '@/shared/types/skill';
import type { DocLink } from '@/features/docs/registry';
import { categoryIconFor } from '@/features/skills/lib/platform';
import { ROUTES } from '@/config/routes';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import type { PixelIconName } from '@/shared/ui/pixel-icons';
import { SearchIcon } from '@/shared/ui/icons';
import { format, useLanguage } from '@/shared/i18n';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchData: SearchIndex[];
  docLinks: DocLink[];
}

interface ResultItem {
  key: string;
  group: 'skills' | 'docs';
  href: string;
  title: string;
  subtitle: string;
  icon: PixelIconName;
}

const MAX_DOC_RESULTS = 5;

export function SearchModal({ isOpen, onClose, searchData, docLinks }: SearchModalProps) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fuse = useMemo(() => createSearchIndex(searchData), [searchData]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelected(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const skills = search(query, fuse).map(({ item }) => ({
      key: `skill-${item.slug}`,
      group: 'skills' as const,
      href: ROUTES.skill(item.slug),
      title: lang === 'en' ? item.title : item.titleZh,
      subtitle: lang === 'en' ? item.description : item.descriptionZh,
      icon: categoryIconFor(item.category),
    }));
    const docs = docLinks
      .filter((d) => `${d.title.en} ${d.title.zh} ${d.slug}`.toLowerCase().includes(q))
      .slice(0, MAX_DOC_RESULTS)
      .map((d) => ({
        key: `doc-${d.href}`,
        group: 'docs' as const,
        href: d.href,
        title: lang === 'en' ? d.title.en : d.title.zh,
        subtitle: t.docs.sections[d.section],
        icon: d.icon,
      }));
    return [...skills, ...docs];
  }, [query, fuse, docLinks, lang, t]);

  const go = useCallback(
    (item: ResultItem | undefined) => {
      if (!item) return;
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      go(results[selected]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onClick={onClose} role="presentation">
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-fg)_25%,transparent)] backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.header.searchAriaLabel}
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line-strong bg-bg shadow-[0_8px_0_var(--color-line-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-fg-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={t.search.placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-3 outline-none"
            aria-label={t.search.placeholder}
          />
          <kbd className="rounded-[3px] border border-line-strong px-1.5 font-pixel text-[10px] text-fg-3">ESC</kbd>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
          {!query.trim() && <p className="py-10 text-center text-sm text-fg-3">{t.search.emptyHint}</p>}
          {query.trim() && results.length === 0 && (
            <p className="py-10 text-center text-sm text-fg-3">{format(t.search.noResults, { query })}</p>
          )}
          {results.map((item, index) => {
            const showGroup = index === 0 || results[index - 1].group !== item.group;
            return (
              <div key={item.key}>
                {showGroup && <p className="eyebrow px-3 pb-1 pt-3">{item.group === 'skills' ? t.search.skillsGroup : t.search.docsGroup}</p>}
                <Link
                  href={item.href}
                  onClick={onClose}
                  onMouseEnter={() => setSelected(index)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${index === selected ? 'bg-surface' : ''}`}
                >
                  <PixelIcon name={item.icon} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{item.title}</span>
                    <span className="block truncate text-xs text-fg-3">{item.subtitle}</span>
                  </span>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-fg-3">
          <span><kbd className="font-pixel">↑↓</kbd> {t.search.navHint}</span>
          <span><kbd className="font-pixel">↵</kbd> {t.search.openHint}</span>
          <span><kbd className="font-pixel">ESC</kbd> {t.search.closeHint}</span>
        </div>
      </div>
    </div>
  );
}
