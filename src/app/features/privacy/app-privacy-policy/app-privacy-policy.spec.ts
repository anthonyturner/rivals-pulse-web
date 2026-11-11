import { APP_PRIVACY_POLICY } from './app-privacy-policy';
import policyMarkdown from './app-privacy-policy.md';
import pin from './app-privacy-policy.source.json';

async function sha256Of(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('the checked-in app privacy policy', () => {
  it('is the exact text the pin names, so a hand edit or a half-finished sync fails here, with no network', async () => {
    expect(await sha256Of(policyMarkdown.replace(/\r\n/g, '\n'))).toBe(pin.sha256);
  });

  it('is pinned to a commit of the overlay repository file the issue names', () => {
    expect(pin.repository).toBe('anthonyturner/rivals_pulse');
    expect(pin.path).toBe('docs/privacy-policy.md');
    expect(pin.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('parses, with a title, a last updated date and twelve numbered sections', () => {
    expect(APP_PRIVACY_POLICY.title).toBe('RivalsPulse Privacy Policy');
    expect(APP_PRIVACY_POLICY.lastUpdated.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(APP_PRIVACY_POLICY.sections.map((section) => section.heading.split('.')[0])).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1)),
    );
  });

  it('has no duplicate fragment id', () => {
    const ids = [
      ...APP_PRIVACY_POLICY.sections.map((section) => section.id),
      ...APP_PRIVACY_POLICY.sections.flatMap((section) =>
        section.blocks.flatMap((block) => (block.kind === 'subheading' ? [block.id] : [])),
      ),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});
