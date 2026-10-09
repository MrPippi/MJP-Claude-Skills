import type { MetadataRoute } from 'next';
import { getAllSkills } from '@/features/skills';
import { DOC_SOURCES, docHref } from '@/features/docs/registry';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/site';

export const dynamic = 'force-static';

const STATIC_ROUTES: Array<[string, number]> = [
  [ROUTES.home, 1],
  [ROUTES.docs, 0.9],
  [ROUTES.gettingStarted, 0.9],
  [ROUTES.skills, 0.9],
];

function absolute(route: string): string {
  return route === '/' ? SITE_URL : `${SITE_URL}${route}`;
}

/** Legacy routes (/skills, /categories, /guide) are redirect stubs and intentionally omitted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = STATIC_ROUTES.map(([route, priority]) => ({
    url: absolute(route),
    lastModified: now,
    changeFrequency: 'weekly',
    priority,
  }));

  const docRoutes: MetadataRoute.Sitemap = DOC_SOURCES.map((doc) => ({
    url: absolute(docHref(doc.section, doc.slug)),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const skillRoutes: MetadataRoute.Sitemap = getAllSkills().map((skill) => ({
    url: absolute(ROUTES.skill(skill.slug)),
    lastModified: skill.updatedAt ? new Date(skill.updatedAt) : now,
    changeFrequency: 'monthly',
    priority: skill.status === 'active' ? 0.8 : 0.5,
  }));

  return [...staticRoutes, ...docRoutes, ...skillRoutes];
}
