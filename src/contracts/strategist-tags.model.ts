/**
 * What a Strategist does for a triple-support team. Utility heroes are the anchors a triple is named
 * for; every other Strategist is a healer.
 */
export const STRATEGIST_TAGS = ['healer', 'utility'] as const;

export type StrategistTag = (typeof STRATEGIST_TAGS)[number];

/** One entry of `strategist-tags.json`: a Strategist (by its slug in `heroes.json`) and its tag. */
export interface StrategistTagEntry {
  heroId: string;
  tag: StrategistTag;
}
