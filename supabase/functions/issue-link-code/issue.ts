import { json, rateLimited, unwrap, type EndpointSpec } from '../_shared/overwolf-endpoint.ts';
import { readPlayerClaim } from '../_shared/player-claim.ts';
import { formatLinkCode, generateLinkCode } from './link-code.ts';

/** A code works for ten minutes and once; the issuing function enforces both. */
const CODE_TTL = '10 minutes';
/**
 * A player asks for a code a few times at most; five covers retries without letting a script farm
 * them. The window they are counted over is `link_issue_window()` in the database, which the purge
 * shares.
 */
const ISSUE_LIMIT = 5;
/** Two recorders drawing the same code is a 1 in 2^40 event; a retry makes it invisible. */
const CODE_ATTEMPTS = 3;
const UNIQUE_VIOLATION = '23505';

/**
 * Gives the app a one-time code to type on the website (issue 264). The caller must hold an Overwolf
 * session that Overwolf confirms: the link rests on that identity, not on the name or uid in the
 * body, which are the app's claims and are only shown back to the player.
 */
export const issueLinkCode: EndpointSpec = {
  methods: ['POST'],
  failureMessage: 'Unable to issue a link code',
  async handle({ request, recorder, rpc }) {
    const player = readPlayerClaim(await request.json().catch(() => null));
    if (!player) {
      return json(
        { error: 'Play one match with the app open first, then ask for a code again.', reason: 'no-player' },
        422,
      );
    }

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = generateLinkCode();
      const { data, error } = await rpc('issue_link_code', {
        p_recorder_id: recorder,
        p_code: code,
        p_player_uid: player.uid,
        p_player_name: player.name,
        p_avatar_url: player.avatarUrl,
        p_ttl: CODE_TTL,
        p_limit: ISSUE_LIMIT,
      });

      if (error?.code === UNIQUE_VIOLATION) continue;
      const issued = unwrap({ data, error });

      if (issued?.status === 'rate_limited') {
        return rateLimited('Too many codes requested; try again later', issued.retryAfter);
      }

      return json({ code: formatLinkCode(code), expiresAt: issued.expiresAt });
    }

    throw new Error('A link code could not be issued');
  },
};
