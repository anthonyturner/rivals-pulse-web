import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  HOME_TITLE,
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_PATH,
  PREVIEW_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_ORIGIN,
} from '../src/app/core/seo/site-meta.ts';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

/** The `content` of the tag whose `name` or `property` attribute is `key`. */
function tagContent(key: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*>`))?.[0];
  return tag?.match(/content="([^"]*)"/)?.[1];
}

describe('src/index.html link-preview tags', () => {
  const image = `${SITE_ORIGIN}${PREVIEW_IMAGE_PATH}`;

  it('carries the homepage title and description from site-meta', () => {
    assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], HOME_TITLE);
    assert.equal(tagContent('description'), SITE_DESCRIPTION);
  });

  it('has every Open Graph tag, with an absolute image URL', () => {
    assert.equal(tagContent('og:type'), 'website');
    assert.equal(tagContent('og:title'), HOME_TITLE);
    assert.equal(tagContent('og:description'), SITE_DESCRIPTION);
    assert.equal(tagContent('og:url'), `${SITE_ORIGIN}/`);
    assert.equal(tagContent('og:image'), image);
    assert.equal(tagContent('og:image:width'), String(PREVIEW_IMAGE_WIDTH));
    assert.equal(tagContent('og:image:height'), String(PREVIEW_IMAGE_HEIGHT));
  });

  it('has every Twitter card tag, with an absolute image URL', () => {
    assert.equal(tagContent('twitter:card'), 'summary_large_image');
    assert.equal(tagContent('twitter:title'), HOME_TITLE);
    assert.equal(tagContent('twitter:description'), SITE_DESCRIPTION);
    assert.equal(tagContent('twitter:image'), image);
  });

  it('points its canonical link at the production origin', () => {
    const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1];
    assert.equal(canonical, `${SITE_ORIGIN}/`);
  });
});
