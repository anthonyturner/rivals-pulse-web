export type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface JarvisExchange {
  question: string;
  answer: string;
}

export interface JarvisStateLook {
  /** How far the sphere swells out of its resting radius. */
  swell: number;
  /** Strength of the gold inner glow and the thinking arcs. */
  gold: number;
  /** Multiplier on the sphere and bead rotation speed. */
  spin: number;
}

export const JARVIS_STATES: readonly JarvisState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
];

export const JARVIS_STATE_LOOKS: Readonly<Record<JarvisState, JarvisStateLook>> = {
  idle: { swell: 0, gold: 0.25, spin: 1 },
  listening: { swell: 0.08, gold: 0.2, spin: 1.4 },
  thinking: { swell: 0.02, gold: 0.9, spin: 4.5 },
  speaking: { swell: 0.05, gold: 0.55, spin: 1.8 },
};

/**
 * Scripted answers. The console does not talk to a model or to ElevenLabs yet:
 * real voice needs its own website agent and rate-limit bucket, kept separate
 * from the Overwolf app's shared token function.
 */
export const JARVIS_EXCHANGES: readonly JarvisExchange[] = [
  {
    question: "How's my healing?",
    answer:
      "You've healed 14,200 so far, about 18 percent above your Luna Snow average this season. "
      + 'Stay behind Magneto and keep it up.',
  },
  {
    question: "Who's their best player?",
    answer:
      'Their Hela. Eleven eliminations, two deaths, Grandmaster 2. She has 41 Hela matches this '
      + 'season, so expect her on the high ground.',
  },
  {
    question: 'Did I play these guys last match?',
    answer:
      'Two of them. Kestrel was on your team on Yggdrasill Path. Nightjar was against you, on Magik.',
  },
];

/**
 * Where people install the overlay. Empty until the app clears Overwolf's QA
 * review and gets a listing, and the console renders an unlinked "coming soon"
 * state while it is — never a placeholder URL.
 */
export const OVERWOLF_APP_URL = '';
