import { COLLISION_CUE, PULSE_CUES, cuesInWindow } from './pulse-cues';

describe('the pulse cues', () => {
  const kinds = (side: string): string[] => PULSE_CUES.filter(cue => cue.side === side).map(cue => cue.kind);

  it('give each pulse a lub and a dub on its own side, and the clash a crack and a boom in the middle', () => {
    expect(kinds('left')).toEqual(['lub', 'dub']);
    expect(kinds('right')).toEqual(['lub', 'dub']);
    expect(kinds('centre')).toEqual(['crack', 'boom']);
  });

  it('sound the heartbeats on the way in and the clash at 55% of the loop, with the boom just behind the crack', () => {
    const heartbeats = PULSE_CUES.filter(cue => cue.side !== 'centre');
    expect(heartbeats.every(cue => cue.at > 0.2 && cue.at < COLLISION_CUE.at)).toBeTrue();
    expect(COLLISION_CUE.at).toBe(0.55);
    const boom = PULSE_CUES.find(cue => cue.kind === 'boom');
    expect(boom?.at).toBeGreaterThan(COLLISION_CUE.at);
    expect(boom?.at).toBeLessThan(COLLISION_CUE.at + 0.02);
  });

  it('put the dub after the lub on both sides', () => {
    for (const side of ['left', 'right']) {
      const [lub, dub] = PULSE_CUES.filter(cue => cue.side === side);
      expect(dub.at).toBeGreaterThan(lub.at);
    }
  });

  describe('in a window of the animation clock', () => {
    const loopMs = 2800;
    const collisionMs = COLLISION_CUE.at * loopMs;

    it('lists the cues that fall inside it, soonest first', () => {
      const due = cuesInWindow(PULSE_CUES, loopMs, 0, loopMs);

      expect(due.length).toBe(PULSE_CUES.length);
      expect(due.map(item => item.atMs)).toEqual([...due.map(item => item.atMs)].sort((a, b) => a - b));
      expect(due.at(-1)?.cue.kind).toBe('boom');
    });

    it('counts the start of the window and not its end', () => {
      expect(cuesInWindow([COLLISION_CUE], loopMs, collisionMs, collisionMs + 1).length).toBe(1);
      expect(cuesInWindow([COLLISION_CUE], loopMs, collisionMs - 1, collisionMs).length).toBe(0);
    });

    it('finds the cue on a later loop, at the same place in it', () => {
      const [later] = cuesInWindow([COLLISION_CUE], loopMs, 7 * loopMs, 8 * loopMs);

      expect(later.atMs).toBeCloseTo(7 * loopMs + collisionMs, 6);
    });

    it('finds the cues either side of the point where the loop starts over', () => {
      const due = cuesInWindow([COLLISION_CUE], loopMs, collisionMs + 1, collisionMs + loopMs + 1);

      expect(due.map(item => item.atMs)).toEqual([collisionMs + loopMs]);
    });

    it('finds several loops at once, one cue each', () => {
      expect(cuesInWindow([COLLISION_CUE], loopMs, 0, 5 * loopMs).length).toBe(5);
    });

    it('lists nothing for an empty window or a loop of no length', () => {
      expect(cuesInWindow(PULSE_CUES, loopMs, 100, 100)).toEqual([]);
      expect(cuesInWindow(PULSE_CUES, 0, 0, 1000)).toEqual([]);
    });

    it('follows a different loop length, because a cue is a fraction of the loop', () => {
      const [cue] = cuesInWindow([COLLISION_CUE], 4000, 0, 4000);

      expect(cue.atMs).toBeCloseTo(2200, 6);
    });
  });
});
