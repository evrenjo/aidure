# db 팩 근거 자료

`db` 팩 룰의 근거와 룰별 대응표. 룰을 고칠 때 여기 자료와 맞는지 먼저 보고, 근거가 바뀌면 이 표도 함께 고친다. (조사 2026-09)

- 1부: 자료 목록 (ID · 제목 · URL · 한 줄 요지)
- 2부: 룰별 근거 — 룰의 각 항목이 어느 자료에 기대는지
- 3부: 자료끼리 대조 — 서로 다른 말을 하는 곳과 이 팩의 선택

## 1부. 자료 목록

### 무중단 스키마 변경

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| Z1 | Danilo Sato, *Parallel Change* (martinfowler.com bliki, 2014) | https://martinfowler.com/bliki/ParallelChange.html | 호환을 깨는 변경을 expand → migrate → contract 세 단계로 |
| Z2 | Pete Hodgson, *Expand/Contract: making a breaking change without a big bang* (2023) | https://blog.thepete.net/blog/2023/12/05/expand/contract-making-a-breaking-change-without-a-big-bang/ | 양쪽 쓰기 → 백필 → 읽기 전환 → 축소. 각 단계는 앞 단계와 호환이라 따로 배포·되돌리기 가능. 반쯤 끝난 이행은 부채. 다운타임이 허용되면 굳이 안 써도 된다 |
| Z3 | GitLab, *Avoiding downtime in migrations* | https://docs.gitlab.com/development/database/avoiding_downtime_in_migrations/ | 컬럼 삭제 3릴리스(무시 → 삭제 → 무시 해제, ORM 컬럼 캐시 때문), 이름·타입 변경은 임시 컬럼+트리거 후 정리, 기본값 변경 2릴리스(ORM 기본값 캐시), 테이블 삭제 전 외래키 하나씩 제거, 정수 키→64비트 4릴리스, JSON 스키마 속성 추가·삭제 순서 |
| Z4 | GitLab, *Migration style guide* | https://docs.gitlab.com/development/migration_style_guide/ | 되돌릴 수 있어야 함, 일반(≤3분)·배포 후(≤10분)·백그라운드 구분, 큰 테이블엔 잠금 재시도, 트랜잭션당 외래키 하나, 다운타임 요구 금지 |
| Z5 | GitLab, *Batched background migrations* | https://docs.gitlab.com/development/database/batched_background_migrations/ | 대량 데이터는 묶음·자동 스로틀·재시도 멱등, 스키마 변경과 섞지 말고 완료 확인 후 기대라 |
| Z6 | GitLab, *Iterating tables in batches* | https://docs.gitlab.com/development/database/iterating_tables_in_batches/ | OFFSET 대신 키 범위, 반복 컬럼 인덱스 필수, 비유일 컬럼은 무한 반복 위험, 묶음 100~1000 행 |
| Z7 | GitLab, *Adding database indexes* | https://docs.gitlab.com/development/database/adding_database_indexes/ | 실행 계획으로 필요 확인, 인덱스마다 쓰기 비용, 동시 생성, 큰 테이블은 비동기 생성, 유일 인덱스와 NULL, 미사용 인덱스 제거, 명시적 이름 |
| Z8 | GitLab, *Foreign keys and associations* | https://docs.gitlab.com/development/database/foreign_keys/ | 외래키 컬럼 인덱스 필수(없으면 부모 삭제마다 전체 훑기), 검증 없이 추가 → 정리 → 검증, 양쪽 테이블 잠금·잠금 순서, 앱 레벨 연쇄 삭제보다 DB 연쇄 |
| Z9 | GitLab, *NOT NULL constraints* | https://docs.gitlab.com/development/database/not_null_constraints/ | 릴리스 N: 모든 쓰기 경로가 값 채움 + 백필 / N+1: 확인 후 제약 |
| Z10 | GitLab, *Strings and the text data type* | https://docs.gitlab.com/development/database/strings_and_the_text_data_type/ | 길이 제한은 타입보다 검증 지연 가능한 CHECK 로 (잠금이 약하다) |
| Z11 | GitLab, *Delete existing migrations* | https://docs.gitlab.com/development/database/deleting_migrations/ | 마이그레이션은 지우지 말고 no-op 으로 비우고 이유를 남긴다 |

