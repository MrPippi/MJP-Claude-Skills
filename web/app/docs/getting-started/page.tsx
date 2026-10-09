import type { Metadata } from 'next';
import { GettingStarted } from '@/features/docs/components/GettingStarted';

export const metadata: Metadata = {
  title: '開始使用 Get started',
  description: '把 MJP Paper Skills 安裝到你的 AI 編碼工具（Claude Code、Codex、Cursor、Copilot…）、觸發 Skill，以及常見問題。',
};

export default function GettingStartedPage() {
  return <GettingStarted />;
}
