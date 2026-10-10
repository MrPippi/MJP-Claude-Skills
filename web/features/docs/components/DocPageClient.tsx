'use client';

import type { DocPage } from '../api/docs';
import { DocArticle } from './DocArticle';
import { useLanguage } from '@/shared/i18n';

/** Docs sources are authored in Chinese; English mode uses the translation when one exists. */
export function DocPageClient({ page }: { page: DocPage }) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const english = isEn ? page.english : null;
  return (
    <DocArticle
      eyebrow={t.docs.sections[page.section]}
      title={isEn ? page.title.en : page.title.zh}
      description={isEn ? undefined : page.title.en}
      icon={page.icon}
      html={english ? english.html : page.html}
      headings={english ? english.headings : page.headings}
      githubUrl={page.githubUrl}
    />
  );
}