### 위험 작업 목록 (린터)

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| L1 | strong_migrations | https://github.com/ankane/strong_migrations | 컬럼 삭제·타입·이름 변경·외래키·CHECK·유일 제약·휘발성 기본값·NOT NULL·enum 이름 변경·백필 등 위험 작업과 대안. 잠금 대기 10초·실행 제한 1시간 권장, 앱 쿼리 타임아웃, 잠금 재시도, 실패 인덱스 제거, 복합 인덱스는 3컬럼 이내 |
| L2 | Squawk rules | https://squawkhq.com/docs/rules | PostgreSQL 린트 규칙 40여 개 — 잠금·실행 제한 요구, 동시 인덱스, NOT VALID, 컬럼·테이블 삭제·이름 변경, 64비트 키, identity, timestamptz, 스키마 명시 |
| L3 | Squawk, *require-timeout-settings* | https://squawkhq.com/docs/require-timeout-settings | 마이그레이션 앞에 잠금 대기·실행 제한 설정 |
| L4 | Squawk, *prefer-robust-stmts* | https://squawkhq.com/docs/prefer-robust-stmts | 트랜잭션이 없으면 `IF NOT EXISTS`/`IF EXISTS` 로 재시도에 안전하게 |
| L5 | Squawk, *adding-foreign-key-constraint* | https://squawkhq.com/docs/adding-foreign-key-constraint | 외래키 추가는 양쪽 테이블 쓰기 차단 → NOT VALID 후 따로 VALIDATE |
| L6 | Squawk, *prefer-bigint-over-int* | https://squawkhq.com/docs/prefer-bigint-over-int | 32비트 키는 넘친다 → 64비트 |

### 마이그레이션 도구

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| T1 | Redgate Flyway, *Migrations* | https://documentation.red-gate.com/fd/migrations-271585107.html | 버전 마이그레이션은 한 번·수정하지 않음(이력 테이블), 반복 마이그레이션은 내용이 바뀌면 다시 적용(뷰·프로시저), 기본적으로 마이그레이션마다 트랜잭션 |
| T2 | Redgate, *Flyway's Validate Command Explained Simply* | https://www.red-gate.com/hub/product-learning/flyway/flyways-validate-command-explained-simply/ | 적용된 파일 체크섬이 바뀌면 validate 실패 |
| T3 | Redgate, *Flyway's Repair Command Explained Simply* | https://www.red-gate.com/hub/product-learning/flyway/flyways-repair-command-explained-simply/ | repair 는 이력 테이블의 체크섬을 현재 파일에 맞춘다 — 강제로 덮는 명령 |
| T4 | Liquibase, *How to Handle Changing Liquibase Changesets* | https://www.liquibase.com/blog/dealing-with-changing-changesets | 배포된 changeSet 은 고치지 말고 새 changeSet 으로 앞으로(roll forward). 예외: runOnChange(뷰·프로시저), validCheckSum, 조건부 보정 changeSet |
| T5 | Liquibase, *OneChangePerChangeset* 정책 | https://docs.liquibase.com/secure/user-guide-5-0/policy-check-library/onechangeperchangeset | changeSet 하나에 변경 하나 — 자동 커밋 문장이 실패해 어중간한 상태가 되는 것을 막는다 |
| T6 | Alembic, *Auto Generating Migrations* | https://alembic.sqlalchemy.org/en/latest/autogenerate.html | 자동 생성은 완전하지 않다 — 이름 변경은 삭제+추가로, 이름 없는 제약은 못 잡는다. 반드시 검토·제약에 이름 |
| T7 | Django, *Migrations* | https://docs.djangoproject.com/en/5.2/topics/migrations/ | 생성 결과 검토 후 모델과 함께 커밋, MySQL 은 DDL 트랜잭션 없음(실패 시 수동 정리), SQLite 는 복사 방식, 데이터 마이그레이션은 과거 시점 모델로·되돌리기 함수 제공, NOT NULL 필드는 추가 → 채움 → 조이기, squash 는 두 번에 걸쳐 |
| T8 | Rails Guides, *Active Record Migrations* | https://guides.rubyonrails.org/active_record_migrations.html | 커밋·운영 적용된 마이그레이션 수정 금지, 되돌릴 수 없으면 IrreversibleMigration, 마이그레이션에서 모델 클래스 쓰지 않기, 시드는 멱등(`find_or_create_by!`)·마이그레이션과 분리, 스키마 덤프 파일로 적재 |
| T9 | EF Core, *Applying Migrations* | https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying | 생성된 마이그레이션을 항상 검토·시험(이름 변경이 삭제로 나올 수 있다), 운영은 검토 가능한 SQL 스크립트(멱등 스크립트)나 번들로, 앱 기동 시 적용은 다중 인스턴스·권한·되돌리기 문제, 배포 계정과 앱 계정 분리 |
| T10 | EF Core, *Data Seeding* | https://learn.microsoft.com/en-us/ef/core/modeling/data-seeding | 시드는 있는지 확인 후 넣는 멱등 코드, 모델 관리 데이터는 고정 키 필요·키를 바꾸면 기존 행 삭제, 시드를 앱 정상 실행 경로에 두지 말 것(다중 인스턴스·권한) |
| T11 | Prisma, *Development and production* | https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production | 운영은 검토된 마이그레이션 적용만, 적용 후 파일 수정은 검사에서 막힘, 드리프트는 새 마이그레이션으로 맞춤 |
| T12 | Prisma, *Data migration (expand and contract)* | https://www.prisma.io/docs/guides/data-migration | 이름 바꾸기 = 확장·축소 두 마이그레이션, 옛 필드는 전환 동안 유지 |

