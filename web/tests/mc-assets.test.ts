import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BLOCK_TEXTURES, HERO_ARTWORK, ITEM_ARTWORK } from '../config/mc-assets';
import { PIXEL_ICONS } from '../shared/ui/pixel-icons';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const exists = (url: string) => fs.existsSync(path.join(PUBLIC_DIR, url));

describe('mc-assets config', () => {
  it('every item artwork file exists under public/', () => {
    for (const [key, url] of Object.entries(ITEM_ARTWORK)) assert.ok(exists(url), `${key}: ${url}`);
  });

  it('only overrides known icons and never the currentColor UI glyphs', () => {
    for (const key of Object.keys(ITEM_ARTWORK)) {
      assert.ok(key in PIXEL_ICONS, key);
      assert.ok(key !== 'sun' && key !== 'moon', key);
    }
  });

  it('every hero landscape texture exists under public/', () => {
    for (const [key, url] of Object.entries(BLOCK_TEXTURES)) assert.ok(exists(url), `${key}: ${url}`);
  });

  it('hero screenshots, when configured, exist', () => {
    if (!HERO_ARTWORK) return;
    assert.ok(exists(HERO_ARTWORK.day) && exists(HERO_ARTWORK.night));
  });

  it('artwork is served from the committed public/art folder, not the raw dump', () => {
    for (const url of [...Object.values(ITEM_ARTWORK), ...Object.values(BLOCK_TEXTURES)]) {
      assert.ok(url.startsWith('/art/'), url);
    }
  });
});
