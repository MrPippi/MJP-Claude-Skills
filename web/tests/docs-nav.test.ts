import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocsNav, flattenNav, getPrevNext } from '../features/docs/lib/nav';
import type { DocLink } from '../features/docs/registry';

const doc = (section: DocLink['section'], slug: string): DocLink => ({
  section,
  slug,
  href: `/docs/${section}/${slug}`,
  icon: 'book',
  title: { en: slug, zh: slug },
});

const docs = [doc('platforms', 'paper-nms'), doc('concepts', 'nms-threading'), doc('reference', 'packets')];
const skills = [
  { slug: 'nms-a', title: 'NMS A', titleZh: 'NMS 甲', category: 'nms-ui', githubPath: 'Skills/nms/a' },
  { slug: 'paper-b', title: 'Paper B', titleZh: 'Paper 乙', category: 'paper-ui', githubPath: 'Skills/paper/b' },
];

describe('buildDocsNav', () => {
  const nav = buildDocsNav(docs, skills);

  it('orders groups start → platforms → concepts → skills → reference', () => {
    assert.deepEqual(nav.map((g) => g.key), ['start', 'platforms', 'concepts', 'skills', 'reference']);
  });

  it('puts the skills index first and splits skills by platform', () => {
    const group = nav.find((g) => g.key === 'skills');
    assert.equal(group?.items[0].href, '/docs/skills');
    assert.deepEqual(group?.subgroups?.map((s) => [s.platform, s.items.map((i) => i.href)]), [
      ['paper-nms', ['/docs/skills/nms-a']],
      ['paper-api', ['/docs/skills/paper-b']],
    ]);
  });
});

describe('flattenNav / getPrevNext', () => {
  const flat = flattenNav(buildDocsNav(docs, skills));

  it('flattens in reading order including skill subgroups', () => {
    assert.deepEqual(flat.map((i) => i.href), [
      '/docs',
      '/docs/getting-started',
      '/docs/platforms/paper-nms',
      '/docs/concepts/nms-threading',
      '/docs/skills',
      '/docs/skills/nms-a',
      '/docs/skills/paper-b',
      '/docs/reference/packets',
    ]);
  });

  it('returns neighbours, null at the ends, and ignores trailing slashes', () => {
    assert.deepEqual(getPrevNext(flat, '/docs/skills/').map((i) => i?.href), ['/docs/concepts/nms-threading', '/docs/skills/nms-a']);
    assert.equal(getPrevNext(flat, '/docs')[0], null);
    assert.equal(getPrevNext(flat, '/docs/reference/packets')[1], null);
    assert.deepEqual(getPrevNext(flat, '/elsewhere'), [null, null]);
  });
});