### DBMS 공식 문서

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| D1 | MySQL 8.4, *Statements That Cause an Implicit Commit* | https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html | CREATE·ALTER·DROP·GRANT 등은 앞뒤로 암묵 커밋 — 롤백 불가 |
| D2 | MySQL 8.4, *Online DDL Operations* | https://dev.mysql.com/doc/refman/8.4/en/innodb-online-ddl-operations.html | 작업별 INSTANT/INPLACE/COPY 와 동시 DML 여부, ALGORITHM·LOCK 명시로 조용한 격하 방지, 메타데이터 잠금은 긴 트랜잭션을 기다린다, VARCHAR 길이 바이트 경계 |
| D3 | MySQL 8.4, *How to Minimize and Handle Deadlocks* | https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html | 교착은 재시도, 트랜잭션 짧게, 같은 순서로, 인덱스로 잠금 줄이기, 교착 기록 보기 |
| D4 | MySQL 8.4, *Transaction Isolation Levels* | https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html | 기본 REPEATABLE READ, 잠금 읽기·UPDATE·DELETE 의 갭 잠금, READ COMMITTED 는 갭 잠금 없어 교착 감소 |
| D5 | MySQL 8.4, *The ENUM Type* | https://dev.mysql.com/doc/refman/8.4/en/enum.html | 숫자 같은 값 혼동, 정렬은 내부 순번, 비엄격 모드에서 잘못된 값이 빈 문자열로 |
| D6 | MySQL 8.4, *DATE, DATETIME, TIMESTAMP* | https://dev.mysql.com/doc/refman/8.4/en/datetime.html | TIMESTAMP 는 세션 시간대 ↔ UTC 변환·2038 한계, DATETIME 은 변환 없음 |
| D7 | Oracle 19c, *Types of SQL Statements* | https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Types-of-SQL-Statements.html | DDL 앞뒤로 암묵 커밋 |
| D8 | Oracle 21c, *Database Concepts — Transactions* | https://docs.oracle.com/en/database/oracle/oracle-database/21/cncpt/transactions.html | 진행 중 DML 을 먼저 커밋하고 DDL 을 한 문장 트랜잭션으로 |
| D9 | Oracle 19c, *Managing Tables* | https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-tables.html | 온라인 재정의, 기본값 컬럼 추가의 메타데이터 처리, `ONLINE` 절, `SET UNUSED` 후 물리 삭제 |
| D10 | Oracle 19c, *DDL_LOCK_TIMEOUT* | https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DDL_LOCK_TIMEOUT.html | 기본 0 = 기다리지 않고 즉시 오류 |
| D11 | Microsoft Learn, *Perform index operations online* | https://learn.microsoft.com/en-us/sql/relational-databases/indexes/perform-index-operations-online | 오프라인 인덱스 작업은 배타 잠금, `ONLINE = ON` 은 동시 접근 허용(에디션 제한), 재개 가능 작업 |
| D12 | Microsoft Learn, *ALTER TABLE (Transact-SQL)* | https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql | 상수 기본값 NOT NULL 컬럼 추가는 메타데이터만(에디션), `ALTER COLUMN … ONLINE`, `WAIT_AT_LOW_PRIORITY`, Sch-M 잠금, `WITH NOCHECK` 은 신뢰되지 않는 제약 |
| D13 | Microsoft Learn, *SET TRANSACTION ISOLATION LEVEL* | https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql | 기본 READ COMMITTED(잠금 방식), `READ_COMMITTED_SNAPSHOT` 은 DB 설정·Azure SQL 기본 켜짐, 격리 수준과 무관하게 쓰기는 배타 잠금 |
| D14 | Microsoft Learn, *Dynamic Data Masking* | https://learn.microsoft.com/en-us/sql/relational-databases/security/dynamic-data-masking | 조회 결과만 가림, 관리자는 원본을 보고 추론 공격에 뚫린다 — 단독 보호 수단 아님 |
| D15 | Microsoft Learn, *Temporal Tables* | https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal/overview | 행 변경 이력을 자동 보관 — 감사·과거 시점 조회·실수 복구 |
| D16 | PostgreSQL, *Explicit Locking* | https://www.postgresql.org/docs/current/explicit-locking.html | 명령별 잠금 수준(ALTER TABLE 대부분 ACCESS EXCLUSIVE 등), 교착 예방은 같은 순서·트랜잭션 오래 열지 않기·재시도 |
| D17 | PostgreSQL, *Transaction Isolation* | https://www.postgresql.org/docs/current/transaction-iso.html | 기본 READ COMMITTED, 갱신 유실은 `FOR UPDATE`, REPEATABLE READ·SERIALIZABLE 은 40001 재시도 필수 |
| D18 | PostgreSQL, *Enumerated Types* | https://www.postgresql.org/docs/current/datatype-enum.html | 값 추가·이름 변경만 가능, 삭제·순서 변경 불가 |
| D19 | PostgreSQL, *Date/Time Types* | https://www.postgresql.org/docs/current/datatype-datetime.html | timestamptz 는 UTC 로 저장·세션 시간대로 표시, 시간대 없는 타입은 입력 시간대를 조용히 무시, 일광 절약에는 지역 이름 |
| D20 | PostgreSQL Wiki, *Don't Do This* | https://wiki.postgresql.org/wiki/Don%27t_Do_This | 시간대 없는 timestamp·BETWEEN 시각 범위·char(n)·근거 없는 varchar(n)·money·serial 피하기 |
| D21 | PostgreSQL, *Continuous Archiving and PITR* | https://www.postgresql.org/docs/current/continuous-archiving.html | 기본 백업 + WAL 보관으로 임의 시점 복구, 여러 백업 세트 유지 |
| D22 | MongoDB, *Schema Versioning Pattern* | https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/schema-versioning/ | 문서에 버전 필드, 코드가 여러 구조 처리, 점진 이행, 공존 중 인덱스 |
| D23 | MongoDB, *Specify Validation Level* | https://www.mongodb.com/docs/manual/core/schema-validation/specify-validation-level/ | moderate 는 새 문서·규칙에 맞는 문서만 검사 — 기존 컬렉션에 점진 도입 |
| D24 | MongoDB, *Index Builds on Populated Collections* | https://www.mongodb.com/docs/manual/core/index-creation/ | 시작·끝만 배타 잠금, 쓰기 많으면 느려짐, 유일 위반은 끝에서 발견돼 전체 실패 |
| D25 | SQLite, *ALTER TABLE* | https://www.sqlite.org/lang_altertable.html | 지원 작업 4가지, 나머지는 새 테이블 복사 12단계 절차 |

