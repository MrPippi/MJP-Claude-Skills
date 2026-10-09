import type { Metadata } from 'next';
import { getAllSkills, getCategories, SkillBrowser } from '@/features/skills';

export const metadata: Metadata = {
  title: '所有 Skills',
  description: '依平台（NMS / Paper API）與分類瀏覽全部 MJP Paper Skills。',
};

export default function SkillsPage() {
  return <SkillBrowser skills={getAllSkills()} categories={getCategories()} />;
}
