/**
 * Guards the subset pixel font (shared/fonts/cubic-11-subset.woff2): every CJK character
 * the UI can render in it must be in the subset. If this fails, re-run
 * `python web/scripts/pixel-font.py <Cubic_11.ttf>` (see the script's docstring).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DOC_SOURCES } from '../features/docs/registry';

const WEB = path.join(__dirname, '..');
const REPO = path.join(WEB, '..');
const CJK = /[㐀-鿿豈-﫿]/u;

function read(file: string): string {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/** Mirrors required_text() in scripts/pixel-font.py. */
function collectRequiredChars(): Set<string> {
  const localeDir = path.join(WEB, 'shared', 'i18n', 'locales');
  const skillsDir = path.join(WEB, 'data', 'skills');
  const texts = [
    ...fs.readdirSync(localeDir).filter((f) => f.endsWith('.ts')).map((f) => read(path.join(localeDir, f))),
    ...fs
      .readdirSync(skillsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => read(path.join(skillsDir, f)).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''),
    ...DOC_SOURCES.map((d) => read(path.join(REPO, d.file)).match(/^# (.+)$/m)?.[1] ?? ''),
  ];
  return new Set([...texts.join('')].filter((ch) => CJK.test(ch)));
}

describe('pixel font subset', () => {
  const charset = new Set(read(path.join(WEB, 'shared', 'fonts', 'pixel-charset.txt')));

  it('ships the font file and its licence', () => {
    assert.ok(fs.statSync(path.join(WEB, 'shared', 'fonts', 'cubic-11-subset.woff2')).size > 1000);
    assert.ok(fs.existsSync(path.join(WEB, 'shared', 'fonts', 'Cubic-11-OFL.txt')));
  });

  it('covers every CJK character used by UI strings, skill frontmatter and doc titles', () => {
    const missing = [...collectRequiredChars()].filter((ch) => !charset.has(ch));
    assert.deepEqual(missing, [], `re-run scripts/pixel-font.py; missing: ${missing.join('')}`);
  });

  it('covers printable ASCII', () => {
    for (let c = 0x21; c < 0x7f; c += 1) assert.ok(charset.has(String.fromCharCode(c)), `U+${c.toString(16)}`);
  });
});
