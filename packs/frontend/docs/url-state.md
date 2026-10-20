# 화면 상태를 URL 에 두는 규약

강제 장치: 화면 코드에서 라우터의 쿼리 **쓰기 API 를 직접 부르면 린트 error** 로 막고, 공용 URL 상태 유틸만 쓰게 한다. 읽기는 허용. 이 문서의 코드는 React 예시(`useUrlParams` 는 예시 이름)이며, 다른 프레임워크는 같은 역할의 서비스·컴포저블로 읽는다.

## 왜

| | 컴포넌트 상태 | URL |
|---|---|---|
| 뒤로가기 | 화면을 통째로 벗어난다 | 직전 페이지·탭으로 |
| 새로고침 | 1페이지로 | 보던 그대로 |
| 링크 공유 | 상대는 1페이지 | 같은 화면 |

로그인으로 튕겼다 돌아올 때 반환 주소는 경로만이 아니라 쿼리·해시까지 싣는다.

## 쓰는 법

```ts
// React 예시
import useUrlParams from '@/utils/hooks/useUrlParams'

const { get, updateParams } = useUrlParams()
const page = Number(get('page')) || 1
const pageSize = Number(get('size')) || DEFAULT_PAGE_SIZE
const handlePageChange = (p: number) => updateParams({ page: p })
const handleSizeChange = (size: number) => updateParams({ size, page: 1 })
```

- `get(key)` → `string | null`. 기본값은 읽는 쪽에서.
- `updateParams(updates, options?)` 는 합치기. 지우려면 `''`. `clearParams()` 는 전부 비우기(Reset — 키를 나열하면 나중 키를 놓친다).
- 목록을 좁히는 것(검색·필터·정렬·크기)을 바꾸면 `page: 1` 을 같이.
- 폼 동기 효과의 키에는 조건만 넣고 페이지·크기는 뺀다 — 넣으면 페이지를 넘길 때마다 입력 중인 값이 되돌아간다.

| 넣는다 | 넣지 않는다 |
|---|---|
| 페이지·크기, 정렬 키·방향, 검색어, 필터, 탭 | 서버 응답, 로딩 여부, 다이얼로그 열림, 선택된 행 |
| 화면 재현에 필요한 값 | 타이핑 중인 값 |

## push vs replace — 사용자가 한 행동인가

| replace | push |
|---|---|
| 화면이 스스로 채우는 기본값(비어 있을 때 기본 정렬 되써넣기) | 페이지 이동·크기 변경 |
| 진입 시 기본 기간 프리셋 | 정렬 클릭 · 필터 선택 |
| **타이핑 중 검색어** (한 글자마다 쌓이면 뒤로가기가 먹통) | **탭 전환** · **검색 확정 · Reset** |

## 함정

- **빈 문자열·숫자 0 은 삭제, 문자열 `'0'` 은 값** — 검색창의 0 을 삭제로 보면 조건이 안 실리고 전체 목록이 나오는데 입력칸엔 0 이 남아 걸린 것처럼 보인다.
- **기본값은 URL 에 쓰지 않는다** — `updateParams({ page: next > 1 ? next : '' })`, `updateParams({ tab: next === 'overview' ? '' : next })`.
- **한 화면에 표가 여럿이면 접두어** — 접두어를 받는 유틸(예: `useTableParams(prefix)`)로 `ovPage` · `stPage`. 같은 화면에서 접두어가 겹치면 탭 전환 때 서로의 페이지를 물려받는다.
- **입력칸은 URL 을 따라와야 한다**

```tsx
// React 예시
// (X) 마운트 때 한 번 — 뒤로가기에서 폼과 결과가 어긋난다
const [fields, setFields] = useState(() => readFromUrl())

// (O) 적용된 조건이 바뀌면 다시 채운다 (타이핑은 URL 을 안 바꾸므로 입력을 지우지 않는다)
const appliedKey = KEYS.map((k) => get(k) ?? '').join('|')
useEffect(() => { setFields(readFromUrl()) }, [appliedKey])
```

  폼이 별도 컴포넌트면 `key={appliedKey}` 재마운트도 같은 효과다.

- **탭을 별도 상태로 복사하지 않는다**

```tsx
// React 예시
const selectedTab = get('tab') || 'overview'
const setSelectedTab = (next: string) => updateParams({ tab: next === 'overview' ? '' : next })
```

## 대상이 아닌 것

| 대상 아님 | 이유 |
|---|---|
| 다이얼로그 안의 페이지·검색 | 뒤로가기 대상이 아니고 부모 URL 을 오염시킨다 |
| "더 보기" 누적 카운터 | 페이저가 아니다. URL 에 넣으면 뒤로가기가 목록을 잘라낸다 |
| 선택 행·열림 여부·로딩 | 화면을 재현하는 값이 아니다 |
| 검색 후 그 자리에서 편집하는 화면 | 뒤로가기가 조건을 바꾸면 미저장 편집이 날아간다 |
| 검색이 변경 미리보기인 화면 | 입력값이 필터가 아니라 적용할 새 값이다 |
| 전 행을 한 번에 보이는 상세 표 | 페이지 상태가 없다 |

읽기 전용으로 파라미터를 받는 곳(딥링크 수신 등)은 라우터의 읽기 API 를 그대로 써도 된다. 이 규약은 **쓰는 쪽**에 대한 것이다.

## 검증

- 린트로 화면 폴더를 돌려 쓰기 API 직접 호출이 0 인지 본다.
- 라우터 쿼리 API 를 grep 해 남은 것이 전부 읽기 전용인지 본다 (React Router 예: `useSearchParams`).
