---
version: alpha
name: Airbnb-design-analysis
description: 깨끗한 흰색 바탕과 Airbnb Rausch(#ff385c)를 중심으로 한 따뜻하고 여유로운 소비자 마켓플레이스다. 하나의 브랜드 강조색이 모든 주요 행동 버튼, 원형 검색 버튼, 평점 점을 담당한다. 글꼴은 Airbnb Cereal VF를 적당한 굵기로 사용한다. 큰 제목은 핀테크·기업용 시스템의 무거운 700+ 대신 22–28px, 굵기 500/600을 쓰며, 강한 글자보다 사진과 넉넉한 여백을 신뢰한다. 상단에는 숙소·체험·서비스(Homes, Experiences, Services) 세 항목을 손으로 그린 32 크기 아이콘과 "NEW" 배지로 표시하여 기능 나열보다 마켓플레이스의 확장을 전달한다. 알약 모양 검색창(`{rounded.full}`), 부드러운 숙소 카드(`{rounded.lg}` 약 14px), 32px 버튼 모서리는 친근하고 인간적인 인상을 준다. 본문 격자 외에는 각진 모서리가 없다.

colors:
  primary: "#ff385c"
  primary-active: "#e00b41"
  primary-disabled: "#ffd1da"
  primary-error-text: "#c13515"
  primary-error-text-hover: "#b32505"
  luxe: "#460479"
  plus: "#92174d"
  ink: "#222222"
  body: "#3f3f3f"
  muted: "#6a6a6a"
  muted-soft: "#929292"
  hairline: "#dddddd"
  hairline-soft: "#ebebeb"
  border-strong: "#c1c1c1"
  canvas: "#ffffff"
  surface-soft: "#f7f7f7"
  surface-card: "#ffffff"
  surface-strong: "#f2f2f2"
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  legal-link: "#428bff"
  star-rating: "#222222"
  scrim: "#000000"

typography:
  display-xl:
    fontFamily: "'Airbnb Cereal VF', Circular, -apple-system, system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: 0
  display-lg:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: -0.44px
  display-md:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 21px
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: 0
  display-sm:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.18px
  title-md:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  title-sm:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0
  rating-display:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1px
  body-md:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  caption:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.29
    letterSpacing: 0
  caption-sm:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.23
    letterSpacing: 0
  badge:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: 0
  micro-label:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: 0
  uppercase-tag:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 8px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0.32px
    textTransform: uppercase
  button-md:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0
  button-sm:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.29
    letterSpacing: 0
  link:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  nav-link:
    fontFamily: "'Airbnb Cereal VF', Circular, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 14px
  lg: 20px
  xl: 32px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 14px 24px
    height: 48px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 13px 23px
    height: 48px
  button-tertiary-text:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
  button-pill-rausch:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.full}"
    padding: 10px 20px
  search-orb:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    height: 48px
  icon-button-circle:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: 32px
  icon-button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: 40px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 80px
  product-tab-active:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.none}"
  product-tab-inactive:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    typography: "{typography.nav-link}"
  search-bar-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 14px 24px
    height: 64px
  search-field-segment:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    padding: 8px 24px
  category-strip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.button-sm}"
  category-tab-active:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.none}"
  property-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  property-card-photo:
    rounded: "{rounded.md}"
  experience-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.md}"
  city-link-block:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.title-sm}"
  rating-display-card:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.rating-display}"
  guest-favorite-badge:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  new-tag:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.uppercase-tag}"
    rounded: "{rounded.full}"
    padding: 2px 6px
  amenity-row:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    padding: 12px 0
  reviews-card:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
  host-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 24px
  reservation-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 24px
  date-picker-day:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
  date-picker-day-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.full}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 14px 12px
    height: 56px
  footer-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: 48px 80px
  footer-link:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
  legal-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.caption-sm}"
---

## 개요

