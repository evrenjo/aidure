# AS-IS 분석 도구 사용법

레거시(AS-IS) 소스에서 "어느 표에 쓰는가 / 어느 표를 어떤 조건으로 읽는가 / 한 컬럼이 어디서 어떤 값을 받는가" 를
손 grep 대신 기계적으로 뽑는 도구 모음이다. 전부 의존성 없는 Node (18+), `check-cobol-coverage.py` 만 Python 3.

## 설정 — `workspace.json` vars.asis

| 키 | 필수 | 뜻 |
|---|:---:|---|
| `asis.sourceRoot` | O | 레거시 소스 루트. 비우면 `repos` 의 `kind: "legacy"` 항목(+ 그 항목의 `sourceRoot` 하위경로)에서 채운다. 도구에 **파일명만** 줘도 이 아래에서 찾는다 (여러 곳에 있으면 후보를 보여주고 멈춘다) |
| `asis.viewDir` | | 레거시 DB 뷰 정의 폴더. `.sql`(CREATE VIEW) 또는 ` ```sql ` 블록을 담은 `.md` |
| `asis.viewVariant` | | viewDir 아래 하위 폴더 기본값 (국가·법인별로 뷰 정의가 갈릴 때). `--variant` 로 바꾼다 |
| `asis.mappingSources` | | 마이그레이션 스텝 YAML 파일·폴더 (쉼표 구분 문자열 또는 배열) |
| `asis.mappingCanonical` | | 같은 AS-IS 표를 여러 스텝이 읽을 때 우선할 정본 YAML **파일명** |
| `asis.tobeSchemaDir` | | TO-BE 실 DDL(`*.sql`) 폴더 — 매핑 대상표를 실재 테이블로 거른다 |
| `asis.tobeQueryTool` | | TO-BE 쿼리 조건 추출기. 비우면 `packs/stack-spring/bin/query-predicates.js` |

경로는 워크스페이스 루트 기준 상대 또는 절대. 워크스페이스 밖에서 돌리면 vars 없이 인자 경로만 쓴다.

## 명령

```bash
B=packs/modernization/bin
node $B/asis-effects.js <파일>                                  # 진입점 후보(아무도 안 부르는 것) 목록
node $B/asis-effects.js <파일> --entry <이름|라인>[,...] --tobe T1,T2   # 쓰기 폐쇄 + TO-BE 표 집합 대조
node $B/asis-reads.js   <파일>                                  # 읽기를 전부 덮는 최소 진입점 조합 추천
node $B/asis-reads.js   <파일> --entry <이름>[,...] [--table T] [--sql] [--cond]   # 읽는 표 + WHERE 컬럼
node $B/asis-field-writes.js <파일> --entry <이름> --field <필드> [--table T | --record R]   # 한 컬럼 쓰기 전수
node $B/asis-tobe-map.js <VIEW|TABLE>[.<COL>] [--where] [--variant v]   # AS-IS ↔ TO-BE 이름 잇기
node $B/asis-tobe-diff.js --asis <파일> --entry <이름> --tobe <TO-BE 쿼리 파일> [--method m]   # 조건 자동 대조
python3 $B/check-cobol-coverage.py <prog.cbl> [--paragraphs p1,p2 | --from a --to b] [--list] [--dead]   # 분기·SQL 계수, 죽은 단락·커서
node $B/asis-parse.test.js                                      # 회귀 테스트 (fixtures 만 쓴다)
```

공통 옵션: `--json`(기계 판독), `--opened a,b`(asis-effects — 이미 열어본 함수를 미개봉 목록에서 뺀다), `--calls`(호출 트리), `--cond`(실행 조건 스택).

## 출력 읽는 법 — 경고를 넘기지 않는다

| 표시 | 뜻 | 할 일 |
|---|---|---|
| `⚠ 폐쇄 밖 쓰기 N건` / `⚠ 폐쇄 밖 읽기 N건` | 진입점에서 닿지 않는 함수에 쓰기·읽기가 있다 | 진입점을 넓힌다. 이 상태로 "AS-IS 는 이 표에 안 쓴다" 고 판정하지 않는다 |
| `⚠ 정의 없는 레코드 참조` | 이 파일에 정의가 없는 레코드를 읽는다 | 그만큼 덜 세었다. 레코드 정의 파일을 찾아 본다 |
| `미개봉 함수 N/M` | 아직 사람이 안 연 함수 | `--opened` 로 넘기며 0 이 될 때까지가 "닫혔다" |
| `외부` | 이 파일에 정의가 없는 호출(CALL 등) | 다른 프로그램을 따로 분석한다 |
| `⚠ 가공식이라 1:1 이 아니다` | 뷰 컬럼이 식(연결·연산)이다 | 매핑을 값 단위로 따로 확인한다 |
| `⚠ 필터 조건 없음` (`--where`) | 그 뷰는 조인만 하고 행을 거르지 않는다 | 뷰 이름만 보고 필터가 있다고 가정하지 않는다 |
| `⚠ END-IF 가 완비되지 않았다` | COBOL 마침표 종료 IF 가 섞였다 | 조건 스택을 내지 않는다 — 조건은 손으로 본다 |
| 파싱 0개 예외 | 파서가 파일을 못 읽었다 | 방언·인코딩·키워드 대소문자를 확인한다. 0건을 "없다" 로 읽지 않는다 |

- 쓰기 순서는 호출 경로 DFS **근사**다 — 분기가 있으면 전부 실행되지는 않는다. **첫 대입이 최종값이 아니다.**
- `asis-tobe-diff` 결과가 같아도 동작이 같은 것은 아니다 — 분기·정렬·조인 방향은 직접 본다.

## 방언별로 세는 것

| | EGL (`.egl`) | COBOL (`.cbl` `.cob` `.cobol`) |
|---|---|---|
| 단위 | `Function` (대소문자 무관) | 문단·SECTION (`PERFORM A THRU B` 는 사이 문단까지) |
| 쓰기 | `add`/`replace`/`delete` 레코드 + `#sql{ insert/update/delete }` (한 문장은 한 번) | `EXEC SQL INSERT/UPDATE/DELETE` + 파일 `WRITE`/`REWRITE`(FD·ASSIGN 매핑) |
| 읽기 | 인라인 `#sql{select}` + 레코드 `defaultSelectCondition`(숨은 조건) 경유 `get`/`open` | 커서 선언(절차부 **밖**) 경유 `OPEN`/`FETCH` + 단건 `SELECT` + 파일 `READ` |
| 필드 쓰기 | `REC.F = 식;` · `set REC empty;` · `move A to REC;` | `MOVE`·`COMPUTE`·`ADD/SUBTRACT`·`INITIALIZE`·`SET` |
| 조건 스택 | `if`/`while` (항상) | `IF`/`EVALUATE` — END-IF 완비 파일에서만 |

