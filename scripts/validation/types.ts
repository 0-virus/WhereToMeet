import type { Hub, Recommendation, RecommendRequest } from '../../src/shared.ts';

// Validation only: quota-paced batches may exceed the production 30s deadline.
// Production request handlers must never enable this option.
export type ValidationAdapterOptions = {
  appId: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  now: () => number;
  validationDeadlineMs: number;
};
export type ValidationAdapter = {
  recommend(request: RecommendRequest, hubs: Hub[]): Promise<Recommendation[]>;
  // Return every valid hub, sorted by burden, without the UI's four-result cap.
  matrix(request: RecommendRequest, hubs: Hub[]): Promise<Recommendation[]>;
  // Forward departure=D-T, travel_time=T; keys cover every origin, even empty sets.
  reachable(request: RecommendRequest, hubs: Hub[], limitSeconds: number): Promise<Record<string, string[]>>;
};
export type ValidationAdapterFactory = (options: ValidationAdapterOptions) => ValidationAdapter;
