const genericPlaystylePattern = /^Use .+ as a .+ around cover, cooldown timing, and team follow-up\.$/;

export function isGenericPlaystyle(value = '') {
  return genericPlaystylePattern.test(value);
}

export function buildHeroPlaystyle(hero) {
  if (hero.id === 'jubilee') {
    return 'Leapfrog fully charged Blooming Balls ahead of a grouped frontline, detonate them for burst sustain and utility, then stagger Sparkle Marks to keep enhanced Energy Plasmoids active. Play inside the brawl when safe, and conserve Sparking Sprint for charging the next orb or escaping pressure.';
  }

  const role = hero.role;
  const abilities = hero.abilities ?? [];
  const primary = abilities.find((ability) => ability.type === 'Normal Attack')?.name
    ?? abilities[0]?.name
    ?? hero.name;
  const utility = abilities.find((ability) => ability.type === 'Ability')?.name
    ?? abilities.find((ability) => ability.type !== 'Normal Attack' && ability.type !== 'Ultimate')?.name
    ?? abilities[1]?.name
    ?? primary;
  const weakness = normalizeCaution(cleanFragment(hero.weaknesses?.[0]));

  switch (role) {
    case 'Vanguard':
      return `Lead space with ${utility}, then hold enemy attention with ${primary}. Take short, deliberate trades and avoid overcommitting when ${lowerFirst(weakness || 'your sustain tools are exhausted')}.`;
    case 'Strategist':
      return `Play close enough to maintain line of sight, cycling ${primary} and ${utility} to stabilize fights. Hold defensive resources for the enemy engage and rotate early when ${lowerFirst(weakness || 'dive pressure reaches you')}.`;
    case 'Duelist':
      return `Take off-angles where ${primary} can pressure exposed targets, then commit with ${utility} after enemy peel is forced. Reset before ${lowerFirst(weakness || 'crowd control catches you')}.`;
    case 'Multi-Role':
      return `Choose the role pool your team needs, then build the fight around ${primary} pressure and ${utility} timing. Swap plans when enemies punish your current role profile.`;
    default:
      return hero.playstyle;
  }
}

function cleanFragment(value = '') {
  if (value.includes('...')) {
    return '';
  }

  return value
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCaution(value = '') {
  return value.replace(/^vulnerable if\s+/i, '');
}

function lowerFirst(value) {
  if (!value) {
    return value;
  }

  return `${value[0].toLowerCase()}${value.slice(1)}`;
}