COBOL 은 고정형식(1-6 시퀀스 · 7 지시자 · 8-72 코드)을 전제한다. 새 방언은 `docs/adding-a-dialect.md`.

## 매핑 입력 형식

**뷰 정의** — 파일 하나에 뷰 하나. 세 형태를 읽는다: `CREATE VIEW X(c1,c2) AS SELECT e1,e2 FROM …`(위치 대응) ·
`SELECT * FROM base`(pass-through) · `SELECT c1,c2 FROM base`(이름 그대로). `AS` 뒤 `SELECT`·`FROM`·`WHERE` 는 각자 줄을 시작한다.

```sql
CREATE VIEW SCH1.ITEMV(ID_ITEM, ID_PROF) AS
SELECT
    T1.ITEM_ID,
    T1.PROFILE_CD
FROM
    SCH0.ITEM T1
WHERE
    T1.DELETED_IN = ''
;
```

**마이그레이션 스텝 YAML** — 리스트 항목마다 `name`(끝에 `(AS-IS표)` 를 적으면 가장 확실히 잡힌다) · `target_table` · `source_sql: |-`.
`source_sql` 의 `<AS-IS 식> AS <tobe_column>` 줄이 컬럼 매핑이 된다 (상수·시각 줄은 뺀다).

```yaml
- seq: 1
  name: 'product: item_master (ITEM)'
  target_table: item_master
  source_sql: |-
    SELECT
      RTRIM(ITEM_ID) AS item_code,
      RTRIM(PROFILE_CD) AS profile_code
    FROM ITEM
```

같은 AS-IS 표를 여러 스텝이 읽으면 순위로 하나를 고른다: 정본 파일(`mappingCanonical`) → 제목이 `(AS-IS표)` 로 딱 맞음 →
제목에 표 이름이 나옴 → 조인·서브쿼리 없음 → 컬럼 수. `tobeSchemaDir` 에 없는 대상표는 다른 후보가 있으면 뺀다.

**TO-BE 쿼리 추출기** (`asis-tobe-diff` 용) — `<파일> --json` 에
`{"results":[{"method":"…","columns":["table.column",…],"raw":{"cols":["column",…]}}]}` 를 내면 된다.
Spring/QueryDSL 은 stack-spring 팩의 `query-predicates.js` 가 이 형식을 낸다.
