# 키보드 웹 접근성

마우스 없이 **Tab 으로 이동하고 Enter/Space 로 실행**되는 것을 기준으로 잡는다. 이 문서는 프레임워크와 무관한 HTML·ARIA 기준이다. 스택별 구현(컴포넌트 속성·린트·검사기)은 그 스택 팩 문서에 있다(React 는 stack-react 팩의 `react-a11y.md`).

| 장치 | 무엇을 막나 |
|---|---|
| 프레임워크 접근성 린트 (**error**) | 키보드로 못 쓰는 클릭 요소, 연결 안 된 라벨, `alt` 없는 이미지 |
| 정적 검사기 (스택 팩) | 린트가 판정 못 하는 이름 누락 |
| 런타임 검사기 (스택 팩) | 소스에 안 남는 탭 정지 (브라우저로 실제 Tab 순회) |

## 포커스 표시 — `outline` 하나로

```css
.focus-ring:focus-visible        { outline: 2px solid var(--primary); outline-offset: 2px; }
.focus-ring-inset:focus-visible  { outline: 2px solid var(--primary); outline-offset: -2px; }
```

- `ring`(box-shadow)이 아니라 `outline` — 입력칸·체크박스가 테두리를 box-shadow 로 그리면 서로 덮는다.
- `:focus` 가 아니라 `:focus-visible` — 마우스 클릭에는 링이 뜨지 않는다.
- 스크롤 컨테이너 안은 음수 offset(`-inset`) — 양수면 바깥으로 그려져 잘린다.
- 이 CSS 를 컴포넌트 스타일 **맨 끝**에서 불러와 동점 우선순위를 이기게 한다. 화면마다 포커스 스타일을 따로 붙이지 않는다.

## Tab 순서

`① 본문 바로가기 → ② 상단 헤더(드롭다운 포함) → ③ 사이드 메뉴 → ④ 본문 왼쪽→오른쪽, 한 줄씩`

- DOM 순서가 Tab 순서다. 양수 `tabindex` 금지. `position: fixed` 사이드바는 화면 위치가 아니라 DOM 위치로 순서가 정해진다.
- 본문 바로가기는 라우팅 때 포커스를 받는 스크롤 컨테이너 **안**에 둔다(밖이면 닿지 않는다). Enter 는 `target.focus({ preventScroll: true })`.

## Tab 대상에서 빼는 것

| 대상 | 처리 | 왜 |
|---|---|---|
| 스크롤 라이브러리 영역(simplebar 등) | 마운트 후 스크롤 요소의 `tabIndex = -1` | 라이브러리가 `tabindex="0"` 을 직접 세운다 |
| 탭 패널 | `tabindex="-1"` | 탭 바와 같은 컨테이너라 따로 포커스 받을 이유가 없다 |
| 비활성 버튼 | DOM `disabled` | |
| 스티키 헤더 복제본 | `aria-hidden` + **`inert`** | `aria-hidden` 만으로는 탭 순서에 남는다 |

## 브라우저가 스스로 주는 탭 정지 — 스크롤 영역

Chrome 127+ 는 **포커스 가능한 자식이 없는 스크롤 영역을 탭 정지로 만든다**(keyboard-focusable scrollers). **없애지 않는다** — 막으면 화면 밖 내용에 키보드로 닿을 방법이 사라진다(WCAG 2.1.1). 대신:

```html
<div role="group" aria-label="Order status list" class="focus-ring" style="overflow-y: auto">
```

| 무엇 | 없으면 |
|---|---|
| `role="group"` | generic 이라 이름이 노출되지 않는다 |
| `aria-label` | 이름 없이 "그룹" 으로만 읽힌다 |
| 포커스 클래스 | 브라우저 기본 링이 뜬다 — 앱의 다른 포커스 표시와 모양이 다르다 |

- 소스만 봐서는 판정할 수 없다(`tabindex` 가 없고, 자식이 하나라도 포커스를 받으면 이 탭 정지는 없다). 실제 Tab 순회로 본다.
- `el.focus()` 가 먹히는지로 판정하지 않는다 — 스크롤 영역은 자식이 있어도 프로그램 포커스는 받는다(오탐).

## 표 — 행마다 진짜 링크/버튼

- 이동이면 대표 셀을 `<a href>` 로(새 탭·주소 복사가 된다), 패널을 여는 거면 `<button>` 으로. 행 전체 클릭 핸들러로 대신하지 않는다.
- 행 클릭을 막아야 하는 셀(체크박스·인라인 입력)은 전파만 막는 공용 래퍼로 감싼다 — 린트 예외를 그 안에 한 번만 둔다.

## 탭 바 — roving tabindex (WAI-ARIA tabs)

선택된 탭만 `tabindex="0"`, ←→ 로 이동, Enter/Space 로 선택, Tab 은 탭 바를 빠져나간다. **키 처리에 조건 없이 선택을 걸지 않는다** — Tab 키에도 탭이 바뀐다.

## 모달 — 들어가고, 갇히고, 돌아온다