Airbnb는 여유로운 공간과 사진을 중심으로 구성한 소비자 마켓플레이스의 대표 사례다. 기본 바탕은 **순백색**(`{colors.canvas}` — #ffffff), 제목·본문은 검정에 가까운 진한 먹색(`{colors.ink}` — #222222)이다. **Rausch**(`{colors.primary}` — #ff385c) 하나로 주요 행동 버튼, 원형 검색 버튼, 저장된 하트 상태, 본문 브랜드 링크를 강조한다. 주력 마케팅에는 두 번째 브랜드 색이 없다. **Luxe 보라색**(`{colors.luxe}` — #460479)과 **Plus 자홍색**(`{colors.plus}` — #92174d)은 Airbnb Luxe / Plus 안에서만 사용하는 하위 브랜드 강조색이다.

글꼴은 Airbnb가 라이선스하는 전용 가변 글꼴 **Airbnb Cereal VF**이며, 과거 사내 글꼴인 **Circular**를 우선 대체 글꼴로, 그 아래에 시스템 글꼴을 둔다. Cereal의 굵기는 절제되어 있다. 큰 제목은 금융·기업용 시스템이 주로 쓰는 700+보다 가벼운 500–600, 22–28px로 표시한다. 홈페이지의 주요 h1인 “다음 여행을 위한 영감”은 28px / 700에 불과하다. 일반적인 SaaS 페이지에서는 작게 느껴질 수 있지만, 여기서는 도시 콜라주·숙소 카드 사진이 글자 대신 시각적 무게를 담당하므로 잘 맞는다.

형태는 **부드럽다**. 버튼 반지름은 8px(`{rounded.sm}`), 숙소 카드는 약 14px(`{rounded.md}`), 검색창은 완전한 알약 모양(`{rounded.full}`)이다. 위시리스트 하트·검색 버튼은 원형(`{rounded.full}`)이고 카테고리 띠의 모서리는 32px(`{rounded.xl}`)이다. 본문 격자 자체를 제외하면 사실상 각진 모서리가 없고 모든 상호작용 요소가 둥글다.

**핵심 특징:**
- 단일 강조색: `{colors.primary}`(#ff385c — “Rausch”)를 주요 행동 버튼, 검색 버튼, 저장된 하트, 브랜드 워드마크에 사용한다. 사용량은 적다. 대부분의 페이지는 흰색·먹색이 90%이고 Rausch 강조 지점은 한두 곳이다.
- 전용 가변 글꼴: `Airbnb Cereal VF`. 큰 제목 굵기는 500–700, 본문은 400이다. 적당한 굵기는 의도적이며 시각적 무게를 사진에 맡긴다.
- 세 제품의 상단 탐색: 숙소·체험·서비스. 각각 손으로 그린 32px 아이콘을 사용하고 새 제품 두 개에는 “NEW” 배지(`{component.new-tag}`)를 붙인다. 활성 탭에는 밑줄(`{component.product-tab-active}`)을 사용한다.
- 알약 모양 전역 검색창: 흰색 표면, 완전한 둥근 모서리(`{rounded.full}`), 1px 가는 구분선으로 나눈 여행지·날짜·여행자 영역, 끝의 원형 Rausch 검색 버튼(`{component.search-orb}`).
- 사진 우선 숙소 카드: 가로세로 비율을 유지하는 직사각형에 `{rounded.md}` 모서리 자르기를 적용한다. 넘길 수 있는 사진 캐러셀, 왼쪽 위 “게스트 선호” 배지, 오른쪽 위 하트, 아래 4–5줄의 부가 정보를 제공한다.
- 편집형 드롭다운(푸터·언어 선택기)은 흰색 바탕 위의 깔끔한 텍스트 열이다. 카드 표면이나 그림자는 없다.
- 그림자는 한 단계로 제한한다(`box-shadow: rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px`). 마우스를 올렸을 때 떠오르는 카드와 검색·계정 드롭다운에 사용한다.
- 기본 간격은 8px이고 주요 구역은 `{spacing.section}`(64px)이다. 여유롭지만 잡지 편집처럼 지나치게 성기지 않다. 마켓플레이스에는 한 번 스크롤할 때 더 많은 카드가 보여야 한다.

## 색상

### 브랜드와 강조
- **Rausch** (`{colors.primary}` — #ff385c): 유일한 브랜드 색. 주요 행동 버튼 배경(예약·계속), 검색 버튼, 숙소 카드의 저장된 하트, 본문 브랜드 링크에 사용한다. 소비자 여행 분야에서 가장 알아보기 쉬운 색이다.
- **Rausch 누름 상태** (`{colors.primary-active}` — #e00b41): 누르거나 포인터를 내린 상태의 변형으로 채도가 조금 더 높다. `{component.button-primary-active}`에 사용한다.
- **Rausch 비활성 상태** (`{colors.primary-disabled}` — #ffd1da): 비활성 행동 버튼에 사용하는 옅은 색이다.
- **Luxe 보라색** (`{colors.luxe}` — #460479): Airbnb Luxe의 하위 브랜드 강조색. Luxe 화면 안에서만 사용하며 주력 마케팅에는 사용하지 않는다.
- **Plus 자홍색** (`{colors.plus}` — #92174d): Airbnb Plus의 하위 브랜드 강조색. Luxe와 마찬가지로 해당 하위 제품에만 사용한다.

### 표면
- **기본 바탕** (`{colors.canvas}` — #ffffff): 모든 공개 페이지의 기본 배경. Airbnb 공개 웹에는 다크 모드가 없다.
- **옅은 표면** (`{colors.surface-soft}` — #f7f7f7): 가장 옅은 채움색. 비활성 필드, 하위 탐색의 마우스 올림 배경, 본문 검색 필터 띠에 사용한다.
- **강한 표면** (`{colors.surface-strong}` — #f2f2f2): 조금 더 진한 채움색. 원형 아이콘 버튼 표면에 사용한다. 예를 들어 경로 탐색의 뒤로 화살표와 숙소 도구 모음 버튼이다.

### 가는 구분선과 테두리
- **기본 구분선** (`{colors.hairline}` — #dddddd): 기본 1px 테두리 색. 검색창 구분선, 표 구분선, 푸터 열 구분, 카드 1px 테두리에 사용한다.
- **옅은 구분선** (`{colors.hairline-soft}` — #ebebeb): 긴 편집형 본문의 구역을 나누는 더 옅은 선이다.
- **강한 테두리** (`{colors.border-strong}` — #c1c1c1): 비활성 외곽선 버튼과 포커스 후 입력 외곽선에 사용하는 더 진한 선이다.

### 텍스트
- **먹색** (`{colors.ink}` — #222222): 밝은 표면의 주된 글자색. 큰 제목, 본문 문단, 주요 탐색 링크, 대부분의 본문 링크에 사용하며 순수 검정은 쓰지 않는다.
- **본문색** (`{colors.body}` — #3f3f3f): 긴 후기·편의시설 설명에서 먹색이 너무 무겁게 느껴질 때 사용하는 보조 본문색이다.
- **약한 글자색** (`{colors.muted}` — #6a6a6a): 도시 링크 블록의 부제(전원주택·저택 숙소), 비활성 제품 탭, 푸터 카테고리 보조 레이블, “모두 보기” 링크에 사용한다.
- **더 약한 글자색** (`{colors.muted-soft}` — #929292): 비활성 링크 글자색. 매우 제한적으로 사용한다.
- **별점** (`{colors.star-rating}` — #222222): 먹색과 같은 토큰이다. 별 아이콘과 “4.81” 같은 평점 숫자는 노랑·금색 대신 먹색으로 표시한다. 여행 서비스에서 노란 별이 저렴한 인상을 준다고 보는 의도적 브랜드 선택이다.
- **강조색 위 글자** (`{colors.on-primary}` — #ffffff): Rausch 행동 버튼 위의 흰색 글자다.

### 의미별 색상
- **오류** (`{colors.primary-error-text}` — #c13515): 폼 검증의 본문 오류 글자색. Rausch보다 조금 더 어둡고 채도 높은 빨강으로 구분한다.
- **오류 링크에 마우스를 올린 상태** (`{colors.primary-error-text-hover}` — #b32505): 링크 위에 마우스를 올리면 더 어두워진다.
- **법적 안내 링크 파랑** (`{colors.legal-link}` — #428bff): 개인정보·약관 안내의 본문 링크. 법적 안내 하위 띠에서만 사용한다.

### 모달 배경막
- **배경막** (`{colors.scrim}` — #000000, 불투명도 50%): 날짜 선택기·로그인 대화상자·언어 선택기의 전역 모달 배경이다. 기본 16진수 색으로 저장하고 렌더링할 때 불투명도를 적용한다.

## 타이포그래피

### 글꼴 계열
큰 제목·본문·탐색·캡션·짧은 안내까지 모두 **Airbnb Cereal VF**를 사용한다. 대체 순서는 `Circular, -apple-system, system-ui, Roboto, "Helvetica Neue", sans-serif`다. **Circular**는 과거 사내 글꼴이며 첫 번째 비가변 대체 글꼴로 유지하고, 이후 시스템 글꼴로 보완한다.

별도 제목용 글꼴은 없다. 하나의 가변 글꼴이 전체 크기 체계를 담당한다.

### 위계

| 토큰 | 크기 | 굵기 | 줄 높이 | 자간 | 용도 |
|---|---|---|---|---|---|
| `{typography.rating-display}` | 64px | 700 | 1.1 | -1px | 숙소 상세 평점 표시(“4.81”) |
| `{typography.display-xl}` | 28px | 700 | 1.43 | 0 | 홈페이지 h1(“다음 여행을 위한 영감”) |
| `{typography.display-lg}` | 22px | 500 | 1.18 | -0.44px | 숙소 상세 h1(“페티예 알리야 발리 해변 인근…” 같은 제목) |
| `{typography.display-md}` | 21px | 700 | 1.43 | 0 | 숙소 상세의 구역 제목(“숙소 편의시설”) |
| `{typography.display-sm}` | 20px | 600 | 1.20 | -0.18px | 하위 구역 제목(“알아두어야 할 사항”) |
| `{typography.title-md}` | 16px | 600 | 1.25 | 0 | 도시 링크 블록 제목(“윌밍턴”, “아테네”) |
| `{typography.title-sm}` | 16px | 500 | 1.25 | 0 | 푸터 열 제목(“지원”, “호스팅”, “Airbnb”) |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | 숙소 설명의 기본 본문 |
| `{typography.body-sm}` | 14px | 400 | 1.43 | 0 | 카드 부가 정보, 날짜, 가격, 거리 |
| `{typography.caption}` | 14px | 500 | 1.29 | 0 | 검색 필드 영역 레이블(여행지·날짜·여행자) |
| `{typography.caption-sm}` | 13px | 400 | 1.23 | 0 | 푸터 법적 안내 줄(“© 2026 Airbnb, Inc.”) |
| `{typography.badge}` | 11px | 600 | 1.18 | 0 | 사진 위 “게스트 선호” 배지 글자 |
| `{typography.micro-label}` | 12px | 700 | 1.33 | 0 | 카드 편의시설의 작은 레이블(“Inline 6”) |
| `{typography.uppercase-tag}` | 8px | 700 | 1.25 | 0.32px (대문자) | 제품 탐색 탭의 “NEW” 배지 |
| `{typography.button-md}` | 16px | 500 | 1.25 | 0 | 주요 행동 버튼 레이블 |
| `{typography.button-sm}` | 14px | 500 | 1.29 | 0 | 알약 모양 버튼 레이블(카테고리 띠) |
| `{typography.link}` | 14px | 400 | 1.43 | 0 | 본문 링크 |
| `{typography.nav-link}` | 16px | 600 | 1.25 | 0 | 상단 제품 탐색 레이블(숙소·체험·서비스) |

### 원칙
큰 제목의 굵기는 절제한다. 홈페이지 h1의 28px / 700은 의도적으로 작다. 검색창 아래에 배치하여 사진과 도시 링크 격자가 시각적 위계를 담당하게 한다. 숙소 상세 h1의 22px / 500은 더 조용하며, 위쪽 숙소 사진 배너가 강조 역할을 한다.

전체 체계에서 글자가 강하게 드러나는 유일한 지점은 숙소 페이지의 **평점 표시**(`{typography.rating-display}` — 64px / 700)다. 글자만으로 위계를 만드는 유일한 곳이다. 평점 숫자는 핵심 신뢰 신호이므로 가장 강하게 표현한다.

### 대체 글꼴 참고
Airbnb Cereal VF와 Circular를 사용할 수 없으면 **Inter**가 가장 가까운 오픈소스 대안이다. Cereal의 조금 더 조밀한 대문자 높이에 맞춰 큰 제목의 줄 높이를 약 2% 줄인다. 나머지 비례는 그대로 적용하기 좋다.

## 레이아웃

### 간격 체계
- **기본 단위:** 4px, 미세 단계는 2px.
- **토큰:** `{spacing.xxs}` 2px · `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.base}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 64px.
- **구역 세로 안쪽 여백:** 주요 페이지 구역은 `{spacing.section}`(64px). 스크롤당 카드 밀도를 높여야 하므로 일반 SaaS 마케팅의 80–96px보다 좁다.
- **카드 내부 여백:** `{component.host-card}`와 `{component.reservation-card}`는 `{spacing.lg}`(24px), 숙소 카드 부가 정보는 `{spacing.base}`(16px), 캡션·날짜 행 사이는 `{spacing.sm}`(8px).
- **요소 사이 간격:** 홈페이지 도시 격자의 카드 사이는 `{spacing.base}`(16px), 푸터 열 사이는 `{spacing.lg}`(24px), 조밀한 카테고리 띠 구분선 주변은 `{spacing.xs}`(4px).

### 격자와 컨테이너
- **최대 콘텐츠 너비:** 홈페이지·편집형 페이지는 약 1280px로 가운데 정렬한다. 숙소 상세는 사진 배너와 예약 영역의 가독성을 위해 약 1080px로 제한한다.
- **도시 링크 격자(홈페이지 푸터):** 데스크톱에서 6열. 각 칸에 `{typography.title-md}` 도시 이름과 약한 색의 `{typography.body-sm}` 카테고리 보조 레이블을 둔다.
- **숙소 상세:** 2열. 왼쪽 사진·편의시설 본문은 약 64%, 오른쪽 고정 예약 카드(`{component.reservation-card}`)는 약 32% 너비다.
- **푸터:** 데스크톱은 지원·호스팅·Airbnb 3열 링크 목록이고 모바일에서는 1열로 줄인다.

### 여백 원칙
편집형 구역에는 세로 64px의 여유를 주지만 카드 격자는 조밀하게 한다. 숙소·도시 링크 카드는 16px만 띄운다. 이 차이는 의도적이다. 페이지 상단은 개방적이고 아래는 밀도 높은 마켓플레이스로 읽히게 하여 첫 화면에서 사용자를 압도하지 않으면서 서비스 성격을 드러낸다.

## 높이감

평평한 기본 상태 외에 사실상 **한 단계의 그림자**만 있다.

- **평면(그림자 없음):** 본문, 주요 소개 영역, 푸터, 모든 편집형 구역. 표면의 95%를 차지한다.
- **카드에 마우스를 올렸을 때의 부유감:** `box-shadow: rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0`. 숙소 카드의 마우스 올림 상태, 기본 검색창, 계정 메뉴·언어 선택기·날짜 선택기 드롭다운에 적용한다. 전체 체계의 유일한 그림자 정의다.
- **모달 배경막:** `{colors.scrim}`을 불투명도 50%로 렌더링한다. 날짜 선택기·로그인 대화상자·언어 선택기의 전역 배경이다.

높이를 여러 단계로 늘리지 않는다. 하나의 그림자가 있거나 없을 뿐이다. 깊이는 겹친 그림자보다 사진, 흰색 위 흰색 표면 구분, 둥근 모서리 자르기로 만든다.

## 구성 요소

### 버튼

**`button-primary`** — Rausch 채움, 흰색 글자, 반지름 8px, 안쪽 여백 14×24px, 높이 48px, 굵기 500. 예약·계속·검색과 계정 흐름의 주요 동작에 사용하는 가장 흔한 행동 버튼이다.

**`button-primary-active`** — 누름 상태. 배경을 `{colors.primary-active}`로 바꾸며 변형이나 그림자 변경은 없다.

**`button-primary-disabled`** — #ffd1da의 옅은 Rausch와 흰색 글자. 커서는 not-allowed다.

**`button-secondary`** — 흰색 채움, 먹색 글자와 1px 먹색 외곽선, 반지름 8px. 저장·취소, Rausch 표면 위의 반전된 행동 버튼에 사용한다.

**`button-tertiary-text`** — 표면·테두리 없이 먹색 글자만 표시하고 마우스를 올리면 밑줄을 긋는다. “더 보기” 링크와 모달 닫기 레이블에 사용한다.

**`button-pill-rausch`** — “호스트 되기” 보조 동작 같은 강조 칸의 알약 모양 Rausch 버튼. 반지름 9999px, 안쪽 여백 10×20px, 레이블 14px다.

### 검색 영역

**`search-bar-pill`** — 대표적인 전역 검색창. 흰색 채움, 반지름 9999px, 높이 64px, 1px 가는 선과 1px 그림자 테두리. 내부는 세로 가는 선으로 `{component.search-field-segment}` 칸(여행지·날짜·여행자)을 나눈다. 각 영역은 `{typography.caption}`으로 대문자 캡션 레이블을 자리표시자 줄 위에 둔다.

**`search-orb`** — 검색창 오른쪽 끝의 원형 Rausch 버튼. 48×48px의 완전한 원형이며 중앙에 흰색 돋보기 아이콘을 둔다. 홈페이지에서 가장 강하게 색이 드러나는 지점이다.

### 상단 탐색

**`top-nav`** — 흰색 표면, 높이 80px, 아래쪽 1px 구분선. Airbnb 워드마크는 왼쪽 끝, 숙소·체험·서비스 탭은 정중앙, 계정 기능(호스트 링크·언어 지구본·계정 메뉴)은 오른쪽 끝에 둔다.

**`product-tab-active`** — `{typography.nav-link}`의 먹색 레이블, 손으로 그린 32px 아이콘, 아이콘·레이블 묶음 아래 2px 먹색 밑줄.

**`product-tab-inactive`** — 약한 글자색의 레이블과 일러스트 아이콘. 밑줄은 없으며 클릭하면 활성화한다.

**`new-tag`** — 아이콘 오른쪽 위에 고정하는 작은 알약 배지(`{rounded.full}`). `{typography.uppercase-tag}`로 대문자 “NEW”를 표시한다(8px / 700, 자간 0.32px, 대문자). 체험·서비스의 새로움을 알린다.

### 숙소 카드

**`property-card`** — 사진 중심 카드. 1:1 이미지에 `{rounded.md}` 모서리 자르기를 적용하고 캐러셀 점을 겹친다. 왼쪽 위 “게스트 선호” 배지(`{component.guest-favorite-badge}`), 오른쪽 위 하트(`{component.icon-button-circle}`)를 둔다. 하트는 기본 외곽선 상태이며 저장하면 Rausch로 채운다. 사진 아래에는 제목(`{typography.title-md}`), 거리·날짜(약한 색의 `{typography.body-sm}`), 오른쪽 정렬 가격(1박 $X) 등 4–5줄의 부가 정보를 둔다.

**`property-card-photo`** — 사진 영역 자체. 위시리스트·검색 결과처럼 부가 정보 없이 사진만 재사용하는 화면이 있어 별도 토큰으로 구분한다.

**`experience-card`** — 체험 목록용으로 더 긴 4:5 비율의 카드. 같은 `{rounded.md}` 자르기, 왼쪽 위 “NEW” 배지, 오른쪽 위 하트, 아래 한 줄 제목을 사용한다.

**`guest-favorite-badge`** — 흰색 알약 모양(`{rounded.full}`), 11px / 굵기 600. 사진 위에 두며 유일한 그림자 단계로 떠 있는 느낌을 준다.

### 숙소 상세

**`rating-display-card`** — 숙소 상세의 대표 요소. 64px / 700 평점 숫자(“4.81”) 양옆에 작은 월계관 SVG 장식을 둔다. 아래에는 “게스트 선호” 문구와 먹색 통계 열을 배치한다. 전체 체계에서 타이포그래피가 가장 강하게 드러나는 곳이다.

**`amenity-row`** — 편의시설 아이콘과 `{typography.body-md}` 먹색 레이블의 1열 목록. 행 안쪽 여백은 12px이고 행 사이 테두리는 없다. 구역 위아래를 1px 구분선으로 닫는다.

**`reviews-card`** — 후기 발췌 2열 격자. 각 열은 작성자 행(아바타·이름·날짜) 아래 3줄 발췌와 텍스트형 “더 보기” 링크를 둔다.

**`host-card`** — `{rounded.md}` 모서리와 24px 안쪽 여백의 흰색 카드. 호스트 아바타·이름·슈퍼호스트 배지·응답률·“호스트에게 연락하기” `{component.button-secondary}`를 담는다.

**`reservation-card`** — 숙소 상세 오른쪽의 고정 카드. 흰색 표면, `{rounded.md}` 모서리, 1px 구분선 테두리, 1px 그림자 단계, 24px 안쪽 여백. 1박 가격(먹색 `{typography.display-md}`), 날짜 범위 선택기, 인원 수 증감 입력, 전체 너비의 예약 주요 버튼, 아래 `{typography.body-sm}` 요금 내역을 포함한다.

### 날짜 선택기

**`date-picker-day`** — `{typography.body-sm}` 날짜 숫자가 있는 40×40px 원형 칸. 기본은 투명 채움·먹색 글자다.

**`date-picker-day-selected`** — 먹색 채움·흰색 글자의 완전한 원형(`{rounded.full}`). 선택한 두 날짜 사이 범위에는 `{colors.surface-soft}`의 둥근 직사각형 배경을 연결한다.

### 폼

**`text-input`** — 흰색 표면, 1px 가는 외곽선, `{rounded.sm}` 반지름 8px, 높이 56px, 안쪽 여백 14×12px. 위에는 약한 색의 `{typography.caption}` 레이블을 쌓고 자리표시자는 약한 색의 `{typography.body-md}`로 표시한다. 포커스 시 테두리는 먹색 2px로 두꺼워지고 색은 `{colors.ink}`가 된다. 빛 번짐이나 링은 없다.

### 푸터

**`footer-light`** — 페이지 바탕과 같은 흰색 표면. Airbnb는 대비색 푸터를 사용하지 않는다. 안쪽 여백은 48×80px다. 지원·호스팅·Airbnb 링크 블록 3열을 여유로운 24px 간격으로 나눈다. 각 열은 먹색 `{typography.title-sm}` 제목 아래 먹색 `{typography.body-sm}`의 `{component.footer-link}` 행을 쌓는다.

**`legal-band`** — 푸터 열 아래의 띠. 저작권 줄, 언어 선택기(지구본 아이콘과 “영어(미국)” 링크), 통화 선택기, 소셜 아이콘(Facebook, X, Instagram)을 담는다. 모든 글자는 약한 색 `{colors.muted}`와 `{typography.caption-sm}`를 사용한다.

## 반응형 동작

| 구분 | 너비 | 주요 변경 |
|---|---|---|
| 모바일 | < 744px | 상단 탐색은 로고·햄버거 메뉴로 줄이고 제품 탭은 시트 안에 숨긴다. 검색창은 한 번 누르는 알약 모양으로 축소한다. 숙소 카드는 1열, 도시 격자는 1열이며 숙소 상세 예약 카드는 하단 고정 막대로 바뀐다. |
| 태블릿 | 744–1128px | 제품 탭은 유지하고 검색창을 좁힌다. 숙소 카드는 2열, 도시 격자는 2–3열이며 예약 카드는 좁아진 오른쪽 고정 영역에 유지한다. |
| 데스크톱 | 1128–1440px | 세 제품 탭을 중앙에 둔 전체 상단 탐색을 표시한다. 검색창은 세 영역이 모두 보이는 전체 알약 너비다. 숙소 카드는 4열, 도시 격자는 6열, 숙소 상세는 예약 영역을 포함한 2열이다. |
| 넓은 화면 | > 1440px | 숙소·검색 페이지 콘텐츠는 1440px, 편집형 페이지는 약 1280px로 제한하고 남은 공간은 바깥 여백으로 흡수한다. |

### 터치 영역
- 주요 행동 버튼은 최소 48×48px이며 WCAG AAA 기준보다 크다.
- 원형 검색 버튼은 48×48px이며 페이지에서 가장 많이 누르는 요소다.
- 하트 저장 버튼은 32×32px 원형이다. AAA에는 경계 수준이지만 사진 카드 내부의 여유로운 12px 안쪽 여백으로 보완한다.
- 날짜 선택기의 날짜 칸은 40×40px 원형이다.

### 축소 전략
- 744px 미만에서는 상단 제품 탭을 햄버거 메뉴 시트로 접는다.
- 검색창의 세 영역은 한 번 누르면 전체 화면 검색 오버레이가 열리는 모바일 진입점 하나로 합친다.
- 숙소·도시 링크 격자는 분기점마다 열 수를 명확히 줄인다. 행을 재배치하지 않고 항상 열 수를 줄인다.
- 숙소 상세 예약 카드는 모바일에서 오른쪽 고정 영역 대신 하단 고정 막대로 바뀌며, 예약 버튼과 1박 가격 요약만 담는다.

## 알려진 누락 사항

- **마우스 올림 상태 색상:** 전역 정책에 따라 의도적으로 문서화하지 않았다. Airbnb 숙소 카드의 실제 `:hover` 스타일은 약간 떠오르는 효과지만 정밀한 추출은 신뢰하기 어렵다.
- **로딩 상태·스켈레톤 화면:** 추출한 화면에서 관찰하지 못했다.
- **지도 화면 스타일:** 검색 결과 지도는 Mapbox 색조 타일과 사용자 지정 Rausch 마커를 사용하지만 여기에는 수집하지 않았다.
- **폼 입력 오류 상태:** 오류 글자색(`{colors.primary-error-text}`)은 기록했으나 검증 실패 시 입력 외곽선·보조 문구의 전체 조합은 수집 화면에서 보이지 않았다.
- **하위 브랜드 팔레트:** Luxe(`{colors.luxe}`)와 Plus(`{colors.plus}`) 토큰은 기록했지만 타이포그래피 재정의·표면 처리를 포함한 전체 하위 체계는 별도 하위 도메인에 있어 여기에는 수집하지 않았다.
