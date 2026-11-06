import type { HeroMatchups } from '../../../contracts/hero-matchups.model.ts';
import type { SupabaseReadEnv } from '../../supabase/index.ts';
import { getHeroPairs } from '../pairs/index.ts';
import { deriveHeroMatchups } from './hero-matchups.ts';

interface HeroMatchupsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
}

/** Compatibility response for website pages, derived from the same database read as Pulse Atlas. */
export async function getHeroMatchups(options: HeroMatchupsReadOptions = {}): Promise<HeroMatchups> {
  return deriveHeroMatchups(await getHeroPairs(options));
}