### 보안 · 개인정보 · 로그

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| S1 | OWASP, *SQL Injection Prevention Cheat Sheet* | https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html | 1차 방어는 파라미터화, 바인드 안 되는 식별자는 허용 목록, 이스케이프는 비권장, 최소 권한은 추가 방어 |
| S2 | OWASP, *Database Security Cheat Sheet* | https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html | 앱별·환경별 계정, 최소 권한, 관리자 계정 금지, 접속 정보를 소스에 두지 않기, 권한 주기 점검 |
| S3 | OWASP, *Logging Cheat Sheet* | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | 로그에서 빼거나 가릴 것 — 접속 문자열·비밀번호·토큰·세션 값·개인정보·결제정보 |
| S4 | NIST SP 800-122 | https://doi.org/10.6028/NIST.SP.800-122 | 개인정보는 필요한 만큼만 쓰고 보관, 비식별화 |
| S5 | GDPR 제5조 (gdpr-info.eu) | https://gdpr-info.eu/art-5-gdpr/ | 최소 수집(필요한 만큼), 보관 제한(목적에 필요한 기간만) |

### 운영 · 신뢰성

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| R1 | Google SRE Book, *Data Integrity* | https://sre.google/sre-book/data-integrity/ | "원하는 것은 백업이 아니라 복구", 복구를 계속 시험, 여러 겹(되살리기 기간 있는 삭제·백업·조기 탐지), 시점 복구 |
| R2 | AWS Well-Architected REL09-BP04 | https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_periodic_recovery_testing_data.html | 주기적 복구 시험으로 RPO·RTO 확인, "백업이 있다고 가정" 등 안티패턴 |
| R3 | HikariCP, *About Pool Sizing* | https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing | 작은 풀이 빠르다, 코어 수 × 2 + 디스크 수 출발점, 한 작업이 커넥션 여러 개를 쥐면 풀 교착 |
| R4 | PgBouncer, *Features* | https://www.pgbouncer.org/features.html | transaction 모드에서 SET·LISTEN·세션 잠금·PREPARE·임시 테이블 등 세션 기능이 깨진다 |
| R5 | brandur, *Soft Deletion Probably Isn't Worth It* (2022) | https://brandur.org/soft-deletion | 소프트 삭제는 조회 조건 누락·외래키 무력화·삭제 의무 이행 복잡 — 삭제 보관 테이블 대안 |
| R6 | Testcontainers, *Replace H2 with a real database for testing* | https://testcontainers.com/guides/replace-h2-with-real-database-for-testing/ | 메모리 DB 는 문법·기능이 달라 운영 오류를 못 잡는다 — 실제 DBMS 로 시험 |

