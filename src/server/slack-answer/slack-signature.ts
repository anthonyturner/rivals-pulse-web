const MAX_AGE_SECONDS = 5 * 60;
const SIGNATURE_PATTERN = /^v0=([0-9a-f]{64})$/;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

interface SlackSignatureInput {
  signingSecret: string;
  /** The `X-Slack-Request-Timestamp` header. */
  timestamp: string | undefined;
  /** The `X-Slack-Signature` header. */
  signature: string | undefined;
  /** The request body exactly as it arrived: the signature covers its bytes, not its meaning. */
  body: Uint8Array;
  nowMs: number;
}

/**
 * Whether Slack signed this request with our signing secret, recently. Slack signs `v0:<timestamp>:<body>`
 * with HMAC-SHA256; a timestamp more than five minutes off is refused so a captured request cannot be
 * replayed later. The comparison is the Web Crypto `verify`, which does not leak where two signatures
 * differ. Anything malformed is simply not verified; this never throws.
 */
export async function verifySlackSignature(input: SlackSignatureInput): Promise<boolean> {
  const { signingSecret, timestamp, signature, body, nowMs } = input;
  const digest = SIGNATURE_PATTERN.exec(signature ?? '')?.[1];
  const seconds = Number(timestamp);

  if (!signingSecret || !digest || !timestamp || !Number.isFinite(seconds)) {
    return false;
  }
  if (Math.abs(nowMs / 1000 - seconds) > MAX_AGE_SECONDS) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const prefix = encoder.encode(`v0:${timestamp}:`);
    const signed = new Uint8Array(prefix.length + body.length);

    signed.set(prefix);
    signed.set(body, prefix.length);

    const key = await crypto.subtle.importKey('raw', encoder.encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

    return await crypto.subtle.verify('HMAC', key, hexToBytes(digest), signed);
  } catch {
    return false;
  }
}
