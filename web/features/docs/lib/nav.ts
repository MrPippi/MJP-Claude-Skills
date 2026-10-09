import type { BilingualText, DocLink, DocSection } from '../registry';
import type { PixelIconName } from '@/shared/ui/pixel-icons';
import { categoryIconFor, groupSkillsByPlatform, type PlatformId } from '@/features/skills/lib/platform';
import { ROUTES } from '@/config/routes';

export type NavGroupKey = 'start' | DocSection | 'skills';

export interface NavItem {
  href: string;
  label: BilingualText;
  icon?: PixelIconName;
}

export interface NavSubgroup {
  platform: PlatformId;
  items: NavItem[];
}

export interface NavGroup {
  key: NavGroupKey;
  items: NavItem[];
  subgroups?: NavSubgroup[];
}

interface NavSkill {
  slug: string;
  title: string;
  titleZh: string;
  category: string;
  githubPath: string;
}

const START_ITEMS: NavItem[] = [
  { href: ROUTES.docs, label: { zh: '總覽', en: 'Overview' }, icon: 'sign' },
  { href: ROUTES.gettingStarted, label: { zh: '開始使用', en: 'Get started' }, icon: 'grass' },
];

const SKILLS_INDEX: NavItem = { href: ROUTES.skills, label: { zh: '所有 Skills', en: 'All skills' }, icon: 'chest' };

function docItems(docs: readonly DocLink[], section: DocSection): NavItem[] {
  return docs.filter((d) => d.section === section).map((d) => ({ href: d.href, label: d.title, icon: d.icon }));
}

export function buildDocsNav(docs: readonly DocLink[], skills: readonly NavSkill[]): NavGroup[] {
  const subgroups = groupSkillsByPlatform(skills).map(({ platform, categories }) => ({
    platform,
    items: categories.flatMap((c) =>
      c.skills.map((s) => ({ href: ROUTES.skill(s.slug), label: { en: s.title, zh: s.titleZh }, icon: categoryIconFor(s.category) })),
    ),
  }));

  return [
    { key: 'start', items: START_ITEMS },
    { key: 'platforms', items: docItems(docs, 'platforms') },
    { key: 'concepts', items: docItems(docs, 'concepts') },
    { key: 'skills', items: [SKILLS_INDEX], subgroups },
    { key: 'reference', items: docItems(docs, 'reference') },
  ];
}

export function flattenNav(groups: readonly NavGroup[]): NavItem[] {
  return groups.flatMap((g) => [...g.items, ...(g.subgroups ?? []).flatMap((s) => s.items)]);
}

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function getPrevNext(flat: readonly NavItem[], pathname: string): [NavItem | null, NavItem | null] {
  const index = flat.findIndex((i) => i.href === normalize(pathname));
  if (index === -1) return [null, null];
  return [flat[index - 1] ?? null, flat[index + 1] ?? null];
}
