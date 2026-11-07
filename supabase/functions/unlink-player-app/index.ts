import { denoRuntime } from '../_shared/deno-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { unlinkPlayerFromApp } from './unlink.ts';

Deno.serve(overwolfEndpoint(unlinkPlayerFromApp, denoRuntime()));
