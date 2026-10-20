# watch 팩 — 근거 출처

watch 레이어 룰(`packs/watch/rules/`)이 기대는 공개 자료다. 룰에 넣은 규칙은 여기 자료에서 왔다.
프로젝트의 기존 관례가 있으면 그것이 먼저이고, 이 목록은 관례가 없을 때의 기준선이다. (조사일 2026-09-29)
룰 번호는 파일 앞 숫자다 — `10` 기본 원칙(always), `20` 화면·입력·상시 표시·접근성, `30` 컴플리케이션·타일·알림·백그라운드, `40` 독립 실행·폰 연동·건강 데이터.
일반 모바일 주제(권한 요청 흐름 일반·로컬 저장 보안·서명·스토어 배포)는 mobile 팩의 몫이라 여기서 다루지 않는다.

## 룰별 근거

### `10` 워치 앱 기본 원칙

| 항목 | 근거 |
|---|---|
| 프로젝트의 기존 구조를 따른다 | 킷 규칙(`AGENTS.md` 1) — 관례를 표준처럼 강요하지 않는다 |
| 몇 초 안에 끝나는 일만, 얕은 계층, 긴 일은 폰으로, 폰 화면을 옮기지 않는다 | Wear OS Design principles("within seconds", "Better together") · Apple HIG Designing for watchOS("Minimize the depth of hierarchy", 1분 미만 상호작용) · Wear OS Conserve power("It shouldn't directly copy your mobile app") |
| 작은·원형 화면, 글자 크기, 터치 영역, 회전 입력 | Wear OS App Quality(WO-V1·V2·V16) · Wear OS Screen sizes · Wear OS Rotary input · Apple HIG Digital Crown |
| 배터리, 시스템이 백그라운드를 제한, 호출이 안 와도 동작 | Apple Using background tasks("Budget your app's background time", fallback) · Wear OS Conserve power |
| 폰이 없어도 동작 | Wear OS Standalone apps · Apple Creating independent watchOS apps · Apple Keeping your watchOS content up to date |
| 상시 표시·손목 화면의 민감 정보 | Apple HIG Always On("Hide sensitive information") · Apple Designing your app for the Always On state · Apple HIG Notifications(short look privacy) |
| 건강·센서 데이터 최소 요청, 거부돼도 동작, 광고·제3자 금지 | Apple HealthKit Protecting user privacy · Wear OS Health Services permissions |
| 일부 화면·실기기만 확인했으면 적는다 | Wear OS App Quality(작은·큰 원형 에뮬레이터 권장) · Apple WatchConnectivity 샘플(실기기 한 쌍으로 테스트, Xcode 실행 시 일시 중지 동작 차이) |

### `20` 화면·입력·상시 표시·접근성

| 항목 | 근거 |
|---|---|
| 핵심 작업 한두 개, 몇 초, 오프라인 전제 | Wear OS Design principles("Design for critical tasks", "Works offline") |
| 세로 내비게이션을 크라운에 맞춘다 | Apple HIG Digital Crown("Anchor your app's navigation to the Digital Crown") |
| 스크롤 가능한 배치가 기본, 대화 상자도 스크롤 | Wear OS Screen sizes |
| 비율 기준 여백, 큰 화면 기준점 | Wear OS Screen sizes("percentage-based margins", 너비 기준점 예 225dp) |
| 가장자리에서 잘림·겹침 없음 | Wear OS App Quality WO-V16 |
| 사용자 글자 크기 존중, 말줄임, 자동 크기 최소·최대 | Wear OS App Quality WO-V1 · Wear OS Accessibility · Apple HIG Accessibility(watchOS 140% 확대) |
| 터치 영역 48×48dp, 글자 12sp·10sp | Wear OS App Quality WO-V2·WO-V14 (접근성 문서는 40dp 예외도 언급) |
| 화면 너비 버튼, 컨트롤 간격 | Apple HIG Buttons(watchOS) · Apple HIG Accessibility(간격) |
| 회전 입력 스크롤, 포커스, 시각 반응 | Wear OS Rotary input · Apple HIG Digital Crown("Provide visual feedback") |
| 터치 동작 병행, 크라운 누르기는 시스템 전용 | Apple HIG Digital Crown |
| 상시 표시: 민감 정보 가림 | Apple HIG Always On · Apple Designing your app for the Always On state(`privacySensitive`, `redactionReasons`) |
| 상시 표시: 1분 단위 갱신, 초 단위·애니메이션 정지, `--` 자리 표시 | Wear OS Always-on apps · Apple Designing your app for the Always On state(subsecond updates 제거) |
| 부드럽게 정지, 배치 유지, 비활성 모양 | Apple HIG Always On |
| 검은 화면 85% 이상, 번인 보호 시 가장자리 여유 | Wear OS Always-on apps(on-pixel 15% 이하, 가장자리 10px) |
| 화면 켜 두기는 드물게 | Wear OS Always-on apps(`keepScreenOn` 배터리 경고) |
| 스크린 리더 이름, 중복 단어 없이 | Wear OS Accessibility(`contentDescription`) · Apple HIG Accessibility(VoiceOver) |
| 회전 입력은 접근성 | Wear OS Accessibility |
| 색만으로 상태를 구분하지 않는다 | Apple HIG Accessibility("Convey information with more than color alone") |
| 미리보기 크기·글자 배율, 스크린샷 테스트 | Wear OS Screen sizes(`@WearPreviewDevices`, `@WearPreviewFontScales`) |
| 미리보기는 시스템 흐림을 재현하지 않는다 | Apple Designing your app for the Always On state |

