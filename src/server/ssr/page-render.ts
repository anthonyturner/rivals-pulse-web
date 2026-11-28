import { DEFAULT_CACHE_CONTROL, NO_STORE_CACHE_CONTROL } from '../http/index.ts';

/**
 * How long a visitor or crawler waits on a server render before getting the browser shell
 * instead. A data page whose API never answers would otherwise hold the request until the
 * platform kills it; the shell still lets a browser draw the page itself.
 */
export const RENDER_BUDGET_MS = 8_000;

/**
 * Settles a server render into a response: the rendered page when it finishes within the budget,
 * the browser shell when it runs out of time or throws. `null` still means "not an Angular route",
 * so the caller can pass the request on.
 */
export async function renderWithinBudget(
  render: Promise<Response | null>,
  readShell: () => Promise<string>,
  budgetMs: number = RENDER_BUDGET_MS,
): Promise<Response | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outOfTime = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), budgetMs);
  });

  try {
    const result = await Promise.race([render, outOfTime]);

    if (result === 'timeout') {
      console.error(`Server render passed its ${budgetMs} ms budget; serving the browser shell.`);

      return shellResponse(await readShell());
    }

    return result && withCacheControl(result);
  } catch (error) {
    console.error('Server render failed; serving the browser shell.', error);

    return shellResponse(await readShell());
  } finally {
    clearTimeout(timer);
  }
}

function withCacheControl(response: Response): Response {
  if (response.headers.has('cache-control') || (response.status !== 200 && response.status !== 404)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('cache-control', DEFAULT_CACHE_CONTROL);

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function shellResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': NO_STORE_CACHE_CONTROL },
  });
}
