'use client';

import type { DocPage } from '../api/docs';
import { DocArticle } from './DocArticle';
import { useLanguage } from '@/shared/i18n';

/** Docs sources are bilingual in their titles only; the body is rendered as authored. */
export function DocPageClient({ page }: { page: DocPage }) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  return (
    <DocArticle
      eyebrow={t.docs.sections[page.section]}
      title={isEn ? page.title.en : page.title.zh}
      description={isEn ? page.title.zh : page.title.en}
      icon={page.icon}
      html={page.html}
      headings={page.headings}
      githubUrl={page.githubUrl}
    />
  );
}
