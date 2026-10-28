# 거점 행정구역 근거 반영 구현 계획

> 실행: superpowers:executing-plans로 이 세션에서 직접 수행한다.

**목표:** 검수 근거와 현재 지점이 일치하는 후보만 지역 분류에 사용하고 서울·경기·인천 밖 11개를 제외하여 100개를 재선정한다.
**구조:** 기존 normalizeSources 결과에 applyRegionChecks(result, checks)를 적용한다. 새 승인 저장소 없이 10월 28일 조회 근거의 results를 재사용한다. 지역 대조는 verified를 변경하지 않는다.
**기술:** Node 24, 기존 node:test와 JSON 카탈로그. 새 의존성 없음.
**기준:** [승인 계획](../../IMPLEMENTATION.md), [검수 결과](../../HUB-REVIEW.md).

## 제약과 검토 초점

- 원본 좌표·이름·출처 날짜를 보존한다. 이전 실측 입력은 Git 커밋 44a9330과 카탈로그 version으로 식별한다.
- 근거 누락·중복 ID·오래된 fingerprint·잘못된 법정동 코드·실패 응답이면 생성을 중단한다.
- 기존 완전 승인과 지역 판정이 모순되면 중단한다. 원본 중복 격리와 출시 승인 조건은 유지한다.
- 지역 안이어도 verified:false를 유지하고, 출시 카탈로그가 비어 있는 현재 차단을 해제하지 않는다.
- 표본은 수단별 50개·총100개를 유지하며 공급자 실측은 이 변경의 로컬 검사로 대체하지 않는다.

## 작업 1: 지역 근거 적용과 재표본화

파일: scripts/build-hubs.mjs, tests/catalog.test.mjs, data/hubs.preview.json, data/hubs.sample.json, data/quality-report.json, data/README.md, docs/HUB-REVIEW.md, docs/ROUTING-VALIDATION.md, 당일 worklog.

- [x] 실제 표본이 지역 밖 후보를 포함하지 않아야 하는 검사 추가 후 실패 확인.
- [x] applyRegionChecks의 허용/제외, 누락·중복·오래됨·응답 오류·승인 모순 검사를 추가한다.
- [x] 기존 결과와 조회 results를 받아 fingerprint/법정동 코드를 검사하는 함수 구현. 허용 후보에만 regionCode를 반영하며 제외 사유를 기존 excluded에 합친다.
- [x] main에서 근거 파일을 읽어 이 함수를 적용하고 품질 보고의 지역 대조 상태를 갱신한다.
- [x] node scripts/build-hubs.mjs --preview 실행. 589개/철도528·버스61, 표본100개·허용지역만 포함, 승인0개를 확인한다.
- [x] node --test tests/catalog.test.mjs 및 전체 npm test를 실행한다. 연속 재생성의 바이트 동일성과 출시 카탈로그 보존을 확인한다.
- [x] 새 버전·과거 입력 재현 방법·남은 검수 조건을 문서와 worklog에 기록한다. 리뷰 후 해당 파일만 커밋·upstream push한다.
