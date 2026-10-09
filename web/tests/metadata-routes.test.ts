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
import { getAllSkills } from '../features/skills/api/skills';
import { DOC_SOURCES } from '../features/docs/registry';

const DEFAULT_SITE_URL = 'https://mrpippi.github.io/MJP-Paper-Skills';
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
  const skillsStart = 4 + DOC_SOURCES.length;

  it('has 4 static + one entry per docs page + one per skill, and no legacy routes', () => {
    assert.equal(entries.length, skillsStart + getAllSkills().length);
    for (const e of entries) assert.ok(!/\/(categories|guide)(\/|$)|\.io\/MJP-Paper-Skills\/skills/.test(e.url), e.url);
  });

  it('static routes point at the docs hub', skipIfSiteUrlSet, () => {
    assert.deepEqual(entries.slice(0, 4).map((e) => [e.url, e.priority]), [
      [DEFAULT_SITE_URL, 1],
      [`${DEFAULT_SITE_URL}/docs`, 0.9],
      [`${DEFAULT_SITE_URL}/docs/getting-started`, 0.9],
      [`${DEFAULT_SITE_URL}/docs/skills`, 0.9],
    ]);
  });

  it('docs pages are monthly with priority 0.7', skipIfSiteUrlSet, () => {
    const first = entries[4];
    assert.equal(first.url, `${DEFAULT_SITE_URL}/docs/platforms/paper-nms`);
    assert.equal(first.changeFrequency, 'monthly');
    assert.equal(first.priority, 0.7);
  });

  it('skill entries use updatedAt as lastModified, monthly, priority 0.8', skipIfSiteUrlSet, () => {
    const first = entries[skillsStart];
    assert.equal(first.url, `${DEFAULT_SITE_URL}/docs/skills/nms-attribute-modifier`);
    assert.equal((first.lastModified as Date).toISOString(), '2026-04-30T00:00:00.000Z');
    assert.equal(first.changeFrequency, 'monthly');
    assert.equal(first.priority, 0.8);
  });
});
