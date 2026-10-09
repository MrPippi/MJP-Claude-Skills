import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translateHeadingsHtml, translateHeadingText } from '../features/skills/lib/heading-translations';

describe('heading translations', () => {
  it('translates known headings and keeps ids', () => {
    assert.equal(translateHeadingsHtml('<h2 id="目的">目的</h2><h3 id="x">Other</h3>'), '<h2 id="目的">Purpose</h2><h3 id="x">Other</h3>');
  });

  it('leaves unknown text unchanged', () => {
    assert.equal(translateHeadingText('自訂段落'), '自訂段落');
  });
});
