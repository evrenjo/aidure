# 브라우저 쪽 보안 상세

요약 규칙은 `packs/frontend/rules/80-web-security.md`. 출처는 `packs/frontend/docs/SOURCES.md` (OWASP 치트시트 · MDN · OWASP Top 10:2025).

> 서버·인프라가 정하는 것(CSP 헤더 값, 쿠키 발급, CORS, 인증 방식)은 이 문서의 대상이 아니다.
> 화면 코드가 그 정책을 **깨지 않게** 쓰는 법만 다룬다. 정책을 바꿔야 하면 보고한다.

## 1. 위험한 싱크 — 신뢰할 수 없는 값이 닿으면 안 되는 곳

| 싱크 | 대신 |
|---|---|
| `innerHTML` · `outerHTML` · `insertAdjacentHTML` · `document.write(ln)` | `textContent` · `createElement` + `append` · 프레임워크 바인딩 |
| `eval` · `new Function` · 문자열 `setTimeout`/`setInterval` | 함수 참조, JSON 은 `JSON.parse` |
| `location` · `location.href` · `window.open` 에 값 대입 | 허용 목록 경로·스킴 검증 후 |
| `href` · `src` · `action` · `formaction` 속성 | 스킴 검증(아래 §2) |
| 이벤트 핸들러 속성(`setAttribute('onclick', …)`) | `addEventListener` |
| `<script>` 의 `src`·본문, `<iframe srcdoc>` | 사용자 값 금지 |
| CSS 문자열(`style` 에 통째로 삽입) | 개별 속성·CSS 변수에 검증한 값 |

### 프레임워크의 탈출구

프레임워크는 기본적으로 텍스트를 이스케이프한다. 아래는 **그것을 끄는** API 라 리뷰 대상이다.

| 프레임워크 | 탈출구 |
|---|---|
| React | `dangerouslySetInnerHTML` |
| Vue | `v-html` |
| Angular | `bypassSecurityTrustHtml/Url/ResourceUrl/Script/Style`, `[innerHTML]`(자체 새니타이즈는 있다) |
| Svelte | `{@html …}` |
| Lit | `unsafeHTML` · `unsafeSVG` |

- 어느 프레임워크든 `href`·`src` 속성 바인딩은 URL 스킴을 검사해 주지 않는다고 보고 §2 대로 직접 검증한다.
- 쓸 수밖에 없으면 **DOMPurify 같은 검증된 새니타이저 결과만** 넣고, 새니타이즈 뒤에 문자열을 다시 조작하지 않는다(정리한 것이 다시 깨진다).
- 마크다운 렌더러는 원시 HTML 통과 옵션을 끄거나 결과를 새니타이즈한다.
- 서버가 이미 이스케이프했다고 가정하지 않는다 — 이중 이스케이프 문제를 피하려고 화면 쪽 이스케이프를 끄는 일이 흔한 원인이다.

## 2. URL 값

```js
// 예시 — 스킴 허용 목록
function safeHref(raw) {
  try {
    const u = new URL(raw, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : null
  } catch { return null }
}

// 로그인 뒤 돌아갈 곳 — 같은 출처 경로만
function safeReturnTo(raw) {
  try {
    const u = new URL(raw, window.location.origin)
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : '/'
  } catch { return '/' }
}
```

- 문자열 시작 비교(`startsWith('/')`)만으로는 `//evil.example` 이 통과한다 — `URL` 로 파싱해 출처를 비교한다.
- 파일 다운로드 링크를 `blob:` 으로 만들면 쓰고 나서 `URL.revokeObjectURL`.

## 3. 토큰·세션·저장소

| 저장 위치 | XSS 한 번이면 | 비고 |
|---|---|---|
| `HttpOnly; Secure; SameSite` 쿠키 | 스크립트로 못 읽는다(요청은 대신 보낼 수 있다) | OWASP 권장. CSRF 대책(SameSite·토큰)과 짝 |
| 메모리(변수) + 갱신은 HttpOnly 쿠키 | 페이지가 살아 있는 동안만 노출 | 새로고침 시 재발급 흐름 필요 |
| BFF(서버가 토큰을 들고 화면은 세션 쿠키만) | 토큰 자체가 브라우저에 없다 | 구조 변경이라 설계 결정 |
| `localStorage` · `sessionStorage` · IndexedDB | **전부 읽힌다** | OWASP: 인증 토큰·세션 ID·JWT·리프레시 토큰을 두지 않는다 |

- 기존 프로젝트가 이미 방식을 정했으면 그것을 따른다. 바꾸는 것은 인증 설계 변경이라 묻는다.
- 개인정보·토큰을 URL 쿼리에 싣지 않는다 — 서버 로그·브라우저 기록·`Referer` 로 샌다.
- 로그아웃 때 화면 캐시(서버 상태 캐시·전역 스토어·저장소)를 비운다. 다른 사용자가 같은 브라우저를 쓴다.
- 오류 수집 도구(Sentry 등)에 요청 본문·헤더를 통째로 보내지 않는다 — 민감 필드를 가린다.

