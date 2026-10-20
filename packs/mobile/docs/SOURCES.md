# mobile 팩 — 근거 출처

mobile 레이어 룰(`packs/mobile/rules/`)이 기대는 공개 자료다. 룰에 넣은 규칙은 여기 자료에서 왔다.
프로젝트의 기존 관례가 있으면 그것이 먼저이고, 이 목록은 관례가 없을 때의 기준선이다. (조사일 2026-09-29)
룰 번호는 파일 앞 숫자다 — `10` 기본 원칙(always), `20` 웹뷰·브리지, `30` 권한·개인정보·로컬 저장, `40` 수명 주기·백그라운드·오프라인·네트워크·링크, `50` 배포·서명·스토어.

## 룰별 근거

### `10` 모바일 앱 기본 원칙

| 항목 | 근거 |
|---|---|
| 프로젝트의 기존 구조를 따른다 | 킷 규칙(`AGENTS.md` 1) — 관례를 표준처럼 강요하지 않는다 |
| 메인 스레드를 막지 않고 밖에서 UI 를 만지지 않는다, ANR·워치독 | Android Processes and threads(단일 스레드 모델 두 규칙) · Android ANRs · Apple Addressing watchdog terminations |
| 화면 컴포넌트에 데이터를 맡기지 않는다 | Android Guide to app architecture("Don't store data in app components") · Android Save UI states |
| 권한은 필요한 것만, 쓸 때 묻고, 거부돼도 동작 · iOS 용도 문구 없으면 종료 | Android Request runtime permissions · Android Security tips(Permissions) · Apple HIG Privacy · Apple Requesting authorization to capture and save media · OWASP MASVS-PRIVACY-1 |
| 비밀은 Keychain·Keystore, API 비밀 키를 앱에 넣지 않는다 | Apple Keychain Services · Android Keystore system · React Native Security · Capacitor Security · OWASP MASVS-STORAGE-1 |
| 통신은 HTTPS, 평문·ATS 예외·검증 우회 금지 | Apple Preventing insecure network connections · Android Network security configuration · OWASP MASVS-NETWORK-1 |
| 딥 링크·인텐트·웹뷰 메시지는 외부 입력 | Apple Defining a custom URL scheme · Apple Supporting universal links · Android Security tips(Intents) · React Native Security(Deep linking) · OWASP MASVS-PLATFORM-1·CODE-4 |
| 웹뷰에 네이티브 기능을 넓게 열지 않는다 | Android Security tips(WebView) · Android Insecure WebView native bridges · Cordova Security Guide · OWASP MASVS-PLATFORM-2 |
| 로그·크래시에 개인정보·토큰 금지 | Android Security tips(Logging) · OWASP MASVS-STORAGE-2 |
| 레이블·터치 영역·글자 확대·색만으로 구분 금지 | Android Make apps more accessible(48dp·contentDescription·대비) · Apple HIG Accessibility(44x44 pt·텍스트 확대·색 외 표시) · W3C WCAG 2.2 SC 2.5.8 |
| 한 플랫폼만 확인했으면 적는다 | 위 자료들이 Android·iOS 마다 다른 동작을 기술 |

### `20` 웹뷰·브리지

