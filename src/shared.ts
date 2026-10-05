export type Origin = { id: string; label: string; lat: number; lng: number; address?: string };
export type Hub = { id: string; name: string; lat: number; lng: number; regionCode: string; kind: 'rail' | 'bus'; sourceId: string; sourceUrl: string; sourceDate: string; verified: boolean };
export type Catalog = { version: string; generatedAt: string; hubs: Hub[] };
export type ParticipantRoute = { originId: string; departureAt: string; arrivalAt: string; travelSeconds: number; earlyWaitSeconds: number; burdenSeconds: number; transfers: number };
export type Recommendation = { hubId: string; participantRoutes: ParticipantRoute[]; maxBurdenSeconds: number; sumBurdenSeconds: number; hub?: Hub };
export type RecommendRequest = { origins: Origin[]; meetingAt: string; historyId?: string };
export type RecommendResponse = { status: 'success' | 'no_routes'; recommendations: Recommendation[]; calculatedAt: string; dataVersion: string; requestId: string; historyId?: string; historySaved?: boolean; warning?: string };
export type Place = { id: string; name: string; lat: number; lng: number; address: string; category?: string; distance?: number; url: string };
export type Category = 'restaurant' | 'cafe' | 'culture';
export type HistoryRecord = { id: string; origins: Origin[]; meetingAt: string; searchedAt: string; bookmarkedHubIds: string[]; bookmarkedHubs?: Hub[] };
export type ApiError = { error: { code: string; message: string; requestId?: string; retryAfter?: number } };
export const MAX_RECOMMENDATIONS = 4;
export const HISTORY_RETENTION_DAYS = 90;
export const MAX_MEETING_DAYS = 7;

// HTTP contract: GET /api/places/search?q -> {places: Place[]};
// GET /api/places/nearby?hubId&category -> {places: Place[]};
// GET /api/hubs/:id -> {hub: Hub}; POST /api/recommendations -> RecommendResponse;
// GET /api/history -> {history: HistoryRecord[]}; GET /api/history/:id -> {record: HistoryRecord};
// PATCH /api/history/:id/bookmarks body {hubIds: string[]} -> {record: HistoryRecord|null};
// DELETE /api/history[/:id] -> 204. All API errors use ApiError. All API responses no-store.
