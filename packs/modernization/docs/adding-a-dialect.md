# 레거시 방언 추가하기

`bin/asis-dialect.js` 가 `bin/dialects/*.js` 를 **자동 등록**한다 (`_` 로 시작하는 파일은 공용 헬퍼라 제외).
새 언어(PL/I, RPG, Natural, PL/SQL 패키지 …)는 파일 하나를 추가하면 모든 도구(`asis-effects` · `asis-reads` ·
`asis-field-writes` · `asis-tobe-diff`)가 그 확장자를 읽는다.

## 모듈 인터페이스

```js
module.exports = {
  name: 'pli',                 // 식별자
  extensions: ['.pli', '.pl1'],// 소문자. 다른 방언과 겹치면 등록 시 예외
  unit: '프로시저',             // 출력 문구의 단위 이름 (함수 · 문단 …)
  label: 'pli',                // 헤더 `(파일명, label)` — 빈 문자열이면 생략
  writeTargets: '테이블',       // "쓰기 대상 (…)" 문구
  parse(file),                 // → ast
  closure(ast, entries),       // → { entry, entries, internal: Map(name→순번), external: Set, order: [] }
  effects(ast, clo),           // → [{ fn, seq, line, kind: 'INSERT'|'UPDATE'|'DELETE'|'FILE WRITE'…, record, tables: [], text }]
  reads(ast, clo),             // → [{ fn, seq, line, tables: [], where: [컬럼], order, via, sql }] (+ .unresolved: ['fn:line 이름'])
  fieldWrites(ast, clo, FIELD, { keep }),  // → [{ seq, fn, line, rec, how, expr }]  keep(레코드명) 필터는 선택
  conditionsAt(ast, fn, line), // → [{ kind, text, line, branch }] · 신뢰할 수 없으면 null
  conditionWarning(ast),       // (선택) 조건 스택을 못 믿는 이유 문구 또는 null
}
```

### ast 가 반드시 가져야 하는 것

| 필드 | 뜻 |
|---|---|
| `fns: Map(name → { name, start, end, calls: [{ name, line }] })` | 호출 단위와 줄 범위(1부터, 양끝 포함), 호출 간선 |
| `records: Map(name → { name, tables: [], columns: Map(field → column) })` | 레코드·파일 ↔ 테이블 매핑. 없으면 빈 Map (`--table` 이 동작하지 않을 뿐) |
| `lines` | 원문 줄 배열 |

## 구현 지침

- **읽기는 `latin1`** 로 한다 — 레거시 소스엔 비 UTF-8 바이트가 섞여 있고, UTF-8 로 읽으면 깨지거나 예외가 난다.
- **주석은 판정 전에 지운다.** 주석 처리된 SQL 을 세면 죽은 코드가 근거가 된다.
- **파싱 결과 0개면 빈 결과가 아니라 예외.** `packs/modernization/bin/dialects/_common.js` 의 `closure(ast, entries, { unit, normalize, hint })` 를 쓰면 이미 그렇게 한다.
- **여러 줄에 걸친 문장**은 이어 붙여(오프셋→원래 줄번호 표 유지) 판정한다. 동사와 테이블이 줄바꿈으로 갈라지는 일이 흔하다.
- **한 문장을 두 번 세지 않는다** (레코드 동사 + 같은 문장의 인라인 SQL).
- **예약어를 호출 대상으로 잡지 않는다** (인라인 `PERFORM VARYING` 같은 것).
- WHERE 좌변 컬럼은 `_common.whereColumns(sql)` 를 쓴다 (호스트 변수·SQL 주석 제외).
- 조건 스택을 정확히 못 내는 파일이면 `null` 을 돌려주고 `conditionWarning` 으로 이유를 말한다 — 틀린 스택보다 없는 편이 낫다.

## 테스트

`bin/fixtures/<방언>/` 에 작은 샘플을 만들고 `asis-parse.test.js` 에 검사를 추가한다. 최소한:
진입점 폐쇄(다중 진입점·폐쇄 밖 경고) · 쓰기 표 집합 · 여러 줄 SQL · 주석 속 SQL 무시 · 필드 쓰기 순서 · 읽기 WHERE · 0개 파싱 예외.
실 소스로는 **원래 손으로 확인한 사실**(쓰는 표 개수 등)을 한 번 대조해 본다.
