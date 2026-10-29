import type { PulseAtlasManifest } from './pulse-atlas';

export const PULSE_ATLAS_CONTRACT_URL =
  'https://github.com/anthonyturner/rivals-pulse-web/blob/master/docs/pulse-atlas.md';

export interface PulseAtlasPageLocation {
  /** Where this page is served, relative to the site root, e.g. `pulse-atlas/v1/index.html`. */
  pagePath: string;
  /** Where the manifest is served, relative to the site root. */
  manifestPath: string;
}

/**
 * The human-readable home page for the Pulse Atlas site, as a complete static
 * HTML document built from the manifest alone. File links are written relative
 * to `pagePath`, so the same manifest renders a page that works at the site
 * root and one that works inside the versioned folder.
 *
 * Every manifest value is HTML-escaped. The page has inline CSS and no
 * scripts, fonts or other network requests.
 */
export function renderPulseAtlasPage(
  manifest: PulseAtlasManifest,
  { pagePath, manifestPath }: PulseAtlasPageLocation,
): string {
  const folder = pagePath.slice(0, pagePath.lastIndexOf('/') + 1);
  const hrefTo = (path: string) => escapeHtml(path.startsWith(folder) ? path.slice(folder.length) : path);
  const fileName = (path: string) => escapeHtml(path.slice(path.lastIndexOf('/') + 1));

  const rows = manifest.files
    .map(
      (file) => `          <tr>
            <td data-label="Dataset">${escapeHtml(file.dataset)}</td>
            <td data-label="File"><a href="${hrefTo(file.path)}">${fileName(file.path)}</a></td>
            <td data-label="Size">${formatBytes(file.bytes)}</td>
            <td data-label="SHA-256"><code>${escapeHtml(file.sha256)}</code></td>
          </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pulse Atlas</title>
<style>
${STYLES}
</style>
</head>
<body>
  <main>
    <h1>Pulse Atlas</h1>
    <p>Pulse Atlas is RivalsPulse's public reference data for Marvel Rivals: heroes, the tier list, the glossary, maps and each hero's playstyle mix. It is published as plain JSON files that anyone can read, with no key and no sign-in.</p>

    <dl>
      <dt>Schema version</dt>
      <dd>${escapeHtml(String(manifest.schemaVersion))}</dd>
      <dt>Last changed</dt>
      <dd><time datetime="${escapeHtml(manifest.generatedAt)}">${escapeHtml(manifest.generatedAt)}</time></dd>
    </dl>

    <h2>Files</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th scope="col">Dataset</th><th scope="col">File</th><th scope="col">Size</th><th scope="col">SHA-256</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
    <p>This list is read from <a href="${hrefTo(manifestPath)}">${fileName(manifestPath)}</a>. Download a file again only when its SHA-256 has changed.</p>
    <p>The tier list is split by season: <code>tier-list.json</code> holds the current season and an index of every season, and there is one file per season at <code>tier-list/seasons/&lt;id&gt;.json</code>. The season files are not listed above; the index gives each one's path and SHA-256.</p>

    <p>How the files are shaped, and what they never contain, is in the <a href="${PULSE_ATLAS_CONTRACT_URL}">Pulse Atlas contract</a> on GitHub.</p>
  </main>
</body>
</html>
`;
}

// Hand-grouped rather than toLocaleString, which depends on the build machine's locale.
function formatBytes(bytes: number): string {
  return `${String(bytes).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} bytes`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLES = `:root { color-scheme: light dark; --bg: #ffffff; --fg: #1b1f27; --muted: #5b6472; --line: #d9dde4; --link: #0b57d0; --code-bg: #f1f3f7; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #11151c; --fg: #e6e9ef; --muted: #9aa4b2; --line: #2b3340; --link: #8ab4f8; --code-bg: #1b222d; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 56rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
h1 { margin: 0 0 0.5rem; font-size: 1.75rem; }
h2 { margin: 2rem 0 0.5rem; font-size: 1.25rem; }
a { color: var(--link); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 1rem 0; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
code { padding: 0.1rem 0.3rem; border-radius: 0.25rem; background: var(--code-bg); font: 0.8125rem/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
@media (max-width: 40rem) {
  thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  tr { display: block; padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
  td { display: block; padding: 0.15rem 0; border: 0; overflow-wrap: anywhere; }
  td::before { content: attr(data-label) ": "; color: var(--muted); }
}`;
