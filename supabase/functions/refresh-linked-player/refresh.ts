import { json, rateLimited, unwrapStatus, type EndpointSpec } from '../_shared/overwolf-endpoint.ts';
import { readPlayerProfile } from '../_shared/player-claim.ts';

/**
 * The app sends its player's name and avatar on start and after each upload, so thirty calls an hour
 * is far above honest use. The window is `link_issue_window()` in the database, which the purge shares.
 */
const REFRESH_LIMIT = 30;

/**
 * Keeps the linked player's name and avatar current. Acts only on the link of the
 * verified session's recorder, and never creates one: a session with no link is told so and nothing
 * is written. The body's uid, if any, is not read; changing player means linking again.
 */
export const refreshLinkedPlayer: EndpointSpec = {
  methods: ['POST'],
  failureMessage: 'Unable to refresh the linked player',
  async handle({ request, recorder, rpc }) {
    const profile = readPlayerProfile(await request.json().catch(() => null));
    if (!profile) return json({ error: 'A player name is required', reason: 'no-player' }, 422);

    const outcome = unwrapStatus(
      await rpc('refresh_linked_player', {
        p_recorder_id: recorder,
        p_player_name: profile.name,
        p_avatar_url: profile.avatarUrl,
        p_limit: REFRESH_LIMIT,
      }),
    );

    switch (outcome.status) {
      case 'rate_limited':
        return rateLimited('Too many refreshes; try again later', outcome.retryAfter());
      case 'refreshed':
        return json({ linked: true, playerName: profile.name });
      case 'not_linked':
        return json({ linked: false });
      default:
        throw new Error(`The database answered "${outcome.status}" to a refresh`);
    }
  },
};
