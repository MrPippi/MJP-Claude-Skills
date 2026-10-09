import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { legacyRedirectTarget, ROUTES, withBasePath } from '../config/routes';

describe('legacyRedirectTarget', () => {
  const cases: Array<[string, string | null]> = [
    ['/skills', '/docs/skills'],
    ['/skills/', '/docs/skills'],
    ['/skills/nms-packet-sender', '/docs/skills/nms-packet-sender'],
    ['/categories', '/docs/skills'],
    ['/categories/nms-ui', '/docs/skills?category=nms-ui'],
    ['/guide', '/docs/getting-started'],
    ['/docs/skills', null],
    ['/unknown', null],
  ];
  for (const [from, to] of cases) {
    it(`${from} → ${to}`, () => assert.equal(legacyRedirectTarget(from), to));
  }
});

describe('ROUTES', () => {
  it('builds skill and filter URLs', () => {
    assert.equal(ROUTES.skill('nms-boss-event'), '/docs/skills/nms-boss-event');
    assert.equal(ROUTES.skillsFiltered({ category: 'nms-ui' }), '/docs/skills?category=nms-ui');
    assert.equal(ROUTES.skillsFiltered({ platform: 'paper-api' }), '/docs/skills?platform=paper-api');
    assert.equal(ROUTES.skillsFiltered({}), '/docs/skills');
  });

  it('withBasePath is a no-op when NEXT_PUBLIC_BASE_PATH is unset', { skip: Boolean(process.env.NEXT_PUBLIC_BASE_PATH) }, () => {
    assert.equal(withBasePath('/docs'), '/docs');
  });
});
