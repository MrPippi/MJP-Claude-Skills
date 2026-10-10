#!/usr/bin/env node
/**
 * Copies the shared docs each skill depends on (platform build setup, threading and
 * naming rules) into `<skill>/references/`, so a skill installed on its own
 * (e.g. `npx skills add MrPippi/MJP-Paper-Skills --skill <id>`) is self-contained.
 *
 * Sources of truth stay in Skills/paper-nms, Skills/paper-api and Skills/_shared;
 * the copies are generated for both Skills/ and .claude/skills/.
 *
 *   node scripts/sync-skill-references.mjs          # write copies
 *   node scripts/sync-skill-references.mjs --check  # exit 1 if any copy is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GITHUB_BLOB = 'https://github.com/MrPippi/MJP-Paper-Skills/blob/main';

/** Shared doc → file name inside references/. Paths are relative to the repo root. */
export const SHARED_DOCS = {
  'Skills/paper-nms/PLATFORM.md': 'paper-nms-platform.md',
  'Skills/paper-api/PLATFORM.md': 'paper-api-platform.md',
  'Skills/_shared/nms-threading.md': 'nms-threading.md',
  'Skills/_shared/nms-obfuscation.md': 'nms-obfuscation.md',
  'Skills/_shared/paper-threading.md': 'paper-threading.md',
};

/** Skill folder → docs every skill in it gets, whether or not SKILL.md links them. */
const PLATFORM_DEFAULTS = {
  nms: ['Skills/paper-nms/PLATFORM.md', 'Skills/_shared/nms-threading.md', 'Skills/_shared/nms-obfuscation.md'],
  paper: ['Skills/paper-api/PLATFORM.md', 'Skills/_shared/paper-threading.md'],
};

const MIRROR_ROOTS = ['Skills', '.claude/skills'];
const SKILL_TEXT_FILES = ['SKILL.md', 'examples.md'];
const LINK = /\]\(([^)#\s]+)(#[^)\s]*)?\)/g;

const toPosix = (p) => p.split(path.sep).join('/');
const read = (repoPath) => fs.readFileSync(path.join(REPO_ROOT, repoPath), 'utf8').replace(/\r\n/g, '\n');

function listSkills() {
  return Object.keys(PLATFORM_DEFAULTS).flatMap((group) =>
    fs
      .readdirSync(path.join(REPO_ROOT, 'Skills', group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ group, id: entry.name })),
  );
}

/** Platform defaults plus any other shared doc the skill links as references/<name>. */
function docsForSkill({ group, id }) {
  const wanted = new Set(PLATFORM_DEFAULTS[group]);
  const text = SKILL_TEXT_FILES.map((f) => path.join('Skills', group, id, f))
    .filter((p) => fs.existsSync(path.join(REPO_ROOT, p)))
    .map(read)
    .join('\n');
  for (const [source, name] of Object.entries(SHARED_DOCS)) {
    if (text.includes(`references/${name}`)) wanted.add(source);
  }
  return [...wanted];
}

/** Rewrites relative links in a copied doc: bundled docs stay local, everything else goes to GitHub. */
function rewriteLinks(markdown, sourcePath, bundled) {
  const sourceDir = path.posix.dirname(sourcePath);
  return markdown.replace(LINK, (match, target, hash = '') => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) return match;
    const repoPath = path.posix.normalize(path.posix.join(sourceDir, target));
    const local = bundled.includes(repoPath) ? SHARED_DOCS[repoPath] : null;
    return `](${local ?? `${GITHUB_BLOB}/${repoPath}`}${hash})`;
  });
}

function renderCopy(source, bundled) {
  const header = `<!-- Generated from ${source} by scripts/sync-skill-references.mjs. Do not edit; change the source and re-run the script. -->\n\n`;
  return header + rewriteLinks(read(source), source, bundled);
}

/** Every expected references/ file (repo-relative POSIX path → content) for both mirrors. */
export function buildReferences() {
  const files = new Map();
  for (const skill of listSkills()) {
    const bundled = docsForSkill(skill);
    for (const source of bundled) {
      const content = renderCopy(source, bundled);
      for (const root of MIRROR_ROOTS) {
        files.set(`${root}/${skill.group}/${skill.id}/references/${SHARED_DOCS[source]}`, content);
      }
    }
  }
  return files;
}

/** references/ files on disk that the build would not produce (stale leftovers). */
export function findOrphans(expected) {
  const orphans = [];
  for (const root of MIRROR_ROOTS) {
    for (const { group, id } of listSkills()) {
      const dir = path.join(REPO_ROOT, root, group, id, 'references');
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        const repoPath = toPosix(path.join(root, group, id, 'references', file));
        if (!expected.has(repoPath)) orphans.push(repoPath);
      }
    }
  }
  return orphans;
}

function main() {
  const check = process.argv.includes('--check');
  const expected = buildReferences();
  const stale = [...expected].filter(([p, content]) => {
    const full = path.join(REPO_ROOT, p);
    return !fs.existsSync(full) || fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n') !== content;
  });
  const orphans = findOrphans(expected);

  if (check) {
    for (const [p] of stale) console.error(`stale: ${p}`);
    for (const p of orphans) console.error(`orphan: ${p}`);
    if (stale.length || orphans.length) {
      console.error('Run: node scripts/sync-skill-references.mjs');
      process.exit(1);
    }
    console.log(`references up to date (${expected.size} files)`);
    return;
  }

  for (const [p, content] of stale) {
    const full = path.join(REPO_ROOT, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  for (const p of orphans) fs.rmSync(path.join(REPO_ROOT, p));
  console.log(`wrote ${stale.length}, removed ${orphans.length}, total ${expected.size} files`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
