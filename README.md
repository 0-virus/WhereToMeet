# WhereToMeet · 어디서 만날까

수도권에서 만나는 2~4명의 약속 시각까지의 부담을 비교하는 모바일 웹/PWA와 Android TWA입니다.

## 개발

Node.js 24를 사용합니다. 의존성 설치 후 `.env.example`을 참고하여 서버 키는 `.dev.vars`, 공개 지도 키는 `.env.local`에 설정합니다. 비밀키를 커밋하지 마세요.

```sh
npm ci
npm run db:migrate
npm run dev:worker
# 다른 터미널
npm run dev
```

실제 키가 없으면 외부 장소·교통 검색은 설정 오류를 안내합니다. 앱은 임의의 이동시간이나 가짜 추천을 반환하지 않습니다. 자동 화면 테스트에서만 별도 테스트 응답을 사용합니다.

## 확인

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:fullstack
npm run worker:check
npm run release:check
```

공급자 실검증·거점 검수·Android 서명 검증은 자동 테스트와 별도입니다. 현재 **출시 차단 상태**이며 `release:check`는 미충족 조건을 출력하고 실패합니다. [검증 결과](docs/검증결과.md), [시나리오 검증표](docs/SCENARIOS.md), [운영 준비](docs/운영준비.md)를 확인하세요.

이미 설치된 Chrome으로 검증하려면 PowerShell에서 `$env:PLAYWRIGHT_CHANNEL='chrome'`을 설정합니다. 화면 테스트는 4174, 브라우저→Worker→SQL 테스트는 4181 포트를 사용하며 외부 공급자 응답만 테스트용으로 대체합니다. 실제 API 품질 검증 결과로 사용하지 않습니다.

## 데이터와 개인정보

- 출발지·약속 입력 기록은 현재 브라우저의 익명 쿠키로 접근합니다. 다른 브라우저나 기기로 자동 동기화하지 않습니다.
- 일반 기록은 마지막 검색일부터 90일 보관하고, 북마크 기록은 삭제 전까지 유지합니다. 앱에서 개별·전체 삭제할 수 있습니다.
- 기록을 열 때 경로를 다시 계산합니다. 과거 경로를 현재 이용 가능한 경로로 재사용하지 않습니다.
- 통계 요약은 별도로 90일 보관하며 출발지·사용자 토큰·개인 경로를 포함하지 않습니다.
- 공유 링크에는 공개 거점만 포함하며 출발지·검색 기록은 공유하지 않습니다.

## 구현 기준

[승인된 구현 계획](docs/IMPLEMENTATION.md)이 원문 실행 계획·시나리오와 충돌하는 경우 우선합니다. 개발 키만으로 공개 서비스 운영 권한이나 처리량이 확보되었다고 보지 않습니다.

