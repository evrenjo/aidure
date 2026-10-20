# UI 문구·오류 메시지·다국어 상세

요약 규칙은 `packs/frontend/rules/90-content-and-i18n.md`(문구·i18n)와 `packs/frontend/rules/40-feedback-ui.md`(오류 문구 자리). 출처는 `packs/frontend/docs/SOURCES.md`.
예시 문구는 영어 UI 기준이다. 프로젝트의 UI 언어·용어집이 먼저다.

## 1. 오류 메시지 쓰기

| 원칙 | 나쁜 예 | 좋은 예 |
|---|---|---|
| 무엇이 잘못됐고 무엇을 하면 되는지 | `Invalid input` | `Enter a date in the format MM/DD/YYYY` |
| 구체적으로 — 빈 값·길이·형식·범위를 가른다 | `This field is required` | `Enter the order quantity` / `Quantity must be 999 or less` |
| 라벨과 같은 말 | 라벨 "Ship date" / 오류 "Delivery day is wrong" | `Enter a ship date` |
| 쉬운 말, 내부 용어·코드 없음 | `ERR_CONSTRAINT_VIOLATION on column qty` | `Quantity must be a whole number` |
| 탓하지 않고 과장하지 않는다 | `You entered a wrong value!` | `Enter a number between 1 and 100` |
| 시스템 오류는 사용자가 할 수 있는 것을 | `500 Internal Server Error` | `We couldn't save your changes. Try again. If it keeps happening, share code 3f9a1c20 with support.` |

- 빈 필드는 **지시문**("Enter …", "Select …"), 제약 위반은 **설명문**("… must be …").
- `please`·`sorry`·`valid`·`invalid` 같은 빈말을 줄인다(GOV.UK). 톤은 차분하게.
- 필드 옆과 오류 요약의 문구는 **같게** 쓴다.
- 조치 가능한 링크(다시 시도·다른 방법)를 오류 자리에 둔다. 사라지는 토스트에 조치 링크를 담지 않는다.

### 언제 띄우나

| 시점 | 쓰는 곳 |
|---|---|
| 제출 때 | 기본. 서버 판정 결과를 필드별로 |
| 필드를 떠날 때(blur) | 형식이 분명한 필드(이메일·날짜)에서, 한 번 오류가 난 뒤 |
| 타이핑 중 | 비밀번호 요구 조건 체크 표시처럼 **도움**이 되는 경우만. 첫 글자에 오류를 띄우지 않는다 |
| 고치는 즉시 | 이미 뜬 오류는 조건을 만족하는 순간 지운다 |

> NN/g 는 이른 검증을 적대적이라 보고, web.dev(결제·주소 폼)는 실시간 피드백을 권한다. 둘을 합치면: **처음엔 기다리고, 오류가 난 뒤에는 즉시 반응한다.**

### 오류 요약

- 제출 오류가 둘 이상이거나 폼이 길면 폼 위에 오류 요약을 두고 포커스를 옮긴다. 각 항목은 그 필드로 가는 링크(복합 필드는 첫 칸, 라디오·체크박스는 첫 선택지).
- 페이지 제목 앞에 `Error: ` 를 붙이면 스크린리더가 바로 알린다(GOV.UK 패턴 — 프로젝트 관례가 있으면 따른다).
- 오류가 하나이고 폼이 짧으면 첫 오류 필드로 포커스를 옮기는 것으로 충분하다.

## 2. 버튼·라벨·빈 상태

- 버튼은 동사 + 대상: `Save changes`, `Delete order`, `Export CSV`. 제출 버튼에 단순 `Submit` 보다 결과를 말하는 라벨.
- 같은 동작은 앱 전체에서 같은 단어(Delete vs Remove 를 뜻으로 가른다면 그 기준을 용어집에).
- 빈 상태: 무엇이 없는지 + 왜일 수 있는지 + 다음 행동. 검색 결과 0건과 아직 데이터가 없는 것을 다른 문구로.
- 진행 문구는 구체적으로 — "Uploading 3 of 10 files" 가 "Processing…" 보다 낫다(Apple HIG).
- 날짜·숫자가 든 문장은 포맷터 결과를 자리표시자에 넣는다.

## 3. i18n

### 문자열

