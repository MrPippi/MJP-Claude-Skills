'use client';

import Link from 'next/link';
import type { DocLink, DocSection } from '../registry';
import { DocArticle } from './DocArticle';
import { ROUTES } from '@/config/routes';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import type { PixelIconName } from '@/shared/ui/pixel-icons';
import { format, useLanguage } from '@/shared/i18n';
import { revealDelay } from '@/shared/motion/reveal';

interface DocsIndexProps {
  docLinks: DocLink[];
  skillCount: number;
}

type CardKey = 'start' | DocSection | 'skills';

const CARD_ORDER: Array<{ key: CardKey; icon: PixelIconName }> = [
  { key: 'start', icon: 'grass' },
  { key: 'platforms', icon: 'command' },
  { key: 'concepts', icon: 'redstone' },
  { key: 'skills', icon: 'chest' },
  { key: 'reference', icon: 'book' },
];

export function DocsIndex({ docLinks, skillCount }: DocsIndexProps) {
  const { t, lang } = useLanguage();

  const linksFor = (key: CardKey): Array<{ href: string; label: string }> => {
    if (key === 'start') return [{ href: ROUTES.gettingStarted, label: t.nav.gettingStarted }];
    if (key === 'skills') return [{ href: ROUTES.skills, label: `${t.skills.pageTitle} (${skillCount})` }];
    return docLinks.filter((d) => d.section === key).map((d) => ({ href: d.href, label: lang === 'en' ? d.title.en : d.title.zh }));
  };

  return (
    <DocArticle eyebrow={t.docs.overviewLabel} title={t.docs.overviewTitle} icon="sign" description={t.docs.overviewDescription}>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARD_ORDER.map(({ key, icon }, i) => {
          const links = linksFor(key);
          return (
            <section key={key} data-reveal style={revealDelay(i)} className="card p-5">
              <div className="flex items-center gap-3">
                <PixelIcon name={icon} className="h-8 w-8" />
                <h2 className="font-display text-lg font-semibold text-fg">{t.docs.sections[key]}</h2>
                {links.length > 1 && <span className="ml-auto font-pixel text-[12px] text-fg-3">{format(t.docs.pagesCount, { count: links.length })}</span>}
              </div>
              <p className="mt-2 text-sm text-fg-2">{t.docs.sectionDescriptions[key]}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-accent hover:underline">
                      {link.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </DocArticle>
  );
}
