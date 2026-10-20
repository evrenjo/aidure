# 파일 첨부 표준 패턴

**목적** — 첨부 조회를 항상 **첨부 그룹 ID 단일 축**으로 유지해 화면마다 조건이 갈리지 않게 하고, 취소 시 고아 파일을 0 으로 만든다.

## 원칙

1. **즉시 업로드 금지** — 파일은 폼의 client state 로만 보유한다. 부모 동작(OK · Save · Run) 전에는 서버에 영속화하지 않는다. 사용자가 취소하면 고아 파일 0건.
2. **부모 동작 때 두 번 호출** — ① 공용 업로드 API(`POST /attach-files`, 여러 건이면 `/attach-files/bulk`)로 올려 `attachFileGroupId` 를 받는다 ② 소유 엔티티 요청(create · run · save)은 그 ID 를 **JSON 본문**에 싣는다. 두 호출은 한 트랜잭션이 아니므로 ②가 실패하면 ①의 그룹이 소유자 없이 남는다(정리 작업은 선택).
3. **그룹이 유일 축** — 단건도 파일 1건짜리 그룹. 그룹 ID 는 never null. 소유 엔티티는 그룹 ID **한 컬럼만** 갖는다(개별 파일 ID 를 직접 들지 않는다). 파일 분류 코드는 선택 — 한 그룹 안 하위 구분이나 소유자 없는 전역 조회가 필요할 때만.
4. **조회는 항상 그룹 기준** — `findByGroup(groupId)`, 정렬 순서 오름차순. 화면별 조건 분기 금지.
5. **재사용 블록** — 프론트는 공용 업로드 컴포넌트(드롭존, 단일/다중, accept·크기 검증)가 파일을 상태로 들고 있다가 부모 동작 때 업로드. 백엔드는 첨부 서비스를 호출자 트랜잭션 안에서 재사용.

```tsx
// React 예시 (생성된 mutation 사용)
let attachFileGroupId: string | undefined
if (file) {
    const res = await uploadMutation.mutateAsync({ body: { file }, query: { classification: 'JOB_INPUT' } })
    attachFileGroupId = res?.data?.attachFileGroupId
}
await runMutation.mutateAsync({ path: { jobCode }, body: attachFileGroupId ? { attachFileGroupId } : {} })
```

## 두 업로드 경로

| 경로 | 방식 | 장단 |
|---|---|---|
| (A) atomic | 부모 엔드포인트가 multipart 로 파일까지 받는다 | 한 트랜잭션이라 고아가 없다. 엔드포인트마다 multipart 처리가 퍼진다 |
| (B) standalone | 공용 업로드 → 그룹 ID 반환 → 부모 JSON | 부모 API 가 평범한 JSON. 호출자가 그룹 ID 라이프사이클을 책임진다 |

단일 업로드는 1행(`id == groupId`, 정렬 0), 다중은 N행(파일별 ID, 공유 그룹 ID, 정렬 = index). 다운로드 `GET /attach-files/{id}/download`, 그룹 조회 `GET /attach-files/groups/{groupId}` 는 공통.

## 한도와 허용 확장자

- **용량 한도**는 설정 파일 고정 — 프레임워크가 컨트롤러 진입 전에 막으므로 413 으로 나간다. 한도 값을 문구에 싣는다.
- **허용 확장자와 다중 최대 개수는 코드 상수**로 둔다 — 운영 설정이 아니라 **그 파일을 읽는 코드와 짝**이다(CSV 파서 · 엑셀 파서 · 평문). 넓히면 업로드만 통과하고 처리 단계에서 깨지고, 좁히면 화면 `accept` 와 어긋난다. 확장자를 바꾸면 파서와 화면 `accept` 를 함께 고친다.
