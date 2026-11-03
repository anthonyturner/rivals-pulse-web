import { timestampSeconds, videoUrlAt } from './youtube-timestamp';

describe('youtube timestamps', () => {
  it('reads minutes and hours', () => {
    expect(timestampSeconds('0:00')).toBe(0);
    expect(timestampSeconds('3:01')).toBe(181);
    expect(timestampSeconds('1:03:30')).toBe(3810);
  });

  it('adds the start time and keeps the other parameters', () => {
    expect(videoUrlAt('https://youtu.be/abc123?si=token', '1:36')).toBe(
      'https://youtu.be/abc123?si=token&t=96s',
    );
    expect(videoUrlAt('https://www.youtube.com/watch?v=abc123', '0:10')).toBe(
      'https://www.youtube.com/watch?v=abc123&t=10s',
    );
  });
});
