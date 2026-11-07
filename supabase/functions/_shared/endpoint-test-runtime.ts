import { IdentityError, recorderId } from './overwolf-identity.ts';
import type { EndpointRuntime, RpcResult } from './overwolf-endpoint.ts';

/** The Overwolf user every test session belongs to, and the secret their recorder id is keyed with. */
const USERNAME = 'Aurora';
const SECRET = 'test-secret';

export const testRecorder = (): Promise<string> => recorderId(USERNAME, SECRET);

export interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * A runtime for the endpoint tests: Overwolf accepts the token `good` and rejects any other with a
 * 401, and each database call is recorded and answered by `answer`.
 */
export function testRuntime(answer: (call: RpcCall) => RpcResult | Promise<RpcResult> = () => ({ data: null, error: null })) {
  const calls: RpcCall[] = [];

  const runtime: EndpointRuntime = {
    env: name => ({ OVERWOLF_EXTENSION_ID: 'extension', RECORDER_ID_SECRET: SECRET })[name],
    rpc: async (name, args) => {
      const call = { name, args };
      calls.push(call);
      return answer(call);
    },
    verifySession: async token => {
      if (token !== 'good') throw new IdentityError(401, 'Overwolf rejected the session token');
      return { username: USERNAME };
    },
  };

  return { runtime, calls };
}

/** A request from the app: a verified session by default, `session: null` for none. */
export function appRequest(
  method: string,
  options: { session?: string | null; body?: unknown } = {},
): Request {
  const { session = 'good', body } = options;
  return new Request('https://project.functions.supabase.co/fn', {
    method,
    headers: {
      ...(session === null ? {} : { 'x-overwolf-session': session }),
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
