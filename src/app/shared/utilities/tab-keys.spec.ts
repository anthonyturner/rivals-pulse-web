import { tabTargetIndex } from './tab-keys';

describe('tabTargetIndex', () => {
  it('moves one tab with the arrow keys', () => {
    expect(tabTargetIndex('ArrowRight', 1, 4)).toBe(2);
    expect(tabTargetIndex('ArrowLeft', 2, 4)).toBe(1);
  });

  it('wraps around the ends of the strip', () => {
    expect(tabTargetIndex('ArrowRight', 3, 4)).toBe(0);
    expect(tabTargetIndex('ArrowLeft', 0, 4)).toBe(3);
  });

  it('jumps to the ends with Home and End', () => {
    expect(tabTargetIndex('Home', 2, 4)).toBe(0);
    expect(tabTargetIndex('End', 1, 4)).toBe(3);
  });

  it('ignores every other key', () => {
    expect(tabTargetIndex('Enter', 1, 4)).toBeNull();
    expect(tabTargetIndex('a', 1, 4)).toBeNull();
  });
});
