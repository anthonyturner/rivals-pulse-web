import { syncHomeNews } from '../src/server/content/home/index.ts';

const result = await syncHomeNews();
console.log(`Synced ${result.latestNews.length} home news cards at ${result.updatedAt}`);
