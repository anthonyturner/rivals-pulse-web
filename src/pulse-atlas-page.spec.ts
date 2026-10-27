import { PulseAtlasManifest } from './pulse-atlas';
import { PULSE_ATLAS_CONTRACT_URL, renderPulseAtlasPage } from './pulse-atlas-page';

const manifest: PulseAtlasManifest = {
  schemaVersion: 1,
  generatedAt: '2026-10-26T12:00:00.000Z',
  files: [
    { dataset: 'heroes', path: 'pulse-atlas/v1/heroes.json', sha256: 'a'.repeat(64), bytes: 615438 },
    { dataset: 'maps', path: 'pulse-atlas/v1/maps.json', sha256: 'b'.repeat(64), bytes: 2156 },
  ],
};

const MANIFEST_PATH = 'pulse-atlas/v1/manifest.json';
const rootPage = { pagePath: 'index.html', manifestPath: MANIFEST_PATH };
const feedPage = { pagePath: 'pulse-atlas/v1/index.html', manifestPath: MANIFEST_PATH };

describe('renderPulseAtlasPage', () => {
  it('says what Pulse Atlas is and shows the schema version and generation time', () => {
    const html = renderPulseAtlasPage(manifest, rootPage);

    expect(html).toContain('<h1>Pulse Atlas</h1>');
    expect(html).toContain("RivalsPulse's public reference data");
    expect(html).toContain('<dd>1</dd>');
    expect(html).toContain('<time datetime="2026-10-26T12:00:00.000Z">2026-10-26T12:00:00.000Z</time>');
  });

  it('lists each dataset with its file link, size and sha256', () => {
    const html = renderPulseAtlasPage(manifest, rootPage);

    expect(html).toContain('<a href="pulse-atlas/v1/heroes.json">heroes.json</a>');
    expect(html).toContain('615,438 bytes');
    expect(html).toContain(`<code>${'a'.repeat(64)}</code>`);
    expect(html).toContain('<a href="pulse-atlas/v1/maps.json">maps.json</a>');
    expect(html).toContain('2,156 bytes');
    expect(html).toContain(`<code>${'b'.repeat(64)}</code>`);
  });

  it('links the manifest and the contract document', () => {
    const html = renderPulseAtlasPage(manifest, rootPage);

    expect(html).toContain('<a href="pulse-atlas/v1/manifest.json">manifest.json</a>');
    expect(html).toContain(`<a href="${PULSE_ATLAS_CONTRACT_URL}">`);
    expect(PULSE_ATLAS_CONTRACT_URL).toBe(
      'https://github.com/anthonyturner/rivals-pulse-web/blob/master/docs/pulse-atlas.md',
    );
  });

  it('writes file links that resolve from where the page is served', () => {
    const html = renderPulseAtlasPage(manifest, feedPage);

    expect(html).toContain('<a href="heroes.json">heroes.json</a>');
    expect(html).toContain('<a href="manifest.json">manifest.json</a>');
    expect(html).not.toContain('href="pulse-atlas/v1/');
  });

  it('escapes every dynamic value', () => {
    const hostile: PulseAtlasManifest = {
      schemaVersion: 1,
      generatedAt: '<script>alert(1)</script>',
      files: [
        {
          dataset: 'heroes',
          path: 'pulse-atlas/v1/"><img src=x onerror=alert(1)>.json',
          sha256: '<b>"&\'',
          bytes: 1,
        },
      ],
    };
    const html = renderPulseAtlasPage(hostile, rootPage);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;&quot;&amp;&#39;');
  });

  it('is self-contained static HTML that follows the reader light or dark setting', () => {
    const html = renderPulseAtlasPage(manifest, rootPage);

    expect(html.startsWith('<!doctype html>')).toBeTrue();
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).not.toMatch(/<script|<link|@import|url\(/i);
    expect(html).not.toMatch(/(src|href)="https?:\/\/(?!github\.com\/anthonyturner\/)/);
  });
});
