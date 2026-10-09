/**
 * Characterization tests for scripts/generate-static-metadata.ts.
 *
 * The script runs main() on import and writes into <scriptDir>/../public, so we
 * copy it into a throwaway directory under web/tests/ (so node_modules still
 * resolves) with fixture data, run it as a subprocess, and inspect the output.
 * The tracked web/public/ files are never touched.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = path.join(__dirname, '..');
const SCRIPT = path.join(WEB_DIR, 'scripts', 'generate-static-metadata.ts');
const FIXTURE_SKILLS = path.join(__dirname, 'fixtures', 'skills-cwd', 'data', 'skills');
const TODAY = /\d{4}-\d{2}-\d{2}/;

let sandbox: string;

function runScript(env: NodeJS.ProcessEnv): { robots: string; sitemap: string; stdout: string } {
  const publicDir = path.join(sandbox, 'public');
  fs.rmSync(publicDir, { recursive: true, force: true });
  const stdout = execFileSync(
    process.execPath,
    ['--import', 'tsx', path.join(sandbox, 'scripts', 'generate-static-metadata.ts')],
    { cwd: WEB_DIR, env, encoding: 'utf8' },
  );
  return {
    robots: fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8'),
    sitemap: fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8'),
    stdout,
  };
}

function envWithoutSiteUrl(): NodeJS.ProcessEnv {
  const { NEXT_PUBLIC_SITE_URL: _omit, ...rest } = process.env;
  return rest;
}

before(() => {
  sandbox = fs.mkdtempSync(path.join(__dirname, '.tmp-gsm-'));
  fs.mkdirSync(path.join(sandbox, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(sandbox, 'scripts', 'generate-static-metadata.ts'));
  fs.cpSync(FIXTURE_SKILLS, path.join(sandbox, 'data', 'skills'), { recursive: true });
});

after(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('generate-static-metadata (default SITE_URL)', () => {
  let out: ReturnType<typeof runScript>;
  before(() => {
    out = runScript(envWithoutSiteUrl());
  });

  it('logs both generated files', () => {
    assert.equal(out.stdout, 'Generated public/robots.txt\nGenerated public/sitemap.xml\n');
  });

  it('defaults to https://mps.vercel.app (differs from config/site.ts default)', () => {
    assert.equal(
      out.robots,
      '# https://www.robotstxt.org/robotstxt.html\n' +
        'User-agent: *\nAllow: /\nDisallow: /_next/\nDisallow: /api/\n\n' +
        'Sitemap: https://mps.vercel.app/sitemap.xml\n',
    );
  });

  it('lists 4 static routes (including /guide), then skills, then categories', () => {
    const locs = [...out.sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(locs, [
      'https://mps.vercel.app',
      'https://mps.vercel.app/skills',
      'https://mps.vercel.app/categories',
      'https://mps.vercel.app/guide',
      // skills in readdir order (not title-sorted), only those with id+title
      'https://mps.vercel.app/skills/full',
      'https://mps.vercel.app/skills/minimal',
      'https://mps.vercel.app/skills/second-a',
      'https://mps.vercel.app/skills/typed',
      // categories in first-seen order, no count sort
      'https://mps.vercel.app/categories/cat-a',
      'https://mps.vercel.app/categories/general',
      'https://mps.vercel.app/categories/cat-b',
    ]);
  });

  it('uses quoted updatedAt verbatim; missing updatedAt falls back to today', () => {
    const block = (slug: string) =>
      out.sitemap.split('<url>').find((b) => b.includes(`/skills/${slug}</loc>`)) ?? '';
    assert.match(block('full'), /<lastmod>2026-01-15<\/lastmod>/);
    assert.match(block('minimal'), new RegExp(`<lastmod>${TODAY.source}</lastmod>`));
  });

  it('writes an unquoted YAML date as Date.toString() into lastmod', () => {
    const block = out.sitemap.split('<url>').find((b) => b.includes('/skills/typed</loc>')) ?? '';
    const lastmod = /<lastmod>(.*?)<\/lastmod>/.exec(block)?.[1] ?? '';
    assert.equal(lastmod, new Date('2026-02-01').toString());
  });

  it('gives deprecated skills priority 0.5 and active skills 0.8', () => {
    const block = (slug: string) =>
      out.sitemap.split('<url>').find((b) => b.includes(`/skills/${slug}</loc>`)) ?? '';
    assert.match(block('typed'), /<priority>0.5<\/priority>/);
    assert.match(block('full'), /<priority>0.8<\/priority>/);
  });
});

describe('generate-static-metadata (NEXT_PUBLIC_SITE_URL set)', () => {
  it('uses the env URL and XML-escapes it in <loc>', () => {
    const out = runScript({ ...envWithoutSiteUrl(), NEXT_PUBLIC_SITE_URL: 'https://ex.com/a&b' });
    assert.match(out.robots, /Sitemap: https:\/\/ex\.com\/a&b\/sitemap\.xml\n$/);
    assert.match(out.sitemap, /<loc>https:\/\/ex\.com\/a&amp;b<\/loc>/);
  });
});