- 사용자에게 보이는 문자열은 번역 키로. `alt`·`aria-label`·`title`·placeholder·`<title>`·이메일·알림 제목까지.
- **한 문장 = 한 메시지.** 조각을 이어 붙이면 번역자가 어순을 바꿀 수 없다.

  ```
  (X) t('deleted') + ' ' + count + ' ' + t('items')
  (O) t('items.deleted', { count })   // "{count, plural, one {Deleted # item} other {Deleted # items}}"
  ```

- 복수형은 ICU MessageFormat·`Intl.PluralRules`. 언어마다 복수 범주 수가 다르다(영어 2개, 아랍어 6개).
- 성별·문법 형태가 갈리는 문장은 `select` 로.
- 번역 문자열 안에 HTML 을 넣지 않는다 — 라이브러리의 컴포넌트 보간(태그 자리표시자)을 쓴다. 번역 문자열을 `innerHTML` 로 넣는 것은 XSS 경로다.
- 키 이름은 위치가 아니라 뜻으로(`orders.list.empty`), 프로젝트 규칙을 따른다. 쓰지 않게 된 키는 지운다.
- 사용자 값(이름·주소)과 번역 문구를 구분한다 — 사용자 값은 번역하지 않는다.

### 레이아웃

- 번역문은 길어진다 — 버튼·탭·표 머리글에 고정 폭을 두지 않고 줄바꿈·말줄임을 허용한다(말줄임이면 전체 문구를 툴팁·`title` 로).
- 오른쪽→왼쪽(RTL) 언어: `<html dir="rtl">` 로 **마크업에서** 방향을 정한다(CSS 로 base direction 을 정하지 않는다). 스타일은 논리 속성(`margin-inline-start`·`inset-inline-end`·`text-align: start`). 방향을 뜻하는 아이콘(뒤로·앞으로)은 뒤집는다. 사용자 입력칸은 `dir="auto"`, 섞인 방향의 사용자 값은 `<bdi>` 로 격리.
- 글꼴은 대상 언어의 글리프를 갖췄는지 본다.

### 로캘 데이터

- 숫자·통화·날짜·상대 시간·목록·정렬은 `Intl`(`NumberFormat`·`DateTimeFormat`·`RelativeTimeFormat`·`ListFormat`·`Collator`)을 **공용 포맷터 안에서** 쓴다. 화면에서 직접 만들지 않는다(`number-format.md`).
- 로캘은 프로젝트가 정한 값을 넘긴다. 로캘 인자를 비우면 브라우저 기본값이 쓰여 사용자마다 형식이 갈린다 — 단일 로캘 앱이면 그 로캘을 고정하는 게 맞다.
- 통화 기호·소수 자리는 로캘이 아니라 **통화**가 정한다(`currency` 옵션). 금액의 통화를 로캘로 추측하지 않는다.
- 이름·주소는 나라마다 형식이 다르다 — 가능하면 이름 한 칸, 주소는 나라별 형식 또는 자유 입력. 라틴 문자만 허용하는 검증을 넣지 않는다.
- 전화번호·우편번호를 여러 칸으로 쪼개지 않는다(자동완성이 깨진다).

## 4. 날짜와 시간대

| 값의 종류 | 저장·전송 | 표시 |
|---|---|---|
| 일어난 순간(생성 시각·로그) | UTC 또는 오프셋 포함 ISO 8601 (`2026-09-29T14:03:00Z`) | 기준 시간대로 변환 |
| 미래의 약속(회의·마감 시각) | 시각 + IANA 시간대 ID (`America/New_York`) | 그 시간대 기준, 필요하면 사용자 시간대 병기 |
| 날짜만 뜻하는 값(생일·휴일·영업일) | `YYYY-MM-DD` 시간대 없음(floating) | 변환하지 않는다 |

- `new Date('2026-09-29')` 는 UTC 자정으로, `new Date('2026-09-29T00:00')` 는 로컬 자정으로 해석된다 — 날짜만 뜻하는 값을 `Date` 로 왕복시키면 하루가 밀린다. 날짜 전용 값은 문자열로 다루거나 전용 타입을 쓴다.
- 시간대는 오프셋(`+09:00`)이 아니라 IANA ID 로 다룬다(서머타임).
- 기준 시간대(사용자·업무 지역·서버)를 프로젝트가 하나로 정하고, 모호하면 화면에 시간대 약어를 붙인다.
- "오늘"·"이번 달" 경계는 어느 시간대 기준인지 정해 두고 서버와 같게.
