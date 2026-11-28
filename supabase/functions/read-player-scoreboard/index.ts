import { denoRuntime } from '../_shared/deno-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { readPlayerScoreboard } from './read.ts';

Deno.serve(overwolfEndpoint(readPlayerScoreboard, denoRuntime()));
