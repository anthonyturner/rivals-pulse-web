import { Hero, HeroAbility, HeroBuildProfileRationale, HeroRole } from './hero.model';

export type HeroBuildType = 'Utility' | 'Damage' | 'Sustain' | 'Mobility' | 'Ultimate';

export type HeroBuildProfile = Record<HeroBuildType, number>;

type ScoreProfile = Record<HeroBuildType, number>;
type SignalRule = [RegExp, number];

export const buildProfileSource = {
  label: 'Marvel Rivals Wiki hero and ability descriptions',
  url: 'https://marvelrivals.fandom.com/wiki/Category:Heroes',
};

const buildTypes: HeroBuildType[] = ['Utility', 'Damage', 'Sustain', 'Mobility', 'Ultimate'];

const signalRules: Record<HeroBuildType, SignalRule[]> = {
  Utility: [
    [/\b(shield|barrier|wall|field|zone|construct|turret|trap|mine|portal|web|smoke)\b/gi, 1.1],
    [/\b(revive|resurrect|cocoon|invincib|immune|cleanse|save|protect|damage reduction)\b/gi, 1.7],
    [/\b(stun|slow|freeze|root|snare|knock|launch|pull|push|taunt|blind|silence|disrupt|interrupt)\b/gi, 1.45],
    [/\b(scan|reveal|detect|mark|vulnerability|weaken|boost|buff|debuff|grant)\b/gi, 1.25],
    [/\b(line of sight|control|deny|block|peel|crowd control|cc)\b/gi, 1.2],
  ],
  Damage: [
    [/\b(damage|damaging|attack|strike|slash|shot|shoot|fire|blast|beam|projectile|explosion|explode)\b/gi, 0.9],
    [/\b(burst|critical|headshot|combo|detonate|execute|pierce|penetrate|bonus damage)\b/gi, 1.35],
    [/\b(vulnerability|damage boost|damage over time|dot|bleed|burn|ignite|poison)\b/gi, 1.25],
    [/\b(eliminate|ko|kill|finish|duel|pressure|poke)\b/gi, 1],
  ],
  Sustain: [
    [/\b(heal|healing|restore|regenerate|recovery|recover|mend|lifesteal|life steal)\b/gi, 1.45],
    [/\b(health|bonus health|overhealth|armor|shield|barrier|damage reduction|mitigate)\b/gi, 1.2],
    [/\b(revive|resurrect|invincib|immune|survive|sustain|save|protect)\b/gi, 1.4],
  ],
  Mobility: [
    [/\b(dash|leap|jump|double jump|swing|fly|flight|hover|glide|soar|teleport|blink|burrow)\b/gi, 1.55],
    [/\b(speed|movement|accelerate|sprint|charge|rush|lunge|launch forward|reposition)\b/gi, 1.2],
    [/\b(vertical|high ground|airborne|ascend|descend|escape|chase|dive)\b/gi, 1.2],
  ],
  Ultimate: [
    [/\b(ultimate|energy cost|ult|teamfight|fight-winning|empowered|transform|summon)\b/gi, 1.4],
    [/\b(revive|resurrect|massive|devastating|unleash|global|large area|area)\b/gi, 0.7],
  ],
};

const roleBase: Record<HeroRole, ScoreProfile> = {
  Vanguard: { Utility: 2.2, Damage: 0.8, Sustain: 2.8, Mobility: 0.9, Ultimate: 0.7 },
  Duelist: { Utility: 0.8, Damage: 3.4, Sustain: 0.5, Mobility: 1.4, Ultimate: 0.7 },
  Strategist: { Utility: 2.6, Damage: 0.8, Sustain: 3.2, Mobility: 0.8, Ultimate: 0.8 },
  'Multi-Role': { Utility: 2.2, Damage: 2.2, Sustain: 2.2, Mobility: 1.6, Ultimate: 0.8 },
};

