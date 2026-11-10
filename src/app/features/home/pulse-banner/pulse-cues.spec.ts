import { COLLISION_CUE, PULSE_CUES } from './pulse-cues';

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
});
