// `own-dashboard.ts` stays out: the browser reuses it by file, and this entry point pulls in the auth gateway.
export { accountRouteHandler, handleAccountHttp } from './account-http.js';