| 항목 | 근거 |
|---|---|
| 스크립트를 쓰지 않으면 켜지 않는다(Android 기본 꺼짐) | Android Security tips — "By default, WebView doesn't execute JavaScript" |
| `file://` 접근 설정 명시적으로 끔 · `WebViewAssetLoader` | Android WebViews – Unsafe File Inclusion (`setAllowFileAccess` 는 API 29 이하 기본 켬, 30 이상 기본 끔) |
| 혼합 콘텐츠·평문·웹 디버깅·개발 서버 URL·내비게이션 전체 허용은 배포에 두지 않는다 | Capacitor Config(`server.url`·`server.cleartext`·`server.allowNavigation`·`android.allowMixedContent` "not intended for use in production", `webContentsDebuggingEnabled` 기본 false) |
| 자체 서명 인증서 허용 금지 | Cordova Security Guide |
| 브리지는 번들 콘텐츠에만, 신뢰하지 않는 콘텐츠 전 인터페이스 제거 | Android Security tips(`addJavascriptInterface`) · Android Insecure WebView native bridges(`removeJavascriptInterface`) |
| 자바스크립트 인터페이스는 iframe 포함 모든 프레임에 주입, 호출 출처 확인 불가 · 메시지 채널 대상 출처에 `*` 금지 | Android Insecure WebView native bridges · Android Security best practices(HTML message channels) |
| 민감 작업을 브리지로 열지 않는다 | Android Insecure WebView native bridges("Avoid using JavaScript interfaces for any sensitive operations or user data") |
| 메인 웹뷰 안 모든 코드가 플러그인과 통신 가능 · 광고·iframe 주의 | Cordova Security Guide |
| 내비게이션 신뢰 도메인 제한(Cordova 기본 제한 없음) · CSP · `eval` | Cordova Security Guide · Capacitor Security(CSP) |
| 외부 링크의 스킴·호스트 검증(허용 도메인) | Android Insecure WebView native bridges |
| 플랫폼 채널 처리기는 메인 스레드 기본, 백그라운드는 Task Queue · 표준 코덱 | Flutter Writing custom platform-specific code |
| AsyncStorage 는 암호화되지 않는다 · 보안 저장 모듈 | React Native Security |

### `30` 권한·개인정보·로컬 저장

| 항목 | 근거 |
|---|---|
| 필요 없는 권한은 요청하지 않는다 · 다른 앱에 맡길 일은 인텐트로 | Android Security tips(Permissions) · Android Security best practices(Use intents to defer permissions) |
| 기능 사용 시점에 묻는다 · 시작 시 묻지 않는다 | Android Request runtime permissions · Apple HIG Privacy |
| 쓸 때마다 확인 · 거부 시 기능만 끄고 계속 사용 · 설명 화면에 취소 · `shouldShowRequestPermissionRationale` | Android Request runtime permissions |
| iOS 용도 문구 키 필수, 없으면 종료 | Apple `NSCameraUsageDescription` · Apple Requesting authorization to capture and save media |
| 권한 허용에 보상 금지, 시스템 경고 흉내 금지 | Apple HIG Privacy |
| 개인정보 매니페스트(수집 데이터·사유 필요 API·추적 도메인), SDK 매니페스트 | Apple Privacy manifest files |
| App Store 개인정보 항목에 서드파티 파트너 포함, 바뀌면 갱신 | Apple App privacy details on the App Store |
| Play 데이터 보안 양식 — 모든 앱, 서드파티 코드 포함, 처리방침 필요 | Google Play Console Help — Data safety section |
| Keystore 키는 추출 불가·하드웨어 기반 가능 | Android Keystore system |
| 앱 전용 저장소는 다른 앱이 못 읽고 삭제 시 지워짐 · 공유 저장소 API | Android Data and file storage overview · Android Security best practices(Store data safely) |
| 외부 저장소는 누구나 읽고 씀 · 동적 로드 코드 서명 검증 | Android Security tips(External storage) |
| 평문 설정에 토큰 금지 | React Native Security · Capacitor Security · Android Auto Backup(자격 증명은 파일·SharedPreferences 대신 Block Store) |
| iOS 파일 보호 등급, 사용자 데이터는 Complete | Apple Encrypting your app's files |
| 자동 백업 기본 켬, 기기 고유 식별자·푸시 토큰 제외, `dataExtractionRules`·`fullBackupContent` | Android Back up user data with Auto Backup |
| `android:exported` 명시(Android 12 대상 필수) | Android 12 behavior changes · Android Security tips |
| 서명 수준 권한 · `content://` + 일회성 허가 플래그 | Android Security best practices · Android Security tips |
| 명시적 인텐트 · 인텐트 필터는 보안 장치가 아님 · 매개변수 쿼리 · 권한 데이터 누출 · localhost IPC 금지 | Android Security tips |

### `40` 수명 주기·백그라운드·오프라인·네트워크·링크

