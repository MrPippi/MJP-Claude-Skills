'use client';

import Link from 'next/link';
import type { SkillMeta } from '@/shared/types/skill';
import { categoryIconFor, getPlatform } from '../lib/platform';
import { PlatformBadge } from './PlatformBadge';
import { ROUTES } from '@/config/routes';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { useLanguage } from '@/shared/i18n';

export function SkillCard({ skill }: { skill: SkillMeta }) {
  const { lang } = useLanguage();
  const title = lang === 'en' ? skill.title : skill.titleZh;
  const description = lang === 'en' ? skill.description : skill.descriptionZh;
  const category = lang === 'en' ? skill.categoryLabelEn : skill.categoryLabel;

  return (
    <Link href={ROUTES.skill(skill.slug)} className="card group flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="mc-slot h-11 w-11">
          <PixelIcon name={categoryIconFor(skill.category)} className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-medium text-fg group-hover:text-accent">{title}</h3>
          <p className="truncate font-mono text-xs text-fg-3">{skill.id}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-fg-2">{description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-fg-3">
        <PlatformBadge platform={getPlatform(skill)} />
        <span className="truncate">{category}</span>
        <span className="ml-auto font-pixel text-[10px]">v{String(skill.version)}</span>
      </div>
    </Link>
  );
}