### `30` 컴플리케이션·타일·알림·백그라운드

| 항목 | 근거 |
|---|---|
| 시스템이 예산을 정하고 줄인다, 보장 없음, 대체 동작 | Apple Using background tasks · Apple Keeping your watchOS content up to date |
| 작업 완료 알림, 미완료 시 예산 소진 후 강제 종료 | Apple Using background tasks(`setTaskCompletedWithSnapshot`) · Apple Transferring data with Watch Connectivity |
| 한눈에 보는 정보, 넘치게 담지 않는다, 탭하면 앱으로 | Wear OS Tiles · Apple HIG Complications |
| 타임라인으로 미리 계획 | Apple HIG Complications · Apple Keeping a widget up to date |
| 상대 시간 표시로 매분 갱신 피하기 | Wear OS Expose data to complications(`TimeDifferenceComplicationText`) · Apple Designing your app for the Always On state(`Text.DateStyle`) |
| Wear OS 300초 최소, 푸시 갱신 평균 5분 이상 | Wear OS Expose data to complications |
| watchOS 위젯 하루 예산, 항목 간격 약 5분 | Apple Keeping a widget up to date |
| 타일 안에서 긴 작업 금지, 백그라운드로 받아 로컬 저장, 공용 저장소 | Wear OS Tiles · Wear OS Conserve power |
| 타일에서 로그인 안내 | Wear OS App Quality WO-V9 |
| 워치 화면 위 민감 정보 | Apple HIG Complications("Keep privacy in mind") |
| 알림 브리징·중복·브리지 태그·해제 ID·전체 차단 위험 | Wear OS Bridging options for notifications |
| 짧은 화면에 민감 정보·중요 정보만 두지 않기 | Apple HIG Notifications(watchOS short look) |
| 동작 버튼 순서와 더블 탭 | Apple HIG Notifications(Double tap) |
| 전체 화면 알림 미지원, 표준 스타일 | Wear OS Notifications |
| 1분 넘는 작업은 진행 중 활동, 부적절한 용도 | Wear OS Ongoing Activity(App Quality WO-V4 참조) |
| 백그라운드 세션 중 갱신 줄이기 | Apple Designing your app for the Always On state |
| 충전 중으로 미루기, 작업 스케줄러, wakelock 피하기, 건강 API 배치 | Wear OS Conserve power |
| 블루투스 대역폭 좁음, 응답 줄이기 | Wear OS Standalone apps(약 4KB/s 가능) |
| 실기기, 개발 도구 실행 시 동작 차이 | Apple Transferring data with Watch Connectivity |
| 배터리 도구 | Wear OS Conserve power(`dumpsys batterystats`, Battery Historian) |

### `40` 독립 실행·폰 연동·건강 데이터

