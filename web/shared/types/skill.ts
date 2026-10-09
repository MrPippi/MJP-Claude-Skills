import type { Heading } from '@/shared/markdown/render';

export type SkillStatus = 'active' | 'deprecated';

export interface SkillMeta {
  id: string;
  slug: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  version: string;
  status: SkillStatus;
  category: string;
  categoryLabel: string;
  categoryLabelEn: string;
  tags: string[];
  triggerKeywords: string[];
  updatedAt: string;
  githubPath: string;
  featured: boolean;
  readingTime?: number;
}

export interface SkillFull extends SkillMeta {
  content: string;
  contentHtml: string;
  headings: Heading[];
}

export interface Category {
  id: string;
  label: string;
  labelEn: string;
  count: number;
}

export interface SearchIndex {
  id: string;
  slug: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  tags: string[];
  category: string;
  status: SkillStatus;
}
