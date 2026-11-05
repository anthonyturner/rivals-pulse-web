import { dayLabel } from './day-label';

describe('dayLabel', () => {
  it('names a calendar day', () => {
    expect(dayLabel('2026-10-29')).toBe('Thu 29 Oct');
  });

  it('shows anything else as it came', () => {
    expect(dayLabel('soon')).toBe('soon');
  });
});
