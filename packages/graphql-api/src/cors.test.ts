import assert from 'node:assert';
import { createOriginMatcher } from './cors';

describe('createOriginMatcher', () => {
  it('matches exact origins case-insensitively', () => {
    const isAllowed = createOriginMatcher(['https://www.gbif.org']);
    assert.equal(isAllowed('https://www.gbif.org'), true);
    assert.equal(isAllowed('https://WWW.GBIF.ORG'), true);
    assert.equal(isAllowed('https://api.gbif.org'), false);
    assert.equal(isAllowed('http://www.gbif.org'), false); // scheme differs
  });

  it('matches wildcard subdomains and the apex', () => {
    const isAllowed = createOriginMatcher(['*.gbif.org']);
    assert.equal(isAllowed('https://www.gbif.org'), true);
    assert.equal(isAllowed('https://hosted-portals.gbif.org'), true);
    assert.equal(isAllowed('https://a.b.gbif.org'), true);
    assert.equal(isAllowed('https://gbif.org'), true); // apex
    assert.equal(isAllowed('https://gbif.org.evil.com'), false);
    assert.equal(isAllowed('https://notgbif.org'), false);
  });

  it('allows everything when "*" is present', () => {
    const isAllowed = createOriginMatcher(['*']);
    assert.equal(isAllowed('https://anything.example.com'), true);
  });

  it('blocks everything for an empty allowlist', () => {
    const isAllowed = createOriginMatcher([]);
    assert.equal(isAllowed('https://www.gbif.org'), false);
  });

  it('ignores empty/whitespace entries and unparseable origins', () => {
    const isAllowed = createOriginMatcher(['', '  ', '*.gbif.org']);
    assert.equal(isAllowed('https://www.gbif.org'), true);
    assert.equal(isAllowed('not-a-url'), false);
  });
});
