import { denoRuntime } from '../_shared/deno-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { refreshLinkedPlayer } from './refresh.ts';

Deno.serve(overwolfEndpoint(refreshLinkedPlayer, denoRuntime()));
