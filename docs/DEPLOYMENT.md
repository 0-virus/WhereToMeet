# 배포와 출시 운영

상태: **미배포, 출시 차단**. 저장소는 로컬 개발을 지원한다. 저장소의 모두 0인 D1 UUID는 로컬 자리표시자이며 원격 DB가 아니다. 고정 데이터 테스트 통과로 공급자 계약, 운영 계정·도메인, 검토된 카탈로그, 서명 정보, 실제 경로 인수 검증, Android 실기기 검증, 공개 출시 승인을 추정할 수 없다. 원격 마이그레이션, 공개 배포, 유료 설치, Play 업로드는 수행하지 않았다.

## 로컬 검증

Node 24를 사용한다. 현재 디스크 공간이 부족한 컴퓨터에 다른 SDK·브라우저를 설치하지 않는다. 기존 휴대형 Node를 현재 세션의 `PATH`에 추가할 수 있다.

```powershell
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run worker:check
npm run test:e2e
node scripts/check-release.mjs
```

`build`는 Vite 다음에 `node scripts/build-pwa.mjs`를 실행해야 한다. 차단 요인이 남아 있으면 출시 검사기는 종료 코드 1을 반환한다. 검증된 카탈로그 항목·개수, 명시적 경로 승인과 증빙 경로, 유효한 원본 주소·패키지·인증서, 실제 운영자·연락처, 웹 빌드 파일, 빌드 결과와 일치하는 DAL, 생성된 TWA 식별 정보, 비어 있지 않은 APK/AAB ZIP 결과물, 기기 증빙 경로를 검사한다. 이 구조 검사는 서명 암호학, 증빙의 진실성, 계정 사용 권한, 실제 도메인 소유권, 게시 승인을 검증하지 **않는다**. 내용이 있는 테스트 보고서가 실제 검증 증빙을 뜻하지는 않는다.

출시 후보 검사 전 `APP_ORIGIN`, `ANDROID_PACKAGE_ID`, `PLAY_APP_SIGNING_SHA256`, `VITE_OPERATOR_NAME`, `VITE_OPERATOR_CONTACT`, `ROUTING_APPROVED=true`, `ROUTING_APPROVAL_FILE`, `ANDROID_VALIDATION_FILE`을 환경 변수로 설정한다. 마지막 두 변수는 검토된 실제 증빙 보고서를 가리켜야 한다. 경로 담당자가 측정 결과와 공급자 사용 권한을 승인한 후에만 `ROUTING_APPROVED=true`로 설정한다. Worker도 같은 경로 차단 조건을 사용한다. 검증 차단을 우회하려고 해제하지 않는다. [경로 검증 절차](ROUTING-VALIDATION.md)와 [Android 설정](../android/README.md)을 참고한다.

## 웹 호스팅과 개인정보 경계

Workers Static Assets는 `dist`를 제공하고 SPA 대체 응답을 사용하여 공개 허브 링크를 직접 열 수 있게 한다. `/api/*`는 Worker가 먼저 처리한다. API 경로 누락과 실패는 JSON 오류로 유지해야 하며 성공 HTML 대체 응답으로 바꾸면 안 된다. 브라우저 요청은 동일 원본을 사용하고 URL에 API 키를 넣지 않는다. 모든 API 응답은 `Cache-Control: no-store`를 유지해야 한다. API·Kakao·TravelTime·기록·비공개 응답을 캐시하는 CDN Cache Rules, Workers Cache, 프록시를 추가하지 않는다. [Cloudflare 라우팅](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)

서비스 워커는 `/index.html`, 명시된 오프라인 페이지, 매니페스트, 아이콘, 생성된 JS/CSS/글꼴 파일만 사전 캐시한다. 콘텐츠 해시는 캐시되는 모든 바이트와 Worker 구현을 포함한다. 설치 fetch는 인증 정보를 생략하고 리디렉션·불투명·private·no-store·쿠키 설정 응답을 거부한다. fetch 처리는 API·탐색·네트워크 응답을 캐시에 쓰지 않는다. 쿼리가 있는 자산과 원격 지도·공급자 자원은 캐시를 우회한다. 오프라인 탐색은 정적 셸을 제공하지만 검색·기록은 여전히 네트워크가 필요하다. 이 설계는 정적 전용으로 유지해야 하며 `index.html`에 사용자 데이터를 주입하지 않는다.

