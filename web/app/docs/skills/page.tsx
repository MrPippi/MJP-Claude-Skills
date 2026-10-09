import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllSkills, getCategories, SkillBrowser } from '@/features/skills';

export const metadata: Metadata = {
  title: '所有 Skills',
  description: '依平台（NMS / Paper API）與分類瀏覽全部 MJP Claude Skills。',
};

export default function SkillsPage() {
  // useSearchParams needs a Suspense boundary under static export.
  return (
    <Suspense>
      <SkillBrowser skills={getAllSkills()} categories={getCategories()} />
    </Suspense>
  );
}