const roleWeights: Record<HeroRole, ScoreProfile> = {
  Vanguard: { Utility: 1.05, Damage: 0.6, Sustain: 1.18, Mobility: 1, Ultimate: 1 },
  Duelist: { Utility: 0.82, Damage: 1.08, Sustain: 0.72, Mobility: 1.08, Ultimate: 1 },
  Strategist: { Utility: 1.12, Damage: 0.64, Sustain: 1.22, Mobility: 0.92, Ultimate: 1 },
  'Multi-Role': { Utility: 1.08, Damage: 1.08, Sustain: 1.08, Mobility: 1.08, Ultimate: 1.08 },
};

const normalizers: ScoreProfile = {
  Utility: 24,
  Damage: 30,
  Sustain: 17,
  Mobility: 16,
  Ultimate: 14,
};

const ultimateValueOverrides: Record<string, number> = {
  'Adam Warlock': 9,
  Angela: 7,
  'Black Cat': 7,
  'Black Panther': 7,
  'Black Widow': 6,
  Blade: 8,
  Hulk: 7,
  'Captain America': 6,
  'Cloak & Dagger': 8,
  Daredevil: 7,
  Deadpool: 10,
  'Devil Dinosaur': 7,
  'Doctor Strange': 8,
  'Elsa Bloodstone': 7,
  'Emma Frost': 8,
  Gambit: 8,
  Groot: 7,
  Hawkeye: 7,
  Hela: 8,
  'Human Torch': 8,
  'Invisible Woman': 10,
  'Iron Fist': 7,
  'Iron Man': 8,
  'Jeff the Land Shark': 8,
  Loki: 8,
  'Luna Snow': 9,
  Magik: 8,
  Magneto: 8,
  Mantis: 8,
  'Mister Fantastic': 7,
  'Moon Knight': 7,
  Namor: 7,
  'Peni Parker': 7,
  Phoenix: 8,
  Psylocke: 8,
  'Rocket Raccoon': 8,
  Rogue: 8,
  'Scarlet Witch': 8,
  'Spider-Man': 7,
  'Squirrel Girl': 7,
  'Star-Lord': 8,
  Storm: 8,
  'The Punisher': 7,
  'The Thing': 7,
  Thor: 8,
  Ultron: 8,
  Venom: 8,
  'White Fox': 8,
  'Winter Soldier': 7,
  Wolverine: 8,
};

const mobilityValueOverrides: Record<string, number> = {
  'Adam Warlock': 3,
  Angela: 9,
  'Black Cat': 9,
  'Black Panther': 10,
  'Black Widow': 4,
  Blade: 8,
  Hulk: 9,
  'Captain America': 8,
  'Cloak & Dagger': 5,
  Daredevil: 8,
  Deadpool: 9,
  'Devil Dinosaur': 6,
  'Doctor Strange': 4,
  'Elsa Bloodstone': 7,
  'Emma Frost': 4,
  Gambit: 5,
  Groot: 2,
  Hawkeye: 5,
  Hela: 5,
  'Human Torch': 9,
  'Invisible Woman': 5,
  'Iron Fist': 9,
  'Iron Man': 9,
  'Jeff the Land Shark': 6,
  Loki: 6,
  'Luna Snow': 8,
  Magik: 9,
  Magneto: 4,
  Mantis: 6,
  'Mister Fantastic': 6,
  'Moon Knight': 7,
  Namor: 4,
  'Peni Parker': 5,
  Phoenix: 8,
  Psylocke: 9,
  'Rocket Raccoon': 8,
  Rogue: 8,
  'Scarlet Witch': 7,
  'Spider-Man': 10,
  'Squirrel Girl': 7,
  'Star-Lord': 9,
  Storm: 9,
  'The Punisher': 3,
  'The Thing': 5,
  Thor: 8,
  Ultron: 8,
  Venom: 9,
  'White Fox': 5,
  'Winter Soldier': 6,
  Wolverine: 8,
};

