---
title: React 접근성 구현·검사기
load: on-demand
when: React 폼 컨트롤·버튼·표·탭·드롭다운·모달을 만들거나 고칠 때, 접근성 검사기를 돌리거나 공용 입력 컴포넌트를 추가할 때
---

## React 로 옮길 때 달라지는 것

기준(포커스 표시·Tab 순서·이름·모달)은 frontend 레이어 키보드 접근성 룰이다. React 에서는:

- 라벨 연결은 `htmlFor` + `id`. react-select 계열은 `inputId`(`id` 는 바깥 div 에 붙는다).
- 표 행은 대표 셀을 공용 행 링크 컴포넌트(이동 = `<Link>`, 패널 = `<button>`)로. 체크박스·인라인 입력 셀은 전파만 막는 공용 래퍼로.
- 탭 바 `onKeyDown` 은 ←→·Enter·Space 만 처리한다(조건 없이 선택하면 Tab 에도 바뀐다).
- react-modal 계열: `shouldFocusAfterRender` · `shouldReturnFocusAfterClose` 켜기, `ariaHideApp` 끄지 않기, 진입점에서 `setAppElement` 한 번. 공용 Dialog 가 첫 `h*` 로 `aria-labelledby` 를 건다.
- 드롭다운에서 다이얼로그를 열 때 메뉴 닫기(ref 의 close) → `setOpen(true)` 순서로.
- 조건부 자식(`{cond && <span>…}`)이나 한쪽이 글자를 내지 않는 삼항이 버튼의 유일한 글자면 이름이 사라진다 — 위반.
- `autoFocus` 는 기본 금지(ESLint 예외 주석에 사유). 비활성 버튼은 DOM `disabled`.
- 오류 상태: 공용 `Input` 이 `invalid` prop 을 받으면 `aria-invalid` 를 스스로 세우게 한다.

## 검사기

ESLint `jsx-a11y`(recommended, **error**)가 1차다. 그 규칙이 못 보는 것을 이 팩 도구가 본다.

```bash
python3 packs/stack-react/bin/check-a11y-labels.py            # 정적 — 연결 안 된 라벨 · 이름 없는 컨트롤 · 이름 없는 버튼/링크 · 토글 안 중첩 버튼
node packs/stack-react/bin/check-a11y-runtime.js              # 런타임 — 실제 Tab 순회로 스크롤 영역 탭 정지 (앱이 떠 있어야 한다)
node packs/stack-react/bin/check-a11y-runtime.js --modals     # 드로어·다이얼로그 안까지 (비-GET 요청 차단)
```

- `label-has-associated-control` 은 라벨 안에 JSX 표현식이 하나라도 있으면(`{' '}` 포함) 통과시킨다 — 정적 검사기가 그 사각지대를 잡는다.
- 새 공용 입력 컴포넌트는 워크스페이스 설정 `vars.react.a11y.controls` 와 ESLint 컨트롤 목록 양쪽에 추가한다.
- 런타임 결과는 "트리거 N개" 가 아니라 **"열린 모달 N개"** 를 본다 — 안 열린 모달은 검사되지 않은 것이다.

상세: `packs/stack-react/docs/react-a11y.md`
