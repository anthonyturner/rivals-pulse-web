/** The enemy heroes the planner opens with chosen. The hub's preview shows these too. */
export const DEFAULT_DIVE_THREAT_IDS: readonly string[] = ['angela', 'black-cat', 'spider-man'];

/** The enemy dive heroes the planner offers, in display order, with the advice for facing each. */
export const DIVE_THREATS: readonly { id: string; instruction: string }[] = [
  {
    id: 'angela',
    instruction:
      'Do not chase her flight path. Hold cover and peel tools, then focus her after she lands or commits Assassin’s Charge.',
  },
  {
    id: 'black-cat',
    instruction:
      'Track her staging angle, force her defensive relic or return dash, and punish the spot where she has to reappear.',
  },
  {
    id: 'spider-man',
    instruction:
      'Call the web mark early. Bubble or heal the marked ally and layer control where his combo has to finish.',
  },
  {
    id: 'psylocke',
    instruction:
      'Keep supports in mutual line of sight, reveal her approach with damage, and deny the isolated target she needs.',
  },
  {
    id: 'black-panther',
    instruction:
      'Stand inside a protected zone and interrupt his dash-reset rhythm instead of following him away from the team.',
  },
  {
    id: 'iron-fist',
    instruction:
      'Kite his defensive window, then focus him together once his sustain and gap close have been spent.',
  },
  {
    id: 'magik',
    instruction:
      'Respect her portal timing, avoid feeding grouped cleave, and control the exit point when she enters the backline.',
  },
  {
    id: 'venom',
    instruction:
      'Do not panic into his bonus health. Stabilize the landing, deny follow-up damage, then burn him on the exit.',
  },
];
