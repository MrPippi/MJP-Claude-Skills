'use client';

import type { DocPage } from '../api/docs';
import { DocArticle } from './DocArticle';
import { useLanguage } from '@/shared/i18n';

/** Shows the source body when its language matches the UI language, otherwise the translation (if any). */
export function DocPageClient({ page }: { page: DocPage }) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const body = page.translation?.lang === (isEn ? 'en' : 'zh') ? page.translation : page;
  return (
    <DocArticle
      eyebrow={t.docs.sections[page.section]}
      title={isEn ? page.title.en : page.title.zh}
      description={isEn ? undefined : page.title.en}
      icon={page.icon}
      html={body.html}
      headings={body.headings}
      githubUrl={page.githubUrl}
    />
  );
}
