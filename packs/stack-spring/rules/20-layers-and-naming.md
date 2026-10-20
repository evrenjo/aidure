---
title: Spring 패키지 구조·이름·Javadoc
load: on-demand
when: Spring 백엔드에 클래스·패키지를 새로 만들거나, 메서드 이름을 짓거나, Javadoc 을 달 때
---

계층·소유자 이름·주석 분량 원칙은 backend 팩 「백엔드 계층·이름·주석」. 여기는 Spring 에서의 기본 모양이다.
**프로젝트가 이미 다른 구조·이름을 쓰면 그것이 우선이다** — 이 표에 맞추려고 기존 코드를 옮기지 않는다.

## 패키지 구조 (`{{ws:vars.spring.basePackage}}`)

| 패키지 | 역할 | 이름 |
|--------|------|------|
| `webapi/{도메인}/v1/` | `@RestController` | `*Api` |
| `webapi/{도메인}/v1/form/` | 요청 입력 (독립 클래스, inner class 아님) | `*Form` |
| `service/{도메인}/` | 비즈니스 로직 | `*Service` |
| `query/{도메인}/` | QueryDSL 동적 쿼리 (class) | `*Query` |
| `repository/{도메인}/` | Spring Data JPA (interface) | `*Repository` |
| `mapper/{도메인}/` | MapStruct 엔티티 ↔ DTO | `*Mapper` |
| `model/entity/{도메인}/` | JPA 엔티티 | 접미사 없음 |
| `model/base/` | 공통 감사 컬럼 (`@MappedSuperclass`) | `BaseEntity` |
| `model/dto/{도메인}/` | 응답·프로젝션 DTO | `*Dto` |
| `model/type/{도메인}/` | enum 상수 | `*Type` |
| `config/{역할}/` | 설정 (`jpa`·`security`·`web` …) | `*Config` |

- 엔티티 연관은 `@ManyToOne`/`@OneToMany` 대신 **plain FK 필드**(`UUID orderId`)로 두고, 조인은 QueryDSL `on()` 으로 명시한다 — 지연 로딩·N+1·순환 참조가 조회 코드에서 보이게 한다. 프로젝트가 연관 매핑을 쓰고 있으면 그대로 따른다.
- 엔티티 필드·컬럼은 풀네임 — `descriptionContent` ↔ `@Column(name = "description_content")`.

## MapStruct

- 엔티티 ↔ DTO 변환은 `@Mapper(componentModel = "spring")` 인터페이스로, `mapper/{도메인}/` 에 둔다. 서비스에서 필드를 손으로 옮기지 않는다.
- 이름이 다른 필드·파생 값은 `@Mapping(target, source | expression)`, 채우지 않을 필드는 `ignore = true` 로 **명시**한다 — 빌드 경고(unmapped target)를 무시하지 않는다.

## 메서드 이름 — 레이어별 기본

| 레이어 | 등록 | 수정 | 삭제 | 단건 | 목록 |
|---|---|---|---|---|---|
| Controller | `create{도메인}` | `modify{도메인}` | `delete{도메인}` | `find{도메인}` | `page{도메인}` / `cursor{도메인}` |
| Service | `create` | `modify` | `delete` | `get` + 용도 (`getDetail`) | `getPage` |
| Query | — | — | — | `find` + 용도·조건 (`findDetail`) | `findPage`, `findCursorList` |
| Repository | Spring Data 규칙 (`findBy`·`existsBy`·`countBy`·`deleteBy`) | | | | |

## Javadoc

- 모든 public 클래스·메서드에 Javadoc, 분량은 backend 팩 상한. **평문**으로 — `{@link}`·`@see`·`<p>`·`@param`·`@return`·`@throws` 를 쓰지 않는다.
- 애너테이션이 있는 클래스는 **첫 애너테이션 앞**에 둔다.

Java 일반 규칙(import·명명·선언 순서·포매터)은 `packs/stack-spring/docs/java-convention.md`.
버전을 올리거나 변경 기록을 쓸 때는 `packs/stack-spring/docs/versioning.md`.
