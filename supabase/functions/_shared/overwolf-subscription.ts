/** Asks Overwolf's subscriptions API, with the user's own session token, whether they hold a paid plan. Not yet run against live Overwolf. */
import { IdentityError } from './overwolf-identity.ts';

const SUBSCRIPTIONS_URL = 'https://subscriptions-api.overwolf.com/subscriptions';
const SUBSCRIPTIONS_TIMEOUT_MS = 5_000;

/** A plan that is paid up: `PENDING_CANCELLATION` means cancelled but running until the next payment date. */
const ENTITLED_STATES = new Set(['ACTIVE', 'PENDING_CANCELLATION']);

export interface SubscriptionConfig {
  /** The Tebex store's public token, which names the store in Overwolf's URL. */
  storePublicToken: string;
  extensionId: string;
  /** Package ids that count as premium; empty or absent means any package of the store does. */
  packageIds?: readonly number[];
}

/** Reads a comma-separated list of package ids; blanks and anything that is not a whole number are dropped. */
export function parsePackageIds(raw: string | null | undefined): number[] {
  return (raw ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => /^\d+$/.test(part))
    .map(Number);
}

/**
 * Whether the user behind `sessionToken` holds a paid plan; only "Overwolf could not tell us" throws (503).
 * Fails closed, deliberately the opposite of the token rate limiter's fail-open: an outage that
 * failed open would hand billed ElevenLabs sessions to anyone.
 */
export async function hasActiveSubscription(
  sessionToken: string,
  config: SubscriptionConfig,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const { fetchImpl = fetch } = options;
  const url = `${SUBSCRIPTIONS_URL}/${encodeURIComponent(config.storePublicToken)}`
    + `?extensionId=${encodeURIComponent(config.extensionId)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      redirect: 'error',
      signal: AbortSignal.timeout(SUBSCRIPTIONS_TIMEOUT_MS),
    });
  } catch {
    throw new IdentityError(503, 'Overwolf could not be reached to check the subscription');
  }

  if (response.status === 404) return false;
  if (response.status !== 200) throw new IdentityError(503, 'Overwolf could not check the subscription');

  const plans = await response.json().catch(() => null) as unknown;
  if (!Array.isArray(plans)) throw new IdentityError(503, 'Overwolf returned an unreadable subscription answer');

  const packageIds = config.packageIds ?? [];
  return plans.some(plan => {
    const { state, packageId } = (plan ?? {}) as { state?: unknown; packageId?: unknown };
    return typeof state === 'string'
      && ENTITLED_STATES.has(state)
      && (packageIds.length === 0 || (typeof packageId === 'number' && packageIds.includes(packageId)));
  });
}
