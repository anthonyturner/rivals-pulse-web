import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from './endpoint-test-runtime.ts';
import { IdentityError } from './overwolf-identity.ts';
import { json, overwolfEndpoint, type EndpointSpec } from './overwolf-endpoint.ts';

const echo: EndpointSpec = {
  methods: ['GET', 'DELETE'],
  failureMessage: 'Unable to echo',
  handle: async ({ recorder }) => json({ recorder }),
};

describe('overwolfEndpoint', () => {
  it('hands the handler the recorder of a verified session', async () => {
    const response = await overwolfEndpoint(echo, testRuntime().runtime)(appRequest('GET'));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { recorder: await testRecorder() });
  });

  it('answers 401 when Overwolf does not accept the session, without running the handler', async () => {
    let ran = false;
    const spec: EndpointSpec = { ...echo, handle: async () => { ran = true; return json({}); } };

    for (const session of [null, 'forged']) {
      const response = await overwolfEndpoint(spec, testRuntime().runtime)(appRequest('GET', { session }));
      assert.equal(response.status, 401);
    }
    assert.equal(ran, false);
  });

  it('passes on the status of an identity failure, such as Overwolf being down', async () => {
    const { runtime } = testRuntime();
    runtime.verifySession = async () => { throw new IdentityError(503, 'Overwolf could not be reached'); };
    const response = await overwolfEndpoint(echo, runtime)(appRequest('GET'));

    assert.equal(response.status, 503);
  });

  it('answers 405 to a method the function does not take, and 200 to the preflight', async () => {
    const handler = overwolfEndpoint(echo, testRuntime().runtime);

    assert.equal((await handler(appRequest('POST'))).status, 405);
    assert.equal((await handler(appRequest('DELETE'))).status, 200);
    assert.equal((await handler(appRequest('OPTIONS', { session: null }))).status, 200);
  });

  it('answers a missing setting with a plain 500 that names nothing', async () => {
    const { runtime } = testRuntime();
    runtime.env = () => undefined;
    const response = await overwolfEndpoint(echo, runtime)(appRequest('GET'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to echo' });
  });

  it('allows any origin and exposes Retry-After to the app', async () => {
    const response = await overwolfEndpoint(echo, testRuntime().runtime)(appRequest('GET'));

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Expose-Headers'), 'Retry-After');
  });
});