| 항목 | 근거 |
|---|---|
| 단일 스레드 모델 두 규칙 | Android Processes and threads |
| 5초 입력 ANR, 서비스·브로드캐스트 시간 제한, 메인 스레드 I/O | Android ANRs |
| 워치독 — 동기 네트워크·큰 데이터·큰 마이그레이션 | Apple Addressing watchdog terminations |
| StrictMode · Main Thread Checker · Thread Sanitizer | Android `StrictMode` 레퍼런스 · Apple Diagnosing memory, thread, and crash issues early |
| 설정 변경·프로세스 종료, 뷰모델은 프로세스 종료 때 사라짐, 저장 상태는 작은 값만, 영구 저장소 아님 | Android Save UI states |
| 진입점을 데이터 원천으로 쓰지 않는다 · 단일 원천 · 단방향 흐름 | Android Guide to app architecture |
| WorkManager — 재시작·재부팅 후 유지, 조건, 백오프 | Android Persistent work(WorkManager) · Android Build an offline-first app |
| iOS 백그라운드 진입 후 곧 정지, 실행 시간 연장은 시작 전 요청·끝나면 즉시 종료 알림 | Apple Extending your app's background execution time |
| 로컬이 단일 원천 · 네트워크 없이 읽기 · 쓰기 전략 3종 · 마지막 쓰기 우선 | Android Build an offline-first app |
| Android 9 이상 평문 기본 차단 · `debug-overrides` · 핀 만료·백업 핀 | Android Network security configuration |
| `usesCleartextTraffic` 는 네트워크 보안 설정이 있으면 무시 | Android `<application>` 매니페스트 요소 |
| ATS — TLS 1.2 이상·전방 비밀성, 예외는 도메인 단위, 일부 예외는 심사 사유 필요, 서버를 고치는 게 우선 | Apple Preventing insecure network connections |
| 자체 서명 인증서·검증 우회 금지 | Cordova Security Guide · Android Security best practices(custom trust manager 는 사용자 정의 CA 용) |
| 인증서 고정 | OWASP MASVS-NETWORK-2 · Android Network security configuration · React Native Security |
| 검증된 링크 권장 · 커스텀 스킴은 다른 앱도 등록 가능 | Android About App Links · Apple Defining a custom URL scheme |
| URL 인자 검증·잘못된 형식 폐기·위험 동작 제한·깨진 URL 테스트 | Apple Supporting universal links · Apple Defining a custom URL scheme |
| 링크에 민감 정보 금지 · PKCE | React Native Security · Capacitor Security |
| `assetlinks.json` 에 패키지 이름·인증서 지문, Play 앱 서명이면 콘솔 값 | Android Configure website associations |

### `50` 배포·서명·스토어

| 항목 | 근거 |
|---|---|
| 서명 설정이 빌드 파일에 평문으로 남는다 · 별도 파일을 저장소 밖에 | Android Sign your app |
| 같은 인증서로 수명 내내 · 서명 키 분실 시 업데이트 불가 · Play 앱 서명과 업로드 키 재설정 | Android Sign your app |
| 스토어는 디버깅 가능 앱을 받지 않는다 · 디버그 전용 설정 | Android Network security configuration |
| 배포 빌드 로그 줄이기 | Android Security tips(Logging) |
| 비 SDK 인터페이스는 깨질 위험 | Android Restrictions on non-SDK interfaces |
| 대상 SDK 에 묶인 요구(`exported`·`PendingIntent` 가변성) | Android 12 behavior changes |
| 스토어 대상 API 수준 요구 (조사일 기준: 2026-08-31 부터 신규 앱·업데이트는 Android 16(API 36) 이상, 연장 신청 시 2026-11-01) | Android Meet Google Play's target API level requirement |
| 의존성·SDK 최신 보안 패치 | Android Security best practices · OWASP MASVS-CODE-3 |
| 계정 삭제(5.1.1(v)) · 처리방침(5.1.1(i)) · 코드 내려받아 실행 금지(2.5.2) · 숨은 기능 금지(2.3.1) | Apple App Review Guidelines |
| Play 데이터 보안 양식에 처리방침 필요 | Google Play Console Help — Data safety section |

## 자료 목록

### Android

