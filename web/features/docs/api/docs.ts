import fs from 'fs';
import path from 'path';
import { renderMarkdown, type Heading } from '@/shared/markdown/render';
import { GITHUB_REPO_URL } from '@/config/site';
import { withBasePath } from '@/config/routes';
import { DOC_SOURCES, docHref, type DocSection, type DocSource } from '../registry';

export interface BilingualText {
  en: string;
  zh: string;
}

export interface DocPage extends DocSource {
  title: BilingualText;
  html: string;
  headings: Heading[];
  githubUrl: string;
}

const REPO_ROOT = path.resolve(process.cwd(), '..');
const CJK = /[㐀-鿿]/;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

export function splitBilingualTitle(title: string): BilingualText {
  const parts = title.split(' / ').map((p) => p.trim());
  if (parts.length !== 2) return { en: title, zh: title };
  const [a, b] = parts;
  return CJK.test(a) && !CJK.test(b) ? { en: b, zh: a } : { en: a, zh: b };
}

/** Resolves links found in `sourceFile`: registered docs → site routes, other repo files → GitHub. */
export function createLinkResolver(sourceFile: string): (href: string) => string {
  const sourceDir = path.posix.dirname(sourceFile);
  return (href) => {
    if (EXTERNAL.test(href)) return href;
    const [target, hash] = href.split('#');
    const repoPath = path.posix.normalize(path.posix.join(sourceDir, target));
    const anchor = hash ? `#${hash}` : '';
    const doc = DOC_SOURCES.find((d) => d.file === repoPath);
    if (doc) return withBasePath(`${docHref(doc.section, doc.slug)}${anchor}`);
    return `${GITHUB_REPO_URL}/blob/main/${repoPath}${anchor}`;
  };
}

function readSource(source: DocSource): string {
  const fullPath = path.join(REPO_ROOT, source.file);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`Docs source missing for ${source.section}/${source.slug}: ${fullPath}`, { cause: error });
  }
}

const pageCache = new Map<string, Promise<DocPage>>();

async function loadPage(source: DocSource): Promise<DocPage> {
  const markdown = readSource(source);
  const h1 = markdown.match(/^# (.+)$/m);
  const body = h1 ? markdown.replace(h1[0], '') : markdown;
  const { html, headings } = await renderMarkdown(body, { resolveLink: createLinkResolver(source.file) });
  return {
    ...source,
    title: splitBilingualTitle(h1 ? h1[1].trim() : source.slug),
    html,
    headings,
    githubUrl: `${GITHUB_REPO_URL}/blob/main/${source.file}`,
  };
}

function cachedPage(source: DocSource): Promise<DocPage> {
  const key = `${source.section}/${source.slug}`;
  const existing = pageCache.get(key);
  if (existing) return existing;
  const created = loadPage(source);
  pageCache.set(key, created);
  return created;
}

export function getDocsBySection(section: DocSection): DocSource[] {
  return DOC_SOURCES.filter((d) => d.section === section);
}

export async function getDocPage(section: DocSection, slug: string): Promise<DocPage | null> {
  const source = DOC_SOURCES.find((d) => d.section === section && d.slug === slug);
  return source ? cachedPage(source) : null;
}

export function getAllDocPages(): Promise<DocPage[]> {
  return Promise.all(DOC_SOURCES.map(cachedPage));
}

/** Titles only (no rendering) — cheap enough for the search index and sidebar. */
export function getDocTitles(): Array<DocSource & { title: BilingualText }> {
  return DOC_SOURCES.map((source) => {
    const h1 = readSource(source).match(/^# (.+)$/m);
    return { ...source, title: splitBilingualTitle(h1 ? h1[1].trim() : source.slug) };
  });
}
