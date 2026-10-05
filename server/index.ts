import catalog from '../data/hubs.json';
import type { Catalog } from '../src/shared.ts';
import { createWorker } from './app.ts';
export { createWorker } from './app.ts';
export type { Env, WorkerDependencies } from './app.ts';
export default createWorker({catalog:catalog as Catalog});
