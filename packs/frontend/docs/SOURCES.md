# frontend 팩 — 근거 출처

frontend 레이어 룰(`packs/frontend/rules/`)과 상세 문서(`packs/frontend/docs/`)가 기대는 공개 자료다.
**프로젝트의 기존 관례가 먼저**이고, 이 목록은 관례가 없을 때의 기준선이다. (조사일 2026-09-29)

- §1 은 자료 목록(제목 · URL · 한 줄 요점), §2 는 **룰별 근거 대응**, §3 은 자료끼리 어긋나는 점과 이 팩의 결론이다.
- 자료에 없는, 이 킷을 떼어 낸 프로젝트의 실측에서 온 규칙은 §2 에 **"실무 경험"** 으로 표시했다.

## 1. 자료 목록

### 접근성

| # | 자료 | URL | 요점 |
|---|---|---|---|
| A1 | W3C, Web Content Accessibility Guidelines (WCAG) 2.2 | https://www.w3.org/TR/WCAG22/ | 성공 기준 본문. 기준선 A·AA |
| A2 | W3C WAI, What's New in WCAG 2.2 | https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ | 2.2 신규: 2.4.11 포커스 가림(AA) · 2.5.7 끌기 대안(AA) · 2.5.8 대상 24×24px(AA) · 3.2.6 일관된 도움(A) · 3.3.7 중복 입력(A) · 3.3.8 인증(AA) |
| A3 | W3C WAI, WCAG 2.2 Quick Reference | https://www.w3.org/WAI/WCAG22/quickref/ | A·AA 성공 기준 전체 목록 (docs/accessibility.md §1 표의 원천) |
| A4 | W3C WAI, Understanding 4.1.3 Status Messages | https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | 결과·진행·오류 알림은 포커스 없이 `role=status/alert`·`aria-live` 로 읽혀야 한다 |
| A5 | W3C WAI, Understanding 2.5.3 Label in Name | https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html | 보이는 라벨 글자가 접근 가능한 이름에 들어가야 하고 앞부분이 좋다 |
| A6 | W3C WAI, Understanding 1.4.13 Content on Hover or Focus | https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html | 툴팁은 닫을 수 있고(Esc), 포인터를 옮겨도 유지되고, 스스로 사라지지 않아야 한다 |
| A7 | W3C WAI, Understanding 2.2.1 Timing Adjustable | https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html | 사라지는 알림은 같은 정보를 다른 곳에서 얻을 수 있으면 대상 아님. 아니면 끄기·조정·연장 필요 |
| A8 | W3C WAI, Understanding 2.5.8 Target Size (Minimum) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 24×24px 예외 5가지: 간격·동등 대안·문장 속 링크·브라우저 기본 컨트롤·본질적 |
| A9 | W3C, Using ARIA | https://www.w3.org/TR/using-aria/ | 네이티브 요소 먼저 · 네이티브 의미 바꾸지 않기 · ARIA 위젯은 키보드로 동작해야 한다 |
| A10 | W3C WAI-ARIA APG, Developing a Keyboard Interface | https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ | roving tabindex / `aria-activedescendant`, 포커스 표시 상시, 읽기 순서 = Tab 순서, 초기 자동 포커스 지양 |
| A11 | W3C WAI-ARIA APG, Dialog (Modal) Pattern | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | 초기 포커스(긴 본문은 제목, 파괴 동작은 덜 파괴적 버튼), Tab 순환, Esc, 연 요소로 복귀, `aria-modal`·`aria-labelledby` |
| A12 | W3C WAI-ARIA APG, Tabs Pattern | https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ | 방향키 이동·순환, Home/End, 자동/수동 활성화, `tablist`/`tab`/`tabpanel` |
| A13 | W3C WAI-ARIA APG, Combobox Pattern | https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ | DOM 포커스는 입력칸, `aria-activedescendant`·`aria-expanded`·`aria-controls`, ↓·Esc·Enter |
| A14 | W3C WAI Tutorials, Images — An alt Decision Tree | https://www.w3.org/WAI/tutorials/images/decision-tree/ | 정보·장식(`alt=""`)·기능(동작을)·글자 이미지·복잡한 이미지(본문에 같은 정보) |
| A15 | W3C WAI Tutorials, Tables | https://www.w3.org/WAI/tutorials/tables/ | `th`+`scope`, `caption`, 복잡한 표 `headers`/`id`, 레이아웃에 표 금지 |
| A16 | MDN, ARIA live regions | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions | 라이브 영역은 내용 변경 **전에** DOM 에 있어야 한다, 기본 polite, assertive 는 드물게 |
| A17 | MDN, `<dialog>` element | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog | `showModal()` 은 배경을 `inert` 로, Esc 로 닫힘, 닫기 버튼을 항상, `<dialog>` 자체에 `tabindex` 금지 |
| A18 | MDN, prefers-reduced-motion | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | 움직임을 없애기보다 덜 자극적인 것(페이드)으로 바꾼다. 확대·패닝·회전이 흔한 유발 요인 |
| A19 | Gatsby, What we learned from user testing of accessible client-side routing | https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/ | 라우트 변경 뒤 제목·작은 바로가기 링크에 포커스가 가장 효과적, 라이브 영역만으로는 부족 |
| A20 | W3C i18n, Declaring language in HTML | https://www.w3.org/International/questions/qa-html-language-declarations | `<html lang>` 을 항상 선언한다 |

