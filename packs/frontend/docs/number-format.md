# 숫자·금액·비율 표시와 숫자 입력칸

## 표시 — 공용 포맷터 의무

숫자를 화면에 보일 때는 프로젝트의 공용 포맷터 모듈만 쓴다. 컴포넌트 안에서 `Intl.NumberFormat` 을
새로 만들거나 `toFixed` + `$`·`%`·콤마 접합을 하지 않는다 — 화면마다 형식이 갈린다.

**표시 자릿수는 그 값을 저장하는 컬럼의 scale 을 따른다.** scale 이 다른 값이면 포맷터를 나눈다.

| 유형 | 함수 예 | 출력 예 | 규칙 |
|---|---|---|---|
| 통화(가격, `DECIMAL(x,2)`) | `formatCurrency` / `<CurrencyText>` | `$35,026.00` · 음수 `($87,328.00)` 빨강 | 기호 + 콤마 + 항상 소수 2자리. 음수는 괄호+절대값, 색은 표시 컴포넌트가 입힌다(포맷터는 문자열만) |
| 통화(원가, `DECIMAL(x,3)`) | `formatCost` / `<CostText>` | `$1.079` | 소수 3자리 |
| 계수(`DECIMAL(8,7)`) | `formatFactor` | `0.5986000` | 기호 없음, 소수 7자리 |
| 수량·카운트 | `formatNumber` | `29,100` | 콤마, 소수 0, 기호 없음 |
| 비율 | `formatPercent` / `formatPercent2` | `34.0%` / `69.45%` | 자릿수를 함수로 고정 |

- 읽기 통화 셀은 표시 컴포넌트(예: `CurrencyText`)를 쓴다. 색이 필요 없는 순수 문자열 자리만 포맷터 직접.
- 빈 값(`null`/`undefined`/`''`) → `-`. 숫자로 못 읽는 값 → 원문 그대로(데이터 손실 방지).
- **표시에만** 적용한다 — 저장·전송 값은 raw.
- **식별자(주문 번호·ID·코드)에는 포맷을 적용하지 않는다.**
- 조건부 소수(`.00` 숨김)·천 단위 나누기 같은 변형을 두지 않는다 — 통화 규칙은 하나.

```tsx
// React 예시 — 포맷터 모듈 경로는 프로젝트마다 다르다
import { formatCurrency, formatPercent } from '@/utils/format'

<Field label="Regular Price" value={formatCurrency(summary.regularPrice)} />
<Field label="Commission" value={formatPercent(summary.commissionRate)} />
cell: (p) => <span>{formatCurrency(p.row.original.currentPrice)}</span>
```

## 금지 — 린트로 막는다

```tsx
// React 예시
const f = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })   // (X)
<span>${Number(v).toFixed(2)}</span>                                               // (X)
<span>{v}%</span>                                                                  // (X)
<span>{formatCurrency(v)}</span>                                                   // (O)
```

ESLint 를 쓰면 `no-restricted-syntax` 로 `NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']` 를 error 로 두어 새 위반을 커밋 단계에서 막는다.

## 날짜·시각

- 공용 날짜 포맷터 하나(날짜 · 날짜+시각 · 상대 시각 정도로 종류를 정해 둔다). 화면에서 형식 문자열을 새로 쓰지 않는다.
- **기준 시간대를 정해 둔다** — 서버 시각을 사용자 로컬로 바꿔 보일지, 업무 기준 시간대로 보일지를 프로젝트에서 한 번 정하고 전 화면이 따른다.
- 저장·전송은 ISO 8601(시간대 포함) raw. 날짜만 있는 값을 `Date` 로 바꾸면 시간대 때문에 하루가 밀릴 수 있다 — 날짜 전용 값은 문자열 그대로 다룬다.

## 입력칸 — 공용 숫자 입력 컴포넌트

가격·원가·수량을 **입력받는 칸**은 공용 숫자 입력 컴포넌트 하나로 그린다. 입력칸도 읽기 표시와 같은 형식으로 보여야 한다 — raw 로 두면 저장값 `12.50` 이 `12.5`, `10000` 이 콤마 없이 보인다.

| kind | 정수/소수 기본 | blur 시 | 예 |
|---|---|---|---|
| `price` | 3 / 2 | 소수 0 채움 + 콤마 | `9.9` → `9.90` |
| `cost` | 4 / 3 | 〃 | `1234.5` → `1,234.500` |
| `units` | 9 / 0 | 콤마 | `10000` → `10,000` |
| `plain` | 필드별 | 자릿수 차단만 | — |

- **자릿수는 필드마다 저장 컬럼 정밀도로 지정한다** — kind 기본값을 믿지 않는다(`DECIMAL(5,2)` → 3/2, `DECIMAL(6,4)` → 2/4).
- 넘치는 자릿수는 **타이핑·붙여넣기 시점에 막는다**(반올림하지 않는다). 적게 친 값은 0 으로 채워 보인다(오류 아님).
- 입력 중에는 소수가 덜 보여도 된다. 포커스 중에는 외부 값 변경이 타이핑을 덮어쓰지 않는다.
- `type="number"` 를 쓰지 않는다(콤마 불가) — `type="text"` + `inputmode="decimal"`. 칸 안에 `$`·`%` 를 넣지 않는다.
- 값은 `number | null`(빈칸 = `null`, 0 과 구분).

**서버는 두 번째 겹이다** — DB 는 scale 초과를 조용히 반올림하고, 정수부 초과는 numeric overflow 로 **500** 을 낸다. 저장 Form 에 자릿수 검증(예: `@Digits`)을 둬서 400 + `errors[]` → 그 입력칸 아래 인라인이 되게 한다. 판정은 서버, 입력칸은 컬럼이 담을 수 없는 키 입력만 막는다.

## 체크리스트

- [ ] 금액·비율 표시에 공용 포맷터를 썼는가? 인라인 `Intl.NumberFormat`·수동 접합이 없는가?
- [ ] 자릿수가 저장 컬럼 scale 과 같은가?
- [ ] 식별자에 통화 포맷을 적용하지 않았는가?
- [ ] 편집칸은 공용 숫자 입력 컴포넌트이고 자릿수를 필드별로 줬는가? 서버 Form 에 자릿수 검증이 있는가?
