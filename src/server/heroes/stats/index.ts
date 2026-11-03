// `hero-stats.ts` stays out: the browser reuses it by file, and this entry point pulls in the Supabase reads.
export { getHeroStats, getRoleStats, halfSeasonFromQuery, heroStatsQueryFrom, readHeroStatsSource } from './hero-stats-read.js';