### 보안

| # | 자료 | URL | 요점 |
|---|---|---|---|
| S1 | OWASP, Cross Site Scripting Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html | 프레임워크 탈출구(`dangerouslySetInnerHTML`·`bypassSecurityTrustAs*`·`unsafeHTML`) 경계, 안전한 싱크(`textContent`), HTML 은 DOMPurify, URL 은 http/https 만 |
| S2 | OWASP, DOM based XSS Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html | `innerHTML`·`document.write`·`eval`·문자열 타이머·`location` 대입 금지, `textContent`·`JSON.parse` |
| S3 | OWASP, HTML5 Security Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html | 세션 ID 를 local storage 에 두지 않는다, `postMessage` 는 출처 명시·정확 일치 검사 |
| S4 | OWASP, Session Management Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | 토큰·JWT·리프레시 토큰을 `localStorage`/`sessionStorage` 에 두지 않는다. `HttpOnly; Secure; SameSite` 쿠키 또는 BFF |
| S5 | OWASP, Content Security Policy Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | 인라인 스크립트·인라인 핸들러·`eval` 을 피해야 nonce/hash 기반 엄격한 CSP 가 선다 |
| S6 | MDN, Trusted Types API | https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API | 싱크에 정책을 거친 값만. `require-trusted-types-for 'script'`. Baseline 2026(2026-02) |
| S7 | OWASP, Authorization Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html | 클라이언트 쪽 접근 통제에 절대 의존하지 않는다 — 사용자 경험용일 뿐 |
| S8 | OWASP, NPM Security Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html | 잠금파일·`npm ci`, audit, `ignore-scripts`, typosquatting, **AI 가 제안한 패키지 이름은 `npm view` 로 확인** |
| S9 | OWASP, Third Party JavaScript Management Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html | SRI, 샌드박스 iframe, 벤더 검토, 제3자 스크립트 변경 감시 |
| S10 | OWASP Top 10:2025 | https://top10.owasp.org/2025 | A01 접근 통제 실패 · A03 소프트웨어 공급망 실패 · A05 인젝션 |
| S11 | Vite, Env Variables and Modes | https://vite.dev/guide/env-and-mode | `VITE_*` 는 빌드 때 번들에 들어간다 — API 키 등 비밀 금지 |

### 성능

