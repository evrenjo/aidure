# 로딩 표시 (스켈레톤 · 오버레이 · 스피너)

## 기준 — 그 자리에 보여줄 이전 내용이 있는가

| 상황 | 표시 | 이유 |
|---|---|---|
| 첫 조회 · 탭 전환 | **스켈레톤** | 자리가 비어 있다. 들어올 레이아웃을 미리 보여주면 대기가 짧게 느껴지고 내용이 들어올 때 밀리지 않는다 |
| 페이지 이동 · 정렬/필터 변경 · 재검색 | **직전 내용 유지 + 오버레이** | 같은 자리를 교체한다. 읽던 것이 남고 높이가 그대로라 스크롤이 튀지 않는다 |
| 무한 스크롤로 덧붙일 때 | 새 자리에만 **스켈레톤** | 그 자리에는 이전 내용이 없다. 위쪽 목록은 그대로 |
| 제출·저장·삭제 등 블로킹 동작 | **버튼 스피너** | 격리된 짧은 동작 |

**페이지네이션에 스켈레톤을 쓰면 스크롤이 튄다** — 스켈레톤 행이 실제 행보다 낮아 페이지가 짧아지고, 브라우저가 스크롤을 끌어올렸다가 행이 도착하면 되돌린다(실측 예: `433 → 248 → 433`). 직전 행을 유지하면 한 값에 머문다.

`"Loading..."` 텍스트는 앱 초기화 화면 외에는 쓰지 않는다.

## 공용 표에서의 구현

공용 표 컴포넌트가 스스로 처리하게 만들면 화면에서 할 일이 없다. 핵심은 "로딩 중이고 새 행이 아직 없으면 직전 행을 계속 그린다" 이다.

```tsx
// React 예시
const keepingPreviousRows = data.length === 0 && Boolean(loading) && lastRowsRef.current.length > 0
const rows = keepingPreviousRows ? lastRowsRef.current : data
const showNoData = noData && !keepingPreviousRows      // 직전 행을 들고 있는 동안 빈 상태를 그리지 않는다

<Loading loading={Boolean(loading && rows.length !== 0)} type="cover">   {/* 재조회 */}
{loading && rows.length === 0 ? <TableRowSkeleton /> : …}                {/* 첫 조회 */}
```

- 화면에서 빈 상태를 계산할 때 로딩을 함께 본다 — "로딩 중이 아니고 0건".
- 공용 표를 쓰지 않는 표(트리 표 등)도 같은 처리를 직접 붙인다.

## 참고

- NN/G — Skeleton Screens 101: 레이아웃 맥락이 중요한 목록·대시보드에, 체감 개선 구간 약 0.4~3초
- NN/G — Skeleton Screens vs. Progress Bars vs. Spinners: 스피너는 격리된 짧은 블로킹 동작에
- Addy Osmani — Infinite Scroll without Layout Shifts: 들어올 자리를 확보해 레이아웃이 튀지 않게
