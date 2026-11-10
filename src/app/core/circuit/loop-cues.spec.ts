import { cuesInWindow } from './loop-cues';

describe('cuesInWindow', () => {
  const loopMs = 2800;
  const half = { at: 0.5 };
  const quarter = { at: 0.25 };

  it('lists the cues that fall inside the window, soonest first', () => {
    const due = cuesInWindow([half, quarter], loopMs, 0, loopMs);

    expect(due.map(item => item.cue)).toEqual([quarter, half]);
    expect(due.map(item => item.atMs)).toEqual([700, 1400]);
  });

  it('counts the start of the window and not its end', () => {
    expect(cuesInWindow([half], loopMs, 1400, 1401).length).toBe(1);
    expect(cuesInWindow([half], loopMs, 1399, 1400).length).toBe(0);
  });

  it('finds the cue on a later loop, at the same place in it', () => {
    const [later] = cuesInWindow([half], loopMs, 7 * loopMs, 8 * loopMs);

    expect(later.atMs).toBeCloseTo(7 * loopMs + 1400, 6);
  });

  it('finds the cues either side of the point where the loop starts over', () => {
    const due = cuesInWindow([half], loopMs, 1401, 1401 + loopMs);

    expect(due.map(item => item.atMs)).toEqual([1400 + loopMs]);
  });

  it('finds several loops at once, one cue each', () => {
    expect(cuesInWindow([half], loopMs, 0, 5 * loopMs).length).toBe(5);
  });

  it('lists nothing for an empty window or a loop of no length', () => {
    expect(cuesInWindow([half], loopMs, 100, 100)).toEqual([]);
    expect(cuesInWindow([half], 0, 0, 1000)).toEqual([]);
  });

  it('follows a different loop length, because a cue is a fraction of the loop', () => {
    const [cue] = cuesInWindow([half], 4000, 0, 4000);

    expect(cue.atMs).toBeCloseTo(2000, 6);
  });
});