| # | 자료 | URL | 요점 |
|---|---|---|---|
| P1 | web.dev, Web Vitals | https://web.dev/articles/vitals | LCP ≤2.5s · INP ≤200ms · CLS ≤0.1, 75번째 백분위, 모바일·데스크톱 따로 |
| P2 | web.dev, Optimize Cumulative Layout Shift | https://web.dev/articles/optimize-cls | 미디어 크기, 늦은 콘텐츠 자리 확보, 폰트, `transform` 애니메이션, bfcache |
| P3 | web.dev, The performance effects of too much lazy loading | https://web.dev/articles/lcp-lazy-loading | 첫 화면 이미지는 즉시, 나머지는 지연 |
| P4 | web.dev, Optimize Interaction to Next Paint | https://web.dev/articles/optimize-inp | 긴 작업 나누기·양보, 화면 갱신 먼저, 강제 동기 레이아웃 피하기, DOM 크기, `content-visibility` |
| P5 | web.dev, Serve responsive images | https://web.dev/articles/serve-responsive-images | `srcset`·`sizes`, 현대 형식, 크기별 여러 벌 |
| P6 | web.dev, Performance budgets 101 | https://web.dev/articles/performance-budgets-101 | 양·시점·규칙 기반 예산, CI 로 강제, 넘으면 최적화·제거·추가 차단 |
| P7 | web.dev, Prevent unnecessary network requests with the HTTP Cache | https://web.dev/articles/http-cache | 해시 파일 1년 `immutable`, HTML `no-cache`+검증자, 민감 응답 `no-store` |
| P8 | Google Search Central, JavaScript SEO basics | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics | 고유한 title·description, `href` 있는 `<a>`, History API, soft 404 방지 |
| P9 | Nielsen Norman Group, Response Times: The 3 Important Limits | https://www.nngroup.com/articles/response-times-3-important-limits/ | 0.1s 즉시 · 1s 흐름 유지 · 10s 주의 한계 — 길면 진행률과 중단 수단 |
| P10 | Apple HIG, Progress indicators | https://developer.apple.com/design/human-interface-guidelines/progress-indicators | 기간을 알면 확정형, 멈춘 듯 보이지 않게, 모호한 "Loading…" 대신 구체적 문구 |

### 사용성·오류 문구·폼

| # | 자료 | URL | 요점 |
|---|---|---|---|
| U1 | Nielsen Norman Group, 10 Usability Heuristics | https://www.nngroup.com/articles/ten-usability-heuristics/ | 상태 보이기 · 일관성 · 오류 예방 · 오류 인식·진단·복구 |
| U2 | Nielsen Norman Group, Error-Message Guidelines | https://www.nngroup.com/articles/error-message-guidelines/ | 원인 가까이, 색만으로 알리지 않기, 쉬운 말·구체적·해결책, 탓하지 않기, 입력 보존, 이른 검증 지양 |
| U3 | GOV.UK Design System, Error message | https://design-system.service.gov.uk/components/error-message/ | 무슨 일 + 고치는 법, 빈 값은 지시문·제약은 설명문, `invalid`·`please` 지양, 라벨과 같은 말 |
| U4 | GOV.UK Design System, Error summary | https://design-system.service.gov.uk/components/error-summary/ | 오류 요약을 위에, 포커스 이동, 항목마다 필드 링크, 제목 앞 `Error:` |
| U5 | web.dev, Sign-in form best practices | https://web.dev/articles/sign-in-form-best-practices | `<label>`, `type`·`autocomplete`(`current-password`/`new-password`), 비밀번호 보기, placeholder 를 라벨로 쓰지 않기, 중복 제출 방지 |
| U6 | web.dev, Payment and address form best practices | https://web.dev/articles/payment-and-address-form-best-practices | 이름 한 칸, 칸 쪼개지 않기, `inputmode`, 라틴 문자만 검증 금지, 고정 `name`/`id`, 실시간 피드백 |
| U7 | WHATWG HTML Standard, Autofill | https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill | `autocomplete` 토큰 목록(`name`·`email`·`tel`·`street-address`·`one-time-code`·`cc-number` …) |

