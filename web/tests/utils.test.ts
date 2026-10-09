/**
 * Characterization tests for shared/lib/utils.ts.
 */
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cn, formatDate, statusColor, statusLabel, statusTextColor } from '../shared/lib/utils';
import type { SkillStatus } from '../shared/types/skill';

const ORIGINAL_TZ = process.env.TZ;

describe('formatDate', () => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('returns empty string for empty input', () => {
    assert.equal(formatDate(''), '');
  });

  it('formats zh-TW by default', () => {
    process.env.TZ = 'UTC';
    assert.equal(formatDate('2026-04-30'), '2026年4月30日');
  });

  it('formats en-US when requested', () => {
    process.env.TZ = 'UTC';
    assert.equal(formatDate('2026-04-30', 'en-US'), 'April 30, 2026');
  });

  it('returns "Invalid Date" for unparseable input', () => {
    assert.equal(formatDate('not-a-date'), 'Invalid Date');
  });

  it('parses date-only strings as UTC: shows previous day in negative-offset zones', () => {
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(formatDate('2026-04-30'), '2026年4月29日');
  });
});

describe('status helpers', () => {
  it('statusLabel', () => {
    assert.equal(statusLabel('active'), '已發布');
    assert.equal(statusLabel('deprecated'), '已棄用');
    assert.equal(statusLabel('unknown' as SkillStatus), undefined);
  });

  it('statusTextColor', () => {
    assert.equal(statusTextColor('active'), 'text-[var(--color-accent)]');
    assert.equal(statusTextColor('deprecated'), 'text-[var(--color-error)]');
  });

  it('statusColor uses accent for active and error for deprecated', () => {
    assert.match(statusColor('active'), /--color-accent/);
    assert.match(statusColor('deprecated'), /--color-error/);
    assert.equal(statusColor('unknown' as SkillStatus), undefined);
  });
});

describe('cn', () => {
  it('drops falsy values and joins with a space', () => {
    assert.equal(cn('a', false, null, undefined, '', 'b'), 'a b');
    assert.equal(cn(), '');
  });
});
