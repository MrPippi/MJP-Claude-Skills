/** Set by next.config.mjs (GitHub Pages serves the site under /<repo>). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** For raw URLs that bypass next/link (meta refresh, <img>, links inside rendered Markdown). */
export function withBasePath(href: string): string {
  return href.startsWith('/') ? `${BASE_PATH}${href}` : href;
}

interface SkillFilter {
  platform?: string;
  category?: string;
}

export const ROUTES = {
  home: '/',
  docs: '/docs',
  gettingStarted: '/docs/getting-started',
  skills: '/docs/skills',
  skill: (slug: string) => `/docs/skills/${slug}`,
  skillsFiltered: ({ platform, category }: SkillFilter) => {
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (category) params.set('category', category);
    const query = params.toString();
    return query ? `/docs/skills?${query}` : '/docs/skills';
  },
} as const;

/** Old (pre-docs-hub) routes and where they now live. Returns null for paths that are not legacy. */
export function legacyRedirectTarget(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/skills' || clean === '/categories') return ROUTES.skills;
  if (clean === '/guide') return ROUTES.gettingStarted;
  const skill = clean.match(/^\/skills\/([^/]+)$/);
  if (skill) return ROUTES.skill(skill[1]);
  const category = clean.match(/^\/categories\/([^/]+)$/);
  if (category) return ROUTES.skillsFiltered({ category: category[1] });
  return null;
}