### 다국어·로캘·시간대

| # | 자료 | URL | 요점 |
|---|---|---|---|
| I1 | MDN, Intl | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl | 숫자·날짜·복수·정렬·목록·상대 시간을 로캘 인자로 |
| I2 | ICU User Guide, Formatting Messages | https://unicode-org.github.io/icu/userguide/format_parse/messages/ | 조각을 이어 붙이면 번역자가 어순을 못 바꾼다 — 자리표시자 한 문장 |
| I3 | W3C, Working with Time and Time Zones | https://www.w3.org/TR/timezone/ | 교환·저장은 UTC, 시간대는 IANA ID, 생일 같은 값은 시간대 없는 날짜 |
| I4 | W3C, Internationalization Best Practices for Spec Developers | https://www.w3.org/TR/international-specs/ | 사용자 값과 번역 문구를 구분, 양방향 텍스트는 이어 붙이지 않고 격리 |
| I5 | W3C i18n, Structural markup and right-to-left text in HTML | https://www.w3.org/International/questions/qa-html-dir | `<html dir>` 로 마크업에서, CSS 로 기본 방향을 정하지 않기, 입력칸 `dir="auto"` |
| I6 | MDN, CSS logical properties and values | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values | `margin-inline-start` 등 쓰기 방향 기준 속성 |
| I7 | W3C i18n, Personal names around the world | https://www.w3.org/International/questions/qa-personal-names | 이름 형식을 한 나라 기준으로 가정하지 않는다 |

### 상태·테스트·브라우저 지원

| # | 자료 | URL | 요점 |
|---|---|---|---|
| T1 | React docs, Choosing the State Structure | https://react.dev/learn/choosing-the-state-structure | 관련 상태 묶기 · 모순 피하기 · 중복·파생 상태 피하기 · 평평하게 (프레임워크 무관한 원리만 가져왔다) |
| T2 | TanStack Query, Does this replace client state? | https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state | 서버 상태와 클라이언트 상태를 가르면 남는 전역 상태는 매우 작다 |
| T3 | Testing Library, Guiding Principles | https://testing-library.com/docs/guiding-principles | 테스트가 쓰이는 방식과 닮을수록 믿을 수 있다 |
| T4 | Testing Library, About Queries (priority) | https://testing-library.com/docs/queries/about/ | role → label → placeholder → text → … → test id 순 |
| T5 | Playwright, Best Practices | https://playwright.dev/docs/best-practices | 사용자에게 보이는 동작, 테스트 격리, 외부 의존 모킹, role 로케이터, 자동 대기 단언 |
| T6 | Playwright, Visual comparisons | https://playwright.dev/docs/test-snapshots | 기준 이미지는 OS·브라우저별, 의도한 변경에만 갱신, 변하는 부분 가리기 |
| T7 | MDN, Progressive Enhancement | https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement | 기능 감지 + 대체, 핵심 기능은 기준선에서 |

### 공개 에이전트 지침에서 반복되는 규칙

