import { denoRuntime } from '../_shared/deno-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { issueLinkCode } from './issue.ts';

Deno.serve(overwolfEndpoint(issueLinkCode, denoRuntime()));
