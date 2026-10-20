# tv 팩 — 근거 출처

tv 레이어 룰(`packs/tv/rules/`)이 기대는 공개 자료다. 룰에 넣은 규칙은 여기 자료에서 왔다.
프로젝트의 기존 관례가 있으면 그것이 먼저이고, 이 목록은 관례가 없을 때의 기준선이다. (조사일 2026-09-29)
룰 번호는 파일 앞 숫자다 — `10` 기본 원칙(always), `20` 포커스·리모컨 입력·10피트 화면, `30` 재생·수명주기·메모리, `40` 플랫폼 선언·런처 연동·스토어 점검.
Android TV 항목 뒤의 `TV-xx` 는 TV app quality 의 기준 ID 다.

## 룰별 근거

### `10` TV 앱 기본 원칙

| 항목 | 근거 |
|---|---|
| 프로젝트의 기존 구조를 따른다 | 킷 규칙(`AGENTS.md` 1) — 관례를 표준처럼 강요하지 않는다 |
| 방향키·확인·뒤로만으로 모든 기능, 다른 입력을 필수로 만들지 않는다 | Android TV quality TV-DP·TV-MT · Android TV hardware(터치스크린 비필수) · Apple App Review 2.4.3 · webOS Magic Remote("all apps MUST also support 5-way mode") · Samsung UX Checklist |
| 포커스는 하나, 늘 보인다, 시작 시 포커스, 입력 없이 옮기지 않는다 | Android TV navigation · Apple HIG Focus and selection · Samsung UX Checklist(Feedback) · webOS App Self Checklist(선택 효과) |
| 뒤로 키는 플랫폼 정책대로 | Android TV quality TV-DB · Android TV navigation · Apple HIG Remotes · Samsung Terminating applications · webOS Back Button |
| 안전 영역·최소 크기·잘림 없음 | Android TV quality TV-OV · Android TV Layouts(5% 여백) · Apple HIG Layout(tvOS)·Typography·Accessibility · webOS App Self Checklist |
| 텍스트 입력 줄이기 | Apple HIG Managing accounts(tvOS) · Android TV quality TV-LI·TV-VS · Android TV on-screen keyboard |
| 숨겨지면 재생 정지·자원 해제, 복귀 시 확인 | Android TV quality TV-NP · Android TV memory · Samsung Multitasking · webOS App Lifecycle Management |
| 메모리·CPU 제한 | Android TV memory(저메모리 기기 한도·이미지 해상도) · Android TV quality TV-ME |
| 화면 낭독기 이름 | Android TV TalkBack 평가 · Apple HIG VoiceOver · Samsung Text To Speech · webOS appinfo.json(`supportsAudioGuidance`) |
| 실기기·리모컨만으로 확인 | webOS Simulator 제약 · Samsung TV Emulator·Emulator Limitations · Android TV navigation(D-pad 테스트) |

### `20` 포커스·리모컨 입력·10피트 화면

