/**
 * English mode must not fall back to Chinese bodies: every skill page and docs
 * page needs a translation, and English-facing text must be free of CJK.
 *
 * Must run with cwd = web/ (npm test does this).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllSkills, getSkillBySlug } from '../features/skills/api/skills';
import { getAllDocPages } from '../features/docs/api/docs';

/** CJK ideographs plus CJK / full-width punctuation. */
const CJK = /[　-〿㐀-鿿＀-￯]/;

function cjkSnippet(text: string): string | null {
  const match = CJK.exec(text);
  return match ? text.slice(Math.max(0, match.index - 30), match.index + 30) : null;
}

describe('English skill content', () => {
  it('has CJK-free English frontmatter fields', () => {
    for (const skill of getAllSkills()) {
      for (const field of [skill.title, skill.description, skill.categoryLabelEn]) {
        assert.equal(cjkSnippet(field), null, `${skill.slug}: ${field}`);
      }
    }
  });

  it('has a CJK-free English body for every skill', async () => {
    for (const { slug } of getAllSkills()) {
      const skill = await getSkillBySlug(slug);
      assert.ok(skill?.english, `missing data/skills/en/${slug}.md`);
      assert.equal(cjkSnippet(skill.english.contentHtml), null, `${slug} English body contains CJK`);
      assert.equal(skill.english.headings.length, skill.headings.length, `${slug}: heading count differs from source`);
    }
  });
});

describe('English docs content', () => {
  it('has a CJK-free English body for every docs page', async () => {
    for (const page of await getAllDocPages()) {
      const id = `${page.section}/${page.slug}`;
      assert.ok(page.english, `missing data/docs/en/${id}.md`);
      assert.equal(cjkSnippet(page.english.html), null, `${id} English body contains CJK`);
      assert.equal(cjkSnippet(page.title.en), null, `${id} English title contains CJK`);
    }
  });
});
