import { PAGE_CACHE_CONTROL, SHELL_CACHE_CONTROL, renderWithinBudget } from './page-render.ts';

const SHELL = '<app-root></app-root>';
const readShell = () => Promise.resolve(SHELL);

describe('renderWithinBudget', () => {
  beforeEach(() => {
    spyOn(console, 'error');
  });

  it('lets the CDN keep a page that rendered in time', async () => {
    const response = await renderWithinBudget(Promise.resolve(new Response('<h1>Glossary</h1>')), readShell);

    expect(await response?.text()).toBe('<h1>Glossary</h1>');
    expect(response?.headers.get('cache-control')).toBe(PAGE_CACHE_CONTROL);
  });

  it('keeps the status of a not-found page and lets the CDN keep it', async () => {
    const response = await renderWithinBudget(Promise.resolve(new Response('missing', { status: 404 })), readShell);

    expect(response?.status).toBe(404);
    expect(response?.headers.get('cache-control')).toBe(PAGE_CACHE_CONTROL);
  });

  it('leaves a redirect and a cache header the page chose alone', async () => {
    const redirect = new Response(null, { status: 302, headers: { location: '/heroes' } });
    const custom = new Response('x', { headers: { 'cache-control': 'no-cache' } });

    expect((await renderWithinBudget(Promise.resolve(redirect), readShell))?.headers.has('cache-control')).toBeFalse();
    expect((await renderWithinBudget(Promise.resolve(custom), readShell))?.headers.get('cache-control')).toBe('no-cache');
  });

  it('passes on a request that is not a page', async () => {
    expect(await renderWithinBudget(Promise.resolve(null), readShell)).toBeNull();
  });

  it('serves the browser shell, uncached, when the render never finishes', async () => {
    const response = await renderWithinBudget(new Promise<Response>(() => undefined), readShell, 10);

    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe(SHELL);
    expect(response?.headers.get('cache-control')).toBe(SHELL_CACHE_CONTROL);
  });

  it('serves the browser shell when the render throws', async () => {
    const response = await renderWithinBudget(Promise.reject(new Error('boom')), readShell);

    expect(await response?.text()).toBe(SHELL);
    expect(response?.headers.get('cache-control')).toBe(SHELL_CACHE_CONTROL);
  });
});