| # | 자료 | URL | 반복 규칙 |
|---|---|---|---|
| G1 | AGENTS.md 형식 소개 | https://agents.md/ | 정확한 명령을 적는다, "테스트·타입 오류를 전부 고칠 때까지", 바꾼 코드의 테스트 추가 |
| G2 | ComfyUI frontend AGENTS.md | https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/AGENTS.md | 커밋 전 lint·typecheck, 디자인 표준 먼저, 새 UI 라이브러리 컴포넌트 지양, 모든 문구 i18n, 고정 대기 금지·단언 약화 금지 |
| G3 | n8n AGENTS.md | https://github.com/n8n-io/n8n/blob/master/AGENTS.md | 모든 UI 문구 i18n, 공용 컴포넌트는 디자인 시스템에, px 대신 CSS 변수, 커밋 전 lint·typecheck |
| G4 | Next.js AGENTS.md | https://github.com/vercel/next.js/blob/canary/AGENTS.md | 생성물(`dist`·`.next`) 수정 금지, 작업마다 검증 후 다음으로, 비밀값을 코드에 넣지 않기 |
| G5 | Addy Osmani agent-skills, frontend-ui-engineering | https://github.com/addyosmani/agent-skills/blob/main/skills/frontend-ui-engineering/SKILL.md | 토큰 사용·간격 스케일, 상태는 가장 단순한 곳부터, 로딩·빈·오류·권한 상태, 키보드·여러 폭·axe·콘솔 오류 0 확인 |
| G6 | Storybook, MCP overview | https://storybook.js.org/docs/ai/mcp/overview | 에이전트가 기존 컴포넌트와 사용 지침을 재사용하고, 스토리로 상호작용·접근성 테스트를 돌려 스스로 고친다 |

## 2. 룰별 근거 대응

