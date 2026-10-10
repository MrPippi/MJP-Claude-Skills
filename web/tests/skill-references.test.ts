/**
 * Each skill bundles the shared docs it needs in references/ so it works when installed
 * alone (`npx skills add ... --skill <id>`). The copies are generated; this fails when
 * a source in Skills/paper-*\/PLATFORM.md or Skills/_shared/ changed without re-running
 * `node scripts/sync-skill-references.mjs`.
 *
 * Must run with cwd = web/ (npm test does this).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-skill-references.mjs');
const SKILL_GROUPS = ['nms', 'paper'];

describe('skill references/', () => {
  it('matches the shared sources (sync script --check)', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it('leaves no skill linking to files outside its own folder', () => {
    const outside = /\]\((?:\.\.\/)+(?:_shared|paper-nms|paper-api)\//;
    for (const group of SKILL_GROUPS) {
      const groupDir = path.join(REPO_ROOT, 'Skills', group);
      for (const id of fs.readdirSync(groupDir)) {
        for (const file of ['SKILL.md', 'examples.md']) {
          const full = path.join(groupDir, id, file);
          if (!fs.existsSync(full)) continue;
          assert.doesNotMatch(fs.readFileSync(full, 'utf8'), outside, `${group}/${id}/${file}`);
        }
      }
    }
  });
});
