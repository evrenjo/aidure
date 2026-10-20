---
name: form-validation-pattern
description: 폼 저장 오류 처리 공통 패턴 — 서버 검증 오류(errors[] 의 field·message)를 그 입력칸 아래 인라인으로 표시한다. 폼·드로어·다이얼로그에 생성/수정 저장을 붙이거나 "검증 오류가 안 보인다" 를 고칠 때 쓴다.
---

# 폼 검증 오류 처리 패턴

## 원칙

- **프론트는 유효성을 판정하지 않는다.** 필수·길이·형식은 서버 검증(예: Bean Validation `@Valid`)이 판정한다. 규칙을 두 곳에 두면 갈라진다.
- 서버 응답의 `errors` 배열을 받아 **해당 필드 아래에 인라인**으로 보인다.
- 입력칸이 막아도 되는 것은 **컬럼에 저장될 수 없는 키 입력**뿐 — `maxLength`(컬럼 길이), 숫자 칸의 문자, 소수 자릿수 초과.
- 확인창을 끼우지 않는다 — 저장은 즉시 mutate (확인창은 되돌릴 수 없는 동작만).

## 서버 오류 응답 — 먼저 프로젝트의 실제 모양을 확인한다

기존 API 의 검증 실패 응답을 한 번 열어 보고 그 모양을 따른다 (새 형식을 만들지 않는다). 흔한 모양 예:

```json
{ "message": "Validation failed", "errors": [{ "field": "orderNo", "message": "This field is required." }] }
```

모양이 다르면(RFC 7807 `invalid-params`, 필드→메시지 맵 등) 아래 파서만 그 모양에 맞춘다. **파서는 공용 유틸 한 곳**(`extractApiError(error)` 같은)에 두고 화면마다 새로 짜지 않는다.

## 구현 절차

아래 코드의 `usePageAlert` · `pushToast` · `extractApiError` · `Input` 은 예시 이름이다 — 프로젝트의 공용 배너 훅·토스트 헬퍼·오류 파서·입력 컴포넌트로 바꿔 쓴다. 알림 위치 원칙은 frontend 레이어 알림 룰.

### 1. 필드 오류 state

```tsx
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
```

### 2. 오류 핸들러 — 필드 오류는 인라인, 나머지는 배너

```tsx
const alert = usePageAlert(isOpen)          // 패널이면 isOpen 을 리셋 키로

const handleError = (error: unknown) => {
    const { errors, code } = extractApiError(error)
    const mapped: Record<string, string> = {}
    for (const e of errors ?? []) if (e.field) mapped[e.field] = e.message
    if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped)
        alert.clear()                        // 앞 시도의 배너가 새 인라인 오류와 겹치지 않게
        return
    }
    // field 없이 메시지만 온 경우 · 5xx — 배너 (401/403 은 전역 처리가 맡으므로 showApiError 가 건너뛴다)
    alert.showApiError(error, 'Failed to save.')
}
```

- 필드가 특정되지 않는 오류를 **아무것도 안 띄우고 버리지 않는다** — 거부된 저장이 조용히 사라진다.
- 성공은 토스트로 알리고, 그 앞에서 배너를 지운다.
- 표의 **행 안 버튼**이 부른 저장이면 배너 대신 오류 토스트 — 배너 자리가 화면 밖이다.

### 3. mutation 에 연결

```tsx
const { mutate, isPending } = useMutation({
    ...updateOrderMutation(),                // 생성된 mutation 옵션
    onSuccess: () => { alert.clear(); pushToast.success('Order saved.'); onClose() },
    onError: handleError,
})
```

### 4. 입력이 바뀌면 그 필드 오류만 지운다

```tsx
const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
        setFieldErrors((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
        })
    }
}
```

### 5. 제출할 때 기존 오류를 비운다

```tsx
<Button loading={isPending} onClick={() => { setFieldErrors({}); mutate({ body: { ...form } }) }}>
    Save
</Button>
```

### 6. 입력칸 아래 표시 — 접근성까지

```tsx
<label htmlFor="order-edit-title">Title</label>
<Input
    id="order-edit-title"
    invalid={!!fieldErrors.title}            // 공용 Input 이 aria-invalid 를 세운다
    aria-describedby={fieldErrors.title ? 'order-edit-title-error' : undefined}
    value={form.title}
    onChange={(e) => handleChange('title', e.target.value)}
/>
{fieldErrors.title && (
    <p id="order-edit-title-error" className="mt-1 text-xs text-red-500">{fieldErrors.title}</p>
)}
```

- `invalid` prop 이 없는 컴포넌트(날짜 선택기 등)는 메시지만 아래에 붙인다.
- 서버 필드 이름이 중첩(`items[0].qty`)이면 표 편집처럼 필드 슬롯이 없는 경우다 — 그 행에 표시하거나 배너로.
- 문구 없는 클라이언트 규칙(`required: true`)을 두지 않는다 — 빈 메시지로 붉은 칸만 남는다.

## 검증 (이 패턴을 붙인 화면)

입력 가능한 컨트롤마다 세 케이스를 돌린다: **입력**(저장값이 그대로 남는가) · **미입력**(필수면 그 필드 안내 + 저장 차단, 선택이면 기본값) · **초과**(컬럼 길이·정밀도 초과 → 400 + 그 필드 인라인이어야 한다. **500 이면 서버 Form 에 길이·자릿수 검증이 빠진 것**). 필수 여부는 화면의 `*` 가 아니라 서버 검증 선언과 DB `NOT NULL` 로 먼저 확정한다.
