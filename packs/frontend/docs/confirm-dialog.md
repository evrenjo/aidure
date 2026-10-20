# 확인 다이얼로그 규약

## 적용 범위 — 되돌릴 수 없는 동작만

| 동작 | 예 | 확인창 |
|---|---|---|
| 파괴 | Delete · Remove · Revoke · Discard · Reject · Lock | **O** (`danger`) |
| 외부 통지 유발 | 임계 이상 변경으로 알림·메일이 나간다 | **O** (`warning`) |
| 폼 등록·수정 | Add · Create · Save · Modify | X — 즉시 실행, 검증 오류는 인라인 |
| 일반 상태 전환 | Submit · Approve · Activate · Unlock · Reset Password | X — 즉시 실행 |
| 조회·검색·입력 변경·이동 | — | X |

**판단 기준은 되돌리기 어려운가**다 — 데이터 영구 손실, 세션 즉시 종료, 풀려면 별도 권한이 필요한 잠금.
모든 변경에 확인창을 걸면 사용자는 읽지 않고 OK 를 누르게 되고, 서버 인라인 검증 흐름과도 충돌한다.

### 예외 — 요구사항이 확인 단계를 못박은 컨트롤

수용 조건이 확인을 요구하면 **그 컨트롤에만** 넣고 코드 주석에 티켓 번호를 남긴다. 예:

- 저장 전에 부여될 번호를 보여주고 확인받는 생성 (`info`).
- 기존 값을 대체하는 일괄 적용 — **대체될 것이 있을 때만** 확인(`warning`). 서버도 "대체 동의" 플래그 없이는 거부하게 두면 두 겹이 된다.
- 여러 요청으로 나눠 보내는 일괄 이동 — 묶음마다 뜨지 않게 **시작 전에 한 번만** 확인하고 이후 요청에 동의 플래그를 붙인다.
- 한 번에 보내는 경우 — 서버가 409 로 대체 목록을 알려주면 그 문구로 확인받고 플래그를 붙여 재전송.

이 예외를 다른 저장으로 일반화하지 않는다.

## 컴포넌트와 호출 골격

프로젝트의 공용 확인 다이얼로그 하나만 쓴다. 필요한 입력: 열림 여부 · 종류(`info`/`success`/`warning`/`danger`) · 제목 · 확인 버튼 모양 · 취소/확인/닫기 핸들러. 아래 컴포넌트·prop 이름은 예시다.

```tsx
// React 예시
const [confirmOpen, setConfirmOpen] = useState(false)

const handleClick = () => setConfirmOpen(true)       // 버튼은 열기만

const handleConfirm = () => {                        // 실제 호출은 여기서만
    mutation.mutate(payload)
    setConfirmOpen(false)
}

<ConfirmDialog
    isOpen={confirmOpen}
    type="danger"
    title="Delete Order?"
    confirmButtonProps={{ color: 'red-600' }}
    onClose={() => setConfirmOpen(false)}
    onRequestClose={() => setConfirmOpen(false)}
    onCancel={() => setConfirmOpen(false)}
    onConfirm={handleConfirm}
>
    Are you sure you want to delete <strong>Order O-2026-001</strong>?
</ConfirmDialog>
```

- Cancel · X · ESC · 백드롭은 **닫기만** 한다. 토스트·라우팅·API 호출 같은 부수효과 금지, 폼 dirty 상태 유지.
- 확인 버튼 라벨은 기본값(`OK` / `Cancel`) 그대로. 동작 종류는 제목이 말한다. 기본값과 같은 값을 다시 prop 으로 박지도 않는다.
- 라벨을 바꿔도 되는 예외(린트 예외 주석 + 문서 등록 필수): ①두 갈래 선택형(Cancel 도 진행하는 경우) ②단일 버튼 알림 ③파괴 범위를 버튼에 적어야 하는 경우.

## type ↔ 동작

| 동작 | type | 확인 버튼 색 |
|---|---|---|
| Delete · Remove · Discard | `danger` | 빨강 |
| Save changes(예외적으로 확인할 때) | `warning` | 기본 |
| Submit · Approve · Activate | `info` | 기본 |
| Reject · Deactivate · Lock | `warning` | 기본 |

## 문구 (UI 언어의 실무체, 짧고 직접적으로)

- 제목: `{Action} {Entity}?` — `Delete Order?`, `Delete 3 Orders?`, `Discard Changes?`
- 본문: 의문문 한 줄 — `Are you sure you want to delete <strong>{식별자}</strong>?`. 대량이면 건수 + 칩 목록.
- `danger` 는 경고 박스 한 줄: `Deleting this {entity} will permanently remove all associated {children}. This action cannot be undone.`
- `info`·`warning` 은 영향이 분명할 때만 노트 박스 한 줄.
- 표의 행에서 빼기만 하는 것은 `Remove`, 영구 삭제는 `Delete` 로 동사를 가른다.

## 미저장 이탈 — 공용 "변경 폐기" 다이얼로그

```tsx
// React 예시
const [original, setOriginal] = useState<Form | null>(null)
const isDirty = original !== null && (form.a !== original.a || form.b !== original.b)

const [discardOpen, setDiscardOpen] = useState(false)
const requestClose = () => (isDirty ? setDiscardOpen(true) : onClose())

<Drawer onClose={requestClose} onRequestClose={requestClose}>
    …
    <Button onClick={requestClose}>Cancel</Button>
</Drawer>
<DiscardChangesDialog
    isOpen={discardOpen}
    onCancel={() => setDiscardOpen(false)}
    onConfirm={() => { setDiscardOpen(false); onClose() }}
/>
```

## 표의 인라인 행 삭제

행의 휴지통도 같은 규칙이다 — 클릭은 삭제 대상만 기억하고, 확인창에서 삭제한다.

## 체크리스트

- [ ] 파괴 동작만 확인창을 거치는가? 저장·제출은 즉시 실행인가?
- [ ] 클라이언트 사전 검증(정규식·required·길이)을 넣지 않았는가?
- [ ] 제목이 `{Action} {Entity}?` 인가? 버튼 라벨을 박지 않았는가?
- [ ] `danger` 에 빨간 버튼 + "cannot be undone" 경고가 있는가?
- [ ] 닫기 경로 넷이 같은 핸들러인가? 파괴 버튼의 클릭이 요청을 직접 보내지 않는가?