### 에이전트 지침 사례

| ID | 자료 | URL | 요지 |
|---|---|---|---|
| A1 | Prisma, *AGENTS.md for Databases* | https://www.prisma.io/blog/agents-md-for-databases | 초기화·삭제는 명시적 확인 없이 하지 않음, 가드 프롬프트를 스스로 승인하지 않음, 접속 문자열은 환경 변수로만, 마이그레이션은 버리는 DB 에서 전체 이력을 돌려 본 뒤 제안 |
| A2 | jerdaw, *AGENTS.md Guidelines* (gist) | https://gist.github.com/jerdaw/3917eab775d3e4bbcf37928101fbc3db | 스키마 변경은 먼저 묻기, 운영 데이터 직접 수정 금지 |
| A3 | Atlan, *How to Write an AGENTS.md File* | https://atlan.com/know/how-to-write-agents-md/ | 금지: 운영 DB 에 마이그레이션 실행, 개인정보 컬럼 출력·테스트 픽스처 포함 |

## 2부. 룰별 근거

### `rules/10-db-safety.md` (always)

| 항목 | 근거 |
|---|---|
| 인스턴스·스키마 확정, 모호하면 묻기 | A1 · A3 (운영 오조작 금지), S2 (환경 분리) — 기존 팩 입장 유지 |
| 운영 직접 쓰기 금지 | A2 · A3 · T9 (운영 반영은 검토된 절차로) |
| 파괴적 변경은 건수·되돌릴 방법·건별 승인 | A1 · R1 · R2 |
| 마이그레이션 도구로만, 적용된 것 수정·삭제 금지 | T1 · T2 · T4 · T8 · T11 · Z11 |
| 확장 → 전환 → 축소 | Z1 · Z2 · Z3 · L1 · T12 |
| 잠금 대기 제한 · 묶음 처리 | L1 · L3 · Z4 · Z5 · Z6 |
| 바인드 파라미터 · 접속 정보 출처만 · 복사 시 가리기 | S1 · S2 · S4 · A1 |
| 쿼리와 건수로 근거 | 기존 팩 입장 (검증 가능성) |

