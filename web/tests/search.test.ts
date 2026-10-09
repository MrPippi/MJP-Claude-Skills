/**
 * Characterization tests for features/search/api/search.ts (Fuse.js wrapper).
 * Records current ranking/limit behavior; not a statement of ideal relevance.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchIndex, search } from '../features/search/api/search';
import { getSearchIndex } from '../features/skills/api/skills';
import type { SearchIndex } from '../shared/types/skill';

function entry(slug: string, overrides: Partial<SearchIndex> = {}): SearchIndex {
  return {
    id: slug,
    slug,
    title: slug,
    titleZh: slug,
    description: '',
    descriptionZh: '',
    tags: [],
    category: 'general',
    status: 'active',
    ...overrides,
  };
}

describe('search (synthetic data)', () => {
  it('returns [] for empty or whitespace-only queries', () => {
    const fuse = createSearchIndex([entry('alpha')]);
    assert.deepEqual(search('', fuse), []);
    assert.deepEqual(search('   ', fuse), []);
  });

  it('caps results at 10', () => {
    const data = Array.from({ length: 15 }, (_, i) => entry(`skill-${i}`));
    const fuse = createSearchIndex(data);
    assert.equal(search('skill', fuse).length, 10);
  });

  it('includes a numeric score on each result', () => {
    const fuse = createSearchIndex([entry('alpha')]);
    const [result] = search('alpha', fuse);
    assert.equal(typeof result.score, 'number');
  });

  it('matches on tags', () => {
    const fuse = createSearchIndex([entry('a', { tags: ['netty'] }), entry('b')]);
    assert.deepEqual(search('netty', fuse).map((r) => r.item.slug), ['a']);
  });

  it('does not search the category field', () => {
    const fuse = createSearchIndex([entry('a', { category: 'zzcategory' })]);
    assert.deepEqual(search('zzcategory', fuse), []);
  });
});

describe('search (real data)', () => {
  const fuse = createSearchIndex(getSearchIndex());
  const slugs = (q: string) => search(q, fuse).map((r) => r.item.slug);

  // 技能持續增加，只鎖定「必須出現」的結果，不鎖定完整清單
  const includesAll = (q: string, expected: string[]) => {
    const got = slugs(q);
    for (const e of expected) assert.ok(got.includes(e), `${q}: missing ${e} in ${JSON.stringify(got)}`);
  };

  it('packet', () => {
    includesAll('packet', ['nms-packet-sender', 'nms-packet-interceptor', 'paper-packetevents-filter']);
  });

  it('Chinese query 封包', () => {
    includesAll('封包', ['nms-packet-sender', 'nms-packet-interceptor']);
  });

  it('typo pakcet still matches (fuzzy)', () => {
    includesAll('pakcet', ['nms-packet-interceptor', 'nms-packet-sender']);
  });

  it('boss ranks nms-custom-entity above nms-boss-event', () => {
    // 只鎖定前兩名：新增技能時模糊比對的尾端結果會變動
    assert.deepEqual(slugs('boss').slice(0, 2), ['nms-custom-entity', 'nms-boss-event']);
  });

  it('no match returns []', () => {
    assert.deepEqual(slugs('zzzzqqq'), []);
  });
});