const damageValueOverrides: Record<string, number> = {
  'Adam Warlock': 4,
  Angela: 6,
  'Black Cat': 8,
  'Black Panther': 8,
  'Black Widow': 8,
  Blade: 8,
  Hulk: 5,
  'Captain America': 5,
  'Cloak & Dagger': 4,
  Daredevil: 8,
  Deadpool: 9,
  'Devil Dinosaur': 6,
  'Doctor Strange': 5,
  'Elsa Bloodstone': 8,
  'Emma Frost': 5,
  Gambit: 5,
  Groot: 4,
  Hawkeye: 9,
  Hela: 9,
  'Human Torch': 9,
  'Invisible Woman': 4,
  'Iron Fist': 8,
  'Iron Man': 8,
  'Jeff the Land Shark': 3,
  Loki: 5,
  'Luna Snow': 3,
  Magik: 8,
  Magneto: 5,
  Mantis: 3,
  'Mister Fantastic': 7,
  'Moon Knight': 8,
  Namor: 7,
  'Peni Parker': 5,
  Phoenix: 9,
  Psylocke: 9,
  'Rocket Raccoon': 4,
  Rogue: 6,
  'Scarlet Witch': 7,
  'Spider-Man': 8,
  'Squirrel Girl': 8,
  'Star-Lord': 8,
  Storm: 7,
  'The Punisher': 9,
  'The Thing': 5,
  Thor: 6,
  Ultron: 4,
  Venom: 5,
  'White Fox': 4,
  'Winter Soldier': 8,
  Wolverine: 8,
};

const utilityValueOverrides: Record<string, number> = {
  'Adam Warlock': 8,
  Angela: 5,
  'Black Cat': 4,
  'Black Panther': 3,
  'Black Widow': 4,
  Blade: 4,
  Hulk: 6,
  'Captain America': 6,
  'Cloak & Dagger': 8,
  Daredevil: 6,
  Deadpool: 9,
  'Devil Dinosaur': 5,
  'Doctor Strange': 9,
  'Elsa Bloodstone': 4,
  'Emma Frost': 7,
  Gambit: 7,
  Groot: 9,
  Hawkeye: 4,
  Hela: 4,
  'Human Torch': 7,
  'Invisible Woman': 10,
  'Iron Fist': 5,
  'Iron Man': 4,
  'Jeff the Land Shark': 7,
  Loki: 9,
  'Luna Snow': 8,
  Magik: 5,
  Magneto: 8,
  Mantis: 8,
  'Mister Fantastic': 5,
  'Moon Knight': 6,
  Namor: 8,
  'Peni Parker': 9,
  Phoenix: 6,
  Psylocke: 5,
  'Rocket Raccoon': 9,
  Rogue: 7,
  'Scarlet Witch': 5,
  'Spider-Man': 5,
  'Squirrel Girl': 6,
  'Star-Lord': 4,
  Storm: 8,
  'The Punisher': 4,
  'The Thing': 7,
  Thor: 6,
  Ultron: 8,
  Venom: 6,
  'White Fox': 8,
  'Winter Soldier': 5,
  Wolverine: 4,
};

export function heroBuildTypes(): HeroBuildType[] {
  return [...buildTypes];
}

export function computeHeroBuildProfile(hero: Hero): HeroBuildProfile {
  const scores = emptyScoreProfile();
  addScores(scores, roleBase[hero.role]);

  scoreText(scores, [
    hero.summary,
    hero.playstyle,
    ...hero.strengths,
    ...hero.weaknesses,
    ...hero.counters,
    ...hero.synergies,
  ].join(' '), 0.8, 3);

  const abilities = collectAbilities(hero);

  for (const ability of abilities) {
    scoreAbility(scores, ability);
  }

  applyAbilityMixBonuses(scores, abilities.map(abilityText).join(' ').toLowerCase());
  applyRoleWeights(scores, hero.role);

  return applyProfileOverrides(hero, normalizeProfile(scores));
}