업데이트된 Worker는 기존 앱 창이 모두 닫힐 때까지 기다린다. `skipWaiting`으로 입력 폼이나 진행 중인 검색을 중단하지 않는다. 활성화 시 오래된 `wheretomeet-shell-*` 캐시만 제거한다. 앱을 다시 열면 업데이트를 적용한다. `_headers`는 Worker와 매니페스트를 최신으로 유지한다. Worker가 생성하는 응답은 Worker 코드에서 헤더를 설정해야 하므로 배포 시 실제 헤더를 검증한다. [정적 자산 헤더](https://developers.cloudflare.com/workers/static-assets/headers/)

자동 호출 URL 로그를 비활성화한다(`observability.logs.invocation_logs: false`). 사용자 지정 로그는 안전한 오류 코드, 대략적인 상태·시간·호출 수, 요청 ID로 제한한다. 입력 이름·주소·좌표, 원본 공급자 본문, 검색 쿼리가 포함된 URL, 쿠키·토큰·API 키는 기록하지 않는다. 운영 관측 기능을 활성화하기 전에 실제 Cloudflare 로그, Logpush, 프록시·CDN 분석, 예외 보고를 검토한다. 로컬 설정만으로 배포 환경의 개인정보 보호를 입증할 수 없다. 기록은 해시된 익명 세션의 소유권 아래 허용된 출발지를 승인된 보존 규칙에 따라 저장하며, 익명 `search_events`와는 별개다. 경로 응답은 영구 저장하지 않는다.

## 원격 준비 — 소유자 결정 필요

Wrangler에 `staging`과 `production` 이름의 환경을 분리하거나 별도로 검토한 설정 파일을 사용한다. 각각 실제 계정·도메인, 자체 D1 바인딩·UUID, 독립적으로 설정한 `RATE_LIMITER` 네임스페이스와 할당량, 공급자 사용 권한·예산, 경로 승인 플래그, 비밀 값을 명시해야 한다. 바인딩과 변수는 환경별로 검토하며 상속을 가정하지 않는다. 모두 0인 로컬 D1 ID는 로컬 작업에만 쓴다. 공개 Kakao JavaScript 키는 정확히 허용한 웹 원본 주소로 제한한다. 서버 전용 Kakao REST·TravelTime 키는 해당 환경의 Worker 비밀 값에 넣으며 `VITE_` 변수나 커밋되는 파일에 넣지 않는다.

원격 환경에 작업하기 전에 출시 명세를 기록한다. Git 리비전, 빌드된 셸 버전, 승인된 허브 카탈로그 버전·개수, 대상 환경·도메인, Worker 배포·버전 ID, D1 DB ID와 현재 마이그레이션 목록, API 할당량, 이전 안정 리비전, 운영자·연락처, 증빙 경로를 포함한다. 승인 전에 `wrangler deploy --dry-run --env <environment>`와 사용량·비용을 검토한다. 현재 체크아웃에는 원격 환경이 설정되어 있지 않다.

사용자가 구체적인 배포를 승인한 뒤 운영자가 이름 있는 환경과 DB를 선택한다. 다음은 명령 형식이며 그대로 실행할 값이 아니다.

```powershell
npx wrangler d1 migrations list <database-name> --env <environment> --remote
npx wrangler d1 time-travel info <database-name> --env <environment>
npx wrangler d1 export <database-name> --env <environment> --remote --output <private-backup-path>
npx wrangler d1 migrations apply <database-name> --env <environment> --remote
npx wrangler deploy --env <environment>
```

먼저 로컬·격리된 스테이징 데이터로 마이그레이션, 백업·복원, 이전 코드 호환성을 예행연습한다. 적용 전 대상 DB ID를 확인한다. 기록에는 개인정보가 있으므로 백업은 접근 권한과 보존 기간을 제한해 비공개로 보관한다. 마이그레이션 전 Time Travel 북마크를 기록하고 해당 계정의 복구 가능 기간을 확인한다. 실제 기록을 테스트로 복사하지 않는다. [D1 명령](https://developers.cloudflare.com/d1/wrangler-commands/), [마이그레이션](https://developers.cloudflare.com/d1/reference/migrations/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

HTTPS, 공개 허브 직접 링크, 리디렉션·인증 없는 `/.well-known/assetlinks.json`의 유효한 JSON·콘텐츠 타입, 매니페스트·아이콘, 서비스 워커 범위, Worker 최신성, `/api/*` 라우팅, no-store 응답, Secure·HttpOnly·SameSite 기록 쿠키, 소유권 격리, 지도 출처 표시, 공개 개인정보·운영자 안내, 일일 만료 정리와 할당량 동작을 검증한다. 합성 입력으로 실제 서버 로그를 다시 확인한다. TWA에는 검증된 도메인 연결이 필요하며 웹 페이지에 접근할 수 있는 것만으로 충분하지 않다.

## 롤백과 장애 대응

마지막으로 정상 확인된 Worker·정적 자산·카탈로그 리비전과 호환되는 DB 마이그레이션 상태를 보관한다. Worker 롤백이나 검토된 안정 리비전 재배포는 코드·자산을 복원한다. **코드 롤백을 위해 운영 DB를 삭제하지 않는다.** 이전 코드와 호환되도록 추가 중심의 스키마 변경을 우선한다. 마이그레이션으로 데이터가 손상되면 쓰기를 멈추고 지정 소유자를 참여시켜 영향을 검토한다. 스테이징 복원 예행연습 후에만 기록된 D1 복구 북마크·백업을 사용한다. 복구 시 선택한 시점 이후의 쓰기가 사라질 수 있다. 이는 자동 코드 롤백과 별개인 장애 대응 결정이다.

공급자 장애, 사용 권한 소진, 무효한 경로 증빙이 발생하면 경로 차단 조건을 닫고 검토된 유지보수 설정을 배포한다. 명확한 사용 불가·429·503 응답을 유지한다. 가짜 또는 오래된 경로로 대체하지 않는다. 민감 정보가 제거된 실패 코드, 공급자 사용량, 지연 시간을 조사하고 복구를 확인한 뒤 다시 연다. D1 읽기·쓰기·저장 사용량, 기록 쓰기 실패, `search_events` 삽입, 매일 실행하는 90일 정리를 감시한다. 즐겨찾기 기록은 삭제할 때까지 유지하며, 만료 후 마지막 즐겨찾기를 해제하면 기록을 삭제한다. 기록 저장 실패는 추천을 숨기지 않고 계속 표시해야 한다.

출시 준비 증빙에는 실제 20×100 비교(95% 이상이 180초 이내, 도달 불가능 추천 0건), 할당량 대기를 분리한 전체 카탈로그 성능, 버스·철도·혼합 증빙, 실제 이동 10건, 웹·Android 실기기 사례를 첨부한다. 공급자 사용 허가, 확인된 운영 비용, Play 계정 요구사항, 스토어 스크린샷·설명·Data safety 답변, 실제 개인정보·연락처 안내, 키 관리, 롤백 예행연습, 명시적 최종 출시 결정도 포함한다. 현재 고정 데이터·로컬 결과는 이 조건을 충족하지 않는다.
