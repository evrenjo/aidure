---
title: PostgreSQL 작업 규칙
load: always
---

## PostgreSQL 작업 규칙

- **DDL 도 트랜잭션에 묶인다.** 건수·영향 시험은 `BEGIN; … ; ROLLBACK;` 으로 한다. 예외: `CREATE/DROP INDEX CONCURRENTLY`·`VACUUM`·`CREATE DATABASE` 는 트랜잭션(·`DO` 블록·함수) 안에서 못 돈다.
- **`CONCURRENTLY` 가 중간에 실패하면 INVALID 인덱스가 남는다.** `DROP INDEX CONCURRENTLY` 후 다시 만든다.
- 확장(`pg_trgm` 등)은 **환경마다 설치 스키마가 다를 수 있다.** 연산자 클래스를 `public.gin_trgm_ops` 처럼 스키마를 박아 쓰기 전에 `SELECT extname, extnamespace::regnamespace FROM pg_extension;` 으로 확인한다.
- `SELECT DISTINCT` 에서 **ORDER BY 식은 select 목록에 있어야 한다** — 컬럼을 감싼 정렬식(`lower(col)`, `translate(…)`, `COLLATE`)은 컬럼이 목록에 있어도 거부된다. 쿼리 빌더로 짠 쿼리는 실행 때에야 드러난다.
- 사용 중인 큰 테이블의 `ALTER TABLE` 은 잠금 대기로 전체를 막을 수 있다 — `SET lock_timeout` 을 먼저 건다.
- 여러 스키마·백필·시퀀스·잠금 세부는 → `packs/stack-postgres/rules/20-sql-patterns.md`