| 룰 | 규칙 | 근거 |
|---|---|---|
| **10 always** | 1 있는 것 먼저(디자인 시스템·생성 클라이언트·포맷터·i18n), 새 패키지는 묻고 | G2 · G3 · G5 · G6 · S8 |
| | 2 생성물 손대지 않기 | G4 · 실무 경험(생성 클라이언트) |
| | 3 서버가 판정, 게이팅은 보안 아님 | S7 · S10(A01) |
| | 4 시맨틱 먼저·키보드·포커스·이름 | A9 · A10 · A1(2.1.1 · 2.4.7 · 4.1.2) |
| | 5 신뢰 못 할 값을 HTML·URL·코드로 넣지 않기, 번들 비밀 금지 | S1 · S2 · S11 |
| | 6 상태 다 그리기·권한은 비활성+이유·확인창은 되돌릴 수 없을 때 | U1 · G5 · A1(3.3.4) · 실무 경험(비활성+이유) |
| | 7 오류는 무슨 일+고치는 법, 원인 가까이, 입력 보존 | U2 · U3 · A1(3.3.1 · 3.3.3) |
| | 8 화면 상태는 URL | P8(History API) · 실무 경험 |
| | 9 문구 하드코딩 금지·포맷터 | G2 · G3 · I1 · I2 |
| | 10 lint·typecheck·test·build + 실제 브라우저 | G1 · G2 · G3 · G4 · G5 |
| **20 구조·API·반응형** | 생성 클라이언트만·HTTP 직접 금지 | G4 · 실무 경험 |
| | 파일 배치(소비처 기준 `shared`) | 실무 경험 |
| | 토큰 사용 | G3 · G5 |
| | 320px 리플로·200% 확대·상대 단위 | A1(1.4.4 · 1.4.10 · 1.4.12) |
| | 지원 범위 밖 기능은 기능 감지 + 대체 | T7 |
| | 새 패키지는 묻고 이름·유지 상태 확인, 잠금파일 고정 설치 | S8 · S10(A03) · 실무 경험(잠금파일 두 개) |
| **30 권한 게이팅** | 숨기지 않고 비활성 + 이유 | U1(상태 보이기) · 실무 경험 |
| | 화면 게이팅은 안내, 인가는 서버 | S7 |
| | 비활성 버튼 이유가 키보드에 닿게 | A1(2.1.1 · 4.1.2) · A10 |
| | 메뉴·엔드포인트 배치 원칙 | 실무 경험 |
| **40 피드백** | 로딩 표시 기준(이전 내용 유지) | P2(CLS) · 실무 경험(`loading-state.md` 참고 자료) |
| | 기다림에 맞는 표시(1초·10초) | P9 · P10 |
| | 중복 제출 방지 | U5 |
| | 오류 문구 원칙 | U2 · U3 · A1(3.3.1 · 3.3.3) |
| | 상태 메시지를 라이브 영역으로 | A4 · A16 |
| | 사라지는 토스트에 조치 담지 않기 | A7 |
| | 확인창: 파괴 동작은 Cancel 포커스·연 요소로 복귀 | A11 |
| | 되돌리기 어려운 제출은 확인·검토·되돌리기 | A1(3.3.4) |
| | 배너·토스트 위치 | 실무 경험 · `alert-placement.md` 근거 절 |
| **50 폼·입력** | 보이는 라벨, placeholder 는 라벨 아님 | U5 · U6 · A1(3.3.2) |
| | `type`·`inputmode`·`autocomplete` | U5 · U6 · U7 · A1(1.3.5) |
| | 붙여넣기 허용·비밀번호 보기 | A2(3.3.8) · U5 |
| | 중복 입력 금지 | A2(3.3.7) |
| | 입력 보존·오류 요약·첫 오류로 포커스 | U2 · U4 |
| | 검증 시점(처음엔 기다리고 오류 뒤엔 즉시) | U2 · U6 (§3 조정) |
| | 한 나라 형식 가정 금지·칸 쪼개지 않기·고정 `name`/`id` | U6 · I7 |
| | 서버 판정·숫자 입력칸·첨부 | 실무 경험 |
| **60 URL 상태** | 화면 재현 값은 URL, push/replace | P8(History API) · 실무 경험 |
| **65 상태 관리** | 서버 상태는 캐시, 복사 금지 | T2 |
| | 파생값·모순 불리언·중복·중첩 피하기 | T1 |
| | 저장소에 토큰 금지 | S4 |
| **70 접근성** | WCAG 2.2 AA 기준선 | A1 · A2 · A3 |
| | 시맨틱 먼저, ARIA 위젯은 키보드까지 | A9 · A10 |
| | 페이지 구조(lang·title·제목·랜드마크) | A1(1.3.1 · 2.4.2 · 3.1.1) · A20 |
| | 이미지 alt | A14 |
| | 표 | A15 |
| | 보이는 글자가 이름에 | A5 |
| | 포커스·입력만으로 이동 금지·문자 단축키 | A1(3.2.1 · 3.2.2 · 2.1.4) |
| | 대비 4.5:1·3:1, 색만으로 금지 | A1(1.4.1 · 1.4.3 · 1.4.11) |
| | 대상 24×24, 끌기 대안 | A2 · A8 |
| | 포커스 가림 금지 | A2(2.4.11) |
| | 움직임 줄이기 | A18 · A1(2.2.2 · 2.3.1) |
| | 툴팁 세 조건 | A6 |
| | 모달 포커스 | A11 · A17 |
| | 탭 | A12 |
| | 콤보박스 등 | A13 |
| | 라우팅 뒤 제목·포커스 | A19 · A1(2.4.2) |
| | 자동 검사 + 키보드 한 바퀴 | A10 · G5 |
| | 포커스 링·스크롤 영역·표 행 링크·드롭다운 | 실무 경험 · A1(2.1.1) |
| **80 보안** | 탈출구 금지·새니타이저 | S1 · S2 |
| | 코드 실행 싱크 금지 | S2 · S5 |
| | URL 스킴·오픈 리다이렉트 | S1 |
| | 공개 환경 변수에 비밀 금지 | S11 |
| | 토큰 저장 위치 | S3 · S4 |
| | CSP 친화 코드 · Trusted Types | S5 · S6 |
| | `postMessage` 정확 일치·noopener·sandbox·SRI | S3 · S9 |
| | 의존성 이름 확인·공급망 | S8 · S10(A03) |
| | 화면 게이팅은 보안 아님 | S7 |
| **85 성능** | CWV 목표 | P1 |
| | CLS 대책 | P2 |
| | 첫 화면 이미지 지연 로딩 금지·나머지 지연 | P3 |
| | 반응형 이미지 | P5 |
| | INP 대책 | P4 |
| | 예산 | P6 |
| | 캐시·해시 파일명 | P7 |
| | 공개 페이지 SEO | P8 |
| | 측정 먼저 | P1 · P6 · 실무 경험 |
| **90 문구·i18n** | 하드코딩 금지 | G2 · G3 |
| | 조각 잇기 금지·복수형 | I2 · I1 |
| | 사용자 값과 번역 문구 구분 | I4 |
| | RTL(마크업 `dir`·논리 속성·`dir=auto`·`bdi`) | I5 · I6 · I4 |
| | 로캘을 명시해 `Intl` | I1 |
| | `<html lang>` | A20 |
| | 이름·주소 형식 | I7 · U6 |
| | 시간대(UTC·IANA·floating 날짜) | I3 |
| | 대시 금지·같은 대상 같은 단어 | A1(3.2.4) · 실무 경험 |
| **95 테스트·검증** | 프로젝트 명령으로 lint·typecheck·test·build | G1 · G2 · G3 · G4 |
| | 단언 약화·테스트 삭제 금지 | G1 · G2 |
| | 실제 브라우저·키보드·폭·콘솔 0 | G5 · A1(1.4.10) |
| | 사용자에게 보이는 결과·role 로 찾기 | T3 · T4 · T5 |
| | 고정 대기 금지·격리·외부 모킹 | T5 · G2 |
| | 시각 회귀 기준 이미지 | T6 |