| 항목 | 근거 |
|---|---|
| 폰 없이 사용, 워치 앱 먼저 설치 가능, 설치 안내 | Wear OS Standalone apps · Apple Creating independent watchOS apps |
| standalone 선언 검증·가시성 | Wear OS Standalone apps |
| 독립 실행 시 워치 안에서 계정·권한·데이터·푸시 | Apple Creating independent watchOS apps · Apple Authenticating users on Apple Watch |
| 저장·조회·상태 동기화는 서버·클라우드, 연동 API 는 원격 조작·폰에서 열기·토큰 | Wear OS Data Layer overview · Apple Keeping your watchOS content up to date |
| 연동 API 는 보조 경로 | Apple Keeping your watchOS content up to date("opportunistic optimization") · Apple Creating independent watchOS apps |
| 세션 활성·설치·도달 가능 확인 | Apple `WCSession`(`activationState`, `isPaired`, `isWatchAppInstalled`, `isReachable`) |
| 전송 방식 의미 차이 | Apple Transferring data with Watch Connectivity(`updateApplicationContext`·`transferUserInfo`·`sendMessage`) |
| 상태 변화만 보내기, 리스너는 필요할 때 | Wear OS Conserve power(Data Layer) |
| 패키지 이름·서명 일치, 번들 ID 기반 | Wear OS Data Layer overview · Apple Transferring data with Watch Connectivity |
| 여러 워치 전환 처리 | Apple `WCSession` |
| 네트워크 경로별 확인 | Apple Keeping your watchOS content up to date |
| 자격 증명 API·PKCE·기기 승인·토큰 전달과 대체 방법·게스트 모드 | Wear OS Authentication · Apple Authenticating users on Apple Watch |
| 종류별 허용, 목적 설명 문구 없으면 실패, 읽기 거부는 "데이터 없음" | Apple HealthKit Protecting user privacy |
| 잠금 시 읽기 불가 | Apple HealthKit Protecting user privacy |
| Wear OS 건강 권한 변경(`android.permission.health.*`, 백그라운드 권한) | Wear OS Health Services permissions |
| 광고·제3자·판매 금지, 개인정보 처리방침 | Apple HealthKit Protecting user privacy |
| 실기기 한 쌍 | Apple Transferring data with Watch Connectivity |

## 자료 목록

### Wear OS (Android Developers)

| 자료 | URL |
|---|---|
| Wear OS app quality guidelines | https://developer.android.com/docs/quality-guidelines/wear-app-quality |
| Design principles | https://developer.android.com/design/ui/wear/guides/m2-5/foundations/design-principles |
| UX design principles for wearables | https://developer.android.com/design/ui/wear/guides/get-started/design-for-wearables/principles |
| Develop for different screen sizes | https://developer.android.com/training/wearables/compose/screen-size |
| Rotary input | https://developer.android.com/training/wearables/user-input/rotary-input |
| Always-on apps | https://developer.android.com/training/wearables/apps/always-on |
| Accessibility on Wear OS | https://developer.android.com/training/wearables/accessibility |
| Tiles | https://developer.android.com/training/wearables/tiles |
| Expose data to complications | https://developer.android.com/training/wearables/complications/exposing-data |
| Notifications on Wear OS | https://developer.android.com/training/wearables/notifications |
| Bridging options for notifications | https://developer.android.com/training/wearables/notifications/bridger |
| Ongoing Activity | https://developer.android.com/training/wearables/ongoing-activity |
| Conserve power and battery | https://developer.android.com/training/wearables/apps/power |
| Standalone versus non-standalone apps | https://developer.android.com/training/wearables/apps/standalone-apps |
| Data Layer API overview | https://developer.android.com/training/wearables/data/overview |
| Authentication on wearables | https://developer.android.com/training/wearables/apps/auth-wear |
| Health Services on Wear OS | https://developer.android.com/health-and-fitness/guides/health-services |
| Health Services permissions | https://developer.android.com/health-and-fitness/health-services/permissions |

### watchOS (Apple Developer)

| 자료 | URL |
|---|---|
| HIG, Designing for watchOS | https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos |
| HIG, Digital Crown | https://developer.apple.com/design/human-interface-guidelines/digital-crown |
| HIG, Always On | https://developer.apple.com/design/human-interface-guidelines/always-on |
| HIG, Complications | https://developer.apple.com/design/human-interface-guidelines/complications |
| HIG, Notifications | https://developer.apple.com/design/human-interface-guidelines/notifications |
| HIG, Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons |
| HIG, Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| Designing your app for the Always On state | https://developer.apple.com/documentation/watchos-apps/designing-your-app-for-the-always-on-state |
| Creating independent watchOS apps | https://developer.apple.com/documentation/watchos-apps/creating-independent-watchos-apps |
| Keeping your watchOS app's content up to date | https://developer.apple.com/documentation/watchos-apps/keeping-your-watchos-app-s-content-up-to-date |
| Authenticating users on Apple Watch | https://developer.apple.com/documentation/watchos-apps/authenticating-users-on-apple-watch |
| Using background tasks | https://developer.apple.com/documentation/watchkit/using-background-tasks |
| Keeping a widget up to date (WidgetKit) | https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date |
| `WCSession` | https://developer.apple.com/documentation/watchconnectivity/wcsession |
| Transferring data with Watch Connectivity | https://developer.apple.com/documentation/watchconnectivity/transferring-data-with-watch-connectivity |
| HealthKit, Protecting user privacy | https://developer.apple.com/documentation/healthkit/protecting-user-privacy |