- 열리면 포커스가 안으로, 안에서 순환하고, 닫히면 연 자리로 돌아간다.
- 배경은 보조기기에서 숨긴다(`aria-hidden`/`inert` — 모달 라이브러리의 해당 옵션을 끄지 않는다).
- **모달의 이름**: `role="dialog"` 에 이름이 없으면 "dialog" 라고만 읽힌다. 공용 다이얼로그·드로어가 열릴 때 **안의 첫 `h1`~`h6` 을 찾아 `aria-labelledby`** 를 걸게 한다 → 호출부는 제목을 `h*` 로 그리기만 한다.
- **포커스 트랩은 탭 대상을 태그·속성으로 열거하는 구현이 많다** — 그러면 브라우저가 스크롤 영역에 준 암묵 탭 정지에 닿지 않는다. 모달 안의 포커스 가능한 자식이 없는 스크롤 영역에는 `tabindex="0"` 까지 준다.

### 드롭다운에서 다이얼로그를 열 때

모달은 열리는 순간의 `document.activeElement` 를 복귀 지점으로 잡는다. 메뉴 항목이 곧 사라지면 Esc 후 포커스가 `body` 로 떨어진다. → **메뉴를 먼저 닫아 포커스를 토글로 동기 복귀시킨 뒤** 다이얼로그를 연다.

## 드롭다운 메뉴 항목

| 필요한 것 | 없으면 |
|---|---|
| 방향키 목록 네비게이션에 항목 등록 | 방향키가 건너뛴다 |
| `tabindex` = 활성이면 0, 아니면 -1 | 포커스를 못 받는다 |
| Enter/Space → 클릭 | `<li>` 는 기본 활성화가 없다 |

공용 메뉴 항목 컴포넌트가 셋을 다 하게 만든다. **토글 안에 버튼을 넣지 않는다** — 중첩 + 탭 정지 2개. 토글 제목은 `<span>`, 이름은 드롭다운의 `aria-label`.

## 라벨과 이름 — 화면을 바꾸지 않고 붙인다

| 상황 | 방법 |
|---|---|
| 보이는 라벨이 있다 | `<label for="x">` + 컨트롤 `id="x"` |
| 보이는 라벨이 없다 | `aria-label="…"` |
| 컨트롤 묶음(칩·라디오·Min~Max) | 캡션 `<span id="x">`, 감싸는 요소 `role="group" aria-labelledby="x"` |

- 커스텀 셀렉트·콤보박스는 `id` 가 바깥 래퍼에 붙어 `for` 가 실제 입력에 닿지 않는 경우가 많다 — 그 라이브러리의 "입력 요소 id" 옵션을 쓴다.
- id 는 화면 안에서 고유하게(접두어 = 화면 이름, 반복 렌더는 행 키 섞기). `aria-labelledby` 용 id 에 **공백 금지**(id 목록으로 읽힌다).
- 묶음에 `role="group"` 만 주면 컨트롤 자신의 이름은 비어 있다 — 단일 컨트롤이면 컨트롤에도 `aria-labelledby`.
- 라벨이 없다고 라벨을 새로 그리지 않는다 — `aria-label` 은 레이아웃을 안 바꾼다. 읽기 전용 값의 캡션은 `<span>`.
- contenteditable 편집기는 `for` 가 닿지 않는다 — 편집 영역에 `aria-label`.
- **캡션+컨트롤이 반복되는 화면은 공용 렌더러 한 곳에서** 이름을 준다 — 필드를 추가해도 이름이 따라온다.
- **이름이 사라질 수 있는 버튼·링크는 위반** — 아이콘뿐이거나, 조건부 렌더로 글자가 빠질 수 있는 것.

## 오류 상태 — `aria-invalid`

공용 입력 컴포넌트가 오류 상태를 받으면 `aria-invalid="true"` 를 스스로 붙이게 한다(정상이면 속성 없음). 붉은 테두리만으로는 스크린리더에 아무것도 전달되지 않는다. 오류 문구는 `aria-describedby` 로 필드에 잇고, 필수는 `aria-required`(별표를 이름에서 제외).

**메시지 없는 검증 규칙을 두지 않는다** — 빈 메시지로 붉은 칸만 남는다. 서버에 맡길 자리면 규칙 자체를 두지 않는다.

## 자동 포커스

기본 금지. 예외(린트 예외 주석에 이유): 페이지의 전부인 폼(로그인) · 사용자가 방금 연 인라인 편집 진입. 목록의 검색창에는 걸지 않는다.

## 스크린리더로 실제 확인 (macOS VoiceOver)

접근성 트리로는 "이름이 비어 있다" 는 보이지만 "엉뚱한 것이 이름으로 읽힌다"(링크가 href 로, 버튼이 역할 이름으로)는 안 보인다. 화면을 크게 손봤으면 실제 낭독을 듣는다.

준비: VoiceOver 켜기(⌘F5) → VoiceOver 유틸리티 → 일반 → "AppleScript로 VoiceOver를 제어할 수 있도록 허용".

```bash
osascript -e 'tell application "VoiceOver" to return content of last phrase'            # 방금 말한 문장
osascript -e 'tell application "VoiceOver" to return text under cursor of vo cursor'    # VO 커서 항목
```

- 이동은 `Control+Option+→` (웹 콘텐츠 진입 `Control+Option+Shift+↓`). Tab 만으로 훑으면 포커스가 브라우저 UI 로 샌다.
- `text under cursor` 는 입력칸에서 `missing value` 를 낸다 — 속성 한계다. 컨트롤 판정은 `last phrase` 로.
- 역할·상태 낭독(`required`·`invalid data`·`edit text`)은 OS 언어로 번역되어 나온다. 앱이 주는 것은 라벨과 오류 문구뿐이다.