| 자료 | URL |
|---|---|
| Guide to app architecture | https://developer.android.com/topic/architecture |
| Save UI states | https://developer.android.com/topic/libraries/architecture/saving-states |
| Build an offline-first app | https://developer.android.com/topic/architecture/data-layer/offline-first |
| Processes and threads overview | https://developer.android.com/guide/components/processes-and-threads |
| ANRs | https://developer.android.com/topic/performance/vitals/anr |
| `StrictMode` | https://developer.android.com/reference/android/os/StrictMode |
| Persistent work (WorkManager) | https://developer.android.com/develop/background-work/background-tasks/persistent |
| Request runtime permissions | https://developer.android.com/training/permissions/requesting |
| Security tips (security checklist) | https://developer.android.com/privacy-and-security/security-tips |
| App security best practices | https://developer.android.com/privacy-and-security/security-best-practices |
| Network security configuration | https://developer.android.com/privacy-and-security/security-config |
| `<application>` manifest element | https://developer.android.com/guide/topics/manifest/application-element |
| Android Keystore system | https://developer.android.com/privacy-and-security/keystore |
| Data and file storage overview | https://developer.android.com/training/data-storage |
| Back up user data with Auto Backup | https://developer.android.com/identity/data/autobackup |
| WebViews – Unsafe File Inclusion | https://developer.android.com/privacy-and-security/risks/webview-unsafe-file-inclusion |
| Insecure WebView native bridges | https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges |
| About App Links | https://developer.android.com/training/app-links |
| Configure website associations (assetlinks) | https://developer.android.com/training/app-links/configure-assetlinks |
| Android 12 behavior changes | https://developer.android.com/about/versions/12/behavior-changes-12 |
| Restrictions on non-SDK interfaces | https://developer.android.com/guide/app-compatibility/restrictions-non-sdk-interfaces |
| Sign your app | https://developer.android.com/studio/publish/app-signing |
| Meet Google Play's target API level requirement | https://developer.android.com/google/play/requirements/target-sdk |
| Make apps more accessible | https://developer.android.com/guide/topics/ui/accessibility/apps |
| Play Console Help, Data safety section | https://support.google.com/googleplay/android-developer/answer/10787469 |

### Apple

| 자료 | URL |
|---|---|
| Addressing watchdog terminations | https://developer.apple.com/documentation/xcode/addressing-watchdog-terminations |
| Diagnosing memory, thread, and crash issues early | https://developer.apple.com/documentation/xcode/diagnosing-memory-thread-and-crash-issues-early |
| Extending your app's background execution time | https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time |
| Privacy manifest files | https://developer.apple.com/documentation/bundleresources/privacy-manifest-files |
| `NSCameraUsageDescription` | https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription |
| Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media |
| Keychain Services | https://developer.apple.com/documentation/security/keychain-services |
| Encrypting your app's files | https://developer.apple.com/documentation/uikit/encrypting-your-app-s-files |
| Preventing insecure network connections (ATS) | https://developer.apple.com/documentation/security/preventing-insecure-network-connections |
| Defining a custom URL scheme for your app | https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app |
| Supporting universal links in your app | https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app |
| Human Interface Guidelines, Privacy | https://developer.apple.com/design/human-interface-guidelines/privacy |
| Human Interface Guidelines, Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| App Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ |
| App privacy details on the App Store | https://developer.apple.com/app-store/app-privacy-details/ |

### 크로스플랫폼·하이브리드

| 자료 | URL |
|---|---|
| Capacitor, Security | https://capacitorjs.com/docs/guides/security |
| Capacitor, Configuration | https://capacitorjs.com/docs/config |
| Apache Cordova, Security Guide | https://cordova.apache.org/docs/en/latest/guide/appdev/security/index.html |
| React Native, Security | https://reactnative.dev/docs/security |
| Flutter, Writing custom platform-specific code | https://docs.flutter.dev/platform-integration/platform-channels |

### 보안 표준·접근성

| 자료 | URL |
|---|---|
| OWASP MASVS (v2 통제 항목 STORAGE·CRYPTO·AUTH·NETWORK·PLATFORM·CODE·RESILIENCE·PRIVACY) | https://mas.owasp.org/MASVS/ |
| W3C, Understanding WCAG 2.2 SC 2.5.8 Target Size (Minimum) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
