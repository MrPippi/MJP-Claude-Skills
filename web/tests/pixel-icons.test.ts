import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PIXEL_ICONS, toRects } from '../shared/ui/pixel-icons';

describe('PIXEL_ICONS', () => {
  for (const [name, icon] of Object.entries(PIXEL_ICONS)) {
    it(`${name} is a square grid using only palette colours`, () => {
      const size = icon.rows.length;
      assert.ok(size === 8 || size === 16, `${name} height ${size}`);
      icon.rows.forEach((row, i) => {
        assert.equal(row.length, size, `${name} row ${i} is ${row.length} wide`);
        for (const ch of row) assert.ok(ch === '.' || ch in icon.palette, `${name} row ${i} unknown '${ch}'`);
      });
    });
  }
});

describe('toRects', () => {
  it('merges horizontal runs and skips transparent cells', () => {
    const rects = toRects({ palette: { a: '#111', b: '#222' }, rows: ['aab.', '.bbb'] });
    assert.deepEqual(rects, [
      { x: 0, y: 0, w: 2, color: '#111' },
      { x: 2, y: 0, w: 1, color: '#222' },
      { x: 1, y: 1, w: 3, color: '#222' },
    ]);
  });
});
