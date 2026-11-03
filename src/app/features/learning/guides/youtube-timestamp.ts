/** Turns "m:ss" or "h:mm:ss" into seconds. */
export function timestampSeconds(timestamp: string): number {
  return timestamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

/** The video's address with a start time, keeping any other query parameters it already has. */
export function videoUrlAt(videoUrl: string, timestamp: string): string {
  const url = new URL(videoUrl);
  url.searchParams.set('t', `${timestampSeconds(timestamp)}s`);

  return url.toString();
}
