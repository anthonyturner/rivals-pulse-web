import { json, rateLimited, unwrap, type EndpointSpec } from '../_shared/overwolf-endpoint.ts';

/** The app asks when its settings open, so sixty an hour is generous. Counted over `link_issue_window()`. */
const STATUS_LIMIT = 60;

/**
 * Tells the app whether its Overwolf account is linked to a website account (issue 343), for the
 * verified session's recorder only. It answers with the linked player's name and when the link was
 * made, and never with anything about the website account: not its email, not its id.
 */
export const linkStatus: EndpointSpec = {
  methods: ['GET', 'POST'],
  failureMessage: 'Unable to read the link status',
  async handle({ recorder, rpc }) {
    const outcome = unwrap(
      await rpc('link_status_for_recorder', { p_recorder_id: recorder, p_limit: STATUS_LIMIT }),
    );

    if (outcome?.status === 'rate_limited') {
      return rateLimited('Too many requests; try again later', outcome.retryAfter);
    }
    if (outcome?.status === 'linked') {
      return json({ linked: true, playerName: outcome.playerName, linkedAt: outcome.linkedAt });
    }
    return json({ linked: false });
  },
};
