// Serves every page route through the Angular server render. The bundle is built by `ng build`
// (`vercel:build`), so this file only hands requests to its Express app.
export { reqHandler as default } from '../dist/rivals-pulse-coach/server/server.mjs';
