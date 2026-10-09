import type { PixelIconName } from '@/shared/ui/pixel-icons';

export type PlatformId = 'paper-nms' | 'paper-api';

export interface PlatformInfo {
  id: PlatformId;
  label: string;
  icon: PixelIconName;
  /** Docs page describing this platform's build setup. */
  docSlug: string;
}

export const PLATFORMS: readonly PlatformInfo[] = [
  { id: 'paper-nms', label: 'NMS', icon: 'redstone', docSlug: 'paper-nms' },
  { id: 'paper-api', label: 'Paper API', icon: 'emerald', docSlug: 'paper-api' },
];

interface PlatformSource {
  githubPath: string;
  category: string;
}

export function getPlatform(skill: PlatformSource): PlatformId {
  if (skill.githubPath.startsWith('Skills/nms/')) return 'paper-nms';
  if (skill.githubPath.startsWith('Skills/paper/')) return 'paper-api';
  return skill.category.startsWith('nms-') ? 'paper-nms' : 'paper-api';
}

export function isPlatformId(value: string | null | undefined): value is PlatformId {
  return value === 'paper-nms' || value === 'paper-api';
}

const ICON_BY_SUFFIX: Record<string, PixelIconName> = {
  packet: 'pearl',
  network: 'redstone',
  entity: 'egg',
  bridge: 'pickaxe',
  integration: 'emerald',
  data: 'book',
  ui: 'chest',
  display: 'sign',
  player: 'head',
  world: 'grass',
  gameplay: 'sword',
  command: 'command',
};

export function categoryIconFor(category: string): PixelIconName {
  const suffix = category.replace(/^(nms|paper)-/, '');
  return ICON_BY_SUFFIX[suffix] ?? 'pickaxe';
}

export interface CategoryGroup<T> {
  id: string;
  skills: T[];
}

export interface PlatformGroup<T> {
  platform: PlatformId;
  skills: T[];
  categories: CategoryGroup<T>[];
}

/** Platforms in PLATFORMS order; categories in first-seen order. Input is not mutated. */
export function groupSkillsByPlatform<T extends PlatformSource>(skills: readonly T[]): PlatformGroup<T>[] {
  return PLATFORMS.map(({ id }) => {
    const own = skills.filter((s) => getPlatform(s) === id);
    const categoryIds = [...new Set(own.map((s) => s.category))];
    return {
      platform: id,
      skills: own,
      categories: categoryIds.map((cat) => ({ id: cat, skills: own.filter((s) => s.category === cat) })),
    };
  });
}
