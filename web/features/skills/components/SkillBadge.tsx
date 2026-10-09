'use client';

import type { SkillStatus } from '@/shared/types/skill';
import { useLanguage } from '@/shared/i18n';

export function SkillBadge({ status }: { status: SkillStatus }) {
  const { t } = useLanguage();
  const tone = status === 'active' ? 'text-api border-api/40' : 'text-nms border-nms/40';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-pixel text-[10px] uppercase ${tone}`}>
      <span className="h-1.5 w-1.5 bg-current" aria-hidden />
      {t.status[status]}
    </span>
  );
}
