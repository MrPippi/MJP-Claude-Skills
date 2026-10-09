/**
 * Characterization tests for app/robots.ts and app/sitemap.ts (Next metadata
 * routes used by `next build` with output: 'export').
 *
 * SITE_URL is read at import time; this assumes NEXT_PUBLIC_SITE_URL is unset.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import robots from '../app/robots';
import sitemap from '../app/sitemap';

const DEFAULT_SITE_URL = 'https://mrpippi.github.io/MJP-Claude-Skills';
const skipIfSiteUrlSet = { skip: process.env.NEXT_PUBLIC_SITE_URL ? 'NEXT_PUBLIC_SITE_URL set' : false };

describe('robots()', () => {
  it('allows all, disallows /_next/ and /api/, points at sitemap', skipIfSiteUrlSet, () => {
    assert.deepEqual(robots(), {
      rules: { userAgent: '*', allow: '/', disallow: ['/_next/', '/api/'] },
      sitemap: `${DEFAULT_SITE_URL}/sitemap.xml`,
    });
  });
});

describe('sitemap()', () => {
  const entries = sitemap();

  it('has 4 static + 15 skill + 8 category entries', () => {
    assert.equal(entries.length, 27);
  });

  it('static routes include /guide', skipIfSiteUrlSet, () => {
    assert.deepEqual(entries.slice(0, 4).map((e) => [e.url, e.priority]), [
      [DEFAULT_SITE_URL, 1],
      [`${DEFAULT_SITE_URL}/skills`, 0.9],
      [`${DEFAULT_SITE_URL}/categories`, 0.8],
      [`${DEFAULT_SITE_URL}/guide`, 0.8],
    ]);
  });

  it('skill entries use updatedAt as lastModified, monthly, priority 0.8', skipIfSiteUrlSet, () => {
    const first = entries[4];
    assert.equal(first.url, `${DEFAULT_SITE_URL}/skills/nms-attribute-modifier`);
    assert.equal((first.lastModified as Date).toISOString(), '2026-04-30T00:00:00.000Z');
    assert.equal(first.changeFrequency, 'monthly');
    assert.equal(first.priority, 0.8);
  });

  it('category entries are weekly with priority 0.7, ordered as getCategories()', skipIfSiteUrlSet, () => {
    const cats = entries.slice(19);
    assert.equal(cats[0].url, `${DEFAULT_SITE_URL}/categories/nms-world`);
    for (const c of cats) {
      assert.equal(c.changeFrequency, 'weekly');
      assert.equal(c.priority, 0.7);
    }
  });
});