| 항목 | 근거 |
|---|---|
| 보이는 모든 조작 요소에 방향키로 닿는다 | Android TV navigation("navigate to all visible controls") · Apple HIG Focus and selection(tvOS 는 모든 요소에 포커스) · Samsung UX Checklist · Samsung Common CO-UI-04·06 |
| 광고도 방향키로 | Android TV quality TV-AP·TV-AD |
| 포커스 하나·눈에 띄게·앱 안에서 일관 | Samsung UX Checklist(Feedback 3항) · Android TV navigation(상태 리스트) · Apple HIG(시스템 포커스 효과 우선) |
| 시작 시 포커스 · 웹 앱 초기 포커스 | Android TV navigation("always have an item in focus … after your app starts") · Samsung Text To Speech(`autofocus` 필수) |
| 입력 없이 포커스를 옮기지 않는다, 사라진 요소 예외 | Apple HIG Focus and selection · UIKit About focus interactions for Apple TV |
| 명시 이동 지정은 기본 순서가 어색할 때만 · 격자 정렬 | Android TV navigation(`nextFocus*`) · Samsung UX Checklist("aligned in grids, not diagonally") |
| 확대되는 포커스 요소 여백·자산 | Apple HIG Focus and selection(tvOS 상태) · Apple HIG Layout(tvOS 패딩) |
| 연타에 겹침·깜박임 없음 | Samsung Common CO-UI-09·CO-US-01 |
| 키 표(확인·좌우·재생 키, 메뉴 키 비의존) | Android TV quality TV-PC·TV-PP·TV-DM · Apple HIG Remotes(버튼 표) |
| 뒤로 — Android TV 홈으로, 종료 확인·루프·가짜 뒤로 버튼 금지 | Android TV quality TV-DB · Android TV navigation |
| 뒤로 — tvOS 부모 화면, 게임 중 일시정지 메뉴 | Apple HIG Remotes |
| 뒤로 — Samsung 종료 확인 팝업·종료/숨김, 길게 누름·Exit 키 처리기 금지 | Samsung Terminating applications · Samsung User Interaction Q&A(Exit 키: 팝업 없이 즉시 종료, 아니면 인증 실패) |
| 뒤로 — webOS `history`·`disableBackHistoryAPI`·461·`platformBack` | webOS Back Button · webOS appinfo.json |
| 기본 키 외 키 등록 | Samsung Remote Control(방향·Enter·Back 만 자동, `tv.inputdevice` 특권) |
| 포인터 리모컨도 방향키 모드 필수, 모드 전환 | webOS Magic Remote |
| 안전 영역 수치 | Android TV Layouts(960×540dp, 좌우 48dp·상하 27dp) · Apple HIG Layout(tvOS 60pt·80pt) |
| 글자·조작 요소 최소 크기 | Apple HIG Typography·Accessibility(tvOS 29/23pt, 66/56pt) · webOS App Self Checklist(글자 20px, 버튼 75×75px) |
| 대비 4.5:1·3:1 | Apple HIG Accessibility(WCAG AA 표) |
| 잘림 없음·불투명·가로 전체 | Android TV quality TV-OV·TV-TR·TV-LO |
| 스크롤 표시·진행 표시 | Samsung UX Checklist · Samsung Common CO-CN-03 · webOS App Self Checklist(권장) |
| 시스템 글자 크기 | Android TV accessibility best practices(텍스트 배율) · Apple HIG Layout(Dynamic Type) |
| 입력 최소·다른 기기 로그인 | Apple HIG Managing accounts(tvOS) · Android TV quality TV-LI |
| 입력 종류 지정 | Android TV on-screen keyboard · Apple HIG Virtual keyboards |
| 길이 초과·특수 문자에서 멈추지 않음 | Samsung Common CO-KI-01·02·04 |
| 음성 검색 | Android TV quality TV-VS |
| 낭독기 표 | Android TV TalkBack 평가 · Apple HIG VoiceOver · Samsung Text To Speech(포커스 요소 읽기·ARIA·`display:none`) · webOS appinfo.json |
| 토글은 상태 + 동작, 재생 컨트롤 이름, 낭독기 켜고 흐름 확인 | Android TV TalkBack 평가 |
| 자막·오디오 해설 시스템 설정 | Android TV accessibility best practices(오디오 해설) · Android TV quality TV-AX |

### `30` 재생·수명주기·메모리

