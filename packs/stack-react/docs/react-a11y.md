# React 접근성 구현·검사기

기준(무엇을 해야 하는가)은 frontend 레이어 팩의 `keyboard-a11y.md` 다. 여기는 React 로 구현하는 방법과 이 팩 검사기의 쓰임이다. 컴포넌트 이름(`RowLink` · `StopRowClick` 등)은 예시다 — 프로젝트의 공용 컴포넌트로 바꿔 읽는다.

| 장치 | 무엇을 막나 |
|---|---|
| ESLint `jsx-a11y` (recommended, **error**) | 키보드로 못 쓰는 클릭 요소, 연결 안 된 라벨, `alt` 없는 이미지 |
| ESLint `no-restricted-syntax` 셀렉터 | `htmlFor` 도 없고 안에 컨트롤도 없는 `<label>` — jsx-a11y 사각지대 |
| `packs/stack-react/bin/check-a11y-labels.py` | ESLint 가 판정 못 하는 이름 누락 |
| `packs/stack-react/bin/check-a11y-runtime.js` | 소스에 안 남는 탭 정지 (브라우저로 실제 Tab 순회) |

## 스크롤 영역 탭 정지

```tsx
<div role="group" aria-label="Order status list" className="focus-ring overflow-y-auto">
```

스크롤 라이브러리(simplebar 등)는 마운트 후 `getScrollElement().tabIndex = -1` — 라이브러리가 `tabindex="0"` 을 직접 세운다.

## 표 — 행마다 진짜 링크/버튼

```tsx
<RowLink to={`/orders/${row.orderId}`}>{row.orderTitle}</RowLink>   // 이동이면 링크
<RowLink onActivate={() => openDrawer(row)}>{row.name}</RowLink>   // 드로어면 버튼
```

행 클릭을 막아야 하는 셀은 전파만 막는 래퍼(`StopRowClick`)로 감싼다 — `jsx-a11y` 예외를 그 안에 한 번만 둔다.

## 모달 (react-modal 계열)

```tsx
shouldFocusAfterRender={true}        // 열리면 포커스가 안으로
shouldReturnFocusAfterClose={true}   // 닫히면 연 자리로
// ariaHideApp 를 끄지 않는다 — 배경이 스크린리더에 계속 읽힌다
```

- 앱 진입점에서 `ReactModal.setAppElement('#root')` 를 한 번.
- 공용 Dialog·Drawer 가 열릴 때 안의 첫 `h1`~`h6` 을 찾아 `aria-labelledby` 를 건다. 다른 이름이 필요하면 `contentLabel` 이 우선.
- react-modal 포커스 트랩은 탭 대상을 태그·속성으로 열거한다 — 모달 안의 포커스 가능한 자식 없는 스크롤 영역에는 `tabIndex={0}` 까지 준다.

### 드롭다운에서 다이얼로그를 열 때

```tsx
onClick={() => {
    dropdownRef.current?.handleDropdownClose()   // 포커스를 토글로 동기 복귀
    setDialogOpen(true)                          // 모달이 그 토글을 복귀 지점으로 기억
}}
```

## 라벨·이름

- `<label htmlFor="x">` + `id="x"`. react-select 계열은 `inputId` — `id` 는 바깥 div 에 붙어 `htmlFor` 가 닿지 않는다.
- id 는 화면 안에서 고유하게(접두어 = 화면 이름, 반복 렌더는 행 키 섞기).
- 폼 라이브러리의 문구 없는 규칙(`rules={{ required: true }}`)을 두지 않는다 — 빈 메시지로 오류를 세운다.

## 검사기

### 정적 — `check-a11y-labels.py`

`label-has-associated-control` 은 라벨 안에 JSX 표현식이 하나라도 있으면(`{' '}` 포함) 통과시킨다.

```tsx
{/* jsx-a11y 통과. 그러나 라벨과 입력칸은 이어져 있지 않다 */}
<label className="…">Title{' '}<span className="text-red-500">*</span></label>
<Input … />
```

```bash
python3 packs/stack-react/bin/check-a11y-labels.py            # 위반 목록, 0 이면 exit 0
python3 packs/stack-react/bin/check-a11y-labels.py --quiet    # 건수만
python3 packs/stack-react/bin/check-a11y-labels.py --repo <경로>
```

검사 4종 — ①연결 안 된 라벨 ②이름 없는 컨트롤 ③아이콘뿐이거나 조건·삼항으로 이름이 사라질 수 있는 버튼·링크 ④드롭다운 토글 안의 중첩 버튼.

```jsx
{showTitle && <span>{menuName}</span>}   // 조건이 거짓이면 이름 없음 → 위반
{on ? <CheckIcon /> : <></>}             // 양쪽 다 글자 아님       → 위반
{busy ? 'Saving' : 'Save'}               // 어느 쪽이든 글자        → 정상
```

프로젝트 공용 입력 컴포넌트·이름 주는 래퍼·이름 전달 래퍼는 `workspace.json` 의 `vars.react.a11y.controls` · `namingWrappers` · `forwardingPattern` 에 적는다. ESLint 쪽 컨트롤 목록에도 같이 추가한다.

### 런타임 — `check-a11y-runtime.js`

```bash
node packs/stack-react/bin/check-a11y-runtime.js                     # 화면 단위
node packs/stack-react/bin/check-a11y-runtime.js --modals            # 드로어·다이얼로그 안까지
node packs/stack-react/bin/check-a11y-runtime.js --route /dashboard  # 한 경로만 (반복 가능)
node packs/stack-react/bin/check-a11y-runtime.js --headed            # 눈으로 보며
```

- 앱(프론트 + API)이 떠 있어야 한다. Playwright 가 필요하다(`require('playwright')` · 전역 설치 · npx 캐시 순으로 찾는다).
- 경로는 `vars.react.a11y.routesFile` 에서 파라미터 없는 `path:` 를 뽑는다. 로그인은 `loginPath` + 셀렉터 + `A11Y_ID`/`A11Y_PW` 환경변수.
- `--modals` 는 본문 버튼을 눌러 모달을 열고 안에서 다시 Tab 을 순회한다. **로그인·토큰 갱신을 뺀 모든 비-GET 요청을 차단**해 데이터가 바뀌지 않는다(전면 차단하면 토큰 갱신이 막혀 세션이 끊긴다). 화면을 떠난 트리거는 되돌린다. 같은 컴포넌트는 DOM 구조 + 열 위치로 접어 한 번만. 페이지 번호·로그아웃·내려받기는 제외. 헤더 드롭다운은 첫 경로에서만.
- 한계: 비-GET 이 막히므로 저장 후에야 뜨는 화면은 도달하지 않는다. 파라미터가 필요한 상세는 `--route` 로.
- 결과는 "트리거 N개" 가 아니라 **"열린 모달 N개"** 와 그 이름 목록을 본다.
- 드롭다운 메뉴 안의 스크롤 영역은 대상이 아니다 — roving tabindex 라 Tab 이 메뉴를 건너뛴다(오탐).
- 모달 셀렉터 기본값은 react-modal 클래스다(`vars.react.a11y.modalOpenSelector`) — 다른 모달 라이브러리면 바꾼다.
