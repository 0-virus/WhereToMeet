export const messages: Record<string,string> = {
 INVALID_INPUT:'입력 내용을 확인해 주세요.', FORBIDDEN:'요청을 확인할 수 없습니다.', NOT_FOUND:'기록 또는 장소를 찾을 수 없습니다.',
 CATALOG_NOT_READY:'검수된 거점 정보를 준비하고 있습니다.', ROUTING_NOT_READY:'교통 경로 검증을 준비하고 있습니다.',
 CONFIG_NOT_READY:'서비스 연결을 준비하고 있습니다.', STORAGE_UNAVAILABLE:'기록 저장소에 연결할 수 없습니다.',
 QUOTA_EXCEEDED:'지금은 요청이 많습니다. 잠시 후 다시 시도해 주세요.', QUOTA_UNAVAILABLE:'사용량을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
 PROVIDER_ERROR:'장소 또는 교통 정보를 불러오지 못했습니다.', PROVIDER_UNAVAILABLE:'외부 서비스에 연결할 수 없습니다.',
 TIMEOUT:'검색 시간이 초과되었습니다. 다시 시도해 주세요.', CANCELLED:'검색을 취소했습니다.', INTERNAL_ERROR:'요청을 처리하지 못했습니다.',
};
export class ApiFailure extends Error {
 code: string; status: number;
 constructor(code: string, status: number) { super(messages[code] ?? messages.PROVIDER_ERROR); this.code=code; this.status=status; }
}
export function safeFailure(error: unknown): ApiFailure {
 if(error instanceof ApiFailure) return error;
 // Provider codes are a closed allowlist, never user-controlled error text.
 const provider: Record<string,[string,number]> = {
  quota_exceeded:['QUOTA_EXCEEDED',429], quota_unavailable:['QUOTA_UNAVAILABLE',503], timeout:['TIMEOUT',504], cancelled:['CANCELLED',499],
  provider_error:['PROVIDER_ERROR',502], provider_unavailable:['PROVIDER_UNAVAILABLE',503], provider_timeout:['TIMEOUT',504],
  provider_rate_limited:['QUOTA_EXCEEDED',429], provider_invalid_response:['PROVIDER_ERROR',502], provider_rejected:['PROVIDER_ERROR',502],
  provider_not_configured:['CONFIG_NOT_READY',503], routing_timeout:['TIMEOUT',504], routing_budget_exceeded:['PROVIDER_UNAVAILABLE',503],
  routing_candidate_budget_exceeded:['PROVIDER_UNAVAILABLE',503], routing_response_too_large:['PROVIDER_UNAVAILABLE',503], non_monotonic_reachability:['PROVIDER_ERROR',502],
  invalid_routing_input:['INVALID_INPUT',400], departure_in_past:['INVALID_INPUT',400], invalid_travel_limit:['INVALID_INPUT',400],
  invalid_candidate_budget:['CONFIG_NOT_READY',503], invalid_routing_budget:['CONFIG_NOT_READY',503],
 };
 const code=error && typeof error==='object' && 'code' in error ? String(error.code) : '';
 const mapped=provider[code]; return mapped ? new ApiFailure(...mapped) : new ApiFailure('PROVIDER_ERROR',502);
}
