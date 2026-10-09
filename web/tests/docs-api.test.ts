import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitBilingualTitle, createLinkResolver, getDocPage, getAllDocPages, getDocsBySection } from '../features/docs/api/docs';
import { DOC_SOURCES } from '../features/docs/registry';
import { GITHUB_REPO_URL } from '../config/site';

describe('splitBilingualTitle', () => {
  it('assigns the CJK half to zh regardless of order', () => {
    assert.deepEqual(splitBilingualTitle('Paper NMS Platform / Paper NMS 平台'), { en: 'Paper NMS Platform', zh: 'Paper NMS 平台' });
    assert.deepEqual(splitBilingualTitle('NMS 執行緒安全模式 / NMS Threading Patterns'), { en: 'NMS Threading Patterns', zh: 'NMS 執行緒安全模式' });
  });

  it('uses the whole title for both when there is no bilingual split', () => {
    assert.deepEqual(splitBilingualTitle('Only One'), { en: 'Only One', zh: 'Only One' });
  });
});

describe('createLinkResolver', () => {
  const resolve = createLinkResolver('Skills/paper-api/PLATFORM.md');

  it('maps relative links to registered sources onto site routes', () => {
    assert.equal(resolve('../paper-nms/PLATFORM.md'), '/docs/platforms/paper-nms');
    assert.equal(resolve('../_shared/paper-threading.md#x'), '/docs/concepts/paper-threading#x');
  });

  it('maps other relative links to GitHub and leaves absolute/anchor links alone', () => {
    assert.equal(resolve('../../README.md'), `${GITHUB_REPO_URL}/blob/main/README.md`);
    assert.equal(resolve('https://jd.papermc.io/'), 'https://jd.papermc.io/');
    assert.equal(resolve('#section'), '#section');
  });
});

describe('docs registry (real files)', () => {
  it('loads every registered page with a title and rendered body', async () => {
    const pages = await getAllDocPages();
    assert.equal(pages.length, DOC_SOURCES.length);
    for (const page of pages) {
      assert.ok(page.title.en && page.title.zh, page.slug);
      assert.ok(page.html.length > 100, page.slug);
      assert.ok(!page.html.includes('<h1'), `${page.slug} keeps its H1`);
    }
  });

  it('rewrites cross-doc links inside rendered pages', async () => {
    const page = await getDocPage('platforms', 'paper-api');
    assert.ok(page?.html.includes('href="/docs/platforms/paper-nms"'));
  });

  it('returns null for unknown section/slug combinations', async () => {
    assert.equal(await getDocPage('platforms', 'packets'), null);
    assert.equal(await getDocPage('reference', '../etc'), null);
  });

  it('lists sources by section in registry order', () => {
    assert.deepEqual(getDocsBySection('reference').map((d) => d.slug), ['packets', 'entities', 'network', 'bukkit-nms-bridge']);
  });
});
