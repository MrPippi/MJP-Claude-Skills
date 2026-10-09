/**
 * Tests for shared/markdown/render.ts — the build-time Markdown → HTML pipeline
 * shared by skill pages and docs pages.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../shared/markdown/render';

describe('renderMarkdown', () => {
  it('drops raw HTML blocks and <script>', async () => {
    const { html } = await renderMarkdown('hello\n\n<div>raw html</div>\n\n<script>alert(1)</script>\n');
    assert.ok(html.includes('<p>hello</p>'));
    assert.ok(!html.includes('raw html'));
    assert.ok(!html.includes('<script'));
    assert.ok(!html.includes('alert(1)'));
  });

  it('adds slug ids to headings and collects h2/h3 only', async () => {
    const { html, headings } = await renderMarkdown('# Title\n\n## 目的 / Purpose\n\n### Sub Part\n\n#### Deep\n');
    assert.ok(html.includes('<h2 id="目的--purpose">'));
    assert.deepEqual(headings, [
      { id: '目的--purpose', text: '目的 / Purpose', level: 2 },
      { id: 'sub-part', text: 'Sub Part', level: 3 },
    ]);
  });

  it('de-duplicates repeated heading ids', async () => {
    const { headings } = await renderMarkdown('## Same\n\n## Same\n');
    assert.deepEqual(headings.map((h) => h.id), ['same', 'same-1']);
  });

  it('highlights fenced code at build time and tags the language', async () => {
    const { html } = await renderMarkdown('```java\npublic class A {}\n```\n');
    assert.match(html, /<pre class="shiki[^"]*"/);
    assert.ok(html.includes('data-lang="java"'));
    assert.ok(html.includes('--shiki-dark'));
  });

  it('treats gradle as groovy and unknown languages as plain text', async () => {
    const gradle = await renderMarkdown('```gradle\nplugins { id "java" }\n```\n');
    assert.ok(gradle.html.includes('data-lang="groovy"'));
    const unknown = await renderMarkdown('```nope-lang\nx\n```\n');
    assert.ok(unknown.html.includes('data-lang="text"'));
    const bare = await renderMarkdown('```\nplain\n```\n');
    assert.ok(bare.html.includes('data-lang="text"'));
  });

  it('escapes < inside inline code', async () => {
    const { html } = await renderMarkdown('use `Packet<?>` here');
    assert.ok(html.includes('<code>Packet&#x3C;?></code>'));
  });

  it('renders GFM tables', async () => {
    const { html } = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n');
    assert.ok(html.includes('<table>'));
  });

  it('rewrites links through resolveLink when provided', async () => {
    const { html } = await renderMarkdown('[x](../a.md) [y](https://e.com)', {
      resolveLink: (href) => (href === '../a.md' ? '/docs/a' : href),
    });
    assert.ok(html.includes('href="/docs/a"'));
    assert.ok(html.includes('href="https://e.com"'));
  });
});
