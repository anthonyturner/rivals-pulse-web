import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

/** The AdSense publisher id is public and appears in three files that nothing else ties together. */
describe('AdSense publisher id', () => {
  const loader = read('../src/index.html').match(/adsbygoogle\.js\?client=(ca-pub-\d+)/)?.[1];

  it('is in the site-wide AdSense loader in src/index.html', () => {
    assert.ok(loader, 'src/index.html has no adsbygoogle.js?client=ca-pub-... script');
  });

  it('is the same in the AdSense config the ad units use', () => {
    const config = read('../src/app/shared/components/ad-slot/adsense/adsense.config.ts').match(
      /publisherId:\s*'(ca-pub-\d+)'/,
    )?.[1];

    assert.equal(config, loader);
  });

  it('is the same in public/ads.txt, as pub-... on a DIRECT google.com line', () => {
    const line = read('../public/ads.txt')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('google.com,'));

    assert.ok(loader);
    const [domain, account, relationship] = (line ?? '').split(',').map((field) => field.trim());
    assert.deepEqual([domain, account, relationship], ['google.com', loader.replace('ca-', ''), 'DIRECT']);
  });
});