### `rules/20-schema-change.md`

| 절 · 항목 | 근거 |
|---|---|
| §1 도구 식별 표 | T1 · T4 · T6 · T7 · T8 · T9 · T11 |
| §2 적용된 마이그레이션 수정 금지·강제 체크섬 명령 승인 | T1 · T2 · T3 · T4 · T8 · T11 |
| §2 지우지 말고 no-op | Z11 |
| §2 생성기 결과 검토 | T6 · T7 · T9 |
| §2 한 마이그레이션에 한 변경 | T5 · Z4 · Z5 |
| §2 제약·인덱스 이름 | T6 · Z7 |
| §2 되돌리기·되돌릴 수 없음 표시 | Z4 · T7 · T8 |
| §2 `IF NOT EXISTS` 로 재시도 안전 | L4 · D1 · T7 |
| §2 마이그레이션에서 현재 모델 쓰지 않기 | T7 · T8 |
| §3 따라오는 것 순서 | 기존 팩 입장 |
| §4 확장 → 전환 → 축소 표 | Z1 · Z2 · Z3 |
| §4 이름·타입 변경 = 삭제 | Z3 · L1 · T12 |
| §4 컬럼 삭제는 코드 먼저(무시 목록) | Z3 · L1 |
| §4 NOT NULL 순서 | Z9 · L1 · T7 |
| §4 기본값 변경 두 단계 | Z3 |
| §4 JSON 스키마·문서 필드 | Z3 · D22 · D23 |
| §4 반쯤 끝난 이행은 부채 · 다운타임 허용 시 생략 | Z2 |
| §5 짧은 잠금 대기 + 재시도 | L1 · L3 · Z4 · D10 · D12 |
| §5 트랜잭션당 큰 잠금 하나 · 외래키 양쪽 잠금 | Z4 · Z8 · L5 |
| §5 온라인 방식·옵션 명시 | D2 · D9 · D11 · D12 · L1 |
| §5 인덱스는 실행 계획으로 필요 확인 | Z7 |
| §5 긴 트랜잭션 뒤 대기 | D2 · D16 |
| §6 빈 DB + 운영 사본 양쪽 시험, 올림·내림 | A1 · Z4 |
| §6 암묵 커밋 DB 는 롤백 시험 불가 | D1 · D7 · D8 · T7 |
| §6 실행될 SQL 검토 | T9 · T7 (sqlmigrate) |
| §6 기동 시 적용 대신 배포 단계 | T9 · T10 |

### `rules/30-data-change.md`

| 절 · 항목 | 근거 |
|---|---|
| §1 건수·롤백 시험·건별 승인 | A1 · 기존 팩 입장 |
| §1 되돌릴 방법·PITR 범위 확인 | R1 · R2 · D21 |
| §2 키 범위, OFFSET 금지, 인덱스, 비유일 컬럼 주의 | Z6 |
| §2 묶음 크기는 시간 기준·스로틀 | Z5 · Z6 · L1 |
| §2 이어서 끝나게(재시도 멱등) | Z5 |
| §2 스키마 마이그레이션과 분리, 완료 확인 후 제약 | Z5 · Z9 · L1 |
| §2 앱이 먼저 새 규칙으로 써야 빈틈 없음 | Z2 · Z9 |
| §3 멱등·중복 방어 | Z5 · L4 · 기존 팩 입장 |
| §3 그 시점 스키마로 동작 | T7 · T8 |
| §4 0 이어야 정상인 검증 | 기존 팩 입장 · R1 (조기 탐지) |
| §5 여러 스키마 건너뛰기·운영은 별도 승인 | 기존 팩 입장 |
| §6 복구가 목표·복구 시험 기록 | R1 · R2 |
| §6 새 위치에 먼저 복구 | R2 |
| §6 덤프 취급 | S2 · S4 |

### `rules/40-access-and-data.md`

