'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Toc } from './Toc';
import { useFlatNav } from './DocsShell';
import { getPrevNext } from '../lib/nav';
import type { Heading } from '@/shared/markdown/render';
import { useCopyButtons } from '@/shared/ui/CopyCodeEnhancer';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import type { PixelIconName } from '@/shared/ui/pixel-icons';
import { GitHubIcon } from '@/shared/ui/icons';
import { useLanguage } from '@/shared/i18n';

interface DocArticleProps {
  eyebrow: string;
  title: string;
  icon?: PixelIconName;
  description?: string;
  /** Extra header content (badges, meta) rendered under the title. */
  meta?: React.ReactNode;
  html?: string;
  headings?: Heading[];
  tocLabel?: (text: string) => string;
  githubUrl?: string;
  children?: React.ReactNode;
}

export function DocArticle({ eyebrow, title, icon, description, meta, html, headings = [], tocLabel, githubUrl, children }: DocArticleProps) {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const [prev, next] = getPrevNext(useFlatNav(), pathname);
  const proseRef = useRef<HTMLDivElement>(null);
  useCopyButtons(proseRef, [html]);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-10">
      <article className="min-w-0 px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-2 flex items-center gap-3 font-serif text-3xl font-semibold leading-tight text-fg sm:text-4xl">
              {icon && <PixelIcon name={icon} className="h-8 w-8 shrink-0" />}
              {title}
            </h1>
            {description && <p className="mt-3 text-base leading-relaxed text-fg-2">{description}</p>}
            {meta && <div className="mt-4">{meta}</div>}
          </header>

          {children}
          {html && <div ref={proseRef} className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />}

          <footer className="mt-12 space-y-6">
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-fg-3 hover:text-accent">
                <GitHubIcon className="h-4 w-4" />
                {t.docs.editOnGithub}
              </a>
            )}
            {(prev || next) && (
              <div className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
                {prev ? (
                  <Link href={prev.href} className="card p-4">
                    <span className="font-pixel text-[10px] text-fg-3">← {t.docs.previous}</span>
                    <span className="mt-1 block truncate text-sm font-medium text-fg">{lang === 'en' ? prev.label.en : prev.label.zh}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link href={next.href} className="card p-4 text-right">
                    <span className="font-pixel text-[10px] text-fg-3">{t.docs.next} →</span>
                    <span className="mt-1 block truncate text-sm font-medium text-fg">{lang === 'en' ? next.label.en : next.label.zh}</span>
                  </Link>
                )}
              </div>
            )}
          </footer>
        </div>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-10 pr-6">
          <Toc headings={headings} labelFor={tocLabel} />
        </div>
      </aside>
    </div>
  );
}
