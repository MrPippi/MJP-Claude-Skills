import type { Metadata } from 'next';
import { GettingStarted } from '@/features/docs/components/GettingStarted';

export const metadata: Metadata = {
  title: '開始使用 Get started',
  description: '安裝 MJP Claude Skills 到 Paper 插件專案、在 Claude Code 觸發 Skill，以及常見問題。',
};

export default function GettingStartedPage() {
  return <GettingStarted />;
}
