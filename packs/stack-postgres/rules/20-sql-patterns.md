---
title: PostgreSQL SQL 패턴과 함정
load: on-demand
when: PostgreSQL 에 DDL·백필·정리 SQL 을 쓰거나, 여러 스키마를 도는 스크립트·인덱스·시퀀스·확장을 다룰 때
---

## PostgreSQL SQL 패턴과 함정

### 1. 여러 스키마를 도는 SQL — `DO` 블록 + 없는 스키마 건너뛰기

```sql
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['app_dev', 'app_qa', 'app_prd'] LOOP   -- 환경 표의 스키마 전부
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s);
    EXECUTE format('ALTER TABLE %I.some_table ADD COLUMN IF NOT EXISTS note text', s);
  END LOOP;
END $$;
```

- 스키마·테이블 이름은 `format('%I', …)` 로 넣는다(따옴표·대소문자 처리). 문자열 연결로 만들지 않는다.
- `DO` 블록 전체가 한 트랜잭션이다 — 한 스키마에서 실패하면 전부 롤백된다. 스키마별로 따로 커밋해야 하면 블록을 나눈다.
- `CREATE INDEX CONCURRENTLY` 는 `DO` 안에서 못 돈다. 스키마마다 한 줄씩 펼쳐 쓰고, 없는 스키마는 실행 전 목록에서 뺀다.

### 2. `search_path` · 식별자

- `SET search_path` 는 세션 전체에 남는다. 스크립트 안에서만 바꾸려면 트랜잭션 안에서 `SET LOCAL search_path TO …`.
- 여러 스키마를 다룰 때는 `search_path` 를 바꿔 가며 돌리기보다 **스키마를 붙여** 쓴다(`app_qa.orders`).
- 따옴표 없는 식별자는 소문자로 접힌다. `"OrderId"` 처럼 따옴표로 만든 이름은 이후에도 따옴표가 필요하다.

### 3. 카탈로그로 확인한다

| 확인할 것 | 쿼리 |
|---|---|
| 스키마 존재 | `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'x'` |
| 컬럼 존재·타입 | `information_schema.columns` (`table_schema`, `table_name`, `column_name`) |
| 인덱스 정의 | `SELECT indexdef FROM pg_indexes WHERE schemaname = 'x' AND tablename = 't'` |
| INVALID 인덱스 | `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid` |
| 확장 설치 스키마 | `SELECT extname, extnamespace::regnamespace FROM pg_extension` |
| 테이블 소유자 | `SELECT tableowner FROM pg_tables WHERE schemaname = 'x' AND tablename = 't'` |

### 4. 잠금 · 큰 테이블 DDL

- `ALTER TABLE` 은 대부분 `ACCESS EXCLUSIVE` 잠금이다. 앞선 긴 트랜잭션을 기다리는 동안 뒤의 모든 조회도 막힌다 → `SET lock_timeout = '5s';` 로 걸고 실패하면 다시 시도한다.
- `ADD COLUMN … DEFAULT <상수>` 는 PostgreSQL 11 이상에서 테이블을 다시 쓰지 않는다. 휘발성 기본값(`random()`·`gen_random_uuid()`·`clock_timestamp()`)은 전체를 다시 쓴다(`now()` 는 휘발성이 아니다).
- `SET NOT NULL` 은 전체를 훑는다. 큰 테이블은 `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL`(12 이상은 검증된 CHECK 가 있으면 훑지 않는다) 순서로.
- 인덱스는 운영 중 테이블이면 `CREATE INDEX CONCURRENTLY` (트랜잭션 밖, 실패 시 INVALID 정리).
- 외래키는 `NOT VALID` 로 추가한 뒤 `VALIDATE CONSTRAINT` 로 나누면 쓰기 잠금 시간이 짧아진다.

### 5. 시퀀스

- 시퀀스는 트랜잭션 롤백에도 되돌아가지 않는다 — 번호 빈칸은 정상이다.
- id 를 직접 넣어 적재·복사했으면 시퀀스를 보정한다:
  `SELECT setval(pg_get_serial_sequence('app.orders', 'id'), (SELECT coalesce(max(id), 1) FROM app.orders));`
- 테이블과 함께 만든 시퀀스는 ORM 검증에 안 걸려도 채번에 필요하므로 스키마 반영 때 함께 옮긴다.

### 6. 백필 · 정리

- 중복 원본에서 한 건만 고를 때는 `DISTINCT ON (키) … ORDER BY 키, 우선순위` 가 가장 짧다.
- 멱등 적재는 `INSERT … ON CONFLICT (키) DO NOTHING` / `DO UPDATE`. 대상 키에 유니크 제약·인덱스가 있어야 한다.
- 대량 삭제·갱신은 키 범위로 나눠 여러 트랜잭션으로 돈다. 한 트랜잭션이 길면 WAL·잠금·복제 지연이 커진다.

### 7. 확장

- 확장은 DB 당 한 번, 한 스키마에만 설치된다. 설치 스키마가 `search_path` 에 없으면 그 함수·연산자 클래스를 못 찾는다.
- DDL 에 스키마를 박지 말고(`gin_trgm_ops`) 해당 스키마가 `search_path` 에 있는지 확인하거나, 환경마다 설치 스키마가 다르면 환경 표에 적는다.
- `CREATE EXTENSION` 은 권한이 필요하다(대개 DB 소유자·슈퍼유저). 권한 없는 환경은 담당자에게 요청한다.
