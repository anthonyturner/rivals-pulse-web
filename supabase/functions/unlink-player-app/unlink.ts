import { json, rateLimited, unwrapStatus, type EndpointSpec } from '../_shared/overwolf-endpoint.ts';

/** Unlinking is rare and deliberate; ten an hour covers a player who keeps changing their mind. */
const UNLINK_LIMIT = 10;

/**
 * Removes the verified session's own link from the app. The website unlinks by
 * `auth.uid()`; here there is no website session, so the key is the recorder the Overwolf session
 * proves. Unlinking is idempotent: a session with no link is answered the same way, saying nothing
 * was removed.
 */
export const unlinkPlayerFromApp: EndpointSpec = {
  methods: ['POST', 'DELETE'],
  failureMessage: 'Unable to unlink the player',
  async handle({ recorder, rpc }) {
    const outcome = unwrapStatus(
      await rpc('unlink_player_for_recorder', { p_recorder_id: recorder, p_limit: UNLINK_LIMIT }),
    );

    switch (outcome.status) {
      case 'rate_limited':
        return rateLimited('Too many requests; try again later', outcome.retryAfter());
      case 'unlinked':
        return json({ linked: false, unlinked: true });
      case 'not_linked':
        return json({ linked: false, unlinked: false });
      default:
        throw new Error(`The database answered "${outcome.status}" to an unlink`);
    }
  },
};