## 4. 비밀값

- 빌드 도구의 공개 환경 변수(Vite `VITE_*`, Next.js `NEXT_PUBLIC_*`, CRA `REACT_APP_*`, Angular `environment.ts` 전체)는 **번들에 문자열로 박힌다.** 공개돼도 되는 값(공개 API 주소, 공개 분석 키)만.
- 지도·결제·분석 SDK 의 "브라우저용 키" 는 도메인 제한이 걸린 공개 키여야 한다. 서버 비밀 키를 화면에 두지 않는다.
- 운영 소스맵을 공개할지는 프로젝트 정책. 소스맵에는 원본 코드와 주석이 그대로 있다.

## 5. CSP · Trusted Types 에 맞는 코드

| 하지 않는다 | 이유 |
|---|---|
| 인라인 `<script>` · `onclick="…"` 속성 | 엄격한 CSP(nonce·hash)에서 막힌다 |
| `eval` · `new Function` · 문자열 타이머 | `'unsafe-eval'` 을 요구하게 된다 |
| 런타임에 `<style>` 문자열 주입 | `style-src` 에 `'unsafe-inline'` 을 요구하게 된다 (CSS-in-JS 는 nonce 지원 여부 확인) |
| 외부 CDN 스크립트를 무심코 추가 | `script-src` 허용 목록을 넓혀야 한다 |

- **Trusted Types**(`require-trusted-types-for 'script'`)는 `innerHTML` 같은 싱크에 문자열을 넣으면 오류를 낸다. 정책(policy)을 거친 값만 받는다. MDN 기준 2026년 2월부터 주요 브라우저 기준선(Baseline 2026)이 됐다 — 프로젝트가 켰으면 싱크마다 정책을 거치고, 새로 켜는 것은 서버 헤더 변경이라 보고한다.
- 화면 작업 중 콘솔에 CSP 위반이 보이면 정책을 넓히지 말고 코드 쪽을 고친다.

## 6. 창·프레임·메시지

- `postMessage(data, '<정확한 대상 출처>')` — `*` 금지. 받는 쪽은 `event.origin === '<기대 출처>'` 로 **정확히 일치** 비교(`includes`·`endsWith` 금지). 받은 데이터는 형태를 검증하고 싱크에 바로 넣지 않는다.
- `target="_blank"` 로 외부를 열면 `rel="noopener noreferrer"`(최신 브라우저는 `noopener` 가 기본이지만 명시가 안전하고 리퍼러도 막는다).
- 외부 콘텐츠 iframe 은 `sandbox`(필요한 권한만 `allow-*`), 우리 화면이 남의 iframe 에 들어가면 안 되면 서버의 `frame-ancestors`(보고 대상).

## 7. 의존성 위생 (공급망 — OWASP Top 10:2025 A03)

- 잠금파일 고정 설치(`npm ci` 등)로 CI 와 같은 트리를 쓴다. 잠금파일을 지우고 재생성하지 않는다.
- **새 패키지는 설치 전에 실제로 있는지·이름이 맞는지 본다**(`npm view <이름>`). 에이전트가 떠올린 패키지 이름은 존재하지 않거나 비슷한 이름의 악성 패키지(typosquatting)일 수 있다.
- 새 의존성은 필요성(플랫폼 API 로 되는가)·유지 상태·크기·라이선스를 보고 묻고 들인다.
- 취약점 경고(`npm audit` 등)는 보고하고, 메이저 업그레이드는 별도 작업으로.
- 설치 스크립트(`postinstall`)가 있는 새 패키지는 한 번 더 본다. 프로젝트가 `ignore-scripts` 를 쓰면 따른다.
- 제3자 스크립트(분석·채팅·광고)는 페이지 전체 권한으로 돈다 — 새로 넣는 것은 묻고, CDN 직접 로드면 SRI `integrity` + `crossorigin`.

## 8. 화면 검증·권한은 보안이 아니다

OWASP Authorization: 클라이언트 쪽 접근 통제는 사용자 경험용이며 결정 요소가 되면 안 된다. 화면에서 숨기거나 비활성화한 동작도 요청을 직접 만들면 호출된다.
화면 작업 중 서버가 막지 않는 동작을 발견하면 그 사실을 보고한다(화면에서 더 세게 막는 것으로 끝내지 않는다).

## 리뷰 체크리스트

- [ ] 탈출구 API(§1) 에 서버·사용자 값이 닿는가? 닿으면 새니타이저를 거쳤는가?
- [ ] 사용자·서버에서 온 URL 이 `href`·`src`·`location` 에 들어가는가? 스킴·출처를 검증했는가?
- [ ] 새 코드가 `localStorage` 에 토큰·개인정보를 쓰는가?
- [ ] 공개 환경 변수에 비밀이 들어갔는가?
- [ ] 인라인 스크립트·`eval`·문자열 타이머가 생겼는가?
- [ ] `postMessage` 출처를 정확 일치로 검사하는가?
- [ ] 새 패키지·제3자 스크립트를 묻고 들였는가? 이름을 확인했는가?
