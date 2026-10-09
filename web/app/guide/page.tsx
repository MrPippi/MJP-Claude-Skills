import type { Metadata } from 'next';
import { GuidePageClient } from '@/features/guide/GuidePageClient';

export const metadata: Metadata = {
  title: '使用方法 — MJP-Claude-Skills',
  description: '了解如何安裝並使用 MJP-Claude-Skills Claude Code Agent Skills，在 Paper 26.x NMS 底層開發中快速生成高品質的 Java 代碼。',
};

export default function GuidePage() {
  return <GuidePageClient />;
}
