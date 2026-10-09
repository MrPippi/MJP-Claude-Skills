/**
 * Characterization tests for features/skills/api/skills.ts against the real
 * web/data/skills/ content. Records the current dataset shape; expected to
 * change whenever skills are added, removed or recategorized.
 *
 * Must run with cwd = web/ (npm test does this).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAllSkills,
  getCategories,
  getFeaturedSkills,
  getSearchIndex,
  getSkillBySlug,
  getSkillsByCategory,
} from '../features/skills/api/skills';

const DATA_DIR = path.join(__dirname, '..', 'data', 'skills');

const EXPECTED_SLUGS = [
  'nms-attribute-modifier',
  'nms-block-entity',
  'nms-boss-event',
  'nms-chunk-access',
  'nms-custom-entity',
  'nms-custom-menu',
  'nms-data-component',
  'nms-nbt-manipulation',
  'nms-packet-interceptor',
  'nms-packet-sender',
  'nms-particle-effect',
  'nms-player-profile',
  'nms-reflection-bridge',
  'nms-scoreboard',
  'nms-version-adapter',
  'paper-service-api',
];

describe('getAllSkills (real data)', () => {
  it('parses every .md file in data/skills', () => {
    const mdCount = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.md')).length;
    assert.equal(getAllSkills().length, mdCount);
  });

  it('contains the 16 skills in title order', () => {
    assert.deepEqual(getAllSkills().map((s) => s.slug), EXPECTED_SLUGS);
  });

  it('uses frontmatter id equal to filename slug for every skill', () => {
    for (const s of getAllSkills()) assert.equal(s.id, s.slug);
  });

  it('marks every skill active at version 1.0.0 with string updatedAt', () => {
    for (const s of getAllSkills()) {
      assert.equal(s.status, 'active', s.slug);
      assert.equal(s.version, '1.0.0', s.slug);
      assert.match(s.updatedAt, /^\d{4}-\d{2}-\d{2}$/, s.slug);
    }
  });
});

describe('getCategories (real data)', () => {
  it('returns 9 categories sorted by count desc', () => {
    assert.deepEqual(getCategories(), [
      { id: 'nms-world', label: 'NMS 世界', labelEn: 'NMS World', count: 3 },
      { id: 'nms-entity', label: 'NMS 實體', labelEn: 'NMS Entity', count: 2 },
      { id: 'nms-display', label: 'NMS 顯示', labelEn: 'NMS Display', count: 2 },
      { id: 'nms-data', label: 'NMS 資料', labelEn: 'NMS Data', count: 2 },
      { id: 'nms-packet', label: 'NMS 封包', labelEn: 'NMS Packet', count: 2 },
      { id: 'nms-bridge', label: 'NMS 橋接', labelEn: 'NMS Bridge', count: 2 },
      { id: 'nms-ui', label: 'NMS UI', labelEn: 'NMS UI', count: 1 },
      { id: 'nms-player', label: 'NMS 玩家', labelEn: 'NMS Player', count: 1 },
      { id: 'paper-integration', label: 'Paper 整合', labelEn: 'Paper Integration', count: 1 },
    ]);
  });

  it('getSkillsByCategory returns title-ordered members', () => {
    assert.deepEqual(getSkillsByCategory('nms-world').map((s) => s.slug), [
      'nms-block-entity',
      'nms-chunk-access',
      'nms-particle-effect',
    ]);
  });
});

describe('getFeaturedSkills (real data)', () => {
  it('returns the 6 featured skills', () => {
    assert.deepEqual(getFeaturedSkills().map((s) => s.slug), [
      'nms-custom-entity',
      'nms-custom-menu',
      'nms-nbt-manipulation',
      'nms-packet-interceptor',
      'nms-packet-sender',
      'nms-scoreboard',
    ]);
  });
});

describe('getSearchIndex (real data)', () => {
  it('has one entry per skill with the projected keys only', () => {
    const index = getSearchIndex();
    assert.equal(index.length, EXPECTED_SLUGS.length);
    for (const entry of index) {
      assert.deepEqual(Object.keys(entry), [
        'id', 'slug', 'title', 'titleZh', 'description', 'descriptionZh', 'tags', 'category', 'status',
      ]);
    }
  });
});

describe('getSkillBySlug (real data)', () => {
  it('renders nms-packet-sender starting with h1 then 目的 h2', async () => {
    const skill = await getSkillBySlug('nms-packet-sender');
    assert.ok(skill);
    assert.ok(skill.contentHtml.startsWith('<h1>NMS Packet Sender</h1>\n<h2>目的</h2>'));
  });

  it('renders every skill to non-empty HTML', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const skill = await getSkillBySlug(slug);
      assert.ok(skill && skill.contentHtml.length > 0, slug);
    }
  });
});