| 항목 | 근거 |
|---|---|
| 시스템 플레이어 우선, 커스텀은 그 조작을 따른다 | Apple HIG Playing video |
| 확인·좌우·재생 키 | Android TV quality TV-PC·TV-PP · Apple HIG Remotes |
| 화면 위 재생 컨트롤, 방향키로 | Samsung UX Checklist(Player) · webOS App Self Checklist(권장) |
| 로고·오버레이 작게, 상호작용 오버레이는 멈추고 | Apple HIG Playing video(tvOS) |
| 원래 화면비, 여백은 검은색 | Apple HIG Playing video · Android TV quality TV-LO |
| 화면 보호기·앰비언트 모드 | Samsung Mandatory Features · Android TV quality TV-BU·TV-BY·TV-BA |
| 자막 동기화 | Samsung Mandatory Features |
| Android TV 숨김 처리(`onStop` 해제, 음악만 MediaSession, 영상은 일시정지) | Android TV quality TV-NP·TV-PA · Android TV memory |
| tvOS 보조 오디오 | Apple HIG Playing video("Avoid allowing audio from different sources to mix") |
| Samsung 숨김(`visibilitychange`, 뒤로 키와 같은 동작) | Samsung Multitasking |
| webOS 숨김·재실행 | webOS App Lifecycle Management · webOS appinfo.json(`handlesRelaunch`) |
| 복귀 시 네트워크 확인·알림·재연결 | Samsung Multitasking · Samsung Mandatory Features · Samsung Common CO-CN-01·02 |
| 세션·DRM·URL 만료 | Samsung Multitasking |
| 플레이어 일시 중단·복원 API | Samsung AVPlay(`suspend`·`restore`) · Samsung Common CO-MT-01 |
| 묻지 않고 이어 재생, 홈에서 바로 재생, 끝나면 상세, 로딩 화면, 프로필 | Apple HIG Playing video(Integrating with the TV app·Loading·Exiting) |
| DRM 지원 조합은 플랫폼·버전마다 | Android Media3 ExoPlayer DRM(스킴·API 레벨 표) |
| DRM 설정 시점 | Samsung AVPlay(`setDrm` 은 IDLE 상태) |
| 라이선스 URL·토큰을 로그에 남기지 않는다 | webOS App Self Checklist(비밀번호·토큰·키 노출 금지) · 킷 core 보안 원칙 |
| DRM 은 실기기 | webOS Simulator("does not support DRM function") |
| 이미지 해상도·단색 자리 표시·버퍼 해제·버퍼 크기 | Android TV memory |
| 저메모리 한도 280MB · `requiredMemory` | Android TV memory · Android TV quality TV-ME · webOS appinfo.json |
| tvOS 로컬 저장 500KB·캐시는 지워질 수 있음 | Apple App Programming Guide for tvOS(보관 문서) |
| 실행 10초(5초 권장)·오래 켜 두기 | Samsung Mandatory Features · Samsung Common CO-GE-03 |

### `40` 플랫폼 선언·런처 연동·스토어 점검

| 항목 | 근거 |
|---|---|
| 입력 기기 필수 선언 금지, 권한이 암시하는 기능 | Android TV hardware · Android TV quality TV-MT · Apple App Review 2.4.3 |
| `LEANBACK_LAUNCHER`·leanback·배너 320×180 | Android TV Get started(create) · Android TV quality TV-ML·TV-LB·TV-BN |
| 게임 컨트롤러 필수면 스토어 정보에 명시 | Apple App Review 2.4.3 |
| Tizen 특권·멀티태스킹 | Samsung Mandatory Features · Samsung Remote Control |
| webOS `appinfo.json` 필수 항목·형식 | webOS appinfo.json |
| 4K 자산 | Android TV quality TV-4K |
| 홈 추천·이어 보기 · Top Shelf 광고·가격 금지 | Android TV quality TV-EC·TV-ER · Apple HIG Top Shelf |
| 광고 조작·링크 제한, `WebView` 만 | Android TV quality TV-AP·TV-AD·TV-AU·TV-AA·TV-WB |
| 스토어별 점검표 요점 | Android TV quality · Samsung Mandatory Features·Common·UX Checklist · webOS App Self Checklist · Apple App Review |
| 제거 시 사용자 데이터 삭제 | Samsung Mandatory Features |
| 에뮬레이터·시뮬레이터 제약 | webOS Simulator · Samsung TV Emulator·Emulator Limitations |

## 자료 목록

### Android TV

| 자료 | URL |
|---|---|
| TV app quality | https://developer.android.com/docs/quality-guidelines/tv-app-quality |
| TV navigation (D-pad·focus·back) | https://developer.android.com/training/tv/start/navigation |
| TV layouts (design guide, overscan) | https://developer.android.com/design/ui/tv/guides/styles/layouts |
| Handle TV hardware | https://developer.android.com/training/tv/start/hardware |
| Get started — create a TV app (manifest) | https://developer.android.com/training/tv/get-started/create |
| On-screen keyboard | https://developer.android.com/training/tv/get-started/onscreen-keyboard |
| Optimize memory usage (TV) | https://developer.android.com/training/tv/playback/memory |
| Accessibility best practices (TV) | https://developer.android.com/training/tv/accessibility |
| TalkBack evaluation examples (TV) | https://developer.android.com/training/tv/accessibility/talkback |
| Media3 ExoPlayer — DRM | https://developer.android.com/media/media3/exoplayer/drm |

