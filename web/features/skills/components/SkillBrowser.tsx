'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Category, SkillMeta } from '@/shared/types/skill';
import { getPlatform, isPlatformId, PLATFORMS, type PlatformId } from '../lib/platform';
import { SkillGrid } from './SkillGrid';
import { DocArticle } from '@/features/docs/components/DocArticle';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { SearchIcon } from '@/shared/ui/icons';
import { format, useLanguage } from '@/shared/i18n';

interface SkillBrowserProps {
  skills: SkillMeta[];
  categories: Category[];
}

function matchesText(skill: SkillMeta, q: string): boolean {
  if (!q) return true;
  const haystack = [skill.id, skill.title, skill.titleZh, skill.description, skill.descriptionZh, ...skill.tags].join(' ').toLowerCase();
  return haystack.includes(q);
}

function chipClass(active: boolean): string {
  return `inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-xs transition-colors ${
    active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-bg text-fg-2 hover:border-line-strong hover:text-fg'
  }`;
}

interface Filter {
  platform: PlatformId | null;
  category: string | null;
}

const NO_FILTER: Filter = { platform: null, category: null };

function readFilter(categories: Category[]): Filter {
  const params = new URLSearchParams(window.location.search);
  const platform = params.get('platform');
  const category = params.get('category');
  return {
    platform: isPlatformId(platform) ? platform : null,
    category: categories.some((c) => c.id === category) ? category : null,
  };
}

/**
 * Filters live in the query string but are read from window.location after mount, so the
 * static export prerenders the full, unfiltered list (no useSearchParams Suspense bail-out).
 */
export function SkillBrowser({ skills, categories }: SkillBrowserProps) {
  const { t, lang } = useLanguage();
  const [{ platform, category }, setFilterState] = useState<Filter>(NO_FILTER);
  const [text, setText] = useState('');

  useEffect(() => {
    const sync = () => setFilterState(readFilter(categories));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [categories]);

  const setFilter = (next: Partial<Filter>) => {
    const merged: Filter = { platform, category, ...next };
    const query = new URLSearchParams();
    if (merged.platform) query.set('platform', merged.platform);
    if (merged.category) query.set('category', merged.category);
    const qs = query.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    setFilterState(merged);
  };

  const visibleCategories = useMemo(
    () => categories.filter((c) => !platform || getPlatform({ category: c.id, githubPath: '' }) === platform),
    [categories, platform],
  );

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return skills.filter(
      (s) => (!platform || getPlatform(s) === platform) && (!category || s.category === category) && matchesText(s, q),
    );
  }, [skills, platform, category, text]);

  const hasFilters = Boolean(platform || category || text);

  return (
    <DocArticle eyebrow={t.docs.sections.skills} title={t.skills.pageTitle} icon="chest" description={format(t.skills.pageSubtitle, { count: skills.length })}>
      <div className="mb-6 space-y-4 rounded-md border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 text-fg-3">{t.skills.filterPlatform}</span>
          <button type="button" aria-pressed={!platform} className={chipClass(!platform)} onClick={() => setFilter({ platform: null, category: null })}>
            {t.skills.filterAll}
          </button>
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" aria-pressed={platform === p.id} className={chipClass(platform === p.id)} onClick={() => setFilter({ platform: p.id, category: null })}>
              <PixelIcon name={p.icon} className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 text-fg-3">{t.skills.filterCategory}</span>
          {visibleCategories.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} className={chipClass(category === c.id)} onClick={() => setFilter({ category: category === c.id ? null : c.id })}>
              {lang === 'en' ? c.labelEn : c.label}
              <span className="font-pixel text-[10px] opacity-70">{c.count}</span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 rounded-[3px] border border-line bg-bg px-3 py-2">
          <SearchIcon className="h-4 w-4 text-fg-3" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.skills.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
          />
        </label>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-fg-3">
        <span>{format(t.skills.resultCount, { count: filtered.length })}</span>
        {hasFilters && (
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => {
              setText('');
              setFilter({ platform: null, category: null });
            }}
          >
            {t.skills.clearFilters}
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <SkillGrid skills={filtered} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-line-strong py-16 text-sm text-fg-3">
          <PixelIcon name="creeper" className="h-10 w-10" />
          {t.skills.emptyState}
        </div>
      )}
    </DocArticle>
  );
}
