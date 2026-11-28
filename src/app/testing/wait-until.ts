/**
 * Resolves once `condition` holds, checking after each macrotask, so a spec waits for what the
 * browser actually does (an observer reporting, a queued event firing) rather than a fixed delay
 * that a slower machine can outrun. Rejects with `description` if it never holds within `timeoutMs`.
 */
export async function waitUntil(condition: () => boolean, description: string, timeoutMs = 3000): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting until ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