export function buildHeroBuildProfileRationale(
  hero: Hero,
  profile = computeHeroBuildProfile(hero),
): HeroBuildProfileRationale {
  const abilities = collectAbilities(hero);
  const technicalDetails = abilities.flatMap((ability) => ability.technicalDetails ?? []);
  const ultimateCount = abilities.filter(isUltimateAbility).length;
  const passiveCount = abilities.filter((ability) => /passive/i.test(ability.type)).length;

  return {
    source: buildProfileSource,
    reason: [
      `${hero.name} was scored from Fandom overview text, listed strengths/weaknesses, ability descriptions, and ${technicalDetails.length} technical detail entries.`,
      `${hero.role} role weighting sets the baseline, then descriptions adjust Utility, Damage, Sustain, Mobility, and Ultimate independently.`,
      `${ultimateCount} ultimate-labeled ability entry${ultimateCount === 1 ? '' : 'ies'} and ${passiveCount} passive entry${passiveCount === 1 ? '' : 'ies'} influenced the final profile.`,
    ].join(' '),
    strongestSignals: [...buildTypes].sort((a, b) => profile[b] - profile[a]).slice(0, 2),
  };
}

export function emptyHeroBuildProfile(): HeroBuildProfile {
  return { Utility: 0, Damage: 0, Sustain: 0, Mobility: 0, Ultimate: 0 };
}

function scoreAbility(scores: ScoreProfile, ability: HeroAbility): void {
  const text = abilityText(ability);
  const type = ability.type ?? '';
  const details = ability.technicalDetails ?? [];

  scoreText(scores, text, /normal attack/i.test(type) ? 0.42 : 0.55, 2);

  if (/normal attack/i.test(type)) {
    scores.Damage += 1.3;
  }

  if (/ultimate/i.test(type) || details.some((detail) => /energy cost/i.test(detail.label))) {
    scores.Ultimate += 2.4;
    scoreText(scores, text, 0.6, 2);

    if (/\b(heal|revive|resurrect|invincib|shield|barrier|damage reduction|protect)\b/i.test(text)) {
      scores.Ultimate += 2;
    }

    if (/\b(stun|slow|freeze|pull|knock|taunt|control|trap|prison)\b/i.test(text)) {
      scores.Ultimate += 1.2;
    }

    if (/\b(damage|burst|explode|blast|strike|slash|beam|meteor|storm)\b/i.test(text)) {
      scores.Ultimate += 1.2;
    }

    if (/\b(boost|amplify|enhance|grant|beacon|device|deploy)\b/i.test(text)) {
      scores.Ultimate += 1.5;
    }

    if (/\b(transform|empowered|unleash|summon|legend|goddess)\b/i.test(text)) {
      scores.Ultimate += 1.5;
    }
  }

  if (/team-up/i.test(type)) {
    scores.Utility += 0.8;
    scores.Ultimate += 0.4;
  }

  if (/passive/i.test(type)) {
    scores.Utility += 0.45;
  }

  for (const detail of details) {
    scoreTechnicalDetail(scores, `${detail.label ?? ''} ${detail.value ?? ''}`.toLowerCase());
  }
}

function scoreTechnicalDetail(scores: ScoreProfile, text: string): void {
  const numericValue = Number(text.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);

  if (/damage|critical|vulnerability|bonus damage/.test(text)) {
    scores.Damage += numericValue >= 200 ? 0.6 : 0.35;
  }

  if (/heal|healing|health|bonus health|shield|damage reduction/.test(text)) {
    scores.Sustain += numericValue >= 200 ? 0.65 : 0.4;
  }

  if (/special effect|field/.test(text)) {
    scores.Utility += 0.2;
  } else if (/duration|range|radius|width|height/.test(text)) {
    scores.Utility += 0.05;
  }

  if (/speed|movement|dash|distance|flight/.test(text)) {
    scores.Mobility += 0.35;
  }

  if (/energy cost|ultimate/.test(text)) {
    scores.Ultimate += 0.55;
  }
}

