---
title: React 구조·쿼리·URL·폼·다이얼로그 구현
load: on-demand
when: React 화면 코드를 새로 쓰거나 고칠 때 (파일 추가·이동, TanStack Query 연동, URL 상태·폼·다이얼로그 구현 포함)
---

## 디렉토리 구조 (기준 모양)

| 디렉토리 | 역할 |
|---|---|
| `api/` (또는 설정된 생성 폴더) | OpenAPI 생성 코드 (TanStack Query 플러그인 포함). **직접 수정 금지** |
| `components/ui/` | 기본 UI (Button · Input · Dialog · Drawer …) |
| `components/shared/` | 앱 공용 (표 · 확인 다이얼로그 · 스켈레톤 · 알림 훅 …) |
| `components/layouts/` | 레이아웃 · 헤더·사이드바 |
| `configs/` · `constants/` · `store/` | 앱/라우트 설정 · 상수 · 클라이언트 전역 상태 |
| `utils/` · `utils/hooks/` | 유틸(포맷터 등) · 커스텀 훅 |
| `{{ws:vars.react.viewsDir}}/{도메인}/{모듈}/{화면}/` | 페이지 컴포넌트 (배치 원칙은 frontend 레이어) |

경로 별칭은 워크스페이스 설정 `vars.react.aliases` 에 적는다(기본 `@/` = `src/`).

## TanStack Query

```tsx
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getOrderOptions, getOrderQueryKey, updateOrderMutation } from '@/api/@tanstack/react-query.gen'

const { data, isLoading, isFetching, error } = useQuery({
    ...getOrderOptions({ path: { id } }),
    enabled: !!id,                           // 의존 조회
    placeholderData: keepPreviousData,       // 페이지 이동·재검색 때 직전 내용 유지 (오버레이는 isFetching)
})

const queryClient = useQueryClient()
const { mutate, isPending } = useMutation({
    ...updateOrderMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getOrderQueryKey({ path: { id } }) }),
})
```

- 응답 봉투 안의 실제 데이터 꺼내기는 공용 유틸 한 곳. 화면마다 `data?.data` 경로를 새로 짜지 않는다.
- 첫 조회 스켈레톤은 `isLoading`, 재조회 오버레이는 `isFetching && 이전 데이터 있음` 으로 가른다.
- 생성 옵션 이름·키 함수 이름은 생성기 설정에 따라 다르다 — 생성 폴더에서 실제 이름을 확인한다.
- 공용 폴더 배치 검사 (frontend 레이어 §파일 위치, 위반 0 이어야 정상):

```bash
node packs/stack-react/bin/check-shared-placement.js           # 역참조 · 한 곳 전용 · Used by 정합
node packs/stack-react/bin/check-shared-placement.js --list    # shared 파일별 소비처 표
node packs/stack-react/bin/check-shared-placement.js --scope <viewsDir 기준 경로>
```

## URL 상태 훅

공용 훅(예: `useUrlParams` — `get(key)` · `updateParams(updates, { replace? })` · `clearParams()`) 하나만 쓴다. React Router `useSearchParams` 의 setter 를 화면에서 꺼내면 ESLint error 로 막는다(읽기는 허용).

```ts
const { get, updateParams } = useUrlParams()
const page = Number(get('page')) || 1
const handleSizeChange = (size: number) => updateParams({ size, page: 1 })
const selectedTab = get('tab') || 'overview'    // 탭을 useState 로 복사하지 않는다
```

- 입력칸이 URL 을 따라오게: 적용된 조건 키(`appliedKey`)가 바뀌면 `useEffect` 로 다시 채우거나 폼 컴포넌트에 `key={appliedKey}`.

## 폼

- 간단한 폼은 `useState`, 복잡하면 폼 라이브러리(React Hook Form 등). 스키마 검증 라이브러리로 서버 규칙을 복제하지 않는다.
- 서버 오류를 필드에 붙이는 절차는 `form-validation-pattern` 스킬.

## 다이얼로그·알림 구현

- 확인창: 버튼 `onClick` 은 열림 state 만 바꾸고, `mutate` 는 `onConfirm` 에서만.
- 다이얼로그·드로어는 닫아도 마운트가 남는 구현이 많다 — 배너·폼 state 의 리셋 키로 `isOpen` 을 준다.
- 성공은 공용 토스트 헬퍼, 오류 배너는 공용 배너 훅. 화면에서 토스트 라이브러리를 직접 import 하지 않게 린트 경고를 둔다.
- 상세 페이지 고정 바는 `position: sticky` 공용 컴포넌트 하나(frontend 레이어). 바 높이가 화면마다 다르면 위 바의 실제 높이를 재서 아래 바의 `top` 으로 쓰는 훅을 둔다.
