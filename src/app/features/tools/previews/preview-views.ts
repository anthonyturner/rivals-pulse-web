import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { HeroSynergies } from '../../../../contracts/hero-synergies.model';
import type { Hero } from '../../heroes/hero.model';
import { pairPreview } from '../../hub/pair-preview';
import { previewHero, type PreviewHero } from '../../hub/preview-hero';
import { recordCards, strongestRecords, winningRecordsAgainst } from '../../insights/hero-matchup-records';
import { PAIR_ROLES, type PairRole } from '../../insights/team-comps/team-comps-view';
import { answersTo } from '../dive-planner/dive-answers';
import { DEFAULT_DIVE_THREAT_IDS } from '../dive-planner/dive-threats';

/** How many counters the Counters tile shows beside the enemy hero, and the Dive Planner tile shows as its answer. */
export const ANSWERS_SHOWN = 3;

export interface CounterPreview {
  enemy: PreviewHero;
  counters: Array<{ hero: PreviewHero; winRate: string }>;
}

export interface DivePreview {
  threats: PreviewHero[];
  answers: PreviewHero[];
}

export interface TeamSlotPreview {
  role: PairRole;
  /** Null for a slot the data cannot fill: it is drawn empty, with a plus. */
  hero: PreviewHero | null;
}

/**
 * The enemy hero with the clearest counter against it, and the heroes that counter it, in the
 * order the Counters page lists them (largest sample first). The clearest record is the one
 * `strongestRecords` puts first, which is deterministic, so the tile reads the same on every visit
 * until the matchups change. Null when no record names a hero the roster knows.
 */
export function counterPreview(matchups: HeroMatchups, roster: readonly Hero[]): CounterPreview | null {
  const byId = new Map(roster.map((hero) => [hero.id, hero]));

  for (const record of strongestRecords(matchups, matchups.matchups.length)) {
    const enemy = byId.get(record.enemy);
    const cards = enemy ? recordCards(winningRecordsAgainst(matchups, enemy.id), 'hero', roster) : [];

    if (enemy && cards.length > 0) {
      return {
        enemy: toPreview(enemy),
        counters: cards.slice(0, ANSWERS_SHOWN).map((card) => ({ hero: toPreview(card.hero), winRate: card.winRate })),
      };
    }
  }

  return null;
}

/**
 * The planner's opening enemy divers and the heroes it answers them with: the ones with a winning
 * record against the most of them, from the same `answersTo` the page uses. Null when no hero has
 * one against any of them.
 */
export function divePreview(matchups: HeroMatchups, roster: readonly Hero[]): DivePreview | null {
  const byId = new Map(roster.map((hero) => [hero.id, hero]));
  const threats = DEFAULT_DIVE_THREAT_IDS.flatMap((id) => byId.get(id) ?? []);
  const answers = answersTo(threats, [...roster], matchups, ANSWERS_SHOWN);

  return answers.length === 0
    ? null
    : { threats: threats.map(toPreview), answers: answers.map((answer) => toPreview(answer.hero)) };
}

/**
 * Six slots, two per role in Vanguard, Duelist, Strategist order, filled with the best duo of each
 * role as the Team comps page ranks them. A role with no duo leaves its two slots empty. Empty
 * altogether, rather than six plus signs, when no role has a duo at all. The pairs are the ones
 * `previewSynergies` reads, in Competitive, the mode that page opens on.
 */
export function teamPreview(synergies: HeroSynergies, roster: readonly Hero[]): TeamSlotPreview[] {
  const pairs = pairPreview(synergies, roster);

  if (pairs.length === 0) {
    return [];
  }

  return PAIR_ROLES.flatMap((role) => {
    const pair = pairs.find((candidate) => candidate.role === role);

    return [pair?.first ?? null, pair?.second ?? null].map((hero) => ({ role, hero }));
  });
}

function toPreview({ id, name, imageUrl }: Hero): PreviewHero {
  return previewHero({ hero: id, name, imageUrl });
}
