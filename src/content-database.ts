import { GlossaryTerm } from './app/features/reference/glossary/glossary.model.js';
import { HomeContent, PortalCard } from './app/features/home/home-content.model.js';
import { Hero, HeroVideo } from './app/features/heroes/hero.model.js';
import { type CommunityHeroStatsStatus, readCommunityHeroStatsStatus } from './community-hero-stats-status.js';
import { countGameStatSnapshotGames, countGameStatSnapshots } from './game-stats-sync.js';
import { countGlossaryTerms, listGlossaryTerms } from './glossary-store.js';
import { countHeroes, getHero, listHeroes } from './hero-store.js';
import { countHeroVideos, listHeroVideos } from './hero-video-store.js';
import {
  countHomeContentBlocks,
  countHomePortals,
  getHomeContentBlocks,
  listHomePortals,
} from './home-content-store.js';
import { getSupabaseClient, getSupabaseStatus, type SupabaseStatus } from './supabase-client.js';
import { countExternalSources, getStoredExternalSourcePayload } from './sync-log.js';

const nodeProcess = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

try {
  nodeProcess.loadEnvFile?.('.env');
} catch {
  // Environment variables may already be provided by the shell or deployment host.
}

type ContentStatus = {
  databaseProvider: 'turso';
  databaseUrl: string;
  configured: boolean;
  heroes: number;
  glossaryTerms: number;
  externalSources: number;
  heroVideos: number;
  homePortals: number;
  homeContentBlocks: number;
  communityHeroStats: CommunityHeroStatsStatus;
  gameStatSnapshots: number;
  gameStatSnapshotGames: number;
  supabase: SupabaseStatus;
};

export function getHeroesFromDatabase(): Promise<Hero[]> {
  return listHeroes(getSupabaseClient());
}

export function getHeroFromDatabase(id: string): Promise<Hero | undefined> {
  return getHero(getSupabaseClient(), id);
}

export function getHeroVideosFromDatabase(): Promise<HeroVideo[]> {
  return listHeroVideos(getSupabaseClient());
}

export function getHomePortalsFromDatabase(): Promise<PortalCard[]> {
  return listHomePortals(getSupabaseClient());
}

export async function getHomeContentBlocksFromDatabase(): Promise<Partial<HomeContent>> {
  return (await getHomeContentBlocks(getSupabaseClient())) as Partial<HomeContent>;
}

export function getGlossaryTermsFromDatabase(): Promise<GlossaryTerm[]> {
  return listGlossaryTerms(getSupabaseClient());
}

export function getExternalSourceFromDatabase(sourceKey: string): Promise<unknown | undefined> {
  return getStoredExternalSourcePayload(getSupabaseClient(), sourceKey);
}

export async function getContentStatusFromDatabase(): Promise<ContentStatus> {
  return {
    databaseProvider: 'turso',
    databaseUrl: getSafeDatabaseUrl(),
    configured: Boolean(process.env['TURSO_DATABASE_URL'] && process.env['TURSO_AUTH_TOKEN']),
    heroes: await countHeroes(getSupabaseClient()),
    glossaryTerms: await countGlossaryTerms(getSupabaseClient()),
    externalSources: await countExternalSources(getSupabaseClient()),
    heroVideos: await countHeroVideos(getSupabaseClient()),
    homePortals: await countHomePortals(getSupabaseClient()),
    homeContentBlocks: await countHomeContentBlocks(getSupabaseClient()),
    communityHeroStats: await readCommunityHeroStatsStatus(),
    gameStatSnapshots: await countGameStatSnapshots(getSupabaseClient()),
    gameStatSnapshotGames: await countGameStatSnapshotGames(getSupabaseClient()),
    supabase: await getSupabaseStatus(),
  };
}

function getSafeDatabaseUrl(): string {
  const url = process.env['TURSO_DATABASE_URL'];

  if (!url) {
    return 'not configured';
  }

  return url.replace(/\/\/([^./]+)[^.]*/, '//$1...');
}
