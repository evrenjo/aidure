# DBMS 별 차이 — 스키마 변경 · 잠금 · 트랜잭션 · 시간

`db` 팩 룰이 "DBMS 마다 다르다" 고 한 곳의 참고 표. **PostgreSQL 은 `stack-postgres` 팩이 정본**이라 여기서는 요약만 둔다.
버전마다 동작이 바뀌므로 **대상 DB 의 버전을 먼저 확인**하고, 표와 다르면 그 버전의 공식 문서가 우선이다.
전용 stack 팩이 있는 DBMS 는 그 팩 룰이 우선이다.

## 한눈에

| | PostgreSQL | MySQL·MariaDB (InnoDB) | Oracle | SQL Server | SQLite | MongoDB |
|---|---|---|---|---|---|---|
| DDL 이 트랜잭션에 묶이나 | 예 (일부 예외) | **아니오 — 암묵 커밋** | **아니오 — 암묵 커밋** | 예 | 예 (ALTER 제약 큼) | 스키마 없음 |
| 기본 격리 수준 | READ COMMITTED | REPEATABLE READ | READ COMMITTED | READ COMMITTED (잠금 방식) | SERIALIZABLE 에 가까움 | 문서 단위 원자성 |
| DDL 잠금 대기 제한 | `lock_timeout` | `lock_wait_timeout` (메타데이터 잠금) | `DDL_LOCK_TIMEOUT` | `LOCK_TIMEOUT`, `WAIT_AT_LOW_PRIORITY` | `busy_timeout` | — |
| 온라인 인덱스 생성 | `CONCURRENTLY` | 기본 INPLACE (동시 DML 허용) | `ONLINE` | `ONLINE = ON` (에디션 제한) | 없음 | 기본 (시작·끝만 배타 잠금) |
| 시점 타입 | `timestamptz` | `TIMESTAMP`(세션 시간대 ↔ UTC 변환, 2038 한계) / `DATETIME`(변환 없음) | `TIMESTAMP WITH TIME ZONE` | `datetimeoffset` / `datetime2` | 텍스트·숫자로 저장 | `Date`(UTC) |

## PostgreSQL

`stack-postgres` 팩 룰(`CONCURRENTLY`, `NOT VALID` → `VALIDATE`, 상수 기본값 컬럼 추가는 재작성 없음, `SET NOT NULL` 은 검증된 CHECK 로 훑기 생략, 확장 설치 스키마, 시퀀스 보정)을 따른다.
그 밖에 알아 둘 것:

- `ALTER TABLE` 대부분은 가장 강한 잠금을 잡는다. 앞의 긴 트랜잭션을 기다리는 동안 뒤의 조회까지 줄 선다.
- enum 값은 추가·이름 변경만 되고 삭제·순서 변경은 타입을 새로 만들어야 한다.
- 유일 인덱스는 기본적으로 NULL 여러 개를 허용한다(버전에 따라 `NULLS NOT DISTINCT` 옵션).
- REPEATABLE READ·SERIALIZABLE 은 직렬화 실패(SQLSTATE `40001`)를 낸다 — 트랜잭션 전체 재시도.

## MySQL · MariaDB (InnoDB)

- **DDL 은 앞뒤로 암묵 커밋**한다. 진행 중이던 트랜잭션도 커밋된다. 롤백으로 시험할 수 없다 → 복제본·로컬에서 먼저.
- `ALTER TABLE` 에 **`ALGORITHM=INSTANT|INPLACE` 와 `LOCK=NONE` 을 명시**한다. 명시하면 그 방식이 불가능할 때 느린 방식(COPY)으로 조용히 넘어가지 않고 오류가 난다.
- 대략의 동작 (8.x 기준, 버전 확인 필요):

  | 작업 | 방식 | 동시 쓰기 |
  |---|---|---|
  | 보조 인덱스 추가·삭제 | INPLACE | 허용 |
  | 컬럼 추가·삭제 | INSTANT (행 버전 수 한도·압축 테이블 등 제약) | 허용 |
  | 컬럼 이름 변경 (타입 동일) | INSTANT/INPLACE | 허용 (외래키가 걸린 컬럼은 제약) |
  | 컬럼 타입 변경 | **COPY** | **차단** |
  | `VARCHAR` 늘리기 | INPLACE — 단 길이 바이트 경계(255 바이트)를 넘으면 COPY | 허용 / 차단 |
  | NOT NULL 로 변경 | INPLACE (재구성, 엄격 SQL 모드 필요) | 허용 |
  | 외래키 추가 | `foreign_key_checks` 를 끈 경우에만 INPLACE, 아니면 COPY | — |
  | 기본키 추가 | INPLACE (재구성) / 삭제는 COPY | — |
  | 계산식 기본값·자동 증가·저장 생성 컬럼 추가 | 재구성 | 차단 |

- INPLACE·INSTANT 라도 **시작·끝에 메타데이터 잠금**을 잡는다. 그 테이블을 쓰는 긴 트랜잭션이 있으면 그 뒤에서 기다리고, 그동안 뒤의 조회가 줄 선다 → `lock_wait_timeout` 을 짧게.
- 큰 테이블은 외부 온라인 스키마 변경 도구(그림자 테이블 복사 방식)를 쓰는 조직이 많다. 프로젝트 방식을 따른다.
- REPEATABLE READ 에서는 잠금 읽기·UPDATE·DELETE 가 **갭(next-key) 잠금**을 잡아 교착이 늘 수 있다. READ COMMITTED 는 갭 잠금을 거의 안 잡는다. 격리 수준 변경은 앱 전체 결정이다.
- 교착은 한쪽을 끊어 푼다 — 재시도 코드 필요. 원인은 `SHOW ENGINE INNODB STATUS` 의 마지막 교착 기록으로 본다.
- ENUM 은 값 변경에 테이블 변경이 필요하고, 정렬이 내부 순번 기준이며, 엄격 모드가 아니면 잘못된 값이 빈 문자열로 들어간다.
- `TIMESTAMP` 는 세션 시간대 기준으로 UTC 변환·복원된다(세션 시간대가 바뀌면 읽는 값이 바뀐다). `DATETIME` 은 변환하지 않는다.