function scoreText(
  scores: ScoreProfile,
  text: string,
  multiplier: number,
  maxMatchesPerRule: number,
): void {
  for (const [type, rules] of Object.entries(signalRules) as [HeroBuildType, SignalRule[]][]) {
    for (const [pattern, weight] of rules) {
      scores[type] += Math.min(text.match(pattern)?.length ?? 0, maxMatchesPerRule) * weight * multiplier;
    }
  }
}

function applyAbilityMixBonuses(scores: ScoreProfile, text: string): void {
  if (/revive|resurrect|invincib|damage reduction|shield/.test(text)) {
    scores.Utility += 1.1;
    scores.Sustain += 1.1;
  }

  if (/dash|leap|fly|flight|swing|teleport|speed/.test(text) && /damage|strike|shot|slash|blast/.test(text)) {
    scores.Mobility += 1;
    scores.Damage += 0.6;
  }

  if (/stun|freeze|slow|taunt|pull|knock|blind|root/.test(text) && /damage|vulnerability|boost/.test(text)) {
    scores.Utility += 1;
    scores.Damage += 0.7;
  }
}

function applyRoleWeights(scores: ScoreProfile, role: HeroRole): void {
  const weights = roleWeights[role];

  for (const type of buildTypes) {
    scores[type] *= weights[type];
  }
}

function normalizeProfile(scores: ScoreProfile): HeroBuildProfile {
  return Object.fromEntries(buildTypes.map((type) => [
    type,
    clamp(Math.round((scores[type] / normalizers[type]) * 10), 1, 10),
  ])) as HeroBuildProfile;
}

function applyProfileOverrides(hero: Hero, profile: HeroBuildProfile): HeroBuildProfile {
  const utilityValue = utilityValueOverrides[hero.name];
  const damageValue = damageValueOverrides[hero.name];
  const mobilityValue = mobilityValueOverrides[hero.name];
  const ultimateValue = ultimateValueOverrides[hero.name];

  const overriddenProfile = {
    ...profile,
  };

  if (utilityValue) {
    overriddenProfile.Utility = utilityValue;
  }

  if (damageValue) {
    overriddenProfile.Damage = damageValue;
  }

  if (mobilityValue) {
    overriddenProfile.Mobility = mobilityValue;
  }

  if (ultimateValue) {
    overriddenProfile.Ultimate = ultimateValue;
  }

  return overriddenProfile;
}

function collectAbilities(hero: Hero): HeroAbility[] {
  const seen = new Set<string>();
  const abilities: HeroAbility[] = [];

  for (const ability of [
    ...hero.abilities,
    ...(hero.roleAbilityKits ?? []).flatMap((kit) => kit.abilities),
  ]) {
    const key = `${ability.name}|${ability.type}|${ability.description}`;

    if (!seen.has(key)) {
      seen.add(key);
      abilities.push(ability);
    }
  }

  return abilities;
}

function abilityText(ability: HeroAbility): string {
  return [
    ability.name,
    ability.type,
    ability.description,
    ...(ability.technicalDetails ?? []).flatMap((detail) => [detail.label, detail.value]),
  ].join(' ');
}

function isUltimateAbility(ability: HeroAbility): boolean {
  return /ultimate/i.test(ability.type) ||
    (ability.technicalDetails ?? []).some((detail) => /energy cost/i.test(detail.label));
}

function emptyScoreProfile(): ScoreProfile {
  return { Utility: 0, Damage: 0, Sustain: 0, Mobility: 0, Ultimate: 0 };
}

function addScores(target: ScoreProfile, source: ScoreProfile): void {
  for (const type of buildTypes) {
    target[type] += source[type];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
