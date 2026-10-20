---
title: Spring 기본 규약
load: always
---

## Spring 기본 규약

backend 팩 원칙의 Spring·JPA·QueryDSL 적용분만 둔다. 응답·예외·메시지 형식은 정하지 않는다 — 프로젝트 기존 관례를 따른다(찾는 곳은 on-demand 룰 「Spring 기존 관례 찾기·입력 검증」).

- **트랜잭션** — 서비스 클래스에 `@Transactional(readOnly = true)`, 쓰기 메서드만 `@Transactional` 로 덮는다. DB 를 안 쓰는 서비스만 예외.
- **🚫 서비스에서 checked 예외(`BindException` 등)를 던지지 않는다** — `@Transactional` 은 기본적으로 **RuntimeException·Error 에만 롤백**한다. 오류를 돌려주면서 앞서 바꾼 데이터가 커밋된다. 프로젝트의 런타임 예외로 던진다(없으면 `rollbackFor` 를 명시하거나 사람에게 묻는다).
- **조회 수단은 순서대로** — ① 파생 쿼리 ② QueryDSL ③ 둘 다 불가일 때만 네이티브 SQL + 이유 주석 1줄. JPQL 문자열 `@Query` 는 쓰지 않는다. 네이티브가 이미 있는 클래스라는 것은 사유가 아니다.
- **리포지토리는 엔티티당 하나**, 호출부 없는 쿼리 메서드는 만들지 않는다. 같은 타입 인자가 줄줄이 이어지는 복합 자연키는 `record` 값 객체로 넘긴다.
- **QueryDSL bulk `update().execute()` 로 수정하지 않는다** — 영속성 컨텍스트를 우회한다. 수백~수천 행은 `saveAll` + `hibernate.jdbc.batch_size`, 1만 행 이상만 집합 SQL 예외(backend 팩 「데이터 접근」 대량 처리).
- **런타임에만 터지는 QueryDSL 형태는 검사기로 확인한다** — projection 인자 수·필드명, `DISTINCT` + 식 정렬: `node packs/stack-spring/bin/check-querydsl-projection-arity.js` · `node packs/stack-spring/bin/check-querydsl-distinct-order.js`. 컴파일·기동은 통과한다.
