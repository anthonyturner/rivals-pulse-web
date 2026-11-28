import { axisValues, axisWindow, positionOf, segmentWidths } from './chart-geometry';

describe('positionOf', () => {
  it('places a value as a share of the range', () => {
    expect(positionOf(50, 40, 60)).toBe(50);
    expect(positionOf(45, 40, 60)).toBe(25);
  });

  it('holds a value outside the range to its ends', () => {
    expect(positionOf(10, 40, 60)).toBe(0);
    expect(positionOf(99, 40, 60)).toBe(100);
  });

  it('never returns NaN for a range with no width or a value that is not a number', () => {
    expect(positionOf(5, 5, 5)).toBe(0);
    expect(positionOf(Number.NaN, 0, 100)).toBe(0);
  });
});

describe('axisWindow', () => {
  const win = { anchor: 50, pad: 2, step: 5, minSpan: 10, floor: 0, ceiling: 100 };

  it('rounds outwards to the step and keeps the anchor inside', () => {
    expect(axisWindow([47.1, 53.8], win)).toEqual({ min: 45, max: 60 });
  });

  it('never gets narrower than the minimum span', () => {
    expect(axisWindow([50.2], win)).toEqual({ min: 45, max: 55 });
  });

  it('widens towards the side with room when it hits the floor', () => {
    const window = axisWindow([2], { ...win, minSpan: 20 });

    expect(window.min).toBe(0);
    expect(window.max - window.min).toBeGreaterThanOrEqual(20);
  });

  it('gives the anchor window with nothing to measure and ignores values that are not numbers', () => {
    expect(axisWindow([], win)).toEqual({ min: 45, max: 55 });
    expect(axisWindow([Number.NaN], win)).toEqual({ min: 45, max: 55 });
  });

  it('stops widening when the floor and ceiling leave no room', () => {
    expect(axisWindow([], { ...win, floor: 48, ceiling: 52, minSpan: 10 })).toEqual({ min: 48, max: 52 });
  });
});

describe('axisValues', () => {
  it('lists the values from the start to the end', () => {
    expect(axisValues(40, 60, 5)).toEqual([40, 45, 50, 55, 60]);
  });

  it('stops before an end that is not on a step', () => {
    expect(axisValues(0, 12, 5)).toEqual([0, 5, 10]);
  });

  it('is empty for a backwards range or a step that cannot advance', () => {
    expect(axisValues(10, 0, 5)).toEqual([]);
    expect(axisValues(0, 10, 0)).toEqual([]);
  });
});

describe('segmentWidths', () => {
  it('shares 100 between the parts in proportion', () => {
    expect(segmentWidths([1, 3])).toEqual([25, 75]);
  });

  it('counts a negative part or one that is not a number as nothing', () => {
    expect(segmentWidths([2, -5, Number.NaN, 2])).toEqual([50, 0, 0, 50]);
  });

  it('gives no segments when there is nothing to share', () => {
    expect(segmentWidths([])).toEqual([]);
    expect(segmentWidths([0, 0])).toEqual([]);
  });
});
