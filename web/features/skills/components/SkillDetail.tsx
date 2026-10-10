'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { SkillFull } from '@/shared/types/skill';
import { SkillBadge } from './SkillBadge';
import { PlatformBadge } from './PlatformBadge';
import { categoryIconFor, getPlatform, PLATFORMS } from '../lib/platform';
import { translateHeadingsHtml, translateHeadingText } from '../lib/heading-translations';
import { DocArticle } from '@/features/docs/components/DocArticle';
import { docHref } from '@/features/docs/registry';
import { ROUTES } from '@/config/routes';
import { GITHUB_REPO_URL } from '@/config/site';
import { formatDate } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/i18n';

const CJK = /[㐀-鿿]/;

export function SkillDetail({ skill }: { skill: SkillFull }) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const platform = getPlatform(skill);
  const platformInfo = PLATFORMS.find((p) => p.id === platform);
  const english = isEn ? skill.english : null;
  const html = useMemo(() => {
    if (!isEn) return skill.contentHtml;
    return english ? english.contentHtml : translateHeadingsHtml(skill.contentHtml);
  }, [isEn, english, skill.contentHtml]);
  const triggerKeywords = isEn ? skill.triggerKeywords.filter((kw) => !CJK.test(kw)) : skill.triggerKeywords;
  const githubUrl = skill.githubPath ? `${GITHUB_REPO_URL}/blob/main/${skill.githubPath}` : GITHUB_REPO_URL;

  const meta = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
        <PlatformBadge platform={platform} />
        <SkillBadge status={skill.status} />
        <span className="rounded-[3px] border border-line px-1.5 py-0.5 font-pixel text-[12px]">v{String(skill.version)}</span>
        <code className="font-mono text-fg-3">{skill.id}</code>
        {skill.updatedAt && (
          <span className="ml-auto">
            {t.skillDetail.updatedAt} {formatDate(String(skill.updatedAt), isEn ? 'en-US' : 'zh-TW')}
          </span>
        )}
      </div>

      {triggerKeywords.length > 0 && (
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="eyebrow mb-2 text-fg-3">{t.skillDetail.triggers}</p>
          <div className="flex flex-wrap gap-1.5">
            {triggerKeywords.map((kw) => (
              <code key={kw} className="rounded-[3px] border border-line bg-bg px-1.5 py-0.5 font-mono text-xs text-fg-2">
                {kw}
              </code>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {platformInfo && (
          <Link href={docHref('platforms', platformInfo.docSlug)} className="text-accent hover:underline">
            {t.skillDetail.platformDoc} →
          </Link>
        )}
        <Link href={ROUTES.skillsFiltered({ category: skill.category })} className="text-fg-2 hover:text-accent">
          {isEn ? skill.categoryLabelEn : skill.categoryLabel} →
        </Link>
      </div>
    </div>
  );

  return (
    <DocArticle
      eyebrow={`${platformInfo?.label ?? ''} · ${isEn ? skill.categoryLabelEn : skill.categoryLabel}`}
      title={isEn ? skill.title : skill.titleZh}
      icon={categoryIconFor(skill.category)}
      description={isEn ? skill.description : skill.descriptionZh}
      meta={meta}
      html={html}
      headings={english ? english.headings : skill.headings}
      tocLabel={isEn && !english ? translateHeadingText : undefined}
      githubUrl={githubUrl}
    />
  );
}
