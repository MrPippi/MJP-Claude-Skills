/**
 * Characterization tests for features/skills/api/skills.ts against a controlled
 * fixture directory. These record CURRENT behavior (including quirks), not
 * desired behavior. If a test here fails after a change, decide whether the
 * behavior change was intended before updating the expectation.
 *
 * SKILLS_DIR is computed from process.cwd() at module load, so we chdir into
 * the fixture root before importing the module. node --test runs each file in
 * its own process, so this does not leak into other test files.
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

type SkillsApi = typeof import('../features/skills/api/skills');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'skills-cwd');

let api: SkillsApi;

before(async () => {
  process.chdir(FIXTURE_ROOT);
  api = await import('../features/skills/api/skills');
});

describe('getAllSkills (fixture)', () => {
  it('skips .md files missing id or title and ignores non-.md files', () => {
    const slugs = api.getAllSkills().map((s) => s.slug);
    assert.deepEqual(slugs, ['minimal', 'typed', 'second-a', 'full']);
  });

  it('sorts by title using localeCompare', () => {
    const titles = api.getAllSkills().map((s) => s.title);
    assert.deepEqual(titles, ['Alpha Minimal', 'Beta Typed', 'Delta Second', 'Gamma Full']);
  });

  it('derives slug from filename, not from frontmatter id', () => {
    const full = api.getAllSkills().find((s) => s.slug === 'full');
    assert.equal(full?.id, 'full-skill');
  });

  it('maps every frontmatter field for a fully specified skill', () => {
    const full = api.getAllSkills().find((s) => s.slug === 'full');
    assert.deepEqual(full, {
      id: 'full-skill',
      slug: 'full',
      title: 'Gamma Full',
      titleZh: '伽瑪完整',
      description: 'Full description',
      descriptionZh: '完整描述',
      version: '1.2.3',
      status: 'active',
      category: 'cat-a',
      categoryLabel: '分類A',
      categoryLabelEn: 'Category A',
      tags: ['one', 'two'],
      triggerKeywords: ['kw1', 'kw2'],
      updatedAt: '2026-01-15',
      githubPath: 'Skills/nms/full/SKILL.md',
      featured: true,
    });
  });

  it('applies defaults when only id and title exist', () => {
    const minimal = api.getAllSkills().find((s) => s.slug === 'minimal');
    assert.deepEqual(minimal, {
      id: 'minimal-skill',
      slug: 'minimal',
      title: 'Alpha Minimal',
      titleZh: 'Alpha Minimal',
      description: '',
      descriptionZh: '',
      version: '0.1.0',
      status: 'active',
      category: 'general',
      categoryLabel: '',
      categoryLabelEn: '',
      tags: [], // non-array tags are dropped
      triggerKeywords: [],
      updatedAt: '',
      githubPath: '',
      featured: false,
    });
  });

  it('falls back descriptionZh -> description', () => {
    const typed = api.getAllSkills().find((s) => s.slug === 'typed');
    assert.equal(typed?.descriptionZh, 'Only English description');
  });

  it('does not coerce YAML types: numeric version stays a number', () => {
    const typed = api.getAllSkills().find((s) => s.slug === 'typed');
    assert.equal(typed?.version, 2 as unknown as string);
  });

  it('does not coerce YAML types: unquoted date becomes a Date object', () => {
    const typed = api.getAllSkills().find((s) => s.slug === 'typed');
    assert.ok((typed?.updatedAt as unknown) instanceof Date);
  });

  it('treats any truthy featured value as true', () => {
    const typed = api.getAllSkills().find((s) => s.slug === 'typed');
    assert.equal(typed?.featured, true);
  });

  it('passes deprecated status through', () => {
    const typed = api.getAllSkills().find((s) => s.slug === 'typed');
    assert.equal(typed?.status, 'deprecated');
  });

  it('caches the result: repeated calls return the same array instance', () => {
    assert.equal(api.getAllSkills(), api.getAllSkills());
  });
});

describe('getCategories (fixture)', () => {
  it('groups by category, first-seen (title order) label wins, sorted by count desc', () => {
    assert.deepEqual(api.getCategories(), [
      { id: 'cat-a', label: '第二個標籤', labelEn: 'cat-a', count: 2 },
      { id: 'general', label: '', labelEn: '', count: 1 },
      { id: 'cat-b', label: 'cat-b', labelEn: 'cat-b', count: 1 },
    ]);
  });
});

describe('getSkillsByCategory / getFeaturedSkills (fixture)', () => {
  it('filters by exact category id', () => {
    assert.deepEqual(api.getSkillsByCategory('cat-a').map((s) => s.slug), ['second-a', 'full']);
    assert.deepEqual(api.getSkillsByCategory('missing'), []);
  });

  it('returns featured skills', () => {
    assert.deepEqual(api.getFeaturedSkills().map((s) => s.slug), ['typed', 'full']);
  });
});

describe('getSearchIndex (fixture)', () => {
  it('projects a subset of fields per skill', () => {
    const entry = api.getSearchIndex().find((s) => s.slug === 'full');
    assert.deepEqual(entry, {
      id: 'full-skill',
      slug: 'full',
      title: 'Gamma Full',
      titleZh: '伽瑪完整',
      description: 'Full description',
      descriptionZh: '完整描述',
      tags: ['one', 'two'],
      category: 'cat-a',
      status: 'active',
    });
  });
});

describe('getSkillBySlug (fixture)', () => {
  it('returns null for a missing file', async () => {
    assert.equal(await api.getSkillBySlug('does-not-exist'), null);
  });

  it('returns null for a file without id/title', async () => {
    assert.equal(await api.getSkillBySlug('no-id'), null);
    assert.equal(await api.getSkillBySlug('no-title'), null);
  });

  it('returns raw content without frontmatter', async () => {
    const skill = await api.getSkillBySlug('full');
    assert.ok(skill);
    assert.ok(!skill.content.includes('id: full-skill'));
    assert.ok(skill.content.includes('# Heading One'));
  });

  it('renders headings with slug ids and exposes h2/h3 as headings', async () => {
    const skill = await api.getSkillBySlug('full');
    assert.ok(skill?.contentHtml.includes('<h1 id="heading-one">Heading One</h1>'));
    assert.ok(skill?.contentHtml.includes('<h2 id="目的">目的</h2>'));
    assert.deepEqual(skill?.headings, [{ id: '目的', text: '目的', level: 2 }]);
  });

  it('escapes < inside inline code as &#x3C;', async () => {
    const skill = await api.getSkillBySlug('full');
    assert.ok(skill?.contentHtml.includes('<code>Packet&#x3C;?></code>'));
  });

  it('renders GFM tables', async () => {
    const skill = await api.getSkillBySlug('full');
    assert.ok(skill?.contentHtml.includes('<table>'));
  });

  it('sanitizes output: raw HTML blocks (including <script>) are dropped', async () => {
    const skill = await api.getSkillBySlug('full');
    assert.ok(!skill?.contentHtml.includes('<script'));
    assert.ok(!skill?.contentHtml.includes('alert(1)'));
    assert.ok(!skill?.contentHtml.includes('raw html'));
  });

  it('rejects slugs that are not plain kebab-case (no path traversal)', async () => {
    assert.equal(await api.getSkillBySlug('../outside'), null);
    assert.equal(await api.getSkillBySlug('..\\outside'), null);
    assert.equal(await api.getSkillBySlug('Full'), null);
    assert.equal(await api.getSkillBySlug(''), null);
  });
});