### Apple tvOS

| 자료 | URL |
|---|---|
| HIG, Designing for tvOS | https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos |
| HIG, Focus and selection | https://developer.apple.com/design/human-interface-guidelines/focus-and-selection |
| HIG, Remotes | https://developer.apple.com/design/human-interface-guidelines/remotes |
| HIG, Layout | https://developer.apple.com/design/human-interface-guidelines/layout |
| HIG, Typography | https://developer.apple.com/design/human-interface-guidelines/typography |
| HIG, Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| HIG, VoiceOver | https://developer.apple.com/design/human-interface-guidelines/voiceover |
| HIG, Playing video | https://developer.apple.com/design/human-interface-guidelines/playing-video |
| HIG, Top Shelf | https://developer.apple.com/design/human-interface-guidelines/top-shelf |
| HIG, Managing accounts | https://developer.apple.com/design/human-interface-guidelines/managing-accounts |
| HIG, Virtual keyboards | https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards |
| UIKit, About focus interactions for Apple TV | https://developer.apple.com/documentation/uikit/about-focus-interactions-for-apple-tv |
| App Programming Guide for tvOS (보관 문서) | https://developer.apple.com/library/archive/documentation/General/Conceptual/AppleTV_PG/index.html |
| App Review Guidelines (2.4.3) | https://developer.apple.com/app-store/review/guidelines/ |

### Samsung Tizen TV

| 자료 | URL |
|---|---|
| Remote Control | https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html |
| User Interaction Q&A (Exit·Return 키) | https://developer.samsung.com/smarttv/develop/faq/user-interaction.html |
| Terminating Applications | https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html |
| Multitasking | https://developer.samsung.com/smarttv/develop/guides/fundamentals/multitasking.html |
| Using AVPlay | https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html |
| Text To Speech (Voice Guide) | https://developer.samsung.com/smarttv/develop/guides/fundamentals/text-to-speech.html |
| Accessibility | https://developer.samsung.com/smarttv/develop/guides/fundamentals/accessibility.html |
| Development Checklist — Mandatory Features | https://developer.samsung.com/smarttv/develop/development-checklist/mandatory-features.html |
| Development Checklist — Common | https://developer.samsung.com/smarttv/develop/development-checklist/common.html |
| UX Checklist | https://developer.samsung.com/smarttv/design/ux-checklist.html |
| TV Emulator | https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-emulator.html |
| TV Emulator Limitations | https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-emulator/emulator-limitations.html |

### LG webOS TV

| 자료 | URL |
|---|---|
| Back Button | https://webostv.developer.lge.com/develop/guides/back-button |
| App Lifecycle Management | https://webostv.developer.lge.com/develop/guides/app-lifecycle-management |
| Magic Remote | https://webostv.developer.lge.com/develop/guides/magic-remote |
| appinfo.json | https://webostv.developer.lge.com/develop/references/appinfo-json |
| App Self Checklist | https://webostv.developer.lge.com/distribute/app-self-checklist |
| Simulator Introduction | https://webostv.developer.lge.com/develop/tools/simulator-introduction |

## 넣지 않은 것 (조사일에 공식 문서로 확인하지 못함)

- Android TV 의 최소 글자 크기 수치 — 타이포그래피 가이드 페이지를 확인하지 못해 수치를 넣지 않았다.
- Samsung·LG 의 안전 영역 수치.
- webOS 의 `aria-live`·Web Speech API 미지원 — 공식 문서가 아닌 커뮤니티 글에서만 봐서 넣지 않았다.
- Samsung AVPlay 동시 인스턴스·디코더 수 제한.
- "앱 ID 를 바꾸면 업데이트가 끊긴다" — TV 스토어 문서에서 직접 확인하지 못해 `40` 에서 뺐다.
- Samsung 첫 화면 뒤로 키 — 종료 가이드는 "종료 확인 팝업"을, Q&A 는 "종료 또는 숨김"을 적는다. 둘 다 적고 최신 점검표를 보라고 했다.
