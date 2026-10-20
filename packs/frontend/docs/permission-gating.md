# 권한 게이팅 상세 (체크리스트 · 컴포넌트 주의 · 라우트 가드)

요약 규칙은 `packs/frontend/rules/30-permission-gating.md`. 여기는 구현 세부와 리뷰 체크리스트다. 코드는 React 예시이며 훅·컴포넌트 이름은 프로젝트의 것으로 바꿔 읽는다.

## 문구 헬퍼

```ts
// 공용 유틸 (예: permissionTooltip.ts)
export const noPermission = (action: string) => `You do not have permission to ${action}.`
```

- 인자는 동사구(`'delete orders'`, `'apply price changes'`). 문장부호는 헬퍼가 붙인다.
- 보안 등급까지 필요하면 파일 상단 상수로: `Insufficient permission (requires {role} and {what} rights).`
- 자식 컴포넌트가 사유를 그려야 하면 부모가 `editDisabledReason` 같은 prop 으로 내려보낸다(기본값은 상태 사유 평문, 권한이면 `noPermission(...)`).

## 원래 툴팁이 있던 컨트롤

```tsx
const { DELETE: canDelete } = usePermission('ORDER_MODIFY')

<Tooltip title={canDelete ? 'Delete' : noPermission('delete orders')}>
    <IconButton aria-label="Delete order" disabled={!canDelete} onClick={onDelete}>
        <TrashIcon />
    </IconButton>
</Tooltip>
```

## 권한 + 상태 사유

```tsx
<Tooltip
    disabled={canSubmit && !stateReason}
    title={!canSubmit ? noPermission('submit orders for approval') : stateReason}
>
    <Button disabled={!canSubmit || !!stateReason} onClick={handleSubmit}>Submit</Button>
</Tooltip>
```

## 컴포넌트별 주의 — 비활성 버튼은 DOM `disabled`

| | DOM `disabled` | 비활성 표현 | 클릭 차단 |
|---|---|---|---|
| 버튼 (`<button>` 렌더) | 세움 | 흐림 + `cursor: not-allowed` | DOM `disabled` |
| 버튼 (`<a>`·`<div>` 렌더) | 없음 → `aria-disabled` | 〃 | 핸들러 조기 return |
| 아이콘 버튼 | 세움 | 〃 | DOM `disabled` |

1. 비활성 버튼은 Tab 순서에서 빠진다.
2. 비활성 판정은 클래스가 아니라 `disabled`(링크형이면 `aria-disabled`)로 한다.
3. 툴팁이 자식을 `<span>` 으로 감싸면 DOM `disabled` 버튼 위에서도 hover 가 잡힌다.

## 라우트 진입 가드 — 권한 검사 생략 플래그를 함부로 벗기지 않는다

가드가 `permissionMap[route.path]` 로 조회하고 그 맵이 메뉴 코드와 메뉴 URL 로 만들어지면, 생략 플래그를 빼려면 셋이 다 맞아야 한다. 하나라도 어긋나면 **최고 관리자까지 전원 접근 거부**다.

| 조건 | 어긋나면 |
|---|---|
| 그 경로의 메뉴 행이 존재 | 키가 없다 |
| 메뉴 URL == 라우트 path (파라미터 이름까지) | 키가 안 잡힌다 |
| 깊은 메뉴면 "권한 필요" 플래그가 켜짐 | 서버가 메뉴 응답에 안 싣는다 |

직접 URL 로 들어와도 그 화면의 조회 API 가 각자 권한을 요구하고 쓰기는 서버 인가가 막으므로, 플래그를 벗기려면 메뉴 행·URL 정렬·플래그 전환을 시드와 전 환경 DB 까지 함께 한다.

## 권한 키 감사 스크립트 (프로젝트별로 둔다)

화면의 권한 조회 호출(React 예: `usePermission('MENU').PERM`)을 전부 뽑아 **메뉴-엔드포인트 매핑(자손 롤업 포함)** 과 대조한다. 걸리는 것은 두 종류다 — 아무도 부여받을 수 없는 조합(권한 화면에 체크박스가 없다) · 버튼이 부르는 엔드포인트가 다른 메뉴에 있는 조합. 매핑 테이블·접속 정보가 프로젝트마다 달라 이 팩에는 넣지 않았다. 만들 때: ① 소스에서 권한 조회 호출·속성 접근을 정규식으로 수집 ② DB/시드에서 (메뉴, 권한) → 엔드포인트 집합 ③ 차집합을 파일:라인과 함께 출력, 0 이면 exit 0.

## 체크리스트 (리뷰)

- [ ] 권한 없는 컨트롤을 조건부 렌더로 숨기지 않았는가? (비활성 + 툴팁)
- [ ] 툴팁 문구를 헬퍼로 만들었는가? 권한 없을 때 **사유**를 말하는가?
- [ ] 쓰기 요청을 보내는데 권한 조회가 아예 없는 화면은 아닌가?
- [ ] 권한 키가 그 버튼이 부르는 엔드포인트의 메뉴인가? (부모 키·화면 이름 짐작 금지)
- [ ] 권한 외 조건과 합칠 때 권한을 앞에, 툴팁 우선순위도 같은가?
- [ ] 쓰기 엔드포인트를 조회 메뉴가 아니라 수정 메뉴에 매핑했는가?
- [ ] 전역(인증만) 메뉴에 부여를 넣지 않았는가?
- [ ] 새 메뉴 URL 이 라우트 path 와 글자 단위로 같은가? 라우트가 아니면 비웠는가?
- [ ] 시드가 저장의 고정점인가? 권한 키 감사가 0 인가?
