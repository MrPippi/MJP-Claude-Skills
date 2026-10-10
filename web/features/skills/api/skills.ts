import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { renderMarkdown } from '@/shared/markdown/render';
import type { SkillMeta, SkillFull, Category, SearchIndex } from '@/shared/types/skill';

const SKILLS_DIR = path.join(process.cwd(), 'data', 'skills');
/** English bodies (no frontmatter) mirroring SKILLS_DIR filenames. */
const SKILLS_EN_DIR = path.join(SKILLS_DIR, 'en');
/** Slugs map 1:1 to filenames in SKILLS_DIR; anything else (e.g. `../x`) is rejected. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let skillsCache: SkillMeta[] | null = null;

function parseSkillFile(filename: string): SkillMeta | null {
  const fullPath = path.join(SKILLS_DIR, filename);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data } = matter(fileContents);

  if (!data.id || !data.title) return null;

  const slug = filename.replace(/\.md$/, '');

  return {
    id: data.id as string,
    slug,
    title: data.title as string,
    titleZh: (data.titleZh as string) || data.title,
    description: (data.description as string) || '',
    descriptionZh: (data.descriptionZh as string) || data.description || '',
    version: (data.version as string) || '0.1.0',
    status: data.status || 'active',
    category: (data.category as string) || 'general',
    categoryLabel: (data.categoryLabel as string) || data.category || '',
    categoryLabelEn: (data.categoryLabelEn as string) || data.category || '',
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    triggerKeywords: Array.isArray(data.triggerKeywords) ? (data.triggerKeywords as string[]) : [],
    updatedAt: (data.updatedAt as string) || '',
    githubPath: (data.githubPath as string) || '',
    featured: Boolean(data.featured),
  };
}

export function getAllSkills(): SkillMeta[] {
  if (skillsCache) return skillsCache;
  const filenames = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  const skills = filenames
    .map(parseSkillFile)
    .filter((s): s is SkillMeta => s !== null);
  skillsCache = skills.sort((a, b) => a.title.localeCompare(b.title));
  return skillsCache;
}

export async function getSkillBySlug(slug: string): Promise<SkillFull | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const fullPath = path.join(SKILLS_DIR, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  const meta = parseSkillFile(`${slug}.md`);
  if (!meta) return null;

  const { html: contentHtml, headings } = await renderMarkdown(content);
  const english = await renderEnglishBody(slug);

  return { ...meta, content, contentHtml, headings, english };
}

async function renderEnglishBody(slug: string): Promise<SkillFull['english']> {
  const enPath = path.join(SKILLS_EN_DIR, `${slug}.md`);
  if (!fs.existsSync(enPath)) return null;
  const { html, headings } = await renderMarkdown(fs.readFileSync(enPath, 'utf8'));
  return { contentHtml: html, headings };
}

export function getSkillsByCategory(categoryId: string): SkillMeta[] {
  return getAllSkills().filter((s) => s.category === categoryId);
}

export function getCategories(): Category[] {
  const skills = getAllSkills();
  const map = new Map<string, Category>();

  for (const skill of skills) {
    const existing = map.get(skill.category);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(skill.category, {
        id: skill.category,
        label: skill.categoryLabel,
        labelEn: skill.categoryLabelEn,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function getFeaturedSkills(): SkillMeta[] {
  return getAllSkills().filter((s) => s.featured);
}

export function getSearchIndex(): SearchIndex[] {
  return getAllSkills().map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    titleZh: s.titleZh,
    description: s.description,
    descriptionZh: s.descriptionZh,
    tags: s.tags,
    category: s.category,
    status: s.status,
  }));
}
