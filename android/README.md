# Android TWA 설정 — 실제 식별 정보와 도구 준비 전까지 차단

Android 앱, 서명 키, APK, AAB는 아직 생성하지 않았다. 이 폴더는 실행 가능한 설정 절차이며, 설치 가능한 앱이 있다는 의미가 아니다. 소유자는 본인 소유의 HTTPS 원본 주소, 영구 패키지 ID, **Play App Signing 인증서** SHA-256, Play 계정 접근 권한, 업로드 키 관리·백업, 설치된 JDK/Android SDK/Bubblewrap, 충분한 디스크 공간, 실제 테스트 기기를 준비해야 한다. 이 값을 임의로 만들지 않는다. 키 암호나 개인 키를 Git에 넣지 않는다.

로컬 PowerShell 세션 또는 Node 명령용 비공개 환경 파일에 다음 환경 변수를 설정한다. 실제 값은 의도적으로 생략했다.

| 변수 | 출처 |
| --- | --- |
| `APP_ORIGIN` | 소유한 공개 HTTPS 원본 주소. 경로·쿼리·인증 정보·사용자 지정 포트·IP는 허용하지 않음 |
| `ANDROID_PACKAGE_ID` | 소유자가 정한 영구 역도메인 형식 Android 식별자 |
| `PLAY_APP_SIGNING_SHA256` | Play Console 앱 무결성 → 앱 서명 키 인증서 SHA-256. 콜론으로 구분한 32바이트 |
| `ANDROID_HOME` | 기존 Android SDK 위치 |
| `ANDROID_KEYSTORE_PATH` | 저장소 밖에 둔 소유자 업로드 키 저장소의 절대 경로 |
| `ANDROID_KEY_ALIAS` | 업로드 키 별칭 |
| `VITE_OPERATOR_NAME`, `VITE_OPERATOR_CONTACT` | 개인정보 안내 UI에 빌드 시 포함할 실제 운영자와 공개 지원 이메일 |

업로드 키는 일반적으로 Play가 배포하는 앱의 인증서와 다르다. 사이트의 Digital Asset Links에는 Play 인증서가 있어야 한다. 로컬 서명 APK를 로컬에서 검증하려면 테스트 사이트 연결 파일에 해당 APK의 **실제** 로컬 인증서를 넣어야 한다. 운영용 Play 연결을 디버그·업로드 인증서로 대체하지 않는다. 인증서 교체와 추가하려는 모든 인증서를 명시적으로 기록한다. [Android TWA 안내](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)

Node 24가 `PATH`에 등록된 상태에서 저장소 루트에서 실행한다.

```powershell
node scripts/android-config.mjs
npm run build
powershell -NoProfile -File scripts/android.ps1 preflight
```

설정 생성기는 세 가지 식별 값을 모두 검증한 뒤 `public/.well-known/assetlinks.json`과 Git 추적에서 제외된 `android/identity.json`을 쓴다. 공개 연결 파일을 검토하고 식별 정보 승인 후에만 커밋한다. `preflight`는 설치된 `java`, `bubblewrap`, `adb`, `ANDROID_HOME`, `bubblewrap doctor`를 확인하며 아무것도 설치하지 않는다. Bubblewrap 자체 명령에서 다운로드를 제안할 수 있지만, 자원이 제한된 이 컴퓨터에서는 거절한다. 도구 설치, SDK 라이선스, 계정과 비용은 별도로 준비해야 한다.

승인된 웹 배포로 실제 HTTPS 매니페스트에 접근할 수 있게 된 뒤 실행한다.

```powershell
powershell -NoProfile -File scripts/android.ps1 init
powershell -NoProfile -File scripts/android.ps1 build
```

`init`은 `bubblewrap init --manifest <actual origin>/manifest.webmanifest --directory android/app`을 실행한다. 대화형 입력에는 승인된 패키지 ID, 시작 경로 `/`, 앱 이름 `어디서 만나`, 원하는 화면 방향, 소유자가 관리하는 업로드 키를 정확히 사용한다. 스크립트는 생성된 호스트와 패키지 ID를 검증한다. 빌드 전에 `android/app/twa-manifest.json`, 버전 코드, 서명 설정, 생성된 Android 프로젝트를 검토한다. `build`는 검증·서명 생략 옵션 없이 Bubblewrap을 실행하며 `android/app/app-release-signed.apk`와 `android/app/app-release-bundle.aab`를 결과물로 요구한다. 이 명령은 업로드를 수행하지 않는다. 키·빌드 결과·로컬 SDK 경로가 실수로 커밋되지 않도록 Bubblewrap 생성 디렉터리는 Git 추적에서 제외한다. [Bubblewrap 명령과 설정](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md)

소유자의 Play 내부 테스트 트랙 사용에 대한 명시적 승인 후, 해당 트랙으로 배포하여 **Play가 서명한** 앱을 검증한다. Android 증빙 보고서에 패키지·버전, 기기·OS·브라우저 버전, 인증서 SHA-256, 설치 출처, 배포 리비전, 테스트 날짜, 관찰 결과를 기록한다. 참가자 주소·좌표·세션 토큰·키는 기록하지 않는다.

필수 실기기 사례: 최초 실행, 상세·결과·입력 화면에서 Android 뒤로 가기, 백그라운드 전환·복귀, 프로세스 종료·재실행, 앱 업데이트, 오프라인 시작·복구, 외부 Kakao 지도 이동·복귀, 공유·취소·복귀, 시스템 글자 크기와 360px에 해당하는 화면 너비, 앱 설치·미설치 상태의 공개 허브 직접 링크, Chrome·Samsung Internet 대체 동작, 의도적인 DAL 검증 실패 시 브라우저 도구 모음 표시와 웹 앱 사용 가능 여부. 모바일 Safari는 웹 환경으로 별도 테스트한다. 새로운 위치 권한을 요청하지 않는지 확인한다. 데스크톱 브라우저 테스트로 이 사례를 통과 처리하지 않는다.

서명 관리 기록은 내부 배포 전에 소유자가 작성한다. 키 소유자, 암호화된 백업 위치, 복구 담당자, 업로드 키 초기화 절차, Play App Signing 등록, SHA-256, 인증서 교체 계획을 포함한다. 실제 비밀 값은 이 기록 밖에 보관한다. 롤백할 때는 단계적 출시를 중단하고 웹과 호환되는 마지막 안정 리비전을 **더 높은 Android 버전 코드**로 다시 빌드한다. Android는 일반적인 낮은 버전으로의 교체를 허용하지 않는다. 기존 패키지 ID와 서명 계보는 유지한다. [배포와 롤백](../docs/DEPLOYMENT.md)을 참고한다.
