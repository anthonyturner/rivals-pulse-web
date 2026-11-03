// The Angular server render, for every address that is not a file and not under /api/ (see the
// rewrite in vercel.json). It is plain JavaScript on purpose: the bundle it re-exports is a build
// output that does not exist when `npm run typecheck:api` reads the TypeScript functions.
export { reqHandler as default } from '../dist/rivals-pulse-coach/server/server.mjs';
