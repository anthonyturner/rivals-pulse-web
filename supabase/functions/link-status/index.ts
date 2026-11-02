import { denoRuntime } from '../_shared/deno-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { linkStatus } from './status.ts';

Deno.serve(overwolfEndpoint(linkStatus, denoRuntime()));