| 절 · 항목 | 근거 |
|---|---|
| §1 바인드 파라미터·이스케이프 비권장 | S1 |
| §1 식별자 허용 목록 | S1 |
| §1 로그에 바인드 값 남기지 않기 | S3 |
| §1 최소 권한은 추가 방어 | S1 |
| §2 계정 분리 표(앱·마이그레이션·사람·관리자) | S2 · T9 |
| §2 환경별 계정 | S2 |
| §2 접속 정보 출처만·커밋 시 교체 | S2 · A1 |
| §3 복사 시 가리기·최소 수집 | S4 · S5 · A3 |
| §3 동적 마스킹은 복사 대책 아님 | D14 |
| §3 가명의 일관성 유지 | 시험 정합을 위한 이 팩의 판단 (직접 근거 없음) |
| §4 보존 기한·삭제 의무가 사본까지 | S5 · R5 |
| §4 로그 가리기 | S3 |

### `rules/50-transactions-and-connections.md`

| 절 · 항목 | 근거 |
|---|---|
| §1 트랜잭션 짧게·외부 호출 금지 | D3 · D16 |
| §1 outbox 류 | 일반 설계 관행 — 프로젝트 방식 우선 (직접 인용 자료 없음) |
| §2 DBMS 별 기본 격리 수준 | D4 · D13 · D17. Oracle 행은 이번 조사에서 공식 문서로 직접 확인하지 못함(일반 지식) — 고치기 전에 확인 |
| §2 갱신 유실 방지(원자적 UPDATE·FOR UPDATE·버전) | D17 |
| §2 높은 격리 수준은 재시도 필수 | D17 |
| §3 같은 순서로 잠금·교착 재시도 | D3 · D16 |
| §3 인덱스가 잠금을 줄인다 | D3 · Z8 |
| §3 앱 쿼리 타임아웃 | L1 |
| §4 작은 풀·전체 커넥션 합계 | R3 |
| §4 커넥션 여러 개를 쥐는 경로는 풀 교착 | R3 |
| §4 트랜잭션 모드 풀러 뒤 세션 기능 | R4 |
| §5 시점은 시간대 붙은 형식·UTC | D19 · D20 · D6 |
| §5 지역 이름으로 변환 | D19 |
| §5 닫힌-열린 구간 | D20 |

### `rules/60-data-modeling.md`

| 절 · 항목 | 근거 |
|---|---|
| §1 64비트 키 | L6 · Z3 (64비트 전환 4릴리스) |
| §2 타입 표 (시간대·금액·문자열) | D19 · D20 · Z10 · D6 |
| §2 유일 제약과 NULL | Z7 |
| §3 enum 방식 비교 | D18 · D5 · L1 (enum 이름 변경 순서) |
| §4 외래키로 정합 | Z8 |
| §4 외래키 컬럼 인덱스 | Z8 |
| §4 ON DELETE 선택 | Z8 |
| §4 인덱스는 실행 계획으로, 복합 인덱스 앞 컬럼 | Z7 · L1 |
| §5 소프트 삭제의 대가·보관 테이블 대안 | R5 |
| §5 되살리기 기간 있는 삭제의 가치 | R1 (대조는 3부) |
| §6 공통 컬럼은 한 곳에서, 이력은 따로 | D15 · 이 팩의 판단 |

### `rules/70-seed-and-test-data.md`

| 절 · 항목 | 근거 |
|---|---|
| §1 기준 데이터·시드·테스트 데이터 구분 | T8 · T10 |
| §2 멱등 시드 | T8 · T10 |
| §2 기준 데이터 고정 키·키 변경 위험 | T10 |
| §2 마이그레이션 밖 수정은 덮어쓰임 | T10 |
| §2 시드는 앱 정상 실행 경로 밖 | T10 · T9 |
| §2 실패 무시 적재는 건수 확인 | 기존 팩 입장 (실측 경험) |
| §3 실제 DBMS 로 시험 | R6 · D25 (SQLite 차이) |
| §3 테스트 DB 는 마이그레이션으로 | A1 (전체 이력을 돌려 보기) · T8 |
| §3 개인정보 없는 픽스처 | A3 · S4 |

### `docs/*`

