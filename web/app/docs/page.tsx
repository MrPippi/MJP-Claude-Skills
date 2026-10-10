import type { Metadata } from 'next';
import { DocsIndex } from '@/features/docs/components/DocsIndex';
import { getDocLinks } from '@/features/docs';
import { getAllSkills } from '@/features/skills';

export const metadata: Metadata = {
  title: '文件 Docs',
  description: 'MJP Paper Skills 文件：安裝、平台建置設定、執行緒與命名概念、31 個 Skills 與 NMS API 速查表。',
};

export default function DocsPage() {
  return <DocsIndex docLinks={getDocLinks()} skillCount={getAllSkills().length} />;
}