## Oracle

- **DDL 은 앞뒤로 암묵 커밋**한다. 진행 중 DML 이 먼저 커밋된다.
- `DDL_LOCK_TIMEOUT` 기본값은 0(기다리지 않음)이라, 테이블에 진행 중인 DML 이 있으면 DDL 이 **즉시 오류**로 끝난다. 짧은 대기 시간을 세션에 주고 재시도한다.
- 인덱스 생성·테이블 이동은 `ONLINE` 절로 동시 DML 을 허용한다. 구조를 크게 바꿀 때는 온라인 재정의(`DBMS_REDEFINITION`).
- 기본값이 있는 컬럼 추가는 최신 버전에서 메타데이터만 바꾼다(버전 확인).
- 컬럼 삭제는 `SET UNUSED` 로 즉시 숨기고, 한가할 때 `DROP UNUSED COLUMNS`.
- 빈 문자열을 NULL 로 취급한다 — 다른 DBMS 에서 옮긴 코드의 `= ''` 조건이 동작하지 않는다.

## SQL Server

- DDL 이 트랜잭션에 묶인다. `ALTER TABLE` 은 스키마 수정 잠금(Sch-M)을 잡아 그 테이블의 모든 접근을 막는다.
- 상수(실행 시점 상수) 기본값이 있는 NOT NULL 컬럼 추가는 에디션에 따라 **메타데이터만** 바꾼다. `NEWID()` 같은 값은 전체를 쓴다.
- 인덱스 생성·재구성은 `WITH (ONLINE = ON)` (에디션 제한). 재개 가능한 인덱스 작업도 있다. 온라인이어도 끝에 짧은 Sch-M 잠금이 필요하다.
- `ALTER COLUMN … WITH (ONLINE = ON)` 으로 타입·길이·NULL 여부를 온라인으로 바꿀 수 있다(제약 있음).
- 잠금 대기를 다루는 `WAIT_AT_LOW_PRIORITY` 옵션이 일부 작업에 있다.
- 제약을 `WITH NOCHECK` 로 추가하면 기존 행을 검사하지 않고 **신뢰되지 않은 제약**이 된다(최적화기가 무시). 나중에 `WITH CHECK CHECK CONSTRAINT` 로 검증해야 신뢰된다.
- 기본 READ COMMITTED 는 잠금 방식이라 읽기·쓰기가 서로 막는다. 스냅샷 방식(`READ_COMMITTED_SNAPSHOT`)은 DB 설정이며 Azure SQL 은 기본으로 켜져 있다 — 환경마다 동작이 다를 수 있다.
- 조회 결과만 가리는 동적 데이터 마스킹은 권한 있는 사용자·추론에 뚫린다. 복사본 보호 수단이 아니다.

## SQLite

- `ALTER TABLE` 은 테이블·컬럼 이름 변경, 컬럼 추가(제약 있음), 컬럼 삭제(참조가 없을 때)만 한다. 나머지는 공식 12단계 절차 — 외래키 검사 끄기 → 트랜잭션 → **새 테이블 만들기 → 복사 → 옛 테이블 삭제 → 이름 바꾸기** → 인덱스·트리거·뷰 재생성 → 외래키 정합 검사 → 커밋 — 로 한다(마이그레이션 도구가 흉내 낸다).
- 동시 쓰기는 한 번에 하나다. 잠금 대기는 `busy_timeout` 으로.
- 운영 DB 가 다른 DBMS 인데 테스트만 SQLite 로 하면 차이를 못 잡는다.

## MongoDB (문서 DB)

- 스키마가 강제되지 않으므로 "스키마 변경" 은 **코드와 데이터의 약속**이다. 확장 → 전환 → 축소를 코드 기준으로 한다.
- 스키마 버전 패턴: 문서에 버전 필드를 두고 코드가 옛·새 구조를 모두 처리하며 점진적으로 옮긴다. 공존 기간에는 쿼리·인덱스가 양쪽 필드 위치를 덮어야 한다.
- 검증 규칙을 기존 컬렉션에 붙일 때는 **새 쓰기·규칙에 맞는 문서의 갱신만 검사하는 수준**부터 시작할 수 있다.
- 인덱스 생성은 시작·끝에만 배타 잠금을 잡고 나머지는 쓰기와 나란히 돈다. 쓰기가 많으면 느려진다. 유일 인덱스 위반은 **생성이 끝날 때** 발견돼 전체가 실패한다 → 먼저 센다.
- 여러 문서를 바꾸는 작업은 기본적으로 문서마다 원자적이다. 묶음 전체의 원자성이 필요하면 트랜잭션(복제 세트 필요)을 쓰거나 멱등으로 짠다.
- 트랜잭션이 없으면 마이그레이션 실패가 절반만 적용된 상태를 남긴다 — 다시 돌려도 되게 짠다.

출처는 `packs/db/docs/SOURCES.md`.