| 문서 | 근거 |
|---|---|
| `expand-contract-playbooks.md` | Z1~Z3 · Z8 · Z9 · L1 · T12 · D18 · D22 · D23 · D24 · D9 |
| `dangerous-operations.md` | L1 · L2 · L4~L6 · Z3 · Z4 · Z7 · Z8 · Z10 · T6 |
| `dbms-notes.md` | D1~D25 · R4. 첫 표의 SQLite·MongoDB 격리 수준 칸과 시점 타입 칸, Oracle 격리 수준·빈 문자열=NULL 은 공식 문서로 직접 확인하지 못함(일반 지식) |
| `backup-and-restore.md` | R1 · R2 · D21 · S2 |

## 3부. 자료끼리 대조

| 주제 | 자료마다 다른 점 | 이 팩의 선택 |
|---|---|---|
| 잠금 대기 제한 값 | L1 은 10초, L3 예시는 1초, Z4 는 점점 늘리는 재시도 | 숫자를 박지 않고 "수 초 + 재시도" 로 쓴다. 트래픽에 따라 다르다 |
| 백필 묶음 크기 | L1 예시 10,000행 + 짧은 쉼, Z6 은 100~1,000행, Z5 는 실행 시간 보고 자동 조절 | 행 수가 아니라 **한 묶음 수 초** 를 기준으로 재며 조절 |
| 컬럼 삭제 릴리스 수 | Z3 은 3릴리스(무시 → 삭제 → 무시 해제), L1 은 무시 → 배포 → 삭제 → 해제 | 핵심은 같다 — 코드 먼저, 삭제는 다음 릴리스. 무시 해제는 도구 있는 곳만 |
| 이름 바꾸기 단계 수 | Z3 은 트리거로 2릴리스, Z2·L1 은 앱 양쪽 쓰기로 4~5단계 | 양쪽 쓰기(앱) 또는 트리거(DB) 둘 다 허용, 작은 테이블·점검 허용 시 줄일지 사용자에게 |
| 적용된 마이그레이션 수정 | 대부분 금지(T1·T8·T11), T4 는 예외 수단(runOnChange·validCheckSum)을 둔다, T1 반복 마이그레이션은 바뀌면 다시 적용이 정상 | 금지가 기본. 반복 파일(뷰·프로시저)은 설계상 고치는 것, 강제 체크섬 명령은 승인 후 |
| 소프트 삭제 | R5 는 반대(대가가 크다), R1 은 되살리기 기간 있는 삭제를 방어 계층으로 권장 | 둘 다 싣는다 — 프로젝트 관례 우선, 새로 정하면 되살리기 요구와 보관 기간을 묻는다 |
| 기동 시 마이그레이션 적용 | T9 는 비권장이지만 잠금이 있어 허용 가능하다고 봄, T10 은 시드를 정상 실행 경로에 두지 말라 | 배포 단계 적용을 권하고, 기존 방식은 바꾸자고 제안만 |
| 외래키 사용 | Z8 은 DB 외래키 강하게 권장, 여러 DB 로 나뉜 곳은 대체 수단 | 기본은 외래키. 프로젝트가 도메인 간 외래키를 금지하는 등 관례가 있으면 그것이 먼저 |
| 문자열 길이 | Z10·D20 은 무제한 문자열 + CHECK 권장(PostgreSQL 사정), MySQL 은 인덱스 길이 한도·VARCHAR 경계(D2) | DBMS 공통 룰에는 "근거 없는 짧은 길이 금지" 만. DBMS 별 권장은 stack 팩 |
| 복합 인덱스 컬럼 수 | L1 은 비유일 인덱스 3컬럼 이내 권고, Z7 은 필요를 실행 계획으로 | 숫자 제한 대신 "실행 계획으로 확인, 앞쪽 컬럼 없는 조건엔 안 쓰인다" |
| 동적 데이터 마스킹 | D14 스스로 단독 보호 수단이 아니라고 밝힘 | 복사 대책으로 인정하지 않는다 (정적 가리기만) |
| Oracle DDL 잠금 대기 | 요약 자료 일부가 "무한 대기" 로 적었으나 D10 은 기본 0(즉시 오류) | D10(공식 파라미터 문서)을 따른다 |
