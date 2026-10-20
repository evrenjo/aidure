---
title: 브라우저 쪽 보안 (XSS·비밀값·토큰·CSP)
load: on-demand
when: 서버·사용자·URL·외부에서 온 값을 화면에 그리거나 링크·리다이렉트에 쓸 때, HTML 을 직접 넣을 때, 토큰·세션·환경 변수·외부 스크립트·postMessage·iframe 을 다룰 때, 새 패키지를 추가할 때
---

## 값은 텍스트로 넣는다 (XSS)

- 프레임워크의 기본 바인딩(자동 이스케이프)을 쓴다. **이스케이프를 끄는 탈출구**(`innerHTML`·`outerHTML`·`document.write`, React `dangerouslySetInnerHTML`, Vue `v-html`, Angular `bypassSecurityTrust*`, Lit `unsafeHTML` 등)에 서버·사용자 값을 넣지 않는다.
- 사용자가 쓴 HTML(리치 에디터·마크다운 결과)을 꼭 보여야 하면 **검증된 새니타이저(DOMPurify 등)를 통과시킨 직후** 넣고, 그 뒤에 다시 문자열을 고치지 않는다. 새니타이저는 최신으로 유지한다.
- 코드로 실행되는 자리에 값을 넣지 않는다 — `eval`·`new Function`·문자열 `setTimeout`·`setInterval`, 이벤트 핸들러 속성(`onclick=` 문자열). JSON 은 `JSON.parse`.
- **URL 값은 스킴을 확인한다** — `href`·`src`·`location` 에 들어갈 값은 `http:`·`https:`(필요하면 `mailto:`)만 허용한다. `javascript:`·`data:` 는 막는다. 로그인 뒤 돌아갈 주소 같은 리다이렉트 대상은 **같은 출처의 경로만** 받는다(오픈 리다이렉트).
- 스타일·CSS 에 사용자 값을 끼워 넣지 않는다(클래스 선택이나 CSS 변수 값 검증으로).

## 비밀값·토큰

- **번들에 들어간 값은 공개다** — 빌드 시 주입되는 공개 환경 변수(`VITE_*`·`NEXT_PUBLIC_*`·`REACT_APP_*` 등)에 API 키·비밀번호·서명 키를 두지 않는다. 비밀이 필요한 호출은 서버를 거친다. 소스맵 공개 여부도 프로젝트 정책을 따른다.
- **세션·인증 토큰 저장 위치는 프로젝트의 기존 방식을 따른다.** 새로 정해야 하면 `HttpOnly`·`Secure`·`SameSite` 쿠키를 우선 검토한다 — `localStorage`·`sessionStorage` 는 XSS 한 번에 전부 읽힌다. 메모리 보관 + 갱신 쿠키 같은 구조를 바꾸려면 묻는다.
- 토큰·개인정보·전체 응답 본문을 `console`·오류 수집 도구·URL 쿼리에 남기지 않는다(URL 은 기록·리퍼러로 샌다).

## CSP 에 맞는 코드

- 인라인 `<script>`·인라인 이벤트 핸들러·`eval` 계열을 쓰지 않는다 — 엄격한 CSP(nonce·hash, `'unsafe-inline'`·`'unsafe-eval'` 없음)에서 깨진다. 이벤트는 코드에서 붙인다.
- 프로젝트가 **Trusted Types** 를 켰으면(`require-trusted-types-for 'script'`) HTML 싱크에는 정책을 거친 값만 넣는다. 새로 켜는 것은 헤더 변경이라 보고한다.
- CSP·보안 헤더는 서버·인프라 설정이다. 화면 작업 중 CSP 위반 오류가 보이면 정책을 넓히지 말고 코드 쪽을 고치거나 보고한다.

## 창·프레임·외부 코드

- `postMessage` 는 보낼 때 대상 출처를 명시하고(`*` 금지), 받을 때 `event.origin` 을 **정확히 일치**로 검사한다(부분 문자열 비교 금지). 받은 데이터는 신뢰하지 않는 입력으로 다룬다.
- 외부 도메인으로 새 창을 열면 `rel="noopener noreferrer"`. 외부 콘텐츠 iframe 은 `sandbox` 를 기본으로.
- 제3자 스크립트·위젯을 새로 들이는 것은 묻는다. CDN 에서 직접 받으면 SRI(`integrity`) 를 건다.

## 의존성 (공급망)

- 새 패키지는 **설치 전에 실제 이름·존재·유지 상태를 확인**한다(`npm view <이름>` 등) — 떠올린 이름이 없는 패키지이거나 비슷한 이름의 악성 패키지일 수 있다. 플랫폼 API 로 되면 들이지 않는다.
- 잠금파일 고정 설치를 깨지 않는다(frontend 구조 룰 §패키지 추가). 설치 스크립트가 있는 새 패키지·취약점 경고는 보고한다.

## 경계

- 화면의 검증·권한 게이팅은 사용자 경험이다. 보안 판정은 서버가 요청마다 한다 — 화면에서만 막는 동작을 발견하면 보고한다.

상세·리뷰 체크리스트: `packs/frontend/docs/web-security.md` · 근거: `packs/frontend/docs/SOURCES.md`
