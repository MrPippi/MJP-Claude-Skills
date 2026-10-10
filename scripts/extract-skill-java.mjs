#!/usr/bin/env node
/**
 * Extracts every complete Java compilation unit (a ```java block with a `package` line)
 * from the skills and writes it as a source file for one Minecraft version, so
 * verify/ can compile the templates against that version's Paper dev bundle.
 *
 *   node scripts/extract-skill-java.mjs 26.2      # → verify/build/extracted/26.2/<group>/<skill>/<set>/...
 *   node scripts/extract-skill-java.mjs 1.21.11
 *
 * Version markers (see Skills/paper-nms/PLATFORM.md):
 *   `code; // @1.21.11: other code;`  → for 1.21.11 the line becomes `other code;`
 *   first line `// @only <version>`   → the block is skipped for other versions
 *
 * Partial snippets (no `package` line) are not compiled. Exits 1 on conflicting
 * duplicate files or NMS imports in Paper API skills.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TARGETS = ['26.2', '1.21.11'];
const DEFAULT_TARGET = '26.2';
const GROUPS = ['nms', 'paper'];
const SKILL_FILES = ['SKILL.md', 'examples.md'];

const JAVA_BLOCK = /```java\r?\n([\s\S]*?)```/g;
const PACKAGE = /^package\s+([\w.]+)\s*;/m;
const TOP_LEVEL_TYPE =
  /^(public\s+)?(?:(?:abstract|final|sealed|non-sealed|strictfp)\s+)*(?:class|interface|record|enum|@interface)\s+(\w+)/gm;
const ONLY = /^\s*\/\/\s*@only\s+(\S+)/;
const VERSION_ALT = /^(\s*).*?\/\/\s*@1\.21\.11:\s?(.*)$/;
const NMS_IMPORT = /^import\s+(?:static\s+)?(?:net\.minecraft|org\.bukkit\.craftbukkit)\./m;

/** Applies the version markers; returns null when the block does not apply to `target`. */
export function applyTarget(code, target) {
  const firstLine = code.split('\n').find((l) => l.trim() !== '') ?? '';
  const only = firstLine.match(ONLY);
  if (only && only[1] !== target) return null;
  if (target !== '1.21.11') return code;
  return code
    .split('\n')
    .map((line) => {
      const alt = line.match(VERSION_ALT);
      return alt ? `${alt[1]}${alt[2]}` : line;
    })
    .join('\n');
}

/** File name of a compilation unit: its public top-level type, else the first top-level type. */
export function primaryTypeName(code) {
  const types = [...code.matchAll(TOP_LEVEL_TYPE)];
  const publicType = types.find((m) => m[1]);
  return (publicType ?? types[0])?.[2] ?? null;
}

function collectUnits(group, id, file, target, problems) {
  const units = new Map();
  let skippedSnippets = 0;
  const full = path.join(REPO_ROOT, 'Skills', group, id, file);
  if (!fs.existsSync(full)) return { units, skippedSnippets };
  const where = `Skills/${group}/${id}/${file}`;
  const markdown = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
  for (const [, block] of markdown.matchAll(JAVA_BLOCK)) {
    const pkg = block.match(PACKAGE);
    if (!pkg) {
      skippedSnippets += 1;
      continue;
    }
    const code = applyTarget(block, target);
    if (code === null) continue;
    if (group === 'paper' && NMS_IMPORT.test(code)) problems.push(`${where}: Paper API skill imports NMS/CraftBukkit`);
    const type = primaryTypeName(code);
    if (!type) {
      problems.push(`${where}: no top-level type in package ${pkg[1]}`);
      continue;
    }
    const relPath = `${pkg[1].replace(/\./g, '/')}/${type}.java`;
    const existing = units.get(relPath);
    if (existing === undefined) units.set(relPath, code);
    else if (existing !== code) problems.push(`${where}: conflicting definitions of ${relPath}`);
  }
  return { units, skippedSnippets };
}

/**
 * Two compile sets per skill: `skill` (SKILL.md templates) and, when examples.md has
 * complete files, `examples` (the templates with the example files layered on top,
 * since examples may extend or replace a template class).
 */
function extractSkill(group, id, target) {
  const problems = [];
  const template = collectUnits(group, id, 'SKILL.md', target, problems);
  const examples = collectUnits(group, id, 'examples.md', target, problems);
  const sets = { skill: template.units };
  if (examples.units.size) sets.examples = new Map([...template.units, ...examples.units]);
  return { sets, problems, skippedSnippets: template.skippedSnippets + examples.skippedSnippets };
}

function main() {
  const target = process.argv[2] ?? DEFAULT_TARGET;
  if (!TARGETS.includes(target)) {
    console.error(`Unknown target "${target}". Use one of: ${TARGETS.join(', ')}`);
    process.exit(2);
  }
  const outRoot = path.join(REPO_ROOT, 'verify', 'build', 'extracted', target);
  fs.rmSync(outRoot, { recursive: true, force: true });

  let files = 0;
  let snippets = 0;
  const problems = [];
  for (const group of GROUPS) {
    const groupDir = path.join(REPO_ROOT, 'Skills', group);
    for (const id of fs.readdirSync(groupDir).sort()) {
      if (!fs.statSync(path.join(groupDir, id)).isDirectory()) continue;
      const result = extractSkill(group, id, target);
      problems.push(...result.problems);
      snippets += result.skippedSnippets;
      for (const [set, units] of Object.entries(result.sets)) {
        for (const [relPath, code] of units) {
          const out = path.join(outRoot, group, id, set, relPath);
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, code);
          files += 1;
        }
      }
    }
  }

  for (const problem of problems) console.error(`error: ${problem}`);
  console.log(`[${target}] extracted ${files} files; skipped ${snippets} partial snippets`);
  if (problems.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
