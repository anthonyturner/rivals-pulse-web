import { IdentityError, verifyOverwolfSession } from './overwolf-identity.ts';
import { hasActiveSubscription, parsePackageIds } from './overwolf-subscription.ts';

export type PremiumGateDecision =
  | { allowed: true }
  | { allowed: false; status: number; body: { error: string } };

export interface PremiumGateInput {
  getEnv: (name: string) => string | undefined;
  /** Read only when the gate is on, so a dormant gate never touches the request's session header. */
  getSessionToken: () => string | null;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}

/**
 * Decides whether a caller may have a Jarvis token: a verified Overwolf session with a paid plan.
 * Dormant (always allowed) until `TEBEX_STORE_PUBLIC_TOKEN` is set; see docs/supabase-prod-checklist.md.
 * Fails closed on every doubt, deliberately unlike the token rate limiter, which fails open.
 */
export async function checkPremiumGate(input: PremiumGateInput): Promise<PremiumGateDecision> {
  const { getEnv, getSessionToken, fetchImpl, nowMs } = input;
  const storePublicToken = getEnv('TEBEX_STORE_PUBLIC_TOKEN')?.trim();
  if (!storePublicToken) return { allowed: true };

  const extensionId = getEnv('OVERWOLF_EXTENSION_ID')?.trim();
  if (!extensionId) return refuse(500, 'The premium check is not configured');

  const rawPackageIds = getEnv('PREMIUM_JARVIS_PACKAGE_IDS')?.trim();
  const packageIds = parsePackageIds(rawPackageIds);
  if (rawPackageIds && packageIds.length === 0) return refuse(500, 'The premium check is not configured');

  try {
    const sessionToken = getSessionToken()?.trim() ?? '';
    await verifyOverwolfSession(sessionToken, extensionId, { fetchImpl, nowMs });
    const entitled = await hasActiveSubscription(sessionToken, { storePublicToken, extensionId, packageIds }, { fetchImpl });
    return entitled ? { allowed: true } : refuse(403, 'premium-required');
  } catch (error) {
    if (error instanceof IdentityError) return refuse(error.status, error.message);
    throw error;
  }
}

/** A refusal is logged as status and message only, never the session token. */
function refuse(status: number, error: string): PremiumGateDecision {
  console.warn(`Jarvis premium gate refused (${status}): ${error}`);
  return { allowed: false, status, body: { error } };
}
