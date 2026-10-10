import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPlatform, categoryIconFor, groupSkillsByPlatform, PLATFORMS } from '../features/skills/lib/platform';
import { getAllSkills } from '../features/skills/api/skills';
import { PIXEL_ICONS } from '../shared/ui/pixel-icons';

const base = { githubPath: '', category: 'general' };

describe('getPlatform', () => {
  it('uses githubPath first', () => {
    assert.equal(getPlatform({ ...base, githubPath: 'Skills/nms/x/SKILL.md' }), 'paper-nms');
    assert.equal(getPlatform({ ...base, githubPath: 'Skills/paper/x/SKILL.md' }), 'paper-api');
  });

  it('falls back to the category prefix, defaulting to paper-api', () => {
    assert.equal(getPlatform({ ...base, category: 'nms-packet' }), 'paper-nms');
    assert.equal(getPlatform({ ...base, category: 'paper-ui' }), 'paper-api');
    assert.equal(getPlatform(base), 'paper-api');
  });

  it('classifies the real data as 16 NMS + 15 Paper API', () => {
    const counts = groupSkillsByPlatform(getAllSkills()).map((g) => [g.platform, g.skills.length]);
    assert.deepEqual(counts, [['paper-nms', 16], ['paper-api', 15]]);
  });
});

describe('categoryIconFor', () => {
  it('maps by category suffix and returns a known icon', () => {
    assert.equal(categoryIconFor('nms-world'), 'grass');
    assert.equal(categoryIconFor('paper-world'), 'grass');
    assert.equal(categoryIconFor('paper-command'), 'command');
    assert.equal(categoryIconFor('something-else'), 'pickaxe');
  });

  it('every real category and platform resolves to a defined icon', () => {
    for (const s of getAllSkills()) assert.ok(PIXEL_ICONS[categoryIconFor(s.category)], s.category);
    for (const p of PLATFORMS) assert.ok(PIXEL_ICONS[p.icon], p.id);
  });
});

describe('groupSkillsByPlatform', () => {
  it('groups categories within each platform, keeping input order', () => {
    const skills = [
      { ...base, slug: 'b', category: 'nms-ui', githubPath: 'Skills/nms/b' },
      { ...base, slug: 'a', category: 'paper-ui', githubPath: 'Skills/paper/a' },
      { ...base, slug: 'c', category: 'nms-ui', githubPath: 'Skills/nms/c' },
    ];
    const groups = groupSkillsByPlatform(skills);
    assert.deepEqual(groups[0].categories.map((c) => [c.id, c.skills.map((s) => s.slug)]), [['nms-ui', ['b', 'c']]]);
    assert.deepEqual(groups[1].skills.map((s) => s.slug), ['a']);
  });
});
