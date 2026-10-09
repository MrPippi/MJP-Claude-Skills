import { DocsShell } from '@/features/docs/components/DocsShell';
import { buildDocsNav } from '@/features/docs/lib/nav';
import { getDocLinks } from '@/features/docs';
import { getAllSkills } from '@/features/skills';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const skills = getAllSkills().map(({ slug, title, titleZh, category, githubPath }) => ({ slug, title, titleZh, category, githubPath }));
  return <DocsShell nav={buildDocsNav(getDocLinks(), skills)}>{children}</DocsShell>;
}