## 3. 자료끼리 어긋나는 점과 이 팩의 결론

| 주제 | 자료 A | 자료 B | 이 팩 |
|---|---|---|---|
| 검증 시점 | NN/g(U2): 이른 검증은 적대적으로 느껴진다 | web.dev(U6): 실시간 피드백을 준다 | 처음엔 blur·제출까지 기다리고, 오류가 난 필드는 고치는 즉시 반응 |
| 진행 표시 시작 | NN/g(P9): 1초 넘으면 흐름이 끊기기 시작, 10초면 진행률 | Apple HIG(P10): 2초 이상 걸리면 표시 | 짧은 요청마다 번쩍이지 않고, 몇 초 걸리면 표시, 10초 넘으면 진행률 + 취소 |
| 토스트 시간 | WCAG 2.2.1(A7): 다른 곳에서 같은 정보를 얻을 수 있으면 대상 아님 | 실무: 사라지는 오류 토스트는 놓친다 | 조치가 필요한 오류는 남는 배너, 토스트는 사용자 설정 시간 + 라이브 영역 |
| 확인창 대 되돌리기 | APG(A11): 파괴 동작 확인창은 Cancel 에 초기 포커스 | WCAG 3.3.4(A1): 확인·검토·되돌리기 중 하나 | 기본은 확인창(되돌릴 수 없는 동작만), Undo 가 가능한 구조면 프로젝트 관례에 따른다 |
| 비활성 버튼 | 실무: 네이티브 `disabled` + 툴팁 | APG(A10)·WCAG 2.1.1: 네이티브 `disabled` 는 포커스를 못 받아 툴팁이 키보드에 안 닿는다 | 기본은 유지하고, 이유가 업무에 필수인 자리는 곁 글자나 `aria-disabled` + `aria-describedby` |
| 대상 크기 | WCAG 2.5.8(A8): 24×24px (AA) | web.dev(U5): 모바일 탭 대상 44×48px 권장 | 필수는 24×24, 모바일 주 조작은 더 크게(프로젝트 디자인 시스템 값) |
| `type="number"` | web.dev(U6): 숫자에는 `inputmode="numeric"` 권장 | — | 기존 규칙과 일치 — `type="text"` + `inputmode` |
| 전역 상태 | TanStack(T2): 서버 상태를 빼면 전역은 아주 작다 | G5: 로컬 → 끌어올림 → context → URL → 서버 → 전역 순 | 가장 가까운 곳, 서버 데이터는 캐시, URL 은 화면 재현 값 |
